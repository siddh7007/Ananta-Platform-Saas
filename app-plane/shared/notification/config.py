"""
Notification Configuration

Dataclass for notification service configuration.
"""

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class NotificationConfig:
    """Configuration for notification service."""

    # Provider selection: "none" or "novu"
    provider: str = field(default_factory=lambda: os.getenv("NOTIFICATION_PROVIDER", "none"))

    # Novu settings
    novu_api_key: Optional[str] = field(default_factory=lambda: os.getenv("NOVU_API_KEY"))
    novu_api_url: str = field(default_factory=lambda: os.getenv("NOVU_API_URL", "http://novu-api:3000"))
    novu_app_identifier: Optional[str] = field(default_factory=lambda: os.getenv("NOVU_APP_IDENTIFIER"))

    # Feature flags
    enable_in_app: bool = True
    enable_email: bool = True
    enable_webhook: bool = True

    # Async delivery settings
    rabbitmq_enabled: bool = True
    rabbitmq_host: str = field(default_factory=lambda: os.getenv("RABBITMQ_HOST", "rabbitmq"))
    rabbitmq_port: int = field(default_factory=lambda: int(os.getenv("RABBITMQ_PORT", "5672")))
    rabbitmq_user: str = field(default_factory=lambda: os.getenv("RABBITMQ_USER", "admin"))
    rabbitmq_password: str = field(default_factory=lambda: os.getenv("RABBITMQ_PASSWORD", "admin123_change_in_production"))

    # Digest settings
    digest_enabled: bool = True
    digest_cron: str = "0 9 * * *"  # Daily at 9 AM

    @property
    def is_configured(self) -> bool:
        """Check if Novu is properly configured."""
        return self.provider == "novu" and bool(self.novu_api_key)

    @classmethod
    def from_env(cls) -> "NotificationConfig":
        """Create config from environment variables."""
        return cls(
            provider=os.getenv("NOTIFICATION_PROVIDER", "none"),
            novu_api_key=os.getenv("NOVU_API_KEY"),
            novu_api_url=os.getenv("NOVU_API_URL", "http://novu-api:3000"),
            novu_app_identifier=os.getenv("NOVU_APP_IDENTIFIER"),
            enable_in_app=os.getenv("NOTIFICATION_ENABLE_IN_APP", "true").lower() == "true",
            enable_email=os.getenv("NOTIFICATION_ENABLE_EMAIL", "true").lower() == "true",
            enable_webhook=os.getenv("NOTIFICATION_ENABLE_WEBHOOK", "true").lower() == "true",
            rabbitmq_enabled=os.getenv("NOTIFICATION_RABBITMQ_ENABLED", "true").lower() == "true",
            rabbitmq_host=os.getenv("RABBITMQ_HOST", "rabbitmq"),
            rabbitmq_port=int(os.getenv("RABBITMQ_PORT", "5672")),
            rabbitmq_user=os.getenv("RABBITMQ_USER", "admin"),
            rabbitmq_password=os.getenv("RABBITMQ_PASSWORD", "admin123_change_in_production"),
            digest_enabled=os.getenv("NOTIFICATION_DIGEST_ENABLED", "true").lower() == "true",
            digest_cron=os.getenv("NOTIFICATION_DIGEST_CRON", "0 9 * * *"),
        )
