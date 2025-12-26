"""
Risk Score Cache Layer

Provides Redis-based caching for risk scores as a read model.
This enables fast risk lookups during catalog searches without
cross-database JOINs.

Cache Key Pattern:
    risk:org:{org_id}:component:{component_id}

Data Flow:
    1. RiskCalculator calculates and stores score in Supabase
    2. risk.calculated event published to RabbitMQ
    3. RiskCacheConsumer populates Redis cache
    4. Catalog search enriches results from Redis cache
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from dataclasses import dataclass

from redis.exceptions import RedisError

from app.cache.redis_cache import get_cache, DecimalEncoder

logger = logging.getLogger(__name__)


# Cache configuration
RISK_CACHE_PREFIX = "risk:org:{org_id}:component:{component_id}"
RISK_CACHE_TTL = 3600  # 1 hour default TTL
RISK_CACHE_LONG_TTL = 86400  # 24 hours for stable components


@dataclass
class CachedRiskScore:
    """Risk score data stored in cache."""
    component_id: str
    organization_id: str
    mpn: Optional[str]
    manufacturer: Optional[str]
    total_risk_score: int
    risk_level: str
    lifecycle_risk: int
    supply_chain_risk: int
    compliance_risk: int
    obsolescence_risk: int
    single_source_risk: int
    cached_at: str  # ISO format

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "component_id": self.component_id,
            "organization_id": self.organization_id,
            "mpn": self.mpn,
            "manufacturer": self.manufacturer,
            "total_risk_score": self.total_risk_score,
            "risk_level": self.risk_level,
            "factor_scores": {
                "lifecycle": self.lifecycle_risk,
                "supply_chain": self.supply_chain_risk,
                "compliance": self.compliance_risk,
                "obsolescence": self.obsolescence_risk,
                "single_source": self.single_source_risk,
            },
            "cached_at": self.cached_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CachedRiskScore":
        """Create from dictionary with validation."""
        # Validate required fields
        if not data.get("component_id"):
            raise ValueError("component_id is required")
        if not data.get("organization_id"):
            raise ValueError("organization_id is required")

        factor_scores = data.get("factor_scores", {})
        return cls(
            component_id=data["component_id"],
            organization_id=data["organization_id"],
            mpn=data.get("mpn"),
            manufacturer=data.get("manufacturer"),
            total_risk_score=data.get("total_risk_score", 0),
            risk_level=data.get("risk_level", "unknown"),
            lifecycle_risk=factor_scores.get("lifecycle", 0),
            supply_chain_risk=factor_scores.get("supply_chain", 0),
            compliance_risk=factor_scores.get("compliance", 0),
            obsolescence_risk=factor_scores.get("obsolescence", 0),
            single_source_risk=factor_scores.get("single_source", 0),
            cached_at=data.get("cached_at", datetime.utcnow().isoformat()),
        )


def build_risk_cache_key(org_id: str, component_id: str) -> str:
    """
    Build cache key for risk score.

    Args:
        org_id: Organization ID
        component_id: Component ID

    Returns:
        Cache key string
    """
    return RISK_CACHE_PREFIX.format(org_id=org_id, component_id=component_id)


def cache_risk_score(
    org_id: str,
    component_id: str,
    score_data: Dict[str, Any],
    ttl: Optional[int] = None,
) -> bool:
    """
    Cache a risk score in Redis.

    Args:
        org_id: Organization ID
        component_id: Component ID
        score_data: Risk score data (from RiskCalculatedEvent or RiskScore)
        ttl: Optional TTL override

    Returns:
        True if cached successfully
    """
    cache = get_cache()
    if not cache or not cache.is_connected:
        logger.debug("[RiskCache] Cache not available")
        return False

    try:
        key = build_risk_cache_key(org_id, component_id)

        # Add cached_at timestamp if not present
        if "cached_at" not in score_data:
            score_data["cached_at"] = datetime.utcnow().isoformat()

        effective_ttl = ttl if ttl is not None else RISK_CACHE_TTL

        success = cache.set(key, score_data, ttl=effective_ttl)

        if success:
            logger.debug(
                f"[RiskCache] Cached risk score: component={component_id}, "
                f"score={score_data.get('total_risk_score')}, ttl={effective_ttl}s"
            )

        return success

    except Exception as e:
        logger.warning(f"[RiskCache] Error caching risk score: {e}")
        return False


def get_cached_risk(org_id: str, component_id: str) -> Optional[CachedRiskScore]:
    """
    Get cached risk score from Redis.

    Args:
        org_id: Organization ID
        component_id: Component ID

    Returns:
        CachedRiskScore if found, None otherwise
    """
    cache = get_cache()
    if not cache or not cache.is_connected:
        return None

    try:
        key = build_risk_cache_key(org_id, component_id)
        data = cache.get(key)

        if data is None:
            return None

        return CachedRiskScore.from_dict(data)

    except Exception as e:
        logger.warning(f"[RiskCache] Error getting cached risk: {e}")
        return None


def get_cached_risk_dict(org_id: str, component_id: str) -> Optional[Dict[str, Any]]:
    """
    Get cached risk score as dictionary (for API responses).

    Args:
        org_id: Organization ID
        component_id: Component ID

    Returns:
        Risk score dictionary if found, None otherwise
    """
    cached = get_cached_risk(org_id, component_id)
    if cached:
        return cached.to_dict()
    return None


def delete_cached_risk(org_id: str, component_id: str) -> bool:
    """
    Delete cached risk score (for invalidation).

    Args:
        org_id: Organization ID
        component_id: Component ID

    Returns:
        True if deleted successfully
    """
    cache = get_cache()
    if not cache or not cache.is_connected:
        return False

    try:
        key = build_risk_cache_key(org_id, component_id)
        success = cache.delete(key)

        if success:
            logger.debug(f"[RiskCache] Invalidated cache: component={component_id}")

        return success

    except Exception as e:
        logger.warning(f"[RiskCache] Error deleting cached risk: {e}")
        return False


def get_cached_risks_batch(
    org_id: str,
    component_ids: List[str],
) -> Dict[str, Optional[CachedRiskScore]]:
    """
    Get multiple cached risk scores efficiently (batch operation).

    Args:
        org_id: Organization ID
        component_ids: List of component IDs

    Returns:
        Dictionary mapping component_id to CachedRiskScore (or None if not cached)
    """
    cache = get_cache()
    if not cache or not cache.is_connected:
        return {cid: None for cid in component_ids}

    results = {}
    client = cache.get_client()

    if not client:
        return {cid: None for cid in component_ids}

    try:
        # Build all keys
        keys = [build_risk_cache_key(org_id, cid) for cid in component_ids]

        # Use MGET for batch retrieval
        values = client.mget(keys)

        for i, (cid, value) in enumerate(zip(component_ids, values)):
            if value is None:
                results[cid] = None
            else:
                try:
                    data = json.loads(value)
                    results[cid] = CachedRiskScore.from_dict(data)
                except (json.JSONDecodeError, KeyError) as e:
                    logger.warning(f"[RiskCache] Invalid cached data for {cid}: {e}")
                    results[cid] = None

        return results

    except Exception as e:
        logger.warning(f"[RiskCache] Error in batch get: {e}")
        return {cid: None for cid in component_ids}


def invalidate_org_risk_cache(org_id: str) -> int:
    """
    Invalidate all cached risk scores for an organization.

    Uses SCAN to avoid blocking Redis.

    Args:
        org_id: Organization ID

    Returns:
        Number of keys deleted
    """
    cache = get_cache()
    if not cache or not cache.is_connected:
        return 0

    client = cache.get_client()
    if not client:
        return 0

    try:
        pattern = f"risk:org:{org_id}:component:*"
        deleted_count = 0

        # Use scan_iter instead of keys() to avoid blocking
        for key in client.scan_iter(match=pattern, count=100):
            client.delete(key)
            deleted_count += 1

        if deleted_count > 0:
            logger.info(f"[RiskCache] Invalidated {deleted_count} cached scores for org={org_id}")

        return deleted_count

    except Exception as e:
        logger.warning(f"[RiskCache] Error invalidating org cache: {e}")
        return 0


def get_risk_cache_stats(org_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Get risk cache statistics.

    Args:
        org_id: Optional organization ID to filter stats

    Returns:
        Statistics dictionary
    """
    cache = get_cache()
    if not cache or not cache.is_connected:
        return {"connected": False, "error": "Cache not available"}

    client = cache.get_client()
    if not client:
        return {"connected": False, "error": "Client not available"}

    try:
        if org_id:
            pattern = f"risk:org:{org_id}:component:*"
        else:
            pattern = "risk:org:*:component:*"

        # Count keys using scan_iter
        count = sum(1 for _ in client.scan_iter(match=pattern, count=100))

        return {
            "connected": True,
            "cached_risk_scores": count,
            "pattern": pattern,
            "ttl_seconds": RISK_CACHE_TTL,
        }

    except Exception as e:
        logger.warning(f"[RiskCache] Error getting stats: {e}")
        return {"connected": False, "error": str(e)}
