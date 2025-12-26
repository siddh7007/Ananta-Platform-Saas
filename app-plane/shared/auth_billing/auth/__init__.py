"""
Authentication Submodule

This submodule contains all authentication-related functionality:
- Auth context and user claims
- Role definitions and hierarchy
- Error codes and exceptions
- Tenant filtering (App-Layer RLS)
- Role-based access decorators
- FastAPI dependencies

Usage:
    from shared.auth_billing.auth import (
        AuthContext, Role, AuthErrorCode, AuthContextError,
        get_auth_context, apply_tenant_filter, require_role,
    )
"""

from shared.auth_billing.auth.context import AuthContext
from shared.auth_billing.auth.roles import (
    Role,
    ROLE_HIERARCHY,
    LEGACY_ROLE_MAPPINGS,
    normalize_role,
    get_role_level,
)
from shared.auth_billing.auth.errors import AuthErrorCode, AuthContextError
from shared.auth_billing.auth.filters import (
    apply_tenant_filter,
    apply_tenant_filter_raw,
    build_tenant_where_clause,
)
from shared.auth_billing.auth.decorators import require_role, require_same_org
from shared.auth_billing.auth.dependencies import (
    get_auth_context,
    get_optional_auth_context,
)

__all__ = [
    # Context
    "AuthContext",
    # Roles
    "Role",
    "ROLE_HIERARCHY",
    "LEGACY_ROLE_MAPPINGS",
    "normalize_role",
    "get_role_level",
    # Errors
    "AuthErrorCode",
    "AuthContextError",
    # Filters
    "apply_tenant_filter",
    "apply_tenant_filter_raw",
    "build_tenant_where_clause",
    # Decorators
    "require_role",
    "require_same_org",
    # Dependencies
    "get_auth_context",
    "get_optional_auth_context",
]
