"""
Admin API Endpoints for Directus Integration

Provides REST API for:
- Redis → PostgreSQL sync (for Directus visibility)
- Manual component promotion (Redis → Vault)
- Supplier quality stats
- Audit data access

Authorization:
    Uses app-layer RLS via app.core.authorization module.
    All admin endpoints require at least ADMIN role.
    See docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md for details.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Generator, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, validator
from sqlalchemy.orm import Session

from app.models.dual_database import get_dual_database
from app.utils.redis_snapshot_sync import RedisSnapshotSync
from app.utils.enrichment_audit_db import EnrichmentAuditDB
from app.utils.rate_limiter import rate_limit_admin_endpoints, rate_limit_sync_endpoints
from app.core.enrichment_config_loader import get_enrichment_config, invalidate_global_config_cache
from app.utils.directus_client import get_directus_file_service
from app.utils.minio_client import get_minio_client
from app.config import settings

# App-layer authorization (see docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md)
from app.core.authorization import (
    AuthContext,
    get_auth_context,
    Role,
    require_role,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/directus", tags=["Admin", "Directus"])


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class SyncStats(BaseModel):
    """Redis sync statistics"""
    total_snapshots: int
    active: int
    expired: int
    promoted: int
    expiring_soon: int
    avg_quality_score: float
    last_sync_time: Optional[str]


class SyncResponse(BaseModel):
    """Response from sync operation"""
    success: bool
    stats: Dict[str, int]
    message: str
    timestamp: str


class PromoteRequest(BaseModel):
    """Request to promote component from Redis to Vault"""
    snapshot_id: str = Field(..., description="UUID of redis_component_snapshot record")
    override_quality: bool = Field(default=False, description="Force promotion even if quality < 80")
    admin_notes: Optional[str] = Field(None, description="Admin notes about promotion decision")

    @validator('snapshot_id')
    def validate_snapshot_id(cls, v):
        """Validate snapshot_id is a valid UUID"""
        try:
            UUID(v)
            return v
        except ValueError:
            raise ValueError(f"snapshot_id must be a valid UUID, got: {v}")


class PromoteResponse(BaseModel):
    """Response from promotion operation"""
    success: bool
    message: str
    snapshot_id: str
    promoted: bool


class StorageStats(BaseModel):
    """Storage distribution statistics"""
    database_count: int
    redis_count: int
    total_count: int
    avg_database_quality: float
    avg_redis_quality: float


class DirectusArtifact(BaseModel):
    """Single Directus file entry with BOM metadata."""
    id: str
    filename_disk: Optional[str]
    filename_download: Optional[str]
    title: Optional[str]
    description: Optional[str]
    type: Optional[str]
    metadata: Dict[str, Any] = Field(default_factory=dict)
    download_url: Optional[str] = None
    download_expires_in: Optional[int] = None
    created_on: Optional[str] = Field(default=None, alias="created_on")
    uploaded_on: Optional[str] = Field(default=None, alias="uploaded_on")


class DirectusArtifactResponse(BaseModel):
    """Directus artifact list response."""
    items: List[DirectusArtifact]
    count: int


# ============================================================================
# AUTHENTICATION
# ============================================================================
# NOTE: Legacy _require_admin_token() removed.
# All endpoints now use app-layer RLS via @require_role(Role.ADMIN) decorator
# and Depends(get_auth_context) for proper JWT-based authentication.
# See docs/architecture/APP_LAYER_RLS-CD-Nov-25-25.md for details.


# ============================================================================
# DEPENDENCY: DATABASE SESSION
# ============================================================================

def get_db() -> Generator[Session, None, None]:
    """
    Get database session for Components V2 database

    Yields:
        Session: SQLAlchemy database session
    """
    dual_db = get_dual_database()
    db = next(dual_db.get_session("components"))
    try:
        yield db
    finally:
        db.close()


# ============================================================================
# ENDPOINTS: REDIS SYNC
# ============================================================================

@router.post("/sync-redis", response_model=SyncResponse, dependencies=[Depends(rate_limit_sync_endpoints)])
@require_role(Role.ADMIN)
async def sync_redis_to_postgres(
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Sync all Redis components to PostgreSQL snapshot table

    This makes Redis components visible in Directus UI.
    Should be called periodically (every 5 minutes) or on-demand.

    **Authentication:** Requires ADMIN role
    **Rate Limit:** 10 requests/minute

    **Returns:**
    - success: Whether sync completed successfully
    - stats: Sync statistics (synced, expired, errors)
    - message: Human-readable message
    - timestamp: Sync completion time
    """
    logger.info(f"[Admin] sync_redis_to_postgres: user={auth.user_id} role={auth.role}")

    try:
        sync = RedisSnapshotSync(db)
        stats = sync.sync_all_components()

        return SyncResponse(
            success=True,
            stats=stats,
            message=f"Synced {stats['synced']} components from Redis to PostgreSQL",
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Redis sync failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@router.get("/sync-stats", response_model=SyncStats, dependencies=[Depends(rate_limit_admin_endpoints)])
@require_role(Role.ADMIN)
async def get_sync_stats(
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get current Redis sync statistics

    **Authentication:** Requires ADMIN role
    **Rate Limit:** 120 requests/minute (authenticated), 60 requests/minute (unauthenticated)

    **Returns:**
    - total_snapshots: Total components in snapshot table
    - active: Currently active in Redis
    - expired: Expired from Redis
    - promoted: Promoted to vault
    - expiring_soon: Expiring in next 24 hours
    - avg_quality_score: Average quality score
    - last_sync_time: Last sync timestamp
    """
    logger.info(f"[Admin] get_sync_stats: user={auth.user_id} role={auth.role}")

    try:
        sync = RedisSnapshotSync(db)
        stats = sync.get_sync_stats()

        return SyncStats(**stats)

    except Exception as e:
        logger.error(f"Failed to get sync stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


# ============================================================================
# ENDPOINTS: COMPONENT PROMOTION
# ============================================================================

@router.post("/promote-component", response_model=PromoteResponse, dependencies=[Depends(rate_limit_sync_endpoints)])
@require_role(Role.ADMIN)
async def promote_component_to_vault(
    req: Request,
    request: PromoteRequest,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Manually promote a component from Redis to permanent Vault storage

    **Authentication:** Requires ADMIN role
    **Rate Limit:** 10 requests/minute (resource-intensive operation)

    **Use Cases:**
    - Admin review determines component is acceptable despite low quality score
    - Manual override for critical components
    - Correct supplier data errors before promotion

    **Parameters:**
    - snapshot_id: UUID of redis_component_snapshot record
    - override_quality: Force promotion even if quality < 80
    - admin_notes: Reason for promotion (logged for audit)

    **Returns:**
    - success: HTTP call succeeded
    - promoted: Component was actually promoted (false if already promoted or errors)
    - message: Human-readable result
    """
    logger.info(f"[Admin] promote_component_to_vault: user={auth.user_id} snapshot={request.snapshot_id}")

    try:
        sync = RedisSnapshotSync(db)
        promoted = sync.promote_component_to_vault(
            snapshot_id=request.snapshot_id,
            override_quality=request.override_quality,
            admin_notes=request.admin_notes
        )

        if promoted:
            message = f"Component promoted to vault (override={request.override_quality})"
        else:
            message = "Component promotion failed (see logs for details)"

        return PromoteResponse(
            success=True,
            message=message,
            snapshot_id=request.snapshot_id,
            promoted=promoted
        )

    except Exception as e:
        logger.error(f"Promotion failed for {request.snapshot_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Promotion failed: {str(e)}")


# ============================================================================
# ENDPOINTS: STORAGE STATS
# ============================================================================

@router.get("/storage-stats", response_model=StorageStats, dependencies=[Depends(rate_limit_admin_endpoints)])
@require_role(Role.ADMIN)
async def get_storage_stats(
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get storage distribution statistics

    **Authentication:** Requires ADMIN role
    **Rate Limit:** 120 requests/minute (authenticated), 60 requests/minute (unauthenticated)

    Shows components split between:
    - Database (permanent, high quality >= 80)
    - Redis (temporary, low quality < 80)

    **Returns:**
    - database_count: Components in permanent storage
    - redis_count: Components in Redis cache
    - total_count: Total components
    - avg_database_quality: Average quality in database
    - avg_redis_quality: Average quality in Redis
    """
    logger.info(f"[Admin] get_storage_stats: user={auth.user_id} role={auth.role}")

    try:
        from sqlalchemy import text

        query = text("""
            SELECT
                storage_location,
                COUNT(*) as count,
                AVG(quality_score) as avg_quality
            FROM directus_component_unified
            GROUP BY storage_location
        """)

        result = db.execute(query).fetchall()

        stats = {
            'database_count': 0,
            'redis_count': 0,
            'total_count': 0,
            'avg_database_quality': 0.0,
            'avg_redis_quality': 0.0,
        }

        for row in result:
            if row.storage_location == 'database':
                stats['database_count'] = row.count
                stats['avg_database_quality'] = float(row.avg_quality or 0)
            elif row.storage_location == 'redis':
                stats['redis_count'] = row.count
                stats['avg_redis_quality'] = float(row.avg_quality or 0)

        stats['total_count'] = stats['database_count'] + stats['redis_count']

        return StorageStats(**stats)

    except Exception as e:
        logger.error(f"Failed to get storage stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get storage stats: {str(e)}")


# ============================================================================
# ENDPOINTS: AUDIT DATA
# ============================================================================

@router.get("/audit-runs", dependencies=[Depends(rate_limit_admin_endpoints)])
@require_role(Role.ADMIN)
async def get_recent_audit_runs(
    request: Request,
    limit: int = Query(default=50, ge=1, le=500, description="Max results to return"),
    needs_review_only: bool = Query(default=False, description="Only show runs needing review"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get recent enrichment audit runs

    **Authentication:** Requires ADMIN role
    **Rate Limit:** 120 requests/minute (authenticated), 60 requests/minute (unauthenticated)

    **Parameters:**
    - limit: Max results (1-500, default 50)
    - needs_review_only: Filter to only flagged runs

    **Returns:**
    - List of enrichment runs with quality metrics
    """
    logger.info(f"[Admin] get_recent_audit_runs: user={auth.user_id} role={auth.role}")

    try:
        from sqlalchemy import text

        query = text("""
            SELECT
                id,
                mpn,
                manufacturer,
                supplier_name,
                quality_score,
                storage_location,
                successful,
                needs_review,
                enrichment_timestamp,
                processing_time_ms,
                error_message
            FROM audit_enrichment_runs
            WHERE (:needs_review_only = FALSE OR needs_review = TRUE)
            ORDER BY enrichment_timestamp DESC
            LIMIT :limit
        """)

        result = db.execute(query, {
            'needs_review_only': needs_review_only,
            'limit': limit
        }).fetchall()

        runs = []
        for row in result:
            runs.append({
                'id': str(row.id),
                'mpn': row.mpn,
                'manufacturer': row.manufacturer,
                'supplier_name': row.supplier_name,
                'quality_score': float(row.quality_score) if row.quality_score else None,
                'storage_location': row.storage_location,
                'successful': row.successful,
                'needs_review': row.needs_review,
                'enrichment_timestamp': row.enrichment_timestamp.isoformat() if row.enrichment_timestamp else None,
                'processing_time_ms': row.processing_time_ms,
                'error_message': row.error_message,
            })

        return {
            'success': True,
            'count': len(runs),
            'runs': runs
        }

    except Exception as e:
        logger.error(f"Failed to get audit runs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get audit runs: {str(e)}")


@router.get("/audit-runs/{run_id}/field-comparisons", dependencies=[Depends(rate_limit_admin_endpoints)])
@require_role(Role.ADMIN)
async def get_field_comparisons(
    run_id: str,
    request: Request,
    changed_only: bool = Query(default=False, description="Only show changed fields"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get field-by-field comparison for an enrichment run

    **Authentication:** Requires ADMIN role
    **Rate Limit:** 120 requests/minute (authenticated), 60 requests/minute (unauthenticated)

    **Parameters:**
    - run_id: UUID of enrichment run
    - changed_only: Only show fields that changed during normalization

    **Returns:**
    - Field-by-field comparison of supplier vs normalized data
    """
    logger.info(f"[Admin] get_field_comparisons: user={auth.user_id} run_id={run_id}")

    # Validate run_id is a valid UUID
    try:
        UUID(run_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"run_id must be a valid UUID, got: {run_id}"
        )

    try:
        from sqlalchemy import text

        query = text("""
            SELECT
                field_name,
                field_category,
                supplier_value,
                normalized_value,
                changed,
                change_type,
                change_reason,
                confidence,
                supplier_data_quality
            FROM audit_field_comparisons
            WHERE enrichment_run_id = :run_id
              AND (:changed_only = FALSE OR changed = TRUE)
            ORDER BY field_category, field_name
        """)

        result = db.execute(query, {
            'run_id': run_id,
            'changed_only': changed_only
        }).fetchall()

        comparisons = []
        for row in result:
            comparisons.append({
                'field_name': row.field_name,
                'field_category': row.field_category,
                'supplier_value': row.supplier_value,
                'normalized_value': row.normalized_value,
                'changed': row.changed,
                'change_type': row.change_type,
                'change_reason': row.change_reason,
                'confidence': float(row.confidence) if row.confidence else None,
                'supplier_data_quality': row.supplier_data_quality,
            })

        return {
            'success': True,
            'run_id': run_id,
            'count': len(comparisons),
            'comparisons': comparisons
        }

    except Exception as e:
        logger.error(f"Failed to get field comparisons for {run_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get field comparisons: {str(e)}")


# ============================================================================
# ENDPOINTS: ENRICHMENT CONFIGURATION
# ============================================================================

class EnrichmentConfigUpdate(BaseModel):
    """Request to update enrichment configuration"""
    config_value: str = Field(..., description="New config value")
    updated_by: str = Field(default="admin", description="User making the change")
    change_reason: Optional[str] = Field(None, description="Reason for change")


@router.get("/enrichment-config", dependencies=[Depends(rate_limit_admin_endpoints)])
@require_role(Role.ADMIN)
async def get_all_enrichment_configs(
    request: Request,
    category: Optional[str] = Query(default=None, description="Filter by category (enrichment, quality, ai, performance, storage, audit)"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get all enrichment configuration settings

    **Authentication:** Requires ADMIN role
    **Rate Limit:** 120 requests/minute (authenticated), 60 requests/minute (unauthenticated)

    **Parameters:**
    - category: Optional filter by category

    **Returns:**
    - List of all enrichment config settings with metadata
    """
    logger.info(f"[Admin] get_all_enrichment_configs: user={auth.user_id} category={category}")

    try:
        from sqlalchemy import text

        if category:
            query = text("""
                SELECT
                    id,
                    config_key,
                    config_value,
                    value_type,
                    category,
                    description,
                    default_value,
                    min_value,
                    max_value,
                    requires_restart,
                    deprecated,
                    updated_at,
                    updated_by
                FROM cns_enrichment_config
                WHERE category = :category
                  AND deprecated = FALSE
                ORDER BY config_key
            """)
            result = db.execute(query, {'category': category}).fetchall()
        else:
            query = text("""
                SELECT
                    id,
                    config_key,
                    config_value,
                    value_type,
                    category,
                    description,
                    default_value,
                    min_value,
                    max_value,
                    requires_restart,
                    deprecated,
                    updated_at,
                    updated_by
                FROM cns_enrichment_config
                WHERE deprecated = FALSE
                ORDER BY category, config_key
            """)
            result = db.execute(query).fetchall()

        configs = []
        for row in result:
            configs.append({
                'id': str(row.id),
                'config_key': row.config_key,
                'config_value': row.config_value,
                'value_type': row.value_type,
                'category': row.category,
                'description': row.description,
                'default_value': row.default_value,
                'min_value': float(row.min_value) if row.min_value else None,
                'max_value': float(row.max_value) if row.max_value else None,
                'requires_restart': row.requires_restart,
                'deprecated': row.deprecated,
                'updated_at': row.updated_at.isoformat() if row.updated_at else None,
                'updated_by': row.updated_by,
            })

        return {
            'success': True,
            'count': len(configs),
            'configs': configs
        }

    except Exception as e:
        logger.error(f"Failed to get enrichment configs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get enrichment configs: {str(e)}")


@router.get("/enrichment-config/{config_key}", dependencies=[Depends(rate_limit_admin_endpoints)])
@require_role(Role.ADMIN)
async def get_enrichment_config_by_key(
    config_key: str,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get specific enrichment configuration by key

    **Authentication:** Requires ADMIN role
    **Rate Limit:** 120 requests/minute (authenticated), 60 requests/minute (unauthenticated)

    **Parameters:**
    - config_key: Configuration key (e.g., 'enrichment_batch_size')

    **Returns:**
    - Config details with metadata
    """
    logger.info(f"[Admin] get_enrichment_config_by_key: user={auth.user_id} key={config_key}")

    try:
        config_loader = get_enrichment_config(db)
        config_info = config_loader.get_config_info(config_key)

        if not config_info:
            raise HTTPException(status_code=404, detail=f"Config '{config_key}' not found")

        return {
            'success': True,
            'config': config_info
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get config '{config_key}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get config: {str(e)}")


@router.put("/enrichment-config/{config_key}", dependencies=[Depends(rate_limit_admin_endpoints)])
@require_role(Role.ADMIN)
async def update_enrichment_config(
    config_key: str,
    request: Request,
    update_request: EnrichmentConfigUpdate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Update enrichment configuration value

    **Authentication:** Requires ADMIN role
    **Rate Limit:** 120 requests/minute (authenticated), 60 requests/minute (unauthenticated)

    **Parameters:**
    - config_key: Configuration key to update
    - config_value: New value
    - updated_by: User making the change
    - change_reason: Reason for change (logged in history)

    **Returns:**
    - Success status and updated config
    """
    logger.info(f"[Admin] update_enrichment_config: user={auth.user_id} key={config_key}")

    try:
        config_loader = get_enrichment_config(db)

        # Update config
        success = config_loader.update(
            key=config_key,
            value=update_request.config_value,
            updated_by=update_request.updated_by,
            change_reason=update_request.change_reason
        )

        if not success:
            raise HTTPException(status_code=404, detail=f"Config '{config_key}' not found")

        # Invalidate global cache
        invalidate_global_config_cache()

        # Get updated config info
        config_info = config_loader.get_config_info(config_key)

        return {
            'success': True,
            'message': f"Config '{config_key}' updated successfully",
            'config': config_info,
            'requires_restart': config_info['requires_restart'] if config_info else False
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update config '{config_key}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update config: {str(e)}")


@router.get("/enrichment-config/{config_key}/history", dependencies=[Depends(rate_limit_admin_endpoints)])
@require_role(Role.ADMIN)
async def get_config_change_history(
    config_key: str,
    request: Request,
    limit: int = Query(default=10, ge=1, le=100, description="Max history entries to return"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Get change history for enrichment configuration

    **Authentication:** Requires ADMIN role
    **Rate Limit:** 120 requests/minute (authenticated), 60 requests/minute (unauthenticated)

    **Parameters:**
    - config_key: Configuration key
    - limit: Max history entries (1-100, default 10)

    **Returns:**
    - List of config changes with timestamps and reasons
    """
    logger.info(f"[Admin] get_config_change_history: user={auth.user_id} key={config_key}")

    try:
        config_loader = get_enrichment_config(db)
        history = config_loader.get_change_history(config_key, limit)

        return {
            'success': True,
            'config_key': config_key,
            'count': len(history),
            'history': history
        }

    except Exception as e:
        logger.error(f"Failed to get config history for '{config_key}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get config history: {str(e)}")


@router.post("/enrichment-config/invalidate-cache", dependencies=[Depends(rate_limit_admin_endpoints)])
@require_role(Role.ADMIN)
async def invalidate_config_cache(
    request: Request,
    auth: AuthContext = Depends(get_auth_context)
):
    """
    Invalidate enrichment config cache

    **Authentication:** Requires ADMIN role
    **Rate Limit:** 120 requests/minute (authenticated), 60 requests/minute (unauthenticated)

    **Use Case:**
    Force reload of config from database (useful after manual database changes)

    **Returns:**
    - Success status
    """
    logger.info(f"[Admin] invalidate_config_cache: user={auth.user_id}")

    try:
        invalidate_global_config_cache()

        return {
            'success': True,
            'message': 'Config cache invalidated successfully',
            'timestamp': datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to invalidate config cache: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to invalidate cache: {str(e)}")


# ============================================================================
# Directus artifact listing
# ============================================================================

@router.get("/artifacts", response_model=DirectusArtifactResponse, dependencies=[Depends(rate_limit_admin_endpoints)])
@require_role(Role.ADMIN)
async def list_directus_artifacts(
    bom_id: Optional[str] = Query(default=None, description="Filter by BOM ID"),
    organization_id: Optional[str] = Query(default=None, description="Filter by tenant ID"),
    artifact_kind: Optional[str] = Query(default=None, description="raw | parsed | audit"),
    limit: int = Query(default=50, ge=1, le=200),
    auth: AuthContext = Depends(get_auth_context)
):
    """List raw/parsed/audit Directus artifacts stored in S3 via CNS. Requires ADMIN role."""
    logger.info(f"[Admin] list_directus_artifacts: user={auth.user_id} org_filter={organization_id}")

    service = get_directus_file_service()
    if not service or not service.is_enabled():
        raise HTTPException(status_code=503, detail="Directus integration is not enabled")

    minio = get_minio_client()
    presign_expires = timedelta(minutes=10)
    expires_seconds = int(presign_expires.total_seconds())
    directus_base_url = settings.directus_public_url or settings.directus_url
    directus_base_url = directus_base_url.rstrip("/") if directus_base_url else None

    metadata_filters: Dict[str, str] = {}
    if bom_id:
        metadata_filters["bom_id"] = bom_id
    if organization_id:
        metadata_filters["organization_id"] = organization_id
    if artifact_kind:
        metadata_filters["artifact_kind"] = artifact_kind

    records = service.list_files(limit=limit, metadata_filters=metadata_filters or None)
    items: List[DirectusArtifact] = []
    for record in records:
        metadata = record.get("metadata") or {}
        download_url = None
        download_expires = None

        if directus_base_url:
            download_url = f"{directus_base_url}/assets/{record.get('id')}?download"
        elif minio and getattr(minio, "is_enabled", lambda: False)():
            bucket = metadata.get("source_bucket")
            object_key = metadata.get("source_key") or record.get("filename_disk")
            if bucket and object_key:
                download_url = minio.get_presigned_url(bucket, object_key, expires=presign_expires)
                download_expires = expires_seconds

        items.append(
            DirectusArtifact(
                id=str(record.get("id")),
                filename_disk=record.get("filename_disk"),
                filename_download=record.get("filename_download"),
                title=record.get("title"),
                description=record.get("description"),
                type=record.get("type"),
                metadata=metadata,
                created_on=record.get("created_on"),
                uploaded_on=record.get("uploaded_on"),
                download_url=download_url,
                download_expires_in=download_expires,
            )
        )

    return DirectusArtifactResponse(items=items, count=len(items))


# ============================================================================
# Import into main API router
# ============================================================================

# Add to app/api/__init__.py:
# from app.api.admin_directus import router as admin_directus_router
# app.include_router(admin_directus_router)
