"""
Novu Consumer Service

RabbitMQ consumer that listens for notification events
and triggers Novu workflows for async/non-critical alerts.
"""

import json
import logging
import os
import sys
import time
from typing import Dict, Any, Optional

import pika
from pika.exceptions import AMQPConnectionError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("novu-consumer")

# Configuration from environment
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", "5672"))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "admin")
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "admin123_change_in_production")

NOVU_API_URL = os.getenv("NOVU_API_URL", "http://novu-api:3000")
NOVU_API_KEY = os.getenv("NOVU_API_KEY")

# Stripe configuration (for subscription cancellation on org delete)
STRIPE_API_KEY = os.getenv("STRIPE_SECRET_KEY") or os.getenv("STRIPE_API_KEY")

# Supabase configuration (for updating subscription status)
SUPABASE_DB_HOST = os.getenv("SUPABASE_DB_HOST", "supabase-db")
SUPABASE_DB_PORT = int(os.getenv("SUPABASE_DB_PORT", "5432"))
SUPABASE_DB_NAME = os.getenv("SUPABASE_DB_NAME", "postgres")
SUPABASE_DB_USER = os.getenv("SUPABASE_DB_USER", "postgres")
SUPABASE_DB_PASSWORD = os.getenv("SUPABASE_DB_PASSWORD", "supabase-postgres-secure-2024")

EXCHANGE_NAME = "platform.events"
QUEUE_NAME = "novu-notifications"
ROUTING_KEY_NOTIFICATIONS = "notification.#"  # All notification events
ROUTING_KEY_AUTH = "auth.#"  # Auth events (for subscriber sync)
ROUTING_KEY_CUSTOMER = "customer.#"  # Customer events (org delete, billing)

# Retry settings
MAX_RETRIES = 5
RETRY_DELAY = 5  # seconds


class NovuConsumer:
    """
    RabbitMQ consumer that triggers Novu workflows.

    Listens for notification events published by services and
    triggers the appropriate Novu workflow for each subscriber.
    """

    def __init__(self):
        self.connection = None
        self.channel = None
        self.novu_client = None
        self._init_novu()

    def _init_novu(self):
        """Initialize Novu client using direct HTTP calls for reliability."""
        if not NOVU_API_KEY:
            logger.warning("NOVU_API_KEY not set, running in stub mode")
            self.novu_client = None
            return

        # Use direct HTTP calls instead of SDK for reliability across versions
        self.novu_client = "http"  # Marker to indicate HTTP mode
        logger.info(f"Configured Novu API (HTTP) at {NOVU_API_URL}")

    def _connect_rabbitmq(self) -> bool:
        """
        Connect to RabbitMQ with retry logic.

        Returns:
            True if connected successfully
        """
        for attempt in range(MAX_RETRIES):
            try:
                credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
                parameters = pika.ConnectionParameters(
                    host=RABBITMQ_HOST,
                    port=RABBITMQ_PORT,
                    credentials=credentials,
                    heartbeat=600,
                    blocked_connection_timeout=300,
                )
                self.connection = pika.BlockingConnection(parameters)
                self.channel = self.connection.channel()

                # Declare exchange
                self.channel.exchange_declare(
                    exchange=EXCHANGE_NAME,
                    exchange_type="topic",
                    durable=True,
                )

                # Declare queue
                self.channel.queue_declare(
                    queue=QUEUE_NAME,
                    durable=True,
                    arguments={
                        "x-message-ttl": 86400000,  # 24 hours
                        "x-dead-letter-exchange": f"{EXCHANGE_NAME}.dlx",
                    },
                )

                # Bind queue to exchange for notification events
                self.channel.queue_bind(
                    exchange=EXCHANGE_NAME,
                    queue=QUEUE_NAME,
                    routing_key=ROUTING_KEY_NOTIFICATIONS,
                )

                # Bind queue to exchange for auth events (subscriber sync)
                self.channel.queue_bind(
                    exchange=EXCHANGE_NAME,
                    queue=QUEUE_NAME,
                    routing_key=ROUTING_KEY_AUTH,
                )

                # Bind queue to exchange for customer events (org delete, billing)
                self.channel.queue_bind(
                    exchange=EXCHANGE_NAME,
                    queue=QUEUE_NAME,
                    routing_key=ROUTING_KEY_CUSTOMER,
                )

                logger.info(f"Connected to RabbitMQ at {RABBITMQ_HOST}:{RABBITMQ_PORT}")
                logger.info(f"Bound to exchange '{EXCHANGE_NAME}' with routing keys: {ROUTING_KEY_NOTIFICATIONS}, {ROUTING_KEY_AUTH}, {ROUTING_KEY_CUSTOMER}")
                return True

            except AMQPConnectionError as e:
                logger.warning(f"RabbitMQ connection attempt {attempt + 1}/{MAX_RETRIES} failed: {e}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY)
                else:
                    logger.error("Failed to connect to RabbitMQ after max retries")
                    return False

        return False

    def _create_or_update_subscriber(
        self,
        subscriber_id: str,
        email: str,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Create or update a Novu subscriber.

        Args:
            subscriber_id: Unique subscriber ID (usually user UUID)
            email: Subscriber email address
            first_name: Optional first name
            last_name: Optional last name
            data: Optional custom data (organization_id, plan, etc.)

        Returns:
            True if successful
        """
        if not self.novu_client:
            logger.info(f"[STUB] Would create/update subscriber {subscriber_id}: {email}")
            return True

        try:
            import requests

            # Novu API v1 subscribers endpoint
            url = f"{NOVU_API_URL}/v1/subscribers"
            headers = {
                "Authorization": f"ApiKey {NOVU_API_KEY}",
                "Content-Type": "application/json",
            }
            subscriber_data = {
                "subscriberId": subscriber_id,
                "email": email,
            }
            if first_name:
                subscriber_data["firstName"] = first_name
            if last_name:
                subscriber_data["lastName"] = last_name
            if data:
                subscriber_data["data"] = data

            # POST to create (will update if exists due to Novu's behavior)
            response = requests.post(url, json=subscriber_data, headers=headers, timeout=30)

            if response.status_code in (200, 201):
                logger.info(f"Created/updated Novu subscriber: {subscriber_id} ({email})")
                return True
            elif response.status_code == 409:
                # Subscriber exists, try to update
                update_url = f"{NOVU_API_URL}/v1/subscribers/{subscriber_id}"
                response = requests.put(update_url, json=subscriber_data, headers=headers, timeout=30)
                if response.status_code in (200, 201):
                    logger.info(f"Updated existing Novu subscriber: {subscriber_id}")
                    return True
                else:
                    logger.error(f"Failed to update subscriber: {response.status_code} {response.text}")
                    return False
            else:
                logger.error(f"Novu subscriber API error {response.status_code}: {response.text}")
                return False

        except Exception as e:
            logger.error(f"Failed to create/update subscriber {subscriber_id}: {e}")
            return False

    def _trigger_novu(
        self,
        workflow_id: str,
        subscriber_id: str,
        payload: Dict[str, Any],
        overrides: Optional[Dict] = None,
    ) -> bool:
        """
        Trigger a Novu workflow via HTTP API.

        Args:
            workflow_id: Novu workflow identifier
            subscriber_id: Target subscriber ID
            payload: Notification data
            overrides: Optional channel overrides

        Returns:
            True if triggered successfully
        """
        if not self.novu_client:
            logger.info(f"[STUB] Would trigger {workflow_id} for {subscriber_id}")
            return True

        try:
            import requests

            # Novu API v1 trigger endpoint
            url = f"{NOVU_API_URL}/v1/events/trigger"
            headers = {
                "Authorization": f"ApiKey {NOVU_API_KEY}",
                "Content-Type": "application/json",
            }
            data = {
                "name": workflow_id,
                "to": {"subscriberId": subscriber_id},
                "payload": payload,
            }
            if overrides:
                data["overrides"] = overrides

            response = requests.post(url, json=data, headers=headers, timeout=30)

            if response.status_code in (200, 201):
                result = response.json()
                transaction_id = result.get("data", {}).get("transactionId")
                logger.info(f"Triggered {workflow_id} for {subscriber_id}, txn={transaction_id}")
                return True
            else:
                logger.error(f"Novu API error {response.status_code}: {response.text}")
                return False

        except Exception as e:
            logger.error(f"Failed to trigger {workflow_id}: {e}")
            return False

    def _handle_auth_event(self, message: Dict[str, Any], event_type: str) -> bool:
        """
        Handle auth events for Novu subscriber management.

        Supported events:
        - user_signup: Create Novu subscriber for new user
        - user_updated: Update subscriber data
        - user_deleted: Could be used for subscriber cleanup (future)

        Args:
            message: Event payload
            event_type: Type of auth event

        Returns:
            True if handled successfully
        """
        if event_type == "user_signup":
            # Extract user data from signup event
            user_id = message.get("user_id")
            email = message.get("email")
            full_name = message.get("full_name", "")
            organization_id = message.get("organization_id")
            role = message.get("role", "member")
            plan = message.get("plan", "free")
            status = message.get("status", "active")

            if not user_id or not email:
                logger.error(f"Missing user_id or email in user_signup event: {message}")
                return True  # ACK to avoid requeue loop for bad data

            # Parse full name into first/last
            first_name = None
            last_name = None
            if full_name:
                parts = full_name.split(" ", 1)
                first_name = parts[0]
                last_name = parts[1] if len(parts) > 1 else None

            # Create Novu subscriber
            subscriber_data = {
                "organization_id": organization_id,
                "role": role,
                "plan": plan,
                "subscription_status": status,
            }

            success = self._create_or_update_subscriber(
                subscriber_id=user_id,
                email=email,
                first_name=first_name,
                last_name=last_name,
                data=subscriber_data,
            )

            if success:
                # Optionally trigger a welcome workflow
                welcome_payload = {
                    "email": email,
                    "first_name": first_name or email.split("@")[0],
                    "plan": plan,
                    "trial_end": message.get("trial_end"),
                }
                self._trigger_novu(
                    workflow_id="user-welcome",
                    subscriber_id=user_id,
                    payload=welcome_payload,
                )
                logger.info(f"[AUTH] Created Novu subscriber and triggered welcome for: {email}")

            return success

        elif event_type == "user_updated":
            # Handle user profile updates
            user_id = message.get("user_id")
            email = message.get("email")
            if user_id and email:
                return self._create_or_update_subscriber(
                    subscriber_id=user_id,
                    email=email,
                    first_name=message.get("first_name"),
                    last_name=message.get("last_name"),
                    data=message.get("data"),
                )
            return True

        else:
            logger.warning(f"[AUTH] Unhandled auth event type: {event_type}")
            return True  # ACK unknown events to avoid requeue

    def _cancel_stripe_subscription(self, stripe_subscription_id: str) -> bool:
        """
        Cancel a Stripe subscription.

        Args:
            stripe_subscription_id: Stripe subscription ID (sub_xxx)

        Returns:
            True if cancelled successfully or already cancelled
        """
        if not STRIPE_API_KEY:
            logger.warning("[STRIPE] No API key configured, running in stub mode")
            logger.info(f"[STRIPE][STUB] Would cancel subscription: {stripe_subscription_id}")
            return True

        try:
            import requests

            url = f"https://api.stripe.com/v1/subscriptions/{stripe_subscription_id}"
            headers = {
                "Authorization": f"Bearer {STRIPE_API_KEY}",
                "Content-Type": "application/x-www-form-urlencoded",
            }

            # Cancel immediately (not at period end) since org is being deleted
            response = requests.delete(url, headers=headers, timeout=30)

            if response.status_code == 200:
                result = response.json()
                logger.info(f"[STRIPE] Cancelled subscription {stripe_subscription_id}, status={result.get('status')}")
                return True
            elif response.status_code == 404:
                # Subscription doesn't exist - already cancelled or never created
                logger.warning(f"[STRIPE] Subscription not found (already cancelled?): {stripe_subscription_id}")
                return True
            else:
                error = response.json().get("error", {})
                logger.error(f"[STRIPE] Failed to cancel subscription: {error.get('message', response.text)}")
                return False

        except Exception as e:
            logger.error(f"[STRIPE] Error cancelling subscription {stripe_subscription_id}: {e}")
            return False

    def _update_supabase_subscription_status(
        self, organization_id: str, new_status: str = "canceled"
    ) -> bool:
        """
        Update subscription status in Supabase.

        Args:
            organization_id: Organization UUID
            new_status: New subscription status (canceled, deleted, etc.)

        Returns:
            True if updated successfully
        """
        try:
            import psycopg2

            conn = psycopg2.connect(
                host=SUPABASE_DB_HOST,
                port=SUPABASE_DB_PORT,
                dbname=SUPABASE_DB_NAME,
                user=SUPABASE_DB_USER,
                password=SUPABASE_DB_PASSWORD,
            )
            cursor = conn.cursor()

            # Update subscription status
            cursor.execute(
                """
                UPDATE subscriptions
                SET status = %s::subscription_status, updated_at = NOW(), canceled_at = NOW()
                WHERE organization_id = %s::uuid
                RETURNING id, provider_subscription_id
                """,
                (new_status, organization_id),
            )

            result = cursor.fetchone()
            conn.commit()
            cursor.close()
            conn.close()

            if result:
                logger.info(f"[SUPABASE] Updated subscription {result[0]} to status={new_status}")
                return True
            else:
                logger.warning(f"[SUPABASE] No subscription found for org {organization_id}")
                return True  # Not an error - org may not have had a subscription

        except Exception as e:
            logger.error(f"[SUPABASE] Error updating subscription for org {organization_id}: {e}")
            return False

    def _get_stripe_subscription_id(self, organization_id: str) -> Optional[str]:
        """
        Get Stripe subscription ID for an organization from Supabase.

        Args:
            organization_id: Organization UUID

        Returns:
            Stripe subscription ID or None
        """
        try:
            import psycopg2

            conn = psycopg2.connect(
                host=SUPABASE_DB_HOST,
                port=SUPABASE_DB_PORT,
                dbname=SUPABASE_DB_NAME,
                user=SUPABASE_DB_USER,
                password=SUPABASE_DB_PASSWORD,
            )
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT provider_subscription_id FROM subscriptions
                WHERE organization_id = %s::uuid
                AND provider_subscription_id IS NOT NULL
                AND status NOT IN ('canceled'::subscription_status, 'expired'::subscription_status)
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (organization_id,),
            )

            result = cursor.fetchone()
            cursor.close()
            conn.close()

            if result:
                return result[0]
            return None

        except Exception as e:
            logger.error(f"[SUPABASE] Error looking up subscription for org {organization_id}: {e}")
            return None

    def _handle_bom_uploaded(self, message: Dict[str, Any]) -> bool:
        """
        Handle BOM uploaded event - notify user that file upload is complete.

        Args:
            message: Event payload with bom_id/bom_upload_id, filename, user_id, organization_id
                     (field names from EventPublisher.customer_bom_upload_completed)

        Returns:
            True if handled successfully
        """
        user_id = message.get("user_id")
        filename = message.get("filename", "BOM file")
        # EventPublisher uses 'bom_id' which may be the bom_upload_id
        bom_id = message.get("bom_id") or message.get("bom_upload_id") or message.get("upload_id")
        organization_id = message.get("organization_id")

        if not user_id:
            logger.warning(f"[BOM] No user_id in bom_uploaded event, skipping notification")
            return True  # ACK to avoid requeue

        logger.info(f"[BOM] Processing bom_uploaded: {filename} for user {user_id}")

        # Trigger Novu notification
        payload = {
            "filename": filename,
            "bom_id": bom_id,
            "message": f"Your BOM file '{filename}' has been uploaded and is ready for enrichment.",
            "action_url": f"/bom_uploads/{bom_id}/show" if bom_id else "/bom_uploads",
        }

        success = self._trigger_novu(
            workflow_id="bom-uploaded",
            subscriber_id=user_id,
            payload=payload,
        )

        if success:
            logger.info(f"[BOM] Triggered bom-uploaded notification for {user_id}")
        return True  # Always ACK to avoid requeue

    def _handle_bom_enrichment_completed(self, message: Dict[str, Any]) -> bool:
        """
        Handle BOM enrichment completed event - notify user.

        Args:
            message: Event payload with bom_id, succeeded, failed, etc.
                     (field names from EventPublisher.customer_bom_enrichment_completed)

        Returns:
            True if handled successfully
        """
        user_id = message.get("user_id")
        bom_id = message.get("bom_id") or message.get("job_id")
        filename = message.get("filename", "BOM")
        # EventPublisher uses 'succeeded'/'failed', not 'enriched_count'/'failed_count'
        enriched_count = message.get("succeeded") or message.get("enriched_count", 0)
        failed_count = message.get("failed") or message.get("failed_count", 0)
        # Total from state or calculated
        state = message.get("state", {})
        total_count = state.get("total_items") or message.get("total_count", enriched_count + failed_count)

        if not user_id:
            logger.warning(f"[BOM] No user_id in enrichment_completed event, skipping notification")
            return True  # ACK to avoid requeue

        logger.info(f"[BOM] Processing enrichment_completed: {bom_id} ({enriched_count}/{total_count} enriched)")

        # Determine message based on success rate
        success_rate = (enriched_count / total_count * 100) if total_count > 0 else 0
        if failed_count == 0:
            status_msg = f"All {enriched_count} components enriched successfully!"
        elif success_rate >= 80:
            status_msg = f"{enriched_count} of {total_count} components enriched ({failed_count} failed)"
        else:
            status_msg = f"Enrichment complete with {failed_count} failures. Please review."

        payload = {
            "filename": filename,
            "bom_id": bom_id,
            "enriched_count": enriched_count,
            "failed_count": failed_count,
            "total_count": total_count,
            "success_rate": round(success_rate, 1),
            "message": status_msg,
            "action_url": f"/bom/upload?resume={bom_id}&step=results" if bom_id else "/bom_uploads",
        }

        success = self._trigger_novu(
            workflow_id="bom-enrichment-completed",
            subscriber_id=user_id,
            payload=payload,
        )

        if success:
            logger.info(f"[BOM] Triggered bom-enrichment-completed notification for {user_id}")
        return True

    def _handle_bom_risk_analysis_completed(self, message: Dict[str, Any]) -> bool:
        """
        Handle BOM risk analysis completed event - notify user with risk summary.

        Args:
            message: Event payload with bom_id, average_risk_score, health_grade, etc.
                     (field names from EventPublisher.customer_bom_risk_analysis_completed)

        Returns:
            True if handled successfully
        """
        user_id = message.get("user_id")
        bom_id = message.get("bom_id")
        filename = message.get("filename", "BOM")
        # EventPublisher uses 'average_risk_score'/'health_grade', not 'risk_score'/'risk_grade'
        risk_score = message.get("average_risk_score") or message.get("risk_score")
        risk_grade = message.get("health_grade") or message.get("risk_grade", "N/A")

        if not user_id:
            logger.warning(f"[BOM] No user_id in risk_analysis_completed event, skipping notification")
            return True

        logger.info(f"[BOM] Processing risk_analysis_completed: {bom_id} grade={risk_grade}")

        # Build message based on risk grade
        if risk_grade in ("A", "B"):
            status_msg = f"Great news! Your BOM '{filename}' has a low risk score."
        elif risk_grade == "C":
            status_msg = f"Your BOM '{filename}' has moderate risk. Review recommended."
        else:
            status_msg = f"Attention: Your BOM '{filename}' has elevated risk. Immediate review recommended."

        payload = {
            "filename": filename,
            "bom_id": bom_id,
            "risk_score": risk_score,
            "risk_grade": risk_grade,
            "message": status_msg,
            "action_url": f"/bom/upload?resume={bom_id}&step=results" if bom_id else "/bom_uploads",
        }

        success = self._trigger_novu(
            workflow_id="bom-risk-analysis-completed",
            subscriber_id=user_id,
            payload=payload,
        )

        if success:
            logger.info(f"[BOM] Triggered bom-risk-analysis-completed notification for {user_id}")
        return True

    def _handle_customer_event(self, message: Dict[str, Any], event_type: str) -> bool:
        """
        Handle customer events for billing, cleanup, and BOM workflow notifications.

        Supported events:
        - organization_deleted: Cancel Stripe subscription, cleanup Novu subscribers
        - customer.bom.enrichment_completed: Notify user when BOM enrichment completes
        - customer.bom.risk_analysis_completed: Notify user when risk analysis completes
        - bom_uploaded: Notify user when BOM file is uploaded

        Args:
            message: Event payload
            event_type: Type of customer event

        Returns:
            True if handled successfully
        """
        # BOM Workflow Events
        if event_type in ("customer.bom.enrichment_completed", "enrichment_completed"):
            return self._handle_bom_enrichment_completed(message)

        if event_type in ("customer.bom.risk_analysis_completed", "risk_analysis_completed"):
            return self._handle_bom_risk_analysis_completed(message)

        if event_type in ("bom_uploaded", "customer.bom.uploaded", "customer.bom.upload_completed", "bom_upload_completed"):
            return self._handle_bom_uploaded(message)

        if event_type == "organization_deleted":
            organization_id = message.get("organization_id")
            user_id = message.get("user_id")  # Admin who deleted
            organization_name = message.get("organization_name")

            if not organization_id:
                logger.error(f"[CUSTOMER] Missing organization_id in organization_deleted event")
                return True  # ACK to avoid requeue loop

            logger.info(f"[CUSTOMER] Processing organization delete: {organization_id} ({organization_name})")

            # Step 1: Look up Stripe subscription ID
            stripe_sub_id = self._get_stripe_subscription_id(organization_id)

            # Step 2: Cancel Stripe subscription if exists
            stripe_success = True
            if stripe_sub_id:
                logger.info(f"[CUSTOMER] Found Stripe subscription {stripe_sub_id}, cancelling...")
                stripe_success = self._cancel_stripe_subscription(stripe_sub_id)
            else:
                logger.info(f"[CUSTOMER] No active Stripe subscription found for org {organization_id}")

            # Step 3: Update Supabase subscription status
            supabase_success = self._update_supabase_subscription_status(organization_id, "canceled")

            # Step 4: Optionally notify admins about the deletion
            if user_id:
                self._trigger_novu(
                    workflow_id="organization-deleted",
                    subscriber_id=user_id,
                    payload={
                        "organization_name": organization_name or "Unknown",
                        "organization_id": organization_id,
                        "action": "deleted",
                        "subscription_cancelled": stripe_sub_id is not None,
                    },
                )

            # Consider success if both Stripe and Supabase operations succeeded
            success = stripe_success and supabase_success
            if success:
                logger.info(f"[CUSTOMER] Organization delete processed successfully: {organization_id}")
            else:
                logger.error(f"[CUSTOMER] Organization delete had errors: stripe={stripe_success}, supabase={supabase_success}")

            return success

        else:
            logger.warning(f"[CUSTOMER] Unhandled customer event type: {event_type}")
            return True  # ACK unknown events to avoid requeue

    def _process_message(self, ch, method, properties, body):
        """
        Process incoming events from RabbitMQ.

        Handles three types of events:
        1. Notification events (notification.#):
           {
               "event_type": "notification",
               "workflow_id": "component-lifecycle-change",
               "subscriber_id": "user-uuid",
               "payload": { ... },
               "overrides": { ... }  # optional
           }

        2. Auth events (auth.#) - for subscriber sync:
           {
               "event_type": "user_signup",
               "user_id": "uuid",
               "email": "user@example.com",
               "organization_id": "org-uuid",
               "role": "owner",
               "plan": "free",
               "status": "trialing",
               "full_name": "John Doe"  # optional
           }

        3. Customer events (customer.#) - for billing/cleanup:
           {
               "event_type": "organization_deleted",
               "organization_id": "org-uuid",
               "user_id": "admin-uuid",
               "organization_name": "Acme Corp"
           }
        """
        routing_key = method.routing_key
        try:
            message = json.loads(body)
            # Use event_type from message body, or derive from routing_key if not present
            event_type = message.get("event_type") or routing_key

            logger.info(f"Received event: routing_key={routing_key}, type={event_type}")

            # Handle auth events (subscriber sync)
            if routing_key.startswith("auth."):
                success = self._handle_auth_event(message, event_type)
                if success:
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                else:
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
                return

            # Handle customer events (billing cleanup)
            if routing_key.startswith("customer."):
                success = self._handle_customer_event(message, event_type)
                if success:
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                else:
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
                return

            # Handle notification events (workflow triggers)
            workflow_id = message.get("workflow_id")
            subscriber_id = message.get("subscriber_id")
            payload = message.get("payload", {})
            overrides = message.get("overrides")

            if not workflow_id or not subscriber_id:
                logger.error("Missing workflow_id or subscriber_id in notification message")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return

            # Trigger Novu workflow
            success = self._trigger_novu(
                workflow_id=workflow_id,
                subscriber_id=subscriber_id,
                payload=payload,
                overrides=overrides,
            )

            if success:
                ch.basic_ack(delivery_tag=method.delivery_tag)
            else:
                # Requeue for retry (will go to DLX after TTL)
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in message: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

    def start(self):
        """Start consuming messages from RabbitMQ."""
        if not self._connect_rabbitmq():
            logger.error("Cannot start consumer - RabbitMQ connection failed")
            sys.exit(1)

        # Set QoS
        self.channel.basic_qos(prefetch_count=10)

        # Start consuming
        self.channel.basic_consume(
            queue=QUEUE_NAME,
            on_message_callback=self._process_message,
            auto_ack=False,
        )

        logger.info("Novu consumer started, waiting for messages...")
        logger.info(f"Novu API: {NOVU_API_URL}")
        logger.info(f"Novu configured: {self.novu_client is not None}")

        try:
            self.channel.start_consuming()
        except KeyboardInterrupt:
            logger.info("Shutting down consumer...")
            self.channel.stop_consuming()
        finally:
            if self.connection:
                self.connection.close()

    def stop(self):
        """Stop the consumer gracefully."""
        if self.channel:
            self.channel.stop_consuming()
        if self.connection:
            self.connection.close()


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Novu Consumer Service Starting")
    logger.info("=" * 60)
    logger.info(f"RabbitMQ: {RABBITMQ_HOST}:{RABBITMQ_PORT}")
    logger.info(f"Novu API: {NOVU_API_URL}")
    logger.info(f"Stripe configured: {STRIPE_API_KEY is not None}")
    logger.info(f"Supabase DB: {SUPABASE_DB_HOST}:{SUPABASE_DB_PORT}")
    logger.info(f"Exchange: {EXCHANGE_NAME}")
    logger.info(f"Queue: {QUEUE_NAME}")
    logger.info(f"Routing Keys: {ROUTING_KEY_NOTIFICATIONS}, {ROUTING_KEY_AUTH}, {ROUTING_KEY_CUSTOMER}")
    logger.info("Handles:")
    logger.info("  - notification.# : Novu workflow triggers")
    logger.info("  - auth.#         : Subscriber sync (signup, update)")
    logger.info("  - customer.#     : Billing cleanup (org delete → Stripe cancel)")
    logger.info("=" * 60)

    consumer = NovuConsumer()
    consumer.start()
