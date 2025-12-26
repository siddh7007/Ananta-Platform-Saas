"""
Supplier Health Monitor

Periodically checks supplier availability and emits activity log events if status changes.
"""

import asyncio
import logging
from typing import Dict, Optional

from app.config import settings
from app.services.supplier_manager_service import get_supplier_manager
from app.models.dual_database import get_dual_database
from app.utils.activity_log import record_audit_log_entry

logger = logging.getLogger(__name__)

_monitor_task: Optional[asyncio.Task] = None
_last_status: Dict[str, bool] = {}
_HEALTH_ORG_ID = "00000000-0000-0000-0000-000000000000"
_consecutive_failures = 0
_STARTUP_DELAY_SECONDS = 10
_HEALTH_CHECK_TIMEOUT_SECONDS = 30
_MAX_BACKOFF_SECONDS = 3600  # 1 hour


def start_supplier_health_monitor() -> Optional[asyncio.Task]:
    """Start background supplier health monitor task."""
    global _monitor_task
    if _monitor_task is not None or not settings.supplier_health_monitor_enabled:
        return _monitor_task

    loop = asyncio.get_event_loop()
    _monitor_task = loop.create_task(_supplier_health_loop())
    logger.info("📡 Supplier health monitor started")
    return _monitor_task


async def stop_supplier_health_monitor() -> None:
    """Stop the background supplier health monitor task."""
    global _monitor_task
    if _monitor_task is None:
        return

    _monitor_task.cancel()
    try:
        await _monitor_task
    except asyncio.CancelledError:
        pass
    _monitor_task = None
    logger.info("📡 Supplier health monitor stopped")


async def _supplier_health_loop():
    global _consecutive_failures

    base_interval = max(settings.supplier_health_interval_seconds, 60)

    # Startup delay to give services time to initialize
    logger.info(f"Supplier health monitor starting in {_STARTUP_DELAY_SECONDS} seconds...")
    await asyncio.sleep(_STARTUP_DELAY_SECONDS)

    while True:
        try:
            # Wrap health check with timeout
            async def check_with_timeout():
                manager = get_supplier_manager()
                health = manager.check_health()
                rate_limits = manager.get_rate_limit_info()
                return health, rate_limits

            health, rate_limits = await asyncio.wait_for(
                check_with_timeout(),
                timeout=_HEALTH_CHECK_TIMEOUT_SECONDS
            )

            await _handle_health_results(health, rate_limits)

            # Reset failure counter on success
            _consecutive_failures = 0
            interval = base_interval

        except asyncio.TimeoutError:
            _consecutive_failures += 1
            logger.warning(
                f"Supplier health check timeout ({_HEALTH_CHECK_TIMEOUT_SECONDS}s) - "
                f"failure #{_consecutive_failures}"
            )
            interval = _calculate_backoff_interval(base_interval, _consecutive_failures)

        except Exception as exc:
            _consecutive_failures += 1
            logger.warning(
                f"Supplier health monitor error (failure #{_consecutive_failures}): {exc}",
                exc_info=True
            )
            interval = _calculate_backoff_interval(base_interval, _consecutive_failures)

        await asyncio.sleep(interval)


def _calculate_backoff_interval(base_interval: int, failures: int) -> int:
    """
    Calculate exponential backoff interval.

    Args:
        base_interval: Normal check interval in seconds
        failures: Number of consecutive failures

    Returns:
        Backoff interval in seconds (capped at _MAX_BACKOFF_SECONDS)
    """
    if failures == 0:
        return base_interval

    # Exponential backoff: base * (2 ^ failures)
    backoff = base_interval * (2 ** (failures - 1))
    capped_backoff = min(backoff, _MAX_BACKOFF_SECONDS)

    logger.info(
        f"Health check backoff: {capped_backoff}s "
        f"(failures: {failures}, max: {_MAX_BACKOFF_SECONDS}s)"
    )

    return capped_backoff


async def _handle_health_results(health: Dict[str, bool], rate_limits: Dict[str, Dict[str, any]]):
    for supplier, status in health.items():
        previous = _last_status.get(supplier)
        if previous is not None and previous == status:
            continue  # no change

        _last_status[supplier] = status
        metadata = {
            "supplier": supplier,
            "healthy": status,
            "rate_limit": rate_limits.get(supplier),
        }
        await _record_health_event(
            event_type="cns.supplier.available" if status else "cns.supplier.unavailable",
            metadata=metadata,
            source="supplier-monitor",
        )


async def _record_health_event(event_type: str, metadata: Dict[str, any], source: str):
    dual_db = get_dual_database()
    session_gen = dual_db.get_session("supabase")
    db = next(session_gen)
    try:
        record_audit_log_entry(
            db,
            event_type=event_type,
            routing_key="cns.supplier.health",
            organization_id=_HEALTH_ORG_ID,
            user_id=source,
            username=source,
            source=source,
            event_data=metadata,
        )
        db.commit()
        logger.info("Supplier health event recorded for %s -> %s", metadata.get("supplier"), metadata.get("healthy"))
    except Exception as exc:
        logger.warning(f"Failed to record supplier health event: {exc}")
        db.rollback()
    finally:
        try:
            session_gen.close()
        except Exception as e:
            logger.warning(f"Session cleanup failed: {e}")
