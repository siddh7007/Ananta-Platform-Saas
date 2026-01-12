"""
Stripe Billing Provider (Modern StripeClient Pattern)

Implements BaseBillingProvider for Stripe payment processing.
Uses the modern StripeClient pattern with explicit v1 namespace for:
- Better type safety
- V2 API readiness (stripe-python v15+)
- Future-proof API access

Includes async-compatible wrappers for sync Stripe SDK calls.

Requires: stripe>=12.0.0
"""

import asyncio
import hashlib
import logging
import random
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from functools import partial, wraps
from typing import Any, Callable, Dict, List, Optional, TypeVar
from uuid import uuid4

T = TypeVar('T')

# Retry configuration
MAX_RETRIES = 3
RETRY_BASE_DELAY = 0.5  # seconds
RETRY_MAX_DELAY = 10.0  # seconds

try:
    from stripe import StripeClient, StripeError, Webhook
    from stripe import SignatureVerificationError
    STRIPE_AVAILABLE = True
    STRIPE_VERSION = "12+"
except ImportError:
    try:
        # Fallback for older stripe-python versions
        from stripe import StripeClient
        from stripe.error import StripeError, SignatureVerificationError
        import stripe as stripe_module
        Webhook = stripe_module.Webhook
        STRIPE_AVAILABLE = True
        STRIPE_VERSION = "legacy"
    except ImportError:
        STRIPE_AVAILABLE = False
        StripeClient = None
        StripeError = Exception
        SignatureVerificationError = Exception
        Webhook = None
        STRIPE_VERSION = None

from shared.auth_billing.billing.providers.base import BaseBillingProvider
from shared.auth_billing.billing.models import (
    CreateCheckoutResponse,
    CreatePortalResponse,
    InvoiceResponse,
    SubscriptionResponse,
    PlanResponse,
)
from shared.auth_billing.config import BillingConfig

logger = logging.getLogger(__name__)


# Plan slug to Stripe price ID mapping (should be configured via env vars in production)
DEFAULT_PLAN_PRICE_MAP = {
    "starter": "",  # Set via STRIPE_PRICE_STARTER
    "professional": "",  # Set via STRIPE_PRICE_PROFESSIONAL
    "enterprise": "",  # Set via STRIPE_PRICE_ENTERPRISE
}


class StripeProvider(BaseBillingProvider):
    """
    Stripe implementation of BaseBillingProvider using modern StripeClient pattern.

    Handles:
    - Checkout session creation for subscription purchases
    - Billing portal sessions for subscription management
    - Subscription lifecycle (get, update, cancel, reactivate)
    - Invoice retrieval
    - Webhook processing

    Uses StripeClient for:
    - Better type safety
    - V2 API compatibility
    - Future stripe-python v15+ support
    """

    # Shared thread pool for async execution of sync Stripe SDK calls
    _executor: ThreadPoolExecutor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="stripe_")

    # In-memory customer ID cache: org_id -> stripe_customer_id
    # In production, this should be persisted to database
    _customer_cache: Dict[str, str] = {}

    def __init__(self, config: BillingConfig, price_map: Optional[Dict[str, str]] = None):
        """
        Initialize Stripe provider with StripeClient.

        Args:
            config: BillingConfig with Stripe credentials
            price_map: Optional mapping of plan slugs to Stripe price IDs
        """
        self.config = config
        self._price_map = price_map or DEFAULT_PLAN_PRICE_MAP.copy()
        self._initialized = False
        self._client: Optional[StripeClient] = None

        if not STRIPE_AVAILABLE:
            logger.error("[Stripe] Stripe library not installed. Run: pip install stripe>=12.0.0")
            return

        if config.stripe_secret_key:
            # Initialize modern StripeClient
            self._client = StripeClient(api_key=config.stripe_secret_key)
            self._initialized = True
            logger.info(f"[Stripe] Provider initialized with StripeClient (version: {STRIPE_VERSION})")
        else:
            logger.warning("[Stripe] Provider not initialized - missing secret key")

    async def _run_sync(self, func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
        """
        Run a synchronous Stripe SDK call in the thread pool executor.

        This enables non-blocking async execution of the sync stripe-python SDK,
        preventing event loop blocking under concurrent load.

        Args:
            func: The sync function to execute
            *args: Positional arguments for the function
            **kwargs: Keyword arguments for the function

        Returns:
            The result of the function call
        """
        # Use get_running_loop() (Python 3.10+) with fallback
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.get_event_loop()
        if kwargs:
            func = partial(func, **kwargs)
        return await loop.run_in_executor(self._executor, func, *args)

    @property
    def provider_name(self) -> str:
        return "stripe"

    @property
    def is_configured(self) -> bool:
        return self._initialized and self._client is not None

    def set_price_map(self, price_map: Dict[str, str]) -> None:
        """Update the plan slug to price ID mapping."""
        self._price_map.update(price_map)
        logger.debug(f"[Stripe] Updated price map: {list(self._price_map.keys())}")

    def _check_initialized(self) -> None:
        """Raise error if not initialized."""
        if not self._initialized or not self._client:
            raise RuntimeError("Stripe provider not initialized. Check configuration.")

    def _generate_idempotency_key(self, operation: str, *args: Any) -> str:
        """
        Generate an idempotency key for Stripe operations.

        Uses a hash of operation + args to prevent duplicate API calls
        for the same logical operation.

        Args:
            operation: Operation name (e.g., "checkout", "update_subscription")
            *args: Arguments that define the unique operation

        Returns:
            A deterministic idempotency key string
        """
        key_data = f"{operation}:{':'.join(str(a) for a in args)}"
        return hashlib.sha256(key_data.encode()).hexdigest()[:32]

    def _is_retryable_error(self, error: Exception) -> bool:
        """
        Check if a Stripe error is retryable (transient).

        Retryable errors include:
        - Rate limit errors (429)
        - Network/connection errors
        - Temporary server errors (500, 502, 503, 504)
        """
        if not STRIPE_AVAILABLE:
            return False

        # Check for rate limit or temporary errors
        if hasattr(error, 'http_status'):
            status = error.http_status
            return status in (429, 500, 502, 503, 504)

        # Check for connection errors
        error_str = str(error).lower()
        retryable_patterns = ['connection', 'timeout', 'temporarily', 'rate limit']
        return any(pattern in error_str for pattern in retryable_patterns)

    def _retry_with_backoff(self, func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
        """
        Execute a function with exponential backoff retry.

        Args:
            func: The function to execute
            *args: Positional arguments
            **kwargs: Keyword arguments

        Returns:
            The function result

        Raises:
            The last exception if all retries fail
        """
        last_exception = None

        for attempt in range(MAX_RETRIES):
            try:
                return func(*args, **kwargs)
            except StripeError as e:
                last_exception = e
                if not self._is_retryable_error(e) or attempt == MAX_RETRIES - 1:
                    raise

                # Calculate delay with exponential backoff + jitter
                delay = min(
                    RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, 0.5),
                    RETRY_MAX_DELAY
                )
                logger.warning(
                    f"[Stripe] Retryable error (attempt {attempt + 1}/{MAX_RETRIES}), "
                    f"retrying in {delay:.2f}s: {e}"
                )
                time.sleep(delay)

        raise last_exception

    async def _get_or_create_customer(
        self,
        organization_id: str,
        email: Optional[str] = None
    ) -> Optional[str]:
        """
        Get existing Stripe customer or create new one using StripeClient.

        Uses in-memory cache to avoid repeated Stripe API calls.
        In production, the cache should be backed by database persistence.
        """
        self._check_initialized()

        # Check cache first
        if organization_id in self._customer_cache:
            customer_id = self._customer_cache[organization_id]
            logger.debug(f"[Stripe] Customer cache hit: org={organization_id} -> {customer_id}")
            return customer_id

        try:
            logger.debug(f"[Stripe] Looking up customer for org={organization_id}")

            # Search for existing customer by organization_id metadata
            # Using retry wrapper for transient failures
            search_result = self._retry_with_backoff(
                self._client.v1.customers.search,
                params={"query": f'metadata["organization_id"]:"{organization_id}"'}
            )

            if search_result.data:
                customer_id = search_result.data[0].id
                # Cache the result
                self._customer_cache[organization_id] = customer_id
                logger.debug(f"[Stripe] Found existing customer {customer_id} for org={organization_id}")
                return customer_id

            # Create new customer if not found
            if email:
                customer = self._retry_with_backoff(
                    self._client.v1.customers.create,
                    params={
                        "email": email,
                        "metadata": {
                            "organization_id": organization_id,
                            "source": "components_platform"
                        }
                    }
                )
                # Cache the new customer
                self._customer_cache[organization_id] = customer.id
                logger.info(f"[Stripe] Created customer {customer.id} for org={organization_id}")
                return customer.id

            logger.warning(f"[Stripe] No customer found and no email provided for org={organization_id}")
            return None

        except StripeError as e:
            logger.error(f"[Stripe] Error getting/creating customer for org={organization_id}: {e}")
            return None

    async def create_checkout_session(
        self,
        organization_id: str,
        plan_slug: str,
        billing_interval: str,
        success_url: str,
        cancel_url: str,
        customer_email: Optional[str] = None,
    ) -> CreateCheckoutResponse:
        """Create a Stripe Checkout session using StripeClient."""
        self._check_initialized()

        logger.info(f"[Stripe] Creating checkout session: org={organization_id}, plan={plan_slug}, interval={billing_interval}")

        # Get price ID for plan
        price_id = self._price_map.get(plan_slug)
        if not price_id:
            logger.error(f"[Stripe] No price ID configured for plan: {plan_slug}. Available: {list(self._price_map.keys())}")
            raise ValueError(f"No price ID configured for plan: {plan_slug}")

        try:
            # Get or create customer
            customer_id = await self._get_or_create_customer(organization_id, customer_email)

            session_params = {
                "mode": "subscription",
                "line_items": [{"price": price_id, "quantity": 1}],
                "success_url": success_url,
                "cancel_url": cancel_url,
                "allow_promotion_codes": True,
                "billing_address_collection": "auto",
                "metadata": {
                    "organization_id": organization_id,
                    "plan_slug": plan_slug,
                }
            }

            if customer_id:
                session_params["customer"] = customer_id
                session_params["customer_update"] = {"address": "auto", "name": "auto"}
                logger.debug(f"[Stripe] Using existing customer {customer_id}")
            elif customer_email:
                session_params["customer_email"] = customer_email
                logger.debug(f"[Stripe] Using customer email {customer_email}")

            # Generate idempotency key to prevent duplicate sessions
            idempotency_key = self._generate_idempotency_key(
                "checkout", organization_id, plan_slug, billing_interval
            )

            # Create checkout session using explicit v1 namespace
            session = self._client.v1.checkout.sessions.create(
                params=session_params,
                options={"idempotency_key": idempotency_key}
            )

            logger.info(f"[Stripe] Checkout session created: session_id={session.id}, org={organization_id}, plan={plan_slug}")

            return CreateCheckoutResponse(
                checkout_url=session.url,
                session_id=session.id,
                provider="stripe"
            )

        except StripeError as e:
            logger.error(f"[Stripe] Checkout session creation failed for org={organization_id}: {e}")
            raise RuntimeError(f"Failed to create checkout session: {e}")

    async def create_billing_portal(
        self,
        organization_id: str,
        return_url: str,
    ) -> CreatePortalResponse:
        """Create a Stripe Billing Portal session using StripeClient."""
        self._check_initialized()

        logger.info(f"[Stripe] Creating billing portal session for org={organization_id}")

        try:
            customer_id = await self._get_or_create_customer(organization_id)

            if not customer_id:
                logger.error(f"[Stripe] No customer found for org={organization_id}")
                raise ValueError(f"No Stripe customer found for organization {organization_id}")

            # Create billing portal session using explicit v1 namespace
            session = self._client.v1.billing_portal.sessions.create(
                params={
                    "customer": customer_id,
                    "return_url": return_url
                }
            )

            logger.info(f"[Stripe] Billing portal session created for org={organization_id}")

            return CreatePortalResponse(
                portal_url=session.url,
                provider="stripe"
            )

        except StripeError as e:
            logger.error(f"[Stripe] Billing portal creation failed for org={organization_id}: {e}")
            raise RuntimeError(f"Failed to create billing portal: {e}")

    async def get_subscription(
        self,
        organization_id: str,
    ) -> Optional[SubscriptionResponse]:
        """Get current subscription for an organization using StripeClient."""
        self._check_initialized()

        logger.debug(f"[Stripe] Getting subscription for org={organization_id}")

        try:
            customer_id = await self._get_or_create_customer(organization_id)

            if not customer_id:
                logger.debug(f"[Stripe] No customer found for org={organization_id}")
                return None

            # List subscriptions using explicit v1 namespace
            subscriptions = self._client.v1.subscriptions.list(
                params={
                    "customer": customer_id,
                    "status": "all",
                    "limit": 1
                }
            )

            if not subscriptions.data:
                logger.debug(f"[Stripe] No subscriptions found for org={organization_id}")
                return None

            sub = subscriptions.data[0]
            logger.debug(f"[Stripe] Found subscription {sub.id} status={sub.status} for org={organization_id}")

            # Determine plan from price ID
            plan_slug = "unknown"
            plan_tier = "free"
            if sub.items and sub.items.data:
                price_id = sub.items.data[0].price.id
                for slug, pid in self._price_map.items():
                    if pid == price_id:
                        plan_slug = slug
                        plan_tier = slug
                        break

            # Build plan response
            price_amount = 0
            billing_interval = "month"
            if sub.items and sub.items.data:
                price_obj = sub.items.data[0].price
                price_amount = price_obj.unit_amount if price_obj.unit_amount else 0
                if price_obj.recurring:
                    billing_interval = price_obj.recurring.interval

            plan = PlanResponse(
                id=uuid4(),  # Would come from database in production
                name=plan_slug.title(),
                tier=plan_tier,
                slug=plan_slug,
                price_monthly=price_amount,
                currency=sub.currency.upper() if sub.currency else "USD",
                billing_interval=billing_interval,
            )

            return SubscriptionResponse(
                id=uuid4(),  # Would be your internal subscription ID
                plan=plan,
                status=sub.status,
                current_period_start=datetime.fromtimestamp(sub.current_period_start),
                current_period_end=datetime.fromtimestamp(sub.current_period_end),
                trial_start=datetime.fromtimestamp(sub.trial_start) if sub.trial_start else None,
                trial_end=datetime.fromtimestamp(sub.trial_end) if sub.trial_end else None,
                cancel_at_period_end=sub.cancel_at_period_end,
                canceled_at=datetime.fromtimestamp(sub.canceled_at) if sub.canceled_at else None,
            )

        except StripeError as e:
            logger.error(f"[Stripe] Get subscription failed for org={organization_id}: {e}")
            return None

    async def update_subscription(
        self,
        organization_id: str,
        new_plan_slug: str,
        billing_interval: Optional[str] = None,
    ) -> bool:
        """Update subscription to a new plan using StripeClient."""
        self._check_initialized()

        logger.info(f"[Stripe] Updating subscription for org={organization_id} to plan={new_plan_slug}")

        # Get new price ID
        new_price_id = self._price_map.get(new_plan_slug)
        if not new_price_id:
            logger.error(f"[Stripe] No price ID configured for plan: {new_plan_slug}")
            raise ValueError(f"No price ID configured for plan: {new_plan_slug}")

        try:
            customer_id = await self._get_or_create_customer(organization_id)

            if not customer_id:
                logger.error(f"[Stripe] No customer found for org={organization_id}")
                return False

            # Find active subscription using explicit v1 namespace
            subscriptions = self._client.v1.subscriptions.list(
                params={
                    "customer": customer_id,
                    "status": "active",
                    "limit": 1
                }
            )

            if not subscriptions.data:
                logger.warning(f"[Stripe] No active subscription for org={organization_id}")
                return False

            sub = subscriptions.data[0]
            sub_item_id = sub.items.data[0].id if sub.items and sub.items.data else None

            if not sub_item_id:
                logger.error(f"[Stripe] No subscription item found for sub={sub.id}")
                return False

            # Update subscription using explicit v1 namespace
            self._client.v1.subscriptions.update(
                sub.id,
                params={
                    "items": [{
                        "id": sub_item_id,
                        "price": new_price_id,
                    }],
                    "proration_behavior": "create_prorations"
                }
            )

            logger.info(f"[Stripe] Subscription updated: sub_id={sub.id}, new_plan={new_plan_slug}, org={organization_id}")
            return True

        except StripeError as e:
            logger.error(f"[Stripe] Update subscription failed for org={organization_id}: {e}")
            return False

    async def cancel_subscription(
        self,
        organization_id: str,
        cancel_immediately: bool = False,
    ) -> bool:
        """Cancel a subscription using StripeClient."""
        self._check_initialized()

        logger.info(f"[Stripe] Canceling subscription for org={organization_id}, immediately={cancel_immediately}")

        try:
            customer_id = await self._get_or_create_customer(organization_id)

            if not customer_id:
                logger.warning(f"[Stripe] No customer found for org={organization_id}")
                return False

            # Find active subscription using explicit v1 namespace
            subscriptions = self._client.v1.subscriptions.list(
                params={
                    "customer": customer_id,
                    "status": "active",
                    "limit": 1
                }
            )

            if not subscriptions.data:
                logger.warning(f"[Stripe] No active subscription for org={organization_id}")
                return False

            sub_id = subscriptions.data[0].id

            if cancel_immediately:
                # Cancel immediately using explicit v1 namespace
                self._client.v1.subscriptions.cancel(sub_id)
                logger.info(f"[Stripe] Immediately canceled subscription {sub_id} for org={organization_id}")
            else:
                # Schedule cancellation at period end
                self._client.v1.subscriptions.update(
                    sub_id,
                    params={"cancel_at_period_end": True}
                )
                logger.info(f"[Stripe] Scheduled subscription {sub_id} for cancellation at period end, org={organization_id}")

            return True

        except StripeError as e:
            logger.error(f"[Stripe] Cancel subscription failed for org={organization_id}: {e}")
            return False

    async def reactivate_subscription(
        self,
        organization_id: str,
    ) -> bool:
        """Reactivate a subscription scheduled for cancellation using StripeClient."""
        self._check_initialized()

        logger.info(f"[Stripe] Reactivating subscription for org={organization_id}")

        try:
            customer_id = await self._get_or_create_customer(organization_id)

            if not customer_id:
                logger.warning(f"[Stripe] No customer found for org={organization_id}")
                return False

            # Find subscription using explicit v1 namespace
            subscriptions = self._client.v1.subscriptions.list(
                params={
                    "customer": customer_id,
                    "limit": 1
                }
            )

            if not subscriptions.data:
                logger.warning(f"[Stripe] No subscription found for org={organization_id}")
                return False

            sub = subscriptions.data[0]

            if not sub.cancel_at_period_end:
                logger.info(f"[Stripe] Subscription {sub.id} is not scheduled for cancellation, org={organization_id}")
                return True

            # Reactivate using explicit v1 namespace
            self._client.v1.subscriptions.update(
                sub.id,
                params={"cancel_at_period_end": False}
            )
            logger.info(f"[Stripe] Reactivated subscription {sub.id} for org={organization_id}")

            return True

        except StripeError as e:
            logger.error(f"[Stripe] Reactivate subscription failed for org={organization_id}: {e}")
            return False

    async def list_invoices(
        self,
        organization_id: str,
        limit: int = 10,
        offset: int = 0,
        starting_after: Optional[str] = None,
    ) -> List[InvoiceResponse]:
        """
        List invoices for an organization using StripeClient.

        Supports cursor-based pagination via starting_after parameter.
        The offset parameter is deprecated and will log a warning if used.

        Args:
            organization_id: Organization UUID
            limit: Max invoices to return (1-100)
            offset: Deprecated - use starting_after instead
            starting_after: Stripe invoice ID to start after (for pagination)

        Returns:
            List of InvoiceResponse
        """
        self._check_initialized()

        if offset > 0:
            logger.warning(f"[Stripe] Offset pagination deprecated. Use starting_after. offset={offset} ignored.")

        logger.debug(f"[Stripe] Listing invoices for org={organization_id}, limit={limit}, starting_after={starting_after}")

        try:
            customer_id = await self._get_or_create_customer(organization_id)

            if not customer_id:
                logger.debug(f"[Stripe] No customer found for org={organization_id}")
                return []

            # Build params with cursor-based pagination
            params = {
                "customer": customer_id,
                "limit": min(limit, 100),  # Stripe max is 100
            }
            if starting_after:
                params["starting_after"] = starting_after

            # List invoices using explicit v1 namespace with retry
            invoices = self._retry_with_backoff(
                self._client.v1.invoices.list,
                params=params
            )

            logger.debug(f"[Stripe] Found {len(invoices.data)} invoices for org={organization_id}")

            result = []
            for inv in invoices.data:
                paid_at = None
                if inv.status_transitions and inv.status_transitions.paid_at:
                    paid_at = datetime.fromtimestamp(inv.status_transitions.paid_at)

                result.append(InvoiceResponse(
                    id=uuid4(),  # Would be your internal invoice ID
                    invoice_number=inv.number or f"INV-{inv.id[:8]}",
                    status=inv.status or "draft",
                    subtotal=inv.subtotal or 0,
                    tax=inv.tax or 0,
                    total=inv.total or 0,
                    amount_paid=inv.amount_paid or 0,
                    amount_due=inv.amount_due or 0,
                    currency=inv.currency.upper() if inv.currency else "USD",
                    invoice_date=datetime.fromtimestamp(inv.created),
                    due_date=datetime.fromtimestamp(inv.due_date) if inv.due_date else None,
                    paid_at=paid_at,
                    invoice_pdf_url=inv.invoice_pdf,
                ))

            return result

        except StripeError as e:
            logger.error(f"[Stripe] List invoices failed for org={organization_id}: {e}")
            return []

    async def handle_webhook(
        self,
        payload: bytes,
        headers: dict,
    ) -> dict:
        """
        Handle incoming Stripe webhook.

        Note: Webhook verification still uses stripe.Webhook.construct_event()
        as StripeClient webhook handling is the same pattern.
        """
        self._check_initialized()

        signature = headers.get("Stripe-Signature") or headers.get("stripe-signature")

        if not signature:
            logger.warning("[Stripe] No signature in webhook request")
            return {"success": False, "error": "Missing signature"}

        if not self.config.stripe_webhook_secret:
            logger.error("[Stripe] Webhook secret not configured")
            return {"success": False, "error": "Webhook secret not configured"}

        try:
            # Construct and verify webhook event
            # Using imported Webhook class for signature verification
            event = Webhook.construct_event(
                payload,
                signature,
                self.config.stripe_webhook_secret
            )

            logger.info(f"[Stripe] Webhook received: type={event.type}, id={event.id}")

            # Extract common data
            event_data = event.data.object
            organization_id = None

            # Try to get organization_id from metadata
            if hasattr(event_data, 'metadata') and event_data.metadata:
                organization_id = event_data.metadata.get('organization_id')

            # Handle specific event types with database sync
            # Import sync service lazily to avoid circular imports
            sync_service = None
            try:
                from app.services.billing_sync_service import billing_sync_service
                sync_service = billing_sync_service
            except ImportError:
                logger.debug("[Stripe] Billing sync service not available")

            # Convert event data to dict for sync service
            event_dict = event_data.to_dict() if hasattr(event_data, 'to_dict') else dict(event_data)

            if event.type == "customer.subscription.created":
                sub = event_data
                logger.info(f"[Stripe] Subscription created: sub_id={sub.id}, customer={sub.customer}, status={sub.status}")
                if sync_service and sync_service.is_available():
                    await sync_service.handle_subscription_created(event.id, event_dict)

            elif event.type == "customer.subscription.updated":
                sub = event_data
                logger.info(f"[Stripe] Subscription updated: sub_id={sub.id}, status={sub.status}, cancel_at_period_end={sub.cancel_at_period_end}")
                if sync_service and sync_service.is_available():
                    await sync_service.handle_subscription_updated(event.id, event_dict)

            elif event.type == "customer.subscription.deleted":
                sub = event_data
                logger.info(f"[Stripe] Subscription deleted: sub_id={sub.id}, customer={sub.customer}")
                if sync_service and sync_service.is_available():
                    await sync_service.handle_subscription_deleted(event.id, event_dict)

            elif event.type == "invoice.paid":
                inv = event_data
                logger.info(f"[Stripe] Invoice paid: invoice_id={inv.id}, customer={inv.customer}, amount={inv.amount_paid}")
                if sync_service and sync_service.is_available():
                    await sync_service.handle_invoice_paid(event.id, event_dict)

            elif event.type == "invoice.payment_failed":
                inv = event_data
                logger.warning(f"[Stripe] Invoice payment failed: invoice_id={inv.id}, customer={inv.customer}, attempt={inv.attempt_count}")
                if sync_service and sync_service.is_available():
                    await sync_service.handle_invoice_payment_failed(event.id, event_dict)

            elif event.type == "checkout.session.completed":
                session = event_data
                logger.info(f"[Stripe] Checkout session completed: session_id={session.id}, customer={session.customer}")
                if sync_service and sync_service.is_available():
                    await sync_service.handle_checkout_session_completed(event.id, event_dict)

            elif event.type == "customer.updated":
                customer = event_data
                logger.debug(f"[Stripe] Customer updated: customer_id={customer.id}")

            else:
                logger.debug(f"[Stripe] Unhandled webhook event type: {event.type}")

            return {
                "success": True,
                "event_type": event.type,
                "event_id": event.id,
                "organization_id": organization_id
            }

        except SignatureVerificationError as e:
            logger.error(f"[Stripe] Webhook signature verification failed: {e}")
            return {"success": False, "error": "Invalid signature"}
        except Exception as e:
            logger.error(f"[Stripe] Webhook processing failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
