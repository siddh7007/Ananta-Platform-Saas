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

import asyncio
import json
import logging
import uuid as uuid_lib
from uuid import UUID
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
from io import BytesIO

import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Request, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.config import settings
# NEW: Import scope validation decorators and dependencies
from app.core.scope_decorators import require_project
from app.dependencies.scope_deps import get_supabase_session
from app.auth.dependencies import get_current_user, User
from app.models.dual_database import get_dual_database
from app.services.bom_ingest import build_line_items_from_rows, create_supabase_bom_and_items
from app.services.project_service import get_default_project_for_org
from app.utils.directus_client import get_directus_file_service
from app.workflows.temporal_client import get_temporal_client
from app.workflows.bom_enrichment import BOMEnrichmentRequest
from app.workflows.bom_processing_workflow import BOMProcessingRequest

# App-layer authorization (see docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md)
from app.core.authorization import (
    AuthContext,
    get_auth_context,
    Role,
    require_role,
    build_tenant_where_clause,
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


def _parse_bool_form(value: Any, default: bool = True) -> bool:
    """Reliably parse boolean form parameters.

    FastAPI's Form() with bool type can behave unexpectedly:
    - When field is not provided, it uses default value
    - String "true"/"false" may not be correctly converted
    - Empty string or None should use default

    This helper handles all edge cases consistently.
    """
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lower_val = value.lower().strip()
        if lower_val in ('true', '1', 'yes', 'on'):
            return True
        if lower_val in ('false', '0', 'no', 'off'):
            return False
        # Empty or unrecognized string -> use default
        return default
    # Numeric or other types
    try:
        return bool(value)
    except (ValueError, TypeError):
        return default


async def _start_workflow_with_retry(
    bom_id: str,
    organization_id: str,
    filename: str,
    project_id: Optional[str],
    user_id: str,
    priority: str,
    max_retries: int = 3,
    base_delay_ms: int = 500,
) -> Tuple[bool, Optional[str], Optional[str]]:
    """Start workflow with retry logic and exponential backoff.

    Returns:
        Tuple of (success: bool, workflow_id: Optional[str], error: Optional[str])
    """
    task_queue = settings.temporal_task_queue or "cns-enrichment"
    last_error: Optional[str] = None

    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"[boms_unified] Starting workflow for BOM {bom_id} (attempt {attempt}/{max_retries})")
            client = await get_temporal_client()

            handle = await client.start_workflow(
                "BOMProcessingWorkflow",
                BOMProcessingRequest(
                    bom_id=bom_id,
                    organization_id=organization_id,
                    filename=filename,
                    project_id=project_id,
                    user_id=user_id,
                    skip_enrichment=False,
                    skip_risk_analysis=False,
                    enrichment_level="standard",
                    priority=5 if priority == "normal" else 9,
                ),
                id=f"bom-processing-{bom_id}",
                task_queue=task_queue,
            )

            workflow_id = handle.id
            logger.info(f"[boms_unified] Successfully started workflow {workflow_id} for BOM {bom_id}")
            return True, workflow_id, None

        except Exception as e:
            last_error = str(e)
            logger.warning(
                f"[boms_unified] Workflow start attempt {attempt}/{max_retries} failed for BOM {bom_id}: {e}"
            )

            if attempt < max_retries:
                # Exponential backoff: 500ms, 1000ms, 2000ms
                delay_seconds = (base_delay_ms * (2 ** (attempt - 1))) / 1000.0
                logger.info(f"[boms_unified] Retrying in {delay_seconds:.1f}s...")
                await asyncio.sleep(delay_seconds)

    # All retries exhausted
    logger.error(
        f"[boms_unified] All {max_retries} attempts failed for BOM {bom_id}. Last error: {last_error}"
    )
    return False, None, last_error


async def _mark_bom_for_retry(bom_id: str, error: str) -> bool:
    """Mark a BOM for retry processing via database flag.

    When workflow start fails even after retries, we mark the BOM in the database
    so a background job can pick it up later. This ensures no BOM is left stuck.

    Returns True if successfully marked, False otherwise.
    """
    try:
        db = get_dual_database()
        # Update BOM status to 'workflow_pending' so background job can process it
        result = db.supabase_session.execute(
            """
            UPDATE boms
            SET
                status = 'workflow_pending',
                metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'workflow_start_error', :error,
                    'workflow_retry_at', :retry_at
                )
            WHERE id = :bom_id::uuid
            """,
            {
                "bom_id": bom_id,
                "error": error,
                "retry_at": datetime.utcnow().isoformat(),
            }
        )
        db.supabase_session.commit()
        logger.info(f"[boms_unified] Marked BOM {bom_id} for background retry processing")
        return True
    except Exception as e:
        logger.error(f"[boms_unified] Failed to mark BOM {bom_id} for retry: {e}")
        return False


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


@router.post("/projects/{project_id}/boms/upload", response_model=BOMUploadResponse)
@require_project(enforce=True, log_access=True)  # NEW: Automatic scope validation
async def upload_bom_scoped(
    project_id: str,  # Required path parameter
    request: Request,  # Required for decorator
    file: UploadFile = File(..., description="BOM file (CSV)"),
    bom_name: Optional[str] = Form(None, description="BOM name (defaults to filename)"),
    priority: str = Form("normal", description="Enrichment priority: high or normal"),
    source: str = Form("customer", description="Upload source: customer or staff_bulk"),
    uploaded_by: Optional[str] = Form(None, description="User ID who uploaded"),
    column_mappings: Optional[str] = Form(None, description="JSON dict mapping source columns to canonical fields"),
    start_enrichment_raw: Optional[str] = Form(None, alias="start_enrichment", description="Start enrichment workflow after upload (default: true)"),
    db: Session = Depends(get_supabase_session),  # Required for decorator
    user: User = Depends(get_current_user),  # Required for decorator
) -> BOMUploadResponse:
    """Secure BOM upload endpoint with project-based scope validation.

    **NEW SECURE ENDPOINT** (CNS Projects Alignment)

    This endpoint:
    1. REQUIRES project_id in path (not optional)
    2. Validates entire FK chain: project → workspace → organization → tenant
    3. Automatically derives organization_id from validated scope (server-side)
    4. Prevents cross-tenant data leakage attacks

    Security Benefits vs Legacy:
    - Client cannot supply organization_id (prevents tampering)
    - Server validates FK chain using database constraints
    - JWT signature verification + DB FK checks = defense in depth

    Usage:
        POST /boms/projects/{project_id}/boms/upload
        Authorization: Bearer {JWT}

        FormData:
        - file: CSV file
        - bom_name: Optional display name
        - priority: high or normal
        - source: customer or staff_bulk
        - start_enrichment: true/false

    Returns:
        BOMUploadResponse with bom_id, component_count, etc.
    """
    # Parse start_enrichment reliably - default to True if not provided
    start_enrichment = _parse_bool_form(start_enrichment_raw, default=True)

    # Extract validated scope from request state (set by @require_project decorator)
    scope = request.state.validated_scope
    # scope = {"tenant_id": "...", "workspace_id": "...", "project_id": "..."}

    organization_id = scope["tenant_id"]  # Server-derived from validated FK chain
    # project_id already validated by decorator

    logger.info(
        f"[boms_unified] Scoped upload started by user={user.id} to project={project_id} "
        f"(org={organization_id}, workspace={scope.get('workspace_id')}, start_enrichment_raw={start_enrichment_raw}, start_enrichment={start_enrichment})"
    )

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

    # Generate IDs
    bom_id = str(uuid_lib.uuid4())
    upload_id = bom_id
    filename = file.filename or "uploaded_bom.csv"
    bom_name_final = bom_name or f"BOM Upload - {filename}"

    # Basic extension validation (CSV-only for now)
    if not filename.lower().endswith(".csv"):
        logger.warning("[boms_unified] Unsupported file type for scoped upload: %s", filename)
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

    # Enforce maximum file size
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

    # Compute content hash for idempotency
    file_hash = hashlib.sha256(file_content).hexdigest()

    # Store raw file to MinIO
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

    # Enforce maximum row count
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

    # Apply column mappings if provided
    if mappings_dict:
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

    # Convert to list of dicts
    rows = df.to_dict(orient="records")

    # Build line items
    line_items = build_line_items_from_rows(rows, organization_id=organization_id)

    if not line_items:
        raise HTTPException(
            status_code=400,
            detail="No valid line items found in file. Ensure file has MPN/part number column."
        )

    # Store parsed snapshot
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

    # Create BOM in database with idempotency check
    try:
        from sqlalchemy import text
        from sqlalchemy.exc import SQLAlchemyError

        logger.info(
            f"[boms_unified] Creating Supabase BOM {bom_id} for organization {organization_id} "
            f"(priority={priority}, source={source}, project={project_id})"
        )

        # Verify project exists and belongs to organization (provides better error messages)
        # NOTE: Must join through organizations table to check control_plane_tenant_id
        # because scope["tenant_id"] contains the control plane UUID, not app-plane org ID
        project_verify_query = text("""
            SELECT p.id, w.organization_id
            FROM projects p
            JOIN workspaces w ON p.workspace_id = w.id
            JOIN organizations o ON w.organization_id = o.id
            WHERE p.id = :project_id
              AND o.control_plane_tenant_id = :organization_id
        """)

        project_check = db.execute(project_verify_query, {
            "project_id": project_id,
            "organization_id": organization_id
        }).fetchone()

        if not project_check:
            logger.error(
                f"[boms_unified] Project validation failed: project_id={project_id} "
                f"not found or does not belong to organization={organization_id}"
            )
            raise HTTPException(
                status_code=404,
                detail=f"Project {project_id} not found or does not belong to your organization"
            )

        logger.info(f"[boms_unified] Project {project_id} validated for organization {organization_id}")

        # Idempotency check
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
                "[boms_unified] Idempotency hit: reusing BOM %s for organization %s (file_hash=%s, status=%s)",
                existing_bom_id,
                organization_id,
                file_hash,
                existing_status,
            )

            # If existing BOM is still pending/workflow_pending and start_enrichment is requested,
            # try to start workflow (it may have failed previously)
            existing_workflow_id = None
            existing_enrichment_started = False

            if start_enrichment and existing_status in ('pending', 'workflow_pending'):
                logger.info(
                    "[boms_unified] Idempotency: BOM %s is %s, attempting to start workflow",
                    existing_bom_id,
                    existing_status,
                )
                effective_user_id = uploaded_by or str(user.id)
                filename_for_workflow = bom_name or file.filename or f"BOM-{existing_bom_id[:8]}"

                success, existing_workflow_id, error = await _start_workflow_with_retry(
                    bom_id=str(existing_bom_id),
                    organization_id=organization_id,
                    filename=filename_for_workflow,
                    project_id=project_id,
                    user_id=effective_user_id,
                    priority=priority,
                )
                existing_enrichment_started = success

                if not success:
                    await _mark_bom_for_retry(str(existing_bom_id), error or "Unknown error")
                    logger.warning(
                        "[boms_unified] Idempotency: workflow start failed for BOM %s, marked for retry",
                        existing_bom_id,
                    )

            return BOMUploadResponse(
                bom_id=str(existing_bom_id), organization_id=organization_id,
                component_count=existing_count,
                raw_file_s3_key=existing_raw_key,
                parsed_file_s3_key=existing_parsed_key,
                enrichment_started=existing_enrichment_started,
                workflow_id=existing_workflow_id,
                status=existing_status,
                priority=priority,
            )

        # Check for duplicate BOM name in project to avoid unique constraint violation
        # Database has idx_boms_unique_per_project on (project_id, name, version)
        name_check_query = text("""
            SELECT COUNT(*) FROM boms
            WHERE project_id = :project_id
              AND name = :bom_name
              AND (version IS NULL OR version = '')
        """)
        name_conflict = db.execute(
            name_check_query,
            {"project_id": project_id, "bom_name": bom_name_final}
        ).scalar()

        if name_conflict and name_conflict > 0:
            # Generate unique name with timestamp
            timestamp_suffix = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            bom_name_final = f"{bom_name_final} ({timestamp_suffix})"
            logger.info(
                "[boms_unified] BOM name conflict in project %s, renamed to: %s",
                project_id,
                bom_name_final
            )

        # Insert BOM (project_id is now REQUIRED by database NOT NULL constraint)
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
                "project_id": project_id,  # REQUIRED - enforced by DB constraint
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

        # Insert line items
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
            f"[boms_unified] [OK] Created Supabase BOM {bom_id} with {len(line_items)} line items (scoped)"
        )

        # Create cns_bulk_uploads tracking record (optional - failure should not fail upload)
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
            logger.info(f"[boms_unified] [OK] Created cns_bulk_uploads tracking record: {bom_id}")

        except Exception as cns_err:
            # Don't rollback - BOM creation succeeded, tracking record is optional
            logger.warning(f"[boms_unified] Failed to create cns_bulk_uploads record: {cns_err}")
            # No rollback here - the main BOM transaction already committed successfully

    except SQLAlchemyError as e:
        logger.error(f"[boms_unified] Failed to create Supabase BOM: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create BOM in database: {str(e)}"
        )

    # Optionally start enrichment workflow with retry
    workflow_id: Optional[str] = None
    enrichment_started = False

    # Log the start_enrichment value for debugging
    logger.info(f"[boms_unified] BOM {bom_id} start_enrichment={start_enrichment} (type={type(start_enrichment).__name__})")

    if start_enrichment:
        effective_user_id = uploaded_by or str(user.id)
        filename_final = bom_name or file.filename or f"BOM-{bom_id[:8]}"

        # Use retry function with exponential backoff
        success, workflow_id, error = await _start_workflow_with_retry(
            bom_id=bom_id,
            organization_id=organization_id,
            filename=filename_final,
            project_id=project_id,
            user_id=effective_user_id,
            priority=priority,
        )

        if success:
            enrichment_started = True
        else:
            # All retries failed - mark BOM for background retry
            await _mark_bom_for_retry(bom_id, error or "Unknown error")
            enrichment_started = False
            logger.warning(
                f"[boms_unified] Workflow not started for BOM {bom_id}. "
                f"BOM marked for background retry processing."
            )
    else:
        logger.info(f"[boms_unified] Skipping enrichment for BOM {bom_id} (start_enrichment={start_enrichment})")

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
        "[boms_unified] Completed scoped upload: bom_id=%s tenant=%s project=%s "
        "rows=%s priority=%s duration_ms=%s",
        bom_id,
        organization_id,
        project_id,
        len(line_items),
        priority,
        elapsed_ms,
    )

    return response


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
    start_enrichment_raw: Optional[str] = Form(None, alias="start_enrichment", description="Start enrichment workflow after upload (default: true)"),
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
    # Parse start_enrichment reliably - default to True if not provided
    start_enrichment = _parse_bool_form(start_enrichment_raw, default=True)
    logger.info(f"[boms_unified] /upload start_enrichment_raw={start_enrichment_raw}, parsed start_enrichment={start_enrichment}")

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
            # Can be disabled via BOM_UPLOAD_IDEMPOTENCY_ENABLED=false for testing.
            existing = None
            if settings.bom_upload_idempotency_enabled:
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
            else:
                logger.info(
                    "[boms_unified] Idempotency check disabled via BOM_UPLOAD_IDEMPOTENCY_ENABLED=false"
                )

            if existing:
                existing_bom_id, existing_count, existing_raw_key, existing_parsed_key, existing_status = existing
                logger.info(
                    "[boms_unified] Idempotency hit: reusing BOM %s for organization %s (file_hash=%s, status=%s)",
                    existing_bom_id,
                    organization_id,
                    file_hash,
                    existing_status,
                )

                # If existing BOM is still pending/workflow_pending and start_enrichment is requested,
                # try to start workflow (it may have failed previously)
                existing_workflow_id = None
                existing_enrichment_started = False

                if start_enrichment and existing_status in ('pending', 'workflow_pending'):
                    logger.info(
                        "[boms_unified] Idempotency: BOM %s is %s, attempting to start workflow",
                        existing_bom_id,
                        existing_status,
                    )
                    effective_user_id = uploaded_by or auth.user_id
                    filename_for_workflow = bom_name or file.filename or f"BOM-{existing_bom_id[:8]}"

                    success, existing_workflow_id, error = await _start_workflow_with_retry(
                        bom_id=str(existing_bom_id),
                        organization_id=organization_id,
                        filename=filename_for_workflow,
                        project_id=project_id,
                        user_id=effective_user_id,
                        priority=priority,
                    )
                    existing_enrichment_started = success

                    if not success:
                        await _mark_bom_for_retry(str(existing_bom_id), error or "Unknown error")
                        logger.warning(
                            "[boms_unified] Idempotency: workflow start failed for BOM %s, marked for retry",
                            existing_bom_id,
                        )

                return BOMUploadResponse(
                    bom_id=str(existing_bom_id), organization_id=organization_id,
                    component_count=existing_count,
                    raw_file_s3_key=existing_raw_key,
                    parsed_file_s3_key=existing_parsed_key,
                    enrichment_started=existing_enrichment_started,
                    workflow_id=existing_workflow_id,
                    status=existing_status,
                    priority=priority,
                )

            # If no project_id provided, try to find default project for organization
            # Database trigger set_bom_organization_id requires project_id to be non-NULL
            if not project_id:
                project_id = get_default_project_for_org(db, organization_id)
                if project_id:
                    logger.info(f"[boms_unified] Using default project: {project_id}")
                else:
                    logger.warning(f"[boms_unified] No default project found for org {organization_id}")

            # Check for duplicate BOM name in project to avoid unique constraint violation
            # Database has idx_boms_unique_per_project on (project_id, name, version)
            if project_id:
                name_check_query = text("""
                    SELECT COUNT(*) FROM boms
                    WHERE project_id = :project_id
                      AND name = :bom_name
                      AND (version IS NULL OR version = '')
                """)
                name_conflict = db.execute(
                    name_check_query,
                    {"project_id": project_id, "bom_name": bom_name_final}
                ).scalar()

                if name_conflict and name_conflict > 0:
                    # Generate unique name with timestamp
                    timestamp_suffix = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                    bom_name_final = f"{bom_name_final} ({timestamp_suffix})"
                    logger.info(
                        "[boms_unified] BOM name conflict in project %s, renamed to: %s",
                        project_id,
                        bom_name_final
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
                f"[boms_unified] [OK] Supabase BOM {bom_id} created with {len(line_items)} line items"
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
                logger.info(f"[boms_unified] [OK] Created cns_bulk_uploads tracking record: {bom_id}")

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

        # Optionally start enrichment workflow with retry
        workflow_id: Optional[str] = None
        enrichment_started = False

        # Log the start_enrichment value for debugging
        logger.info(f"[boms_unified] BOM {bom_id} start_enrichment={start_enrichment} (type={type(start_enrichment).__name__})")

        if start_enrichment:
            effective_user_id = uploaded_by or auth.user_id
            filename_final = bom_name or file.filename or f"BOM-{bom_id[:8]}"

            # Use retry function with exponential backoff
            success, workflow_id, error = await _start_workflow_with_retry(
                bom_id=bom_id,
                organization_id=organization_id,
                filename=filename_final,
                project_id=project_id,
                user_id=effective_user_id,
                priority=priority,
            )

            if success:
                enrichment_started = True
            else:
                # All retries failed - mark BOM for background retry
                await _mark_bom_for_retry(bom_id, error or "Unknown error")
                enrichment_started = False
                logger.warning(
                    f"[boms_unified] Workflow not started for BOM {bom_id}. "
                    f"BOM marked for background retry processing."
                )

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


# =============================================================================
# Customer-facing BOM list endpoint
# =============================================================================

class BOMListItem(BaseModel):
    """Response model for BOM list items."""
    id: str
    name: Optional[str] = None
    filename: Optional[str] = None
    status: Optional[str] = None
    organization_id: Optional[str] = None
    project_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    component_count: Optional[int] = None
    enrichment_status: Optional[str] = None
    percent_complete: Optional[float] = None


class BOMListResponse(BaseModel):
    """Paginated response for BOM list."""
    data: List[BOMListItem]
    total: int
    page: int
    page_size: int


@router.get("", response_model=BOMListResponse)
@require_role(Role.ANALYST)  # Lowest role - any authenticated user can list their BOMs
async def list_boms(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    search: Optional[str] = Query(None, description="Search by BOM name or filename"),
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, alias="page_size", description="Items per page"),
    auth: AuthContext = Depends(get_auth_context),
) -> BOMListResponse:
    """
    List BOMs for the current user's organization.

    This endpoint returns BOMs that the authenticated user has access to,
    filtered by their organization (tenant). Supports pagination and filtering.

    Parameters:
        project_id: Optional project ID to filter BOMs
        search: Search term for BOM name or filename
        status: Filter by BOM status
        page: Page number (1-indexed)
        page_size: Number of items per page (max 100)

    Returns:
        Paginated list of BOMs with enrichment status
    """
    try:
        logger.info(
            "[boms_unified] list_boms: user=%s org=%s role=%s project=%s",
            auth.user_id, auth.organization_id, auth.role, project_id
        )

        db = next(get_dual_database().get_session("supabase"))

        # Build tenant filter - non-super_admins only see their org's BOMs
        tenant_conditions, tenant_params = build_tenant_where_clause(
            auth, table_alias="b", log_action="list_boms"
        )

        where = list(tenant_conditions)
        params: Dict[str, Any] = {**tenant_params}

        # Apply filters
        if project_id:
            where.append("b.project_id = :project_id")
            params["project_id"] = project_id

        if search:
            # Note: filename is in bu (bom_uploads LATERAL join), not in boms table
            where.append("(b.name ILIKE :pattern OR bu.filename ILIKE :pattern OR bu.original_filename ILIKE :pattern)")
            params["pattern"] = f"%{search}%"

        if status:
            where.append("b.status = :status")
            params["status"] = status

        # Only show customer uploads (not staff bulk uploads)
        where.append(
            "(bu.upload_source = 'customer' OR bu.upload_source IS NULL)"
        )

        where_sql = f"WHERE {' AND '.join(where)}" if where else ""

        # Count total for pagination
        count_sql = f"""
            SELECT COUNT(*)
            FROM boms b
            LEFT JOIN LATERAL (
                SELECT upload_source
                FROM bom_uploads
                WHERE bom_id = b.id
                ORDER BY created_at DESC
                LIMIT 1
            ) bu ON TRUE
            {where_sql}
        """

        count_result = db.execute(text(count_sql), params).scalar()
        total = int(count_result) if count_result else 0

        # Calculate offset
        offset = (page - 1) * page_size
        params["limit"] = page_size
        params["offset"] = offset

        # Main query with enrichment status
        sql = f"""
            WITH latest AS (
              SELECT DISTINCT ON (bom_id)
                     bom_id, state, created_at
              FROM enrichment_events
              ORDER BY bom_id, created_at DESC
            )
            SELECT
                b.id,
                b.name,
                COALESCE(bu.original_filename, bu.filename) AS filename,
                b.status,
                b.organization_id,
                b.project_id,
                b.created_at,
                b.updated_at,
                b.component_count,
                COALESCE(latest.state->>'status', b.enrichment_status, 'unknown') AS enrichment_status,
                COALESCE((latest.state->>'percent_complete')::numeric, 0) AS percent_complete
            FROM boms b
            LEFT JOIN latest ON latest.bom_id = b.id
            LEFT JOIN LATERAL (
                SELECT s3_key, s3_bucket, original_filename, filename, upload_source
                FROM bom_uploads
                WHERE bom_id = b.id
                ORDER BY created_at DESC
                LIMIT 1
            ) bu ON TRUE
            {where_sql}
            ORDER BY b.created_at DESC
            LIMIT :limit OFFSET :offset
        """

        rows = db.execute(text(sql), params).fetchall()

        data = [
            BOMListItem(
                id=str(r[0]),
                name=r[1],
                filename=r[2],
                status=r[3],
                organization_id=str(r[4]) if r[4] else None,
                project_id=str(r[5]) if r[5] else None,
                created_at=r[6].isoformat() if hasattr(r[6], "isoformat") and r[6] else None,
                updated_at=r[7].isoformat() if hasattr(r[7], "isoformat") and r[7] else None,
                component_count=int(r[8]) if r[8] is not None else None,
                enrichment_status=r[9],
                percent_complete=float(r[10]) if r[10] is not None else 0.0,
            )
            for r in rows
        ]

        logger.info(
            "[boms_unified] list_boms: returning %d BOMs (total=%d, page=%d)",
            len(data), total, page
        )

        return BOMListResponse(
            data=data,
            total=total,
            page=page,
            page_size=page_size,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[boms_unified] list_boms failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list BOMs")


# =============================================================================
# BOM Detail Response Model
# =============================================================================

class EnrichmentProgressModel(BaseModel):
    """Enrichment progress breakdown."""
    totalItems: int = 0
    enrichedItems: int = 0
    failedItems: int = 0
    pendingItems: int = 0
    percentComplete: float = 0.0


class BOMDetailResponse(BaseModel):
    """Full BOM detail response for frontend."""
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    fileName: Optional[str] = None
    fileUrl: Optional[str] = None
    status: Optional[str] = None
    lineCount: int = 0
    enrichedCount: int = 0
    organizationId: Optional[str] = None
    tenantId: Optional[str] = None
    projectId: Optional[str] = None
    workspaceId: Optional[str] = None
    createdBy: Optional[str] = None
    createdByName: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    lastEnrichedAt: Optional[str] = None
    enrichmentSource: Optional[str] = None
    temporalWorkflowId: Optional[str] = None
    enrichmentProgress: Optional[EnrichmentProgressModel] = None


@router.get("/{bom_id}", response_model=BOMDetailResponse)
@require_role(Role.ANALYST)
async def get_bom_detail(
    bom_id: str,
    auth: AuthContext = Depends(get_auth_context),
) -> BOMDetailResponse:
    """
    Get detailed BOM information by ID.

    Returns full BOM details including:
    - Basic info (name, description, status)
    - Line counts and enrichment progress
    - Workflow tracking (temporal_workflow_id)
    - Audit fields (createdAt, updatedAt, createdBy)

    Authorization:
    - Non-super_admins can only access BOMs in their organization
    - Super_admins can access any BOM
    """
    try:
        logger.info(
            "[boms_unified] get_bom_detail: user=%s org=%s role=%s bom_id=%s",
            auth.user_id, auth.organization_id, auth.role, bom_id
        )

        # Validate UUID format
        try:
            uuid_lib.UUID(bom_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid BOM ID format")

        db = next(get_dual_database().get_session("supabase"))

        # Build tenant filter
        tenant_conditions, tenant_params = build_tenant_where_clause(
            auth, table_alias="b", log_action="get_bom_detail"
        )

        where = list(tenant_conditions)
        where.append("b.id = :bom_id")
        params: Dict[str, Any] = {**tenant_params, "bom_id": bom_id}

        where_sql = f"WHERE {' AND '.join(where)}"

        # Query BOM with enrichment stats
        sql = f"""
            WITH line_stats AS (
                SELECT
                    bom_id,
                    COUNT(*) as total_items,
                    COUNT(*) FILTER (WHERE enrichment_status = 'enriched') as enriched_items,
                    COUNT(*) FILTER (WHERE enrichment_status = 'error' OR enrichment_status = 'no_match') as failed_items,
                    COUNT(*) FILTER (WHERE enrichment_status = 'pending' OR enrichment_status = 'matched') as pending_items
                FROM bom_line_items
                WHERE bom_id = :bom_id
                GROUP BY bom_id
            ),
            latest_workflow AS (
                SELECT
                    temporal_workflow_id
                FROM cns_bulk_uploads
                WHERE id = :bom_id
                LIMIT 1
            )
            SELECT
                b.id,
                b.name,
                COALESCE(b.description, b.metadata->>'description') as description,
                b.metadata->>'filename' as filename,
                b.raw_file_s3_key,
                b.status,
                COALESCE(b.component_count, ls.total_items, 0) as line_count,
                COALESCE(ls.enriched_items, 0) as enriched_count,
                b.organization_id,
                b.project_id,
                COALESCE(b.created_by_id::text, b.metadata->>'uploaded_by') as created_by,
                b.created_at,
                b.updated_at,
                b.analyzed_at as last_enriched_at,
                b.source as enrichment_source,
                COALESCE(b.temporal_workflow_id, lw.temporal_workflow_id) as temporal_workflow_id,
                ls.total_items,
                ls.enriched_items,
                ls.failed_items,
                ls.pending_items,
                -- Get workspace_id from project if exists
                (SELECT p.workspace_id FROM projects p WHERE p.id = b.project_id LIMIT 1) as workspace_id
            FROM boms b
            LEFT JOIN line_stats ls ON ls.bom_id = b.id
            LEFT JOIN latest_workflow lw ON TRUE
            {where_sql}
        """

        row = db.execute(text(sql), params).fetchone()

        if not row:
            logger.warning(
                "[boms_unified] BOM not found: bom_id=%s org=%s",
                bom_id, auth.organization_id
            )
            raise HTTPException(status_code=404, detail="BOM not found")

        # Unpack row
        (
            bom_id_db, name, description, filename, raw_file_s3_key, status,
            line_count, enriched_count, organization_id, project_id,
            created_by, created_at, updated_at, last_enriched_at,
            enrichment_source, temporal_workflow_id,
            total_items, enriched_items, failed_items, pending_items,
            workspace_id
        ) = row

        # Calculate enrichment progress
        total_items = total_items or line_count or 0
        enriched_items = enriched_items or 0
        failed_items = failed_items or 0
        pending_items = pending_items or 0
        percent_complete = (enriched_items / total_items * 100) if total_items > 0 else 0.0

        enrichment_progress = EnrichmentProgressModel(
            totalItems=total_items,
            enrichedItems=enriched_items,
            failedItems=failed_items,
            pendingItems=pending_items,
            percentComplete=round(percent_complete, 2),
        )

        response = BOMDetailResponse(
            id=str(bom_id_db),
            name=name,
            description=description,
            fileName=filename,
            fileUrl=raw_file_s3_key,  # Could be signed URL in production
            status=status,
            lineCount=line_count or 0,
            enrichedCount=enriched_count or 0,
            organizationId=str(organization_id) if organization_id else None,
            tenantId=str(organization_id) if organization_id else None,  # Same as org
            projectId=str(project_id) if project_id else None,
            workspaceId=str(workspace_id) if workspace_id else None,
            createdBy=created_by,
            createdByName=None,  # Could be looked up from users table
            createdAt=created_at.isoformat() if hasattr(created_at, "isoformat") and created_at else None,
            updatedAt=updated_at.isoformat() if hasattr(updated_at, "isoformat") and updated_at else None,
            lastEnrichedAt=last_enriched_at.isoformat() if hasattr(last_enriched_at, "isoformat") and last_enriched_at else None,
            enrichmentSource=enrichment_source,
            temporalWorkflowId=temporal_workflow_id,
            enrichmentProgress=enrichment_progress,
        )

        logger.info(
            "[boms_unified] get_bom_detail: returning BOM %s (status=%s, lines=%d, enriched=%d)",
            bom_id, status, line_count or 0, enriched_count or 0
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[boms_unified] get_bom_detail failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get BOM details")


class DeleteBOMResponse(BaseModel):
    """Response model for BOM deletion"""
    success: bool
    message: str
    bomId: str


@router.delete("/{bom_id}", response_model=DeleteBOMResponse)
@require_role(Role.ADMIN)
async def delete_bom(
    bom_id: str,
    auth: AuthContext = Depends(get_auth_context),
) -> DeleteBOMResponse:
    """
    Delete a BOM and all associated line items.

    This is a destructive operation that permanently removes:
    - The BOM record
    - All associated line items
    - Related enrichment data

    Authorization:
    - Requires ADMIN role or higher
    - Non-super_admins can only delete BOMs in their organization
    - Super_admins can delete any BOM
    """
    try:
        logger.info(
            "[boms_unified] delete_bom: user=%s org=%s role=%s bom_id=%s",
            auth.user_id, auth.organization_id, auth.role, bom_id
        )

        # Validate UUID format
        try:
            uuid_lib.UUID(bom_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid BOM ID format")

        db = next(get_dual_database().get_session("supabase"))

        # Build tenant filter
        tenant_conditions, tenant_params = build_tenant_where_clause(
            auth, table_alias="b", log_action="delete_bom"
        )

        where = list(tenant_conditions)
        where.append("b.id = :bom_id")
        params: Dict[str, Any] = {**tenant_params, "bom_id": bom_id}

        where_sql = f"WHERE {' AND '.join(where)}"

        # First verify the BOM exists and user has access
        check_sql = f"""
            SELECT b.id, b.name, b.organization_id
            FROM boms b
            {where_sql}
        """
        row = db.execute(text(check_sql), params).fetchone()

        if not row:
            logger.warning(
                "[boms_unified] BOM not found for deletion: bom_id=%s org=%s",
                bom_id, auth.organization_id
            )
            raise HTTPException(status_code=404, detail="BOM not found")

        bom_name = row[1]

        # Delete line items first (foreign key constraint)
        delete_lines_sql = "DELETE FROM bom_line_items WHERE bom_id = :bom_id"
        result_lines = db.execute(text(delete_lines_sql), {"bom_id": bom_id})
        lines_deleted = result_lines.rowcount

        # Delete from cns_bulk_uploads if exists (tracks Temporal workflows)
        delete_uploads_sql = "DELETE FROM cns_bulk_uploads WHERE id = :bom_id"
        db.execute(text(delete_uploads_sql), {"bom_id": bom_id})

        # Delete the BOM record
        delete_bom_sql = f"""
            DELETE FROM boms b
            {where_sql}
            RETURNING b.id
        """
        result = db.execute(text(delete_bom_sql), params)
        deleted_row = result.fetchone()

        if not deleted_row:
            # Should not happen if check passed, but handle gracefully
            db.rollback()
            raise HTTPException(status_code=500, detail="Failed to delete BOM")

        db.commit()

        logger.info(
            "[boms_unified] delete_bom: deleted BOM %s (%s), %d line items removed",
            bom_id, bom_name, lines_deleted
        )

        return DeleteBOMResponse(
            success=True,
            message=f"BOM '{bom_name}' and {lines_deleted} line items deleted successfully",
            bomId=bom_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[boms_unified] delete_bom failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete BOM")
