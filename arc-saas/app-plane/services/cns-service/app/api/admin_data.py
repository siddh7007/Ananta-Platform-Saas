"""
Admin Data Endpoints

Provide aggregated/admin-safe datasets for dashboard tables:
- Latest enrichment status per BOM
- BOM line items list with filters

Authorization:
    Uses app-layer RLS via app.core.authorization module.
    All admin endpoints require at least ADMIN role.
    See docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md for details.
"""

import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy import text

from app.models.dual_database import get_dual_database
from app.config import settings
from app.services.component_catalog import ComponentCatalogService
import csv
import os
from pathlib import Path
from fastapi import Response
from fastapi.responses import FileResponse

# App-layer authorization (see docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md)
from app.core.authorization import (
    AuthContext,
    get_auth_context,
    get_optional_auth_context,
    Role,
    require_role,
    apply_tenant_filter_raw,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin Data"])


def _normalize_enrichment_source(
    *,
    raw_source: Optional[str],
    metadata_source: Optional[str],
    upload_source: Optional[str],
    bom_source: Optional[str],
    bom_name: Optional[str],
) -> str:
    """Normalize enrichment source to customer/staff/unknown."""

    customer_tokens = {"customer", "customer_portal", "portal"}
    staff_tokens = {"staff", "cns_staff", "cns_bulk", "bulk", "internal", "admin", "cns"}

    tokens: List[str] = []
    for candidate in (raw_source, metadata_source, upload_source, bom_source):
        if not candidate:
            continue
        token = candidate.strip().lower()
        if token:
            tokens.append(token)

    for token in tokens:
        if token in customer_tokens:
            return "customer"

    for token in tokens:
        if token in staff_tokens or token.startswith("staff"):
            return "staff"

    if bom_name and bom_name.strip().lower().startswith("bulk upload"):
        return "staff"

    return "unknown"


@router.get("/enrichment")
@require_role(Role.ADMIN)
async def list_enrichment_latest(
    organization_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    bom_id: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(get_auth_context)
) -> List[Dict[str, Any]]:
    """
    Latest enrichment state per BOM (one row per BOM).

    Requires ADMIN role. Super admins see all data, regular admins
    see only their organization's data.
    """
    try:
        db = next(get_dual_database().get_session("supabase"))

        logger.info(
            f"[Admin] list_enrichment_latest: user={auth.user_id} "
            f"role={auth.role} org_filter={organization_id}"
        )

        filters = []
        params: Dict[str, Any] = {"limit": limit}

        # APP-LAYER RLS: Apply tenant filtering for non-super_admins
        if not auth.is_super_admin:
            # Non-super_admins can only see their own org's data
            filters.append("b.organization_id = :auth_org_id")
            params["auth_org_id"] = auth.organization_id
            logger.info(f"[Admin] Tenant filter applied: org={auth.organization_id}")
        elif organization_id:
            # Super admins can filter by specific org if requested
            filters.append("b.organization_id = :organization_id")
            params["organization_id"] = organization_id

        if project_id:
            filters.append("b.project_id = :project_id")
            params["project_id"] = project_id
        if bom_id:
            filters.append("b.id = :bom_id")
            params["bom_id"] = bom_id

        where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""

        sql = f"""
            WITH latest AS (
                SELECT DISTINCT ON (bom_id)
                    bom_id,
                    state,
                    source,
                    workflow_id,
                    created_at
                FROM enrichment_events
                ORDER BY bom_id, created_at DESC
            )
            SELECT
                b.id AS bom_id,
                b.name AS bom_name,
                b.metadata->>'filename' AS metadata_filename,
                b.metadata->>'upload_source' AS metadata_upload_source,
                b.source AS bom_source,
                b.organization_id,
                b.project_id,
                b.created_at,
                b.status AS bom_status,
                b.component_count,
                COALESCE(latest.state->>'status', 'unknown') AS status,
                COALESCE((latest.state->>'percent_complete')::numeric, 0) AS percent_complete,
                COALESCE((latest.state->>'total_items')::integer, 0) AS total_items,
                COALESCE((latest.state->>'enriched_items')::integer, 0) AS enriched_items,
                COALESCE((latest.state->>'failed_items')::integer, 0) AS failed_items,
                latest.source AS event_source,
                latest.workflow_id,
                bu.upload_source AS upload_upload_source,
                bu.filename AS upload_filename,
                bu.original_filename AS upload_original_filename,
                bu.s3_key AS upload_s3_key,
                bu.s3_bucket AS upload_s3_bucket,
                COALESCE(latest.created_at, b.created_at) AS started_at
            FROM boms b
            LEFT JOIN latest ON latest.bom_id = b.id
            LEFT JOIN LATERAL (
                SELECT
                    bu.upload_source,
                    bu.filename,
                    bu.original_filename,
                    bu.s3_key,
                    bu.s3_bucket,
                    bu.created_at
                FROM bom_uploads bu
                WHERE bu.bom_id = b.id
                ORDER BY bu.created_at DESC
                LIMIT 1
            ) bu ON TRUE
            {where_sql}
            ORDER BY b.created_at DESC
            LIMIT :limit OFFSET :offset
        """
        params["offset"] = offset
        rows = db.execute(text(sql), params).fetchall()
        out = []
        for r in rows:
            m = r._mapping
            bom_name = m.get("bom_name")
            raw_source = m.get("event_source")
            metadata_upload_source = m.get("metadata_upload_source")
            upload_upload_source = m.get("upload_upload_source")
            bom_source = m.get("bom_source")
            normalized_source = _normalize_enrichment_source(
                raw_source=raw_source,
                metadata_source=metadata_upload_source,
                upload_source=upload_upload_source,
                bom_source=bom_source,
                bom_name=bom_name,
            )

            filename_candidates = [
                m.get("metadata_filename"),
                m.get("upload_filename"),
                m.get("upload_original_filename"),
            ]
            bom_filename = next((value for value in filename_candidates if value), None)
            out.append({
                "bom_id": str(m["bom_id"]),
                "bom_name": bom_name,
                "bom_filename": bom_filename,
                "organization_id": str(m["organization_id"]) if m["organization_id"] is not None else None,
                "project_id": str(m["project_id"]) if m["project_id"] is not None else None,
                "status": m["status"],
                "component_count": int(m["component_count"]) if m["component_count"] is not None else None,
                "percent_complete": float(m["percent_complete"]) if m["percent_complete"] is not None else 0.0,
                "total_items": int(m["total_items"]) if m["total_items"] is not None else 0,
                "enriched_items": int(m["enriched_items"]) if m["enriched_items"] is not None else 0,
                "failed_items": int(m["failed_items"]) if m["failed_items"] is not None else 0,
                "source": normalized_source,
                "source_raw": raw_source,
                "upload_source": upload_upload_source,
                "workflow_id": str(m["workflow_id"]) if m["workflow_id"] is not None else None,
                "started_at": m["started_at"].isoformat() if hasattr(m["started_at"], "isoformat") and m["started_at"] else None,
                "s3_key": m.get("upload_s3_key"),
                "s3_bucket": m.get("upload_s3_bucket") or "bulk-uploads",
            })
        return out
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list enrichment latest: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list enrichment data")


@router.get("/mapping-gaps")
@require_role(Role.ADMIN)
async def get_mapping_gaps(
    auth: AuthContext = Depends(get_auth_context)
) -> Dict[str, Any]:
    """Return the latest mapping gap report summary and sample rows.

    Reads `CATEGORY_GAP_REPORT_OUTPUT` CSV and returns count + sample rows.
    Requires ADMIN role.
    """
    try:
        logger.info(f"[Admin] get_mapping_gaps: user={auth.user_id} role={auth.role}")
        path = Path(os.getenv("CATEGORY_GAP_REPORT_OUTPUT", "docs/data-processing/normalizer_mapping_gap_report.csv"))
        if not path.exists():
            return {"rows_count": 0, "sample_rows": [], "report_path": str(path), "last_modified": None}

        sample_rows = []
        with path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader, start=1):
                if i <= int(os.getenv("CATEGORY_GAP_REPORT_SAMPLE_ROWS", "5")):
                    sample_rows.append({
                        "source_id": row.get("source_id"),
                        "source_path": row.get("source_path"),
                        "gap_reason": row.get("gap_reason"),
                    })
        # Count rows
        with path.open("r", encoding="utf-8") as f:
            rows_count = sum(1 for _ in csv.DictReader(f))

        last_modified = None
        try:
            last_modified = datetime.utcfromtimestamp(path.stat().st_mtime).isoformat()
        except Exception:
            last_modified = None

        return {"rows_count": rows_count, "sample_rows": sample_rows, "report_path": str(path), "last_modified": last_modified}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to read mapping gaps: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to read mapping gap report")


@router.get("/mapping-gaps/download")
@require_role(Role.ADMIN)
async def download_mapping_gaps(
    auth: AuthContext = Depends(get_auth_context)
) -> Response:
    """Return the mapping gap CSV file as an attachment.

    Requires ADMIN role.
    """
    try:
        logger.info(f"[Admin] download_mapping_gaps: user={auth.user_id} role={auth.role}")
        path = Path(os.getenv("CATEGORY_GAP_REPORT_OUTPUT", "docs/data-processing/normalizer_mapping_gap_report.csv"))
        if not path.exists() or not path.is_file():
            raise HTTPException(status_code=404, detail="Mapping gap report not found")
        # Return file as attachment
        return FileResponse(path=str(path), media_type="text/csv", filename=path.name)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download mapping gaps: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to return mapping gap report")


@router.get("/enrichment/count")
@require_role(Role.ADMIN)
async def count_enrichment(
    organization_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    bom_id: Optional[str] = Query(None),
    auth: AuthContext = Depends(get_auth_context)
) -> Dict[str, int]:
    """Count BOMs matching enrichment filters. Requires ADMIN role."""
    try:
        logger.info(f"[Admin] count_enrichment: user={auth.user_id} role={auth.role}")
        db = next(get_dual_database().get_session("supabase"))

        filters = []
        params: Dict[str, Any] = {}

        # APP-LAYER RLS: Apply tenant filtering for non-super_admins
        if not auth.is_super_admin:
            filters.append("organization_id = :auth_org_id")
            params["auth_org_id"] = auth.organization_id
        elif organization_id:
            filters.append("organization_id = :organization_id")
            params["organization_id"] = organization_id

        if project_id:
            filters.append("project_id = :project_id")
            params["project_id"] = project_id
        if bom_id:
            filters.append("id = :bom_id")
            params["bom_id"] = bom_id
        where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""

        sql = f"SELECT COUNT(*) FROM boms {where_sql}"
        total = db.execute(text(sql), params).scalar() or 0
        return {"total": int(total)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to count enrichment BOMs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to count enrichment data")


@router.get("/line-items")
@require_role(Role.ADMIN)
async def list_line_items(
    organization_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    bom_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search MPN, manufacturer, description"),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(get_auth_context)
) -> List[Dict[str, Any]]:
    """
    List BOM line items with filters and simple search.
    Requires ADMIN role. Super admins see all data, regular admins
    see only their organization's data.
    """
    try:
        logger.info(f"[Admin] list_line_items: user={auth.user_id} role={auth.role}")
        db = next(get_dual_database().get_session("supabase"))

        filters = []
        params: Dict[str, Any] = {"limit": limit}

        # APP-LAYER RLS: Apply tenant filtering for non-super_admins
        if not auth.is_super_admin:
            filters.append("b.organization_id = :auth_org_id")
            params["auth_org_id"] = auth.organization_id
        elif organization_id:
            filters.append("b.organization_id = :organization_id")
            params["organization_id"] = organization_id

        if project_id:
            filters.append("b.project_id = :project_id")
            params["project_id"] = project_id
        if bom_id:
            filters.append("bli.bom_id = :bom_id")
            params["bom_id"] = bom_id
        if search:
            filters.append("(manufacturer_part_number ILIKE :pattern OR manufacturer ILIKE :pattern OR description ILIKE :pattern)")
            params["pattern"] = f"%{search}%"

        where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""

        sql = f"""
            SELECT bli.id,
                   b.organization_id,
                   b.project_id,
                   bli.bom_id,
                   bli.line_number,
                   bli.manufacturer_part_number,
                   bli.manufacturer,
                   bli.description,
                   bli.enrichment_status,
                   bli.component_id,
                   bli.lifecycle_status,
                   bli.datasheet_url,
                   bli.specifications,
                   bli.compliance_status,
                   bli.pricing,
                   bli.enriched_at
            FROM bom_line_items bli
            LEFT JOIN boms b ON b.id = bli.bom_id
            {where_sql}
            ORDER BY bli.created_at DESC
            LIMIT :limit OFFSET :offset
        """
        params["offset"] = offset
        rows = db.execute(text(sql), params).fetchall()

        # Convert to list of dicts with basic fields
        items = []
        component_ids_to_lookup = []
        for r in rows:
            item = {
                "id": str(r[0]),
                "organization_id": str(r[1]) if r[1] is not None else None,
                "project_id": str(r[2]) if r[2] is not None else None,
                "bom_id": str(r[3]) if r[3] is not None else None,
                "line_number": r[4],
                "manufacturer_part_number": r[5],
                "manufacturer": r[6],
                "description": r[7],
                "enrichment_status": r[8],
                "component_id": str(r[9]) if r[9] is not None else None,
                # Fields from bom_line_items enrichment
                "lifecycle_status": r[10],
                "datasheet_url": r[11],
                "specifications": r[12],
                "compliance_status": r[13],
                "pricing": r[14],
                "enriched_at": r[15].isoformat() if r[15] else None,
                # Placeholder for component catalog fields
                "image_url": None,
                "quality_score": None,
                "rohs_compliant": None,
                "reach_compliant": None,
                "category": None,
            }
            items.append(item)
            if r[9] is not None:  # component_id
                component_ids_to_lookup.append((len(items) - 1, r[5], r[6]))  # (index, mpn, manufacturer)

        # Bulk lookup component catalog metadata for items with component_id
        if component_ids_to_lookup:
            try:
                catalog_service = ComponentCatalogService()
                for idx, mpn, manufacturer in component_ids_to_lookup:
                    if mpn and manufacturer:
                        component = catalog_service.lookup_component(mpn, manufacturer)
                        if component:
                            items[idx]["image_url"] = component.get("image_url")
                            items[idx]["quality_score"] = component.get("quality_score")
                            items[idx]["rohs_compliant"] = component.get("rohs_compliant")
                            items[idx]["reach_compliant"] = component.get("reach_compliant")
                            items[idx]["category"] = component.get("category")
                            # Fallback: use catalog lifecycle_status if not in bom_line_items
                            if not items[idx]["lifecycle_status"]:
                                items[idx]["lifecycle_status"] = component.get("lifecycle_status")
                            if not items[idx]["datasheet_url"]:
                                items[idx]["datasheet_url"] = component.get("datasheet_url")
            except Exception as e:
                logger.warning(f"Error looking up component catalog metadata: {e}")

        return items
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list line items: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list line items")


@router.get("/line-items/count")
@require_role(Role.ADMIN)
async def count_line_items(
    organization_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    bom_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    auth: AuthContext = Depends(get_auth_context)
) -> Dict[str, int]:
    """Count line items matching filters. Requires ADMIN role."""
    try:
        logger.info(f"[Admin] count_line_items: user={auth.user_id} role={auth.role}")
        db = next(get_dual_database().get_session("supabase"))

        filters = []
        params: Dict[str, Any] = {}

        # APP-LAYER RLS: Apply tenant filtering for non-super_admins
        if not auth.is_super_admin:
            filters.append("b.organization_id = :auth_org_id")
            params["auth_org_id"] = auth.organization_id
        elif organization_id:
            filters.append("b.organization_id = :organization_id")
            params["organization_id"] = organization_id

        if project_id:
            filters.append("b.project_id = :project_id")
            params["project_id"] = project_id
        if bom_id:
            filters.append("bli.bom_id = :bom_id")
            params["bom_id"] = bom_id
        if search:
            filters.append("(bli.manufacturer_part_number ILIKE :pattern OR bli.manufacturer ILIKE :pattern OR bli.description ILIKE :pattern)")
            params["pattern"] = f"%{search}%"
        where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""

        sql = f"""
            SELECT COUNT(*)
            FROM bom_line_items bli
            LEFT JOIN boms b ON b.id = bli.bom_id
            {where_sql}
        """
        total = db.execute(text(sql), params).scalar() or 0
        return {"total": int(total)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to count line items: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to count line items")


@router.get("/audit/logs")
@require_role(Role.ADMIN)
async def list_audit_logs(
    organization_id: Optional[str] = Query(None),
    time_range: str = Query("24h", regex="^(24h|7d|30d)$"),
    limit: int = Query(200, ge=1, le=500),
    auth: AuthContext = Depends(get_auth_context)
) -> List[Dict[str, Any]]:
    """Fetch recent audit log events for BOM uploads and enrichment workflows.

    Requires ADMIN role. Super admins see all data, regular admins
    see only their organization's audit logs.
    """

    # Map time range selector to time delta
    range_map = {
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }

    try:
        logger.info(f"[Admin] list_audit_logs: user={auth.user_id} role={auth.role}")
        db = next(get_dual_database().get_session("supabase"))

        filters = [
            "((routing_key LIKE :customer_prefix)"
            " OR (routing_key LIKE :staff_prefix)"
            " OR (routing_key LIKE :cns_prefix)"
            " OR (routing_key LIKE :component_prefix)"
            " OR (routing_key LIKE :admin_prefix))"
        ]
        params: Dict[str, Any] = {
            "customer_prefix": "customer.bom.%",  # customer portal events
            "staff_prefix": "cns.bulk.%",         # staff/bulk upload workflow
            "cns_prefix": "cns.bom.%",            # legacy cns.* BOM events
            "component_prefix": "enrichment.component.%",  # per-line component events
            "admin_prefix": "admin.%",
            "limit": limit,
        }

        # APP-LAYER RLS: Apply tenant filtering for non-super_admins
        if not auth.is_super_admin:
            filters.append("organization_id = :auth_org_id")
            params["auth_org_id"] = auth.organization_id
        elif organization_id:
            filters.append("organization_id = :organization_id")
            params["organization_id"] = organization_id

        since = datetime.utcnow() - range_map.get(time_range, timedelta(hours=24))
        filters.append("timestamp >= :since")
        params["since"] = since

        where_sql = f"WHERE {' AND '.join(filters)}"

        sql = f"""
            SELECT id,
                   event_type,
                   routing_key,
                   timestamp,
                   source,
                   organization_id,
                   event_data
            FROM audit_logs
            {where_sql}
            ORDER BY timestamp DESC
            LIMIT :limit
        """

        rows = db.execute(text(sql), params).fetchall()
        output: List[Dict[str, Any]] = []

        for row in rows:
            mapping = row._mapping
            output.append(
                {
                    "id": str(mapping["id"]),
                    "event_type": mapping["event_type"],
                    "routing_key": mapping["routing_key"],
                    "timestamp": mapping["timestamp"].isoformat() if mapping["timestamp"] else None,
                    "source": mapping["source"],
                    "organization_id": str(mapping["organization_id"]) if mapping["organization_id"] is not None else None,
                    "event_data": mapping["event_data"],
                }
            )

        return output
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        logger.error("Failed to load audit logs", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load audit logs") from exc
