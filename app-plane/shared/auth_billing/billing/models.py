"""
Billing Pydantic Models

Request/response models for billing API endpoints.
These models are provider-agnostic and can be used with any payment gateway.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PlanResponse(BaseModel):
    """Subscription plan details"""
    id: UUID
    name: str
    tier: str
    slug: str
    price_monthly: int  # In cents
    price_yearly: Optional[int] = None
    currency: str = "USD"
    billing_interval: str = "month"
    trial_days: int = 0
    limits: Dict[str, Any] = Field(default_factory=dict)
    features: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    is_popular: bool = False


class SubscriptionResponse(BaseModel):
    """Current subscription details"""
    id: UUID
    plan: PlanResponse
    status: str
    current_period_start: datetime
    current_period_end: datetime
    trial_start: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    canceled_at: Optional[datetime] = None


class CreateCheckoutRequest(BaseModel):
    """Request to create a checkout session"""
    plan_slug: str
    billing_interval: str = "month"  # "month" or "year"
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
    billing_interval: Optional[str] = None


class CancelSubscriptionRequest(BaseModel):
    """Request to cancel subscription"""
    cancel_immediately: bool = False
    cancellation_reason: Optional[str] = None


class UsageSummaryResponse(BaseModel):
    """Usage summary for current billing period"""
    organization_id: UUID
    period_start: datetime
    period_end: datetime
    usage: Dict[str, int] = Field(default_factory=dict)
    limits: Dict[str, int] = Field(default_factory=dict)
    percentage_used: Dict[str, float] = Field(default_factory=dict)


class InvoiceResponse(BaseModel):
    """Invoice details"""
    id: UUID
    invoice_number: str
    status: str
    subtotal: int
    tax: int = 0
    total: int
    amount_paid: int = 0
    amount_due: int
    currency: str = "USD"
    invoice_date: datetime
    due_date: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    invoice_pdf_url: Optional[str] = None
