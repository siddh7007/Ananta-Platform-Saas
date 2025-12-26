"""
Workflow Control Consumer Runner Module

Provides start/stop functions for the WorkflowControlConsumer
to be called from main.py lifespan events.

Usage in main.py:
    from app.workers.workflow_control_runner import (
        start_workflow_control_consumer,
        stop_workflow_control_consumer
    )

    # In lifespan startup:
    consumer_task = start_workflow_control_consumer()

    # In lifespan shutdown:
    await stop_workflow_control_consumer()
"""

import asyncio
import logging
from typing import Optional

from app.workers.workflow_control_consumer import WorkflowControlConsumer

logger = logging.getLogger(__name__)

# Global task reference
_consumer_task: Optional[asyncio.Task] = None
_consumer_instance: Optional[WorkflowControlConsumer] = None


def start_workflow_control_consumer() -> Optional[asyncio.Task]:
    """
    Start WorkflowControlConsumer as a background task

    Returns:
        asyncio.Task if started successfully, None otherwise
    """
    global _consumer_task, _consumer_instance

    # Prevent duplicate tasks
    if _consumer_task is not None:
        logger.warning("Workflow control consumer already running")
        return _consumer_task

    try:
        # Create consumer instance
        _consumer_instance = WorkflowControlConsumer()

        # Start consumer in background task
        loop = asyncio.get_event_loop()
        _consumer_task = loop.create_task(_run_consumer())

        logger.info("📡 Workflow control consumer started as background task")
        return _consumer_task

    except Exception as e:
        logger.error(f"❌ Failed to start workflow control consumer: {e}", exc_info=True)
        _consumer_task = None
        _consumer_instance = None
        return None


async def _run_consumer():
    """
    Internal coroutine to run the consumer with error handling
    """
    global _consumer_instance

    try:
        if _consumer_instance is None:
            logger.error("Consumer instance not initialized")
            return

        # Start consumer (runs indefinitely until cancelled)
        await _consumer_instance.start()

    except asyncio.CancelledError:
        logger.info("Workflow control consumer cancelled (shutdown requested)")
        raise  # Re-raise to allow task cancellation to complete

    except Exception as e:
        logger.error(f"❌ Workflow control consumer error: {e}", exc_info=True)

    finally:
        logger.info("Workflow control consumer task ended")


async def stop_workflow_control_consumer() -> None:
    """
    Stop the WorkflowControlConsumer background task

    Cancels the task gracefully and waits for shutdown.
    """
    global _consumer_task, _consumer_instance

    if _consumer_task is None:
        logger.debug("No workflow control consumer task to stop")
        return

    try:
        logger.info("Stopping workflow control consumer...")

        # Cancel the task
        _consumer_task.cancel()

        # Wait for cancellation to complete
        try:
            await _consumer_task
        except asyncio.CancelledError:
            pass  # Expected on cancellation

        logger.info("✅ Workflow control consumer stopped")

    except Exception as e:
        logger.error(f"❌ Error stopping workflow control consumer: {e}", exc_info=True)

    finally:
        _consumer_task = None
        _consumer_instance = None


def is_consumer_running() -> bool:
    """
    Check if the workflow control consumer is currently running

    Returns:
        True if consumer task exists and is not done
    """
    global _consumer_task
    return _consumer_task is not None and not _consumer_task.done()


def get_consumer_stats() -> dict:
    """
    Get consumer statistics for monitoring/health checks

    Returns:
        Dictionary with consumer metrics
    """
    global _consumer_instance, _consumer_task

    if _consumer_instance is None or _consumer_task is None:
        return {
            "running": False,
            "messages_processed": 0,
            "messages_succeeded": 0,
            "messages_failed": 0,
            "is_healthy": False,
        }

    return {
        "running": not _consumer_task.done(),
        "messages_processed": _consumer_instance.messages_processed,
        "messages_succeeded": _consumer_instance.messages_succeeded,
        "messages_failed": _consumer_instance.messages_failed,
        "is_healthy": _consumer_instance.is_healthy,
        "last_message_time": _consumer_instance.last_message_time.isoformat() if _consumer_instance.last_message_time else None,
        "last_error": _consumer_instance.last_error,
    }
