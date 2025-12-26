"""
Account Deletion Worker

Handles permanent deletion of accounts after the 30-day grace period.

This worker should run daily (via cron or Temporal scheduled workflow) and:
1. Finds organizations where deletion_scheduled_at < NOW() and deleted_at IS NULL
2. Cancels any active subscriptions (Stripe)
3. Deletes all user data (BOMs, projects, components) - HARD DELETE
4. Anonymizes user records (keep for audit, remove PII)
5. Marks organization as deleted_at = NOW()
6. Sends final notification
7. Optionally deletes Auth0 user records

GDPR Compliance:
- User data is permanently deleted
- Audit logs are retained (required for compliance)
- User records are anonymized, not deleted (audit trail)
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db_session
from app.cache.redis_cache import DecimalEncoder
from shared.notification.client import get_novu_client

logger = logging.getLogger(__name__)

# Number of days warning before hard deletion
WARNING_DAYS = [7, 3, 1]


async def process_pending_deletions() -> Dict[str, Any]:
    """
    Process all accounts past their grace period for hard deletion.

    This function should be called daily (via cron or scheduled workflow).

    Returns:
        dict with count of processed deletions and any errors
    """
    processed_count = 0
    error_count = 0
    deleted_orgs: List[str] = []
    errors: List[Dict[str, str]] = []

    logger.info("[AccountDeletion] Starting pending deletion processing")

    try:
        with get_db_session() as db:
            # Find organizations past grace period
            pending = db.execute(
                text("""
                    SELECT
                        o.id,
                        o.name,
                        o.deletion_scheduled_at,
                        o.deletion_requested_by,
                        o.deletion_reason
                    FROM organizations o
                    WHERE o.deletion_scheduled_at < NOW()
                    AND o.deleted_at IS NULL
                    ORDER BY o.deletion_scheduled_at ASC
                """)
            ).fetchall()

            logger.info(f"[AccountDeletion] Found {len(pending)} organizations to delete")

            for org in pending:
                org_id = str(org.id)
                try:
                    await _hard_delete_organization(db, org_id, org.name, org.deletion_reason)
                    deleted_orgs.append(org_id)
                    processed_count += 1
                    logger.info(f"[AccountDeletion] Successfully deleted: org={org_id} name={org.name}")
                except Exception as e:
                    error_count += 1
                    errors.append({"org_id": org_id, "error": str(e)})
                    logger.error(
                        f"[AccountDeletion] Failed to delete org={org_id}: {e}",
                        exc_info=True
                    )

            db.commit()

    except Exception as e:
        logger.error(f"[AccountDeletion] Database error: {e}", exc_info=True)
        error_count += 1
        errors.append({"error": str(e)})

    result = {
        "processed_count": processed_count,
        "error_count": error_count,
        "deleted_organizations": deleted_orgs,
        "errors": errors,
        "timestamp": datetime.utcnow().isoformat(),
    }

    logger.info(f"[AccountDeletion] Completed: {result}")
    return result


async def _hard_delete_organization(
    db: Session,
    org_id: str,
    org_name: str,
    deletion_reason: Optional[str]
) -> None:
    """
    Permanently delete all data for an organization.

    Steps:
    1. Cancel active subscription (TODO: Stripe integration)
    2. Delete BOMs and line items
    3. Delete projects
    4. Delete files from MinIO (TODO)
    5. Anonymize user records
    6. Mark organization as deleted
    7. Log completion in audit

    Args:
        db: Database session
        org_id: Organization ID to delete
        org_name: Organization name (for logging)
        deletion_reason: Reason code for deletion
    """
    logger.info(f"[AccountDeletion] Hard deleting org={org_id} name={org_name}")

    # Step 1: Cancel subscription (if active)
    try:
        db.execute(
            text("""
                UPDATE subscriptions SET
                    status = 'canceled',
                    canceled_at = NOW(),
                    cancel_at_period_end = FALSE,
                    updated_at = NOW()
                WHERE organization_id = :org_id::UUID
                AND status IN ('active', 'trialing')
            """),
            {"org_id": org_id}
        )
        logger.debug(f"[AccountDeletion] Cancelled subscription for org={org_id}")
    except Exception as e:
        logger.warning(f"[AccountDeletion] Subscription cancel failed: {e}")

    # Log subscription cancellation in audit
    db.execute(
        text("""
            INSERT INTO account_deletion_audit (
                organization_id, event_type, event_data
            ) VALUES (
                :org_id::UUID,
                'subscription_cancelled',
                :event_data::JSONB
            )
        """),
        {
            "org_id": org_id,
            "event_data": json.dumps({
                "reason": "account_deletion",
                "timestamp": datetime.utcnow().isoformat()
            }, cls=DecimalEncoder),
        }
    )

    # Step 2: Delete BOM line items first (foreign key constraint)
    deleted_line_items = db.execute(
        text("""
            DELETE FROM bom_line_items
            WHERE bom_id IN (
                SELECT id FROM boms WHERE organization_id = :org_id::UUID
            )
            RETURNING id
        """),
        {"org_id": org_id}
    ).rowcount
    logger.debug(f"[AccountDeletion] Deleted {deleted_line_items} BOM line items")

    # Step 3: Delete BOMs
    deleted_boms = db.execute(
        text("""
            DELETE FROM boms
            WHERE organization_id = :org_id::UUID
            RETURNING id
        """),
        {"org_id": org_id}
    ).rowcount
    logger.debug(f"[AccountDeletion] Deleted {deleted_boms} BOMs")

    # Step 4: Delete projects
    deleted_projects = db.execute(
        text("""
            DELETE FROM projects
            WHERE organization_id = :org_id::UUID
            RETURNING id
        """),
        {"org_id": org_id}
    ).rowcount
    logger.debug(f"[AccountDeletion] Deleted {deleted_projects} projects")

    # Step 5: Delete alert preferences
    try:
        db.execute(
            text("""
                DELETE FROM alert_preferences
                WHERE user_id IN (
                    SELECT id FROM users WHERE organization_id = :org_id::UUID
                )
            """),
            {"org_id": org_id}
        )
    except Exception as e:
        logger.debug(f"[AccountDeletion] Alert preferences delete skipped: {e}")

    # Step 6: Delete component watches
    try:
        db.execute(
            text("""
                DELETE FROM component_watches
                WHERE user_id IN (
                    SELECT id FROM users WHERE organization_id = :org_id::UUID
                )
            """),
            {"org_id": org_id}
        )
    except Exception as e:
        logger.debug(f"[AccountDeletion] Component watches delete skipped: {e}")

    # Step 7: Delete memberships
    db.execute(
        text("""
            DELETE FROM organization_memberships
            WHERE organization_id = :org_id::UUID
        """),
        {"org_id": org_id}
    )
    logger.debug(f"[AccountDeletion] Deleted memberships for org={org_id}")

    # Step 8: Anonymize users (keep for audit, remove PII)
    db.execute(
        text("""
            UPDATE users SET
                email = 'deleted_' || id::TEXT || '@deleted.local',
                full_name = 'Deleted User',
                is_active = FALSE,
                deleted_at = NOW(),
                deletion_reason = :deletion_reason,
                novu_subscriber_id = NULL,
                novu_synced_at = NULL,
                novu_sync_status = 'deleted',
                updated_at = NOW()
            WHERE organization_id = :org_id::UUID
        """),
        {"org_id": org_id, "deletion_reason": deletion_reason}
    )
    logger.debug(f"[AccountDeletion] Anonymized users for org={org_id}")

    # Step 9: Mark organization as deleted
    db.execute(
        text("""
            UPDATE organizations SET
                deleted_at = NOW(),
                name = 'Deleted Organization (' || id::TEXT || ')',
                is_suspended = TRUE,
                suspended_reason = 'Account permanently deleted',
                updated_at = NOW()
            WHERE id = :org_id::UUID
        """),
        {"org_id": org_id}
    )

    # Step 10: Log completion in audit
    db.execute(
        text("""
            INSERT INTO account_deletion_audit (
                organization_id, event_type, event_data
            ) VALUES (
                :org_id::UUID,
                'deletion_completed',
                :event_data::JSONB
            )
        """),
        {
            "org_id": org_id,
            "event_data": json.dumps({
                "deleted_boms": deleted_boms,
                "deleted_line_items": deleted_line_items,
                "deleted_projects": deleted_projects,
                "reason": deletion_reason or "user_requested",
                "completed_at": datetime.utcnow().isoformat()
            }, cls=DecimalEncoder),
        }
    )

    logger.info(
        f"[AccountDeletion] Hard delete complete: org={org_id} "
        f"boms={deleted_boms} line_items={deleted_line_items} projects={deleted_projects}"
    )

    # Step 11: Send final notification to owner (if email was captured before anonymization)
    try:
        novu = get_novu_client()
        if novu:
            await novu.trigger(
                workflow_id="account-deletion-completed",
                subscriber_id=org_id,  # Use org_id as fallback since user is anonymized
                payload={
                    "organization_name": org_name,
                    "deletion_reason": deletion_reason or "user_requested",
                    "deleted_items": {
                        "boms": deleted_boms,
                        "line_items": deleted_line_items,
                        "projects": deleted_projects,
                    },
                    "completed_at": datetime.utcnow().isoformat(),
                    "message": f"Your account '{org_name}' has been permanently deleted.",
                }
            )
            logger.debug(f"[AccountDeletion] Sent deletion completed notification for org={org_id}")
    except Exception as e:
        logger.warning(f"[AccountDeletion] Failed to send completion notification: {e}")


async def send_deletion_warnings() -> Dict[str, Any]:
    """
    Send warning notifications for accounts approaching deletion.

    Sends warnings at 7 days, 3 days, and 1 day before deletion.

    Returns:
        dict with count of warnings sent
    """
    warnings_sent = 0
    novu = get_novu_client()

    if not novu:
        logger.warning("[AccountDeletion] Novu client not available, skipping warnings")
        return {"warnings_sent": 0, "error": "Novu not configured"}

    try:
        with get_db_session() as db:
            for days in WARNING_DAYS:
                # Validate days to prevent any issues
                days = max(1, min(int(days), 30))

                # Find orgs that will be deleted in exactly X days
                orgs = db.execute(
                    text("""
                        SELECT
                            o.id,
                            o.name,
                            o.deletion_scheduled_at,
                            u.id as owner_id,
                            u.email as owner_email,
                            u.full_name as owner_name
                        FROM organizations o
                        JOIN users u ON u.organization_id = o.id
                        JOIN organization_memberships om ON om.user_id = u.id AND om.role = 'owner'
                        WHERE o.deleted_at IS NULL
                        AND o.deletion_scheduled_at IS NOT NULL
                        AND DATE(o.deletion_scheduled_at) = DATE(NOW() + INTERVAL '1 day' * :days)
                    """),
                    {"days": days}
                ).fetchall()

                for org in orgs:
                    try:
                        await novu.trigger(
                            workflow_id="account-deletion-warning",
                            subscriber_id=str(org.owner_id),
                            payload={
                                "user_name": org.owner_name or org.owner_email,
                                "organization_name": org.name,
                                "days_remaining": days,
                                "deletion_date": org.deletion_scheduled_at.isoformat() if org.deletion_scheduled_at else None,
                                "cancel_url": "/settings/account",
                                "message": f"Your account will be permanently deleted in {days} day{'s' if days > 1 else ''}.",
                            }
                        )
                        warnings_sent += 1
                        logger.info(
                            f"[AccountDeletion] Sent {days}-day warning: "
                            f"org={org.id} user={org.owner_id}"
                        )
                    except Exception as e:
                        logger.error(f"[AccountDeletion] Warning notification failed: {e}")

    except Exception as e:
        logger.error(f"[AccountDeletion] Warning batch error: {e}", exc_info=True)

    return {
        "warnings_sent": warnings_sent,
        "warning_days": WARNING_DAYS,
        "timestamp": datetime.utcnow().isoformat(),
    }


async def get_deletion_stats() -> Dict[str, Any]:
    """
    Get statistics about pending and completed deletions.

    Returns:
        dict with deletion statistics
    """
    try:
        with get_db_session() as db:
            # Count pending deletions
            pending = db.execute(
                text("""
                    SELECT COUNT(*) as count
                    FROM organizations
                    WHERE deletion_scheduled_at IS NOT NULL
                    AND deleted_at IS NULL
                """)
            ).fetchone()

            # Count completed deletions (last 30 days)
            completed = db.execute(
                text("""
                    SELECT COUNT(*) as count
                    FROM organizations
                    WHERE deleted_at IS NOT NULL
                    AND deleted_at > NOW() - INTERVAL '30 days'
                """)
            ).fetchone()

            # Count cancelled deletions (last 30 days)
            cancelled = db.execute(
                text("""
                    SELECT COUNT(*) as count
                    FROM account_deletion_audit
                    WHERE event_type = 'deletion_cancelled'
                    AND created_at > NOW() - INTERVAL '30 days'
                """)
            ).fetchone()

            return {
                "pending_deletions": pending.count if pending else 0,
                "completed_last_30_days": completed.count if completed else 0,
                "cancelled_last_30_days": cancelled.count if cancelled else 0,
                "timestamp": datetime.utcnow().isoformat(),
            }

    except Exception as e:
        logger.error(f"[AccountDeletion] Stats query failed: {e}")
        return {"error": str(e)}


# =============================================================================
# CLI Entry Point (for cron jobs)
# =============================================================================

if __name__ == "__main__":
    import asyncio

    async def main():
        print("=" * 60)
        print("Account Deletion Worker")
        print("=" * 60)

        # Get stats
        print("\n📊 Deletion Statistics:")
        stats = await get_deletion_stats()
        print(f"  - Pending deletions: {stats.get('pending_deletions', 0)}")
        print(f"  - Completed (30 days): {stats.get('completed_last_30_days', 0)}")
        print(f"  - Cancelled (30 days): {stats.get('cancelled_last_30_days', 0)}")

        # Send warnings
        print("\n📧 Sending Deletion Warnings...")
        warnings = await send_deletion_warnings()
        print(f"  - Warnings sent: {warnings.get('warnings_sent', 0)}")

        # Process deletions
        print("\n🗑️  Processing Pending Deletions...")
        result = await process_pending_deletions()
        print(f"  - Processed: {result.get('processed_count', 0)}")
        print(f"  - Errors: {result.get('error_count', 0)}")

        if result.get('deleted_organizations'):
            print(f"  - Deleted orgs: {result['deleted_organizations']}")

        if result.get('errors'):
            print(f"  - Error details: {result['errors']}")

        print("\n✅ Account deletion worker completed")

    asyncio.run(main())
