"""
Shared libraries for Components Platform V2

This package contains reusable modules that can be shared across services:
- event_bus: Event publishing for inter-service communication
- auth_billing: Authentication and billing (provider-agnostic)
"""

from .event_bus import EventBus, event_bus, EventPublisher

# Auth & Billing module is imported on demand to avoid circular imports
# Usage: from shared.auth_billing import AuthConfig, AuthContext

__all__ = ['EventBus', 'event_bus', 'EventPublisher']
