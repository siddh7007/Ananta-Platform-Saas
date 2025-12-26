"""
Admin Lookup Endpoints

Lightweight list endpoints for dashboard dropdowns (tenants, projects, BOMs).
Backed by the Supabase database via dual_database sessions.

Authorization:
    Uses app-layer RLS via app.core.authorization module.
    All admin endpoints require at least ADMIN role.
    See docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md for details.
"""

import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy import text

from app.models.dual_database import get_dual_database
from app.config import settings

# App-layer authorization (see docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md)
from app.core.authorization import (
    AuthContext,
    get_auth_context,
    Role,
    require_role,
    build_tenant_where_clause,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin Lookup"])


@router.get("/tenants")
@require_role(Role.ADMIN)
async def list_tenants(
    search: Optional[str] = Query(None, description="Search by organization name (ILIKE)"),
    limit: int = Query(50, ge=1, le=200),
    auth: AuthContext = Depends(get_auth_context)
) -> List[Dict[str, Any]]:
    """
    List organizations (tenants) for dropdowns.
    Requires ADMIN role. Super admins see all tenants.
    Non-super_admins only see their own organization.

    Returns: [{ id, name, slug }]
    """
    try:
        logger.info(f"[Admin] list_tenants: user={auth.user_id} role={auth.role}")
        db = next(get_dual_database().get_session("supabase"))

        # Build conditions and params
        conditions: List[str] = []
        params: Dict[str, Any] = {"limit": limit}

        # Tenant filter - for organizations table, filter on 'id' column
        tenant_conditions, tenant_params = build_tenant_where_clause(
            auth, org_column="id", log_action="list_tenants"
        )
        conditions.extend(tenant_conditions)
        params.update(tenant_params)

        if search:
            params["pattern"] = f"%{search}%"

        include_slug = False
        try:
            # Try with slug column
            search_conditions = list(conditions)  # Copy
            if search:
                search_conditions.append("(name ILIKE :pattern OR slug ILIKE :pattern)")
            where_clause = f"WHERE {' AND '.join(search_conditions)}" if search_conditions else ""

            sql = text(f"""
                SELECT id, name, slug
                FROM organizations
                {where_clause}
                ORDER BY name ASC
                LIMIT :limit
            """)
            rows = db.execute(sql, params).fetchall()
            include_slug = True
        except Exception:
            # Fallback without slug column
            search_conditions = list(conditions)  # Copy
            if search:
                search_conditions.append("name ILIKE :pattern")
            where_clause = f"WHERE {' AND '.join(search_conditions)}" if search_conditions else ""

            sql = text(f"""
                SELECT id, name
                FROM organizations
                {where_clause}
                ORDER BY name ASC
                LIMIT :limit
            """)
            rows = db.execute(sql, params).fetchall()

        results: List[Dict[str, Any]] = []
        for row in rows:
            mapping = getattr(row, "_mapping", None)
            organization_id = str(mapping["id"] if mapping else row[0])
            name = mapping["name"] if mapping else row[1]
            slug = None
            if include_slug:
                slug_value = mapping["slug"] if mapping else row[2]
                slug = slug_value if slug_value else name
            else:
                slug = name
            results.append({"id": organization_id, "name": name, "slug": slug})

        return results
    except HTTPException:
        # Propagate auth errors (401/403)
        raise
    except Exception as e:
        logger.error(f"Failed to list tenants: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list tenants")


@router.get("/projects")
@require_role(Role.ADMIN)
async def list_projects(
    organization_id: Optional[str] = Query(None, description="Filter by tenant/organization ID"),
    search: Optional[str] = Query(None, description="Search by project name (if available)"),
    limit: int = Query(50, ge=1, le=200),
    auth: AuthContext = Depends(get_auth_context)
) -> List[Dict[str, Any]]:
    """
    List projects for dropdowns.
    Requires ADMIN role. Super admins see all projects.
    Non-super_admins only see projects in their organization.

    Note: If a projects table is unavailable, fall back to distinct project_id values
    from boms and return a synthetic name.

    Returns: [{ id, name }]
    """
    try:
        logger.info(f"[Admin] list_projects: user={auth.user_id} role={auth.role}")
        db = next(get_dual_database().get_session("supabase"))

        # Build tenant filter conditions
        tenant_conditions, tenant_params = build_tenant_where_clause(
            auth, explicit_org_filter=organization_id, log_action="list_projects"
        )

        # Try a projects table first
        try:
            base_sql = "SELECT id, name FROM projects"
            where = list(tenant_conditions)  # Start with tenant filter
            params: Dict[str, Any] = {"limit": limit, **tenant_params}

            if search:
                where.append("name ILIKE :pattern")
                params["pattern"] = f"%{search}%"
            if where:
                base_sql += " WHERE " + " AND ".join(where)
            base_sql += " ORDER BY name ASC LIMIT :limit"
            rows = db.execute(text(base_sql), params).fetchall()
            return [{"id": str(r[0]), "name": r[1]} for r in rows]
        except Exception:
            # Fall back to distinct project_id from boms
            base_sql = "SELECT DISTINCT project_id FROM boms"
            where = list(tenant_conditions)  # Start with tenant filter
            params = {"limit": limit, **tenant_params}

            if where:
                base_sql += " WHERE " + " AND ".join(where)
            base_sql += " ORDER BY project_id ASC LIMIT :limit"
            rows = db.execute(text(base_sql), params).fetchall()
            # Craft a display name
            items = []
            for r in rows:
                pid = r[0]
                if pid is None:
                    continue
                items.append({"id": str(pid), "name": f"Project {pid}"})
            return items
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list projects: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list projects")


@router.get("/boms")
@require_role(Role.ADMIN)
async def list_boms(
    organization_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search by BOM name or filename"),
    upload_source: Optional[str] = Query("customer", description="Filter by upload source: 'customer', 'staff', or 'all'"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(get_auth_context)
) -> List[Dict[str, Any]]:
    """
    List BOMs for dropdowns and quick filters.
    Requires ADMIN role. Super admins see all BOMs.
    Non-super_admins only see BOMs in their organization.

    Args:
        upload_source: Filter by upload source - 'customer' (default), 'staff', or 'all'

    Returns: [{ id, name, filename, status, organization_id, project_id, created_at, component_count }]
    """
    try:
        logger.info(f"[Admin] list_boms: user={auth.user_id} role={auth.role} upload_source={upload_source}")
        db = next(get_dual_database().get_session("supabase"))

        # Build tenant filter conditions (with table alias)
        tenant_conditions, tenant_params = build_tenant_where_clause(
            auth, table_alias="b", explicit_org_filter=organization_id, log_action="list_boms"
        )

        where = list(tenant_conditions)
        params: Dict[str, Any] = {"limit": limit, **tenant_params}

        if project_id:
            where.append("b.project_id = :project_id")
            params["project_id"] = project_id
        if search:
            where.append("(b.name ILIKE :pattern OR b.filename ILIKE :pattern)")
            params["pattern"] = f"%{search}%"

        # Filter by upload source (exclude staff bulk uploads by default)
        if upload_source and upload_source != "all":
            where.append("(bu.upload_source = :upload_source OR (bu.upload_source IS NULL AND b.name NOT LIKE 'Bulk Upload -%'))")
            params["upload_source"] = upload_source

        where_sql = f"WHERE {' AND '.join(where)}" if where else ""

        sql = f"""
            WITH latest AS (
              SELECT DISTINCT ON (bom_id)
                     bom_id, state, created_at
              FROM enrichment_events
              ORDER BY bom_id, created_at DESC
            )
            SELECT b.id, b.name, b.status, b.organization_id, b.project_id, b.created_at, b.component_count,
                   COALESCE(latest.state->>'status', 'unknown') AS enrichment_status,
                   COALESCE((latest.state->>'percent_complete')::numeric, 0) AS percent_complete,
                   bu.s3_key,
                   bu.s3_bucket,
                   COALESCE(bu.original_filename, bu.filename) AS filename,
                   bu.upload_source,
                   b.temporal_workflow_id,
                   b.enrichment_progress
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
        params["offset"] = offset
        rows = db.execute(text(sql), params).fetchall()
        return [
            {
                "id": str(r[0]),
                "name": r[1],
                "status": r[2],
                "organization_id": str(r[3]) if r[3] is not None else None,
                "project_id": str(r[4]) if r[4] is not None else None,
                "created_at": r[5].isoformat() if hasattr(r[5], "isoformat") and r[5] else None,
                "component_count": int(r[6]) if r[6] is not None else None,
                "enrichment_status": r[7],
                "percent_complete": float(r[8]) if r[8] is not None else 0.0,
                "s3_key": r[9],
                "s3_bucket": r[10] or "bulk-uploads",
                "filename": r[11],
                "upload_source": r[12],
                "temporal_workflow_id": r[13],
                "enrichment_progress": r[14],
            }
            for r in rows
        ]
    except Exception as e:
        logger.error(f"Failed to list BOMs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list BOMs")


@router.get("/boms/count")
@require_role(Role.ADMIN)
async def count_boms(
    organization_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    bom_id: Optional[str] = Query(None),
    upload_source: Optional[str] = Query("customer", description="Filter by upload source: 'customer', 'staff', or 'all'"),
    auth: AuthContext = Depends(get_auth_context)
) -> Dict[str, int]:
    """Count BOMs matching filters. Requires ADMIN role."""
    try:
        logger.info(f"[Admin] count_boms: user={auth.user_id} role={auth.role} upload_source={upload_source}")
        db = next(get_dual_database().get_session("supabase"))

        # Build tenant filter conditions
        tenant_conditions, tenant_params = build_tenant_where_clause(
            auth, table_alias="b", explicit_org_filter=organization_id, log_action="count_boms"
        )

        where = list(tenant_conditions)
        params: Dict[str, Any] = {**tenant_params}

        if project_id:
            where.append("b.project_id = :project_id")
            params["project_id"] = project_id
        if search:
            where.append("(b.name ILIKE :pattern)")
            params["pattern"] = f"%{search}%"
        if bom_id:
            where.append("b.id = :bom_id")
            params["bom_id"] = bom_id

        # Filter by upload source (exclude staff bulk uploads by default)
        if upload_source and upload_source != "all":
            where.append("(bu.upload_source = :upload_source OR (bu.upload_source IS NULL AND b.name NOT LIKE 'Bulk Upload -%'))")
            params["upload_source"] = upload_source

        where_sql = f"WHERE {' AND '.join(where)}" if where else ""

        sql = f"""
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
        total = db.execute(text(sql), params).scalar() or 0
        return {"total": int(total)}
    except Exception as e:
        logger.error(f"Failed to count BOMs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to count BOMs")
