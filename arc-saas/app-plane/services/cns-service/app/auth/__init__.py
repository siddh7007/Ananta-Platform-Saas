"""
Auth Module - Multi-Org Support

Provides authentication and authorization for the CNS service.

Key Components:
- dependencies: FastAPI dependencies for auth (get_current_user, get_org_context)
- User, Organization, OrgContext: Data classes for auth context

Usage:
    from app.auth.dependencies import get_current_user, get_org_context, User, OrgContext

    @router.get("/me")
    async def get_profile(user: User = Depends(get_current_user)):
        return user

    @router.get("/orgs/{org_id}/boms")
    async def get_boms(context: OrgContext = Depends(get_org_context)):
        return get_boms_for_org(context.organization.id)
"""

from .dependencies import (
    # Data classes
    User,
    Organization,
    OrgContext,
    # Core dependencies
    get_current_user,
    get_org_context,
    get_user_organizations,
    # Role requirements
    require_admin,
    require_owner,
    require_write,
    # Header-based org selection
    get_org_from_header,
    require_org_from_header,
    # Database session helper
    get_supabase_session,
)

__all__ = [
    "User",
    "Organization",
    "OrgContext",
    "get_current_user",
    "get_org_context",
    "get_user_organizations",
    "require_admin",
    "require_owner",
    "require_write",
    "get_org_from_header",
    "require_org_from_header",
    "get_supabase_session",
]
