"""
Scope Validation Dependencies for FastAPI

Provides FastAPI dependency functions for scope validation:
- require_workspace_context - Validates workspace via header
- require_project_context - Validates project via header
- get_optional_workspace_context - Optional workspace validation

These dependencies read scope IDs from request headers (X-Workspace-ID,
X-Project-ID) and validate them against the user's tenant using the
scope_validators module.

Usage:
    from app.dependencies.scope_deps import (
        require_workspace_context,
        require_project_context,
        get_optional_workspace_context
    )
    from fastapi import APIRouter, Depends

    router = APIRouter()

    @router.get("/workspaces/current/projects")
    async def list_projects(
        scope: Dict = Depends(require_workspace_context)
    ):
        workspace_id = scope["workspace_id"]
        tenant_id = scope["tenant_id"]
        return get_projects(workspace_id)

    @router.get("/projects/current/boms")
    async def list_boms(
        scope: Dict = Depends(require_project_context)
    ):
        project_id = scope["project_id"]
        workspace_id = scope["workspace_id"]
        return get_boms(project_id)

    @router.get("/stats")
    async def get_stats(
        scope: Optional[Dict] = Depends(get_optional_workspace_context)
    ):
        # Works with or without workspace context
        if scope:
            # Workspace-specific stats
            return get_workspace_stats(scope["workspace_id"])
        else:
            # Global stats
            return get_global_stats()
"""

import logging
from contextlib import contextmanager
from typing import Dict, Optional

from fastapi import Header, HTTPException, Request, Depends, status
from sqlalchemy.orm import Session

from app.core.scope_validators import (
    validate_workspace_in_tenant,
    validate_project_in_workspace,
    validate_full_scope_chain,
)
from app.core.auth_utils import get_tenant_id_from_auth_context
from app.auth.dependencies import get_current_user, User
from app.models.dual_database import get_dual_database

logger = logging.getLogger(__name__)


# =============================================================================
# Database Session Dependency
# =============================================================================

def get_supabase_session():
    """
    Get a database session for Supabase as a FastAPI dependency.

    This is a generator function that FastAPI's Depends() can use.
    Do NOT use @contextmanager decorator - it's incompatible with Depends().

    Usage as FastAPI dependency:
        async def endpoint(db: Session = Depends(get_supabase_session)):
            db.execute(...)

    For context manager usage (with statement), use get_supabase_session_cm() instead.

    Yields:
        SQLAlchemy Session
    """
    dual_db = get_dual_database()
    session = dual_db.SupabaseSession()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def get_supabase_session_cm():
    """
    Get a database session for Supabase as a context manager.

    Use this for 'with' statement usage:
        with get_supabase_session_cm() as session:
            session.execute(...)

    For FastAPI Depends(), use get_supabase_session() instead.

    Yields:
        SQLAlchemy Session
    """
    dual_db = get_dual_database()
    session = dual_db.SupabaseSession()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# =============================================================================
# Helper Functions
# =============================================================================

# Use shared auth utility instead of local implementation
_get_tenant_id_from_user = get_tenant_id_from_auth_context


# =============================================================================
# Workspace Context Dependency
# =============================================================================

async def require_workspace_context(
    request: Request,
    x_workspace_id: str = Header(..., alias="X-Workspace-ID"),
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
) -> Dict[str, str]:
    """
    FastAPI dependency to require workspace context.

    Reads workspace_id from X-Workspace-ID header and validates it
    belongs to the user's tenant.

    Args:
        request: FastAPI request object
        x_workspace_id: Workspace ID from header
        db: Database session
        user: Authenticated user

    Returns:
        Dict with validated scope:
        {
            "tenant_id": "uuid-string",
            "workspace_id": "uuid-string"
        }

    Raises:
        HTTPException(400): Missing X-Workspace-ID header
        HTTPException(403): Workspace not in tenant

    Usage:
        @router.get("/workspaces/current/projects")
        async def list_projects(
            scope: Dict = Depends(require_workspace_context)
        ):
            workspace_id = scope["workspace_id"]
            return get_projects(workspace_id)
    """
    # Get tenant_id from user
    tenant_id = _get_tenant_id_from_user(user)

    # Validate workspace belongs to tenant
    is_valid = validate_workspace_in_tenant(
        db=db,
        workspace_id=x_workspace_id,
        tenant_id=tenant_id,
    )

    if not is_valid:
        logger.warning(
            f"[SCOPE_VIOLATION] User {user.id} attempted to access "
            f"workspace {x_workspace_id} not in tenant {tenant_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Workspace {x_workspace_id} does not belong to your tenant"
        )

    # Build validated scope
    scope = {
        "tenant_id": tenant_id,
        "workspace_id": x_workspace_id,
    }

    # Log access
    logger.info(
        f"[SCOPE_ACCESS] user={user.id} workspace={x_workspace_id} "
        f"tenant={tenant_id}"
    )

    # Set in request state for downstream use
    request.state.validated_scope = scope

    return scope


async def get_optional_workspace_context(
    request: Request,
    x_workspace_id: Optional[str] = Header(None, alias="X-Workspace-ID"),
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
) -> Optional[Dict[str, str]]:
    """
    FastAPI dependency for optional workspace context.

    Returns workspace scope if X-Workspace-ID header is provided and valid.
    Returns None if header not provided or workspace not found.

    Args:
        request: FastAPI request object
        x_workspace_id: Optional workspace ID from header
        db: Database session
        user: Authenticated user

    Returns:
        Dict with scope if workspace provided and valid, None otherwise

    Usage:
        @router.get("/stats")
        async def get_stats(
            scope: Optional[Dict] = Depends(get_optional_workspace_context)
        ):
            if scope:
                # Workspace-specific stats
                return get_workspace_stats(scope["workspace_id"])
            else:
                # Global stats
                return get_global_stats()
    """
    # If no workspace ID provided, return None
    if not x_workspace_id:
        return None

    # Get tenant_id from user
    try:
        tenant_id = _get_tenant_id_from_user(user)
    except HTTPException:
        # If can't determine tenant, return None (optional)
        return None

    # Validate workspace
    is_valid = validate_workspace_in_tenant(
        db=db,
        workspace_id=x_workspace_id,
        tenant_id=tenant_id,
    )

    if not is_valid:
        # For optional context, return None instead of raising error
        logger.debug(
            f"Optional workspace context invalid: workspace={x_workspace_id} "
            f"tenant={tenant_id}"
        )
        return None

    # Build scope
    scope = {
        "tenant_id": tenant_id,
        "workspace_id": x_workspace_id,
    }

    # Set in request state
    request.state.validated_scope = scope

    return scope


# =============================================================================
# Project Context Dependency
# =============================================================================

async def require_project_context(
    request: Request,
    x_workspace_id: str = Header(..., alias="X-Workspace-ID"),
    x_project_id: str = Header(..., alias="X-Project-ID"),
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
) -> Dict[str, str]:
    """
    FastAPI dependency to require project context.

    Validates the full chain:
    - project_id belongs to workspace
    - workspace belongs to organization
    - organization belongs to tenant

    Args:
        request: FastAPI request object
        x_workspace_id: Workspace ID from header
        x_project_id: Project ID from header
        db: Database session
        user: Authenticated user

    Returns:
        Dict with validated scope:
        {
            "tenant_id": "uuid-string",
            "workspace_id": "uuid-string",
            "project_id": "uuid-string"
        }

    Raises:
        HTTPException(400): Missing required headers
        HTTPException(403): Project not in workspace or workspace not in tenant

    Usage:
        @router.get("/projects/current/boms")
        async def list_boms(
            scope: Dict = Depends(require_project_context)
        ):
            project_id = scope["project_id"]
            return get_boms(project_id)
    """
    # Get tenant_id from user
    tenant_id = _get_tenant_id_from_user(user)

    # Validate full chain using scope_validators
    validation_result = validate_full_scope_chain(
        db=db,
        tenant_id=tenant_id,
        workspace_id=x_workspace_id,
        project_id=x_project_id,
    )

    if not validation_result["valid"]:
        errors = validation_result.get("errors", ["Unknown validation error"])
        logger.warning(
            f"[SCOPE_VIOLATION] User {user.id} attempted to access "
            f"project {x_project_id} in workspace {x_workspace_id}: "
            f"{', '.join(errors)}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Project access denied: {', '.join(errors)}"
        )

    # Build validated scope
    scope = {
        "tenant_id": tenant_id,
        "workspace_id": x_workspace_id,
        "project_id": x_project_id,
    }

    # Log access
    logger.info(
        f"[SCOPE_ACCESS] user={user.id} project={x_project_id} "
        f"workspace={x_workspace_id} tenant={tenant_id}"
    )

    # Set in request state
    request.state.validated_scope = scope

    return scope


async def get_optional_project_context(
    request: Request,
    x_workspace_id: Optional[str] = Header(None, alias="X-Workspace-ID"),
    x_project_id: Optional[str] = Header(None, alias="X-Project-ID"),
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
) -> Optional[Dict[str, str]]:
    """
    FastAPI dependency for optional project context.

    Returns project scope if headers are provided and valid.
    Returns None if headers not provided or validation fails.

    Args:
        request: FastAPI request object
        x_workspace_id: Optional workspace ID from header
        x_project_id: Optional project ID from header
        db: Database session
        user: Authenticated user

    Returns:
        Dict with scope if project provided and valid, None otherwise

    Usage:
        @router.get("/dashboard")
        async def get_dashboard(
            scope: Optional[Dict] = Depends(get_optional_project_context)
        ):
            if scope:
                # Project-specific dashboard
                return get_project_dashboard(scope["project_id"])
            else:
                # User dashboard
                return get_user_dashboard()
    """
    # If headers not provided, return None
    if not x_workspace_id or not x_project_id:
        return None

    # Get tenant_id
    try:
        tenant_id = _get_tenant_id_from_user(user)
    except HTTPException:
        return None

    # Validate full chain
    validation_result = validate_full_scope_chain(
        db=db,
        tenant_id=tenant_id,
        workspace_id=x_workspace_id,
        project_id=x_project_id,
    )

    if not validation_result["valid"]:
        # For optional context, return None instead of raising
        logger.debug(
            f"Optional project context invalid: project={x_project_id} "
            f"workspace={x_workspace_id} tenant={tenant_id}"
        )
        return None

    # Build scope
    scope = {
        "tenant_id": tenant_id,
        "workspace_id": x_workspace_id,
        "project_id": x_project_id,
    }

    # Set in request state
    request.state.validated_scope = scope

    return scope


# =============================================================================
# BOM Context Dependency
# =============================================================================

async def require_bom_context(
    request: Request,
    x_workspace_id: str = Header(..., alias="X-Workspace-ID"),
    x_project_id: str = Header(..., alias="X-Project-ID"),
    x_bom_id: str = Header(..., alias="X-BOM-ID"),
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
) -> Dict[str, str]:
    """
    FastAPI dependency to require BOM context.

    Validates the complete hierarchy:
    - bom_id belongs to project
    - project belongs to workspace
    - workspace belongs to organization
    - organization belongs to tenant

    Args:
        request: FastAPI request object
        x_workspace_id: Workspace ID from header
        x_project_id: Project ID from header
        x_bom_id: BOM ID from header
        db: Database session
        user: Authenticated user

    Returns:
        Dict with validated scope:
        {
            "tenant_id": "uuid-string",
            "workspace_id": "uuid-string",
            "project_id": "uuid-string",
            "bom_id": "uuid-string"
        }

    Raises:
        HTTPException(400): Missing required headers
        HTTPException(403): BOM not in tenant's scope

    Usage:
        @router.patch("/boms/current")
        async def update_bom(
            scope: Dict = Depends(require_bom_context),
            data: BOMUpdateRequest
        ):
            bom_id = scope["bom_id"]
            return update_bom_data(bom_id, data)
    """
    # Get tenant_id from user
    tenant_id = _get_tenant_id_from_user(user)

    # Validate full chain including BOM
    validation_result = validate_full_scope_chain(
        db=db,
        tenant_id=tenant_id,
        workspace_id=x_workspace_id,
        project_id=x_project_id,
        bom_id=x_bom_id,
    )

    if not validation_result["valid"]:
        errors = validation_result.get("errors", ["Unknown validation error"])
        logger.warning(
            f"[SCOPE_VIOLATION] User {user.id} attempted to access "
            f"BOM {x_bom_id} in project {x_project_id}: {', '.join(errors)}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"BOM access denied: {', '.join(errors)}"
        )

    # Build validated scope
    scope = {
        "tenant_id": tenant_id,
        "workspace_id": x_workspace_id,
        "project_id": x_project_id,
        "bom_id": x_bom_id,
    }

    # Log access
    logger.info(
        f"[SCOPE_ACCESS] user={user.id} bom={x_bom_id} "
        f"project={x_project_id} workspace={x_workspace_id} tenant={tenant_id}"
    )

    # Set in request state
    request.state.validated_scope = scope

    return scope
