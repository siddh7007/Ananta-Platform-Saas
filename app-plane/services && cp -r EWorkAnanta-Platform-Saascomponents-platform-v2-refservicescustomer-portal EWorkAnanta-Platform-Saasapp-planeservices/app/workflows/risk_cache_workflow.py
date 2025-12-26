"""
Risk Cache Temporal Workflow

Temporal-based workflow for populating and maintaining the Redis risk score cache.
This provides an alternative to the RabbitMQ consumer with better durability,
observability, and retry handling.

Activities:
- cache_risk_score_activity: Cache a single risk score
- cache_risk_scores_batch_activity: Cache multiple risk scores in batch
- sync_risk_cache_from_db_activity: Populate cache from database (recovery/init)
- invalidate_org_risk_cache_activity: Invalidate all cached scores for an org

Workflows:
- RiskCacheSyncWorkflow: Batch sync risk scores from DB to cache
- RiskCacheMaintenanceWorkflow: Scheduled maintenance (cleanup, stats)
"""

import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Dict, Any, List, Optional

from temporalio import activity, workflow
from temporalio.common import RetryPolicy

logger = logging.getLogger(__name__)


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class RiskScoreInput:
    """Input for caching a single risk score."""
    component_id: str
    organization_id: str
    mpn: Optional[str] = None
    manufacturer: Optional[str] = None
    total_risk_score: int = 0
    risk_level: str = "unknown"
    lifecycle_risk: int = 0
    supply_chain_risk: int = 0
    compliance_risk: int = 0
    obsolescence_risk: int = 0
    single_source_risk: int = 0


@dataclass
class RiskCacheBatchInput:
    """Input for batch caching operation."""
    organization_id: str
    scores: List[Dict[str, Any]]  # List of risk score dictionaries


@dataclass
class RiskCacheSyncInput:
    """Input for database sync operation."""
    organization_id: Optional[str] = None  # None = all orgs
    limit: int = 1000  # Max scores to sync per batch
    offset: int = 0


@dataclass
class RiskCacheResult:
    """Result from cache operations."""
    success: bool
    cached_count: int = 0
    failed_count: int = 0
    error_message: Optional[str] = None


# =============================================================================
# Activities
# =============================================================================

@activity.defn
async def cache_risk_score_activity(input: RiskScoreInput) -> RiskCacheResult:
    """
    Activity: Cache a single risk score in Redis.

    Args:
        input: Risk score data to cache

    Returns:
        RiskCacheResult with success status
    """
    from app.cache.risk_cache import cache_risk_score

    try:
        score_data = {
            "component_id": input.component_id,
            "organization_id": input.organization_id,
            "mpn": input.mpn,
            "manufacturer": input.manufacturer,
            "total_risk_score": input.total_risk_score,
            "risk_level": input.risk_level,
            "factor_scores": {
                "lifecycle": input.lifecycle_risk,
                "supply_chain": input.supply_chain_risk,
                "compliance": input.compliance_risk,
                "obsolescence": input.obsolescence_risk,
                "single_source": input.single_source_risk,
            },
        }

        success = cache_risk_score(
            org_id=input.organization_id,
            component_id=input.component_id,
            score_data=score_data,
        )

        if success:
            logger.info(
                f"[RiskCache] Cached score: component={input.component_id}, "
                f"score={input.total_risk_score}"
            )
            return RiskCacheResult(success=True, cached_count=1)
        else:
            return RiskCacheResult(
                success=False,
                error_message="Cache operation returned False"
            )

    except Exception as e:
        logger.error(f"[RiskCache] Failed to cache score: {e}")
        return RiskCacheResult(success=False, error_message=str(e))


@activity.defn
async def cache_risk_scores_batch_activity(input: RiskCacheBatchInput) -> RiskCacheResult:
    """
    Activity: Cache multiple risk scores in batch.

    More efficient than individual caching for bulk operations.

    Args:
        input: Batch of risk scores to cache

    Returns:
        RiskCacheResult with counts
    """
    from app.cache.risk_cache import cache_risk_score

    cached_count = 0
    failed_count = 0

    for score_data in input.scores:
        try:
            component_id = score_data.get("component_id")
            if not component_id:
                failed_count += 1
                continue

            success = cache_risk_score(
                org_id=input.organization_id,
                component_id=component_id,
                score_data=score_data,
            )

            if success:
                cached_count += 1
            else:
                failed_count += 1

        except Exception as e:
            logger.warning(f"[RiskCache] Batch item failed: {e}")
            failed_count += 1

    logger.info(
        f"[RiskCache] Batch complete: cached={cached_count}, failed={failed_count}"
    )

    return RiskCacheResult(
        success=failed_count == 0,
        cached_count=cached_count,
        failed_count=failed_count,
    )


@activity.defn
async def sync_risk_cache_from_db_activity(input: RiskCacheSyncInput) -> RiskCacheResult:
    """
    Activity: Sync risk scores from database to Redis cache.

    Used for:
    - Initial cache population
    - Cache recovery after Redis restart
    - Scheduled cache refresh

    Args:
        input: Sync parameters (org filter, pagination)

    Returns:
        RiskCacheResult with sync counts
    """
    from sqlalchemy import text
    from app.models.dual_database import get_dual_database
    from app.cache.risk_cache import cache_risk_score

    try:
        db = next(get_dual_database().get_session("supabase"))

        # Build query with optional org filter
        params: Dict[str, Any] = {
            "limit": input.limit,
            "offset": input.offset,
        }

        org_filter = ""
        if input.organization_id:
            org_filter = "WHERE organization_id = :org_id"
            params["org_id"] = input.organization_id

        sql = text(f"""
            SELECT
                id as component_id,
                organization_id,
                mpn,
                manufacturer,
                total_risk_score,
                risk_level,
                lifecycle_risk,
                supply_chain_risk,
                compliance_risk,
                obsolescence_risk,
                single_source_risk,
                calculated_at
            FROM component_risk_scores
            {org_filter}
            ORDER BY calculated_at DESC
            LIMIT :limit OFFSET :offset
        """)

        rows = db.execute(sql, params).fetchall()

        cached_count = 0
        failed_count = 0

        for row in rows:
            try:
                org_id = str(row[1]) if row[1] else None
                component_id = str(row[0]) if row[0] else None

                if not org_id or not component_id:
                    failed_count += 1
                    continue

                score_data = {
                    "component_id": component_id,
                    "organization_id": org_id,
                    "mpn": row[2],
                    "manufacturer": row[3],
                    "total_risk_score": row[4] or 0,
                    "risk_level": row[5] or "unknown",
                    "factor_scores": {
                        "lifecycle": row[6] or 0,
                        "supply_chain": row[7] or 0,
                        "compliance": row[8] or 0,
                        "obsolescence": row[9] or 0,
                        "single_source": row[10] or 0,
                    },
                    "calculated_at": row[11].isoformat() if row[11] else None,
                }

                success = cache_risk_score(org_id, component_id, score_data)
                if success:
                    cached_count += 1
                else:
                    failed_count += 1

            except Exception as e:
                logger.warning(f"[RiskCache] Row sync failed: {e}")
                failed_count += 1

        logger.info(
            f"[RiskCache] DB sync complete: cached={cached_count}, "
            f"failed={failed_count}, offset={input.offset}"
        )

        return RiskCacheResult(
            success=True,
            cached_count=cached_count,
            failed_count=failed_count,
        )

    except Exception as e:
        logger.error(f"[RiskCache] DB sync failed: {e}")
        return RiskCacheResult(success=False, error_message=str(e))


@activity.defn
async def invalidate_org_risk_cache_activity(organization_id: str) -> RiskCacheResult:
    """
    Activity: Invalidate all cached risk scores for an organization.

    Args:
        organization_id: Organization to invalidate

    Returns:
        RiskCacheResult with deleted count
    """
    from app.cache.risk_cache import invalidate_org_risk_cache

    try:
        deleted_count = invalidate_org_risk_cache(organization_id)

        logger.info(
            f"[RiskCache] Invalidated {deleted_count} cached scores for org={organization_id}"
        )

        return RiskCacheResult(
            success=True,
            cached_count=deleted_count,  # Reuse field for deleted count
        )

    except Exception as e:
        logger.error(f"[RiskCache] Invalidation failed: {e}")
        return RiskCacheResult(success=False, error_message=str(e))


@activity.defn
async def get_risk_cache_stats_activity(organization_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Activity: Get risk cache statistics.

    Args:
        organization_id: Optional org filter

    Returns:
        Statistics dictionary
    """
    from app.cache.risk_cache import get_risk_cache_stats

    try:
        stats = get_risk_cache_stats(organization_id)
        logger.info(f"[RiskCache] Stats retrieved: {stats}")
        return stats

    except Exception as e:
        logger.error(f"[RiskCache] Stats failed: {e}")
        return {"connected": False, "error": str(e)}


# =============================================================================
# Workflows
# =============================================================================

@workflow.defn
class RiskCacheSyncWorkflow:
    """
    Workflow: Sync risk scores from database to Redis cache.

    Use cases:
    - Initial cache population on startup
    - Cache recovery after Redis restart
    - Scheduled cache refresh (e.g., nightly)

    Supports pagination for large datasets.
    """

    @workflow.run
    async def run(
        self,
        organization_id: Optional[str] = None,
        batch_size: int = 500,
        max_batches: int = 100,
    ) -> Dict[str, Any]:
        """
        Run the cache sync workflow.

        Args:
            organization_id: Optional org filter (None = all orgs)
            batch_size: Records per batch
            max_batches: Maximum batches to process

        Returns:
            Summary of sync operation
        """
        total_cached = 0
        total_failed = 0
        batches_processed = 0

        for batch_num in range(max_batches):
            offset = batch_num * batch_size

            result = await workflow.execute_activity(
                sync_risk_cache_from_db_activity,
                RiskCacheSyncInput(
                    organization_id=organization_id,
                    limit=batch_size,
                    offset=offset,
                ),
                start_to_close_timeout=timedelta(minutes=5),
                retry_policy=RetryPolicy(
                    initial_interval=timedelta(seconds=1),
                    maximum_interval=timedelta(seconds=30),
                    maximum_attempts=3,
                ),
            )

            total_cached += result.cached_count
            total_failed += result.failed_count
            batches_processed += 1

            # Stop if we got fewer records than batch_size (last batch)
            if result.cached_count + result.failed_count < batch_size:
                break

        return {
            "success": True,
            "organization_id": organization_id,
            "total_cached": total_cached,
            "total_failed": total_failed,
            "batches_processed": batches_processed,
        }


@workflow.defn
class RiskCacheMaintenanceWorkflow:
    """
    Workflow: Scheduled maintenance for risk cache.

    Tasks:
    - Get cache statistics
    - Optionally refresh stale entries
    - Report health metrics
    """

    @workflow.run
    async def run(
        self,
        organization_id: Optional[str] = None,
        refresh_stale: bool = False,
    ) -> Dict[str, Any]:
        """
        Run maintenance workflow.

        Args:
            organization_id: Optional org filter
            refresh_stale: Whether to refresh stale cache entries

        Returns:
            Maintenance report
        """
        # Get current stats
        stats = await workflow.execute_activity(
            get_risk_cache_stats_activity,
            organization_id,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )

        report = {
            "cache_stats": stats,
            "organization_id": organization_id,
            "refresh_performed": False,
        }

        # Optionally refresh cache
        if refresh_stale:
            sync_result = await workflow.execute_activity(
                sync_risk_cache_from_db_activity,
                RiskCacheSyncInput(organization_id=organization_id, limit=1000),
                start_to_close_timeout=timedelta(minutes=5),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
            report["refresh_performed"] = True
            report["refresh_result"] = {
                "cached": sync_result.cached_count,
                "failed": sync_result.failed_count,
            }

        return report


@workflow.defn
class RiskScoreEventWorkflow:
    """
    Workflow: Process a single risk.calculated event.

    Alternative to RabbitMQ consumer for event-driven cache updates.
    Can be triggered via Temporal signal or child workflow.
    """

    @workflow.run
    async def run(self, event_data: Dict[str, Any]) -> RiskCacheResult:
        """
        Process a risk.calculated event and cache the score.

        Args:
            event_data: The event payload

        Returns:
            Cache result
        """
        # Extract fields from event
        component_id = event_data.get("component_id")
        organization_id = event_data.get("organization_id")

        if not component_id or not organization_id:
            return RiskCacheResult(
                success=False,
                error_message="Missing component_id or organization_id"
            )

        factor_scores = event_data.get("factor_scores", {})

        input_data = RiskScoreInput(
            component_id=component_id,
            organization_id=organization_id,
            mpn=event_data.get("mpn"),
            manufacturer=event_data.get("manufacturer"),
            total_risk_score=event_data.get("total_risk_score", 0),
            risk_level=event_data.get("risk_level", "unknown"),
            lifecycle_risk=factor_scores.get("lifecycle", 0),
            supply_chain_risk=factor_scores.get("supply_chain", 0),
            compliance_risk=factor_scores.get("compliance", 0),
            obsolescence_risk=factor_scores.get("obsolescence", 0),
            single_source_risk=factor_scores.get("single_source", 0),
        )

        result = await workflow.execute_activity(
            cache_risk_score_activity,
            input_data,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(
                initial_interval=timedelta(seconds=1),
                maximum_interval=timedelta(seconds=10),
                maximum_attempts=3,
            ),
        )

        return result
