"""
Scheduled Maintenance Workflows

Temporal workflows for daily/hourly maintenance tasks:
- Trial expiration processing
- Account deletion processing
- Warning notifications

These workflows are scheduled to run automatically via Temporal schedules.
"""

import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Dict

from temporalio import activity, workflow
from temporalio.common import RetryPolicy

logger = logging.getLogger(__name__)


# =============================================================================
# ACTIVITY DEFINITIONS
# =============================================================================

@activity.defn(name="process_trial_expirations")
async def process_trial_expirations_activity() -> Dict[str, Any]:
    """
    Activity: Process expired trials and downgrade to free tier.

    Returns count of processed trials and any errors.
    """
    from app.workers.trial_expiration_worker import handle_trial_expirations

    logger.info("[ScheduledMaintenance] Running trial expiration processing")
    result = await handle_trial_expirations()
    logger.info(f"[ScheduledMaintenance] Trial expiration result: {result}")
    return result


@activity.defn(name="send_trial_warnings")
async def send_trial_warnings_activity(days_ahead: int = 3) -> Dict[str, Any]:
    """
    Activity: Send warning notifications for expiring trials.

    Args:
        days_ahead: Send warnings for trials expiring within this many days
    """
    from app.workers.trial_expiration_worker import send_trial_warning_notifications

    logger.info(f"[ScheduledMaintenance] Sending trial warnings for {days_ahead} days ahead")
    result = await send_trial_warning_notifications(days_ahead)
    logger.info(f"[ScheduledMaintenance] Trial warning result: {result}")
    return result


@activity.defn(name="process_account_deletions")
async def process_account_deletions_activity() -> Dict[str, Any]:
    """
    Activity: Process accounts past grace period for hard deletion.

    Returns count of deleted accounts and any errors.
    """
    from app.workers.account_deletion_worker import process_pending_deletions

    logger.info("[ScheduledMaintenance] Running account deletion processing")
    result = await process_pending_deletions()
    logger.info(f"[ScheduledMaintenance] Account deletion result: {result}")
    return result


@activity.defn(name="send_deletion_warnings")
async def send_deletion_warnings_activity() -> Dict[str, Any]:
    """
    Activity: Send warning notifications for accounts approaching deletion.

    Sends warnings at 7, 3, and 1 day before deletion.
    """
    from app.workers.account_deletion_worker import send_deletion_warnings

    logger.info("[ScheduledMaintenance] Sending deletion warnings")
    result = await send_deletion_warnings()
    logger.info(f"[ScheduledMaintenance] Deletion warning result: {result}")
    return result


@activity.defn(name="get_maintenance_stats")
async def get_maintenance_stats_activity() -> Dict[str, Any]:
    """
    Activity: Get statistics for monitoring dashboard.
    """
    from app.workers.trial_expiration_worker import get_expiring_trials
    from app.workers.account_deletion_worker import get_deletion_stats

    expiring_trials = await get_expiring_trials(days_ahead=7)
    deletion_stats = await get_deletion_stats()

    return {
        "expiring_trials_7_days": len(expiring_trials),
        "deletion_stats": deletion_stats,
    }


# =============================================================================
# WORKFLOW DEFINITIONS
# =============================================================================

@dataclass
class DailyMaintenanceResult:
    """Result from daily maintenance workflow"""
    trial_expirations: Dict[str, Any]
    trial_warnings: Dict[str, Any]
    account_deletions: Dict[str, Any]
    deletion_warnings: Dict[str, Any]
    success: bool
    errors: list


@workflow.defn(name="DailyMaintenanceWorkflow")
class DailyMaintenanceWorkflow:
    """
    Daily maintenance workflow that runs all maintenance tasks.

    Schedule: Daily at 00:00 UTC
    Tasks:
    1. Process expired trials (downgrade to free)
    2. Send trial expiration warnings (3 days ahead)
    3. Process account deletions (past grace period)
    4. Send account deletion warnings (7, 3, 1 days)
    """

    @workflow.run
    async def run(self) -> DailyMaintenanceResult:
        """Execute all daily maintenance tasks."""
        errors = []

        # Retry policy for maintenance activities
        retry_policy = RetryPolicy(
            initial_interval=timedelta(seconds=10),
            maximum_interval=timedelta(minutes=5),
            maximum_attempts=3,
            backoff_coefficient=2.0,
        )

        # 1. Process trial expirations
        workflow.logger.info("Starting trial expiration processing")
        try:
            trial_expirations = await workflow.execute_activity(
                process_trial_expirations_activity,
                start_to_close_timeout=timedelta(minutes=10),
                retry_policy=retry_policy,
            )
        except Exception as e:
            workflow.logger.error(f"Trial expiration failed: {e}")
            trial_expirations = {"error": str(e)}
            errors.append(f"trial_expirations: {e}")

        # 2. Send trial warnings
        workflow.logger.info("Sending trial expiration warnings")
        try:
            trial_warnings = await workflow.execute_activity(
                send_trial_warnings_activity,
                args=[3],  # 3 days ahead
                start_to_close_timeout=timedelta(minutes=10),
                retry_policy=retry_policy,
            )
        except Exception as e:
            workflow.logger.error(f"Trial warnings failed: {e}")
            trial_warnings = {"error": str(e)}
            errors.append(f"trial_warnings: {e}")

        # 3. Process account deletions
        workflow.logger.info("Starting account deletion processing")
        try:
            account_deletions = await workflow.execute_activity(
                process_account_deletions_activity,
                start_to_close_timeout=timedelta(minutes=30),
                retry_policy=retry_policy,
            )
        except Exception as e:
            workflow.logger.error(f"Account deletion failed: {e}")
            account_deletions = {"error": str(e)}
            errors.append(f"account_deletions: {e}")

        # 4. Send deletion warnings
        workflow.logger.info("Sending account deletion warnings")
        try:
            deletion_warnings = await workflow.execute_activity(
                send_deletion_warnings_activity,
                start_to_close_timeout=timedelta(minutes=10),
                retry_policy=retry_policy,
            )
        except Exception as e:
            workflow.logger.error(f"Deletion warnings failed: {e}")
            deletion_warnings = {"error": str(e)}
            errors.append(f"deletion_warnings: {e}")

        workflow.logger.info(f"Daily maintenance completed with {len(errors)} errors")

        return DailyMaintenanceResult(
            trial_expirations=trial_expirations,
            trial_warnings=trial_warnings,
            account_deletions=account_deletions,
            deletion_warnings=deletion_warnings,
            success=len(errors) == 0,
            errors=errors,
        )


@workflow.defn(name="TrialExpirationWorkflow")
class TrialExpirationWorkflow:
    """
    Dedicated workflow for trial expiration processing.

    Can be run independently or as part of DailyMaintenanceWorkflow.
    """

    @workflow.run
    async def run(self) -> Dict[str, Any]:
        """Process trial expirations and send warnings."""
        retry_policy = RetryPolicy(
            initial_interval=timedelta(seconds=10),
            maximum_interval=timedelta(minutes=5),
            maximum_attempts=3,
        )

        # Process expirations
        expirations = await workflow.execute_activity(
            process_trial_expirations_activity,
            start_to_close_timeout=timedelta(minutes=10),
            retry_policy=retry_policy,
        )

        # Send warnings
        warnings = await workflow.execute_activity(
            send_trial_warnings_activity,
            args=[3],
            start_to_close_timeout=timedelta(minutes=10),
            retry_policy=retry_policy,
        )

        return {
            "expirations": expirations,
            "warnings": warnings,
        }


@workflow.defn(name="AccountDeletionWorkflow")
class AccountDeletionWorkflow:
    """
    Dedicated workflow for account deletion processing.

    Can be run independently or as part of DailyMaintenanceWorkflow.
    """

    @workflow.run
    async def run(self) -> Dict[str, Any]:
        """Process account deletions and send warnings."""
        retry_policy = RetryPolicy(
            initial_interval=timedelta(seconds=10),
            maximum_interval=timedelta(minutes=5),
            maximum_attempts=3,
        )

        # Process deletions
        deletions = await workflow.execute_activity(
            process_account_deletions_activity,
            start_to_close_timeout=timedelta(minutes=30),
            retry_policy=retry_policy,
        )

        # Send warnings
        warnings = await workflow.execute_activity(
            send_deletion_warnings_activity,
            start_to_close_timeout=timedelta(minutes=10),
            retry_policy=retry_policy,
        )

        return {
            "deletions": deletions,
            "warnings": warnings,
        }


# =============================================================================
# WORKFLOW AND ACTIVITY REGISTRATION
# =============================================================================

# List of workflows to register with Temporal worker
SCHEDULED_WORKFLOWS = [
    DailyMaintenanceWorkflow,
    TrialExpirationWorkflow,
    AccountDeletionWorkflow,
]

# List of activities to register with Temporal worker
SCHEDULED_ACTIVITIES = [
    process_trial_expirations_activity,
    send_trial_warnings_activity,
    process_account_deletions_activity,
    send_deletion_warnings_activity,
    get_maintenance_stats_activity,
]
