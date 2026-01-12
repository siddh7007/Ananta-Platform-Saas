"""
Notification Providers

Factory function for creating notification providers based on configuration.
"""

from shared.notification.config import NotificationConfig
from shared.notification.providers.base import BaseNotificationProvider


def get_notification_provider(config: NotificationConfig) -> BaseNotificationProvider:
    """
    Factory to get notification provider based on config.

    Args:
        config: NotificationConfig instance

    Returns:
        Configured notification provider instance
    """
    if config.provider == "none" or not config.is_configured:
        from shared.notification.providers.stub import StubProvider
        return StubProvider(config)

    if config.provider == "novu":
        from shared.notification.providers.novu import NovuProvider
        return NovuProvider(config)

    # Default to stub if unknown provider
    from shared.notification.providers.stub import StubProvider
    return StubProvider(config)


__all__ = ["BaseNotificationProvider", "get_notification_provider"]
