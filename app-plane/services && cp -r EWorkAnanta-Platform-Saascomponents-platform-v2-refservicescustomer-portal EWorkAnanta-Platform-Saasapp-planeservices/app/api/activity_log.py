"""
Activity Log API

Provides a unified timeline of recent platform events for the CNS dashboard.
Sources:
1. Supabase.audit_logs  - Customer/staff events captured via the audit bus
2. audit_enrichment_runs - Internal enrichment activity (Directus-visible)
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.dual_database import get_dual_database

logger = logging.getLogger(__name__)

router = APIRouter()

TIME_RANGE_MAP = {
    "1h": timedelta(hours=1),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}

VALID_LEVELS = {"info", "success", "warning", "error"}


@router.get("/activity-log")
def get_activity_log(
    level: Optional[str] = Query(
        None, description="Filter by log level (info, success, warning, error)"
    ),
    time_range: str = Query(
        "24h", description="Time window to query (1h, 24h, 7d, 30d)"
    ),
    limit: Optional[int] = Query(
        None,
        ge=1,
        le=5000,
        description="Maximum number of log entries to return (omit for all entries within the time window)",
    ),
    organization_id: Optional[str] = Query(
        None, description="Filter by organization ID"
    ),
    job_id: Optional[str] = Query(
        None, description="Filter by job/upload ID"
    ),
    bom_name: Optional[str] = Query(
        None, description="Filter by BOM name (partial match)"
    ),
    project_id: Optional[str] = Query(
        None, description="Filter by project ID"
    ),
) -> Dict[str, Any]:
    """
    Aggregate recent system events for the CNS dashboard Activity Log.

    Combines Supabase audit logs with enrichment audit records so staff can
    see customer uploads, workflow status, and Directus actions in one stream.
    """
    if level and level not in VALID_LEVELS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid level '{level}'. Must be one of {sorted(VALID_LEVELS)}",
        )

    if time_range not in TIME_RANGE_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid time_range '{time_range}'. "
            f"Supported values: {', '.join(TIME_RANGE_MAP.keys())}",
        )

    start_time = datetime.utcnow() - TIME_RANGE_MAP[time_range]

    dual_db = get_dual_database()
    supabase_gen = dual_db.get_session("supabase")
    components_gen = dual_db.get_session("components")
    supabase_db = next(supabase_gen)
    components_db = next(components_gen)

    filters = {
        "organization_id": organization_id,
        "job_id": job_id,
        "bom_name": bom_name,
        "project_id": project_id,
    }

    try:
        supabase_logs = _fetch_supabase_audit_logs(supabase_db, start_time, limit, filters)
        enrichment_logs = _fetch_enrichment_logs(components_db, supabase_db, start_time, limit, filters)
    finally:
        # Ensure sessions are closed (get_session uses generators)
        try:
            supabase_gen.close()
        except Exception:
            pass
        try:
            components_gen.close()
        except Exception:
            pass

    combined = supabase_logs + enrichment_logs

    if level:
        combined = [entry for entry in combined if entry["level"] == level]

    combined.sort(key=lambda entry: entry["timestamp"], reverse=True)
    if limit:
        combined = combined[:limit]

    # Convert timestamps to ISO strings for JSON response
    for entry in combined:
        entry["timestamp"] = entry["timestamp"].isoformat()

    return {
        "logs": combined,
        "count": len(combined),
        "filters": {
            "level": level,
            "time_range": time_range,
            "limit": limit,
            "organization_id": organization_id,
            "job_id": job_id,
            "bom_name": bom_name,
            "project_id": project_id,
        },
    }


def _fetch_supabase_audit_logs(
    db: Session, start_time: datetime, limit: Optional[int], filters: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Pull recent events from Supabase audit_logs table with optional filters.
    """
    try:
        sql = """
            SELECT
                id,
                event_type,
                routing_key,
                timestamp,
                username,
                email,
                user_id,
                source,
                event_data
            FROM audit_logs
            WHERE timestamp >= :start_time
        """
        params = {"start_time": start_time}

        # Add organization_id filter if provided
        if filters.get("organization_id"):
            sql += " AND (event_data->>'organization_id' = :org_id OR event_data->>'org_id' = :org_id)"
            params["org_id"] = filters["organization_id"]

        # Add job_id filter if provided
        if filters.get("job_id"):
            sql += " AND (event_data->>'job_id' = :job_id OR event_data->>'upload_id' = :job_id)"
            params["job_id"] = filters["job_id"]

        # Add bom_name filter if provided (case-insensitive partial match)
        if filters.get("bom_name"):
            sql += " AND (LOWER(event_data->>'bom_name') LIKE :bom_name OR LOWER(event_data->>'filename') LIKE :bom_name)"
            params["bom_name"] = f"%{filters['bom_name'].lower()}%"

        # Add project_id filter if provided
        if filters.get("project_id"):
            sql += " AND event_data->>'project_id' = :project_id"
            params["project_id"] = filters["project_id"]

        sql += " ORDER BY timestamp DESC"

        if limit:
            sql += " LIMIT :limit"
            params["limit"] = limit

        query = text(sql)
        result = db.execute(query, params)
    except Exception as exc:
        logger.error(f"Failed to fetch Supabase audit logs: {exc}", exc_info=True)
        return []

    entries: List[Dict[str, Any]] = []
    for row in result:
        row_map = row._mapping
        metadata = row_map.get("event_data") or {}
        upload_id = metadata.get("job_id") or metadata.get("upload_id")
        upload_meta = _get_upload_metadata_supabase(db, upload_id)
        organization_id = (
            metadata.get("organization_id")
            or metadata.get("org_id")
            or (upload_meta.get("organization_id") if upload_meta else None)
        )
        project_id = metadata.get("project_id") or (upload_meta.get("project_id") if upload_meta else None)
        bom_name = (
            metadata.get("bom_name")
            or metadata.get("filename")
            or (upload_meta.get("bom_name") if upload_meta else None)
        )
        event_type = row_map["event_type"] or "event.unknown"
        routing_key = row_map["routing_key"] or ""
        level = _map_level_from_text(f"{event_type} {routing_key}")
        message = _build_supabase_message(event_type, metadata, row_map)

        entries.append(
            {
                "id": f"audit:{row_map['id']}",
                "timestamp": row_map["timestamp"],
                "level": level,
                "event_type": event_type,
                "message": message,
                "user": row_map.get("username")
                or row_map.get("email")
                or row_map.get("user_id"),
                "mpn": metadata.get("mpn"),
                "job_id": upload_id,
                "organization_id": organization_id,
                "project_id": project_id,
                "bom_name": bom_name,
                "metadata": {
                    **metadata,
                    "source": row_map.get("source"),
                    "routing_key": routing_key,
                },
            }
        )

    return entries


def _fetch_enrichment_logs(
    db: Session,
    supabase_db: Session,
    start_time: datetime,
    limit: Optional[int],
    filters: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Pull recent enrichment runs for inclusion in the activity log with optional filters.
    """
    try:
        sql = """
            SELECT
                id,
                upload_id,
                line_id,
                mpn,
                manufacturer,
                supplier_name,
                enrichment_timestamp,
                successful,
                quality_score,
                storage_location,
                needs_review,
                error_message
            FROM audit_enrichment_runs
            WHERE enrichment_timestamp >= :start_time
        """
        params = {"start_time": start_time}

        # Add upload_id filter if provided
        if filters.get("job_id"):
            sql += " AND upload_id = :upload_id"
            params["upload_id"] = filters["job_id"]

        # Add mpn filter if provided (for BOM name search on MPN)
        # Note: BOM name filtering will be done post-query since it requires upload metadata lookup

        sql += " ORDER BY enrichment_timestamp DESC"

        if limit:
            sql += " LIMIT :limit"
            params["limit"] = limit

        query = text(sql)
        result = db.execute(query, params)
    except Exception as exc:
        logger.error(f"Failed to fetch enrichment audit runs: {exc}", exc_info=True)
        return []

    entries: List[Dict[str, Any]] = []
    for row in result:
        row_map = row._mapping
        quality = float(row_map["quality_score"]) if row_map["quality_score"] is not None else None
        successful = bool(row_map["successful"])
        needs_review = bool(row_map["needs_review"])

        if not successful:
            level = "error"
            event_type = "enrichment.failed"
            message = (
                f"Enrichment failed for {row_map['mpn']} "
                f"({row_map.get('supplier_name') or 'unknown supplier'})"
            )
        elif needs_review or (quality is not None and quality < 80):
            level = "warning"
            event_type = "enrichment.review"
            message = (
                f"Enrichment requires review for {row_map['mpn']} "
                f"(score {quality or 'n/a'}/100)"
            )
        else:
            level = "success"
            event_type = "enrichment.completed"
            message = (
                f"Enriched {row_map['mpn']} via {row_map.get('supplier_name') or 'unknown supplier'} "
                f"({quality or 'n/a'}/100)"
            )

        upload_id = row_map.get("upload_id")
        upload_meta = _get_upload_metadata_supabase(supabase_db, upload_id)

        # Apply post-query filters that require upload metadata
        if filters.get("organization_id"):
            if upload_meta.get("organization_id") != filters["organization_id"]:
                continue

        if filters.get("project_id"):
            if upload_meta.get("project_id") != filters["project_id"]:
                continue

        if filters.get("bom_name"):
            bom_name_lower = (upload_meta.get("bom_name") or "").lower()
            if filters["bom_name"].lower() not in bom_name_lower:
                continue

        metadata = {
            "supplier": row_map.get("supplier_name"),
            "storage_location": row_map.get("storage_location"),
            "quality_score": quality,
            "successful": successful,
            "needs_review": needs_review,
            "error_message": row_map.get("error_message"),
            "upload_id": upload_id,
            "line_id": row_map.get("line_id"),
            "organization_id": upload_meta.get("organization_id"),
            "project_id": upload_meta.get("project_id"),
            "bom_name": upload_meta.get("bom_name"),
        }

        entries.append(
            {
                "id": f"enrichment:{row_map['id']}",
                "timestamp": row_map["enrichment_timestamp"],
                "level": level,
                "event_type": event_type,
                "message": message,
                "user": row_map.get("supplier_name"),
                "mpn": row_map.get("mpn"),
                "job_id": upload_id,
                "organization_id": upload_meta.get("organization_id"),
                "project_id": upload_meta.get("project_id"),
                "bom_name": upload_meta.get("bom_name"),
                "metadata": metadata,
            }
        )

    return entries


def _map_level_from_text(text_value: str) -> str:
    """
    Derive log level heuristically from event strings.
    """
    lowered = (text_value or "").lower()
    if any(word in lowered for word in ("error", "failed", "exception", "critical")):
        return "error"
    if any(word in lowered for word in ("warn", "retry", "review")):
        return "warning"
    if any(word in lowered for word in ("success", "uploaded", "completed", "approved", "synced", "promoted")):
        return "success"
    return "info"


def _build_supabase_message(
    event_type: str, metadata: Dict[str, Any], row_map: Dict[str, Any]
) -> str:
    """
    Create a human-readable message for Supabase audit log rows.
    """
    normalized_type = event_type or "event.unknown"

    if normalized_type.startswith("cns.bulk.uploaded"):
        filename = metadata.get("filename") or "Bulk BOM"
        total = metadata.get("total_items")
        return f"CNS bulk upload {filename} ({total or 0} items)"

    if normalized_type.startswith("customer.bom.uploaded"):
        filename = metadata.get("filename") or "BOM file"
        total = metadata.get("total_items")
        actor = row_map.get("username") or row_map.get("email") or "customer"
        return f"Customer upload {filename} ({total or 0} items) by {actor}"

    if normalized_type.endswith("enrichment_started"):
        bom_id = metadata.get("bom_id") or "BOM"
        actor = metadata.get("initiated_by") or row_map.get("username") or "system"
        return f"Enrichment started for {bom_id} by {actor}"

    if normalized_type.startswith("customer.bom"):
        filename = metadata.get("filename") or metadata.get("bom_name") or "BOM file"
        action = normalized_type.split(".")[-1].replace("_", " ")
        actor = row_map.get("username") or row_map.get("email") or "user"
        return f"{filename} {action} by {actor}"

    if normalized_type.startswith("auth."):
        actor = row_map.get("email") or row_map.get("username") or "user"
        action = normalized_type.split(".")[-1]
        return f"User {actor} {action}"

    if normalized_type.startswith("admin."):
        actor = row_map.get("username") or row_map.get("email") or "admin"
        action = normalized_type.split(".")[-1].replace("_", " ")
        return f"Admin {actor} performed {action}"

    source = row_map.get("source") or "system"
    return f"{normalized_type.replace('.', ' ').title()} ({source})"


_UPLOAD_METADATA_CACHE: Dict[str, Dict[str, Any]] = {}


def _get_upload_metadata_supabase(db: Session, upload_id: Optional[str]) -> Dict[str, Any]:
    """Fetch cached metadata (organization, bom name) for a given upload ID."""
    if not upload_id:
        return {}

    if upload_id in _UPLOAD_METADATA_CACHE:
        return _UPLOAD_METADATA_CACHE[upload_id]

    try:
        query = text(
            """
            SELECT
                id,
                organization_id,
                project_id,
                original_name,
                filename
            FROM cns_bulk_uploads
            WHERE id = :upload_id
            """
        )
        row = db.execute(query, {"upload_id": upload_id}).fetchone()
        if not row:
            _UPLOAD_METADATA_CACHE[upload_id] = {}
            return {}

        data = row._mapping
        metadata = {
            "organization_id": str(data.get("organization_id")) if data.get("organization_id") else None,
            "project_id": str(data.get("project_id")) if data.get("project_id") else None,
            "bom_name": data.get("original_name") or data.get("filename"),
        }
        _UPLOAD_METADATA_CACHE[upload_id] = metadata
        return metadata
    except Exception as exc:
        logger.debug(f"Failed to load upload metadata for {upload_id}: {exc}")
        _UPLOAD_METADATA_CACHE[upload_id] = {}
        return {}
