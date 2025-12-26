"""
Redis Cache Layer

Provides caching for supplier API responses and AI suggestions.
"""

import json
import logging
from typing import Optional, Any, Dict
from decimal import Decimal
from uuid import UUID
from datetime import datetime
from redis import Redis
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)


class DecimalEncoder(json.JSONEncoder):
    """JSON encoder that handles Decimal, UUID, and datetime objects"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        elif isinstance(obj, UUID):
            return str(obj)
        elif isinstance(obj, datetime):
            return obj.isoformat()
        return super(DecimalEncoder, self).default(obj)


class RedisCache:
    """
    Redis cache client

    Usage:
        cache = RedisCache(redis_url="redis://localhost:6379/0")
        cache.set("key", {"data": "value"}, ttl=3600)
        data = cache.get("key")
    """

    def __init__(self, redis_url: str, default_ttl: int = 3600):
        """
        Initialize Redis cache

        Args:
            redis_url: Redis connection URL
            default_ttl: Default TTL in seconds (default 1 hour)
        """
        self.redis_url = redis_url
        self.default_ttl = default_ttl
        self._client: Optional[Redis] = None

    def connect(self):
        """Connect to Redis"""
        try:
            self._client = Redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=5
            )
            # Test connection
            self._client.ping()
            logger.info(f"✅ Redis connected: {self.redis_url}")
        except RedisError as e:
            logger.error(f"❌ Redis connection failed: {e}")
            self._client = None

    def disconnect(self):
        """Disconnect from Redis"""
        if self._client:
            self._client.close()
            self._client = None
            logger.info("Redis disconnected")

    @property
    def is_connected(self) -> bool:
        """Check if Redis is connected"""
        if not self._client:
            return False
        try:
            self._client.ping()
            return True
        except RedisError:
            return False

    def get_client(self) -> Optional[Redis]:
        """
        Get underlying Redis client for advanced usage.

        Returns:
            Redis client if connected, None otherwise
        """
        return self._client if self.is_connected else None

    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found/error
        """
        if not self.is_connected:
            return None

        try:
            value = self._client.get(key)
            if value is None:
                return None
            return json.loads(value)
        except (RedisError, json.JSONDecodeError) as e:
            logger.warning(f"Cache GET error for key '{key}': {e}")
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        Set value in cache

        Args:
            key: Cache key
            value: Value to cache (must be JSON serializable)
            ttl: Time-to-live in seconds (None = use default)

        Returns:
            True if successful, False otherwise
        """
        if not self.is_connected:
            return False

        try:
            ttl = ttl if ttl is not None else self.default_ttl
            serialized = json.dumps(value, cls=DecimalEncoder)
            self._client.setex(key, ttl, serialized)
            return True
        except (RedisError, TypeError) as e:
            logger.warning(f"Cache SET error for key '{key}': {e}")
            return False

    def delete(self, key: str) -> bool:
        """
        Delete key from cache

        Args:
            key: Cache key

        Returns:
            True if deleted, False otherwise
        """
        if not self.is_connected:
            return False

        try:
            self._client.delete(key)
            return True
        except RedisError as e:
            logger.warning(f"Cache DELETE error for key '{key}': {e}")
            return False

    def exists(self, key: str) -> bool:
        """
        Check if key exists in cache

        Args:
            key: Cache key

        Returns:
            True if exists, False otherwise
        """
        if not self.is_connected:
            return False

        try:
            return bool(self._client.exists(key))
        except RedisError:
            return False

    def flush_all(self) -> bool:
        """
        Flush all cache (use with caution!)

        Returns:
            True if successful
        """
        if not self.is_connected:
            return False

        try:
            self._client.flushdb()
            logger.warning("⚠️  Redis cache flushed")
            return True
        except RedisError as e:
            logger.error(f"Cache FLUSH error: {e}")
            return False

    def get_stats(self) -> Optional[Dict[str, Any]]:
        """
        Get cache statistics

        Returns:
            Dictionary with cache stats or None
        """
        if not self.is_connected:
            return None

        try:
            info = self._client.info()
            return {
                "connected": True,
                "used_memory_human": info.get("used_memory_human"),
                "total_keys": self._client.dbsize(),
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
                "evicted_keys": info.get("evicted_keys", 0),
            }
        except RedisError as e:
            logger.error(f"Cache STATS error: {e}")
            return {"connected": False, "error": str(e)}


# Cache key builders for different data types

def build_supplier_cache_key(supplier: str, mpn: str) -> str:
    """
    Build cache key for supplier API response

    Args:
        supplier: Supplier name (mouser, digikey, etc.)
        mpn: Manufacturer part number

    Returns:
        Cache key
    """
    return f"supplier:{supplier}:{mpn}"


def build_ai_cache_key(provider: str, prompt_hash: str) -> str:
    """
    Build cache key for AI suggestion

    Args:
        provider: AI provider (ollama, openai, etc.)
        prompt_hash: Hash of the prompt

    Returns:
        Cache key
    """
    return f"ai:{provider}:{prompt_hash}"


def build_category_cache_key(vendor: str, vendor_category: str) -> str:
    """
    Build cache key for category normalization

    Args:
        vendor: Vendor name
        vendor_category: Vendor's category string

    Returns:
        Cache key
    """
    return f"category:{vendor}:{vendor_category}"


# Global cache instance (initialized in main.py)
_cache: Optional[RedisCache] = None


def init_cache(redis_url: str, default_ttl: int = 3600) -> RedisCache:
    """
    Initialize global cache instance

    Args:
        redis_url: Redis connection URL
        default_ttl: Default TTL in seconds

    Returns:
        RedisCache instance
    """
    global _cache
    _cache = RedisCache(redis_url, default_ttl)
    _cache.connect()
    return _cache


def get_cache() -> Optional[RedisCache]:
    """
    Get global cache instance

    Returns:
        RedisCache instance or None if not initialized
    """
    return _cache


# Async Redis client for Pub/Sub and SSE
from redis import Redis as SyncRedis
from redis.asyncio import Redis as AsyncRedis
from app.config import settings

_async_redis_client: Optional[AsyncRedis] = None


def get_sync_redis_client() -> Optional[SyncRedis]:
    """
    Get synchronous Redis client used by caching helpers.

    Returns:
        redis.Redis client if cache is initialized, otherwise None.
    """
    cache = get_cache()
    if cache and cache.is_connected:
        return cache._client  # type: ignore[attr-defined]
    return None


async def get_redis_client() -> AsyncRedis:
    """
    Get async Redis client for Pub/Sub operations (SSE streaming).

    Returns:
        Async Redis client instance
    """
    global _async_redis_client

    if _async_redis_client is None:
        _async_redis_client = AsyncRedis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=5
        )

    return _async_redis_client
