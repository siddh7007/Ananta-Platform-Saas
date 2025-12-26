"""
CNS Bulk Upload API - Redis Storage Pipeline

Handles large file uploads for CNS staff/admins.

Architecture:
- Raw files → MinIO S3
- BOM data → Redis (temporary, 24h TTL)
- Supabase → Customer BOMs only ✅

This keeps Supabase clean for customer data.
Staff bulk uploads are stored in Redis for processing, then cleaned up.

Authorization:
    Uses app-layer RLS via app.core.authorization module.
    Most endpoints require ADMIN role.
    See docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md for details.
"""

import io
import json
import logging
import uuid
from uuid import UUID
from datetime import datetime
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import text

from app.config import settings
from app.utils.activity_log import record_audit_log_entry
from app.utils.bulk_upload_redis import get_bulk_upload_storage
from app.utils.minio_client import get_minio_client, upload_to_minio

# App-layer authorization (see docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md)
from app.core.authorization import (
    AuthContext,
    get_auth_context,
    Role,
    require_role,
)

# Import event bus
try:
    from shared.event_bus import EventPublisher
    EVENT_BUS_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Failed to import event_bus: {e}. Events will be logged but not published.")
    EVENT_BUS_AVAILABLE = False

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bulk", tags=["CNS Bulk Upload - Redis Storage"])


def _safe_uuid(value: Optional[str]) -> Optional[str]:
    """Return value if it's a valid UUID string, otherwise None."""
    if not value:
        return None
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError):
        return None


class BulkUploadResponse(BaseModel):
    """Response for CNS bulk upload"""
    upload_id: str
    bom_id: Optional[str] = None  # Supabase BOM ID for unified enrichment
    filename: str
    file_size: int
    s3_bucket: str
    s3_key: str
    s3_url: Optional[str]
    storage_backend: str
    data_storage: str = "redis"  # NEW: Indicate Redis storage
    status: str
    total_rows: int
    line_items_saved: int
    redis_ttl_hours: int
    rabbitmq_event_published: bool
    message: str


class BulkUploadStatusResponse(BaseModel):
    """Status response for bulk upload (from Redis)"""
    upload_id: str
    filename: str
    status: str
    total_rows: int
    enrichment_progress: Optional[dict]
    error_message: Optional[str]
    created_at: str
    redis_expires_at: Optional[str]


@router.post("/upload", response_model=BulkUploadResponse)
@require_role(Role.ADMIN)
async def upload_bulk_file(
    file: UploadFile = File(..., description="BOM file (CSV, XLSX, XLS)"),
    organization_id: str = Form(..., description="Tenant UUID"),
    project_id: Optional[str] = Form(None, description="Project UUID (optional)"),
    uploaded_by: Optional[str] = Form(None, description="User UUID (optional)"),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Upload bulk BOM file - Redis Storage Pipeline

    Flow:
    1. Validate file type
    2. Upload raw file to MinIO/S3
    3. Parse CSV/Excel immediately
    4. ✅ Save metadata to Redis (temporary, 24h TTL)
    5. ✅ Save line items to Redis (temporary, 24h TTL)
    6. Publish RabbitMQ event
    7. Return upload details

    Data Storage:
    - Raw file: MinIO S3 (permanent)
    - BOM data: Redis (temporary, auto-expires)
    - Supabase: Customer BOMs only (not used here)

    Why Redis?
    - Fast temporary storage
    - Auto-expiration (24h TTL)
    - Keeps Supabase clean
    - Perfect for staff bulk uploads
    """
    upload_id = str(uuid.uuid4())

    # APP-LAYER RLS: Non-super_admins can only upload to their own organization
    if not auth.is_super_admin and auth.organization_id != organization_id:
        logger.warning(f"[Admin] Unauthorized bulk upload attempt: user={auth.user_id} tried to upload to org={organization_id}")
        raise HTTPException(status_code=403, detail="Cannot upload BOMs to other organizations")

    try:
        logger.info(
            f"[CNS Bulk Upload Redis] Starting upload: {file.filename} by user={auth.user_id}",
            extra={
                'upload_id': upload_id,
                'organization_id': organization_id,
                'upload_file_size': file.size,
                'user_id': auth.user_id,
                'role': auth.role
            }
        )

        # ====================================================================
        # STEP 1: Validate file type
        # ====================================================================
        allowed_extensions = ['csv', 'xlsx', 'xls']
        file_ext = file.filename.split('.')[-1].lower()

        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type: {file_ext}. Allowed: {', '.join(allowed_extensions)}"
            )

        # Read file content
        file_content = await file.read()
        file_size = len(file_content)

        logger.info(f"[CNS Bulk Upload Redis] File read: {file_size} bytes")

        # ====================================================================
        # STEP 2: Upload raw file to MinIO
        # ====================================================================
        minio_client = get_minio_client()
        if not minio_client.is_enabled():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="MinIO storage is not enabled. Please enable MinIO to upload files."
            )

        s3_key, s3_url, error = upload_to_minio(
            file_content=file_content, organization_id=organization_id,
            upload_id=upload_id,
            filename=file.filename,
            content_type=file.content_type or 'application/octet-stream',
            bucket=settings.minio_bucket_uploads
        )

        if error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload to MinIO: {error}"
            )

        logger.info(
            f"[CNS Bulk Upload Redis] File uploaded to MinIO: {s3_key}",
            extra={'s3_url': s3_url}
        )

        # ====================================================================
        # STEP 3: Parse CSV/Excel file
        # ====================================================================
        logger.info(f"[CNS Bulk Upload Redis] Parsing file: {file.filename}")

        try:
            file_stream = io.BytesIO(file_content)

            # Parse based on file type
            if file_ext == 'csv':
                df = pd.read_csv(file_stream)
            elif file_ext in ['xlsx', 'xls']:
                df = pd.read_excel(file_stream)
            else:
                raise ValueError(f"Unsupported file type: {file_ext}")

            total_rows = len(df)
            logger.info(f"[CNS Bulk Upload Redis] Parsed {total_rows} rows from file")

        except Exception as e:
            logger.error(f"[CNS Bulk Upload Redis] File parsing failed: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse file: {str(e)}"
            )

        # ====================================================================
        # STEP 4: Initialize Redis storage
        # ====================================================================
        redis_storage = get_bulk_upload_storage(upload_id)
        if not redis_storage:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Redis storage not available. Cannot process bulk upload."
            )

        # ====================================================================
        # STEP 5: Save metadata to Redis
        # ====================================================================
        metadata = {
            'upload_id': upload_id,
            'filename': file.filename,
            'original_filename': file.filename,
            'file_size': file_size,
            'file_type': file_ext,
            'organization_id': organization_id,
            'project_id': project_id,
            'uploaded_by': uploaded_by,
            'upload_source': 'cns_bulk',  # Staff upload
            'storage_backend': 'minio',
            's3_bucket': settings.minio_bucket_uploads,
            's3_key': s3_key,
            's3_url': s3_url,
            'total_rows': total_rows,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

        if not redis_storage.save_metadata(metadata, ttl_hours=24):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save metadata to Redis"
            )

        redis_storage.set_status("processing", ttl_hours=24)

        logger.info(f"[CNS Bulk Upload Redis] Metadata saved to Redis")

        # ====================================================================
        # STEP 6: Build and save line items to Redis
        # ====================================================================
        logger.info(f"[CNS Bulk Upload Redis] Building {total_rows} line items")

        line_items = []
        for idx, row in df.iterrows():
            # Store raw row data in metadata
            row_dict = row.to_dict()
            line_item = {
                'id': str(uuid.uuid4()),
                'line_number': idx + 1,
                'metadata': row_dict,  # ✅ Store as dict, not JSON string
                'quantity': 1,  # Default quantity
                'enrichment_status': 'pending',  # ✅ Mark for enrichment
                'match_status': 'unmatched'  # ✅ Not yet matched to catalog
            }

            # Extract common BOM columns (case-insensitive mapping)
            # Normalize: lowercase + replace spaces with underscores to handle "Part Number" → "part_number"
            row_dict_lower = {k.lower().replace(' ', '_'): v for k, v in row_dict.items()}

            # Map to manufacturer_part_number
            for col_name in ['mpn', 'part_number', 'partnumber', 'part', 'manufacturer_part_number']:
                if col_name in row_dict_lower and pd.notna(row_dict_lower[col_name]):
                    line_item['manufacturer_part_number'] = str(row_dict_lower[col_name])
                    break

            # Skip line items without part number (can't enrich)
            if 'manufacturer_part_number' not in line_item:
                logger.warning(f"Row {idx+1} missing part number, skipping")
                continue

            # Map to manufacturer
            for col_name in ['manufacturer', 'mfr', 'mfg']:
                if col_name in row_dict_lower and pd.notna(row_dict_lower[col_name]):
                    line_item['manufacturer'] = str(row_dict_lower[col_name])
                    break

            # Map to quantity (use Decimal for precision)
            for col_name in ['quantity', 'qty', 'qnty']:
                if col_name in row_dict_lower and pd.notna(row_dict_lower[col_name]):
                    try:
                        line_item['quantity'] = float(row_dict_lower[col_name])
                    except (ValueError, TypeError):
                        line_item['quantity'] = 1
                    break

            # Map to reference_designator
            for col_name in ['reference', 'ref', 'designator', 'refdes', 'reference_designator']:
                if col_name in row_dict_lower and pd.notna(row_dict_lower[col_name]):
                    line_item['reference_designator'] = str(row_dict_lower[col_name])
                    break

            # Map to description
            for col_name in ['description', 'desc']:
                if col_name in row_dict_lower and pd.notna(row_dict_lower[col_name]):
                    line_item['description'] = str(row_dict_lower[col_name])
                    break

            line_items.append(line_item)

        # Save line items to Redis in bulk
        if line_items:
            if not redis_storage.add_line_items_bulk(line_items, ttl_hours=24):
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to save line items to Redis"
                )

            line_items_saved = len(line_items)
            logger.info(f"[CNS Bulk Upload Redis] Successfully saved {line_items_saved} line items to Redis")
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid line items found. At least one row must have a part number."
            )

        # ====================================================================
        # STEP 7: Update status to completed
        # ====================================================================
        redis_storage.set_status("completed", ttl_hours=24)

        # Update metadata with line items count
        metadata['line_items_saved'] = line_items_saved
        metadata['status'] = 'completed'
        metadata['updated_at'] = datetime.utcnow().isoformat()
        redis_storage.save_metadata(metadata, ttl_hours=24)

        logger.info(f"[CNS Bulk Upload Redis] Upload completed: {upload_id}")

        # ====================================================================
        # STEP 7.5: Create Supabase BOM + Line Items (Unified Enrichment)
        # ====================================================================
        # This makes bulk uploads compatible with the unified enrichment endpoint
        # /api/boms/{bom_id}/enrichment/start which expects Supabase data
        bom_id = None
        try:
            from app.models.dual_database import get_dual_database
            import uuid as uuid_lib

            logger.info(f"[CNS Bulk Upload] Creating Supabase BOM for unified enrichment (organization: {organization_id})")

            dual_db = get_dual_database()
            # Use the DualDatabaseManager generator in a safe way so that
            # the session is always closed (even on errors).
            supabase_session_gen = dual_db.get_session("supabase")
            supabase_db = next(supabase_session_gen)

            try:
                # Check if BOM already exists for this upload_id (prevent duplicates on retry)
                check_existing_query = text("""
                    SELECT id FROM boms
                    WHERE metadata->>'upload_id' = :upload_id
                    LIMIT 1
                """)
                existing_result = supabase_db.execute(check_existing_query, {"upload_id": upload_id})
                existing_row = existing_result.fetchone()

                if existing_row:
                    bom_id = str(existing_row[0])
                    logger.warning(
                        f"[CNS Bulk Upload] BOM already exists for upload_id {upload_id}: {bom_id}. "
                        "Reusing existing BOM instead of creating duplicate."
                    )
                else:
                    # Generate new BOM ID
                    bom_id = str(uuid_lib.uuid4())

                    # Create BOM record
                    bom_insert_query = text("""
                    INSERT INTO boms (
                    id,
                    name,
                    organization_id,
                    project_id,
                    component_count,
                    status,
                    metadata,
                    created_at,
                    updated_at
                ) VALUES (
                    :bom_id,
                    :bom_name,
                    :organization_id,
                    :project_id,
                    :component_count,
                    'pending',
                    jsonb_build_object(
                        'upload_source', 'cns_bulk',
                        'upload_id', :upload_id,
                        'uploaded_by', :uploaded_by,
                        'filename', :filename,
                        's3_bucket', :s3_bucket,
                        's3_key', :s3_key
                    ),
                    NOW(),
                    NOW()
                )
                """)

                    supabase_db.execute(bom_insert_query, {
                        "bom_id": bom_id,
                        "bom_name": f"Bulk Upload - {file.filename}",
                        "organization_id": organization_id,
                        "project_id": project_id,
                        "component_count": line_items_saved,
                        "upload_id": upload_id,
                        "uploaded_by": uploaded_by,
                        "filename": file.filename,
                        "s3_bucket": settings.minio_bucket_uploads,
                        "s3_key": s3_key
                    })

                    logger.info(f"[CNS Bulk Upload] ✅ BOM created in Supabase: {bom_id}")

                    # Insert line items (organization_id not needed - RLS handled via bom_id → boms.organization_id)
                    for item in line_items:
                        line_insert_query = text("""
                            INSERT INTO bom_line_items (
                                id,
                                bom_id,
                                line_number,
                                manufacturer_part_number,
                                manufacturer,
                                quantity,
                                reference_designator,
                                description,
                                enrichment_status,
                                created_at,
                                updated_at
                            ) VALUES (
                                :line_id,
                                :bom_id,
                                :line_number,
                                :mpn,
                                :manufacturer,
                                :quantity,
                                :reference_designator,
                                :description,
                                'pending',
                                NOW(),
                                NOW()
                            )
                        """)

                        supabase_db.execute(line_insert_query, {
                            "line_id": item['id'],
                            "bom_id": bom_id,
                            "line_number": item['line_number'],
                            "mpn": item.get('manufacturer_part_number'),
                            "manufacturer": item.get('manufacturer'),
                            "quantity": item.get('quantity', 1),
                            "reference_designator": item.get('reference_designator'),
                            "description": item.get('description')
                        })

                supabase_db.commit()
                logger.info(f"[CNS Bulk Upload] ✅ Created {line_items_saved} line items in Supabase")

                # ====================================================================
                # Create cns_bulk_uploads record for metadata tracking
                # ====================================================================
                try:
                    cns_upload_insert = text("""
                        INSERT INTO cns_bulk_uploads (
                            id,
                            filename,
                            file_size,
                            file_type,
                            original_name,
                            s3_bucket,
                            s3_key,
                            s3_url,
                            storage_backend,
                            tenant_id,
                            organization_id,
                            project_id,
                            uploaded_by,
                            status,
                            total_rows,
                            valid_rows,
                            cns_job_id,
                            temporal_workflow_id,
                            rabbitmq_event_published,
                            created_at,
                            updated_at
                        ) VALUES (
                            :upload_id,
                            :filename,
                            :file_size,
                            :file_type,
                            :original_name,
                            :s3_bucket,
                            :s3_key,
                            :s3_url,
                            'minio',
                            :organization_id,
                            :organization_id,
                            :project_id,
                            :uploaded_by,
                            'uploaded',
                            :total_rows,
                            :valid_rows,
                            :bom_id,
                            NULL,
                            :event_published,
                            NOW(),
                            NOW()
                        )
                        ON CONFLICT (id) DO UPDATE SET
                            updated_at = NOW()
                    """)

                    supabase_db.execute(cns_upload_insert, {
                        "upload_id": upload_id,
                        "filename": file.filename,
                        "file_size": file_size,
                        "file_type": file_ext,
                        "original_name": file.filename,
                        "s3_bucket": settings.minio_bucket_uploads,
                        "s3_key": s3_key,
                        "s3_url": s3_url,
                        "organization_id": organization_id,
                        "project_id": project_id,
                        "uploaded_by": _safe_uuid(
                            uploaded_by if uploaded_by and uploaded_by != "cns-dashboard" else None
                        ),
                        "total_rows": line_items_saved,
                        "valid_rows": line_items_saved,
                        "bom_id": bom_id,
                        "event_published": False  # Will be updated when enrichment starts
                    })
                    supabase_db.commit()
                    logger.info(f"[CNS Bulk Upload] ✅ Created cns_bulk_uploads tracking record: {upload_id}")

                except Exception as cns_err:
                    logger.warning(f"[CNS Bulk Upload] Failed to create cns_bulk_uploads record: {cns_err}")
                    # Not critical - continue with upload
                    supabase_db.rollback()

                # Link bom_uploads to boms (if bom_uploads record exists)
                try:
                    upload_link_query = text("""
                        UPDATE bom_uploads
                        SET bom_id = :bom_id, updated_at = NOW()
                        WHERE id = :upload_id
                    """)
                    supabase_db.execute(upload_link_query, {
                        "bom_id": bom_id,
                        "upload_id": upload_id
                    })
                    supabase_db.commit()
                    logger.info(f"[CNS Bulk Upload] ✅ Linked bom_uploads to BOM: {bom_id}")
                except Exception as link_err:
                    logger.warning(f"[CNS Bulk Upload] Could not link bom_uploads (may not exist): {link_err}")
                    # Not critical - bulk uploads may not have bom_uploads records

                # Record audit log entry so Activity Log shows staff uploads
                if bom_id:
                    record_audit_log_entry(
                        supabase_db,
                        event_type="cns.bulk.uploaded",
                        routing_key="cns.bom.bulk_uploaded",
                        organization_id=organization_id,
                        user_id=uploaded_by if uploaded_by and uploaded_by != "cns-dashboard" else None,
                        username="cns-dashboard" if not uploaded_by or uploaded_by == "cns-dashboard" else uploaded_by,
                        source="cns-dashboard",
                        event_data={
                            "bom_id": bom_id,
                            "upload_id": upload_id,
                            "filename": file.filename,
                            "total_items": line_items_saved,
                            "storage_backend": "redis",
                            "project_id": project_id,
                            "organization_id": organization_id,
                            "bom_name": f"Bulk Upload - {file.filename}",
                        },
                    )
                    supabase_db.commit()
                    logger.info("[CNS Bulk Upload] 📝 Audit log entry recorded for bulk upload")

            except Exception:
                # Roll back any partial Supabase writes
                logger.error("[CNS Bulk Upload] Error during Supabase BOM creation", exc_info=True)
                supabase_db.rollback()
                bom_id = None
                logger.warning("[CNS Bulk Upload] Continuing with Redis-only storage (Supabase BOM creation failed)")
            finally:
                # Ensure the generator's cleanup runs so the session is closed
                try:
                    next(supabase_session_gen)
                except StopIteration:
                    pass

        except Exception:
            logger.error(f"[CNS Bulk Upload] Failed to create Supabase BOM", exc_info=True)
            # Don't fail the whole upload - Redis path still works
            bom_id = None

        # ====================================================================
        # STEP 8: Publish RabbitMQ event
        # ====================================================================
        event_published = False

        if EVENT_BUS_AVAILABLE:
            try:
                # Use the canonical Supabase BOM ID if available so
                # downstream consumers receive the correct identifier.
                EventPublisher.cns_bulk_uploaded(
                    bom_id=bom_id or upload_id, organization_id=organization_id,
                    admin_id=uploaded_by or 'cns-bulk-upload',
                    filename=file.filename,
                    file_size=file_size,
                    s3_key=s3_key,
                    s3_bucket=settings.minio_bucket_uploads,
                    total_items=line_items_saved
                )

                event_published = True
                logger.info(f"[CNS Bulk Upload Redis] RabbitMQ event published: staff.bom.bulk_uploaded (bom_id={bom_id or upload_id})")

            except Exception as e:
                logger.error(f"[CNS Bulk Upload Redis] Failed to publish RabbitMQ event: {e}", exc_info=True)
        else:
            logger.warning("[CNS Bulk Upload Redis] Event bus not available, event not published")

        # ====================================================================
        # STEP 9: Return response
        # ====================================================================
        return BulkUploadResponse(
            upload_id=upload_id,
            bom_id=bom_id,  # Supabase BOM ID (None if creation failed)
            filename=file.filename,
            file_size=file_size,
            s3_bucket=settings.minio_bucket_uploads,
            s3_key=s3_key,
            s3_url=s3_url,
            storage_backend='minio',
            data_storage='redis',  # ✅ Indicates Redis storage
            status='completed',
            total_rows=total_rows,
            line_items_saved=line_items_saved,
            redis_ttl_hours=24,
            rabbitmq_event_published=event_published,
            message=f"✅ File uploaded and processed successfully. {line_items_saved} line items saved to Redis (expires in 24h). BOM ID: {bom_id or 'N/A'}."
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"[CNS Bulk Upload Redis] Upload failed: {e}",
            exc_info=True,
            extra={'upload_id': upload_id, 'file_name': file.filename}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )


@router.get("/uploads")
@require_role(Role.ADMIN)
async def list_bulk_uploads(
    auth: AuthContext = Depends(get_auth_context),
):
    """
    List all active bulk uploads from Redis. Requires ADMIN role.

    Scans Redis for all bulk_upload:* keys and returns metadata.
    Non-super_admins only see uploads from their own organization.
    """
    logger.info(f"[Admin] list_bulk_uploads: user={auth.user_id} role={auth.role}")
    try:
        from app.cache.redis_cache import get_cache

        redis_cache = get_cache()
        if not redis_cache or not redis_cache.is_connected:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Redis not available"
            )

        redis_client = redis_cache.get_client()

        # Scan for all bulk upload metadata keys
        pattern = "bulk_upload:*:metadata"
        keys = []
        cursor = 0

        while True:
            cursor, partial_keys = redis_client.scan(cursor, match=pattern, count=100)
            keys.extend(partial_keys)
            if cursor == 0:
                break

        # Fetch metadata for each upload
        uploads = []
        for key in keys:
            # Extract upload_id from key: bulk_upload:{upload_id}:metadata
            # Handle both bytes and str (redis-py can return either)
            key_str = key.decode('utf-8') if isinstance(key, bytes) else key
            upload_id = key_str.split(':')[1]

            redis_storage = get_bulk_upload_storage(upload_id)
            metadata = redis_storage.get_metadata()

            if metadata:
                # APP-LAYER RLS: Non-super_admins only see their organization's uploads
                upload_org_id = metadata.get('organization_id')
                if not auth.is_super_admin and upload_org_id != auth.organization_id:
                    continue  # Skip uploads from other organizations

                status_str = redis_storage.get_status() or 'unknown'
                progress = redis_storage.get_progress()

                uploads.append({
                    'upload_id': upload_id,
                    'filename': metadata.get('filename', 'unknown'),
                    'status': status_str,
                    'total_rows': metadata.get('total_rows', 0),
                    'line_items_saved': metadata.get('line_items_saved', 0),
                    'created_at': metadata.get('created_at'),
                    'organization_id': upload_org_id,
                    'progress': progress,
                    'redis_expires_at': redis_storage.get_redis_expires_at()
                })

        # Sort by created_at descending (newest first)
        uploads.sort(key=lambda x: x.get('created_at', ''), reverse=True)

        return {
            'success': True,
            'count': len(uploads),
            'uploads': uploads
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing bulk uploads: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list uploads: {str(e)}"
        )


@router.get("/upload/{upload_id}", response_model=BulkUploadStatusResponse)
@router.get("/uploads/{upload_id}", response_model=BulkUploadStatusResponse)  # Alias for consistency
@require_role(Role.ADMIN)
async def get_bulk_upload_status(
    upload_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Get status of bulk upload from Redis. Requires ADMIN role.

    Returns upload metadata and enrichment progress if available.
    Non-super_admins can only access uploads from their own organization.
    """
    logger.info(f"[Admin] get_bulk_upload_status: user={auth.user_id} upload_id={upload_id}")
    try:
        redis_storage = get_bulk_upload_storage(upload_id)
        if not redis_storage:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Redis storage not available"
            )

        # Check if upload exists
        if not redis_storage.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Upload not found: {upload_id} (may have expired)"
            )

        # Get metadata
        metadata = redis_storage.get_metadata()
        if not metadata:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Upload metadata not found: {upload_id}"
            )

        # APP-LAYER RLS: Non-super_admins can only access their organization's uploads
        upload_org_id = metadata.get('organization_id')
        if not auth.is_super_admin and upload_org_id != auth.organization_id:
            raise HTTPException(status_code=403, detail="Access denied to this upload")

        # Get status
        status_str = redis_storage.get_status() or 'unknown'

        # Get enrichment progress
        progress = redis_storage.get_progress()

        return BulkUploadStatusResponse(
            upload_id=upload_id,
            filename=metadata.get('filename', 'unknown'),
            status=status_str,
            total_rows=metadata.get('total_rows', 0),
            enrichment_progress=progress,
            error_message=metadata.get('error_message'),
            created_at=metadata.get('created_at', ''),
            redis_expires_at=redis_storage.get_redis_expires_at()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching upload status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch upload status: {str(e)}"
        )


@router.get("/health")
async def bulk_upload_health():
    """Health check for bulk upload service"""
    from app.cache.redis_cache import get_cache

    minio_client = get_minio_client()
    redis_cache = get_cache()

    return {
        "status": "healthy",
        "storage": {
            "minio_enabled": minio_client.is_enabled(),
            "redis_connected": redis_cache.is_connected if redis_cache else False,
        },
        "data_storage": "redis",  # ✅ Indicates Redis storage
        "supabase_usage": "customer_boms_only",  # ✅ Clarify Supabase usage
        "event_bus_available": EVENT_BUS_AVAILABLE,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/cleanup-expired")
@require_role(Role.ADMIN)
async def cleanup_expired_uploads(
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Cleanup expired bulk uploads from Redis. Requires ADMIN role.

    Admin endpoint to manually trigger cleanup.
    Normally Redis auto-expires keys via TTL.
    """
    logger.info(f"[Admin] cleanup_expired_uploads: user={auth.user_id}")
    try:
        from app.utils.bulk_upload_redis import cleanup_expired_bulk_uploads

        cleaned_count = cleanup_expired_bulk_uploads()

        return {
            "success": True,
            "cleaned_uploads": cleaned_count,
            "message": f"Cleaned up {cleaned_count} expired bulk uploads"
        }

    except Exception as e:
        logger.error(f"Failed to cleanup expired uploads: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cleanup failed: {str(e)}"
        )
