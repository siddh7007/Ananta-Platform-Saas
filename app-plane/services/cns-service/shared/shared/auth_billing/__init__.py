"""
Shared Auth & Billing Module

A reusable, provider-agnostic authentication and billing module for
Components Platform services. This module can be shared across multiple
services with minimal configuration changes.

Usage:
    from shared.auth_billing import (
        # Configuration
        AuthConfig, BillingConfig,
        # Auth context
        AuthContext, get_auth_context, get_optional_auth_context,
        # Roles
        Role, ROLE_HIERARCHY, normalize_role, get_role_level,
        # Errors
        AuthErrorCode, AuthContextError,
        # Tenant filtering
        apply_tenant_filter, apply_tenant_filter_raw, build_tenant_where_clause,
        # Decorators
        require_role, require_same_org,
    )

    # Configure for your service
    config = AuthConfig(
        jwt_secret_key=os.environ["JWT_SECRET_KEY"],
        auth0_enabled=os.environ.get("AUTH0_ENABLED", "false").lower() == "true",
    )
"""

# Configuration
from shared.auth_billing.config import AuthConfig, BillingConfig

# Auth submodule
from shared.auth_billing.auth import (
    # Context
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
    # Filters
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

# Billing submodule
from shared.auth_billing.billing import (
    # Models
    PlanResponse,
    SubscriptionResponse,
    UsageSummaryResponse,
    InvoiceResponse,
    # Limits
    check_organization_limit,
    get_organization_tier,
)

__all__ = [
    # Configuration
    "AuthConfig",
    "BillingConfig",
    # Auth context
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
    # Billing models
    "PlanResponse",
    "SubscriptionResponse",
    "UsageSummaryResponse",
    "InvoiceResponse",
    # Billing functions
    "check_organization_limit",
    "get_organization_tier",
]
