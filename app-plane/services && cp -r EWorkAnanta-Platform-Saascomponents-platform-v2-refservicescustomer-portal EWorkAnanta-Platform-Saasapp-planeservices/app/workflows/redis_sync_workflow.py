"""
Temporal Workflow: Redis → PostgreSQL Sync

Periodically syncs Redis component cache to PostgreSQL snapshot table
for Directus visibility. Runs every 5 minutes.

Schedule:
- Interval: 5 minutes
- ID: redis-snapshot-sync-scheduled
- Queue: cns-maintenance
"""

import logging
from datetime import timedelta

from temporalio import workflow, activity
from temporalio.common import RetryPolicy

from app.models.dual_database import get_dual_database
from app.utils.redis_snapshot_sync import RedisSnapshotSync

logger = logging.getLogger(__name__)


# ============================================================================
# ACTIVITIES
# ============================================================================

@activity.defn
async def sync_redis_to_postgres_activity() -> dict:
    """
    Activity: Sync all Redis components to PostgreSQL snapshot

    Returns:
        Dict with sync statistics
    """
    try:
        # Get database session
        dual_db = get_dual_database()
        db = next(dual_db.get_session("components"))

        # Run sync
        sync = RedisSnapshotSync(db)
        stats = sync.sync_all_components()

        logger.info(f"Redis sync completed: {stats}")

        return {
            'success': True,
            'stats': stats,
            'message': f"Synced {stats['synced']} components from Redis"
        }

    except Exception as e:
        logger.error(f"Redis sync activity failed: {e}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
            'message': f"Sync failed: {str(e)}"
        }


@activity.defn
async def cleanup_expired_snapshots_activity() -> dict:
    """
    Activity: Clean up expired snapshots older than 7 days

    Returns:
        Dict with cleanup statistics
    """
    try:
        # Get database session
        dual_db = get_dual_database()
        db = next(dual_db.get_session("components"))

        # Run cleanup
        from sqlalchemy import text
        query = text("SELECT cleanup_expired_redis_snapshots()")
        result = db.execute(query)
        deleted_count = result.scalar()
        db.commit()

        logger.info(f"Cleaned up {deleted_count} expired snapshots")

        return {
            'success': True,
            'deleted_count': deleted_count,
            'message': f"Cleaned up {deleted_count} expired snapshots"
        }

    except Exception as e:
        logger.error(f"Cleanup activity failed: {e}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
            'message': f"Cleanup failed: {str(e)}"
        }


@activity.defn
async def update_supplier_quality_stats_activity() -> dict:
    """
    Activity: Update supplier quality statistics from audit data

    Returns:
        Dict with update status
    """
    try:
        # Get database session
        dual_db = get_dual_database()
        db = next(dual_db.get_session("components"))

        # Update stats
        from datetime import datetime
        from sqlalchemy import text

        today = datetime.now().date()
        query = text("SELECT update_supplier_quality_stats(:date)")
        db.execute(query, {'date': today})
        db.commit()

        logger.info(f"Updated supplier quality stats for {today}")

        return {
            'success': True,
            'date': str(today),
            'message': f"Updated supplier quality stats for {today}"
        }

    except Exception as e:
        logger.error(f"Supplier quality stats update failed: {e}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
            'message': f"Stats update failed: {str(e)}"
        }


# ============================================================================
# WORKFLOW
# ============================================================================

@workflow.defn
class RedisSyncWorkflow:
    """
    Scheduled workflow: Sync Redis to PostgreSQL every 5 minutes

    This workflow:
    1. Syncs Redis components to PostgreSQL snapshot table
    2. Cleans up expired snapshots (> 7 days old)
    3. Updates supplier quality statistics

    Schedule Configuration:
        interval: 5 minutes
        workflow_id: redis-snapshot-sync-scheduled
        task_queue: cns-maintenance
    """

    @workflow.run
    async def run(self) -> dict:
        """
        Execute scheduled sync

        Returns:
            Dict with execution summary
        """
        workflow.logger.info("Starting Redis → PostgreSQL sync workflow")

        # Activity configuration
        retry_policy = RetryPolicy(
            initial_interval=timedelta(seconds=5),
            maximum_interval=timedelta(seconds=60),
            maximum_attempts=3,
            backoff_coefficient=2.0
        )

        start_to_close_timeout = timedelta(minutes=2)

        try:
            # Step 1: Sync Redis to PostgreSQL
            sync_result = await workflow.execute_activity(
                sync_redis_to_postgres_activity,
                start_to_close_timeout=start_to_close_timeout,
                retry_policy=retry_policy,
            )

            # Step 2: Cleanup expired snapshots (run once per day - check if needed)
            # Only run cleanup if sync was successful
            cleanup_result = {'success': True, 'deleted_count': 0, 'message': 'Skipped'}
            if sync_result.get('success'):
                cleanup_result = await workflow.execute_activity(
                    cleanup_expired_snapshots_activity,
                    start_to_close_timeout=timedelta(minutes=1),
                    retry_policy=retry_policy,
                )

            # Step 3: Update supplier quality stats (run once per day)
            stats_result = {'success': True, 'message': 'Skipped'}
            if sync_result.get('success'):
                stats_result = await workflow.execute_activity(
                    update_supplier_quality_stats_activity,
                    start_to_close_timeout=timedelta(minutes=1),
                    retry_policy=retry_policy,
                )

            # Build summary
            summary = {
                'success': True,
                'sync': sync_result,
                'cleanup': cleanup_result,
                'supplier_stats': stats_result,
                'timestamp': workflow.now().isoformat(),
            }

            workflow.logger.info(f"Redis sync workflow completed: {summary}")
            return summary

        except Exception as e:
            workflow.logger.error(f"Redis sync workflow failed: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'timestamp': workflow.now().isoformat(),
            }


# ============================================================================
# SCHEDULE CONFIGURATION
# ============================================================================

# To register this schedule with Temporal worker:
#
# from temporalio.client import Client, Schedule, ScheduleActionStartWorkflow, ScheduleIntervalSpec
# from datetime import timedelta
#
# async def register_redis_sync_schedule(client: Client):
#     """Register Redis sync schedule with Temporal"""
#
#     schedule = Schedule(
#         action=ScheduleActionStartWorkflow(
#             workflow=RedisSyncWorkflow.run,
#             id="redis-sync",
#             task_queue="cns-maintenance",
#         ),
#         spec=ScheduleSpec(
#             intervals=[ScheduleIntervalSpec(every=timedelta(minutes=5))]
#         ),
#     )
#
#     await client.create_schedule(
#         "redis-snapshot-sync-scheduled",
#         schedule,
#         memo={"description": "Sync Redis components to PostgreSQL every 5 minutes"}
#     )
#
#     logger.info("Redis sync schedule registered")


# ============================================================================
# MANUAL TRIGGER (for testing)
# ============================================================================

async def trigger_redis_sync_manually(client):
    """
    Manually trigger Redis sync workflow (for testing)

    Usage:
        from temporalio.client import Client
        from app.workflows.redis_sync_workflow import trigger_redis_sync_manually

        client = await Client.connect("localhost:7233")
        result = await trigger_redis_sync_manually(client)
    """
    from temporalio.client import Client

    handle = await client.start_workflow(
        RedisSyncWorkflow.run,
        id=f"redis-sync-manual-{workflow.now().timestamp()}",
        task_queue="cns-maintenance",
    )

    result = await handle.result()
    logger.info(f"Manual Redis sync completed: {result}")
    return result
