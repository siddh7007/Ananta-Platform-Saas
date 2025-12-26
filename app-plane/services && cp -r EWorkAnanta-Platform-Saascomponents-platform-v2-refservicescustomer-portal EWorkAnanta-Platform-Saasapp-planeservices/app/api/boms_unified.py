"""Unified BOM Upload & Enrichment API

Single endpoint for uploading BOMs that handles:
- Raw file storage (audit/recovery)
- Parsing with column mappings
- BOM + line items creation in Supabase
- Parsed snapshot storage (audit/verification)
- Optional enrichment workflow start

This endpoint serves as the new unified path for both customer and staff BOMs,
implementing the Option C+ architecture alongside existing endpoints.

Authorization:
    Uses app-layer RLS via app.core.authorization module.
    Endpoints require authentication and verify tenant access.
    See docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md for details.
"""

import json
import logging
import uuid as uuid_lib
from uuid import UUID
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any, List
from io import BytesIO

import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.models.dual_database import get_dual_database
from app.services.bom_ingest import build_line_items_from_rows, create_supabase_bom_and_items
from app.utils.directus_client import get_directus_file_service
from app.workflows.temporal_client import get_temporal_client
from app.workflows.bom_enrichment import BOMEnrichmentRequest

# App-layer authorization (see docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md)
from app.core.authorization import (
    AuthContext,
    get_auth_context,
    Role,
    require_role,
)

logger = logging.getLogger(__name__)
UPLOADS_BUCKET = settings.minio_bucket_uploads or "cns-bom-uploads"

router = APIRouter(prefix="/boms", tags=["boms-unified"])


def _safe_uuid(value: Optional[str]) -> Optional[str]:
    """Return UUID string if value is valid, else None."""
    if not value:
        return None
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError):
        return None


class BOMUploadResponse(BaseModel):
    """Response from unified BOM upload endpoint."""

    bom_id: str = Field(..., description="UUID of created BOM in Supabase")
    organization_id: str = Field(..., description="Tenant ID")
    component_count: int = Field(..., description="Number of line items created")

    # Audit trail
    raw_file_s3_key: str = Field(..., description="S3 key for raw uploaded file (recovery)")
    parsed_file_s3_key: str = Field(..., description="S3 key for parsed snapshot (verification)")

    # Enrichment (if started)
    enrichment_started: bool = Field(default=False, description="Whether enrichment workflow was started")
    workflow_id: Optional[str] = Field(default=None, description="Temporal workflow ID if enrichment started")

    # Status
    status: str = Field(..., description="BOM status in Supabase")
    priority: str = Field(..., description="Enrichment priority (high/normal)")


def parse_csv_file(file_content: bytes, filename: str) -> pd.DataFrame:
    """Parse uploaded CSV file into DataFrame.

    Args:
        file_content: Raw file bytes
        filename: Original filename (for error messages)

    Returns:
        Parsed DataFrame

    Raises:
        HTTPException: If file cannot be parsed
    """
    try:
        df = pd.read_csv(BytesIO(file_content))

        if df.empty:
            raise HTTPException(
                status_code=400,
                detail=f"File '{filename}' is empty or contains no data rows"
            )

        logger.info(f"[boms_unified] Parsed {len(df)} rows from {filename}")
        return df

    except pd.errors.EmptyDataError:
        raise HTTPException(
            status_code=400,
            detail=f"File '{filename}' is empty or contains no data"
        )
    except Exception as e:
        logger.error(f"[boms_unified] Failed to parse {filename}: {e}", exc_info=True)
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse CSV file: {str(e)}"
        )


def store_file_to_minio(
    file_content: bytes,
    s3_key: str,
    content_type: str = "text/csv"
) -> str:
    """Store file to MinIO and return the S3 key.

    Args:
        file_content: File bytes to store
        s3_key: S3 key (path) for the file
        content_type: MIME type

    Returns:
        S3 key of stored file

    Raises:
        HTTPException: If storage fails
    """
    try:
        from app.utils.minio_client import get_minio_client

        minio_client = get_minio_client()
        bucket = UPLOADS_BUCKET

        # Upload file using minio_client
        success, error = minio_client.upload_file(bucket, s3_key, file_content, content_type)

        if not success:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload to MinIO: {error}"
            )

        logger.info(f"[boms_unified] Stored file to s3://{bucket}/{s3_key}")
        return s3_key

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[boms_unified] Failed to store file to MinIO: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to store file: {str(e)}"
        )


def register_directus_upload_artifact(
    *,
    object_key: str,
    filename_download: str,
    artifact_kind: str,
    bom_id: str,
    organization_id: str,
    source: str,
    project_id: Optional[str],
    uploaded_by: Optional[str],
    content_type: str,
) -> None:
    """Optionally register uploaded artifacts inside Directus for staff downloads."""
    try:
        directus = get_directus_file_service()
        if not directus or not directus.is_enabled():
            return

        metadata = {
            "bom_id": bom_id,
            "organization_id": organization_id,
            "project_id": project_id,
            "artifact_kind": artifact_kind,
            "source": source,
            "uploaded_by": uploaded_by,
        }
        metadata = {k: v for k, v in metadata.items() if v is not None}

        description = (
            "Original BOM upload file (before parsing)"
            if artifact_kind == "raw"
            else "Parsed BOM snapshot used for ingestion/enrichment"
        )
        title = f"BOM {artifact_kind.capitalize()} File ({bom_id})"

        directus.register_minio_object(
            bucket=UPLOADS_BUCKET,
            object_key=object_key,
            filename_download=filename_download,
            title=title,
            description=description,
            content_type=content_type,
            metadata=metadata,
        )
    except Exception as exc:
        # Registration failures should never block uploads.
        logger.debug(f"[boms_unified] Directus registration skipped for {object_key}: {exc}")

def apply_column_mappings(
    df: pd.DataFrame,
    column_mappings: Optional[Dict[str, str]] = None
) -> pd.DataFrame:
    """Apply column mappings to rename DataFrame columns.

    Args:
        df: Original DataFrame
        column_mappings: Dict mapping source column names to canonical field names

    Returns:
        DataFrame with renamed columns
    """
    if not column_mappings:
        return df

    # Invert the mapping for pandas rename (needs {old_name: new_name})
    # Input format: {"canonical_field": "csv_column"}
    # Pandas needs: {"csv_column": "canonical_field"}
    inverted_mapping = {csv_col: canonical_field for canonical_field, csv_col in column_mappings.items()}

    # Rename columns according to inverted mapping
    df = df.rename(columns=inverted_mapping)
    logger.info(f"[boms_unified] Applied column mappings: {column_mappings}")
    return df


@router.post("/upload", response_model=BOMUploadResponse)
@require_role(Role.ANALYST)  # Any authenticated user can upload
async def upload_bom(
    file: UploadFile = File(..., description="BOM file (CSV)"),
    organization_id: str = Form(..., description="Tenant ID"),
    bom_name: Optional[str] = Form(None, description="BOM name (defaults to filename)"),
    project_id: Optional[str] = Form(None, description="Project ID (optional)"),
    priority: str = Form("normal", description="Enrichment priority: high or normal"),
    source: str = Form("customer", description="Upload source: customer or staff_bulk"),
    uploaded_by: Optional[str] = Form(None, description="User ID who uploaded"),
    column_mappings: Optional[str] = Form(None, description="JSON dict mapping source columns to canonical fields"),
    start_enrichment: bool = Form(True, description="Start enrichment workflow after upload"),
    auth: AuthContext = Depends(get_auth_context),
) -> BOMUploadResponse:
    """Unified BOM upload endpoint.

    Handles the complete BOM upload flow:
    1. Store raw file to MinIO (audit/recovery)
    2. Parse CSV with column mappings
    3. Create BOM + line items in Supabase
    4. Store parsed snapshot to MinIO (audit/verification)
    5. Optionally start enrichment workflow

    This endpoint can be used by:
    - Customer Portal (priority=high, source=customer)
    - CNS Dashboard (priority=normal, source=staff_bulk)
    - CLI tools and tests
    """

    # Validate priority
    if priority not in ("high", "normal"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid priority '{priority}'. Must be 'high' or 'normal'."
        )

    # Validate source
    if source not in ("customer", "staff_bulk"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid source '{source}'. Must be 'customer' or 'staff_bulk'."
        )

    # Basic organization_id validation (avoid cryptic DB errors on invalid UUIDs)
    try:
        uuid_lib.UUID(organization_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid organization_id format")

    # APP-LAYER RLS: Non-super_admins can only upload to their own organization
    if not auth.is_super_admin and auth.organization_id != organization_id:
        logger.warning(f"[boms_unified] Unauthorized upload attempt: user={auth.user_id} tried to upload to org={organization_id}")
        raise HTTPException(status_code=403, detail="Cannot upload BOMs to other organizations")

    logger.info(f"[boms_unified] Upload started by user={auth.user_id} role={auth.role}")

    # Parse column mappings if provided
    mappings_dict: Optional[Dict[str, str]] = None
    if column_mappings:
        try:
            mappings_dict = json.loads(column_mappings)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid column_mappings JSON: {str(e)}"
            )

    # Generate IDs
    bom_id = str(uuid_lib.uuid4())
    upload_id = bom_id  # Use same ID for backward compatibility
    filename = file.filename or "uploaded_bom.csv"
    bom_name_final = bom_name or f"BOM Upload - {filename}"

    # Basic extension validation (CSV-only for now)
    if not filename.lower().endswith(".csv"):
        logger.warning("[boms_unified] Unsupported file type for unified upload: %s", filename)
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Only CSV files are currently supported.",
        )

    # Read file content
    try:
        file_content = await file.read()
    except Exception as e:
        logger.error(f"[boms_unified] Failed to read uploaded file: {e}", exc_info=True)
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read uploaded file: {str(e)}"
        )

    # Enforce maximum file size (protect server from very large uploads)
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
    if len(file_content) > MAX_FILE_SIZE:
        logger.warning(
            "[boms_unified] File too large: %s bytes (limit=%s)",
            len(file_content),
            MAX_FILE_SIZE,
        )
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum supported size is 50MB.",
        )

    # Compute content hash for idempotency / audit
    file_hash = hashlib.sha256(file_content).hexdigest()

    # Store raw file to MinIO for audit/recovery
    start_time = datetime.utcnow()
    timestamp = start_time.strftime("%Y%m%d_%H%M%S")
    raw_s3_key = f"raw/{organization_id}/{bom_id}_{timestamp}_{filename}"
    raw_file_s3_key = store_file_to_minio(file_content, raw_s3_key, "text/csv")
    register_directus_upload_artifact(
        object_key=raw_file_s3_key,
        filename_download=filename,
        artifact_kind="raw",
        bom_id=bom_id,
        organization_id=organization_id,
        source=source,
        project_id=project_id,
        uploaded_by=uploaded_by,
        content_type="text/csv",
    )

    # Parse CSV
    df = parse_csv_file(file_content, filename)

    # Enforce maximum row count (prevent runaway imports)
    max_rows = 10_000
    if len(df) > max_rows:
        logger.warning(
            "[boms_unified] Too many rows: %s (limit=%s)",
            len(df),
            max_rows,
        )
        raise HTTPException(
            status_code=400,
            detail=f"Too many rows in file. Maximum supported is {max_rows} rows.",
        )

    # Apply column mappings if provided
    if mappings_dict:
        # Validate that all CSV columns referenced in mappings actually exist
        # mappings_dict format: {"canonical_field": "csv_column_name"}
        # So we check if VALUES (CSV column names) exist in the DataFrame
        missing_columns = [
            csv_col
            for csv_col in mappings_dict.values()
            if csv_col not in df.columns
        ]
        if missing_columns:
            logger.error(
                "[boms_unified] Missing CSV columns referenced in mappings: %s",
                missing_columns,
            )
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid column mappings. The following CSV columns were not "
                    f"found in the uploaded file: {', '.join(missing_columns)}"
                ),
            )

        df = apply_column_mappings(df, mappings_dict)

    # Convert to list of dicts for processing
    rows = df.to_dict(orient="records")

    # Build line items using shared helper
    line_items = build_line_items_from_rows(rows, organization_id=organization_id)

    if not line_items:
        raise HTTPException(
            status_code=400,
            detail="No valid line items found in file. Ensure file has MPN/part number column."
        )

    # Store parsed snapshot to MinIO for audit/verification
    parsed_snapshot = {
        "bom_id": bom_id,
        "organization_id": organization_id,
        "project_id": project_id,
        "bom_name": bom_name_final,
        "source": source,
        "uploaded_by": uploaded_by,
        "filename": filename,
        "upload_timestamp": datetime.utcnow().isoformat(),
        "line_items": line_items,
        "column_mappings": mappings_dict,
        "total_items": len(line_items),
        "file_hash": file_hash,
    }

    parsed_s3_key = f"parsed/{organization_id}/{bom_id}.json"
    parsed_content = json.dumps(parsed_snapshot, indent=2).encode("utf-8")
    parsed_file_s3_key = store_file_to_minio(parsed_content, parsed_s3_key, "application/json")
    register_directus_upload_artifact(
        object_key=parsed_file_s3_key,
        filename_download=f"{bom_id}.json",
        artifact_kind="parsed",
        bom_id=bom_id,
        organization_id=organization_id,
        source=source,
        project_id=project_id,
        uploaded_by=uploaded_by,
        content_type="application/json",
    )

    # Get database session
    dual_db = get_dual_database()
    db_gen = dual_db.get_session("supabase")

    try:
        db: Session = next(db_gen)

        # Create BOM + line items in Supabase (fixing the status='uploaded' bug)
        # Note: We'll update create_supabase_bom_and_items to support priority and audit fields
        from sqlalchemy import text
        from sqlalchemy.exc import SQLAlchemyError

        try:
            logger.info(
                f"[boms_unified] Creating Supabase BOM {bom_id} for organization {organization_id} "
                f"(priority={priority}, source={source})"
            )

            # Idempotency check: if a BOM with the same file_hash already exists
            # for this tenant, reuse it instead of creating a duplicate.
            idempotent_query = text("""
                SELECT id, component_count, raw_file_s3_key, parsed_file_s3_key, status
                FROM boms
                WHERE organization_id = :organization_id
                  AND metadata->>'file_hash' = :file_hash
                ORDER BY created_at DESC
                LIMIT 1
            """)

            existing = db.execute(
                idempotent_query,
                {"organization_id": organization_id, "file_hash": file_hash},
            ).fetchone()

            if existing:
                existing_bom_id, existing_count, existing_raw_key, existing_parsed_key, existing_status = existing
                logger.info(
                    "[boms_unified] Idempotency hit: reusing BOM %s for organization %s (file_hash=%s)",
                    existing_bom_id,
                    organization_id,
                    file_hash,
                )

                return BOMUploadResponse(
                    bom_id=str(existing_bom_id), organization_id=organization_id,
                    component_count=existing_count,
                    raw_file_s3_key=existing_raw_key,
                    parsed_file_s3_key=existing_parsed_key,
                    enrichment_started=False,
                    workflow_id=None,
                    status=existing_status,
                    priority=priority,
                )

            # Insert BOM with priority, hash, and audit fields
            bom_insert = text("""
                INSERT INTO boms (
                    id,
                    name,
                    organization_id,
                    project_id,
                    component_count,
                    status,
                    priority,
                    raw_file_s3_key,
                    parsed_file_s3_key,
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
                    :priority,
                    :raw_file_s3_key,
                    :parsed_file_s3_key,
                    jsonb_build_object(
                        'upload_source', :upload_source,
                        'upload_id', :upload_id,
                        'uploaded_by', :uploaded_by,
                        'filename', :filename,
                        'column_mappings', :column_mappings,
                        'file_hash', :file_hash
                    ),
                    NOW(),
                    NOW()
                )
            """)

            db.execute(
                bom_insert,
                {
                    "bom_id": bom_id,
                    "bom_name": bom_name_final,
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "component_count": len(line_items),
                    "priority": priority,
                    "raw_file_s3_key": raw_file_s3_key,
                    "parsed_file_s3_key": parsed_file_s3_key,
                    "upload_source": source,
                    "upload_id": upload_id,
                    "uploaded_by": uploaded_by,
                    "filename": filename,
                    "column_mappings": json.dumps(mappings_dict) if mappings_dict else "{}",
                    "file_hash": file_hash,
                },
            )

            # Insert line items (single executemany-style call for performance)
            item_insert = text("""
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
            db.execute(
                item_insert,
                [
                    {
                        "line_id": item["id"],
                        "bom_id": bom_id,
                        "line_number": item["line_number"],
                        "mpn": item.get("manufacturer_part_number"),
                        "manufacturer": item.get("manufacturer"),
                        "quantity": item.get("quantity", 1),
                        "reference_designator": item.get("reference_designator"),
                        "description": item.get("description"),
                    }
                    for item in line_items
                ],
            )

            db.commit()
            logger.info(
                f"[boms_unified] ✅ Supabase BOM {bom_id} created with {len(line_items)} line items"
            )

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
                        :bom_id,
                        :filename,
                        :file_size,
                        'csv',
                        :original_name,
                        :s3_bucket,
                        :s3_key,
                        NULL,
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
                        false,
                        NOW(),
                        NOW()
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        updated_at = NOW()
                """)

                db.execute(cns_upload_insert, {
                    "bom_id": bom_id,
                    "filename": filename,
                    "file_size": len(file_content),
                    "original_name": filename,
                    "s3_bucket": settings.minio_bucket_uploads or "cns-bom-uploads",
                    "s3_key": raw_file_s3_key,
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "uploaded_by": _safe_uuid(uploaded_by),
                    "total_rows": len(line_items),
                    "valid_rows": len(line_items)
                })
                db.commit()
                logger.info(f"[boms_unified] ✅ Created cns_bulk_uploads tracking record: {bom_id}")

            except Exception as cns_err:
                logger.warning(f"[boms_unified] Failed to create cns_bulk_uploads record: {cns_err}")
                # Not critical - continue with upload
                db.rollback()
                # Re-commit the BOM and line items if rollback occurred
                try:
                    db.commit()
                except Exception:
                    pass

        except SQLAlchemyError as e:
            logger.error(f"[boms_unified] Failed to create Supabase BOM: {e}", exc_info=True)
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create BOM in database: {str(e)}"
            )

        # Optionally start enrichment workflow
        workflow_id: Optional[str] = None
        enrichment_started = False

        if start_enrichment:
            try:
                logger.info(f"[boms_unified] Starting enrichment for BOM {bom_id} (priority={priority})")

                client = await get_temporal_client()

                # Use priority-based configuration
                if priority == "high":
                    task_queue = settings.temporal_task_queue or "cns-enrichment"
                    # High priority: smaller batches, faster processing
                    batch_size = 5
                    delay_per_component_ms = 100
                    delay_per_batch_ms = 1000
                else:
                    task_queue = settings.temporal_task_queue or "cns-enrichment"
                    # Normal priority: larger batches, standard delays
                    batch_size = 10
                    delay_per_component_ms = 500
                    delay_per_batch_ms = 2000

                # Start workflow (fire-and-forget, don't block response)
                # Pass user_id for notification routing after enrichment completes
                effective_user_id = uploaded_by or auth.user_id
                handle = await client.start_workflow(
                    "BOMEnrichmentWorkflow",
                    BOMEnrichmentRequest(
                        job_id=bom_id,
                        bom_id=bom_id, organization_id=organization_id,
                        total_items=len(line_items),
                        project_id=project_id,
                        source=source,
                        priority=priority,
                        user_id=effective_user_id,  # For completion notifications
                    ),
                    id=f"bom-enrichment-{bom_id}",
                    task_queue=task_queue,
                )

                workflow_id = handle.id
                enrichment_started = True

                logger.info(f"[boms_unified] ✅ Started enrichment workflow {workflow_id} for BOM {bom_id}")

            except Exception as e:
                logger.error(
                    f"[boms_unified] Failed to start enrichment workflow for BOM {bom_id}: {e}",
                    exc_info=True
                )
                # Don't fail the entire request if enrichment start fails
                # User can manually start enrichment later
                enrichment_started = False

        response = BOMUploadResponse(
            bom_id=bom_id, organization_id=organization_id,
            component_count=len(line_items),
            raw_file_s3_key=raw_file_s3_key,
            parsed_file_s3_key=parsed_file_s3_key,
            enrichment_started=enrichment_started,
            workflow_id=workflow_id,
            status="pending",
            priority=priority,
        )

        elapsed_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        logger.info(
            "[boms_unified] Completed unified upload: bom_id=%s tenant=%s project=%s "
            "rows=%s priority=%s duration_ms=%s",
            bom_id,
            organization_id,
            project_id,
            len(line_items),
            priority,
            elapsed_ms,
        )

        return response

    finally:
        try:
            next(db_gen, None)
        except StopIteration:
            pass
