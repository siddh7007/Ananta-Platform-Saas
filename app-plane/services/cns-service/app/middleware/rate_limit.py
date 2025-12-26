"""
Rate Limiting Middleware for CNS Service

Implements Redis-backed rate limiting to protect endpoints from abuse:
- Admin token endpoints: 10 requests per minute (strict)
- Authenticated endpoints: 100 requests per minute (standard)
- Public endpoints: 30 requests per minute (catalog search/browse)
- IP whitelisting for admin token usage (optional)
- Constant-time token comparison to prevent timing attacks

Uses slowapi library for distributed rate limiting with Redis backend.

Security Features:
- Per-endpoint rate limits
- IP-based rate limiting with proxy-aware IP extraction
- Public endpoint protection against catalog scraping
- Admin token IP whitelisting
- Constant-time token comparison
- Structured logging of rate limit violations
- 429 responses with Retry-After header

Usage:
    from app.middleware.rate_limit import setup_rate_limit_middleware
    setup_rate_limit_middleware(app)
"""

import logging
import secrets
import time
from typing import Callable, List, Optional

from fastapi import FastAPI, Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.config import settings

logger = logging.getLogger(__name__)

# ============================================================================
# Rate Limiting Configuration
# ============================================================================

# Admin token rate limits (stricter)
ADMIN_TOKEN_RATE_LIMIT = 10  # requests per minute
ADMIN_TOKEN_WINDOW_SECONDS = 60

# Regular authenticated request rate limits
# Increased from 100 to 500 to handle frontend polling during BOM processing
AUTHENTICATED_RATE_LIMIT = 500  # requests per minute
AUTHENTICATED_WINDOW_SECONDS = 60

# Public endpoint rate limits (unauthenticated)
PUBLIC_RATE_LIMIT = 30  # requests per minute
PUBLIC_WINDOW_SECONDS = 60

# Admin token IP whitelist (comma-separated IPs from env var)
ADMIN_TOKEN_ALLOWED_IPS: List[str] = []
if hasattr(settings, 'admin_token_allowed_ips'):
    admin_ips_str = getattr(settings, 'admin_token_allowed_ips', '')
    if admin_ips_str:
        ADMIN_TOKEN_ALLOWED_IPS = [ip.strip() for ip in admin_ips_str.split(',') if ip.strip()]

# Admin token paths that require stricter rate limiting
ADMIN_TOKEN_PATHS = [
    "/api/admin/default-token",
    "/api/admin/bulk",
    "/api/admin/lookup",
    "/api/admin/data",
    "/api/admin/directus",
]

# Paths that are public but need rate limiting
PUBLIC_RATE_LIMITED_PATHS = [
    "/api/catalog/search",
    "/api/catalog/browse",
]

# Paths excluded from rate limiting (health checks, docs)
RATE_LIMIT_EXEMPT_PATHS = {
    "/",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/health",
}

RATE_LIMIT_EXEMPT_PREFIXES = [
    "/health/",
    "/api/health/",
    "/docs/",
    "/static/",
]


# ============================================================================
# Rate Limiting Storage (Redis-backed)
# ============================================================================

class RateLimitStore:
    """
    Redis-backed rate limiting storage with fallback to in-memory.

    Uses Redis for distributed rate limiting across multiple workers/nodes.
    Falls back to in-memory dict if Redis is unavailable.
    """

    def __init__(self):
        self.redis_client = None
        self.memory_store = {}  # Fallback storage
        self.use_redis = False

        # Try to initialize Redis
        try:
            from app.cache.redis_cache import get_cache
            cache = get_cache()
            if cache and cache.is_connected:
                self.redis_client = cache._client
                self.use_redis = True
                logger.info("[RateLimit] Using Redis for distributed rate limiting")
            else:
                logger.warning(
                    "[RateLimit] Redis not available, using in-memory rate limiting "
                    "(NOT suitable for production with multiple workers)"
                )
        except Exception as e:
            logger.warning(f"[RateLimit] Failed to initialize Redis: {e}, using in-memory")

    def increment(self, key: str, window_seconds: int) -> int:
        """
        Increment the counter for a key and return the current count.

        Args:
            key: Rate limit key (e.g., "rate_limit:admin_token:192.168.1.1")
            window_seconds: Time window in seconds

        Returns:
            Current count within the window
        """
        if self.use_redis and self.redis_client:
            try:
                # Use Redis pipeline for atomic operations
                pipe = self.redis_client.pipeline()
                pipe.incr(key)
                pipe.expire(key, window_seconds)
                results = pipe.execute()
                return results[0]  # Return count from INCR
            except Exception as e:
                logger.error(f"[RateLimit] Redis increment failed: {e}, falling back to memory")
                self.use_redis = False  # Disable Redis on error

        # Fallback to in-memory
        now = time.time()
        if key not in self.memory_store:
            self.memory_store[key] = {"count": 1, "expires_at": now + window_seconds}
            return 1

        entry = self.memory_store[key]
        if now > entry["expires_at"]:
            # Window expired, reset
            entry["count"] = 1
            entry["expires_at"] = now + window_seconds
            return 1
        else:
            # Increment within window
            entry["count"] += 1
            return entry["count"]

    def get(self, key: str) -> int:
        """
        Get the current count for a key.

        Args:
            key: Rate limit key

        Returns:
            Current count or 0 if not found/expired
        """
        if self.use_redis and self.redis_client:
            try:
                count = self.redis_client.get(key)
                return int(count) if count else 0
            except Exception as e:
                logger.error(f"[RateLimit] Redis get failed: {e}")
                return 0

        # Fallback to in-memory
        now = time.time()
        if key not in self.memory_store:
            return 0

        entry = self.memory_store[key]
        if now > entry["expires_at"]:
            # Expired
            del self.memory_store[key]
            return 0

        return entry["count"]


# Global rate limit store
_rate_limit_store = RateLimitStore()


# ============================================================================
# Admin Token Validation (Constant-Time Comparison)
# ============================================================================

def validate_admin_token(token: str) -> bool:
    """
    Validate admin token using constant-time comparison to prevent timing attacks.

    SECURITY: Uses secrets.compare_digest() for constant-time comparison.
    This prevents attackers from using timing analysis to guess the token.

    Args:
        token: Token string to validate

    Returns:
        True if token is valid, False otherwise
    """
    expected_token = getattr(settings, 'admin_api_token', None)

    if not expected_token:
        logger.warning("[RateLimit] ADMIN_API_TOKEN not configured - rejecting all admin tokens")
        return False

    # SECURITY: Constant-time comparison
    is_valid = secrets.compare_digest(token, expected_token)

    if not is_valid:
        logger.warning("[RateLimit] Invalid admin token attempt")

    return is_valid


# ============================================================================
# IP Extraction (Proxy-Aware)
# ============================================================================

def get_client_ip(request: Request) -> str:
    """
    Extract client IP from request, handling proxies securely.

    Uses the same logic as auth_middleware.py for consistency.

    Returns:
        Client IP address string
    """
    trusted_proxy_count = getattr(settings, 'trusted_proxy_count', 0)

    # X-Real-IP is set by the reverse proxy itself (most trusted when available)
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    # Check X-Forwarded-For header (only if we trust proxies)
    if trusted_proxy_count > 0:
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            ips = [ip.strip() for ip in forwarded_for.split(",")]
            if len(ips) >= trusted_proxy_count:
                trusted_index = len(ips) - trusted_proxy_count
                return ips[trusted_index]
            elif ips:
                return ips[0]

    # Fallback to client.host
    if request.client:
        return request.client.host

    return "unknown"


# ============================================================================
# IP Whitelisting
# ============================================================================

def is_ip_whitelisted(ip: str) -> bool:
    """
    Check if IP is whitelisted for admin token access.

    Args:
        ip: Client IP address

    Returns:
        True if whitelisted or whitelist is empty (disabled), False otherwise
    """
    if not ADMIN_TOKEN_ALLOWED_IPS:
        # Whitelist not configured - allow all (feature disabled)
        return True

    is_allowed = ip in ADMIN_TOKEN_ALLOWED_IPS

    if not is_allowed:
        logger.warning(
            f"[RateLimit] IP not whitelisted for admin token: {ip} "
            f"(allowed IPs: {', '.join(ADMIN_TOKEN_ALLOWED_IPS)})"
        )

    return is_allowed


# ============================================================================
# Rate Limiting Middleware
# ============================================================================

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for rate limiting.

    Implements three tiers of rate limiting:
    1. Admin token requests: 10 requests per minute (strict)
    2. Regular authenticated requests: 100 requests per minute (standard)
    3. Public endpoints: 30 requests per minute (catalog search/browse)

    Features:
    - Redis-backed distributed rate limiting
    - Public endpoint protection against catalog scraping
    - IP whitelisting for admin tokens
    - Constant-time token comparison
    - Structured logging
    - 429 responses with Retry-After header
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    def is_exempt_path(self, path: str) -> bool:
        """Check if path is exempt from rate limiting."""
        if path in RATE_LIMIT_EXEMPT_PATHS:
            return True

        for prefix in RATE_LIMIT_EXEMPT_PREFIXES:
            if path.startswith(prefix):
                return True

        return False

    def is_admin_token_path(self, path: str) -> bool:
        """Check if path requires admin token validation."""
        for admin_path in ADMIN_TOKEN_PATHS:
            if path.startswith(admin_path):
                return True
        return False

    def is_public_rate_limited_path(self, path: str) -> bool:
        """Check if path is a public endpoint requiring rate limiting."""
        for public_path in PUBLIC_RATE_LIMITED_PATHS:
            if path.startswith(public_path):
                return True
        return False

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Response]
    ) -> Response:
        """
        Process request through rate limiting middleware.

        Args:
            request: Incoming request
            call_next: Next middleware/handler

        Returns:
            Response (may be 429 if rate limited)
        """
        path = request.url.path

        # Skip rate limiting for exempt paths
        if self.is_exempt_path(path):
            return await call_next(request)

        # Extract client IP
        client_ip = get_client_ip(request)

        # Determine if this is an admin token request
        is_admin_token_request = False
        admin_token = None

        # Check for admin token in Authorization header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            # Check if this matches the admin token (path-agnostic check)
            expected_token = getattr(settings, 'admin_api_token', None)
            if expected_token and secrets.compare_digest(token, expected_token):
                is_admin_token_request = True
                admin_token = token

        # Also check X-Admin-Token header (alternative auth method)
        if not is_admin_token_request:
            admin_token = request.headers.get("X-Admin-Token")
            if admin_token:
                is_admin_token_request = True

        # Apply appropriate rate limit
        if is_admin_token_request:
            # ADMIN TOKEN REQUEST - Apply strict rate limit

            # Step 1: Validate token with constant-time comparison
            if not validate_admin_token(admin_token):
                logger.warning(
                    f"[RateLimit] Invalid admin token from {client_ip} to {path}"
                )
                return Response(
                    content='{"detail": "Invalid admin token"}',
                    status_code=401,
                    media_type="application/json",
                )

            # Step 2: Check IP whitelist (if configured)
            if not is_ip_whitelisted(client_ip):
                logger.error(
                    f"[RateLimit] Admin token used from non-whitelisted IP: {client_ip} "
                    f"path={path}"
                )
                return Response(
                    content='{"detail": "IP address not authorized for admin token access"}',
                    status_code=403,
                    media_type="application/json",
                )

            # Step 3: Check rate limit (10 requests per minute)
            rate_key = f"rate_limit:admin_token:{client_ip}"
            count = _rate_limit_store.increment(rate_key, ADMIN_TOKEN_WINDOW_SECONDS)

            if count > ADMIN_TOKEN_RATE_LIMIT:
                logger.warning(
                    f"[RateLimit] Admin token rate limit exceeded: ip={client_ip} "
                    f"path={path} count={count} limit={ADMIN_TOKEN_RATE_LIMIT}"
                )
                return Response(
                    content='{"detail": "Admin token rate limit exceeded. Please try again later."}',
                    status_code=429,
                    headers={"Retry-After": str(ADMIN_TOKEN_WINDOW_SECONDS)},
                    media_type="application/json",
                )

            logger.debug(
                f"[RateLimit] Admin token request allowed: ip={client_ip} "
                f"count={count}/{ADMIN_TOKEN_RATE_LIMIT}"
            )

        else:
            # REGULAR AUTHENTICATED REQUEST OR PUBLIC REQUEST

            # Check if request has authentication
            has_auth = (
                request.headers.get("Authorization") or
                request.headers.get("X-API-Key") or
                request.headers.get("X-Actor-ID")
            )

            if has_auth:
                # Apply authenticated rate limit
                rate_key = f"rate_limit:auth:{client_ip}"
                count = _rate_limit_store.increment(rate_key, AUTHENTICATED_WINDOW_SECONDS)

                if count > AUTHENTICATED_RATE_LIMIT:
                    logger.warning(
                        f"[RateLimit] Authenticated rate limit exceeded: ip={client_ip} "
                        f"path={path} count={count} limit={AUTHENTICATED_RATE_LIMIT}"
                    )
                    return Response(
                        content='{"detail": "Rate limit exceeded. Please try again later."}',
                        status_code=429,
                        headers={"Retry-After": str(AUTHENTICATED_WINDOW_SECONDS)},
                        media_type="application/json",
                    )

                logger.debug(
                    f"[RateLimit] Authenticated request allowed: ip={client_ip} "
                    f"count={count}/{AUTHENTICATED_RATE_LIMIT}"
                )

            # Check if this is a public endpoint that needs rate limiting
            elif self.is_public_rate_limited_path(path):
                rate_key = f"rate_limit:public:{client_ip}"
                count = _rate_limit_store.increment(rate_key, PUBLIC_WINDOW_SECONDS)

                if count > PUBLIC_RATE_LIMIT:
                    logger.warning(
                        f"[RateLimit] Public endpoint rate limit exceeded: ip={client_ip} "
                        f"path={path} count={count} limit={PUBLIC_RATE_LIMIT}"
                    )
                    return Response(
                        content='{"detail": "Rate limit exceeded. Please try again later."}',
                        status_code=429,
                        headers={"Retry-After": str(PUBLIC_WINDOW_SECONDS)},
                        media_type="application/json",
                    )

                logger.debug(
                    f"[RateLimit] Public endpoint request allowed: ip={client_ip} "
                    f"count={count}/{PUBLIC_RATE_LIMIT}"
                )

        # Continue to next middleware/handler
        return await call_next(request)


# ============================================================================
# Setup Function
# ============================================================================

def setup_rate_limit_middleware(app: FastAPI) -> None:
    """
    Set up rate limiting middleware on a FastAPI app.

    This should be called BEFORE authentication middleware so rate limits
    are applied before expensive auth operations.

    Usage:
        from app.middleware.rate_limit import setup_rate_limit_middleware

        app = FastAPI()
        setup_rate_limit_middleware(app)

    Args:
        app: FastAPI application instance
    """
    app.add_middleware(RateLimitMiddleware)

    logger.info(
        "[RateLimit] Middleware initialized: "
        f"admin_token_limit={ADMIN_TOKEN_RATE_LIMIT}/min "
        f"authenticated_limit={AUTHENTICATED_RATE_LIMIT}/min "
        f"public_limit={PUBLIC_RATE_LIMIT}/min "
        f"ip_whitelist={'enabled' if ADMIN_TOKEN_ALLOWED_IPS else 'disabled'} "
        f"backend={'Redis' if _rate_limit_store.use_redis else 'in-memory'}"
    )

    logger.info(
        f"[RateLimit] Public rate-limited endpoints: {', '.join(PUBLIC_RATE_LIMITED_PATHS)}"
    )

    if ADMIN_TOKEN_ALLOWED_IPS:
        logger.info(
            f"[RateLimit] Admin token IP whitelist: {', '.join(ADMIN_TOKEN_ALLOWED_IPS)}"
        )
