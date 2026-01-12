"""
Billing Provider Interfaces

This submodule contains the provider abstraction for payment gateways:
- BaseBillingProvider: Abstract interface for all providers
- StubBillingProvider: Stub implementation (returns 501)
- StripeProvider: Stripe payment gateway implementation

Usage:
    from shared.auth_billing.billing.providers import (
        BaseBillingProvider,
        StubBillingProvider,
        get_billing_provider,
    )
"""

from shared.auth_billing.billing.providers.base import BaseBillingProvider
from shared.auth_billing.billing.providers.stub import StubBillingProvider


def get_billing_provider(config, price_map=None) -> BaseBillingProvider:
    """
    Factory function to get the appropriate billing provider based on config.

    Args:
        config: BillingConfig instance
        price_map: Optional mapping of plan slugs to provider price IDs

    Returns:
        BaseBillingProvider implementation
    """
    from shared.auth_billing.config import BillingConfig

    if not isinstance(config, BillingConfig):
        return StubBillingProvider(config)

    if config.provider == "none" or not config.is_configured:
        return StubBillingProvider(config)

    if config.provider == "stripe":
        from shared.auth_billing.billing.providers.stripe import StripeProvider
        return StripeProvider(config, price_map=price_map)
    # elif config.provider == "paypal":
    #     from shared.auth_billing.billing.providers.paypal import PayPalProvider
    #     return PayPalProvider(config)

    return StubBillingProvider(config)


__all__ = [
    "BaseBillingProvider",
    "StubBillingProvider",
    "get_billing_provider",
]
