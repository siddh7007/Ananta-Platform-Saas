"""
Subscriber Sync Service

Syncs Supabase users to Novu subscribers.
Runs on user creation/update or as batch job.
"""

import logging
from typing import Dict, Optional, List
from datetime import datetime, timezone

from shared.notification.config import NotificationConfig
from shared.notification.providers import get_notification_provider

logger = logging.getLogger(__name__)


class SubscriberSyncService:
    """
    Syncs users between Supabase and Novu.

    This service ensures that users in Supabase have corresponding
    subscribers in Novu for receiving notifications.

    Usage:
        sync_service = SubscriberSyncService(config, supabase_client)
        await sync_service.sync_user("user-uuid")
        await sync_service.sync_all_pending(limit=100)
    """

    def __init__(self, config: NotificationConfig, supabase_client):
        """
        Initialize the sync service.

        Args:
            config: NotificationConfig instance
            supabase_client: Supabase client for database access
        """
        self.config = config
        self.supabase = supabase_client
        self.provider = get_notification_provider(config)

    async def sync_user(self, user_id: str) -> bool:
        """
        Sync a single user to Novu.

        Args:
            user_id: UUID of the user to sync

        Returns:
            True if sync was successful
        """
        try:
            # Fetch user from Supabase
            result = self.supabase.table("users").select(
                "id, email, first_name, last_name, organization_id"
            ).eq("id", user_id).single().execute()

            if not result.data:
                logger.warning(f"User {user_id} not found in database")
                return False

            user = result.data

            # Create/update subscriber in Novu
            success = await self.provider.create_subscriber(
                subscriber_id=str(user["id"]),
                email=user.get("email"),
                first_name=user.get("first_name"),
                last_name=user.get("last_name"),
                data={
                    "organization_id": str(user.get("organization_id")) if user.get("organization_id") else None,
                }
            )

            if success:
                # Update sync status in database
                self.supabase.table("users").update({
                    "novu_subscriber_id": str(user["id"]),
                    "novu_synced_at": datetime.now(timezone.utc).isoformat(),
                    "novu_sync_status": "synced",
                }).eq("id", user_id).execute()

                logger.info(f"Synced user {user_id} to Novu")
                return True
            else:
                # Mark as failed
                self.supabase.table("users").update({
                    "novu_sync_status": "failed",
                }).eq("id", user_id).execute()
                logger.warning(f"Failed to sync user {user_id} to Novu")
                return False

        except Exception as e:
            logger.error(f"Error syncing user {user_id}: {e}")
            # Try to mark as failed
            try:
                self.supabase.table("users").update({
                    "novu_sync_status": "failed",
                }).eq("id", user_id).execute()
            except Exception:
                pass
            return False

    async def sync_all_pending(self, limit: int = 100) -> Dict[str, int]:
        """
        Sync all users with pending or failed status.

        Args:
            limit: Maximum number of users to sync in one batch

        Returns:
            Dict with sync statistics: {"synced": N, "failed": N}
        """
        try:
            # Fetch pending users
            result = self.supabase.table("users").select("id").in_(
                "novu_sync_status", ["pending", "failed"]
            ).limit(limit).execute()

            stats = {"synced": 0, "failed": 0}

            for user in result.data or []:
                if await self.sync_user(user["id"]):
                    stats["synced"] += 1
                else:
                    stats["failed"] += 1

            logger.info(f"Batch sync complete: {stats}")
            return stats

        except Exception as e:
            logger.error(f"Error in batch sync: {e}")
            return {"synced": 0, "failed": 0, "error": str(e)}

    async def delete_subscriber(self, user_id: str) -> bool:
        """
        Remove user from Novu (on account deletion).

        Args:
            user_id: UUID of the user to remove

        Returns:
            True if removal was successful
        """
        try:
            success = await self.provider.delete_subscriber(user_id)

            if success:
                # Reset sync status
                self.supabase.table("users").update({
                    "novu_subscriber_id": None,
                    "novu_synced_at": None,
                    "novu_sync_status": "pending",
                }).eq("id", user_id).execute()
                logger.info(f"Deleted Novu subscriber {user_id}")

            return success

        except Exception as e:
            logger.error(f"Error deleting subscriber {user_id}: {e}")
            return False

    async def get_sync_stats(self) -> Dict[str, int]:
        """
        Get statistics on subscriber sync status.

        Returns:
            Dict with counts by status
        """
        try:
            # Count by status
            pending = self.supabase.table("users").select(
                "id", count="exact"
            ).eq("novu_sync_status", "pending").execute()

            synced = self.supabase.table("users").select(
                "id", count="exact"
            ).eq("novu_sync_status", "synced").execute()

            failed = self.supabase.table("users").select(
                "id", count="exact"
            ).eq("novu_sync_status", "failed").execute()

            return {
                "pending": pending.count or 0,
                "synced": synced.count or 0,
                "failed": failed.count or 0,
            }

        except Exception as e:
            logger.error(f"Error getting sync stats: {e}")
            return {"error": str(e)}


async def sync_user_on_create(
    config: NotificationConfig,
    supabase_client,
    user_id: str,
) -> bool:
    """
    Convenience function to sync a user immediately after creation.

    Can be called from user registration flow.

    Args:
        config: NotificationConfig
        supabase_client: Supabase client
        user_id: UUID of newly created user

    Returns:
        True if sync was successful
    """
    sync_service = SubscriberSyncService(config, supabase_client)
    return await sync_service.sync_user(user_id)
