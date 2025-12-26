"""
Caching Layer for CNS Service

Provides Redis-based caching for supplier APIs and AI suggestions.
"""

from app.cache.redis_cache import (
    RedisCache,
    init_cache,
    get_cache,
    build_supplier_cache_key,
    build_ai_cache_key,
    build_category_cache_key,
)

__all__ = [
    "RedisCache",
    "init_cache",
    "get_cache",
    "build_supplier_cache_key",
    "build_ai_cache_key",
    "build_category_cache_key",
]
