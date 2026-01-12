"""
Shared Notification Library

Provides unified notification delivery via Novu with support for:
- Multiple channels (in-app, email, webhook, SMS, push)
- Provider abstraction (Novu, Stub)
- RabbitMQ async delivery for non-critical alerts
- Subscriber sync between Supabase and Novu
"""

from shared.notification.config import NotificationConfig
from shared.notification.providers import get_notification_provider, BaseNotificationProvider
from shared.notification.providers.base import NotificationResult
from shared.notification.workflows import get_workflow, is_critical_alert, ALERT_WORKFLOWS

__all__ = [
    "NotificationConfig",
    "get_notification_provider",
    "BaseNotificationProvider",
    "NotificationResult",
    "get_workflow",
    "is_critical_alert",
    "ALERT_WORKFLOWS",
]
