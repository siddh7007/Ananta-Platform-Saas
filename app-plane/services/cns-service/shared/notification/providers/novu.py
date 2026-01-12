"""
Novu Notification Provider

Implementation of notification provider using Novu SDK.
"""

import logging
from typing import Dict, List, Any, Optional

from shared.notification.config import NotificationConfig
from shared.notification.providers.base import BaseNotificationProvider, NotificationResult

logger = logging.getLogger(__name__)


class NovuProvider(BaseNotificationProvider):
    """Novu notification provider implementation."""

    def __init__(self, config: NotificationConfig):
        self.config = config
        self._configured = False
        self._event_api = None
        self._subscriber_api = None
        self._init_client()

    def _init_client(self):
        """Initialize Novu SDK clients."""
        try:
            from novu.api import EventApi, SubscriberApi
            from novu.config import NovuConfig as NovuSDKConfig

            sdk_config = NovuSDKConfig(
                backend_url=self.config.novu_api_url
            )
            self._event_api = EventApi(
                api_key=self.config.novu_api_key,
                config=sdk_config
            )
            self._subscriber_api = SubscriberApi(
                api_key=self.config.novu_api_key,
                config=sdk_config
            )
            self._configured = True
            logger.info(f"[NovuProvider] Initialized successfully with API at {self.config.novu_api_url}")
        except ImportError:
            logger.error("[NovuProvider] Novu SDK not installed. Install with: pip install novu")
            self._configured = False
        except Exception as e:
            logger.error(f"[NovuProvider] Init failed: {e}")
            self._configured = False

    @property
    def provider_name(self) -> str:
        return "novu"

    @property
    def is_configured(self) -> bool:
        return self._configured and bool(self.config.novu_api_key)

    async def send_notification(
        self,
        subscriber_id: str,
        workflow_id: str,
        payload: Dict[str, Any],
        channels: Optional[List[str]] = None,
        overrides: Optional[Dict] = None,
    ) -> NotificationResult:
        """Trigger Novu workflow."""
        if not self.is_configured:
            logger.warning("[NovuProvider] Not configured, skipping notification")
            return NotificationResult(success=False, error="Provider not configured")

        try:
            result = self._event_api.trigger(
                name=workflow_id,
                recipients=subscriber_id,
                payload=payload,
                overrides=overrides or {},
            )

            transaction_id = None
            if result and hasattr(result, 'data') and result.data:
                transaction_id = str(result.data.get("transactionId", ""))

            logger.info(f"[NovuProvider] Triggered {workflow_id} for {subscriber_id}, txn: {transaction_id}")
            return NotificationResult(
                success=True,
                transaction_id=transaction_id,
                message_id=transaction_id,
            )
        except Exception as e:
            logger.error(f"[NovuProvider] Trigger failed: {e}")
            return NotificationResult(success=False, error=str(e))

    async def create_subscriber(
        self,
        subscriber_id: str,
        email: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        phone: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Create or update a subscriber in Novu."""
        if not self.is_configured:
            logger.warning("[NovuProvider] Not configured, skipping subscriber creation")
            return False

        try:
            subscriber_data = {
                "subscriberId": subscriber_id,
            }
            if email:
                subscriber_data["email"] = email
            if first_name:
                subscriber_data["firstName"] = first_name
            if last_name:
                subscriber_data["lastName"] = last_name
            if phone:
                subscriber_data["phone"] = phone
            if data:
                subscriber_data["data"] = data

            self._subscriber_api.identify(
                subscriber_id=subscriber_id,
                **subscriber_data
            )
            logger.info(f"[NovuProvider] Created/updated subscriber {subscriber_id}")
            return True
        except Exception as e:
            logger.error(f"[NovuProvider] Create subscriber failed: {e}")
            return False

    async def delete_subscriber(self, subscriber_id: str) -> bool:
        """Remove a subscriber from Novu."""
        if not self.is_configured:
            return False

        try:
            self._subscriber_api.delete(subscriber_id=subscriber_id)
            logger.info(f"[NovuProvider] Deleted subscriber {subscriber_id}")
            return True
        except Exception as e:
            logger.error(f"[NovuProvider] Delete subscriber failed: {e}")
            return False

    async def get_subscriber_preferences(
        self,
        subscriber_id: str,
    ) -> Dict[str, Any]:
        """Get subscriber notification preferences."""
        if not self.is_configured:
            return {}

        try:
            result = self._subscriber_api.get_preferences(subscriber_id=subscriber_id)
            return result.data if hasattr(result, 'data') else {}
        except Exception as e:
            logger.error(f"[NovuProvider] Get preferences failed: {e}")
            return {}

    async def update_subscriber_preferences(
        self,
        subscriber_id: str,
        channel: str,
        enabled: bool,
        workflow_id: Optional[str] = None,
    ) -> bool:
        """Update subscriber channel preferences."""
        if not self.is_configured:
            return False

        try:
            # Novu uses template_id for workflow-specific preferences
            if workflow_id:
                self._subscriber_api.update_preference(
                    subscriber_id=subscriber_id,
                    template_id=workflow_id,
                    channel={channel: enabled}
                )
            else:
                # Update global channel preference
                self._subscriber_api.update_global_preferences(
                    subscriber_id=subscriber_id,
                    preferences=[{"channelType": channel, "enabled": enabled}]
                )
            logger.info(f"[NovuProvider] Updated preference for {subscriber_id}: {channel}={enabled}")
            return True
        except Exception as e:
            logger.error(f"[NovuProvider] Update preference failed: {e}")
            return False

    async def mark_message_as_read(
        self,
        subscriber_id: str,
        message_id: str,
    ) -> bool:
        """Mark a notification message as read."""
        if not self.is_configured:
            return False

        try:
            self._subscriber_api.mark_message_as(
                subscriber_id=subscriber_id,
                message_id=message_id,
                seen=True,
                read=True,
            )
            return True
        except Exception as e:
            logger.error(f"[NovuProvider] Mark as read failed: {e}")
            return False

    async def mark_all_as_read(
        self,
        subscriber_id: str,
    ) -> bool:
        """Mark all messages as read for a subscriber."""
        if not self.is_configured:
            return False

        try:
            self._subscriber_api.mark_all_as_read(subscriber_id=subscriber_id)
            return True
        except Exception as e:
            logger.error(f"[NovuProvider] Mark all as read failed: {e}")
            return False
