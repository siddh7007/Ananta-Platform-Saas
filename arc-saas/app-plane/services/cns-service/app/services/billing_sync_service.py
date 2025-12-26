"""
Billing Database Sync Service

Handles synchronization between Stripe webhook events and the billing database.
Provides an abstraction layer for billing data persistence.

This service ensures:
- Webhook events are recorded for idempotency
- Subscription state is synced to database
- Invoice records are persisted
- Customer data is kept in sync

Usage:
    from app.services.billing_sync_service import billing_sync_service

    # Handle a webhook event
    await billing_sync_service.handle_subscription_created(event_data)

    # Get subscription from database
    sub = await billing_sync_service.get_subscription_by_org(org_id)
"""

import json
import logging
import os
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, Generator, List, Optional
from uuid import UUID
from dataclasses import dataclass

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False
    psycopg2 = None
    RealDictCursor = None

logger = logging.getLogger(__name__)


@dataclass
class BillingCustomer:
    """Billing customer data"""
    id: UUID
    organization_id: UUID
    billing_email: str
    billing_name: Optional[str]
    provider_customer_ids: Dict[str, str]
    created_at: datetime
    updated_at: datetime


@dataclass
class Subscription:
    """Subscription data"""
    id: UUID
    organization_id: UUID
    billing_customer_id: UUID
    plan_id: UUID
    status: str
    current_period_start: datetime
    current_period_end: datetime
    trial_start: Optional[datetime]
    trial_end: Optional[datetime]
    cancel_at_period_end: bool
    canceled_at: Optional[datetime]
    provider: str
    provider_subscription_id: str
    provider_data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


@dataclass
class WebhookEventRecord:
    """Webhook event record for idempotency"""
    id: UUID
    provider: str
    provider_event_id: str
    event_type: str
    payload: Dict[str, Any]
    processed: bool
    processed_at: Optional[datetime]
    processing_error: Optional[str]
    created_at: datetime


class BillingSyncService:
    """
    Service for syncing billing data between Stripe and the database.

    Handles:
    - Webhook event idempotency checking and recording
    - Subscription state synchronization
    - Customer record management
    - Invoice record persistence
    """

    def __init__(self):
        """Initialize the billing sync service."""
        self._connection_string = None
        self._initialized = False
        self._init_connection_string()

    def _init_connection_string(self):
        """Initialize database connection string from environment."""
        # Use Supabase database for billing data
        host = os.getenv("SUPABASE_DB_HOST", "components-v2-supabase-db")
        port = os.getenv("SUPABASE_DB_PORT", "5432")
        database = os.getenv("SUPABASE_DB_NAME", "postgres")
        user = os.getenv("SUPABASE_DB_USER", "postgres")
        password = os.getenv("SUPABASE_DB_PASSWORD", "supabase-postgres-secure-2024")

        self._connection_string = (
            f"host={host} port={port} dbname={database} "
            f"user={user} password={password}"
        )
        self._initialized = True
        logger.debug(f"[BillingSync] Database connection configured: {host}:{port}/{database}")

    @contextmanager
    def _get_connection(self) -> Generator:
        """Get a database connection with automatic cleanup."""
        if not PSYCOPG2_AVAILABLE:
            logger.warning("[BillingSync] psycopg2 not available")
            yield None
            return

        conn = None
        try:
            conn = psycopg2.connect(self._connection_string)
            yield conn
            conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"[BillingSync] Database error: {e}")
            raise
        finally:
            if conn:
                conn.close()

    @contextmanager
    def _get_cursor(self) -> Generator:
        """Get a database cursor with automatic cleanup."""
        with self._get_connection() as conn:
            if conn is None:
                yield None
                return
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            try:
                yield cursor
            finally:
                cursor.close()

    def is_available(self) -> bool:
        """Check if the service is available."""
        if not PSYCOPG2_AVAILABLE:
            return False
        try:
            with self._get_connection() as conn:
                return conn is not None
        except Exception:
            return False

    # =========================================================================
    # Webhook Event Idempotency
    # =========================================================================

    async def check_event_processed(
        self,
        provider: str,
        provider_event_id: str
    ) -> bool:
        """
        Check if a webhook event has already been processed.

        Args:
            provider: Payment provider name (e.g., 'stripe')
            provider_event_id: Provider's event ID

        Returns:
            True if event was already processed
        """
        try:
            with self._get_cursor() as cursor:
                if cursor is None:
                    return False

                cursor.execute(
                    """
                    SELECT id, processed FROM billing_webhook_events
                    WHERE provider = %s AND provider_event_id = %s
                    """,
                    (provider, provider_event_id)
                )
                row = cursor.fetchone()
                if row:
                    return row.get('processed', False)
                return False

        except Exception as e:
            logger.error(f"[BillingSync] Error checking event: {e}")
            return False

    async def record_webhook_event(
        self,
        provider: str,
        provider_event_id: str,
        event_type: str,
        payload: Dict[str, Any],
        processed: bool = False,
        error: Optional[str] = None
    ) -> Optional[UUID]:
        """
        Record a webhook event for idempotency.

        Args:
            provider: Payment provider name
            provider_event_id: Provider's event ID
            event_type: Type of event (e.g., 'customer.subscription.created')
            payload: Full event payload
            processed: Whether event was successfully processed
            error: Error message if processing failed

        Returns:
            Event record ID or None on failure
        """
        try:
            with self._get_cursor() as cursor:
                if cursor is None:
                    return None

                cursor.execute(
                    """
                    INSERT INTO billing_webhook_events
                    (provider, provider_event_id, event_type, payload, processed, processed_at, processing_error)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (provider, provider_event_id)
                    DO UPDATE SET
                        processed = EXCLUDED.processed,
                        processed_at = EXCLUDED.processed_at,
                        processing_error = EXCLUDED.processing_error
                    RETURNING id
                    """,
                    (
                        provider,
                        provider_event_id,
                        event_type,
                        json.dumps(payload),
                        processed,
                        datetime.utcnow() if processed else None,
                        error,
                    )
                )
                row = cursor.fetchone()
                if row:
                    return UUID(str(row['id']))
                return None

        except Exception as e:
            logger.error(f"[BillingSync] Error recording event: {e}")
            return None

    async def mark_event_processed(
        self,
        provider: str,
        provider_event_id: str,
        error: Optional[str] = None
    ) -> bool:
        """
        Mark a webhook event as processed.

        Args:
            provider: Payment provider name
            provider_event_id: Provider's event ID
            error: Error message if processing failed

        Returns:
            True if successful
        """
        try:
            with self._get_cursor() as cursor:
                if cursor is None:
                    return False

                cursor.execute(
                    """
                    UPDATE billing_webhook_events
                    SET processed = %s, processed_at = %s, processing_error = %s
                    WHERE provider = %s AND provider_event_id = %s
                    """,
                    (
                        error is None,
                        datetime.utcnow(),
                        error,
                        provider,
                        provider_event_id,
                    )
                )
                return True

        except Exception as e:
            logger.error(f"[BillingSync] Error marking event processed: {e}")
            return False

    # =========================================================================
    # Customer Management
    # =========================================================================

    async def get_or_create_billing_customer(
        self,
        organization_id: str,
        email: str,
        name: Optional[str] = None
    ) -> Optional[BillingCustomer]:
        """
        Get or create a billing customer record.

        Args:
            organization_id: Organization UUID
            email: Billing email
            name: Billing name

        Returns:
            BillingCustomer or None
        """
        try:
            with self._get_cursor() as cursor:
                if cursor is None:
                    return None

                # Check for existing customer
                cursor.execute(
                    "SELECT * FROM billing_customers WHERE organization_id = %s",
                    (organization_id,)
                )
                row = cursor.fetchone()

                if row:
                    return BillingCustomer(
                        id=UUID(str(row['id'])),
                        organization_id=UUID(str(row['organization_id'])),
                        billing_email=row['billing_email'],
                        billing_name=row.get('billing_name'),
                        provider_customer_ids=row.get('provider_customer_ids') or {},
                        created_at=row['created_at'],
                        updated_at=row['updated_at'],
                    )

                # Create new customer
                cursor.execute(
                    """
                    INSERT INTO billing_customers (organization_id, billing_email, billing_name, provider_customer_ids)
                    VALUES (%s, %s, %s, %s)
                    RETURNING *
                    """,
                    (organization_id, email, name, json.dumps({}))
                )
                row = cursor.fetchone()

                if row:
                    logger.info(f"[BillingSync] Created billing customer for org={organization_id}")
                    return BillingCustomer(
                        id=UUID(str(row['id'])),
                        organization_id=UUID(str(row['organization_id'])),
                        billing_email=row['billing_email'],
                        billing_name=row.get('billing_name'),
                        provider_customer_ids=row.get('provider_customer_ids') or {},
                        created_at=row['created_at'],
                        updated_at=row['updated_at'],
                    )

                return None

        except Exception as e:
            logger.error(f"[BillingSync] Error with billing customer: {e}")
            return None

    async def update_customer_provider_id(
        self,
        organization_id: str,
        provider: str,
        provider_customer_id: str
    ) -> bool:
        """
        Update the provider customer ID for a billing customer.

        Args:
            organization_id: Organization UUID
            provider: Payment provider name
            provider_customer_id: Provider's customer ID

        Returns:
            True if successful
        """
        try:
            with self._get_cursor() as cursor:
                if cursor is None:
                    return False

                # Get current customer
                cursor.execute(
                    "SELECT id, provider_customer_ids FROM billing_customers WHERE organization_id = %s",
                    (organization_id,)
                )
                row = cursor.fetchone()

                if not row:
                    logger.warning(f"[BillingSync] No customer found for org={organization_id}")
                    return False

                # Update provider IDs
                current_ids = row.get('provider_customer_ids') or {}
                current_ids[provider] = provider_customer_id

                cursor.execute(
                    "UPDATE billing_customers SET provider_customer_ids = %s WHERE organization_id = %s",
                    (json.dumps(current_ids), organization_id)
                )

                logger.info(f"[BillingSync] Updated {provider} customer ID for org={organization_id}")
                return True

        except Exception as e:
            logger.error(f"[BillingSync] Error updating customer provider ID: {e}")
            return False

    # =========================================================================
    # Subscription Management
    # =========================================================================

    async def sync_subscription(
        self,
        organization_id: str,
        provider: str,
        provider_subscription_id: str,
        status: str,
        plan_slug: str,
        current_period_start: datetime,
        current_period_end: datetime,
        trial_start: Optional[datetime] = None,
        trial_end: Optional[datetime] = None,
        cancel_at_period_end: bool = False,
        canceled_at: Optional[datetime] = None,
        provider_data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Sync subscription data from provider to database.

        Args:
            organization_id: Organization UUID
            provider: Payment provider name
            provider_subscription_id: Provider's subscription ID
            status: Subscription status
            plan_slug: Plan slug (e.g., 'starter', 'professional')
            current_period_start: Billing period start
            current_period_end: Billing period end
            trial_start: Trial start date
            trial_end: Trial end date
            cancel_at_period_end: Whether subscription cancels at period end
            canceled_at: When subscription was canceled
            provider_data: Additional provider-specific data

        Returns:
            True if successful
        """
        try:
            with self._get_cursor() as cursor:
                if cursor is None:
                    return False

                # Get billing customer
                cursor.execute(
                    "SELECT id FROM billing_customers WHERE organization_id = %s",
                    (organization_id,)
                )
                row = cursor.fetchone()

                if not row:
                    logger.warning(f"[BillingSync] No billing customer for org={organization_id}")
                    return False

                billing_customer_id = row['id']

                # Get plan ID
                cursor.execute(
                    "SELECT id FROM subscription_plans WHERE slug = %s",
                    (plan_slug,)
                )
                row = cursor.fetchone()

                if not row:
                    logger.warning(f"[BillingSync] Unknown plan: {plan_slug}")
                    return False

                plan_id = row['id']

                # Upsert subscription
                cursor.execute(
                    """
                    INSERT INTO subscriptions (
                        organization_id, billing_customer_id, plan_id, status,
                        current_period_start, current_period_end, trial_start, trial_end,
                        cancel_at_period_end, canceled_at, provider, provider_subscription_id, provider_data
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (organization_id) DO UPDATE SET
                        billing_customer_id = EXCLUDED.billing_customer_id,
                        plan_id = EXCLUDED.plan_id,
                        status = EXCLUDED.status,
                        current_period_start = EXCLUDED.current_period_start,
                        current_period_end = EXCLUDED.current_period_end,
                        trial_start = EXCLUDED.trial_start,
                        trial_end = EXCLUDED.trial_end,
                        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
                        canceled_at = EXCLUDED.canceled_at,
                        provider = EXCLUDED.provider,
                        provider_subscription_id = EXCLUDED.provider_subscription_id,
                        provider_data = EXCLUDED.provider_data,
                        updated_at = NOW()
                    """,
                    (
                        organization_id, billing_customer_id, plan_id, status,
                        current_period_start, current_period_end, trial_start, trial_end,
                        cancel_at_period_end, canceled_at, provider, provider_subscription_id,
                        json.dumps(provider_data or {})
                    )
                )

                logger.info(
                    f"[BillingSync] Synced subscription: org={organization_id}, "
                    f"status={status}, plan={plan_slug}"
                )
                return True

        except Exception as e:
            logger.error(f"[BillingSync] Error syncing subscription: {e}")
            return False

    async def get_subscription_by_org(
        self,
        organization_id: str
    ) -> Optional[Subscription]:
        """
        Get subscription for an organization from database.

        Args:
            organization_id: Organization UUID

        Returns:
            Subscription or None
        """
        try:
            with self._get_cursor() as cursor:
                if cursor is None:
                    return None

                cursor.execute(
                    "SELECT * FROM subscriptions WHERE organization_id = %s",
                    (organization_id,)
                )
                row = cursor.fetchone()

                if not row:
                    return None

                return Subscription(
                    id=UUID(str(row['id'])),
                    organization_id=UUID(str(row['organization_id'])),
                    billing_customer_id=UUID(str(row['billing_customer_id'])),
                    plan_id=UUID(str(row['plan_id'])),
                    status=row['status'],
                    current_period_start=row['current_period_start'],
                    current_period_end=row['current_period_end'],
                    trial_start=row.get('trial_start'),
                    trial_end=row.get('trial_end'),
                    cancel_at_period_end=row.get('cancel_at_period_end', False),
                    canceled_at=row.get('canceled_at'),
                    provider=row.get('provider'),
                    provider_subscription_id=row.get('provider_subscription_id'),
                    provider_data=row.get('provider_data') or {},
                    created_at=row['created_at'],
                    updated_at=row['updated_at'],
                )

        except Exception as e:
            logger.error(f"[BillingSync] Error getting subscription: {e}")
            return None

    async def update_subscription_status(
        self,
        organization_id: str,
        status: str,
        cancel_at_period_end: Optional[bool] = None,
        canceled_at: Optional[datetime] = None,
    ) -> bool:
        """
        Update subscription status in database.

        Args:
            organization_id: Organization UUID
            status: New status
            cancel_at_period_end: Whether to cancel at period end
            canceled_at: When subscription was canceled

        Returns:
            True if successful
        """
        try:
            with self._get_cursor() as cursor:
                if cursor is None:
                    return False

                # Build dynamic update
                updates = ["status = %s", "updated_at = NOW()"]
                params = [status]

                if cancel_at_period_end is not None:
                    updates.append("cancel_at_period_end = %s")
                    params.append(cancel_at_period_end)

                if canceled_at is not None:
                    updates.append("canceled_at = %s")
                    params.append(canceled_at)

                params.append(organization_id)

                cursor.execute(
                    f"UPDATE subscriptions SET {', '.join(updates)} WHERE organization_id = %s",
                    params
                )

                logger.info(f"[BillingSync] Updated subscription status: org={organization_id}, status={status}")
                return True

        except Exception as e:
            logger.error(f"[BillingSync] Error updating subscription status: {e}")
            return False

    # =========================================================================
    # Invoice Management
    # =========================================================================

    async def sync_invoice(
        self,
        organization_id: str,
        provider: str,
        provider_invoice_id: str,
        status: str,
        subtotal: int,
        tax: int,
        total: int,
        amount_paid: int,
        amount_due: int,
        currency: str,
        invoice_date: datetime,
        due_date: Optional[datetime] = None,
        paid_at: Optional[datetime] = None,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None,
        invoice_pdf_url: Optional[str] = None,
        hosted_invoice_url: Optional[str] = None,
        provider_data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Sync invoice data from provider to database.

        Args:
            organization_id: Organization UUID
            provider: Payment provider name
            provider_invoice_id: Provider's invoice ID
            status: Invoice status
            subtotal: Subtotal in cents
            tax: Tax amount in cents
            total: Total in cents
            amount_paid: Amount paid in cents
            amount_due: Amount due in cents
            currency: Currency code
            invoice_date: Invoice date
            due_date: Due date
            paid_at: When invoice was paid
            period_start: Billing period start
            period_end: Billing period end
            invoice_pdf_url: PDF download URL
            hosted_invoice_url: Hosted invoice page URL
            provider_data: Additional provider-specific data

        Returns:
            True if successful
        """
        try:
            with self._get_cursor() as cursor:
                if cursor is None:
                    return False

                # Get billing customer
                cursor.execute(
                    "SELECT id FROM billing_customers WHERE organization_id = %s",
                    (organization_id,)
                )
                row = cursor.fetchone()

                if not row:
                    logger.warning(f"[BillingSync] No billing customer for org={organization_id}")
                    return False

                billing_customer_id = row['id']

                # Get subscription ID if exists
                cursor.execute(
                    "SELECT id FROM subscriptions WHERE organization_id = %s",
                    (organization_id,)
                )
                sub_row = cursor.fetchone()
                subscription_id = sub_row['id'] if sub_row else None

                # Upsert invoice
                cursor.execute(
                    """
                    INSERT INTO invoices (
                        organization_id, billing_customer_id, subscription_id, status,
                        subtotal, tax, total, amount_paid, amount_due, currency,
                        invoice_date, due_date, paid_at, period_start, period_end,
                        invoice_pdf_url, hosted_invoice_url, provider, provider_invoice_id, provider_data
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (provider, provider_invoice_id) DO UPDATE SET
                        status = EXCLUDED.status,
                        amount_paid = EXCLUDED.amount_paid,
                        amount_due = EXCLUDED.amount_due,
                        paid_at = EXCLUDED.paid_at,
                        invoice_pdf_url = EXCLUDED.invoice_pdf_url,
                        hosted_invoice_url = EXCLUDED.hosted_invoice_url,
                        provider_data = EXCLUDED.provider_data,
                        updated_at = NOW()
                    """,
                    (
                        organization_id, billing_customer_id, subscription_id, status,
                        subtotal, tax, total, amount_paid, amount_due, currency,
                        invoice_date, due_date, paid_at, period_start, period_end,
                        invoice_pdf_url, hosted_invoice_url, provider, provider_invoice_id,
                        json.dumps(provider_data or {})
                    )
                )

                logger.info(
                    f"[BillingSync] Synced invoice: org={organization_id}, "
                    f"invoice={provider_invoice_id}, status={status}"
                )
                return True

        except Exception as e:
            logger.error(f"[BillingSync] Error syncing invoice: {e}")
            return False

    # =========================================================================
    # Webhook Event Handlers
    # =========================================================================

    async def handle_subscription_created(
        self,
        event_id: str,
        event_data: Dict[str, Any]
    ) -> bool:
        """
        Handle customer.subscription.created webhook event.

        Args:
            event_id: Stripe event ID
            event_data: Event data object

        Returns:
            True if successful
        """
        # Check idempotency
        if await self.check_event_processed('stripe', event_id):
            logger.debug(f"[BillingSync] Event already processed: {event_id}")
            return True

        try:
            # Record event
            await self.record_webhook_event(
                provider='stripe',
                provider_event_id=event_id,
                event_type='customer.subscription.created',
                payload=event_data,
            )

            # Extract subscription data
            sub = event_data
            customer_id = sub.get('customer')
            org_id = sub.get('metadata', {}).get('organization_id')

            if not org_id:
                # Try to get org_id from customer metadata
                logger.warning(f"[BillingSync] No organization_id in subscription metadata: {sub.get('id')}")
                await self.mark_event_processed('stripe', event_id, error="Missing organization_id")
                return False

            # Determine plan from price ID
            plan_slug = 'starter'  # Default
            if sub.get('items', {}).get('data'):
                price_id = sub['items']['data'][0].get('price', {}).get('id', '')
                # You'd map price_id to plan_slug here

            # Sync subscription
            success = await self.sync_subscription(
                organization_id=org_id,
                provider='stripe',
                provider_subscription_id=sub.get('id'),
                status=sub.get('status', 'active'),
                plan_slug=plan_slug,
                current_period_start=datetime.fromtimestamp(sub.get('current_period_start', 0)),
                current_period_end=datetime.fromtimestamp(sub.get('current_period_end', 0)),
                trial_start=datetime.fromtimestamp(sub['trial_start']) if sub.get('trial_start') else None,
                trial_end=datetime.fromtimestamp(sub['trial_end']) if sub.get('trial_end') else None,
                cancel_at_period_end=sub.get('cancel_at_period_end', False),
                provider_data=sub,
            )

            await self.mark_event_processed('stripe', event_id, error=None if success else "Sync failed")
            return success

        except Exception as e:
            logger.error(f"[BillingSync] Error handling subscription.created: {e}")
            await self.mark_event_processed('stripe', event_id, error=str(e))
            return False

    async def handle_subscription_updated(
        self,
        event_id: str,
        event_data: Dict[str, Any]
    ) -> bool:
        """
        Handle customer.subscription.updated webhook event.

        Args:
            event_id: Stripe event ID
            event_data: Event data object

        Returns:
            True if successful
        """
        if await self.check_event_processed('stripe', event_id):
            return True

        try:
            await self.record_webhook_event(
                provider='stripe',
                provider_event_id=event_id,
                event_type='customer.subscription.updated',
                payload=event_data,
            )

            sub = event_data
            org_id = sub.get('metadata', {}).get('organization_id')

            if not org_id:
                await self.mark_event_processed('stripe', event_id, error="Missing organization_id")
                return False

            success = await self.update_subscription_status(
                organization_id=org_id,
                status=sub.get('status', 'active'),
                cancel_at_period_end=sub.get('cancel_at_period_end', False),
                canceled_at=datetime.fromtimestamp(sub['canceled_at']) if sub.get('canceled_at') else None,
            )

            await self.mark_event_processed('stripe', event_id, error=None if success else "Update failed")
            return success

        except Exception as e:
            logger.error(f"[BillingSync] Error handling subscription.updated: {e}")
            await self.mark_event_processed('stripe', event_id, error=str(e))
            return False

    async def handle_subscription_deleted(
        self,
        event_id: str,
        event_data: Dict[str, Any]
    ) -> bool:
        """
        Handle customer.subscription.deleted webhook event.

        Args:
            event_id: Stripe event ID
            event_data: Event data object

        Returns:
            True if successful
        """
        if await self.check_event_processed('stripe', event_id):
            return True

        try:
            await self.record_webhook_event(
                provider='stripe',
                provider_event_id=event_id,
                event_type='customer.subscription.deleted',
                payload=event_data,
            )

            sub = event_data
            org_id = sub.get('metadata', {}).get('organization_id')

            if not org_id:
                await self.mark_event_processed('stripe', event_id, error="Missing organization_id")
                return False

            success = await self.update_subscription_status(
                organization_id=org_id,
                status='canceled',
                canceled_at=datetime.utcnow(),
            )

            await self.mark_event_processed('stripe', event_id, error=None if success else "Delete failed")
            return success

        except Exception as e:
            logger.error(f"[BillingSync] Error handling subscription.deleted: {e}")
            await self.mark_event_processed('stripe', event_id, error=str(e))
            return False

    async def handle_invoice_paid(
        self,
        event_id: str,
        event_data: Dict[str, Any]
    ) -> bool:
        """
        Handle invoice.paid webhook event.

        Args:
            event_id: Stripe event ID
            event_data: Event data object

        Returns:
            True if successful
        """
        if await self.check_event_processed('stripe', event_id):
            return True

        try:
            await self.record_webhook_event(
                provider='stripe',
                provider_event_id=event_id,
                event_type='invoice.paid',
                payload=event_data,
            )

            inv = event_data
            # Get org_id from subscription metadata
            sub_id = inv.get('subscription')
            org_id = inv.get('metadata', {}).get('organization_id')

            if not org_id:
                # Try to look up from database by customer
                logger.warning(f"[BillingSync] No organization_id for invoice: {inv.get('id')}")
                await self.mark_event_processed('stripe', event_id, error="Missing organization_id")
                return False

            success = await self.sync_invoice(
                organization_id=org_id,
                provider='stripe',
                provider_invoice_id=inv.get('id'),
                status='paid',
                subtotal=inv.get('subtotal', 0),
                tax=inv.get('tax', 0) or 0,
                total=inv.get('total', 0),
                amount_paid=inv.get('amount_paid', 0),
                amount_due=0,  # Paid invoice has 0 due
                currency=inv.get('currency', 'usd').upper(),
                invoice_date=datetime.fromtimestamp(inv.get('created', 0)),
                due_date=datetime.fromtimestamp(inv['due_date']) if inv.get('due_date') else None,
                paid_at=datetime.utcnow(),
                period_start=datetime.fromtimestamp(inv['period_start']) if inv.get('period_start') else None,
                period_end=datetime.fromtimestamp(inv['period_end']) if inv.get('period_end') else None,
                invoice_pdf_url=inv.get('invoice_pdf'),
                hosted_invoice_url=inv.get('hosted_invoice_url'),
                provider_data=inv,
            )

            await self.mark_event_processed('stripe', event_id, error=None if success else "Sync failed")
            return success

        except Exception as e:
            logger.error(f"[BillingSync] Error handling invoice.paid: {e}")
            await self.mark_event_processed('stripe', event_id, error=str(e))
            return False

    async def handle_invoice_payment_failed(
        self,
        event_id: str,
        event_data: Dict[str, Any]
    ) -> bool:
        """
        Handle invoice.payment_failed webhook event.

        Args:
            event_id: Stripe event ID
            event_data: Event data object

        Returns:
            True if successful
        """
        if await self.check_event_processed('stripe', event_id):
            return True

        try:
            await self.record_webhook_event(
                provider='stripe',
                provider_event_id=event_id,
                event_type='invoice.payment_failed',
                payload=event_data,
            )

            inv = event_data
            org_id = inv.get('metadata', {}).get('organization_id')

            if org_id:
                # Update subscription to past_due status
                await self.update_subscription_status(
                    organization_id=org_id,
                    status='past_due',
                )

            await self.mark_event_processed('stripe', event_id)
            logger.warning(f"[BillingSync] Invoice payment failed: {inv.get('id')}")
            return True

        except Exception as e:
            logger.error(f"[BillingSync] Error handling invoice.payment_failed: {e}")
            await self.mark_event_processed('stripe', event_id, error=str(e))
            return False

    async def handle_checkout_session_completed(
        self,
        event_id: str,
        event_data: Dict[str, Any]
    ) -> bool:
        """
        Handle checkout.session.completed webhook event.

        Args:
            event_id: Stripe event ID
            event_data: Event data object

        Returns:
            True if successful
        """
        if await self.check_event_processed('stripe', event_id):
            return True

        try:
            await self.record_webhook_event(
                provider='stripe',
                provider_event_id=event_id,
                event_type='checkout.session.completed',
                payload=event_data,
            )

            session = event_data
            org_id = session.get('metadata', {}).get('organization_id')
            customer_id = session.get('customer')

            if org_id and customer_id:
                # Update customer's Stripe ID
                await self.update_customer_provider_id(
                    organization_id=org_id,
                    provider='stripe',
                    provider_customer_id=customer_id,
                )

            await self.mark_event_processed('stripe', event_id)
            logger.info(f"[BillingSync] Checkout completed: session={session.get('id')}")
            return True

        except Exception as e:
            logger.error(f"[BillingSync] Error handling checkout.session.completed: {e}")
            await self.mark_event_processed('stripe', event_id, error=str(e))
            return False


# Singleton instance
billing_sync_service = BillingSyncService()
