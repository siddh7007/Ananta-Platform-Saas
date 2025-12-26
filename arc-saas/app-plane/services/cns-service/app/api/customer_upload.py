"""
Customer Portal File Upload API - MinIO Storage Only

Simple endpoint for Customer Portal to upload raw BOM files to MinIO.
Returns s3_key and presigned_url for Supabase metadata storage.

Flow:
1. Customer Portal uploads file here
2. We store in MinIO (bucket: customer-uploads)
3. Return s3_key and presigned_url
4. Customer Portal saves metadata to Supabase with these fields

Authorization:
    Uses app-layer RLS via app.core.authorization module.
    See docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md for details.
"""

import uuid
import logging
from typing import Optional, Tuple, List, Literal
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Body
from pydantic import BaseModel

from sqlalchemy import text

from app.utils.minio_client import upload_to_minio, get_minio_client
from app.models.dual_database import get_dual_database
from app.utils.activity_log import record_audit_log_entry

# App-layer authorization (see docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md)
from app.core.authorization import (
    assert_membership,
    AuthContextError,
    AuthErrorCode,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/customer", tags=["Customer Portal Upload"])


class CustomerUploadResponse(BaseModel):
    """Response for customer file upload"""
    upload_id: str
    s3_bucket: str
    s3_key: str
    s3_url: str
    storage_backend: str
    message: str


class CustomerUploadListItem(BaseModel):
    """Single upload item in list response"""
    id: str
    filename: str
    file_size: Optional[int] = None
    tenant_id: Optional[str] = None
    project_id: Optional[str] = None
    upload_source: Optional[str] = None
    status: Optional[str] = None
    total_rows: Optional[int] = None
    created_at: Optional[str] = None


class CustomerUploadListResponse(BaseModel):
    """Response for listing customer uploads"""
    uploads: List[CustomerUploadListItem]
    total: int


class UploadActionRequest(BaseModel):
    """Actor/Reason payload for archive/delete operations."""
    reason: Optional[str] = None
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    actor_email: Optional[str] = None


class UploadActionResponse(BaseModel):
    """Generic response for archive/delete actions."""
    upload_id: str
    action: Literal["archived", "deleted"]
    message: str
    removed_objects: Optional[List[str]] = None
    warnings: Optional[List[str]] = None


@router.post("/upload", response_model=CustomerUploadResponse)
async def upload_customer_file(
    file: UploadFile = File(..., description="BOM file (CSV, XLSX, XLS)"),
    organization_id: str = Form(..., description="Organization UUID"),
):
    """
    Upload customer BOM file to MinIO storage

    This endpoint ONLY stores the file. Customer Portal handles:
    - Client-side parsing
    - Supabase metadata storage
    - RabbitMQ event publishing

    We just provide raw file storage for retrieval.
    """
    upload_id = str(uuid.uuid4())

    try:
        logger.info(
            f"[Customer Upload] Starting upload: {file.filename}",
            extra={
                'upload_id': upload_id,
                'organization_id': organization_id,
                'file_size': file.size
            }
        )

        # Validate file type
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

        logger.info(f"[Customer Upload] File read: {file_size} bytes")

        # Check MinIO is enabled
        minio_client = get_minio_client()
        if not minio_client.is_enabled():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="MinIO storage is not enabled."
            )

        # Upload to MinIO (customer uploads bucket)
        customer_bucket = 'customer-uploads'
        s3_key, s3_url, error = upload_to_minio(
            file_content=file_content,
            organization_id=organization_id,
            upload_id=upload_id,
            filename=file.filename,
            content_type=file.content_type or 'application/octet-stream',
            bucket=customer_bucket
        )

        if error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload to MinIO: {error}"
            )

        logger.info(
            f"[Customer Upload] File uploaded to MinIO: {s3_key}",
            extra={'s3_url': s3_url}
        )

        return CustomerUploadResponse(
            upload_id=upload_id,
            s3_bucket=customer_bucket,
            s3_key=s3_key,
            s3_url=s3_url,
            storage_backend='minio',
            message="File uploaded successfully to MinIO"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"[Customer Upload] Upload failed: {e}",
            exc_info=True,
            extra={'upload_id': upload_id, 'bom_file': file.filename}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )


@router.get("/uploads", response_model=CustomerUploadListResponse)
async def list_customer_uploads(
    tenant_id: Optional[str] = None,
    project_id: Optional[str] = None,
    filename: Optional[str] = None,
    limit: int = 200,
):
    """
    List customer portal BOM uploads.

    CNS Dashboard uses this endpoint to view customer uploads without
    requiring direct Supabase access (which would need a different JWT).

    Filters:
        - tenant_id: Filter by organization/tenant
        - project_id: Filter by project
        - filename: Filter by filename (partial match)
        - limit: Maximum results (default 200)
    """
    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        # Build query with optional filters
        query_parts = ["""
            SELECT id, filename, file_size, tenant_id, project_id,
                   upload_source, status, total_rows, created_at
            FROM bom_uploads
            WHERE upload_source = 'customer_portal'
              AND (archived IS NULL OR archived = false)
        """]
        params = {}

        if tenant_id:
            query_parts.append("AND tenant_id = :tenant_id")
            params["tenant_id"] = tenant_id

        if project_id:
            query_parts.append("AND project_id = :project_id")
            params["project_id"] = project_id

        if filename:
            query_parts.append("AND filename ILIKE :filename")
            params["filename"] = f"%{filename}%"

        query_parts.append("ORDER BY created_at DESC")
        query_parts.append(f"LIMIT {min(limit, 500)}")  # Cap at 500

        full_query = " ".join(query_parts)

        result = db.execute(text(full_query), params).mappings().fetchall()

        uploads = [
            CustomerUploadListItem(
                id=str(row["id"]),
                filename=row["filename"],
                file_size=row.get("file_size"),
                tenant_id=str(row["tenant_id"]) if row.get("tenant_id") else None,
                project_id=str(row["project_id"]) if row.get("project_id") else None,
                upload_source=row.get("upload_source"),
                status=row.get("status"),
                total_rows=row.get("total_rows"),
                created_at=row["created_at"].isoformat() if row.get("created_at") else None,
            )
            for row in result
        ]

        logger.info(f"[Customer Uploads] Listed {len(uploads)} uploads")

        return CustomerUploadListResponse(
            uploads=uploads,
            total=len(uploads)
        )

    except Exception as e:
        logger.error(f"[Customer Uploads] Failed to list uploads: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list uploads: {str(e)}"
        )


class DownloadUrlResponse(BaseModel):
    """Response for download URL request"""
    download_url: str
    filename: str
    expires_in_seconds: int


@router.get("/download/{upload_id}", response_model=DownloadUrlResponse)
async def get_download_url(
    upload_id: str,
):
    """
    Get a presigned URL to download the original BOM file from S3/MinIO.

    Returns a temporary URL (valid for 1 hour) that can be used to download
    the original uploaded file.
    """
    from datetime import timedelta

    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        # Fetch upload record to get s3_key and bucket
        fetch_query = text("""
            SELECT id, filename, s3_bucket, s3_key, organization_id
            FROM bom_uploads
            WHERE id = :upload_id
        """)
        upload_row = db.execute(fetch_query, {"upload_id": upload_id}).mappings().first()

        if not upload_row:
            raise HTTPException(status_code=404, detail="BOM upload not found")

        s3_bucket = upload_row.get("s3_bucket") or "customer-uploads"
        s3_key = upload_row.get("s3_key")
        filename = upload_row.get("filename") or "download"

        if not s3_key:
            raise HTTPException(
                status_code=404,
                detail="No file associated with this upload"
            )

        # Get MinIO client and generate presigned URL
        minio_client = get_minio_client()
        if not minio_client.is_enabled():
            raise HTTPException(
                status_code=503,
                detail="File storage is not available"
            )

        expires = timedelta(hours=1)
        download_url = minio_client.get_presigned_url(s3_bucket, s3_key, expires=expires)

        if not download_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate download URL"
            )

        logger.info(f"[Customer Download] Generated URL for upload {upload_id}")

        return DownloadUrlResponse(
            download_url=download_url,
            filename=filename,
            expires_in_seconds=3600  # 1 hour
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Customer Download] Failed to get download URL: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get download URL: {str(e)}"
        )


@router.get("/health")
async def customer_upload_health():
    """Health check for customer upload service"""
    minio_client = get_minio_client()

    return {
        "status": "healthy",
        "minio_enabled": minio_client.is_enabled(),
        "storage_backend": "minio" if minio_client.is_enabled() else "disabled",
        "bucket": "customer-uploads"
    }


def _cleanup_storage_objects(bucket: Optional[str], keys: List[Optional[str]]) -> Tuple[List[str], List[str]]:
    """Delete a list of objects from storage, returning (removed, warnings)."""
    removed: List[str] = []
    warnings: List[str] = []
    minio_client = get_minio_client()

    if not minio_client.is_enabled():
        if any(keys):
            warnings.append("MinIO disabled; file cleanup skipped")
        return removed, warnings

    target_bucket = bucket or "bulk-uploads"

    for key in keys:
        if not key:
            continue
        success = minio_client.delete_file(target_bucket, key)
        if success:
            removed.append(f"{target_bucket}/{key}")
        else:
            warnings.append(f"Failed to delete {target_bucket}/{key}")

    return removed, warnings


def _assert_actor_authorized(
    db_session,
    organization_id: str,
    actor_id: Optional[str],
    require_admin: bool = False
) -> None:
    """
    Ensure the acting user belongs to the same organization as the upload.

    DEPRECATED: This is a thin wrapper around the centralized authorization module.
    New code should use `assert_membership` directly from app.core.authorization.

    Args:
        db_session: Database session
        organization_id: The organization that owns the resource
        actor_id: The user attempting the action
        require_admin: If True, also verify user has admin/super_admin role

    Raises:
        HTTPException: If authorization fails

    See Also:
        app.core.authorization.assert_membership - The centralized implementation
        docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md - Architecture decision
    """
    try:
        # Delegate to centralized authorization module
        assert_membership(
            db=db_session,
            user_id=actor_id or "",
            organization_id=organization_id,
            require_admin=require_admin
        )
    except AuthContextError as e:
        # Convert to HTTPException for backward compatibility with existing callers
        raise HTTPException(
            status_code=e.status_code,
            detail=e.detail.get("detail") if isinstance(e.detail, dict) else str(e.detail)
        )


@router.post("/upload/{upload_id}/archive", response_model=UploadActionResponse)
async def archive_customer_upload(
    upload_id: str,
    request: UploadActionRequest = Body(default=None)
):
    """
    Archive a BOM upload without deleting underlying data.

    Marks the upload as archived/hidden while retaining the raw file and BOM.
    """
    payload = request or UploadActionRequest()
    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    try:
        fetch_query = text("""
            SELECT id, organization_id, archived
            FROM bom_uploads
            WHERE id = :upload_id
        """)
        upload_row = db.execute(fetch_query, {"upload_id": upload_id}).mappings().first()

        if not upload_row:
            raise HTTPException(status_code=404, detail="BOM upload not found")

        # Authorization check: actor must belong to the same organization
        _assert_actor_authorized(db, upload_row["organization_id"], payload.actor_id)

        db.execute(
            text("""
                UPDATE bom_uploads
                SET archived = true,
                    archived_at = NOW(),
                    updated_at = NOW()
                WHERE id = :upload_id
            """),
            {"upload_id": upload_id}
        )

        # Record audit log entry
        record_audit_log_entry(
            db,
            event_type="customer.bom_upload.archived",
            routing_key="customer.bom_upload.archived",
            organization_id=upload_row["organization_id"],
            user_id=payload.actor_id,
            username=payload.actor_name,
            email=payload.actor_email,
            event_data={
                "upload_id": upload_id,
                "reason": payload.reason,
            },
        )

        db.commit()

        return UploadActionResponse(
            upload_id=upload_id,
            action="archived",
            message="Upload archived successfully"
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.error(f"[Customer Upload] Failed to archive upload {upload_id}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to archive upload: {str(exc)}"
        )


@router.delete("/upload/{upload_id}", response_model=UploadActionResponse)
async def delete_customer_upload(
    upload_id: str,
    request: UploadActionRequest = Body(default=None)
):
    """
    Permanently delete a BOM upload, any linked BOM, and associated files.

    This action removes:
      - bom_uploads row
      - linked BOM + bom_line_items (if present)
      - MinIO/S3 objects (raw file, enriched files, archives)
    """
    payload = request or UploadActionRequest()
    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    removed_objects: List[str] = []
    warnings: List[str] = []

    try:
        select_query = text("""
            SELECT
                id,
                organization_id,
                bom_id,
                enrichment_job_id,
                s3_bucket,
                s3_key,
                results_s3_key,
                failed_items_s3_key,
                archive_s3_key
            FROM bom_uploads
            WHERE id = :upload_id
        """)

        upload = db.execute(select_query, {"upload_id": upload_id}).mappings().first()
        if not upload:
            raise HTTPException(status_code=404, detail="BOM upload not found")

        # Require admin role for destructive delete operation
        _assert_actor_authorized(
            db,
            upload["organization_id"],
            payload.actor_id,
            require_admin=True
        )

        # Require reason for permanent deletion (audit compliance)
        if not payload.reason or not payload.reason.strip():
            raise HTTPException(
                status_code=400,
                detail="Reason is required for permanent deletion"
            )

        linked_bom_id = upload.get("bom_id") or upload.get("enrichment_job_id")

        if linked_bom_id:
            db.execute(
                text("DELETE FROM bom_line_items WHERE bom_id = :bom_id"),
                {"bom_id": linked_bom_id}
            )
            db.execute(
                text("DELETE FROM boms WHERE id = :bom_id"),
                {"bom_id": linked_bom_id}
            )

        db.execute(
            text("DELETE FROM bom_uploads WHERE id = :upload_id"),
            {"upload_id": upload_id}
        )

        # Audit logging is MANDATORY for destructive operations
        # If audit fails, abort the deletion to maintain compliance
        audit_success = record_audit_log_entry(
            db,
            event_type="customer.bom_upload.deleted",
            routing_key="customer.bom_upload.deleted",
            organization_id=upload["organization_id"],
            user_id=payload.actor_id,
            username=payload.actor_name,
            email=payload.actor_email,
            event_data={
                "upload_id": upload_id,
                "bom_id": linked_bom_id,
                "reason": payload.reason,
            },
        )

        if not audit_success:
            db.rollback()
            logger.error(f"[Customer Upload] Audit log failed for delete of {upload_id} - aborting")
            raise HTTPException(
                status_code=500,
                detail="Failed to record audit trail - deletion aborted for compliance"
            )

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.error(f"[Customer Upload] Failed to delete upload {upload_id}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete upload: {str(exc)}"
        )

    # Clean up storage after DB commit
    bucket = upload.get("s3_bucket")
    keys = [
        upload.get("s3_key"),
        upload.get("results_s3_key"),
        upload.get("failed_items_s3_key"),
        upload.get("archive_s3_key"),
    ]
    cleanup_removed, cleanup_warnings = _cleanup_storage_objects(bucket, keys)
    removed_objects.extend(cleanup_removed)
    warnings.extend(cleanup_warnings)

    return UploadActionResponse(
        upload_id=upload_id,
        action="deleted",
        message="Upload deleted permanently",
        removed_objects=removed_objects or None,
        warnings=warnings or None,
    )
