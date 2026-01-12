"""
Novu Client Module

Provides a simple client factory for Novu notifications.
Used by account.py, workers, and other modules that need to trigger notifications.
"""

import logging
import os
from typing import Dict, Any, Optional

from shared.notification.config import NotificationConfig
from shared.notification.providers import get_notification_provider

logger = logging.getLogger(__name__)

_client_instance: Optional["NovuClient"] = None


class NovuClient:
    """
    Simple wrapper client for Novu notifications.

    Provides a trigger() method compatible with existing code patterns.
    """

    def __init__(self, provider=None):
        self._provider = provider

    async def trigger(
        self,
        workflow_id: str,
        subscriber_id: str,
        payload: Dict[str, Any],
        overrides: Optional[Dict] = None,
    ) -> bool:
        """
        Trigger a Novu workflow.

        Args:
            workflow_id: The Novu workflow identifier
            subscriber_id: The subscriber/user ID
            payload: Data payload for the workflow
            overrides: Optional channel overrides

        Returns:
            True if notification was sent successfully
        """
        if not self._provider:
            logger.warning("[NovuClient] No provider configured, skipping trigger")
            return False

        try:
            result = await self._provider.send_notification(
                subscriber_id=subscriber_id,
                workflow_id=workflow_id,
                payload=payload,
                overrides=overrides,
            )
            return result.success
        except Exception as e:
            logger.error(f"[NovuClient] Trigger failed: {e}")
            return False

    async def create_subscriber(
        self,
        subscriber_id: str,
        email: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Create or update a subscriber in Novu."""
        if not self._provider:
            return False
        return await self._provider.create_subscriber(
            subscriber_id=subscriber_id,
            email=email,
            first_name=first_name,
            last_name=last_name,
            data=data,
        )

    async def delete_subscriber(self, subscriber_id: str) -> bool:
        """Delete a subscriber from Novu."""
        if not self._provider:
            return False
        return await self._provider.delete_subscriber(subscriber_id)


def get_novu_client() -> Optional[NovuClient]:
    """
    Get or create a singleton NovuClient instance.

    Returns:
        NovuClient instance, or None if Novu is not configured.
    """
    global _client_instance

    if _client_instance is not None:
        return _client_instance

    try:
        config = NotificationConfig.from_env()

        if not config.novu_api_key:
            logger.warning("[NovuClient] NOVU_API_KEY not set, client disabled")
            return None

        provider = get_notification_provider(config)

        if not provider.is_configured:
            logger.warning("[NovuClient] Provider not configured")
            return None

        _client_instance = NovuClient(provider=provider)
        logger.info("[NovuClient] Initialized successfully")
        return _client_instance

    except Exception as e:
        logger.error(f"[NovuClient] Failed to initialize: {e}")
        return None


def reset_client():
    """Reset the singleton client (useful for testing)."""
    global _client_instance
    _client_instance = None
