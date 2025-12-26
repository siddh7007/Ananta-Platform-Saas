"""
Component Redis Storage

Temporary storage for low-quality enriched components that need re-enrichment.
High-quality components go to permanent database, low-quality stay in Redis.
"""

import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from .redis_cache import get_cache

logger = logging.getLogger(__name__)


def build_component_redis_key(mpn: str, manufacturer: str) -> str:
    """
    Build Redis key for low-quality component temporary storage.

    Args:
        mpn: Manufacturer part number
        manufacturer: Manufacturer name

    Returns:
        Redis key (e.g., "low_quality_component:STMicroelectronics:STM32F407VGT6")
    """
    # Normalize to prevent duplicates
    mpn_normalized = mpn.strip().upper()
    manufacturer_normalized = manufacturer.strip().upper()
    return f"low_quality_component:{manufacturer_normalized}:{mpn_normalized}"


def save_low_quality_component(
    mpn: str,
    manufacturer: str,
    enrichment_data: Dict[str, Any],
    ttl_days: int = 7
) -> Optional[str]:
    """
    Save low-quality enriched component to Redis for re-enrichment.

    Args:
        mpn: Manufacturer part number
        manufacturer: Manufacturer name
        enrichment_data: Enrichment data from supplier APIs
        ttl_days: Time-to-live in days (default 7)

    Returns:
        Redis key if saved successfully, None otherwise
    """
    cache = get_cache()
    if not cache or not cache.is_connected:
        logger.warning("Redis not available, cannot save low-quality component")
        return None

    redis_key = build_component_redis_key(mpn, manufacturer)

    # Build component record
    component_record = {
        'mpn': mpn,
        'manufacturer': manufacturer,
        'enrichment_data': enrichment_data,
        'quality_score': enrichment_data.get('quality_score', 0),
        'enrichment_source': enrichment_data.get('enrichment_source', 'unknown'),
        'api_source': enrichment_data.get('api_source', 'unknown'),
        'stored_at': datetime.utcnow().isoformat(),
        'needs_reenrichment': True,
        'storage_type': 'redis_temporary'
    }

    # Convert days to seconds
    ttl_seconds = ttl_days * 24 * 60 * 60

    try:
        success = cache.set(redis_key, component_record, ttl=ttl_seconds)

        if success:
            logger.info(
                f"✅ Saved low-quality component to Redis: {mpn} "
                f"(quality={enrichment_data.get('quality_score', 0)}, TTL={ttl_days}d)"
            )
            return redis_key
        else:
            logger.error(f"Failed to save low-quality component to Redis: {mpn}")
            return None

    except Exception as e:
        logger.error(f"Error saving low-quality component to Redis: {e}", exc_info=True)
        return None


def get_low_quality_component(mpn: str, manufacturer: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve low-quality component from Redis.

    Args:
        mpn: Manufacturer part number
        manufacturer: Manufacturer name

    Returns:
        Component record if found, None otherwise
    """
    cache = get_cache()
    if not cache or not cache.is_connected:
        return None

    redis_key = build_component_redis_key(mpn, manufacturer)

    try:
        component_record = cache.get(redis_key)

        if component_record:
            logger.info(f"Found low-quality component in Redis: {mpn}")
            return component_record

        return None

    except Exception as e:
        logger.error(f"Error getting low-quality component from Redis: {e}", exc_info=True)
        return None


def delete_low_quality_component(mpn: str, manufacturer: str) -> bool:
    """
    Delete low-quality component from Redis (e.g., after successful re-enrichment).

    Args:
        mpn: Manufacturer part number
        manufacturer: Manufacturer name

    Returns:
        True if deleted, False otherwise
    """
    cache = get_cache()
    if not cache or not cache.is_connected:
        return False

    redis_key = build_component_redis_key(mpn, manufacturer)

    try:
        success = cache.delete(redis_key)

        if success:
            logger.info(f"Deleted low-quality component from Redis: {mpn}")

        return success

    except Exception as e:
        logger.error(f"Error deleting low-quality component from Redis: {e}", exc_info=True)
        return False


def update_low_quality_component(
    mpn: str,
    manufacturer: str,
    enrichment_data: Dict[str, Any],
    ttl_days: int = 7
) -> bool:
    """
    Update existing low-quality component in Redis (e.g., after re-enrichment attempt).

    Args:
        mpn: Manufacturer part number
        manufacturer: Manufacturer name
        enrichment_data: Updated enrichment data
        ttl_days: Updated TTL in days

    Returns:
        True if updated successfully, False otherwise
    """
    # Get existing record to preserve metadata
    existing = get_low_quality_component(mpn, manufacturer)

    if not existing:
        logger.warning(f"Cannot update - low-quality component not found in Redis: {mpn}")
        return False

    # Update enrichment data while preserving some metadata
    updated_record = {
        **existing,
        'enrichment_data': enrichment_data,
        'quality_score': enrichment_data.get('quality_score', 0),
        'enrichment_source': enrichment_data.get('enrichment_source', 'unknown'),
        'api_source': enrichment_data.get('api_source', 'unknown'),
        'last_updated_at': datetime.utcnow().isoformat(),
        'reenrichment_attempts': existing.get('reenrichment_attempts', 0) + 1
    }

    cache = get_cache()
    redis_key = build_component_redis_key(mpn, manufacturer)
    ttl_seconds = ttl_days * 24 * 60 * 60

    try:
        success = cache.set(redis_key, updated_record, ttl=ttl_seconds)

        if success:
            logger.info(f"Updated low-quality component in Redis: {mpn}")

        return success

    except Exception as e:
        logger.error(f"Error updating low-quality component in Redis: {e}", exc_info=True)
        return False


def get_low_quality_components_for_reenrichment(max_age_days: int = 1) -> list:
    """
    Get all low-quality components from Redis that need re-enrichment.

    This is a placeholder - Redis doesn't support efficient scanning by pattern
    without SCAN command. For production, consider:
    1. Maintaining a separate Redis SET of keys needing re-enrichment
    2. Using a background job to periodically check and re-enrich
    3. Re-enriching on-demand when components are accessed

    Args:
        max_age_days: Only return components older than this many days

    Returns:
        List of component records that need re-enrichment
    """
    cache = get_cache()
    if not cache or not cache.is_connected:
        return []

    try:
        client = cache.get_client()
        if not client:
            return []

        # Scan for low-quality component keys
        # Note: This is inefficient for large datasets, use with caution
        pattern = "low_quality_component:*"
        components_to_reenrich = []

        cursor = 0
        while True:
            cursor, keys = client.scan(cursor, match=pattern, count=100)

            for key in keys:
                component_record = cache.get(key)
                if component_record:
                    # Check age
                    stored_at = component_record.get('stored_at')
                    if stored_at:
                        stored_datetime = datetime.fromisoformat(stored_at)
                        age_days = (datetime.utcnow() - stored_datetime).days

                        if age_days >= max_age_days:
                            components_to_reenrich.append(component_record)

            if cursor == 0:
                break

        logger.info(f"Found {len(components_to_reenrich)} low-quality components for re-enrichment")
        return components_to_reenrich

    except Exception as e:
        logger.error(f"Error scanning for low-quality components: {e}", exc_info=True)
        return []
