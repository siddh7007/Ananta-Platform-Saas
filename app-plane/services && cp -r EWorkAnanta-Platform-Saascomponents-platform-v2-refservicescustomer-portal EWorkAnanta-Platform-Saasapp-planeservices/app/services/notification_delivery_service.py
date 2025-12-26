"""
Notification Delivery Service

Processes queued alert deliveries via email and webhook channels.
Handles retries, rate limiting, and delivery status tracking.

Delivery Methods:
- email: SMTP delivery (configurable via environment)
- webhook: HTTP POST to configured endpoints
- in_app: Already delivered at alert creation time

Status Flow:
- pending -> delivered (success)
- pending -> failed (after max retries)
- pending -> retry (temporary failure, will retry)

Configuration via environment:
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
- SMTP_FROM_EMAIL, SMTP_FROM_NAME
- NOTIFICATION_WEBHOOK_TIMEOUT_SECONDS
- NOTIFICATION_MAX_RETRIES
"""

import logging
import asyncio
import json
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

import httpx
from sqlalchemy import text

from app.models.dual_database import get_dual_database
from app.config import get_settings

logger = logging.getLogger(__name__)


class DeliveryMethod(str, Enum):
    """Supported delivery methods."""
    EMAIL = "email"
    WEBHOOK = "webhook"
    IN_APP = "in_app"


class DeliveryStatus(str, Enum):
    """Delivery status values."""
    PENDING = "pending"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETRY = "retry"


@dataclass
class DeliveryTask:
    """A delivery task from the queue."""
    id: str
    alert_id: str
    delivery_method: str
    recipient: str
    status: str
    retry_count: int = 0
    last_error: Optional[str] = None
    # Alert details (populated from join)
    alert_title: Optional[str] = None
    alert_message: Optional[str] = None
    alert_severity: Optional[str] = None
    alert_type: Optional[str] = None
    alert_context: Optional[Dict[str, Any]] = None
    organization_id: Optional[str] = None


@dataclass
class DeliveryResult:
    """Result of a delivery attempt."""
    success: bool
    status: str
    error_message: Optional[str] = None
    retry: bool = False


# =============================================================================
# DELIVERY PROVIDERS (Abstract Base + Implementations)
# =============================================================================

class DeliveryProvider(ABC):
    """Abstract base class for delivery providers."""

    @abstractmethod
    async def deliver(self, task: DeliveryTask) -> DeliveryResult:
        """
        Deliver an alert notification.

        Args:
            task: The delivery task containing alert and recipient info

        Returns:
            DeliveryResult with success status and any error info
        """
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Check if the provider is properly configured."""
        pass


class EmailDeliveryProvider(DeliveryProvider):
    """
    Email delivery via SMTP.

    NOTE: This is a stub implementation. In production, replace with:
    - SendGrid, AWS SES, Mailgun, or direct SMTP

    Configuration:
    - SMTP_HOST: SMTP server hostname
    - SMTP_PORT: SMTP server port (default: 587)
    - SMTP_USER: SMTP authentication username
    - SMTP_PASSWORD: SMTP authentication password
    - SMTP_FROM_EMAIL: Sender email address
    - SMTP_FROM_NAME: Sender display name
    - SMTP_USE_TLS: Enable TLS (default: true)
    """

    def __init__(self):
        self.settings = get_settings()
        self._configured = False
        self._check_configuration()

    def _check_configuration(self):
        """Check if SMTP is configured."""
        try:
            smtp_host = getattr(self.settings, 'SMTP_HOST', None)
            smtp_from = getattr(self.settings, 'SMTP_FROM_EMAIL', None)

            self._configured = bool(smtp_host and smtp_from)

            if self._configured:
                logger.info("[EmailProvider] SMTP configured and ready")
            else:
                logger.info(
                    "[EmailProvider] SMTP not configured - email delivery disabled. "
                    "Set SMTP_HOST and SMTP_FROM_EMAIL to enable."
                )
        except Exception as e:
            logger.warning(f"[EmailProvider] Configuration check failed: {e}")
            self._configured = False

    def is_configured(self) -> bool:
        return self._configured

    async def deliver(self, task: DeliveryTask) -> DeliveryResult:
        """
        Deliver alert via email.

        STUB IMPLEMENTATION - logs delivery attempt but doesn't send.
        Replace with actual SMTP implementation in production.
        """
        if not self._configured:
            logger.debug("[EmailProvider] Skipping - not configured")
            return DeliveryResult(
                success=False,
                status=DeliveryStatus.FAILED.value,
                error_message="Email delivery not configured",
                retry=False
            )

        try:
            # Log the delivery attempt
            logger.info(
                f"[EmailProvider] STUB: Would send email to {task.recipient} | "
                f"Alert: {task.alert_title} | Severity: {task.alert_severity}"
            )

            # --- STUB: Replace with actual SMTP implementation ---
            # Example with smtplib:
            #
            # import smtplib
            # from email.mime.text import MIMEText
            # from email.mime.multipart import MIMEMultipart
            #
            # msg = MIMEMultipart('alternative')
            # msg['Subject'] = f"[{task.alert_severity}] {task.alert_title}"
            # msg['From'] = f"{self.settings.SMTP_FROM_NAME} <{self.settings.SMTP_FROM_EMAIL}>"
            # msg['To'] = task.recipient
            #
            # html_body = self._render_email_template(task)
            # msg.attach(MIMEText(html_body, 'html'))
            #
            # with smtplib.SMTP(self.settings.SMTP_HOST, self.settings.SMTP_PORT) as server:
            #     if self.settings.SMTP_USE_TLS:
            #         server.starttls()
            #     server.login(self.settings.SMTP_USER, self.settings.SMTP_PASSWORD)
            #     server.send_message(msg)
            # ---

            # For stub: Always succeed
            return DeliveryResult(
                success=True,
                status=DeliveryStatus.DELIVERED.value
            )

        except Exception as e:
            logger.error(f"[EmailProvider] Delivery failed: {e}", exc_info=True)
            return DeliveryResult(
                success=False,
                status=DeliveryStatus.FAILED.value,
                error_message=str(e),
                retry=True  # Retry on transient failures
            )

    def _render_email_template(self, task: DeliveryTask) -> str:
        """
        Render HTML email template.

        In production, use proper templates (Jinja2, etc.)
        """
        severity_colors = {
            'CRITICAL': '#dc3545',
            'HIGH': '#fd7e14',
            'MEDIUM': '#ffc107',
            'LOW': '#17a2b8',
            'INFO': '#6c757d',
        }
        color = severity_colors.get(task.alert_severity, '#6c757d')

        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .alert-badge {{
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 4px;
                    background-color: {color};
                    color: white;
                    font-weight: bold;
                    font-size: 12px;
                }}
                .alert-title {{ font-size: 18px; margin: 16px 0 8px; }}
                .alert-message {{ margin: 8px 0; }}
                .footer {{ margin-top: 24px; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <span class="alert-badge">{task.alert_severity}</span>
            <span class="alert-badge" style="background-color: #6c757d;">{task.alert_type}</span>

            <h2 class="alert-title">{task.alert_title}</h2>
            <p class="alert-message">{task.alert_message}</p>

            <p class="footer">
                This is an automated notification from Components Platform.
                <br>To manage your alert preferences, visit your account settings.
            </p>
        </body>
        </html>
        """


class WebhookDeliveryProvider(DeliveryProvider):
    """
    Webhook delivery via HTTP POST.

    Sends a JSON payload to the configured webhook URL with:
    - alert_id, alert_type, severity
    - title, message
    - context data
    - timestamp

    Configuration:
    - NOTIFICATION_WEBHOOK_TIMEOUT_SECONDS: HTTP timeout (default: 30)
    - NOTIFICATION_WEBHOOK_SECRET: Optional HMAC signing secret
    """

    def __init__(self):
        self.settings = get_settings()
        self.timeout = getattr(self.settings, 'NOTIFICATION_WEBHOOK_TIMEOUT_SECONDS', 30)

    def is_configured(self) -> bool:
        """Webhooks are user-configured per alert preference, always 'configured'."""
        return True

    async def deliver(self, task: DeliveryTask) -> DeliveryResult:
        """Deliver alert via webhook HTTP POST."""
        if not task.recipient:
            return DeliveryResult(
                success=False,
                status=DeliveryStatus.FAILED.value,
                error_message="No webhook URL configured",
                retry=False
            )

        try:
            logger.info(f"[WebhookProvider] Sending webhook to {task.recipient}")

            # Build payload
            payload = {
                "event_type": "alert.created",
                "alert_id": task.alert_id,
                "alert_type": task.alert_type,
                "severity": task.alert_severity,
                "title": task.alert_title,
                "message": task.alert_message,
                "context": task.alert_context or {},
                "organization_id": task.organization_id,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }

            # Optional: Add HMAC signature header for verification
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "ComponentsPlatform-Webhook/1.0",
            }

            # Add signature if secret configured
            webhook_secret = getattr(self.settings, 'NOTIFICATION_WEBHOOK_SECRET', None)
            if webhook_secret:
                import hmac
                import hashlib
                signature = hmac.new(
                    webhook_secret.encode(),
                    json.dumps(payload).encode(),
                    hashlib.sha256
                ).hexdigest()
                headers["X-Webhook-Signature"] = f"sha256={signature}"

            # Send webhook
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    task.recipient,
                    json=payload,
                    headers=headers
                )

            if response.status_code >= 200 and response.status_code < 300:
                logger.info(
                    f"[WebhookProvider] Success: {task.recipient} responded {response.status_code}"
                )
                return DeliveryResult(
                    success=True,
                    status=DeliveryStatus.DELIVERED.value
                )
            else:
                logger.warning(
                    f"[WebhookProvider] Non-success status: {response.status_code} from {task.recipient}"
                )
                # Retry on 5xx errors, fail on 4xx
                should_retry = response.status_code >= 500
                return DeliveryResult(
                    success=False,
                    status=DeliveryStatus.RETRY.value if should_retry else DeliveryStatus.FAILED.value,
                    error_message=f"HTTP {response.status_code}: {response.text[:200]}",
                    retry=should_retry
                )

        except httpx.TimeoutException:
            logger.warning(f"[WebhookProvider] Timeout: {task.recipient}")
            return DeliveryResult(
                success=False,
                status=DeliveryStatus.RETRY.value,
                error_message="Request timed out",
                retry=True
            )
        except httpx.RequestError as e:
            logger.error(f"[WebhookProvider] Request error: {e}")
            return DeliveryResult(
                success=False,
                status=DeliveryStatus.RETRY.value,
                error_message=str(e),
                retry=True
            )
        except Exception as e:
            logger.error(f"[WebhookProvider] Unexpected error: {e}", exc_info=True)
            return DeliveryResult(
                success=False,
                status=DeliveryStatus.FAILED.value,
                error_message=str(e),
                retry=False
            )


# =============================================================================
# NOTIFICATION DELIVERY SERVICE
# =============================================================================

class NotificationDeliveryService:
    """
    Main service for processing alert delivery queue.

    Handles:
    - Fetching pending deliveries from database
    - Dispatching to appropriate provider (email/webhook)
    - Updating delivery status
    - Retry logic with backoff
    """

    def __init__(self):
        self.settings = get_settings()
        self.max_retries = getattr(self.settings, 'NOTIFICATION_MAX_RETRIES', 3)
        self.batch_size = getattr(self.settings, 'NOTIFICATION_BATCH_SIZE', 50)

        # Initialize providers
        self.providers: Dict[str, DeliveryProvider] = {
            DeliveryMethod.EMAIL.value: EmailDeliveryProvider(),
            DeliveryMethod.WEBHOOK.value: WebhookDeliveryProvider(),
        }

        logger.info(
            f"[NotificationDeliveryService] Initialized with max_retries={self.max_retries}, "
            f"batch_size={self.batch_size}"
        )

    async def process_pending_deliveries(self) -> Dict[str, int]:
        """
        Process all pending deliveries in the queue.

        Returns:
            Dict with counts: {'processed': N, 'delivered': N, 'failed': N, 'retried': N}
        """
        logger.info("[NotificationDeliveryService] Starting delivery processing run")

        stats = {'processed': 0, 'delivered': 0, 'failed': 0, 'retried': 0}

        try:
            db = next(get_dual_database().get_session("supabase"))

            # Fetch pending deliveries (excluding in_app which is already delivered)
            tasks = await self._fetch_pending_deliveries(db)

            if not tasks:
                logger.debug("[NotificationDeliveryService] No pending deliveries")
                return stats

            logger.info(f"[NotificationDeliveryService] Processing {len(tasks)} pending deliveries")

            for task in tasks:
                stats['processed'] += 1

                # Get the appropriate provider
                provider = self.providers.get(task.delivery_method)
                if not provider:
                    logger.warning(f"[NotificationDeliveryService] Unknown method: {task.delivery_method}")
                    await self._update_delivery_status(
                        db, task.id, DeliveryStatus.FAILED.value,
                        error_message=f"Unknown delivery method: {task.delivery_method}"
                    )
                    stats['failed'] += 1
                    continue

                # Check if provider is configured
                if not provider.is_configured():
                    logger.debug(
                        f"[NotificationDeliveryService] Provider not configured: {task.delivery_method}"
                    )
                    await self._update_delivery_status(
                        db, task.id, DeliveryStatus.FAILED.value,
                        error_message="Provider not configured"
                    )
                    stats['failed'] += 1
                    continue

                # Attempt delivery
                result = await provider.deliver(task)

                if result.success:
                    await self._update_delivery_status(
                        db, task.id, DeliveryStatus.DELIVERED.value,
                        delivered_at=datetime.utcnow()
                    )
                    stats['delivered'] += 1
                    logger.debug(f"[NotificationDeliveryService] Delivered: {task.id}")

                elif result.retry and task.retry_count < self.max_retries:
                    # Schedule for retry
                    await self._update_delivery_status(
                        db, task.id, DeliveryStatus.RETRY.value,
                        error_message=result.error_message,
                        increment_retry=True
                    )
                    stats['retried'] += 1
                    logger.debug(
                        f"[NotificationDeliveryService] Will retry: {task.id} "
                        f"(attempt {task.retry_count + 1}/{self.max_retries})"
                    )

                else:
                    # Final failure
                    await self._update_delivery_status(
                        db, task.id, DeliveryStatus.FAILED.value,
                        error_message=result.error_message
                    )
                    stats['failed'] += 1
                    logger.warning(
                        f"[NotificationDeliveryService] Failed permanently: {task.id} - {result.error_message}"
                    )

            db.commit()

        except Exception as e:
            logger.error(f"[NotificationDeliveryService] Processing error: {e}", exc_info=True)

        logger.info(
            f"[NotificationDeliveryService] Completed: "
            f"processed={stats['processed']}, delivered={stats['delivered']}, "
            f"failed={stats['failed']}, retried={stats['retried']}"
        )

        return stats

    async def _fetch_pending_deliveries(self, db) -> List[DeliveryTask]:
        """Fetch pending deliveries from the queue."""
        sql = """
            SELECT
                ad.id,
                ad.alert_id,
                ad.delivery_method,
                ad.recipient,
                ad.status,
                ad.retry_count,
                ad.last_error,
                a.title as alert_title,
                a.message as alert_message,
                a.severity as alert_severity,
                a.alert_type,
                a.context as alert_context,
                a.organization_id
            FROM alert_deliveries ad
            JOIN alerts a ON a.id = ad.alert_id
            WHERE ad.status IN ('pending', 'retry')
            AND ad.delivery_method != 'in_app'
            ORDER BY ad.created_at ASC
            LIMIT :limit
        """

        rows = db.execute(text(sql), {"limit": self.batch_size}).fetchall()

        tasks = []
        for row in rows:
            m = row._mapping
            # Parse context JSON if present
            context = None
            if m.get("alert_context"):
                try:
                    context = json.loads(m["alert_context"]) if isinstance(m["alert_context"], str) else m["alert_context"]
                except (json.JSONDecodeError, TypeError):
                    context = None

            tasks.append(DeliveryTask(
                id=str(m["id"]),
                alert_id=str(m["alert_id"]),
                delivery_method=m["delivery_method"],
                recipient=m["recipient"],
                status=m["status"],
                retry_count=m.get("retry_count") or 0,
                last_error=m.get("last_error"),
                alert_title=m.get("alert_title"),
                alert_message=m.get("alert_message"),
                alert_severity=m.get("alert_severity"),
                alert_type=m.get("alert_type"),
                alert_context=context,
                organization_id=str(m["organization_id"]) if m.get("organization_id") else None,
            ))

        return tasks

    async def _update_delivery_status(
        self,
        db,
        delivery_id: str,
        status: str,
        error_message: Optional[str] = None,
        delivered_at: Optional[datetime] = None,
        increment_retry: bool = False,
    ):
        """Update the delivery record status."""
        updates = ["status = :status", "updated_at = NOW()"]
        params: Dict[str, Any] = {"id": delivery_id, "status": status}

        if error_message:
            updates.append("last_error = :error")
            params["error"] = error_message

        if delivered_at:
            updates.append("delivered_at = :delivered_at")
            params["delivered_at"] = delivered_at

        if increment_retry:
            updates.append("retry_count = retry_count + 1")

        sql = f"""
            UPDATE alert_deliveries
            SET {', '.join(updates)}
            WHERE id = :id
        """

        db.execute(text(sql), params)


# =============================================================================
# SINGLETON INSTANCE & BACKGROUND PROCESSOR
# =============================================================================

# Singleton instance
_notification_service: Optional[NotificationDeliveryService] = None


def get_notification_service() -> NotificationDeliveryService:
    """Get or create the notification delivery service singleton."""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationDeliveryService()
    return _notification_service


async def run_delivery_processor(interval_seconds: int = 60):
    """
    Background task to process notification deliveries.

    Call this from your application startup or as a separate worker process.

    Example integration with FastAPI:
        @app.on_event("startup")
        async def start_notification_processor():
            asyncio.create_task(run_delivery_processor())

    Args:
        interval_seconds: How often to check for pending deliveries
    """
    logger.info(f"[NotificationProcessor] Starting with interval={interval_seconds}s")

    service = get_notification_service()

    while True:
        try:
            await service.process_pending_deliveries()
        except Exception as e:
            logger.error(f"[NotificationProcessor] Error in processing loop: {e}", exc_info=True)

        await asyncio.sleep(interval_seconds)
