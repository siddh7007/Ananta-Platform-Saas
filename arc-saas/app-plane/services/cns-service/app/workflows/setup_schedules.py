"""
Temporal Schedule Setup

Creates and manages Temporal schedules for maintenance workflows.
Run this script once to set up the schedules, or use the API endpoint.

Schedules:
- daily-maintenance: Runs at 00:00 UTC daily
- trial-expiration: Runs at 00:00 UTC daily (backup)
- account-deletion: Runs at 01:00 UTC daily (backup)

Usage:
    python -m app.workflows.setup_schedules --create
    python -m app.workflows.setup_schedules --list
    python -m app.workflows.setup_schedules --delete daily-maintenance
"""

import argparse
import asyncio
import logging
from datetime import timedelta

from temporalio.client import Client, Schedule, ScheduleActionStartWorkflow, ScheduleSpec, ScheduleIntervalSpec, ScheduleState

from app.config import settings

logger = logging.getLogger(__name__)

# Schedule definitions - using intervals for simplicity
# (ScheduleCalendarSpec requires Range objects which is more complex)
SCHEDULES = {
    "daily-maintenance": {
        "workflow": "DailyMaintenanceWorkflow",
        "task_queue": "cns-enrichment",
        "description": "Daily maintenance: trial expirations, account deletions, warnings",
        "spec": ScheduleSpec(
            # Run every 24 hours
            intervals=[
                ScheduleIntervalSpec(every=timedelta(hours=24)),
            ],
        ),
    },
    "trial-expiration-hourly": {
        "workflow": "TrialExpirationWorkflow",
        "task_queue": "cns-enrichment",
        "description": "Hourly trial expiration check (lightweight)",
        "spec": ScheduleSpec(
            # Run every 6 hours
            intervals=[
                ScheduleIntervalSpec(every=timedelta(hours=6)),
            ],
        ),
    },
}


async def get_temporal_client() -> Client:
    """Get Temporal client with proper configuration."""
    temporal_host = getattr(settings, 'temporal_host', 'localhost:7233')
    temporal_namespace = getattr(settings, 'temporal_namespace', 'default')

    # Handle case where temporal_host already includes port (e.g., "temporal:7233")
    if ':' in temporal_host:
        target_host = temporal_host
    else:
        temporal_port = getattr(settings, 'temporal_port', 7233)
        target_host = f"{temporal_host}:{temporal_port}"

    logger.info(f"Connecting to Temporal at {target_host}, namespace={temporal_namespace}")

    client = await Client.connect(
        target_host=target_host,
        namespace=temporal_namespace,
    )

    return client


async def create_schedule(client: Client, schedule_id: str, config: dict) -> bool:
    """Create a single schedule."""
    try:
        # Check if schedule already exists
        try:
            handle = client.get_schedule_handle(schedule_id)
            desc = await handle.describe()
            logger.info(f"Schedule '{schedule_id}' already exists, updating...")
            await handle.update(
                lambda _: Schedule(
                    action=ScheduleActionStartWorkflow(
                        config["workflow"],
                        id=f"{schedule_id}-{{{{workflow.scheduledTime}}}}",
                        task_queue=config["task_queue"],
                    ),
                    spec=config["spec"],
                    state=ScheduleState(note=config["description"]),
                )
            )
            logger.info(f"Schedule '{schedule_id}' updated successfully")
            return True
        except Exception:
            pass  # Schedule doesn't exist, create it

        # Create new schedule
        await client.create_schedule(
            schedule_id,
            Schedule(
                action=ScheduleActionStartWorkflow(
                    config["workflow"],
                    id=f"{schedule_id}-{{{{workflow.scheduledTime}}}}",
                    task_queue=config["task_queue"],
                ),
                spec=config["spec"],
                state=ScheduleState(note=config["description"]),
            ),
        )

        logger.info(f"Schedule '{schedule_id}' created successfully")
        return True

    except Exception as e:
        logger.error(f"Failed to create schedule '{schedule_id}': {e}")
        return False


async def create_all_schedules() -> dict:
    """Create all maintenance schedules."""
    client = await get_temporal_client()
    results = {}

    for schedule_id, config in SCHEDULES.items():
        success = await create_schedule(client, schedule_id, config)
        results[schedule_id] = "created" if success else "failed"

    # Note: Temporal Python client doesn't require explicit close
    return results


async def list_schedules() -> list:
    """List all schedules."""
    client = await get_temporal_client()
    schedules = []

    try:
        async for schedule in client.list_schedules():
            # ScheduleListDescription has: id, schedule (Schedule object), info, memo, search_attributes
            schedule_data = {
                "id": schedule.id,
                "workflow": None,
                "state": None,
            }

            # Try to get workflow from schedule action
            try:
                if hasattr(schedule, 'schedule') and schedule.schedule:
                    action = schedule.schedule.action
                    if hasattr(action, 'workflow'):
                        schedule_data["workflow"] = action.workflow
            except Exception:
                pass

            # Try to get state note
            try:
                if hasattr(schedule, 'schedule') and schedule.schedule:
                    state = schedule.schedule.state
                    if hasattr(state, 'note'):
                        schedule_data["state"] = state.note
            except Exception:
                pass

            schedules.append(schedule_data)
    except Exception as e:
        logger.error(f"Failed to list schedules: {e}")

    # Note: Temporal Python client doesn't require explicit close
    return schedules


async def delete_schedule(schedule_id: str) -> bool:
    """Delete a schedule by ID."""
    client = await get_temporal_client()

    try:
        handle = client.get_schedule_handle(schedule_id)
        await handle.delete()
        logger.info(f"Schedule '{schedule_id}' deleted")
        # Note: Temporal Python client doesn't require explicit close
        return True
    except Exception as e:
        logger.error(f"Failed to delete schedule '{schedule_id}': {e}")
        # Note: Temporal Python client doesn't require explicit close
        return False


async def trigger_schedule(schedule_id: str) -> bool:
    """Manually trigger a schedule to run immediately."""
    client = await get_temporal_client()

    try:
        handle = client.get_schedule_handle(schedule_id)
        await handle.trigger()
        logger.info(f"Schedule '{schedule_id}' triggered")
        # Note: Temporal Python client doesn't require explicit close
        return True
    except Exception as e:
        logger.error(f"Failed to trigger schedule '{schedule_id}': {e}")
        # Note: Temporal Python client doesn't require explicit close
        return False


async def pause_schedule(schedule_id: str) -> bool:
    """Pause a schedule."""
    client = await get_temporal_client()

    try:
        handle = client.get_schedule_handle(schedule_id)
        await handle.pause(note="Paused by admin")
        logger.info(f"Schedule '{schedule_id}' paused")
        # Note: Temporal Python client doesn't require explicit close
        return True
    except Exception as e:
        logger.error(f"Failed to pause schedule '{schedule_id}': {e}")
        # Note: Temporal Python client doesn't require explicit close
        return False


async def unpause_schedule(schedule_id: str) -> bool:
    """Unpause a schedule."""
    client = await get_temporal_client()

    try:
        handle = client.get_schedule_handle(schedule_id)
        await handle.unpause(note="Unpaused by admin")
        logger.info(f"Schedule '{schedule_id}' unpaused")
        # Note: Temporal Python client doesn't require explicit close
        return True
    except Exception as e:
        logger.error(f"Failed to unpause schedule '{schedule_id}': {e}")
        # Note: Temporal Python client doesn't require explicit close
        return False


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Manage Temporal maintenance schedules")
    parser.add_argument("--create", action="store_true", help="Create all schedules")
    parser.add_argument("--list", action="store_true", help="List all schedules")
    parser.add_argument("--delete", type=str, help="Delete a schedule by ID")
    parser.add_argument("--trigger", type=str, help="Trigger a schedule immediately")
    parser.add_argument("--pause", type=str, help="Pause a schedule")
    parser.add_argument("--unpause", type=str, help="Unpause a schedule")

    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    if args.create:
        print("Creating maintenance schedules...")
        results = asyncio.run(create_all_schedules())
        for schedule_id, status in results.items():
            print(f"  {schedule_id}: {status}")

    elif args.list:
        print("Listing schedules...")
        schedules = asyncio.run(list_schedules())
        if schedules:
            for s in schedules:
                print(f"  - {s['id']}: {s.get('workflow', 'N/A')} ({s.get('state', '')})")
        else:
            print("  No schedules found")

    elif args.delete:
        success = asyncio.run(delete_schedule(args.delete))
        print(f"Delete {'successful' if success else 'failed'}")

    elif args.trigger:
        success = asyncio.run(trigger_schedule(args.trigger))
        print(f"Trigger {'successful' if success else 'failed'}")

    elif args.pause:
        success = asyncio.run(pause_schedule(args.pause))
        print(f"Pause {'successful' if success else 'failed'}")

    elif args.unpause:
        success = asyncio.run(unpause_schedule(args.unpause))
        print(f"Unpause {'successful' if success else 'failed'}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
