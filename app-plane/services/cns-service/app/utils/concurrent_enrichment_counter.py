"""
Concurrent Enrichment Counter

Tracks active enrichment workflows to enforce maximum concurrent limits.
Prevents system overload and database connection exhaustion.

Uses Redis for distributed counter across multiple workers.
"""

import logging
import os
from typing import Optional
from app.cache.redis_cache import RedisCache
from app.config import settings

logger = logging.getLogger(__name__)


class ConcurrentEnrichmentCounter:
    """
    Distributed concurrent enrichment tracker using Redis
    
    Ensures max_concurrent_enrichments limit is enforced across all workers.
    """

    def __init__(self, redis_client: Optional[RedisCache] = None):
        """Initialize counter with Redis backend"""
        self.redis = redis_client or self._get_redis()
        self.max_concurrent = int(os.getenv('MAX_CONCURRENT_ENRICHMENTS', '5'))

    @staticmethod
    def _get_redis() -> RedisCache:
        """Get Redis client"""
        client = RedisCache(redis_url=settings.redis_url)
        client.connect()
        return client

    def increment_counter(self, bom_id: str) -> int:
        """
        Increment concurrent enrichment counter

        Args:
            bom_id: BOM ID being enriched

        Returns:
            New counter value

        Raises:
            Exception: If max concurrent limit exceeded
        """
        try:
            key = "concurrent_enrichments"
            new_count = self.redis.incr(key)

            # Set TTL to auto-cleanup if counter gets stuck
            self.redis.expire(key, 3600)  # 1 hour TTL

            if new_count > self.max_concurrent:
                # Exceeded limit - decrement and fail
                self.redis.decr(key)
                logger.warning(
                    f"Concurrent enrichment limit exceeded: {new_count} > {self.max_concurrent}"
                )
                raise Exception(
                    f"Concurrent enrichment limit exceeded ({new_count}/{self.max_concurrent}). "
                    f"Please wait for current jobs to finish."
                )

            logger.info(
                f"Enrichment started: {bom_id} (concurrent: {new_count}/{self.max_concurrent})"
            )
            return new_count

        except Exception as e:
            if "limit exceeded" in str(e).lower():
                raise
            logger.error(f"Error incrementing counter: {e}", exc_info=True)
            raise

    def decrement_counter(self, bom_id: str, reason: str = "completed") -> int:
        """
        Decrement concurrent enrichment counter

        Args:
            bom_id: BOM ID that finished enriching
            reason: Reason for decrement (completed, failed, cancelled)

        Returns:
            New counter value
        """
        try:
            key = "concurrent_enrichments"
            new_count = max(0, self.redis.decr(key))  # Never go below 0

            logger.info(
                f"Enrichment {reason}: {bom_id} (concurrent: {new_count}/{self.max_concurrent})"
            )
            return new_count

        except Exception as e:
            logger.error(f"Error decrementing counter: {e}", exc_info=True)
            # Don't fail on cleanup errors
            return 0

    def get_current_count(self) -> int:
        """Get current concurrent enrichment count"""
        try:
            key = "concurrent_enrichments"
            count_str = self.redis.get(key)
            count = int(count_str) if count_str else 0
            return count
        except Exception as e:
            logger.error(f"Error getting counter: {e}", exc_info=True)
            return 0

    def reset_counter(self) -> None:
        """Reset counter to 0 (useful for cleanup/debugging)"""
        try:
            key = "concurrent_enrichments"
            self.redis.delete(key)
            logger.warning("🔧 Concurrent enrichment counter reset to 0")
        except Exception as e:
            logger.error(f"Error resetting counter: {e}", exc_info=True)

    def is_at_limit(self) -> bool:
        """Check if at concurrent limit"""
        try:
            current = self.get_current_count()
            return current >= self.max_concurrent
        except Exception:
            return False


# Global instance
_counter = ConcurrentEnrichmentCounter()


def get_enrichment_counter() -> ConcurrentEnrichmentCounter:
    """Get global enrichment counter instance"""
    return _counter


def should_accept_enrichment() -> bool:
    """Check if new enrichment can be accepted"""
    try:
        counter = get_enrichment_counter()
        current = counter.get_current_count()
        max_concurrent = counter.max_concurrent
        
        can_accept = current < max_concurrent
        if not can_accept:
            logger.warning(
                f"Enrichment queue at capacity: {current}/{max_concurrent} concurrent jobs"
            )
        return can_accept
    except Exception as e:
        logger.error(f"Error checking enrichment capacity: {e}", exc_info=True)
        return True  # Fail open for availability
