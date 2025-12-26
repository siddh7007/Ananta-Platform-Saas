"""
Unified BOM Stream Consumer Runner Module

Provides start/stop functions for the UnifiedBOMStreamConsumer
to be called from main.py lifespan events.

This consumer listens to RabbitMQ Streams for BOM upload events
(customer.bom.uploaded, cns.bom.bulk_uploaded, bom.parsed) and
starts the BOMUnifiedWorkflow in Temporal.

Usage in main.py:
    from app.workers.unified_bom_stream_runner import (
        start_unified_bom_stream_consumer,
        stop_unified_bom_stream_consumer
    )

    # In lifespan startup:
    bom_stream_task = start_unified_bom_stream_consumer()

    # In lifespan shutdown:
    await stop_unified_bom_stream_consumer()
"""

import asyncio
import logging
from typing import Optional

from app.workers.unified_bom_stream_consumer import UnifiedBOMStreamConsumer

logger = logging.getLogger(__name__)

# Global task reference
_consumer_task: Optional[asyncio.Task] = None
_consumer_instance: Optional[UnifiedBOMStreamConsumer] = None


def start_unified_bom_stream_consumer() -> Optional[asyncio.Task]:
    """
    Start UnifiedBOMStreamConsumer as a background task.

    Returns:
        asyncio.Task if started successfully, None otherwise
    """
    global _consumer_task, _consumer_instance

    # Prevent duplicate tasks
    if _consumer_task is not None:
        logger.warning("[BOM-STREAM] Unified BOM stream consumer already running")
        return _consumer_task

    try:
        # Create consumer instance
        _consumer_instance = UnifiedBOMStreamConsumer()

        # Start consumer in background task
        loop = asyncio.get_event_loop()
        _consumer_task = loop.create_task(_run_consumer())

        logger.info("[BOM-STREAM] Unified BOM stream consumer started as background task")
        return _consumer_task

    except Exception as e:
        logger.error(f"[FAIL] Failed to start unified BOM stream consumer: {e}", exc_info=True)
        _consumer_task = None
        _consumer_instance = None
        return None


async def _run_consumer():
    """
    Internal coroutine to run the consumer with error handling.
    """
    global _consumer_instance

    try:
        if _consumer_instance is None:
            logger.error("[FAIL] Consumer instance not initialized")
            return

        # Start consumer (runs indefinitely until cancelled)
        await _consumer_instance.start()

    except asyncio.CancelledError:
        logger.info("[BOM-STREAM] Consumer cancelled (shutdown requested)")
        raise  # Re-raise to allow task cancellation to complete

    except Exception as e:
        logger.error(f"[FAIL] Unified BOM stream consumer error: {e}", exc_info=True)

    finally:
        logger.info("[BOM-STREAM] Consumer task ended")


async def stop_unified_bom_stream_consumer() -> None:
    """
    Stop the UnifiedBOMStreamConsumer background task.

    Cancels the task gracefully and waits for shutdown.
    """
    global _consumer_task, _consumer_instance

    if _consumer_task is None:
        logger.debug("[BOM-STREAM] No consumer task to stop")
        return

    try:
        logger.info("[BOM-STREAM] Stopping unified BOM stream consumer...")

        # Cancel the task
        _consumer_task.cancel()

        # Wait for cancellation to complete
        try:
            await _consumer_task
        except asyncio.CancelledError:
            pass  # Expected on cancellation

        logger.info("[OK] Unified BOM stream consumer stopped")

    except Exception as e:
        logger.error(f"[FAIL] Error stopping BOM stream consumer: {e}", exc_info=True)

    finally:
        _consumer_task = None
        _consumer_instance = None


def is_consumer_running() -> bool:
    """
    Check if the unified BOM stream consumer is currently running.

    Returns:
        True if consumer task exists and is not done
    """
    global _consumer_task
    return _consumer_task is not None and not _consumer_task.done()


def get_consumer_stats() -> dict:
    """
    Get consumer statistics for monitoring/health checks.

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
