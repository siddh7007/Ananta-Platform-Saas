"""
Scope Validation Module - Database-level FK Chain Validation

Validates multi-tenant scope hierarchy using FK relationships:
- Control Plane Tenant → Organization → Workspace → Project → BOM

This module provides the foundation for all scope validation in the CNS service.
All validation functions check the actual database FK constraints to ensure
data integrity and proper multi-tenant isolation.

Database Schema:
    organizations.control_plane_tenant_id → FK to Control Plane tenants (UUID)
    workspaces.organization_id → FK to organizations (UUID)
    projects.workspace_id → FK to workspaces (UUID)
    boms.project_id → FK to projects (UUID)
    boms.organization_id → Auto-populated by trigger from project hierarchy

Usage:
    from app.core.scope_validators import (
        validate_workspace_in_tenant,
        validate_project_in_workspace,
        validate_bom_in_project,
        validate_full_scope_chain
    )
    from app.models.base import get_db
    from fastapi import Depends

    @router.get("/boms/{bom_id}")
    async def get_bom(
        bom_id: str,
        db: Session = Depends(get_db),
        auth: AuthContext = Depends(get_auth_context)
    ):
        # Validate full chain
        validation = validate_full_scope_chain(
            db=db,
            tenant_id=auth.tenant_id,
            bom_id=bom_id
        )
        if not validation["valid"]:
            raise HTTPException(status_code=403, detail=validation["errors"])

        # Proceed with request
        return get_bom_data(bom_id)
"""

import logging
import threading
import uuid
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# =============================================================================
# Cache Configuration
# =============================================================================

# Validation results cache TTL (5 minutes)
VALIDATION_CACHE_TTL = timedelta(minutes=5)

# Maximum cache size to prevent unbounded memory growth
MAX_CACHE_SIZE = 10000

# Thread-safe cache for validation results (key: composite key, value: (result, timestamp))
# Using OrderedDict for LRU eviction when max size exceeded
_validation_cache: OrderedDict[str, Tuple[bool, datetime]] = OrderedDict()
_cache_lock = threading.Lock()


def _get_cached_validation(cache_key: str) -> Optional[bool]:
    """
    Get cached validation result if still valid (thread-safe).

    Args:
        cache_key: Composite cache key

    Returns:
        Cached boolean result, or None if expired/not found
    """
    with _cache_lock:
        if cache_key in _validation_cache:
            result, timestamp = _validation_cache[cache_key]
            # Use timezone-aware datetime
            if datetime.now(timezone.utc) - timestamp < VALIDATION_CACHE_TTL:
                logger.debug(f"Cache hit for validation: {cache_key}")
                return result
            else:
                # Expired, remove from cache
                del _validation_cache[cache_key]
                logger.debug(f"Cache expired for validation: {cache_key}")
    return None


def _set_cached_validation(cache_key: str, result: bool):
    """
    Cache validation result with LRU eviction (thread-safe).

    Args:
        cache_key: Composite cache key
        result: Boolean validation result
    """
    with _cache_lock:
        _validation_cache[cache_key] = (result, datetime.now(timezone.utc))

        # Evict oldest entries if cache exceeds max size
        if len(_validation_cache) > MAX_CACHE_SIZE:
            # Remove oldest 10% of entries
            evict_count = MAX_CACHE_SIZE // 10
            for _ in range(evict_count):
                _validation_cache.popitem(last=False)  # Remove oldest (FIFO)
            logger.info(f"Cache size exceeded {MAX_CACHE_SIZE}, evicted {evict_count} oldest entries")

        logger.debug(f"Cached validation result: {cache_key} = {result}")


def clear_validation_cache():
    """
    Clear all cached validation results (thread-safe).

    Useful for testing or when data changes require cache invalidation.
    """
    with _cache_lock:
        _validation_cache.clear()
        logger.info("Validation cache cleared")


# =============================================================================
# UUID Validation Helper
# =============================================================================

def _validate_uuid(value: str, param_name: str) -> None:
    """
    Validate UUID format.

    Args:
        value: String to validate as UUID
        param_name: Parameter name for error message

    Raises:
        ValueError: If value is not a valid UUID format

    Security Note:
        While parameterized queries prevent SQL injection, validating UUIDs
        upfront provides clearer error messages and prevents unnecessary
        database queries for malformed inputs.
    """
    try:
        uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        raise ValueError(f"Invalid UUID format for {param_name}: {value}")


# =============================================================================
# Individual Scope Validators
# =============================================================================

def validate_workspace_in_tenant(
    db: Session,
    workspace_id: str,
    tenant_id: str,
) -> bool:
    """
    Validate workspace belongs to tenant via FK chain.

    Query:
        SELECT 1 FROM workspaces w
        JOIN organizations o ON w.organization_id = o.id
        WHERE w.id = :workspace_id
        AND o.control_plane_tenant_id = :tenant_id

    Args:
        db: SQLAlchemy database session
        workspace_id: Workspace UUID
        tenant_id: Control Plane tenant UUID

    Returns:
        True if workspace belongs to tenant, False otherwise
    """
    # Validate UUID format first
    try:
        _validate_uuid(workspace_id, "workspace_id")
        _validate_uuid(tenant_id, "tenant_id")
    except ValueError as e:
        logger.warning(f"UUID validation failed: {e}")
        return False

    # Check cache
    cache_key = f"workspace:{workspace_id}:tenant:{tenant_id}"
    cached_result = _get_cached_validation(cache_key)
    if cached_result is not None:
        return cached_result

    try:
        # SECURITY: Uses parameterized queries - workspace_id/tenant_id are safely escaped
        query = text("""
            SELECT 1 FROM workspaces w
            JOIN organizations o ON w.organization_id = o.id
            WHERE w.id = :workspace_id
            AND o.control_plane_tenant_id = :tenant_id
            LIMIT 1
        """)

        result = db.execute(query, {
            "workspace_id": workspace_id,
            "tenant_id": tenant_id
        }).fetchone()

        is_valid = result is not None

        if not is_valid:
            logger.warning(
                f"Workspace validation failed: workspace_id={workspace_id} "
                f"not in tenant_id={tenant_id}"
            )
        else:
            logger.debug(
                f"Workspace validation passed: workspace_id={workspace_id} "
                f"in tenant_id={tenant_id}"
            )

        # Cache result
        _set_cached_validation(cache_key, is_valid)

        return is_valid

    except Exception as e:
        logger.error(
            f"Error validating workspace in tenant: {e}",
            exc_info=True,
            extra={
                "workspace_id": workspace_id,
                "tenant_id": tenant_id,
                "error_type": type(e).__name__
            }
        )
        return False


def validate_project_in_workspace(
    db: Session,
    project_id: str,
    workspace_id: str,
) -> bool:
    """
    Validate project belongs to workspace via FK.

    Query:
        SELECT 1 FROM projects
        WHERE id = :project_id
        AND workspace_id = :workspace_id

    Args:
        db: SQLAlchemy database session
        project_id: Project UUID
        workspace_id: Workspace UUID

    Returns:
        True if project belongs to workspace, False otherwise
    """
    # Validate UUID format first
    try:
        _validate_uuid(project_id, "project_id")
        _validate_uuid(workspace_id, "workspace_id")
    except ValueError as e:
        logger.warning(f"UUID validation failed: {e}")
        return False

    # Check cache
    cache_key = f"project:{project_id}:workspace:{workspace_id}"
    cached_result = _get_cached_validation(cache_key)
    if cached_result is not None:
        return cached_result

    try:
        # SECURITY: Uses parameterized queries - IDs are safely escaped
        query = text("""
            SELECT 1 FROM projects
            WHERE id = :project_id
            AND workspace_id = :workspace_id
            LIMIT 1
        """)

        result = db.execute(query, {
            "project_id": project_id,
            "workspace_id": workspace_id
        }).fetchone()

        is_valid = result is not None

        if not is_valid:
            logger.warning(
                f"Project validation failed: project_id={project_id} "
                f"not in workspace_id={workspace_id}"
            )
        else:
            logger.debug(
                f"Project validation passed: project_id={project_id} "
                f"in workspace_id={workspace_id}"
            )

        # Cache result
        _set_cached_validation(cache_key, is_valid)

        return is_valid

    except Exception as e:
        logger.error(
            f"Error validating project in workspace: {e}",
            exc_info=True,
            extra={
                "project_id": project_id,
                "workspace_id": workspace_id,
                "error_type": type(e).__name__
            }
        )
        return False


def validate_bom_in_project(
    db: Session,
    bom_id: str,
    project_id: str,
) -> bool:
    """
    Validate BOM belongs to project via FK.

    Query:
        SELECT 1 FROM boms
        WHERE id = :bom_id
        AND project_id = :project_id

    Args:
        db: SQLAlchemy database session
        bom_id: BOM UUID
        project_id: Project UUID

    Returns:
        True if BOM belongs to project, False otherwise
    """
    # Validate UUID format first
    try:
        _validate_uuid(bom_id, "bom_id")
        _validate_uuid(project_id, "project_id")
    except ValueError as e:
        logger.warning(f"UUID validation failed: {e}")
        return False

    # Check cache
    cache_key = f"bom:{bom_id}:project:{project_id}"
    cached_result = _get_cached_validation(cache_key)
    if cached_result is not None:
        return cached_result

    try:
        # SECURITY: Uses parameterized queries - IDs are safely escaped
        query = text("""
            SELECT 1 FROM boms
            WHERE id = :bom_id
            AND project_id = :project_id
            LIMIT 1
        """)

        result = db.execute(query, {
            "bom_id": bom_id,
            "project_id": project_id
        }).fetchone()

        is_valid = result is not None

        if not is_valid:
            logger.warning(
                f"BOM validation failed: bom_id={bom_id} "
                f"not in project_id={project_id}"
            )
        else:
            logger.debug(
                f"BOM validation passed: bom_id={bom_id} "
                f"in project_id={project_id}"
            )

        # Cache result
        _set_cached_validation(cache_key, is_valid)

        return is_valid

    except Exception as e:
        logger.error(
            f"Error validating BOM in project: {e}",
            exc_info=True,
            extra={
                "bom_id": bom_id,
                "project_id": project_id,
                "error_type": type(e).__name__
            }
        )
        return False


# =============================================================================
# Full Chain Validator
# =============================================================================

def validate_full_scope_chain(
    db: Session,
    tenant_id: str,
    workspace_id: Optional[str] = None,
    project_id: Optional[str] = None,
    bom_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Validate entire scope chain from tenant down to BOM.

    Validates the complete hierarchy:
    1. If workspace_id provided: workspace must belong to tenant
    2. If project_id provided: project must belong to workspace (and workspace to tenant)
    3. If bom_id provided: BOM must belong to project (and full chain above)

    Args:
        db: SQLAlchemy database session
        tenant_id: Control Plane tenant UUID (required)
        workspace_id: Workspace UUID (optional)
        project_id: Project UUID (optional)
        bom_id: BOM UUID (optional)

    Returns:
        Dict with validation results:
        {
            "valid": bool,  # Overall validation result
            "tenant_id": str,
            "workspace_valid": bool | None,
            "project_valid": bool | None,
            "bom_valid": bool | None,
            "errors": List[str]  # List of validation error messages
        }

    Examples:
        # Validate BOM access
        >>> result = validate_full_scope_chain(
        ...     db=db,
        ...     tenant_id="123e4567-e89b-12d3-a456-426614174000",
        ...     bom_id="123e4567-e89b-12d3-a456-426614174999"
        ... )
        >>> if not result["valid"]:
        ...     raise HTTPException(status_code=403, detail=result["errors"])

        # Validate workspace access
        >>> result = validate_full_scope_chain(
        ...     db=db,
        ...     tenant_id="123e4567-e89b-12d3-a456-426614174000",
        ...     workspace_id="123e4567-e89b-12d3-a456-426614174001"
        ... )
    """
    errors = []
    validation_result = {
        "valid": True,
        "tenant_id": tenant_id,
        "workspace_valid": None,
        "project_valid": None,
        "bom_valid": None,
        "errors": errors
    }

    # Super admin check: None tenant_id means super admin with access to all resources
    # However, resources must still EXIST to prevent NoneType errors downstream
    if tenant_id is None:
        # Determine resource type for logging
        if bom_id:
            resource_type = "bom"
            resource_id = bom_id
        elif project_id:
            resource_type = "project"
            resource_id = project_id
        elif workspace_id:
            resource_type = "workspace"
            resource_id = workspace_id
        else:
            resource_type = "tenant_only"
            resource_id = "N/A"

        logger.warning(
            f"[SECURITY] Super admin scope bypass: "
            f"resource_type={resource_type} resource_id={resource_id} "
            f"operation=checking_resource_existence"
        )

        # SECURITY FIX: Verify resources actually exist (prevent 500 errors from non-existent UUIDs)
        try:
            # Check BOM exists
            if bom_id:
                query = text("SELECT EXISTS(SELECT 1 FROM boms WHERE id = :bom_id)")
                result = db.execute(query, {"bom_id": bom_id}).scalar()
                if not result:
                    errors.append(f"BOM not found: {bom_id}")
                    validation_result["valid"] = False
                    validation_result["bom_valid"] = False
                    logger.warning(
                        f"[SECURITY] Super admin attempted access to non-existent BOM: {bom_id}"
                    )
                    return validation_result
                validation_result["bom_valid"] = True

            # Check Project exists
            if project_id:
                query = text("SELECT EXISTS(SELECT 1 FROM projects WHERE id = :project_id)")
                result = db.execute(query, {"project_id": project_id}).scalar()
                if not result:
                    errors.append(f"Project not found: {project_id}")
                    validation_result["valid"] = False
                    validation_result["project_valid"] = False
                    logger.warning(
                        f"[SECURITY] Super admin attempted access to non-existent Project: {project_id}"
                    )
                    return validation_result
                validation_result["project_valid"] = True

            # Check Workspace exists
            if workspace_id:
                query = text("SELECT EXISTS(SELECT 1 FROM workspaces WHERE id = :workspace_id)")
                result = db.execute(query, {"workspace_id": workspace_id}).scalar()
                if not result:
                    errors.append(f"Workspace not found: {workspace_id}")
                    validation_result["valid"] = False
                    validation_result["workspace_valid"] = False
                    logger.warning(
                        f"[SECURITY] Super admin attempted access to non-existent Workspace: {workspace_id}"
                    )
                    return validation_result
                validation_result["workspace_valid"] = True

        except Exception as e:
            logger.error(
                f"Error validating super admin resource existence: {e}",
                exc_info=True,
                extra={
                    "bom_id": bom_id,
                    "project_id": project_id,
                    "workspace_id": workspace_id,
                    "error_type": type(e).__name__
                }
            )
            errors.append(f"Database error during super admin validation: {type(e).__name__}")
            validation_result["valid"] = False
            return validation_result

        # All resources exist, super admin has access
        validation_result["valid"] = True
        logger.info(
            f"[SECURITY] Super admin scope validation passed: "
            f"resource_type={resource_type} resource_id={resource_id} "
            f"operation=full_access_granted"
        )
        return validation_result

    # Validate tenant_id is provided (for non-super-admin users)
    if not tenant_id:
        errors.append("tenant_id is required")
        validation_result["valid"] = False
        return validation_result

    # Validate UUID formats for all provided IDs
    try:
        _validate_uuid(tenant_id, "tenant_id")
        if workspace_id:
            _validate_uuid(workspace_id, "workspace_id")
        if project_id:
            _validate_uuid(project_id, "project_id")
        if bom_id:
            _validate_uuid(bom_id, "bom_id")
    except ValueError as e:
        errors.append(str(e))
        validation_result["valid"] = False
        return validation_result

    # If BOM is provided, we need to validate the entire chain
    if bom_id:
        # First, fetch the BOM and its project_id
        try:
            query = text("""
                SELECT
                    b.project_id,
                    p.workspace_id,
                    w.organization_id,
                    o.control_plane_tenant_id
                FROM boms b
                JOIN projects p ON b.project_id = p.id
                JOIN workspaces w ON p.workspace_id = w.id
                JOIN organizations o ON w.organization_id = o.id
                WHERE b.id = :bom_id
                LIMIT 1
            """)

            result = db.execute(query, {"bom_id": bom_id}).fetchone()

            if not result:
                errors.append(f"BOM not found: {bom_id}")
                validation_result["valid"] = False
                validation_result["bom_valid"] = False
                return validation_result

            # Extract IDs from the chain
            fetched_project_id = str(result[0])
            fetched_workspace_id = str(result[1])
            fetched_organization_id = str(result[2])
            fetched_tenant_id = str(result[3])

            # Validate tenant matches
            if fetched_tenant_id != tenant_id:
                errors.append(
                    f"BOM {bom_id} does not belong to tenant {tenant_id} "
                    f"(belongs to {fetched_tenant_id})"
                )
                validation_result["valid"] = False
                validation_result["bom_valid"] = False
            else:
                validation_result["bom_valid"] = True
                logger.debug(
                    f"Full BOM chain validated: bom_id={bom_id}, "
                    f"project_id={fetched_project_id}, "
                    f"workspace_id={fetched_workspace_id}, "
                    f"tenant_id={tenant_id}"
                )

            # If specific project_id or workspace_id was provided, validate they match
            if project_id and fetched_project_id != project_id:
                errors.append(
                    f"BOM {bom_id} belongs to project {fetched_project_id}, "
                    f"not {project_id}"
                )
                validation_result["valid"] = False
                validation_result["project_valid"] = False
            elif project_id:
                validation_result["project_valid"] = True

            if workspace_id and fetched_workspace_id != workspace_id:
                errors.append(
                    f"BOM {bom_id} belongs to workspace {fetched_workspace_id}, "
                    f"not {workspace_id}"
                )
                validation_result["valid"] = False
                validation_result["workspace_valid"] = False
            elif workspace_id:
                validation_result["workspace_valid"] = True

        except Exception as e:
            logger.error(
                f"Error validating BOM chain: {e}",
                exc_info=True,
                extra={
                    "bom_id": bom_id,
                    "tenant_id": tenant_id,
                    "error_type": type(e).__name__
                }
            )
            errors.append(f"Database error during BOM validation: {type(e).__name__}")
            validation_result["valid"] = False
            validation_result["bom_valid"] = False

        return validation_result

    # If project_id is provided (without BOM), validate project → workspace → tenant
    if project_id:
        try:
            query = text("""
                SELECT
                    p.workspace_id,
                    w.organization_id,
                    o.control_plane_tenant_id
                FROM projects p
                JOIN workspaces w ON p.workspace_id = w.id
                JOIN organizations o ON w.organization_id = o.id
                WHERE p.id = :project_id
                LIMIT 1
            """)

            result = db.execute(query, {"project_id": project_id}).fetchone()

            if not result:
                errors.append(f"Project not found: {project_id}")
                validation_result["valid"] = False
                validation_result["project_valid"] = False
                return validation_result

            fetched_workspace_id = str(result[0])
            fetched_organization_id = str(result[1])
            fetched_tenant_id = str(result[2])

            # Validate tenant matches
            if fetched_tenant_id != tenant_id:
                errors.append(
                    f"Project {project_id} does not belong to tenant {tenant_id} "
                    f"(belongs to {fetched_tenant_id})"
                )
                validation_result["valid"] = False
                validation_result["project_valid"] = False
            else:
                validation_result["project_valid"] = True
                logger.debug(
                    f"Project chain validated: project_id={project_id}, "
                    f"workspace_id={fetched_workspace_id}, "
                    f"tenant_id={tenant_id}"
                )

            # If specific workspace_id was provided, validate it matches
            if workspace_id and fetched_workspace_id != workspace_id:
                errors.append(
                    f"Project {project_id} belongs to workspace {fetched_workspace_id}, "
                    f"not {workspace_id}"
                )
                validation_result["valid"] = False
                validation_result["workspace_valid"] = False
            elif workspace_id:
                validation_result["workspace_valid"] = True

        except Exception as e:
            logger.error(
                f"Error validating project chain: {e}",
                exc_info=True,
                extra={
                    "project_id": project_id,
                    "tenant_id": tenant_id,
                    "error_type": type(e).__name__
                }
            )
            errors.append(f"Database error during project validation: {type(e).__name__}")
            validation_result["valid"] = False
            validation_result["project_valid"] = False

        return validation_result

    # If only workspace_id is provided, validate workspace → tenant
    if workspace_id:
        is_valid = validate_workspace_in_tenant(
            db=db,
            workspace_id=workspace_id,
            tenant_id=tenant_id
        )

        validation_result["workspace_valid"] = is_valid

        if not is_valid:
            errors.append(
                f"Workspace {workspace_id} does not belong to tenant {tenant_id}"
            )
            validation_result["valid"] = False

        return validation_result

    # If only tenant_id is provided, just validate it exists
    try:
        query = text("""
            SELECT 1 FROM organizations
            WHERE control_plane_tenant_id = :tenant_id
            LIMIT 1
        """)

        result = db.execute(query, {"tenant_id": tenant_id}).fetchone()

        if not result:
            errors.append(f"No organization found for tenant {tenant_id}")
            validation_result["valid"] = False
        else:
            logger.debug(f"Tenant validation passed: tenant_id={tenant_id}")

    except Exception as e:
        logger.error(
            f"Error validating tenant: {e}",
            exc_info=True,
            extra={
                "tenant_id": tenant_id,
                "error_type": type(e).__name__
            }
        )
        errors.append(f"Database error during tenant validation: {type(e).__name__}")
        validation_result["valid"] = False

    return validation_result


# =============================================================================
# Convenience Functions
# =============================================================================

def get_bom_hierarchy(db: Session, bom_id: str) -> Optional[Dict[str, str]]:
    """
    Get complete hierarchy IDs for a BOM.

    Args:
        db: SQLAlchemy database session
        bom_id: BOM UUID

    Returns:
        Dict with all IDs in hierarchy, or None if BOM not found:
        {
            "bom_id": str,
            "project_id": str,
            "workspace_id": str,
            "organization_id": str,
            "tenant_id": str
        }
    """
    try:
        query = text("""
            SELECT
                b.id as bom_id,
                b.project_id,
                p.workspace_id,
                w.organization_id,
                o.control_plane_tenant_id as tenant_id
            FROM boms b
            JOIN projects p ON b.project_id = p.id
            JOIN workspaces w ON p.workspace_id = w.id
            JOIN organizations o ON w.organization_id = o.id
            WHERE b.id = :bom_id
            LIMIT 1
        """)

        result = db.execute(query, {"bom_id": bom_id}).fetchone()

        if not result:
            logger.warning(f"BOM not found: {bom_id}")
            return None

        hierarchy = {
            "bom_id": str(result[0]),
            "project_id": str(result[1]),
            "workspace_id": str(result[2]),
            "organization_id": str(result[3]),
            "tenant_id": str(result[4])
        }

        logger.debug(f"BOM hierarchy fetched: {hierarchy}")
        return hierarchy

    except Exception as e:
        logger.error(
            f"Error fetching BOM hierarchy: {e}",
            exc_info=True,
            extra={
                "bom_id": bom_id,
                "error_type": type(e).__name__
            }
        )
        return None


def get_project_hierarchy(db: Session, project_id: str) -> Optional[Dict[str, str]]:
    """
    Get complete hierarchy IDs for a project.

    Args:
        db: SQLAlchemy database session
        project_id: Project UUID

    Returns:
        Dict with all IDs in hierarchy, or None if project not found:
        {
            "project_id": str,
            "workspace_id": str,
            "organization_id": str,
            "tenant_id": str
        }
    """
    try:
        query = text("""
            SELECT
                p.id as project_id,
                p.workspace_id,
                w.organization_id,
                o.control_plane_tenant_id as tenant_id
            FROM projects p
            JOIN workspaces w ON p.workspace_id = w.id
            JOIN organizations o ON w.organization_id = o.id
            WHERE p.id = :project_id
            LIMIT 1
        """)

        result = db.execute(query, {"project_id": project_id}).fetchone()

        if not result:
            logger.warning(f"Project not found: {project_id}")
            return None

        hierarchy = {
            "project_id": str(result[0]),
            "workspace_id": str(result[1]),
            "organization_id": str(result[2]),
            "tenant_id": str(result[3])
        }

        logger.debug(f"Project hierarchy fetched: {hierarchy}")
        return hierarchy

    except Exception as e:
        logger.error(
            f"Error fetching project hierarchy: {e}",
            exc_info=True,
            extra={
                "project_id": project_id,
                "error_type": type(e).__name__
            }
        )
        return None
