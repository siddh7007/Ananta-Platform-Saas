"""
Billing API Endpoints (Payment Provider Agnostic)

This module provides billing and subscription management endpoints that work
with ANY payment provider (Stripe, PayPal, Razorpay, etc.).

The actual payment provider integration is handled by pluggable adapters
configured at runtime via BILLING_PROVIDER environment variable.
"""

import logging
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from ..config import settings

# Import billing provider abstraction
from shared.auth_billing.config import BillingConfig
from shared.auth_billing.billing.providers import get_billing_provider, BaseBillingProvider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])


# =============================================================================
# PROVIDER CONFIGURATION
# =============================================================================

@lru_cache()
def get_billing_config() -> BillingConfig:
    """Get billing configuration from settings (cached)"""
    return BillingConfig(
        provider=settings.billing_provider,
        stripe_secret_key=settings.stripe_secret_key,
        stripe_publishable_key=settings.stripe_publishable_key,
        stripe_webhook_secret=settings.stripe_webhook_secret,
    )


def get_price_map() -> Dict[str, str]:
    """
    Get plan slug to price ID mapping from settings.

    Only includes plans with configured price IDs to prevent
    confusing errors from empty string price IDs.
    """
    price_map = {}
    if settings.stripe_price_starter:
        price_map["starter"] = settings.stripe_price_starter
    if settings.stripe_price_professional:
        price_map["professional"] = settings.stripe_price_professional
    if settings.stripe_price_enterprise:
        price_map["enterprise"] = settings.stripe_price_enterprise
    return price_map


# Cached provider instance (singleton per process)
_provider_instance: Optional[BaseBillingProvider] = None


def get_provider() -> BaseBillingProvider:
    """
    Get the configured billing provider instance (cached singleton).

    The provider is cached to avoid recreating StripeClient and
    ThreadPoolExecutor on every API call.
    """
    global _provider_instance
    if _provider_instance is None:
        config = get_billing_config()
        price_map = get_price_map()
        _provider_instance = get_billing_provider(config, price_map=price_map)
        logger.info(f"[Billing] Provider initialized: {_provider_instance.provider_name}")
    return _provider_instance


def reset_provider():
    """Reset the cached provider (for testing or config changes)."""
    global _provider_instance
    _provider_instance = None
    get_billing_config.cache_clear()


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class PlanResponse(BaseModel):
    """Subscription plan details"""
    id: UUID
    name: str
    tier: str
    slug: str
    price_monthly: int  # In cents
    price_yearly: Optional[int]
    currency: str
    billing_interval: str
    trial_days: int
    limits: Dict[str, Any]
    features: List[str]
    description: Optional[str]
    is_popular: bool


class SubscriptionResponse(BaseModel):
    """Current subscription details"""
    id: UUID
    plan: PlanResponse
    status: str
    current_period_start: datetime
    current_period_end: datetime
    trial_start: Optional[datetime]
    trial_end: Optional[datetime]
    cancel_at_period_end: bool
    canceled_at: Optional[datetime]


class CreateCheckoutRequest(BaseModel):
    """Request to create a checkout session"""
    plan_slug: str
    billing_interval: Literal["month", "year"] = "month"
    success_url: str
    cancel_url: str


class CreateCheckoutResponse(BaseModel):
    """Checkout session response"""
    checkout_url: str
    session_id: str
    provider: str


class CreatePortalRequest(BaseModel):
    """Request to create a billing portal session"""
    return_url: str


class CreatePortalResponse(BaseModel):
    """Billing portal session response"""
    portal_url: str
    provider: str


class UpdateSubscriptionRequest(BaseModel):
    """Request to update subscription"""
    plan_slug: str
    billing_interval: Optional[Literal["month", "year"]] = None


class CancelSubscriptionRequest(BaseModel):
    """Request to cancel subscription"""
    cancel_immediately: bool = False
    cancellation_reason: Optional[str] = None


class UsageSummaryResponse(BaseModel):
    """Usage summary for current billing period"""
    organization_id: UUID
    period_start: datetime
    period_end: datetime
    usage: Dict[str, int]
    limits: Dict[str, int]
    percentage_used: Dict[str, float]


class InvoiceResponse(BaseModel):
    """Invoice details"""
    id: UUID
    invoice_number: str
    status: str
    subtotal: int
    tax: int
    total: int
    amount_paid: int
    amount_due: int
    currency: str
    invoice_date: datetime
    due_date: Optional[datetime]
    paid_at: Optional[datetime]
    invoice_pdf_url: Optional[str]


# =============================================================================
# SUBSCRIPTION PLANS
# =============================================================================

@router.get("/plans", response_model=List[PlanResponse])
async def list_plans(request: Request):
    """
    List all available subscription plans.

    This endpoint is public and used for pricing pages.
    Returns all active plans with their features and limits.
    """
    try:
        # TODO: Fetch from database
        # For now, return hardcoded plans matching migration
        plans = [
            PlanResponse(
                id=UUID("00000000-0000-0000-0000-000000000001"),
                name="Free",
                tier="free",
                slug="free",
                price_monthly=0,
                price_yearly=0,
                currency="USD",
                billing_interval="month",
                trial_days=0,
                limits={
                    "max_members": 1,
                    "max_projects": 2,
                    "max_bom_uploads_per_month": 5,
                    "max_components_per_bom": 100,
                    "max_api_calls_per_month": 100,
                    "org_type": "individual",
                    "org_features": False,  # No org management features
                    "can_change_org_name": False,
                },
                features=["5 BOM uploads/month", "100 components/BOM", "Basic enrichment", "Community support"],
                description="Perfect for trying out the platform",
                is_popular=False,
            ),
            PlanResponse(
                id=UUID("00000000-0000-0000-0000-000000000002"),
                name="Starter",
                tier="starter",
                slug="starter",
                price_monthly=9900,  # $99/mo
                price_yearly=99000,  # $990/yr (save ~17%)
                currency="USD",
                billing_interval="month",
                trial_days=14,
                limits={
                    "max_members": 1,  # Individual plan - single user only
                    "max_projects": 10,
                    "max_bom_uploads_per_month": 50,
                    "max_components_per_bom": 500,
                    "max_api_calls_per_month": 5000,
                    "org_type": "individual",
                    "org_features": False,  # No org management features
                    "can_change_org_name": True,  # Paid users can change org name
                },
                features=["Individual plan", "50 BOM uploads/month", "500 components/BOM", "CSV & Excel export", "Email support"],
                description="For individual engineers",
                is_popular=False,
            ),
            PlanResponse(
                id=UUID("00000000-0000-0000-0000-000000000003"),
                name="Professional",
                tier="professional",
                slug="professional",
                price_monthly=19900,  # $199/mo
                price_yearly=199000,  # $1,990/yr (save ~17%)
                currency="USD",
                billing_interval="month",
                trial_days=14,
                limits={
                    "max_members": 3,  # Owner + 2 invited members
                    "max_projects": 50,
                    "max_bom_uploads_per_month": 200,
                    "max_components_per_bom": 2000,
                    "max_api_calls_per_month": 50000,
                    "org_type": "individual",
                    "org_features": False,  # No full org management (no role management, admin panel)
                    "can_change_org_name": True,  # Paid users can change org name
                    "can_invite_members": True,  # Can invite up to 2 additional members
                },
                features=["Up to 3 team members", "200 BOM uploads/month", "2000 components/BOM", "Full API access", "Advanced enrichment", "Priority support"],
                description="For small teams",
                is_popular=True,
            ),
            PlanResponse(
                id=UUID("00000000-0000-0000-0000-000000000004"),
                name="Enterprise",
                tier="enterprise",
                slug="enterprise",
                price_monthly=29900,  # $299/mo per seat
                price_yearly=299000,  # $2,990/yr per seat (save ~17%)
                currency="USD",
                billing_interval="month",
                trial_days=0,
                limits={
                    "max_members": -1,  # Unlimited
                    "max_projects": -1,
                    "max_bom_uploads_per_month": -1,
                    "max_components_per_bom": -1,
                    "max_api_calls_per_month": -1,
                    "org_type": "enterprise",
                    "org_features": True,  # Full org management features
                    "can_change_org_name": True,
                    "can_invite_members": True,
                    "per_seat_pricing": True,  # Billed per seat
                },
                features=["Per-seat pricing ($299/seat)", "Unlimited BOMs", "SSO/SAML", "Dedicated support", "SLA guarantee", "Custom integrations", "Full org management"],
                description="For organizations with per-seat billing",
                is_popular=False,
            ),
        ]

        return plans

    except Exception as e:
        logger.error(f"Failed to list plans: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch plans")


@router.get("/plans/{slug}", response_model=PlanResponse)
async def get_plan(slug: str):
    """Get a specific plan by slug"""
    plans = await list_plans(None)
    for plan in plans:
        if plan.slug == slug:
            return plan
    raise HTTPException(status_code=404, detail=f"Plan '{slug}' not found")


# =============================================================================
# SUBSCRIPTION MANAGEMENT
# =============================================================================

def get_organization_id(request: Request) -> str:
    """
    Get organization ID from auth context or X-Organization-ID header.

    Priority:
    1. auth_context.organization_id (from JWT claims)
    2. X-Organization-ID header (fallback for Auth0 without custom claims)
    """
    auth_context = getattr(request.state, 'auth_context', None)
    if not auth_context:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Try auth context first
    organization_id = getattr(auth_context, 'organization_id', None)

    # Fallback to header if not in auth context
    if not organization_id:
        organization_id = request.headers.get('X-Organization-ID')

    if not organization_id:
        raise HTTPException(status_code=400, detail="Organization context required")

    return organization_id


@router.get("/subscription", response_model=Optional[SubscriptionResponse])
async def get_current_subscription(request: Request):
    """
    Get the current organization's subscription.

    Returns the active subscription with plan details.
    Returns null if on free tier with no subscription record.
    """
    organization_id = get_organization_id(request)

    try:
        provider = get_provider()
        if not provider.is_configured:
            # No provider configured = free tier
            return None

        result = await provider.get_subscription(organization_id=str(organization_id))
        return result

    except Exception as e:
        logger.error(f"Failed to get subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch subscription")


@router.post("/checkout", response_model=CreateCheckoutResponse)
async def create_checkout_session(
    request: Request,
    checkout_request: CreateCheckoutRequest
):
    """
    Create a checkout session with the configured payment provider.

    This endpoint:
    1. Validates the plan exists
    2. Creates a checkout session with the payment provider
    3. Returns the checkout URL for the frontend to redirect to

    The actual payment provider (Stripe, PayPal, etc.) is determined by
    the BILLING_PROVIDER environment variable.
    """
    organization_id = get_organization_id(request)
    auth_context = getattr(request.state, 'auth_context', None)

    # Validate plan exists
    try:
        plan = await get_plan(checkout_request.plan_slug)
    except HTTPException:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {checkout_request.plan_slug}")

    if plan.tier == "free":
        raise HTTPException(status_code=400, detail="Cannot checkout for free plan")

    if plan.tier == "enterprise":
        raise HTTPException(status_code=400, detail="Enterprise plan requires contacting sales")

    # Get customer email from auth context
    customer_email = getattr(auth_context, 'email', None)

    try:
        provider = get_provider()
        if not provider.is_configured:
            raise HTTPException(
                status_code=501,
                detail="Payment provider not configured. Set BILLING_PROVIDER in environment."
            )

        result = await provider.create_checkout_session(
            organization_id=str(organization_id),
            plan_slug=checkout_request.plan_slug,
            billing_interval=checkout_request.billing_interval,
            success_url=checkout_request.success_url,
            cancel_url=checkout_request.cancel_url,
            customer_email=customer_email,
        )

        logger.info(f"Checkout session created for org={organization_id}, plan={plan.slug}")
        return result

    except RuntimeError as e:
        logger.error(f"Checkout session creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/portal", response_model=CreatePortalResponse)
async def create_billing_portal(
    request: Request,
    portal_request: CreatePortalRequest
):
    """
    Create a billing portal session for managing subscription.

    The billing portal allows customers to:
    - Update payment method
    - View invoices
    - Cancel subscription
    - Update billing info
    """
    organization_id = get_organization_id(request)
    auth_context = getattr(request.state, 'auth_context', None)

    try:
        provider = get_provider()
        if not provider.is_configured:
            raise HTTPException(
                status_code=501,
                detail="Payment provider not configured. Set BILLING_PROVIDER in environment."
            )

        result = await provider.create_billing_portal(
            organization_id=str(organization_id),
            return_url=portal_request.return_url,
        )

        logger.info(f"Billing portal session created for org={organization_id}")
        return result

    except RuntimeError as e:
        logger.error(f"Billing portal creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/subscription/update")
async def update_subscription(
    request: Request,
    update_request: UpdateSubscriptionRequest
):
    """
    Update the current subscription (upgrade/downgrade).

    This will prorate the billing and immediately change the plan.
    """
    organization_id = get_organization_id(request)

    # Validate plan exists
    try:
        plan = await get_plan(update_request.plan_slug)
    except HTTPException:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {update_request.plan_slug}")

    if plan.tier == "free":
        raise HTTPException(status_code=400, detail="Cannot update to free plan via this endpoint")

    if plan.tier == "enterprise":
        raise HTTPException(status_code=400, detail="Enterprise plan requires contacting sales")

    try:
        provider = get_provider()
        if not provider.is_configured:
            raise HTTPException(
                status_code=501,
                detail="Payment provider not configured. Set BILLING_PROVIDER in environment."
            )

        success = await provider.update_subscription(
            organization_id=str(organization_id),
            new_plan_slug=update_request.plan_slug,
            billing_interval=update_request.billing_interval,
        )

        if success:
            logger.info(f"Subscription updated for org={organization_id} to plan={update_request.plan_slug}")
            return {"success": True, "message": f"Subscription updated to {plan.name}"}
        else:
            raise HTTPException(status_code=400, detail="Failed to update subscription")

    except ValueError as e:
        logger.error(f"Subscription update validation failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Subscription update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/subscription/cancel")
async def cancel_subscription(
    request: Request,
    cancel_request: CancelSubscriptionRequest
):
    """
    Cancel the current subscription.

    By default, cancellation takes effect at the end of the billing period.
    Set cancel_immediately=true to cancel immediately (no refund).
    """
    organization_id = get_organization_id(request)

    try:
        provider = get_provider()
        if not provider.is_configured:
            raise HTTPException(
                status_code=501,
                detail="Payment provider not configured. Set BILLING_PROVIDER in environment."
            )

        success = await provider.cancel_subscription(
            organization_id=str(organization_id),
            cancel_immediately=cancel_request.cancel_immediately,
        )

        if success:
            logger.info(f"Subscription canceled for org={organization_id}")
            return {"success": True, "message": "Subscription canceled"}
        else:
            raise HTTPException(status_code=400, detail="Failed to cancel subscription")

    except RuntimeError as e:
        logger.error(f"Subscription cancellation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/subscription/reactivate")
async def reactivate_subscription(request: Request):
    """
    Reactivate a canceled subscription (before period end).

    Only works if cancel_at_period_end was set and period hasn't ended.
    """
    organization_id = get_organization_id(request)

    try:
        provider = get_provider()
        if not provider.is_configured:
            raise HTTPException(
                status_code=501,
                detail="Payment provider not configured. Set BILLING_PROVIDER in environment."
            )

        success = await provider.reactivate_subscription(
            organization_id=str(organization_id),
        )

        if success:
            logger.info(f"Subscription reactivated for org={organization_id}")
            return {"success": True, "message": "Subscription reactivated"}
        else:
            raise HTTPException(status_code=400, detail="Failed to reactivate subscription")

    except RuntimeError as e:
        logger.error(f"Subscription reactivation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# USAGE & LIMITS
# =============================================================================

@router.get("/usage", response_model=UsageSummaryResponse)
async def get_usage_summary(request: Request):
    """
    Get usage summary for the current billing period.

    Returns current usage counts and limits for the organization.
    """
    organization_id = get_organization_id(request)

    try:
        # TODO: Fetch actual usage from database
        # For now, return placeholder for free tier
        now = datetime.utcnow()
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if now.month == 12:
            period_end = period_start.replace(year=now.year + 1, month=1)
        else:
            period_end = period_start.replace(month=now.month + 1)

        # Free tier limits
        limits = {
            "max_members": 1,
            "max_projects": 2,
            "max_bom_uploads_per_month": 5,
            "max_components_per_bom": 100,
            "max_api_calls_per_month": 100,
        }

        # Placeholder usage
        usage = {
            "members": 1,
            "projects": 0,
            "bom_uploads_this_month": 0,
            "api_calls_this_month": 0,
        }

        # Calculate percentages
        percentage_used = {}
        for key, limit in limits.items():
            usage_key = key.replace("max_", "").replace("_per_month", "_this_month")
            if usage_key in usage and limit > 0:
                percentage_used[key] = round((usage.get(usage_key, 0) / limit) * 100, 1)
            elif limit == -1:  # Unlimited
                percentage_used[key] = 0
            else:
                percentage_used[key] = 0

        return UsageSummaryResponse(
            organization_id=organization_id,
            period_start=period_start,
            period_end=period_end,
            usage=usage,
            limits=limits,
            percentage_used=percentage_used,
        )

    except Exception as e:
        logger.error(f"Failed to get usage summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch usage")


@router.get("/limits/check/{limit_name}")
async def check_limit(request: Request, limit_name: str):
    """
    Check if organization is within a specific limit.

    Returns whether the action is allowed and current usage.
    """
    organization_id = get_organization_id(request)

    valid_limits = [
        "max_members",
        "max_projects",
        "max_bom_uploads_per_month",
        "max_components_per_bom",
        "max_api_calls_per_month",
    ]

    if limit_name not in valid_limits:
        raise HTTPException(status_code=400, detail=f"Invalid limit name. Valid: {valid_limits}")

    # TODO: Check actual limit from database
    # For now, return free tier limits
    limits = {
        "max_members": 1,
        "max_projects": 2,
        "max_bom_uploads_per_month": 5,
        "max_components_per_bom": 100,
        "max_api_calls_per_month": 100,
    }

    limit_value = limits.get(limit_name, 0)
    current_usage = 0  # TODO: Get actual usage

    return {
        "limit_name": limit_name,
        "limit_value": limit_value,
        "current_usage": current_usage,
        "is_unlimited": limit_value == -1,
        "allowed": limit_value == -1 or current_usage < limit_value,
        "remaining": None if limit_value == -1 else max(0, limit_value - current_usage),
    }


# =============================================================================
# ORGANIZATION SETTINGS (Feature-Gated)
# =============================================================================

class UpdateOrgNameRequest(BaseModel):
    """Request to update organization name"""
    name: str = Field(..., min_length=2, max_length=100, description="New organization name")


class OrganizationSettingsResponse(BaseModel):
    """Organization settings response"""
    id: str
    name: str
    org_type: str
    is_suspended: bool
    can_change_name: bool  # Based on subscription tier


@router.get("/organization", response_model=OrganizationSettingsResponse)
async def get_organization_settings(request: Request):
    """
    Get current organization settings.

    Returns organization details including whether name can be changed.
    """
    organization_id = get_organization_id(request)

    # TODO: Fetch from database - for now return placeholder
    try:
        # Check feature access
        features = await get_feature_access(request)

        return OrganizationSettingsResponse(
            id=str(organization_id),
            name="Your Organization",  # TODO: Fetch from DB
            org_type=features.org_type,
            is_suspended=False,  # TODO: Fetch from DB
            can_change_name=features.can_change_org_name,
        )

    except Exception as e:
        logger.error(f"Failed to get organization settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch organization settings")


@router.put("/organization/name")
async def update_organization_name(
    request: Request,
    update_request: UpdateOrgNameRequest
):
    """
    Update organization name (paid plans only).

    Feature gating:
    - Free tier: BLOCKED (name is auto-generated as "{FirstName}'s Org")
    - Starter/Professional: ALLOWED (individual plans)
    - Enterprise: ALLOWED (with custom org name)

    This endpoint returns 403 for free tier users.
    """
    organization_id = get_organization_id(request)
    auth_context = getattr(request.state, 'auth_context', None)

    # Check feature access
    features = await get_feature_access(request)

    if not features.can_change_org_name:
        raise HTTPException(
            status_code=403,
            detail="Upgrade to a paid plan to customize your organization name"
        )

    # Validate name
    new_name = update_request.name.strip()
    if len(new_name) < 2:
        raise HTTPException(status_code=400, detail="Organization name must be at least 2 characters")

    try:
        # TODO: Update in database
        # For now, log the attempt
        logger.info(
            f"Organization name update: org={organization_id} "
            f"new_name='{new_name}' by user={auth_context.user_id if auth_context else 'unknown'}"
        )

        # Placeholder response - in production this would update DB
        return {
            "success": True,
            "message": f"Organization name updated to '{new_name}'",
            "organization_id": str(organization_id),
            "new_name": new_name,
        }

    except Exception as e:
        logger.error(f"Failed to update organization name: {e}")
        raise HTTPException(status_code=500, detail="Failed to update organization name")


# =============================================================================
# FEATURE GATING
# =============================================================================

class FeatureAccessResponse(BaseModel):
    """Response for feature access check"""
    organization_id: str
    plan_tier: str
    org_type: str
    org_features: bool
    can_change_org_name: bool
    can_invite_members: bool
    max_members: int  # -1 = unlimited
    can_manage_roles: bool
    can_access_admin_panel: bool


@router.get("/features", response_model=FeatureAccessResponse)
async def get_feature_access(request: Request):
    """
    Get feature access flags for the current organization.

    Use this endpoint to determine which UI features to show/hide.

    Feature gating rules:
    - org_features: Only Enterprise plans have org management
    - can_change_org_name: Paid plans only (Starter, Professional, Enterprise)
    - can_invite_members: Only Enterprise plans (multi-user)
    - can_manage_roles: Only Enterprise plans
    - can_access_admin_panel: Only Enterprise plans
    """
    organization_id = get_organization_id(request)

    # TODO: Fetch actual subscription from database
    # For now, return free tier features (most restrictive)
    try:
        provider = get_provider()
        subscription = None
        if provider.is_configured:
            subscription = await provider.get_subscription(organization_id=str(organization_id))

        # Default to free tier if no subscription
        plan_tier = "free"
        org_type = "individual"
        org_features = False
        can_change_org_name = False
        can_invite_members = False
        max_members = 1

        if subscription:
            plan = subscription.get("plan", {})
            plan_tier = plan.get("tier", "free")
            limits = plan.get("limits", {})
            org_type = limits.get("org_type", "individual")
            org_features = limits.get("org_features", False)
            can_change_org_name = limits.get("can_change_org_name", False)
            # Professional: can invite up to 2 members (max_members=3)
            # Enterprise: unlimited members (max_members=-1)
            can_invite_members = limits.get("can_invite_members", org_features)
            max_members = limits.get("max_members", 1)
        else:
            # Check if trialing (new users get 14-day trial with Pro features)
            # TODO: Fetch trial status from database
            pass

        return FeatureAccessResponse(
            organization_id=str(organization_id),
            plan_tier=plan_tier,
            org_type=org_type,
            org_features=org_features,
            can_change_org_name=can_change_org_name,
            can_invite_members=can_invite_members,  # Professional (limited) or Enterprise (unlimited)
            max_members=max_members,  # Professional=3, Enterprise=-1 (unlimited)
            can_manage_roles=org_features,  # Only Enterprise (full role hierarchy)
            can_access_admin_panel=org_features,  # Only Enterprise
        )

    except Exception as e:
        logger.error(f"Failed to get feature access: {e}")
        # Return most restrictive on error
        return FeatureAccessResponse(
            organization_id=str(organization_id),
            plan_tier="free",
            org_type="individual",
            org_features=False,
            can_change_org_name=False,
            can_invite_members=False,
            max_members=1,
            can_manage_roles=False,
            can_access_admin_panel=False,
        )


# =============================================================================
# INVOICES
# =============================================================================

@router.get("/invoices", response_model=List[InvoiceResponse])
async def list_invoices(
    request: Request,
    limit: int = 10,
    offset: int = 0,
    starting_after: Optional[str] = None,
):
    """
    List invoices for the current organization.

    Supports cursor-based pagination via `starting_after` parameter.
    Pass the last invoice ID to get the next page.

    Args:
        limit: Max invoices to return (1-100, default 10)
        offset: Deprecated, use starting_after instead
        starting_after: Invoice ID to start after (for pagination)
    """
    organization_id = get_organization_id(request)

    try:
        provider = get_provider()
        if not provider.is_configured:
            return []

        invoices = await provider.list_invoices(
            organization_id=str(organization_id),
            limit=limit,
            offset=offset,
            starting_after=starting_after,
        )
        return invoices

    except Exception as e:
        logger.error(f"Failed to list invoices: {e}")
        return []


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(request: Request, invoice_id: UUID):
    """Get a specific invoice"""
    organization_id = get_organization_id(request)

    # TODO: Fetch from database
    raise HTTPException(status_code=404, detail="Invoice not found")


# =============================================================================
# WEBHOOKS (Provider-specific endpoints)
# =============================================================================

@router.post("/webhooks/{provider}")
async def handle_webhook(request: Request, provider: str):
    """
    Handle webhooks from payment providers.

    Each provider (stripe, paypal, razorpay) sends different webhook formats.
    This endpoint routes to the appropriate handler.

    Webhook verification is handled per-provider using their SDK/signatures.
    """
    valid_providers = ["stripe", "paypal", "razorpay", "square"]
    if provider not in valid_providers:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

    body = await request.body()
    headers = dict(request.headers)

    logger.info(f"Webhook received from {provider}, size={len(body)} bytes")

    try:
        billing_provider = get_provider()
        if not billing_provider.is_configured:
            raise HTTPException(
                status_code=501,
                detail=f"Payment provider not configured"
            )

        # Verify provider matches configured provider
        if billing_provider.provider_name != provider:
            raise HTTPException(
                status_code=400,
                detail=f"Webhook from {provider} but configured provider is {billing_provider.provider_name}"
            )

        result = await billing_provider.handle_webhook(
            payload=body,
            headers=headers,
        )

        return result

    except RuntimeError as e:
        logger.error(f"Webhook processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
