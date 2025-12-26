"""
Supplier Response Caching

Caches supplier API responses to reduce API calls, costs, and latency.

Key pattern: supplier:{supplier_name}:mpn:{normalized_mpn}:mfr:{normalized_manufacturer}
TTL: 7 days (balance between freshness and API costs)
"""

import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime

from .redis_cache import get_cache, DecimalEncoder

logger = logging.getLogger(__name__)

# Cache TTL: 7 days (604800 seconds)
SUPPLIER_CACHE_TTL = 7 * 24 * 60 * 60


def _normalize_cache_key_part(value: str) -> str:
    """
    Normalize a string for use in cache key.

    Args:
        value: String to normalize

    Returns:
        Normalized string (uppercase, no spaces, no special chars)
    """
    if not value:
        return ""

    # Uppercase, strip spaces, replace special chars
    normalized = value.upper().strip()
    normalized = normalized.replace(" ", "_")
    normalized = normalized.replace("-", "_")
    normalized = normalized.replace("/", "_")

    return normalized


def _build_supplier_cache_key(supplier_name: str, mpn: str, manufacturer: Optional[str] = None) -> str:
    """
    Build Redis cache key for supplier product data.

    Args:
        supplier_name: Supplier name (mouser, digikey, element14)
        mpn: Manufacturer part number
        manufacturer: Optional manufacturer name

    Returns:
        Cache key string
    """
    normalized_mpn = _normalize_cache_key_part(mpn)
    normalized_mfr = _normalize_cache_key_part(manufacturer) if manufacturer else "ANY"
    normalized_supplier = _normalize_cache_key_part(supplier_name)

    return f"supplier:{normalized_supplier}:mpn:{normalized_mpn}:mfr:{normalized_mfr}"


def get_cached_supplier_response(
    supplier_name: str,
    mpn: str,
    manufacturer: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Get cached supplier response from Redis.

    Args:
        supplier_name: Supplier name
        mpn: Manufacturer part number
        manufacturer: Optional manufacturer name

    Returns:
        Cached product data dict or None if not found
    """
    try:
        cache = get_cache()
        if not cache or not cache.is_connected:
            return None

        key = _build_supplier_cache_key(supplier_name, mpn, manufacturer)
        cached_json = cache.get(key)

        if not cached_json:
            logger.debug(f"Cache MISS: {supplier_name}/{mpn}")
            return None

        cached_data = json.loads(cached_json)

        # Check cache age
        cached_at = cached_data.get('cached_at')
        if cached_at:
            age_hours = (datetime.utcnow() - datetime.fromisoformat(cached_at)).total_seconds() / 3600
            logger.info(
                f"✅ Cache HIT: {supplier_name}/{mpn} "
                f"(age: {age_hours:.1f}h, expires in {(SUPPLIER_CACHE_TTL - age_hours * 3600) / 3600:.1f}h)"
            )
        else:
            logger.info(f"✅ Cache HIT: {supplier_name}/{mpn}")

        return cached_data.get('product_data')

    except Exception as e:
        logger.warning(f"Failed to read from supplier cache: {e}")
        return None


def set_cached_supplier_response(
    supplier_name: str,
    mpn: str,
    product_data: Dict[str, Any],
    manufacturer: Optional[str] = None,
    ttl: int = SUPPLIER_CACHE_TTL
) -> bool:
    """
    Cache supplier response in Redis.

    Args:
        supplier_name: Supplier name
        mpn: Manufacturer part number
        product_data: Product data to cache
        manufacturer: Optional manufacturer name
        ttl: Time-to-live in seconds (default: 7 days)

    Returns:
        True if cached successfully
    """
    try:
        cache = get_cache()
        if not cache or not cache.is_connected:
            logger.warning("Redis cache not available, skipping supplier cache")
            return False

        key = _build_supplier_cache_key(supplier_name, mpn, manufacturer)

        # Add metadata
        cache_data = {
            'product_data': product_data,
            'cached_at': datetime.utcnow().isoformat(),
            'supplier_name': supplier_name,
            'mpn': mpn,
            'manufacturer': manufacturer
        }

        # Serialize with DecimalEncoder
        cache_json = json.dumps(cache_data, cls=DecimalEncoder)

        # Store with TTL
        cache.set(key, cache_json, ttl)

        logger.info(
            f"💾 Cached supplier response: {supplier_name}/{mpn} "
            f"(TTL: {ttl / 86400:.1f} days)"
        )
        return True

    except Exception as e:
        logger.warning(f"Failed to cache supplier response: {e}")
        return False


def invalidate_supplier_cache(supplier_name: str, mpn: str, manufacturer: Optional[str] = None) -> bool:
    """
    Invalidate cached supplier response.

    Args:
        supplier_name: Supplier name
        mpn: Manufacturer part number
        manufacturer: Optional manufacturer name

    Returns:
        True if invalidated successfully
    """
    try:
        cache = get_cache()
        if not cache or not cache.is_connected:
            return False

        key = _build_supplier_cache_key(supplier_name, mpn, manufacturer)
        cache.delete(key)

        logger.info(f"🗑️ Invalidated cache: {supplier_name}/{mpn}")
        return True

    except Exception as e:
        logger.warning(f"Failed to invalidate supplier cache: {e}")
        return False


def get_cache_stats() -> Dict[str, Any]:
    """
    Get supplier cache statistics.

    Returns:
        Dict with cache stats (keys, memory, etc.)
    """
    try:
        cache = get_cache()
        if not cache or not cache.is_connected:
            return {'error': 'Cache not available'}

        # Count supplier cache keys
        supplier_keys = []
        for key in cache.redis_client.scan_iter(match="supplier:*", count=1000):
            supplier_keys.append(key)

        return {
            'total_cached_products': len(supplier_keys),
            'ttl_days': SUPPLIER_CACHE_TTL / 86400,
            'cache_connected': True
        }

    except Exception as e:
        logger.error(f"Failed to get cache stats: {e}")
        return {'error': str(e)}
