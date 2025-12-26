"""
Stub Notification Provider

No-op implementation for development/testing or when notifications are disabled.
"""

import logging
from typing import Dict, List, Any, Optional
import uuid

from shared.notification.config import NotificationConfig
from shared.notification.providers.base import BaseNotificationProvider, NotificationResult

logger = logging.getLogger(__name__)


class StubProvider(BaseNotificationProvider):
    """
    Stub notification provider for development/testing.

    Logs all notification attempts but doesn't actually send anything.
    Useful for:
    - Development without Novu setup
    - Testing notification flows
    - Disabled notification mode
    """

    def __init__(self, config: NotificationConfig):
        self.config = config
        logger.info("[StubProvider] Initialized - notifications will be logged but not sent")

    @property
    def provider_name(self) -> str:
        return "stub"

    @property
    def is_configured(self) -> bool:
        return True  # Stub is always "configured"

    async def send_notification(
        self,
        subscriber_id: str,
        workflow_id: str,
        payload: Dict[str, Any],
        channels: Optional[List[str]] = None,
        overrides: Optional[Dict] = None,
    ) -> NotificationResult:
        """Log notification trigger (no-op)."""
        fake_transaction_id = f"stub-{uuid.uuid4().hex[:12]}"
        logger.info(
            f"[StubProvider] Would send notification: "
            f"workflow={workflow_id}, subscriber={subscriber_id}, "
            f"payload_keys={list(payload.keys())}, channels={channels or ['in_app']}"
        )
        return NotificationResult(
            success=True,
            transaction_id=fake_transaction_id,
            message_id=fake_transaction_id,
        )

    async def create_subscriber(
        self,
        subscriber_id: str,
        email: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        phone: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Log subscriber creation (no-op)."""
        logger.info(
            f"[StubProvider] Would create subscriber: "
            f"id={subscriber_id}, email={email}, name={first_name} {last_name}"
        )
        return True

    async def delete_subscriber(self, subscriber_id: str) -> bool:
        """Log subscriber deletion (no-op)."""
        logger.info(f"[StubProvider] Would delete subscriber: {subscriber_id}")
        return True

    async def get_subscriber_preferences(
        self,
        subscriber_id: str,
    ) -> Dict[str, Any]:
        """Return mock preferences."""
        logger.info(f"[StubProvider] Would get preferences for: {subscriber_id}")
        return {
            "global": {
                "in_app": True,
                "email": True,
                "webhook": False,
            }
        }

    async def update_subscriber_preferences(
        self,
        subscriber_id: str,
        channel: str,
        enabled: bool,
        workflow_id: Optional[str] = None,
    ) -> bool:
        """Log preference update (no-op)."""
        logger.info(
            f"[StubProvider] Would update preference: "
            f"subscriber={subscriber_id}, channel={channel}, enabled={enabled}, "
            f"workflow={workflow_id or 'global'}"
        )
        return True

    async def mark_message_as_read(
        self,
        subscriber_id: str,
        message_id: str,
    ) -> bool:
        """Log mark as read (no-op)."""
        logger.info(f"[StubProvider] Would mark as read: {message_id}")
        return True

    async def mark_all_as_read(
        self,
        subscriber_id: str,
    ) -> bool:
        """Log mark all as read (no-op)."""
        logger.info(f"[StubProvider] Would mark all as read for: {subscriber_id}")
        return True
