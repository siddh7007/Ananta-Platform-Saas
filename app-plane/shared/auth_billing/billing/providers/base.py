"""
Base Billing Provider

Abstract base class for billing provider implementations.
"""

from abc import ABC, abstractmethod
from typing import List, Optional

from shared.auth_billing.billing.models import (
    CreateCheckoutResponse,
    CreatePortalResponse,
    InvoiceResponse,
    SubscriptionResponse,
)


class BaseBillingProvider(ABC):
    """
    Abstract base class for billing providers.

    Each provider implementation handles:
    - Checkout session creation
    - Subscription management
    - Invoice retrieval
    - Webhook processing

    Usage:
        class StripeProvider(BaseBillingProvider):
            async def create_checkout_session(self, ...) -> CreateCheckoutResponse:
                # Stripe-specific implementation
                ...
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name (e.g., 'stripe', 'paypal')."""
        pass

    @property
    def is_configured(self) -> bool:
        """Check if the provider is properly configured."""
        return True

    @abstractmethod
    async def create_checkout_session(
        self,
        organization_id: str,
        plan_slug: str,
        billing_interval: str,
        success_url: str,
        cancel_url: str,
        customer_email: Optional[str] = None,
    ) -> CreateCheckoutResponse:
        """
        Create a checkout session for subscription purchase.

        Args:
            organization_id: Organization UUID
            plan_slug: Plan identifier
            billing_interval: "month" or "year"
            success_url: URL to redirect on success
            cancel_url: URL to redirect on cancel
            customer_email: Optional customer email

        Returns:
            CreateCheckoutResponse with checkout URL
        """
        pass

    @abstractmethod
    async def create_billing_portal(
        self,
        organization_id: str,
        return_url: str,
    ) -> CreatePortalResponse:
        """
        Create a billing portal session.

        Args:
            organization_id: Organization UUID
            return_url: URL to return to after portal

        Returns:
            CreatePortalResponse with portal URL
        """
        pass

    @abstractmethod
    async def get_subscription(
        self,
        organization_id: str,
    ) -> Optional[SubscriptionResponse]:
        """
        Get current subscription for an organization.

        Args:
            organization_id: Organization UUID

        Returns:
            SubscriptionResponse or None
        """
        pass

    @abstractmethod
    async def update_subscription(
        self,
        organization_id: str,
        new_plan_slug: str,
        billing_interval: Optional[str] = None,
    ) -> bool:
        """
        Update a subscription to a new plan.

        Args:
            organization_id: Organization UUID
            new_plan_slug: New plan to switch to
            billing_interval: Optional new billing interval

        Returns:
            True if successful
        """
        pass

    @abstractmethod
    async def cancel_subscription(
        self,
        organization_id: str,
        cancel_immediately: bool = False,
    ) -> bool:
        """
        Cancel a subscription.

        Args:
            organization_id: Organization UUID
            cancel_immediately: If True, cancel immediately; else at period end

        Returns:
            True if successful
        """
        pass

    @abstractmethod
    async def reactivate_subscription(
        self,
        organization_id: str,
    ) -> bool:
        """
        Reactivate a canceled subscription (before period end).

        Args:
            organization_id: Organization UUID

        Returns:
            True if successful
        """
        pass

    @abstractmethod
    async def list_invoices(
        self,
        organization_id: str,
        limit: int = 10,
        offset: int = 0,
        starting_after: Optional[str] = None,
    ) -> List[InvoiceResponse]:
        """
        List invoices for an organization.

        Args:
            organization_id: Organization UUID
            limit: Max results to return
            offset: Offset for pagination (deprecated, use starting_after)
            starting_after: Cursor for pagination (invoice ID to start after)

        Returns:
            List of InvoiceResponse
        """
        pass

    @abstractmethod
    async def handle_webhook(
        self,
        payload: bytes,
        headers: dict,
    ) -> dict:
        """
        Handle incoming webhook from provider.

        Args:
            payload: Raw webhook payload
            headers: Request headers (for signature verification)

        Returns:
            Dict with processing result
        """
        pass
