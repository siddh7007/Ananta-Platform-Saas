"""
Stripe Payment Service

Handles all Stripe operations including:
- Customer creation and management
- Subscription creation, updates, and cancellation
- Checkout and billing portal sessions
- Webhook event processing

Usage:
    from app.services.stripe_service import stripe_service

    # Create a customer
    result = await stripe_service.create_customer(org_id, email, name)

    # Create subscription
    result = await stripe_service.create_subscription(customer_id, "professional")
"""

import stripe
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from datetime import datetime
import logging

from ..config import settings

logger = logging.getLogger(__name__)


@dataclass
class SubscriptionResult:
    """Result of subscription operations"""
    success: bool
    subscription_id: Optional[str] = None
    client_secret: Optional[str] = None
    status: Optional[str] = None
    error: Optional[str] = None


@dataclass
class CustomerResult:
    """Result of customer operations"""
    success: bool
    customer_id: Optional[str] = None
    error: Optional[str] = None


@dataclass
class CheckoutSessionResult:
    """Result of checkout session creation"""
    success: bool
    session_id: Optional[str] = None
    url: Optional[str] = None
    error: Optional[str] = None


@dataclass
class PortalSessionResult:
    """Result of billing portal session creation"""
    success: bool
    url: Optional[str] = None
    error: Optional[str] = None


@dataclass
class SubscriptionInfo:
    """Subscription information"""
    subscription_id: str
    customer_id: str
    status: str
    plan_tier: Optional[str]
    current_period_start: Optional[datetime]
    current_period_end: Optional[datetime]
    cancel_at_period_end: bool
    trial_end: Optional[datetime]


class StripeService:
    """
    Service for handling Stripe payment operations.

    This service provides a clean interface for:
    - Customer management
    - Subscription lifecycle
    - Checkout sessions
    - Billing portal access
    - Webhook processing
    """

    def __init__(self):
        """Initialize Stripe service with API key from settings."""
        self._initialized = False
        self._price_map: Dict[str, str] = {}

        if settings.stripe_enabled and settings.stripe_secret_key:
            stripe.api_key = settings.stripe_secret_key
            self._price_map = {
                "starter": settings.stripe_price_starter or "",
                "professional": settings.stripe_price_professional or "",
                "enterprise": settings.stripe_price_enterprise or "",
            }
            self._initialized = True
            logger.info("Stripe service initialized successfully")
        else:
            logger.warning("Stripe service not initialized - missing configuration")

    def is_enabled(self) -> bool:
        """Check if Stripe service is properly configured."""
        return self._initialized

    def _check_enabled(self) -> None:
        """Raise error if service is not enabled."""
        if not self._initialized:
            raise RuntimeError("Stripe service is not configured. Set STRIPE_ENABLED=true and provide STRIPE_SECRET_KEY.")

    # =========================================================================
    # Customer Management
    # =========================================================================

    async def create_customer(
        self,
        organization_id: str,
        email: str,
        name: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> CustomerResult:
        """
        Create a Stripe customer for an organization.

        Args:
            organization_id: The internal organization ID
            email: Customer email address
            name: Customer/organization name
            metadata: Additional metadata to store

        Returns:
            CustomerResult with customer_id if successful
        """
        self._check_enabled()

        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata={
                    "organization_id": organization_id,
                    "source": "components_platform",
                    **(metadata or {})
                }
            )

            if settings.enable_gate_logging:
                logger.info(
                    f"[GATE: Stripe] Customer created",
                    extra={
                        "organization_id": organization_id,
                        "stripe_customer_id": customer.id,
                        "email": email
                    }
                )

            return CustomerResult(success=True, customer_id=customer.id)

        except stripe.error.StripeError as e:
            logger.error(f"Stripe customer creation failed: {e}", extra={"organization_id": organization_id})
            return CustomerResult(success=False, error=str(e))

    async def get_customer(self, customer_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a Stripe customer by ID.

        Args:
            customer_id: Stripe customer ID

        Returns:
            Customer data dict or None if not found
        """
        self._check_enabled()

        try:
            customer = stripe.Customer.retrieve(customer_id)
            return {
                "id": customer.id,
                "email": customer.email,
                "name": customer.name,
                "metadata": dict(customer.metadata) if customer.metadata else {},
                "created": datetime.fromtimestamp(customer.created),
                "default_payment_method": customer.invoice_settings.default_payment_method if customer.invoice_settings else None
            }
        except stripe.error.StripeError as e:
            logger.error(f"Failed to retrieve customer {customer_id}: {e}")
            return None

    async def update_customer(
        self,
        customer_id: str,
        email: Optional[str] = None,
        name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> CustomerResult:
        """
        Update a Stripe customer.

        Args:
            customer_id: Stripe customer ID
            email: New email (optional)
            name: New name (optional)
            metadata: Metadata to merge (optional)

        Returns:
            CustomerResult indicating success/failure
        """
        self._check_enabled()

        try:
            update_params: Dict[str, Any] = {}
            if email:
                update_params["email"] = email
            if name:
                update_params["name"] = name
            if metadata:
                update_params["metadata"] = metadata

            stripe.Customer.modify(customer_id, **update_params)
            return CustomerResult(success=True, customer_id=customer_id)

        except stripe.error.StripeError as e:
            logger.error(f"Failed to update customer {customer_id}: {e}")
            return CustomerResult(success=False, error=str(e))

    # =========================================================================
    # Subscription Management
    # =========================================================================

    async def create_subscription(
        self,
        customer_id: str,
        plan_tier: str,
        trial_days: Optional[int] = None,
        payment_behavior: str = "default_incomplete"
    ) -> SubscriptionResult:
        """
        Create a subscription for an existing customer.

        Args:
            customer_id: Stripe customer ID
            plan_tier: Plan tier (starter, professional, enterprise)
            trial_days: Trial period days (defaults to settings.stripe_trial_days)
            payment_behavior: How to handle payment collection

        Returns:
            SubscriptionResult with subscription details
        """
        self._check_enabled()

        price_id = self._price_map.get(plan_tier)
        if not price_id:
            return SubscriptionResult(
                success=False,
                error=f"Invalid plan tier: {plan_tier}. Valid options: {list(self._price_map.keys())}"
            )

        if trial_days is None:
            trial_days = settings.stripe_trial_days

        try:
            subscription = stripe.Subscription.create(
                customer=customer_id,
                items=[{"price": price_id}],
                trial_period_days=trial_days if trial_days > 0 else None,
                payment_behavior=payment_behavior,
                payment_settings={
                    "save_default_payment_method": "on_subscription"
                },
                expand=["latest_invoice.payment_intent"]
            )

            # Extract client secret for frontend payment confirmation
            client_secret = None
            if subscription.latest_invoice and hasattr(subscription.latest_invoice, 'payment_intent'):
                payment_intent = subscription.latest_invoice.payment_intent
                if payment_intent and hasattr(payment_intent, 'client_secret'):
                    client_secret = payment_intent.client_secret

            if settings.enable_gate_logging:
                logger.info(
                    f"[GATE: Stripe] Subscription created",
                    extra={
                        "stripe_customer_id": customer_id,
                        "stripe_subscription_id": subscription.id,
                        "plan_tier": plan_tier,
                        "status": subscription.status
                    }
                )

            return SubscriptionResult(
                success=True,
                subscription_id=subscription.id,
                client_secret=client_secret,
                status=subscription.status
            )

        except stripe.error.StripeError as e:
            logger.error(f"Subscription creation failed for {customer_id}: {e}")
            return SubscriptionResult(success=False, error=str(e))

    async def get_subscription(self, subscription_id: str) -> Optional[SubscriptionInfo]:
        """
        Retrieve subscription details.

        Args:
            subscription_id: Stripe subscription ID

        Returns:
            SubscriptionInfo or None if not found
        """
        self._check_enabled()

        try:
            subscription = stripe.Subscription.retrieve(subscription_id)

            # Determine plan tier from price ID
            plan_tier = None
            if subscription.items.data:
                price_id = subscription.items.data[0].price.id
                for tier, pid in self._price_map.items():
                    if pid == price_id:
                        plan_tier = tier
                        break

            return SubscriptionInfo(
                subscription_id=subscription.id,
                customer_id=subscription.customer,
                status=subscription.status,
                plan_tier=plan_tier,
                current_period_start=datetime.fromtimestamp(subscription.current_period_start) if subscription.current_period_start else None,
                current_period_end=datetime.fromtimestamp(subscription.current_period_end) if subscription.current_period_end else None,
                cancel_at_period_end=subscription.cancel_at_period_end,
                trial_end=datetime.fromtimestamp(subscription.trial_end) if subscription.trial_end else None
            )

        except stripe.error.StripeError as e:
            logger.error(f"Failed to retrieve subscription {subscription_id}: {e}")
            return None

    async def update_subscription(
        self,
        subscription_id: str,
        new_plan_tier: str,
        proration_behavior: str = "create_prorations"
    ) -> SubscriptionResult:
        """
        Update subscription to a new plan (upgrade/downgrade).

        Args:
            subscription_id: Stripe subscription ID
            new_plan_tier: New plan tier
            proration_behavior: How to handle prorations

        Returns:
            SubscriptionResult indicating success/failure
        """
        self._check_enabled()

        price_id = self._price_map.get(new_plan_tier)
        if not price_id:
            return SubscriptionResult(
                success=False,
                error=f"Invalid plan tier: {new_plan_tier}"
            )

        try:
            subscription = stripe.Subscription.retrieve(subscription_id)

            stripe.Subscription.modify(
                subscription_id,
                items=[{
                    "id": subscription["items"]["data"][0].id,
                    "price": price_id,
                }],
                proration_behavior=proration_behavior
            )

            if settings.enable_gate_logging:
                logger.info(
                    f"[GATE: Stripe] Subscription updated",
                    extra={
                        "stripe_subscription_id": subscription_id,
                        "new_plan_tier": new_plan_tier
                    }
                )

            return SubscriptionResult(
                success=True,
                subscription_id=subscription_id,
                status="updated"
            )

        except stripe.error.StripeError as e:
            logger.error(f"Subscription update failed for {subscription_id}: {e}")
            return SubscriptionResult(success=False, error=str(e))

    async def cancel_subscription(
        self,
        subscription_id: str,
        at_period_end: bool = True
    ) -> SubscriptionResult:
        """
        Cancel a subscription.

        Args:
            subscription_id: Stripe subscription ID
            at_period_end: If True, cancel at end of billing period;
                          if False, cancel immediately

        Returns:
            SubscriptionResult indicating success/failure
        """
        self._check_enabled()

        try:
            if at_period_end:
                subscription = stripe.Subscription.modify(
                    subscription_id,
                    cancel_at_period_end=True
                )
                status = "canceling"
            else:
                subscription = stripe.Subscription.delete(subscription_id)
                status = "canceled"

            if settings.enable_gate_logging:
                logger.info(
                    f"[GATE: Stripe] Subscription canceled",
                    extra={
                        "stripe_subscription_id": subscription_id,
                        "at_period_end": at_period_end
                    }
                )

            return SubscriptionResult(
                success=True,
                subscription_id=subscription_id,
                status=status
            )

        except stripe.error.StripeError as e:
            logger.error(f"Subscription cancellation failed for {subscription_id}: {e}")
            return SubscriptionResult(success=False, error=str(e))

    async def reactivate_subscription(self, subscription_id: str) -> SubscriptionResult:
        """
        Reactivate a subscription that was scheduled for cancellation.

        Args:
            subscription_id: Stripe subscription ID

        Returns:
            SubscriptionResult indicating success/failure
        """
        self._check_enabled()

        try:
            stripe.Subscription.modify(
                subscription_id,
                cancel_at_period_end=False
            )

            return SubscriptionResult(
                success=True,
                subscription_id=subscription_id,
                status="active"
            )

        except stripe.error.StripeError as e:
            logger.error(f"Subscription reactivation failed for {subscription_id}: {e}")
            return SubscriptionResult(success=False, error=str(e))

    # =========================================================================
    # Checkout & Portal Sessions
    # =========================================================================

    async def create_checkout_session(
        self,
        customer_id: str,
        plan_tier: str,
        success_url: str,
        cancel_url: str,
        allow_promotion_codes: bool = True
    ) -> CheckoutSessionResult:
        """
        Create a Stripe Checkout session for subscription signup.

        Args:
            customer_id: Stripe customer ID
            plan_tier: Plan tier to subscribe to
            success_url: URL to redirect on success
            cancel_url: URL to redirect on cancellation
            allow_promotion_codes: Allow promo codes

        Returns:
            CheckoutSessionResult with session URL
        """
        self._check_enabled()

        price_id = self._price_map.get(plan_tier)
        if not price_id:
            return CheckoutSessionResult(
                success=False,
                error=f"Invalid plan tier: {plan_tier}"
            )

        try:
            session = stripe.checkout.Session.create(
                customer=customer_id,
                mode="subscription",
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=success_url,
                cancel_url=cancel_url,
                allow_promotion_codes=allow_promotion_codes,
                billing_address_collection="auto",
                customer_update={
                    "address": "auto",
                    "name": "auto"
                }
            )

            return CheckoutSessionResult(
                success=True,
                session_id=session.id,
                url=session.url
            )

        except stripe.error.StripeError as e:
            logger.error(f"Checkout session creation failed: {e}")
            return CheckoutSessionResult(success=False, error=str(e))

    async def create_billing_portal_session(
        self,
        customer_id: str,
        return_url: str
    ) -> PortalSessionResult:
        """
        Create a Stripe Billing Portal session.

        The billing portal allows customers to:
        - View and update payment methods
        - View invoice history
        - Update subscription
        - Cancel subscription

        Args:
            customer_id: Stripe customer ID
            return_url: URL to return to after portal

        Returns:
            PortalSessionResult with portal URL
        """
        self._check_enabled()

        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url
            )

            return PortalSessionResult(
                success=True,
                url=session.url
            )

        except stripe.error.StripeError as e:
            logger.error(f"Billing portal session creation failed: {e}")
            return PortalSessionResult(success=False, error=str(e))

    # =========================================================================
    # Webhook Processing
    # =========================================================================

    def construct_webhook_event(
        self,
        payload: bytes,
        signature: str
    ) -> stripe.Event:
        """
        Verify and construct a webhook event from Stripe.

        Args:
            payload: Raw request body
            signature: Stripe-Signature header value

        Returns:
            Verified Stripe Event object

        Raises:
            ValueError: If payload is invalid
            stripe.error.SignatureVerificationError: If signature is invalid
        """
        if not settings.stripe_webhook_secret:
            raise RuntimeError("Stripe webhook secret not configured")

        return stripe.Webhook.construct_event(
            payload,
            signature,
            settings.stripe_webhook_secret
        )

    # =========================================================================
    # Invoice & Payment Management
    # =========================================================================

    async def get_invoices(
        self,
        customer_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get invoices for a customer.

        Args:
            customer_id: Stripe customer ID
            limit: Maximum number of invoices to retrieve

        Returns:
            List of invoice data dicts
        """
        self._check_enabled()

        try:
            invoices = stripe.Invoice.list(
                customer=customer_id,
                limit=limit
            )

            return [
                {
                    "id": inv.id,
                    "number": inv.number,
                    "amount_due": inv.amount_due,
                    "amount_paid": inv.amount_paid,
                    "currency": inv.currency,
                    "status": inv.status,
                    "created": datetime.fromtimestamp(inv.created),
                    "period_start": datetime.fromtimestamp(inv.period_start) if inv.period_start else None,
                    "period_end": datetime.fromtimestamp(inv.period_end) if inv.period_end else None,
                    "invoice_pdf": inv.invoice_pdf,
                    "hosted_invoice_url": inv.hosted_invoice_url
                }
                for inv in invoices.data
            ]

        except stripe.error.StripeError as e:
            logger.error(f"Failed to retrieve invoices for {customer_id}: {e}")
            return []

    async def get_upcoming_invoice(self, customer_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the upcoming invoice for a customer.

        Args:
            customer_id: Stripe customer ID

        Returns:
            Invoice preview data or None
        """
        self._check_enabled()

        try:
            invoice = stripe.Invoice.upcoming(customer=customer_id)

            return {
                "amount_due": invoice.amount_due,
                "currency": invoice.currency,
                "period_start": datetime.fromtimestamp(invoice.period_start) if invoice.period_start else None,
                "period_end": datetime.fromtimestamp(invoice.period_end) if invoice.period_end else None,
                "lines": [
                    {
                        "description": line.description,
                        "amount": line.amount,
                        "quantity": line.quantity
                    }
                    for line in invoice.lines.data
                ]
            }

        except stripe.error.InvalidRequestError:
            # No upcoming invoice (e.g., no active subscription)
            return None
        except stripe.error.StripeError as e:
            logger.error(f"Failed to retrieve upcoming invoice for {customer_id}: {e}")
            return None

    # =========================================================================
    # Payment Method Management
    # =========================================================================

    async def get_payment_methods(self, customer_id: str) -> List[Dict[str, Any]]:
        """
        Get payment methods for a customer.

        Args:
            customer_id: Stripe customer ID

        Returns:
            List of payment method data
        """
        self._check_enabled()

        try:
            payment_methods = stripe.PaymentMethod.list(
                customer=customer_id,
                type="card"
            )

            return [
                {
                    "id": pm.id,
                    "type": pm.type,
                    "card": {
                        "brand": pm.card.brand,
                        "last4": pm.card.last4,
                        "exp_month": pm.card.exp_month,
                        "exp_year": pm.card.exp_year
                    } if pm.card else None,
                    "created": datetime.fromtimestamp(pm.created)
                }
                for pm in payment_methods.data
            ]

        except stripe.error.StripeError as e:
            logger.error(f"Failed to retrieve payment methods for {customer_id}: {e}")
            return []

    async def set_default_payment_method(
        self,
        customer_id: str,
        payment_method_id: str
    ) -> bool:
        """
        Set the default payment method for a customer.

        Args:
            customer_id: Stripe customer ID
            payment_method_id: Payment method ID to set as default

        Returns:
            True if successful, False otherwise
        """
        self._check_enabled()

        try:
            stripe.Customer.modify(
                customer_id,
                invoice_settings={
                    "default_payment_method": payment_method_id
                }
            )
            return True

        except stripe.error.StripeError as e:
            logger.error(f"Failed to set default payment method: {e}")
            return False


# Singleton instance
stripe_service = StripeService()
