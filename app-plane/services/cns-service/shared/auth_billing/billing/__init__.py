"""
Billing Submodule

This submodule contains billing-related models and utilities:
- Pydantic models for plans, subscriptions, invoices
- Usage limit checking functions
- Provider abstraction

Usage:
    from shared.auth_billing.billing import (
        PlanResponse, SubscriptionResponse,
        check_organization_limit, get_organization_tier,
    )
"""

from shared.auth_billing.billing.models import (
    PlanResponse,
    SubscriptionResponse,
    UsageSummaryResponse,
    InvoiceResponse,
    CreateCheckoutRequest,
    CreateCheckoutResponse,
    CreatePortalRequest,
    CreatePortalResponse,
    UpdateSubscriptionRequest,
    CancelSubscriptionRequest,
)
from shared.auth_billing.billing.limits import (
    check_organization_limit,
    get_organization_tier,
    organization_has_feature,
)

__all__ = [
    # Models
    "PlanResponse",
    "SubscriptionResponse",
    "UsageSummaryResponse",
    "InvoiceResponse",
    "CreateCheckoutRequest",
    "CreateCheckoutResponse",
    "CreatePortalRequest",
    "CreatePortalResponse",
    "UpdateSubscriptionRequest",
    "CancelSubscriptionRequest",
    # Limit checking
    "check_organization_limit",
    "get_organization_tier",
    "organization_has_feature",
]
