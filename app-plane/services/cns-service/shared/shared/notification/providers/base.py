"""
Base Notification Provider

Abstract base class for notification provider implementations.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, List, Any, Optional


@dataclass
class NotificationResult:
    """Result of a notification trigger operation."""
    success: bool
    message_id: Optional[str] = None
    transaction_id: Optional[str] = None
    error: Optional[str] = None


class BaseNotificationProvider(ABC):
    """
    Abstract base class for notification providers.

    Each provider implementation handles:
    - Triggering notification workflows
    - Subscriber management
    - Preference management

    Usage:
        class NovuProvider(BaseNotificationProvider):
            async def send_notification(self, ...) -> NotificationResult:
                # Novu-specific implementation
                ...
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name (e.g., 'novu', 'stub')."""
        pass

    @property
    def is_configured(self) -> bool:
        """Check if the provider is properly configured."""
        return True

    @abstractmethod
    async def send_notification(
        self,
        subscriber_id: str,
        workflow_id: str,
        payload: Dict[str, Any],
        channels: Optional[List[str]] = None,
        overrides: Optional[Dict] = None,
    ) -> NotificationResult:
        """
        Trigger a notification workflow for a subscriber.

        Args:
            subscriber_id: Unique identifier for the subscriber
            workflow_id: Novu workflow/template identifier
            payload: Data to pass to the notification template
            channels: Optional list of channels to use (in_app, email, webhook)
            overrides: Optional channel-specific overrides

        Returns:
            NotificationResult with success status and message ID
        """
        pass

    @abstractmethod
    async def create_subscriber(
        self,
        subscriber_id: str,
        email: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        phone: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Create or update a subscriber in the notification service.

        Args:
            subscriber_id: Unique identifier for the subscriber
            email: Subscriber's email address
            first_name: Subscriber's first name
            last_name: Subscriber's last name
            phone: Subscriber's phone number
            data: Additional subscriber data

        Returns:
            True if successful
        """
        pass

    @abstractmethod
    async def delete_subscriber(self, subscriber_id: str) -> bool:
        """
        Remove a subscriber from the notification service.

        Args:
            subscriber_id: Unique identifier for the subscriber

        Returns:
            True if successful
        """
        pass

    @abstractmethod
    async def get_subscriber_preferences(
        self,
        subscriber_id: str,
    ) -> Dict[str, Any]:
        """
        Get subscriber notification preferences.

        Args:
            subscriber_id: Unique identifier for the subscriber

        Returns:
            Dict with preference settings
        """
        pass

    @abstractmethod
    async def update_subscriber_preferences(
        self,
        subscriber_id: str,
        channel: str,
        enabled: bool,
        workflow_id: Optional[str] = None,
    ) -> bool:
        """
        Update subscriber channel preferences.

        Args:
            subscriber_id: Unique identifier for the subscriber
            channel: Channel type (in_app, email, webhook, etc.)
            enabled: Whether to enable or disable the channel
            workflow_id: Optional specific workflow to update

        Returns:
            True if successful
        """
        pass

    async def mark_message_as_read(
        self,
        subscriber_id: str,
        message_id: str,
    ) -> bool:
        """
        Mark a notification message as read.

        Args:
            subscriber_id: Unique identifier for the subscriber
            message_id: Message identifier

        Returns:
            True if successful
        """
        return True  # Default implementation

    async def mark_all_as_read(
        self,
        subscriber_id: str,
    ) -> bool:
        """
        Mark all messages as read for a subscriber.

        Args:
            subscriber_id: Unique identifier for the subscriber

        Returns:
            True if successful
        """
        return True  # Default implementation
