"""BOM Snapshots API

Accepts mapping-confirmed uploads from CBP/CNS, parses the raw file
stored in MinIO using the provided column mappings, writes a normalized
parsed snapshot back to S3, and emits a `bom.parsed` event.

This is additive and does not replace existing /customer or /bulk
upload flows.
"""

from __future__ import annotations

import io
import json
import logging
import uuid
from typing import Dict, Any, Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, validator

from app.config import settings
from app.utils.minio_client import get_minio_client
from app.services.bom_ingest import build_line_items_from_rows, create_supabase_bom_and_items
from app.core.temporal_client import get_temporal_client_manager, ensure_temporal_connected
from app.workflows.bom_enrichment import (
    BOMIngestAndEnrichRequest,
    BOMIngestAndEnrichWorkflow,
)

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/bom-snapshots", tags=["BOM Snapshots"])


# Simple in-memory idempotency cache for this process: maps
# (organization_id, file_id) → (bom_id, parsed_s3_key). This prevents
# creating duplicate snapshots when the same request is retried during
# the lifetime of the CNS process. It is a best-effort optimization and
# does not replace long-term idempotency guarantees.
_SNAPSHOT_CACHE: Dict[tuple, tuple] = {}


class BOMSnapshotRequest(BaseModel):
    """Request body for creating a parsed BOM snapshot.

    `column_mappings` maps canonical fields to source column names, e.g.

        {
          "manufacturer_part_number": "MPN",
          "manufacturer": "Manufacturer",
          "quantity": "Quantity",
          "reference_designator": "Reference Designators",
          "description": "Description"
        }
    """

    file_id: str = Field(..., description="Raw file S3 key or upload identifier")
    organization_id: str = Field(..., description="Tenant UUID")
    project_id: Optional[str] = Field(None, description="Project UUID (optional)")
    bom_name: Optional[str] = Field(None, description="Human-friendly BOM name")
    uploaded_by: Optional[str] = Field(None, description="User identifier (email/username)")
    source: str = Field(
        "customer",
        description="Upload source: 'customer' or 'staff_bulk'",
    )
    column_mappings: Dict[str, str] = Field(
        ..., description="Canonical field → source column name"
    )

    @validator("source")
    def validate_source(cls, v: str) -> str:
        if v not in {"customer", "staff_bulk"}:
            raise ValueError("source must be 'customer' or 'staff_bulk'")
        return v


class BOMSnapshotResponse(BaseModel):
    success: bool
    bom_id: str
    organization_id: str
    project_id: Optional[str]
    parsed_s3_key: str
    total_rows: int
    line_items_saved: int
    workflow_id: Optional[str] = None
    message: str


def _apply_column_mappings(
    df: pd.DataFrame,
    mappings: Dict[str, str],
) -> pd.DataFrame:
    """Apply column mappings to a DataFrame.

    This renames columns so downstream helpers can use consistent field
    names (e.g., 'manufacturer_part_number').
    """

    rename_map: Dict[str, str] = {}
    lower_cols = {c.lower(): c for c in df.columns}

    for target, source_col in mappings.items():
        if not source_col:
            continue
        # Match case-insensitively against DataFrame columns
        key = source_col.lower()
        if key in lower_cols:
            rename_map[lower_cols[key]] = target

    if rename_map:
        df = df.rename(columns=rename_map)

    return df


@router.post("", response_model=BOMSnapshotResponse)
async def create_bom_snapshot(payload: BOMSnapshotRequest) -> BOMSnapshotResponse:
    """Create a parsed BOM snapshot from a raw file in MinIO.

    This endpoint is called after the user has confirmed column mappings
    in CBP/CNS UI. It:

    1. Downloads the raw file from MinIO using `file_id`.
    2. Parses it with pandas and applies `column_mappings`.
    3. Normalizes rows into line item dicts.
    4. Stores the parsed snapshot back to S3 (JSON) under
       `parsed/{organization_id}/{bom_id}.json`.
    5. Emits a `bom.parsed` event (to be wired into Temporal later).

    This does *not* create Supabase BOMs yet; that is handled by a
    separate ingestion workflow.
    """

    minio = get_minio_client()
    if not minio.is_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MinIO storage is not enabled. Cannot create BOM snapshot.",
        )

    # Derive bucket/object from file_id. For now we assume the caller
    # passes the exact object key used during upload and we know the
    # bucket from configuration.
    raw_bucket = settings.minio_bucket_uploads

    # Sanitize file_id to avoid path traversal issues; only the
    # basename is used as the object key.
    import os.path as _path
    safe_file_id = _path.basename(payload.file_id)
    raw_key = safe_file_id

    logger.info(
        "[BOM Snapshots] Creating parsed snapshot for file %s (tenant=%s, source=%s)",
        raw_key,
        payload.organization_id,
        payload.source,
    )

    # Idempotency: if we've already created a snapshot for this
    # (organization_id, file_id) during this process lifetime, and the object
    # still exists in MinIO, return the previous result instead of
    # recreating it.
    cache_key = (payload.organization_id, payload.file_id)
    cached = _SNAPSHOT_CACHE.get(cache_key)
    if cached is not None:
        cached_bom_id, cached_parsed_key = cached
        existing = minio.download_file(settings.minio_bucket_uploads, cached_parsed_key)
        if existing is not None:
            logger.info(
                "[BOM Snapshots] Reusing existing snapshot for tenant=%s file_id=%s -> bom_id=%s",
                payload.organization_id,
                payload.file_id,
                cached_bom_id,
            )
            # We don't know the original workflow_id here; callers can
            # query ingest status if needed.
            return BOMSnapshotResponse(
                success=True,
                bom_id=cached_bom_id, organization_id=payload.organization_id,
                project_id=payload.project_id,
                parsed_s3_key=cached_parsed_key,
                total_rows=0,  # unknown in this fast path
                line_items_saved=0,
                workflow_id=None,
                message="Snapshot already exists for this file; reusing existing BOM.",
            )

    # 1) Download raw file from MinIO
    raw_bytes = minio.download_file(raw_bucket, raw_key)
    if raw_bytes is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Raw file not found in storage: {raw_bucket}/{raw_key}",
        )

    # 2) Parse with pandas
    try:
        # Simple extension-based parsing
        if raw_key.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(raw_bytes))
        elif raw_key.lower().endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(raw_bytes))
        else:
            raise ValueError("Unsupported file extension for snapshot parsing")

    except Exception as exc:
        logger.error("[BOM Snapshots] Failed to parse file %s: %s", raw_key, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse file for snapshot: {exc}",
        )

    total_rows = len(df)
    logger.info("[BOM Snapshots] Parsed %s rows from file %s", total_rows, raw_key)

    if total_rows == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No rows found in file. Cannot create BOM snapshot.",
        )

    # 3) Validate required mappings and apply column mappings from UI
    # Ensure at least the part-number field is mapped so we don't end
    # up with an empty BOM snapshot.
    required_fields = ["manufacturer_part_number"]
    missing = [f for f in required_fields if f not in payload.column_mappings]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required mappings: {missing}",
        )

    df_mapped = _apply_column_mappings(df, payload.column_mappings)

    # 4) Build normalized line items (list[dict])
    rows = df_mapped.to_dict(orient="records")
    line_items = build_line_items_from_rows(rows, organization_id=payload.organization_id)

    if not line_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid line items after applying mappings. At least one row must have a part number.",
        )

    line_items_saved = len(line_items)

    # 5) Create actual BOM in database (not just snapshot file)
    # Generate real BOM ID for database
    actual_bom_id = str(uuid.uuid4())

    # Create BOM and line items in Supabase using centralized helper
    from app.models.dual_database import get_dual_database

    dual_db = get_dual_database()
    db = next(dual_db.get_session("supabase"))

    bom_name = payload.bom_name or f"BOM - {raw_key}"

    line_items_saved, create_error = create_supabase_bom_and_items(
        db,
        bom_id=actual_bom_id, organization_id=payload.organization_id,
        project_id=payload.project_id,
        bom_name=bom_name,
        upload_id=payload.file_id,  # Use file_id as upload_id
        filename=raw_key,
        s3_bucket=settings.minio_bucket_uploads,
        s3_key=raw_key,
        line_items=line_items,
        source=payload.source,
        uploaded_by=payload.uploaded_by,
    )

    if create_error is not None:
        logger.error("[BOM Snapshots] Failed to create BOM: %s", create_error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create BOM: {create_error}",
        )

    # 6) Store parsed snapshot to S3 for audit/reference
    parsed_bucket = settings.minio_bucket_uploads
    parsed_key = f"parsed/{payload.organization_id}/{actual_bom_id}.json"

    snapshot = {
        "bom_id": actual_bom_id,  # Real BOM database ID
        "tenant_id": payload.organization_id,
        "project_id": payload.project_id,
        "bom_name": bom_name,
        "uploaded_by": payload.uploaded_by,
        "source": payload.source,
        "file_id": payload.file_id,
        "total_rows": total_rows,
        "line_items": line_items,
    }

    snapshot_bytes = json.dumps(snapshot).encode("utf-8")
    ok, error = minio.upload_file(
        parsed_bucket,
        parsed_key,
        snapshot_bytes,
        content_type="application/json",
    )

    if not ok:
        logger.warning("[BOM Snapshots] Failed to upload snapshot file (non-critical): %s", error)
        # Don't fail the request - BOM is already created in database

    # 7) Update bom_uploads.bom_id to link upload to BOM (if upload exists)
    try:
        from sqlalchemy import text as sql_text
        update_query = sql_text("""
            UPDATE bom_uploads
            SET bom_id = :bom_id,
                status = 'completed',
                updated_at = NOW()
            WHERE id = :upload_id
        """)
        db.execute(update_query, {"bom_id": actual_bom_id, "upload_id": payload.file_id})
        db.commit()
        logger.info("[BOM Snapshots] ✅ Linked bom_upload %s to BOM %s", payload.file_id, actual_bom_id)
    except Exception as link_error:
        logger.warning(
            "[BOM Snapshots] Failed to link bom_upload (non-critical): %s",
            link_error
        )
        # Don't fail - BOM is already created

    # 8) Emit bom.created event (best-effort) for event sourcing
    try:
        try:
            import sys
            import os

            shared_path = os.path.join(
                os.path.dirname(__file__), "..", "..", "..", "shared"
            )
            if os.path.exists(shared_path):
                sys.path.insert(0, shared_path)
            from event_bus import EventPublisher  # type: ignore

            EventPublisher.bom_parsed(
                bom_id=actual_bom_id, organization_id=payload.organization_id,
                project_id=payload.project_id,
                source=payload.source,
                bom_name=bom_name,
                parsed_s3_key=parsed_key,
                uploaded_by=payload.uploaded_by or "unknown",
            )
            logger.info("[BOM Snapshots] Published bom.parsed event for %s", actual_bom_id)
        except ImportError:
            logger.warning(
                "[BOM Snapshots] event_bus not available; skipping bom.parsed event publish"
            )
    except Exception as exc:
        logger.warning(
            "[BOM Snapshots] Failed to publish bom.parsed event for %s: %s",
            actual_bom_id,
            exc,
            exc_info=True,
        )

    # BOM is now created synchronously - frontend can start enrichment immediately
    workflow_id = None  # No workflow needed - BOM already created

    return BOMSnapshotResponse(
        success=True,
        bom_id=actual_bom_id,  # ✅ Return REAL database BOM ID, not snapshot UUID
        tenant_id=payload.organization_id,
        project_id=payload.project_id,
        parsed_s3_key=parsed_key,
        total_rows=total_rows,
        line_items_saved=line_items_saved,
        workflow_id=workflow_id,
        message=f"BOM created successfully with {line_items_saved} line items. Ready for enrichment.",
    )
