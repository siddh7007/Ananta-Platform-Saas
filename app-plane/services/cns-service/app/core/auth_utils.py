"""
Authentication Utilities - Shared helpers for auth context handling.

This module provides centralized utilities for extracting information from
authentication contexts across different auth provider types.
"""

import logging
from typing import Any, Optional

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


def get_tenant_id_from_auth_context(auth_context: Any) -> Optional[str]:
    """
    Extract tenant_id from authentication context.

    Supports multiple auth context types:
    - AuthContext: Has organization_id directly (from auth middleware)
    - WorkspaceContext: Has organization.control_plane_tenant_id
    - OrgContext: Has organization.id
    - User: Has tenant_id attribute directly

    Lookup order:
    1. auth_context.organization_id (AuthContext from auth middleware - PREFERRED)
       - Empty string = super admin with access to all orgs (returns None)
    2. auth_context.organization.control_plane_tenant_id (WorkspaceContext with CNS integration)
    3. auth_context.organization.id (OrgContext)
    4. auth_context.tenant_id (User with explicit tenant_id)
    5. Raise error if none found

    Args:
        auth_context: Authentication context object (AuthContext, User, OrgContext, WorkspaceContext, etc.)

    Returns:
        Tenant ID as string (UUID format), or None for super admins with access to all orgs

    Raises:
        HTTPException(500): If tenant_id cannot be determined from auth context

    Examples:
        >>> from app.auth.dependencies import get_current_user
        >>> from fastapi import Depends
        >>>
        >>> @router.get("/data")
        >>> async def get_data(user: User = Depends(get_current_user)):
        >>>     tenant_id = get_tenant_id_from_auth_context(user)
        >>>     return query_data(tenant_id=tenant_id)
    """
    # PRIORITY 1: Check organization_id directly (AuthContext from auth middleware)
    # This is the most authoritative source as it comes from the auth middleware
    if hasattr(auth_context, "organization_id"):
        org_id = auth_context.organization_id
        # Empty string means super admin with access to all orgs
        if org_id == "":
            logger.warning(
                f"[SECURITY] Super admin access granted: "
                f"user={getattr(auth_context, 'user_id', 'unknown')} "
                f"auth_provider={getattr(auth_context, 'auth_provider', 'unknown')} "
                f"email={getattr(auth_context, 'email', 'unknown')}"
            )
            return None  # None = super admin, can access any organization
        if org_id:
            tenant_id = str(org_id)
            logger.debug(f"Extracted tenant_id from organization_id (AuthContext): {tenant_id}")
            return tenant_id

    # PRIORITY 2: Check WorkspaceContext/OrgContext (has organization attribute)
    if hasattr(auth_context, "organization"):
        org = auth_context.organization

        # Prefer control_plane_tenant_id (CNS integration with Control Plane)
        if hasattr(org, "control_plane_tenant_id") and org.control_plane_tenant_id:
            tenant_id = str(org.control_plane_tenant_id)
            logger.debug(f"Extracted tenant_id from organization.control_plane_tenant_id: {tenant_id}")
            return tenant_id

        # Fallback to organization.id
        if hasattr(org, "id") and org.id:
            tenant_id = str(org.id)
            logger.debug(f"Extracted tenant_id from organization.id: {tenant_id}")
            return tenant_id

    # PRIORITY 3: Check direct tenant_id attribute (User model)
    if hasattr(auth_context, "tenant_id") and auth_context.tenant_id:
        tenant_id = str(auth_context.tenant_id)
        logger.debug(f"Extracted tenant_id from tenant_id attribute: {tenant_id}")
        return tenant_id

    # If we get here, we couldn't find a tenant_id
    auth_type = type(auth_context).__name__
    available_attrs = [a for a in dir(auth_context) if not a.startswith('_')]

    logger.error(
        f"Unable to extract tenant_id from auth context. "
        f"Type: {auth_type}, Available attributes: {available_attrs}"
    )

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=(
            f"Unable to determine tenant_id from auth context of type {auth_type}. "
            f"Expected one of: organization_id, organization.control_plane_tenant_id, organization.id, or tenant_id attribute."
        )
    )


def get_user_id_from_auth_context(auth_context: Any) -> str:
    """
    Extract user_id from authentication context.

    Args:
        auth_context: Authentication context object

    Returns:
        User ID as string

    Raises:
        HTTPException(500): If user_id cannot be determined
    """
    # Check common user ID attributes
    for attr in ["id", "user_id", "sub", "uuid"]:
        if hasattr(auth_context, attr):
            value = getattr(auth_context, attr)
            if value:
                return str(value)

    auth_type = type(auth_context).__name__
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Unable to determine user_id from auth context of type {auth_type}"
    )


def is_staff_user(auth_context: Any) -> bool:
    """
    Check if auth context represents a staff/platform admin user.

    Staff users have elevated privileges including cross-tenant access.

    Args:
        auth_context: Authentication context object

    Returns:
        True if user is staff/platform admin, False otherwise

    Examples:
        >>> if is_staff_user(user):
        >>>     # Allow cross-tenant access
        >>>     return get_all_tenant_data()
    """
    # Check for staff role attribute
    if hasattr(auth_context, "role"):
        role = str(auth_context.role).lower()
        if role in ["staff", "platform_admin", "super_admin", "admin"]:
            return True

    # Check for roles list
    if hasattr(auth_context, "roles"):
        roles = auth_context.roles
        if isinstance(roles, (list, tuple)):
            role_names = [str(r).lower() for r in roles]
            if any(r in role_names for r in ["staff", "platform_admin", "super_admin"]):
                return True

    # Check for is_staff boolean flag
    if hasattr(auth_context, "is_staff"):
        return bool(auth_context.is_staff)

    return False
