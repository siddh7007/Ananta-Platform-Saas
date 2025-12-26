"""
Scope Validation Decorators for FastAPI Endpoints

Provides Python decorators to enforce scope validation on endpoints:
- @require_workspace - Validates workspace access
- @require_project - Validates project access
- @staff_can_cross_scope - Allows super_admin to bypass scope checks

These decorators wrap endpoint functions and inject validated scope context
into request.state for downstream use.

Usage:
    from app.core.scope_decorators import require_workspace, require_project
    from fastapi import APIRouter, Request, Depends
    from app.auth.dependencies import get_current_user, User
    from app.models.dual_database import get_dual_database

    router = APIRouter()

    @router.get("/workspaces/{workspace_id}/stats")
    @require_workspace(enforce=True, log_access=True)
    async def get_workspace_stats(
        workspace_id: str,
        request: Request,
        user: User = Depends(get_current_user)
    ):
        # workspace_id already validated against user's tenant
        scope = request.state.validated_scope
        # scope = {"tenant_id": "...", "workspace_id": "..."}
        return {"workspace_id": workspace_id, "stats": {...}}

    @router.get("/projects/{project_id}/boms")
    @require_project(enforce=True)
    async def list_boms(
        project_id: str,
        request: Request,
        user: User = Depends(get_current_user)
    ):
        # Full chain validated: tenant → org → workspace → project
        scope = request.state.validated_scope
        # scope = {"tenant_id": "...", "workspace_id": "...", "project_id": "..."}
        return get_boms_for_project(project_id)
"""

import logging
import functools
from typing import Callable, Optional, Dict, Any
from datetime import datetime

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from .scope_validators import (
    validate_workspace_in_tenant,
    validate_project_in_workspace,
    validate_full_scope_chain,
)
from .auth_utils import (
    get_tenant_id_from_auth_context,
    get_user_id_from_auth_context,
    is_staff_user,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Helper Functions
# =============================================================================

# Convenience aliases for backward compatibility with existing code
_get_tenant_id_from_auth = get_tenant_id_from_auth_context
_is_staff_user = is_staff_user
_get_user_id_from_auth = get_user_id_from_auth_context


def _log_scope_access(
    user_id: str,
    endpoint: str,
    scope: Dict[str, str],
    action: str = "access",
    db: Optional[Session] = None,
):
    """
    Log scope access for audit trail.

    Args:
        user_id: User UUID
        endpoint: Endpoint path
        scope: Validated scope dict
        action: Action type (access, cross_scope, etc.)
        db: Database session (optional, for writing to audit_logs table)
    """
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
        "endpoint": endpoint,
        "action": action,
        "scope": scope,
    }

    logger.info(
        f"[SCOPE_ACCESS] user={user_id} endpoint={endpoint} "
        f"action={action} scope={scope}"
    )

    # TODO: Write to audit_logs table if db session provided and table exists
    # This would require checking if audit_logs table exists first
    if db:
        try:
            # Placeholder for future audit logging to DB
            # Would need to verify audit_logs table schema first
            pass
        except Exception as e:
            logger.warning(f"Failed to write audit log to database: {e}")


# =============================================================================
# Workspace Scope Decorator
# =============================================================================

def require_workspace(enforce: bool = True, log_access: bool = True):
    """
    Decorator to require workspace context for endpoint.

    Validates that the workspace_id in the URL path belongs to the user's tenant.
    Sets request.state.validated_scope with validated IDs.

    Args:
        enforce: If False, log violations but don't block (warning mode)
        log_access: If True, write to audit logs

    Required Function Parameters:
        workspace_id: str - Path parameter for workspace UUID
        request: Request - FastAPI request object
        db: Session - Database session from Depends(get_supabase_session)
        user: User - Authenticated user from Depends(get_current_user)

    Usage:
        @router.get("/workspaces/{workspace_id}/stats")
        @require_workspace(enforce=True)
        async def get_workspace_stats(
            workspace_id: str,
            request: Request,
            db: Session = Depends(get_supabase_session),
            user: User = Depends(get_current_user)
        ):
            scope = request.state.validated_scope
            # scope = {"tenant_id": "...", "workspace_id": "..."}
            return {"stats": {...}}

    Raises:
        HTTPException(400): Missing workspace_id parameter
        HTTPException(403): Workspace not in tenant (only if enforce=True)
        HTTPException(500): Missing required function parameters
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract dependencies from kwargs
            request: Optional[Request] = kwargs.get("request")
            db: Optional[Session] = kwargs.get("db")

            # Try to get auth from request.state.auth_context first (set by auth middleware)
            # This is the authoritative source with correct organization_id
            # Fall back to function parameters if not available
            auth = None
            if request and hasattr(request, "state") and hasattr(request.state, "auth_context"):
                auth = request.state.auth_context
            if not auth:
                auth = kwargs.get("auth") or kwargs.get("user") or kwargs.get("context")

            # Validate we have required dependencies
            if not request:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Decorator requires 'request: Request' parameter"
                )

            if not db:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Decorator requires 'db: Session' parameter"
                )

            if not auth:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Decorator requires auth context parameter (user/auth/context)"
                )

            # Extract workspace_id from kwargs (path parameter)
            workspace_id: Optional[str] = kwargs.get("workspace_id")

            if not workspace_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="workspace_id required in URL path"
                )

            # Get tenant_id from auth context
            tenant_id = _get_tenant_id_from_auth(auth)

            # Build scope context
            scope = {
                "tenant_id": tenant_id,
                "workspace_id": workspace_id,
            }

            # Check if staff bypass is active (from @staff_can_cross_scope decorator)
            if hasattr(request.state, "is_staff_override") and request.state.is_staff_override:
                logger.info(
                    f"[STAFF_BYPASS] Skipping workspace validation for staff user "
                    f"(workspace_id={workspace_id}, tenant_id={tenant_id})"
                )
                # Set validated scope and proceed without validation
                request.state.validated_scope = scope
                return await func(*args, **kwargs)

            # Validate workspace belongs to tenant (normal flow)
            is_valid = validate_workspace_in_tenant(
                db=db,
                workspace_id=workspace_id,
                tenant_id=tenant_id,
            )

            # Log access if enabled
            if log_access:
                user_id = getattr(auth, "id", "unknown")
                _log_scope_access(
                    user_id=user_id,
                    endpoint=request.url.path,
                    scope=scope,
                    action="workspace_access",
                    db=db,
                )

            # Handle validation failure
            if not is_valid:
                error_msg = (
                    f"Workspace {workspace_id} does not belong to tenant {tenant_id}"
                )

                if enforce:
                    logger.warning(f"[SCOPE_VIOLATION] {error_msg}")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=error_msg
                    )
                else:
                    # Warning mode - log but allow
                    logger.warning(f"[SCOPE_WARNING] {error_msg} (enforcement disabled)")

            # Set validated scope in request state
            request.state.validated_scope = scope

            # Call original function
            return await func(*args, **kwargs)

        return wrapper
    return decorator


# =============================================================================
# Project Scope Decorator
# =============================================================================

def require_project(enforce: bool = True, log_access: bool = True):
    """
    Decorator to require project context for endpoint.

    Validates the full chain:
    - project_id belongs to workspace
    - workspace belongs to organization
    - organization belongs to tenant

    Args:
        enforce: If False, log violations but don't block
        log_access: If True, write to audit logs

    Required Function Parameters:
        project_id: str - Path parameter for project UUID
        request: Request - FastAPI request object
        db: Session - Database session from Depends(get_supabase_session)
        user: User - Authenticated user from Depends(get_current_user)

    Usage:
        @router.get("/projects/{project_id}/boms")
        @require_project(enforce=True)
        async def list_boms(
            project_id: str,
            request: Request,
            db: Session = Depends(get_supabase_session),
            user: User = Depends(get_current_user)
        ):
            scope = request.state.validated_scope
            # scope = {"tenant_id": "...", "workspace_id": "...", "project_id": "..."}
            return get_boms(project_id)

    Raises:
        HTTPException(400): Missing project_id parameter
        HTTPException(403): Project not in tenant's scope (only if enforce=True)
        HTTPException(500): Missing required function parameters
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract dependencies
            request: Optional[Request] = kwargs.get("request")
            db: Optional[Session] = kwargs.get("db")

            # Try to get auth from request.state.auth_context first (set by auth middleware)
            # This is the authoritative source with correct organization_id
            # Fall back to function parameters if not available
            auth = None
            if request and hasattr(request, "state") and hasattr(request.state, "auth_context"):
                auth = request.state.auth_context
            if not auth:
                auth = kwargs.get("auth") or kwargs.get("user") or kwargs.get("context")

            # Validate dependencies
            if not request or not db or not auth:
                missing = []
                if not request:
                    missing.append("request")
                if not db:
                    missing.append("db")
                if not auth:
                    missing.append("auth/user/context")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Decorator requires parameters: {', '.join(missing)}"
                )

            # Extract project_id from kwargs
            project_id: Optional[str] = kwargs.get("project_id")

            if not project_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="project_id required in URL path"
                )

            # Get tenant_id
            tenant_id = _get_tenant_id_from_auth(auth)

            # Build initial scope context (workspace_id will be populated if validation succeeds)
            scope = {
                "tenant_id": tenant_id,
                "workspace_id": None,  # Will be populated later
                "project_id": project_id,
            }

            # Check if staff bypass is active (from @staff_can_cross_scope decorator)
            if hasattr(request.state, "is_staff_override") and request.state.is_staff_override:
                logger.info(
                    f"[STAFF_BYPASS] Skipping project validation for staff user "
                    f"(project_id={project_id}, tenant_id={tenant_id})"
                )
                # Still fetch workspace_id for completeness
                from sqlalchemy import text
                result = db.execute(
                    text("SELECT workspace_id FROM projects WHERE id = :project_id"),
                    {"project_id": project_id}
                ).fetchone()
                if result:
                    scope["workspace_id"] = str(result[0])

                # Set validated scope and proceed without validation
                request.state.validated_scope = scope
                return await func(*args, **kwargs)

            # Validate full scope chain using the validator (normal flow)
            # This will validate: project → workspace → org → tenant
            validation_result = validate_full_scope_chain(
                db=db,
                tenant_id=tenant_id,
                project_id=project_id,
            )

            is_valid = validation_result["valid"]
            errors = validation_result.get("errors", [])

            # Extract workspace_id from validation result if available
            # We need to query it since validate_full_scope_chain doesn't return it
            if is_valid:
                from sqlalchemy import text
                result = db.execute(
                    text("SELECT workspace_id FROM projects WHERE id = :project_id"),
                    {"project_id": project_id}
                ).fetchone()
                if result:
                    scope["workspace_id"] = str(result[0])

            # Log access
            if log_access:
                user_id = getattr(auth, "id", "unknown")
                _log_scope_access(
                    user_id=user_id,
                    endpoint=request.url.path,
                    scope=scope,
                    action="project_access",
                    db=db,
                )

            # Handle validation failure
            if not is_valid:
                error_msg = f"Project {project_id} access denied: {', '.join(errors)}"

                if enforce:
                    logger.warning(f"[SCOPE_VIOLATION] {error_msg}")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=error_msg
                    )
                else:
                    logger.warning(f"[SCOPE_WARNING] {error_msg} (enforcement disabled)")

            # Set validated scope
            request.state.validated_scope = scope

            # Call original function
            return await func(*args, **kwargs)

        return wrapper
    return decorator


# =============================================================================
# Staff Cross-Scope Decorator
# =============================================================================

def staff_can_cross_scope(func: Callable) -> Callable:
    """
    Decorator to allow staff/super_admin to bypass scope validation.

    Checks if user has super_admin/platform_admin privileges. If yes,
    allows the request without scope validation. Logs all cross-scope
    access for compliance auditing.

    Usage:
        @router.get("/admin/all-boms")
        @staff_can_cross_scope
        async def list_all_boms(
            request: Request,
            user: User = Depends(get_current_user)
        ):
            # Staff can access BOMs across all tenants
            # request.state.is_staff_override = True if bypassed
            return get_all_boms()

    Note:
        This decorator should be used BEFORE any scope validation decorators
        to allow staff to bypass them:

        @router.get("/workspaces/{workspace_id}/stats")
        @staff_can_cross_scope
        @require_workspace(enforce=True)
        async def get_stats(...):
            ...
    """
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        # Extract dependencies
        request: Optional[Request] = kwargs.get("request")

        # Try to get auth from request.state.auth_context first (set by auth middleware)
        # This is the authoritative source with correct organization_id
        # Fall back to function parameters if not available
        auth = None
        if request and hasattr(request, "state") and hasattr(request.state, "auth_context"):
            auth = request.state.auth_context
        if not auth:
            auth = kwargs.get("auth") or kwargs.get("user") or kwargs.get("context")

        if not request or not auth:
            # If dependencies not available, just pass through
            # (let the original function handle validation)
            return await func(*args, **kwargs)

        # Check if user is staff
        is_staff = _is_staff_user(auth)

        if is_staff:
            # Set flag in request state to indicate staff override
            request.state.is_staff_override = True

            # Log cross-scope access
            user_id = getattr(auth, "id", "unknown")
            logger.warning(
                f"[CROSS_SCOPE_ACCESS] Staff user {user_id} accessing "
                f"{request.url.path} with scope bypass"
            )

            # Log to audit trail
            db = kwargs.get("db")
            if db:
                _log_scope_access(
                    user_id=user_id,
                    endpoint=request.url.path,
                    scope={"staff_override": True},
                    action="cross_scope_access",
                    db=db,
                )

        # Call original function (staff or not)
        return await func(*args, **kwargs)

    return wrapper


# =============================================================================
# BOM Scope Decorator (Full Chain Validation)
# =============================================================================

def require_bom(enforce: bool = True, log_access: bool = True):
    """
    Decorator to require BOM context with full chain validation.

    Validates the complete hierarchy:
    - bom_id belongs to project
    - project belongs to workspace
    - workspace belongs to organization
    - organization belongs to tenant

    Args:
        enforce: If False, log violations but don't block
        log_access: If True, write to audit logs

    Required Function Parameters:
        bom_id: str - Path parameter for BOM UUID
        request: Request - FastAPI request object
        db: Session - Database session from Depends(get_supabase_session)
        user: User - Authenticated user from Depends(get_current_user)

    Usage:
        @router.patch("/boms/{bom_id}")
        @require_bom(enforce=True)
        async def update_bom(
            bom_id: str,
            request: Request,
            db: Session = Depends(get_supabase_session),
            user: User = Depends(get_current_user)
        ):
            scope = request.state.validated_scope
            # scope = {"tenant_id": "...", "workspace_id": "...",
            #          "project_id": "...", "bom_id": "..."}
            return update_bom_data(bom_id)

    Raises:
        HTTPException(400): Missing bom_id parameter
        HTTPException(403): BOM not in tenant's scope (only if enforce=True)
        HTTPException(500): Missing required function parameters
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract dependencies
            request: Optional[Request] = kwargs.get("request")
            db: Optional[Session] = kwargs.get("db")

            # Try to get auth from request.state.auth_context first (set by auth middleware)
            # This is the authoritative source with correct organization_id
            # Fall back to function parameters if not available
            auth = None
            if request and hasattr(request, "state") and hasattr(request.state, "auth_context"):
                auth = request.state.auth_context
            if not auth:
                auth = kwargs.get("auth") or kwargs.get("user") or kwargs.get("context")

            # Validate dependencies
            if not request or not db or not auth:
                missing = []
                if not request:
                    missing.append("request")
                if not db:
                    missing.append("db")
                if not auth:
                    missing.append("auth/user/context")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Decorator requires parameters: {', '.join(missing)}"
                )

            # Extract bom_id from kwargs
            bom_id: Optional[str] = kwargs.get("bom_id")

            if not bom_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="bom_id required in URL path"
                )

            # Get tenant_id
            tenant_id = _get_tenant_id_from_auth(auth)

            # Build initial scope context (will be populated later)
            scope = {
                "tenant_id": tenant_id,
                "workspace_id": None,
                "project_id": None,
                "bom_id": bom_id,
            }

            # Check if staff bypass is active (from @staff_can_cross_scope decorator)
            if hasattr(request.state, "is_staff_override") and request.state.is_staff_override:
                logger.info(
                    f"[STAFF_BYPASS] Skipping BOM validation for staff user "
                    f"(bom_id={bom_id}, tenant_id={tenant_id})"
                )
                # Still fetch project_id and workspace_id for completeness
                from sqlalchemy import text
                result = db.execute(
                    text("""
                        SELECT p.id, p.workspace_id
                        FROM boms b
                        JOIN projects p ON b.project_id = p.id
                        WHERE b.id = :bom_id
                    """),
                    {"bom_id": bom_id}
                ).fetchone()
                if result:
                    scope["project_id"] = str(result[0])
                    scope["workspace_id"] = str(result[1])

                # Set validated scope and proceed without validation
                request.state.validated_scope = scope
                return await func(*args, **kwargs)

            # Validate full scope chain (normal flow)
            validation_result = validate_full_scope_chain(
                db=db,
                tenant_id=tenant_id,
                bom_id=bom_id,
            )

            is_valid = validation_result["valid"]
            errors = validation_result.get("errors", [])

            # Extract workspace_id and project_id from DB
            if is_valid:
                from sqlalchemy import text
                result = db.execute(
                    text("""
                        SELECT p.id, p.workspace_id
                        FROM boms b
                        JOIN projects p ON b.project_id = p.id
                        WHERE b.id = :bom_id
                    """),
                    {"bom_id": bom_id}
                ).fetchone()
                if result:
                    scope["project_id"] = str(result[0])
                    scope["workspace_id"] = str(result[1])

            # Log access
            if log_access:
                user_id = getattr(auth, "id", "unknown")
                _log_scope_access(
                    user_id=user_id,
                    endpoint=request.url.path,
                    scope=scope,
                    action="bom_access",
                    db=db,
                )

            # Handle validation failure
            if not is_valid:
                error_msg = f"BOM {bom_id} access denied: {', '.join(errors)}"

                if enforce:
                    logger.warning(f"[SCOPE_VIOLATION] {error_msg}")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=error_msg
                    )
                else:
                    logger.warning(f"[SCOPE_WARNING] {error_msg} (enforcement disabled)")

            # Set validated scope
            request.state.validated_scope = scope

            # Call original function
            return await func(*args, **kwargs)

        return wrapper
    return decorator
