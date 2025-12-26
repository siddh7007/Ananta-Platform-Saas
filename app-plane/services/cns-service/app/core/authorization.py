"""
App-Layer Authorization Module (Compatibility Layer)

This module provides application-layer Row-Level Security (RLS) as an alternative
to database-level RLS. It re-exports from the shared auth_billing module to
maintain backwards compatibility with existing imports.

The actual implementation lives in:
- shared/auth_billing/auth/ - Core auth (roles, context, filters, decorators)
- app/core/_authorization_membership.py - CNS-specific database functions

Usage (unchanged from before):
    from app.core.authorization import AuthContext, get_auth_context, apply_tenant_filter

    @router.get("/boms")
    async def list_boms(
        db: Session = Depends(get_db),
        auth: AuthContext = Depends(get_auth_context)
    ):
        query = db.query(Bom)
        query = apply_tenant_filter(query, Bom, auth)
        return query.all()

Migration Note:
    New services can import directly from shared.auth_billing:

    from shared.auth_billing import AuthContext, AuthConfig, Role
    from shared.auth_billing.auth.dependencies import get_auth_context
"""

# =============================================================================
# Re-exports from shared module (auth-provider agnostic)
# =============================================================================

from shared.auth_billing.auth import (
    # Auth context
    AuthContext,
    # Roles
    Role,
    ROLE_HIERARCHY,
    LEGACY_ROLE_MAPPINGS,
    normalize_role,
    get_role_level,
    # Errors
    AuthErrorCode,
    AuthContextError,
    # Tenant filtering
    apply_tenant_filter,
    apply_tenant_filter_raw,
    build_tenant_where_clause,
    # Decorators
    require_role,
    require_same_org,
    # Dependencies
    get_auth_context,
    get_optional_auth_context,
)

# =============================================================================
# Re-exports from CNS-specific module (requires database)
# =============================================================================

from app.core._authorization_membership import (
    # Membership functions
    lookup_membership,
    lookup_user_role,
    assert_membership,
    # Caching
    get_cached_membership,
    clear_membership_cache,
    # Utilities
    build_auth_context_from_request_body,
)

# =============================================================================
# Public API (same as before)
# =============================================================================

__all__ = [
    # Error handling
    "AuthErrorCode",
    "AuthContextError",
    # Role definitions
    "Role",
    "ROLE_HIERARCHY",
    "LEGACY_ROLE_MAPPINGS",
    # Backwards compatibility helpers
    "normalize_role",
    "get_role_level",
    # Auth context
    "AuthContext",
    "get_auth_context",
    "get_optional_auth_context",
    # Tenant filtering (App-Layer RLS)
    "apply_tenant_filter",
    "apply_tenant_filter_raw",
    "build_tenant_where_clause",
    # Role-based access decorators
    "require_role",
    "require_same_org",
    # Membership functions (CNS-specific)
    "lookup_membership",
    "lookup_user_role",
    "assert_membership",
    # Utilities
    "build_auth_context_from_request_body",
    # Caching
    "get_cached_membership",
    "clear_membership_cache",
]
