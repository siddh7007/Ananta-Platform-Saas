"""
Rate Limiter for Admin API Endpoints

Implements token bucket rate limiting using Redis for distributed systems.
Prevents abuse of admin endpoints while allowing legitimate usage.
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, Header, Request
from app.cache.redis_cache import RedisCache

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Token bucket rate limiter using Redis

    Features:
    - Distributed rate limiting across multiple workers
    - Configurable rate limits per endpoint
    - Optional IP-based or token-based limiting
    """

    def __init__(self, redis_client: Optional[RedisCache] = None):
        """
        Initialize rate limiter

        Args:
            redis_client: Redis client (creates new if not provided)
        """
        if redis_client is None:
            # Get Redis URL from environment
            redis_host = os.getenv('REDIS_HOST', 'localhost')
            redis_port = os.getenv('REDIS_PORT', '6379')
            redis_db = os.getenv('REDIS_DB', '0')
            redis_url = f"redis://{redis_host}:{redis_port}/{redis_db}"
            redis_client = RedisCache(redis_url=redis_url)
            redis_client.connect()

        self.redis_cache = redis_client
        # Get underlying Redis client for raw operations (ttl, incr, setex)
        self.redis = redis_client.get_client()

    def check_rate_limit(
        self,
        identifier: str,
        max_requests: int = 60,
        window_seconds: int = 60
    ) -> bool:
        """
        Check if request is within rate limit

        Args:
            identifier: Unique identifier (IP address, API token, etc.)
            max_requests: Maximum requests allowed in window
            window_seconds: Time window in seconds

        Returns:
            True if within limit, False if exceeded

        Raises:
            HTTPException: 429 if rate limit exceeded
        """
        key = f"rate_limit:{identifier}"
        current_time = datetime.now()

        # If Redis is not available, fail open (allow request)
        if not self.redis:
            logger.warning("Rate limiter: Redis not available, failing open")
            return True

        try:
            # Get current request count
            count_str = self.redis.get(key)
            if count_str is None:
                # Key doesn't exist - first request in window
                count = 0
            else:
                try:
                    count = int(count_str)
                except (ValueError, TypeError):
                    # Invalid count stored - reset to 0
                    logger.warning(f"Invalid count in rate limiter for {identifier}: {count_str}, resetting to 0")
                    count = 0

            if count >= max_requests:
                # Get TTL to inform user when limit resets
                ttl = self.redis.ttl(key)
                # TTL returns -2 if key doesn't exist, -1 if no expiry, otherwise seconds
                if ttl < 0:
                    ttl = window_seconds
                reset_time = current_time + timedelta(seconds=ttl)

                logger.warning(
                    f"Rate limit exceeded for {identifier}: "
                    f"{count}/{max_requests} requests in {window_seconds}s"
                )

                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Try again in {ttl} seconds.",
                    headers={
                        "X-RateLimit-Limit": str(max_requests),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": reset_time.isoformat(),
                        "Retry-After": str(ttl)
                    }
                )

            # Increment request count
            if count == 0:
                # First request - set key with expiration
                self.redis.setex(key, window_seconds, 1)
            else:
                # Increment existing key
                self.redis.incr(key)

            remaining = max_requests - count - 1
            logger.debug(f"Rate limit check for {identifier}: {count + 1}/{max_requests} requests, remaining: {remaining}")

            return True

        except HTTPException:
            # Re-raise rate limit exceptions
            raise
        except Exception as e:
            # If Redis fails, allow the request (fail open for availability)
            logger.error(f"Rate limiter error (failing open): {e}", exc_info=True)
            return True


# ============================================================================
# FASTAPI DEPENDENCIES
# ============================================================================

# Global rate limiter instance
_rate_limiter = RateLimiter()


def get_rate_limiter() -> RateLimiter:
    """Get global rate limiter instance"""
    return _rate_limiter


async def rate_limit_admin_endpoints(
    request: Request,
    authorization: Optional[str] = Header(default=None)
):
    """
    Rate limit dependency for admin endpoints

    Uses either:
    1. API token if provided (allows higher limits for authenticated users)
    2. IP address as fallback

    **Rate Limits:**
    - Authenticated (with token): 120 requests/minute
    - Unauthenticated (IP-based): 60 requests/minute
    """
    rate_limiter = get_rate_limiter()

    # Determine identifier (token or IP)
    if authorization and authorization.lower().startswith("bearer "):
        # Use token for identification (allows per-user limits)
        token = authorization.split(" ", 1)[1].strip()
        identifier = f"token:{token[:16]}"  # Use first 16 chars for privacy
        max_requests = 120  # Higher limit for authenticated users
    else:
        # Use IP address for unauthenticated requests
        client_ip = request.client.host if request.client else "unknown"
        identifier = f"ip:{client_ip}"
        max_requests = 60  # Lower limit for unauthenticated

    # Check rate limit
    rate_limiter.check_rate_limit(
        identifier=identifier,
        max_requests=max_requests,
        window_seconds=60
    )


async def rate_limit_sync_endpoints(
    request: Request,
    authorization: Optional[str] = Header(default=None)
):
    """
    Rate limit dependency for sync endpoints (more restrictive)

    Sync operations are expensive, so limit more aggressively.

    **Rate Limits:**
    - 10 requests/minute regardless of authentication
    """
    rate_limiter = get_rate_limiter()

    # Use IP or token for identification
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        identifier = f"sync:token:{token[:16]}"
    else:
        client_ip = request.client.host if request.client else "unknown"
        identifier = f"sync:ip:{client_ip}"

    # Check rate limit (stricter for sync operations)
    rate_limiter.check_rate_limit(
        identifier=identifier,
        max_requests=10,
        window_seconds=60
    )
