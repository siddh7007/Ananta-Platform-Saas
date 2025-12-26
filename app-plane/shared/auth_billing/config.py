"""
Configuration Dataclasses for Auth & Billing

These dataclasses allow services to inject their own configuration
without depending on global settings imports.

Usage:
    from shared.auth_billing import AuthConfig, BillingConfig

    # Create from environment variables
    auth_config = AuthConfig(
        jwt_secret_key=os.environ["JWT_SECRET_KEY"],
        auth0_enabled=os.environ.get("AUTH0_ENABLED", "false").lower() == "true",
        auth0_domain=os.environ.get("AUTH0_DOMAIN"),
        auth0_audience=os.environ.get("AUTH0_AUDIENCE"),
    )

    billing_config = BillingConfig(
        provider=os.environ.get("BILLING_PROVIDER", "none"),
        stripe_secret_key=os.environ.get("STRIPE_SECRET_KEY"),
    )
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set


@dataclass
class AuthConfig:
    """
    Configuration for authentication.

    This config is injected into auth providers and middleware, allowing
    the same code to work across different services with different settings.

    Attributes:
        jwt_secret_key: Secret for HS256 JWT verification (Supabase)
        auth0_enabled: Whether to enable Auth0 validation
        auth0_domain: Auth0 tenant domain (e.g., your-tenant.us.auth0.com)
        auth0_audience: Auth0 API audience identifier
        auth0_client_id: Auth0 application client ID
        auth0_client_secret: Auth0 application client secret
        admin_api_token: Token for admin/service API access
        trusted_proxy_count: Number of proxy hops to trust for X-Forwarded-For
        public_paths: Set of paths that don't require authentication
        public_path_prefixes: List of path prefixes that don't require auth
        rate_limit_window_seconds: Window for rate limiting failed attempts
        rate_limit_max_failures: Max failures before blocking
        membership_cache_ttl_seconds: TTL for membership cache entries
    """

    # Supabase (HS256) configuration
    jwt_secret_key: str = ""

    # Auth0 (RS256) configuration
    auth0_enabled: bool = False
    auth0_domain: Optional[str] = None
    auth0_audience: Optional[str] = None
    auth0_client_id: Optional[str] = None
    auth0_client_secret: Optional[str] = None

    # Admin/service token
    admin_api_token: Optional[str] = None

    # Proxy configuration
    trusted_proxy_count: int = 0

    # Public paths (no auth required)
    public_paths: Set[str] = field(default_factory=lambda: {
        "/",
        "/health",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/health",
        "/api/docs",
        "/api/redoc",
    })

    public_path_prefixes: List[str] = field(default_factory=lambda: [
        "/api/docs",
        "/api/health",
        "/api/billing/webhooks/",  # Payment provider webhooks (no auth - verified by signature)
        "/api/billing/plans",  # Public pricing page
        "/static/",
        "/_next/",
    ])

    # Rate limiting
    rate_limit_window_seconds: int = 300  # 5 minutes
    rate_limit_max_failures: int = 10

    # Caching
    membership_cache_ttl_seconds: int = 300  # 5 minutes
    jwks_cache_ttl_seconds: int = 3600  # 1 hour

    @property
    def auth0_jwks_uri(self) -> Optional[str]:
        """Get the JWKS URI for Auth0 (auto-derived from domain)."""
        if self.auth0_domain:
            return f"https://{self.auth0_domain}/.well-known/jwks.json"
        return None

    @property
    def auth0_issuer(self) -> Optional[str]:
        """Get the issuer URL for Auth0 (auto-derived from domain)."""
        if self.auth0_domain:
            return f"https://{self.auth0_domain}/"
        return None

    def is_public_path(self, path: str) -> bool:
        """Check if a path is public (no auth required)."""
        if path in self.public_paths:
            return True
        for prefix in self.public_path_prefixes:
            if path.startswith(prefix):
                return True
        return False


@dataclass
class BillingConfig:
    """
    Configuration for billing and subscriptions.

    This config determines which payment provider to use and holds
    provider-specific credentials.

    Attributes:
        provider: Payment provider name ("none", "stripe", "paypal", "razorpay", "square")
        currency: Default currency code
        stripe_secret_key: Stripe API secret key
        stripe_publishable_key: Stripe publishable key (for frontend)
        stripe_webhook_secret: Stripe webhook signing secret
        paypal_client_id: PayPal OAuth client ID
        paypal_client_secret: PayPal OAuth client secret
        paypal_mode: PayPal mode ("sandbox" or "live")
        razorpay_key_id: Razorpay key ID
        razorpay_key_secret: Razorpay key secret
        square_access_token: Square access token
        square_environment: Square environment ("sandbox" or "production")
    """

    # Provider selection
    provider: str = "none"  # "none", "stripe", "paypal", "razorpay", "square"
    currency: str = "USD"

    # Stripe
    stripe_secret_key: Optional[str] = None
    stripe_publishable_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None

    # PayPal
    paypal_client_id: Optional[str] = None
    paypal_client_secret: Optional[str] = None
    paypal_webhook_id: Optional[str] = None
    paypal_mode: str = "sandbox"  # "sandbox" or "live"

    # Razorpay
    razorpay_key_id: Optional[str] = None
    razorpay_key_secret: Optional[str] = None
    razorpay_webhook_secret: Optional[str] = None

    # Square
    square_access_token: Optional[str] = None
    square_webhook_signature_key: Optional[str] = None
    square_environment: str = "sandbox"  # "sandbox" or "production"

    @property
    def is_configured(self) -> bool:
        """Check if a payment provider is configured."""
        if self.provider == "none":
            return False
        elif self.provider == "stripe":
            return bool(self.stripe_secret_key)
        elif self.provider == "paypal":
            return bool(self.paypal_client_id and self.paypal_client_secret)
        elif self.provider == "razorpay":
            return bool(self.razorpay_key_id and self.razorpay_key_secret)
        elif self.provider == "square":
            return bool(self.square_access_token)
        return False

    def get_provider_config(self) -> Dict[str, any]:
        """Get the configuration dict for the active provider."""
        if self.provider == "stripe":
            return {
                "secret_key": self.stripe_secret_key,
                "publishable_key": self.stripe_publishable_key,
                "webhook_secret": self.stripe_webhook_secret,
            }
        elif self.provider == "paypal":
            return {
                "client_id": self.paypal_client_id,
                "client_secret": self.paypal_client_secret,
                "webhook_id": self.paypal_webhook_id,
                "mode": self.paypal_mode,
            }
        elif self.provider == "razorpay":
            return {
                "key_id": self.razorpay_key_id,
                "key_secret": self.razorpay_key_secret,
                "webhook_secret": self.razorpay_webhook_secret,
            }
        elif self.provider == "square":
            return {
                "access_token": self.square_access_token,
                "webhook_signature_key": self.square_webhook_signature_key,
                "environment": self.square_environment,
            }
        return {}
