"""
Trial Expiration Worker

Handles trial subscription expirations by:
1. Finding subscriptions where status='trialing' and trial_end < NOW()
2. Updating them to status='active' with free plan (auto-downgrade)
3. Sending Novu notification about trial expiration

Run daily via cron or Temporal scheduled workflow.
"""

import logging
from datetime import datetime
from typing import List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db_session
from shared.notification.client import get_novu_client

logger = logging.getLogger(__name__)


async def handle_trial_expirations() -> dict:
    """
    Process all expired trials and downgrade to free tier.

    This function should be called daily (via cron or scheduled workflow).

    Returns:
        dict with count of processed trials and any errors
    """
    processed_count = 0
    error_count = 0
    expired_orgs: List[str] = []

    try:
        with get_db_session() as db:
            # Find and update expired trials in a single transaction
            result = db.execute(
                text("""
                    UPDATE subscriptions
                    SET
                        status = 'active',
                        plan_id = (SELECT id FROM subscription_plans WHERE slug = 'free' LIMIT 1),
                        trial_start = NULL,
                        trial_end = NULL,
                        updated_at = NOW()
                    WHERE status = 'trialing'
                      AND trial_end < NOW()
                    RETURNING organization_id, id
                """)
            )

            expired_rows = result.fetchall()
            db.commit()

            for row in expired_rows:
                org_id = str(row.organization_id)
                subscription_id = str(row.id)
                expired_orgs.append(org_id)
                processed_count += 1

                logger.info(
                    f"[TrialExpiration] Downgraded trial to free: "
                    f"org={org_id} subscription={subscription_id}"
                )

    except Exception as e:
        logger.error(f"[TrialExpiration] Database error: {e}", exc_info=True)
        error_count += 1

    # Send Novu notifications for expired trials
    if expired_orgs:
        await _send_trial_expired_notifications(expired_orgs)

    result = {
        "processed_count": processed_count,
        "error_count": error_count,
        "expired_organizations": expired_orgs,
        "timestamp": datetime.utcnow().isoformat(),
    }

    logger.info(f"[TrialExpiration] Completed: {result}")
    return result


async def _send_trial_expired_notifications(org_ids: List[str]) -> None:
    """
    Send Novu notifications to all users in expired trial organizations.

    Args:
        org_ids: List of organization IDs whose trials expired
    """
    try:
        novu = get_novu_client()
        if not novu:
            logger.warning("[TrialExpiration] Novu client not available, skipping notifications")
            return

        with get_db_session() as db:
            for org_id in org_ids:
                # Get all users in the organization
                users = db.execute(
                    text("""
                        SELECT u.id, u.email, u.full_name, o.name as org_name
                        FROM users u
                        JOIN organizations o ON u.organization_id = o.id
                        WHERE u.organization_id = :org_id
                          AND u.is_active = true
                    """),
                    {"org_id": org_id}
                ).fetchall()

                for user in users:
                    try:
                        await novu.trigger(
                            workflow_id="trial-expired",
                            subscriber_id=str(user.id),
                            payload={
                                "user_name": user.full_name or user.email,
                                "org_name": user.org_name,
                                "message": "Your 14-day trial has ended. Upgrade to continue using premium features.",
                                "upgrade_url": "/settings/billing",
                            }
                        )
                        logger.debug(
                            f"[TrialExpiration] Notification sent to user={user.id} "
                            f"org={org_id}"
                        )
                    except Exception as e:
                        logger.error(
                            f"[TrialExpiration] Failed to send notification: "
                            f"user={user.id} error={e}"
                        )

    except Exception as e:
        logger.error(f"[TrialExpiration] Notification batch error: {e}", exc_info=True)


async def get_expiring_trials(days_ahead: int = 3) -> List[dict]:
    """
    Get trials expiring in the next N days (for warning notifications).

    Args:
        days_ahead: Number of days to look ahead

    Returns:
        List of subscriptions expiring soon
    """
    # Validate days_ahead to prevent SQL injection
    days_ahead = max(1, min(int(days_ahead), 365))

    try:
        with get_db_session() as db:
            result = db.execute(
                text("""
                    SELECT
                        s.id,
                        s.organization_id,
                        s.trial_end,
                        o.name as org_name,
                        EXTRACT(DAY FROM (s.trial_end - NOW())) as days_remaining
                    FROM subscriptions s
                    JOIN organizations o ON s.organization_id = o.id
                    WHERE s.status = 'trialing'
                      AND s.trial_end > NOW()
                      AND s.trial_end < NOW() + INTERVAL '1 day' * :days_ahead
                    ORDER BY s.trial_end ASC
                """),
                {"days_ahead": days_ahead}
            )

            return [
                {
                    "subscription_id": str(row.id),
                    "organization_id": str(row.organization_id),
                    "org_name": row.org_name,
                    "trial_end": row.trial_end.isoformat() if row.trial_end else None,
                    "days_remaining": int(row.days_remaining) if row.days_remaining else 0,
                }
                for row in result.fetchall()
            ]

    except Exception as e:
        logger.error(f"[TrialExpiration] Failed to get expiring trials: {e}")
        return []


async def send_trial_warning_notifications(days_ahead: int = 3) -> dict:
    """
    Send warning notifications for trials expiring soon.

    Args:
        days_ahead: Send warnings for trials expiring within this many days

    Returns:
        dict with count of notifications sent
    """
    expiring = await get_expiring_trials(days_ahead)
    sent_count = 0

    novu = get_novu_client()
    if not novu:
        logger.warning("[TrialExpiration] Novu client not available")
        return {"sent_count": 0, "expiring_count": len(expiring)}

    with get_db_session() as db:
        for trial in expiring:
            org_id = trial["organization_id"]
            days_left = trial["days_remaining"]

            # Get users in org
            users = db.execute(
                text("""
                    SELECT id, email, full_name
                    FROM users
                    WHERE organization_id = :org_id AND is_active = true
                """),
                {"org_id": org_id}
            ).fetchall()

            for user in users:
                try:
                    await novu.trigger(
                        workflow_id="trial-expiring-soon",
                        subscriber_id=str(user.id),
                        payload={
                            "user_name": user.full_name or user.email,
                            "org_name": trial["org_name"],
                            "days_remaining": days_left,
                            "message": f"Your trial expires in {days_left} day{'s' if days_left != 1 else ''}. Upgrade now to keep your premium features.",
                            "upgrade_url": "/settings/billing",
                        }
                    )
                    sent_count += 1
                except Exception as e:
                    logger.error(f"[TrialExpiration] Warning notification failed: {e}")

    return {
        "sent_count": sent_count,
        "expiring_count": len(expiring),
        "days_ahead": days_ahead,
    }


# =============================================================================
# CLI Entry Point (for cron jobs)
# =============================================================================

if __name__ == "__main__":
    import asyncio

    async def main():
        print("Running trial expiration check...")
        result = await handle_trial_expirations()
        print(f"Result: {result}")

        print("\nChecking for trials expiring in 3 days...")
        warnings = await send_trial_warning_notifications(days_ahead=3)
        print(f"Warnings sent: {warnings}")

    asyncio.run(main())
