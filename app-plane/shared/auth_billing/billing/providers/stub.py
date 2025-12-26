"""
Stub Billing Provider

A stub implementation that returns 501 Not Implemented for all operations.
Used when no payment provider is configured.
"""

import logging
from typing import List, Optional

from fastapi import HTTPException

from shared.auth_billing.billing.providers.base import BaseBillingProvider
from shared.auth_billing.billing.models import (
    CreateCheckoutResponse,
    CreatePortalResponse,
    InvoiceResponse,
    SubscriptionResponse,
)

logger = logging.getLogger(__name__)


class StubBillingProvider(BaseBillingProvider):
    """
    Stub billing provider for when no payment gateway is configured.

    All operations raise HTTPException with status code 501.
    """

    def __init__(self, config=None):
        """Initialize stub provider."""
        self.config = config

    @property
    def provider_name(self) -> str:
        return "none"

    @property
    def is_configured(self) -> bool:
        return False

    def _not_implemented(self, operation: str):
        """Raise 501 Not Implemented error."""
        logger.warning(f"[Billing] Stub provider: {operation} not implemented")
        raise HTTPException(
            status_code=501,
            detail=f"Payment provider not configured. Set BILLING_PROVIDER in environment. "
                   f"Operation: {operation}"
        )

    async def create_checkout_session(
        self,
        organization_id: str,
        plan_slug: str,
        billing_interval: str,
        success_url: str,
        cancel_url: str,
        customer_email: Optional[str] = None,
    ) -> CreateCheckoutResponse:
        self._not_implemented("create_checkout_session")

    async def create_billing_portal(
        self,
        organization_id: str,
        return_url: str,
    ) -> CreatePortalResponse:
        self._not_implemented("create_billing_portal")

    async def get_subscription(
        self,
        organization_id: str,
    ) -> Optional[SubscriptionResponse]:
        # Don't raise error - just return None (free tier)
        logger.debug(f"[Billing] Stub provider: returning None for subscription")
        return None

    async def update_subscription(
        self,
        organization_id: str,
        new_plan_slug: str,
        billing_interval: Optional[str] = None,
    ) -> bool:
        self._not_implemented("update_subscription")

    async def cancel_subscription(
        self,
        organization_id: str,
        cancel_immediately: bool = False,
    ) -> bool:
        self._not_implemented("cancel_subscription")

    async def reactivate_subscription(
        self,
        organization_id: str,
    ) -> bool:
        self._not_implemented("reactivate_subscription")

    async def list_invoices(
        self,
        organization_id: str,
        limit: int = 10,
        offset: int = 0,
        starting_after: Optional[str] = None,
    ) -> List[InvoiceResponse]:
        # Return empty list instead of error
        logger.debug(f"[Billing] Stub provider: returning empty invoice list")
        return []

    async def handle_webhook(
        self,
        payload: bytes,
        headers: dict,
    ) -> dict:
        self._not_implemented("handle_webhook")
