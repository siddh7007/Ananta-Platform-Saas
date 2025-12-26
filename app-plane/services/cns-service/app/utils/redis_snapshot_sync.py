"""
Redis → PostgreSQL Snapshot Sync for Directus

Syncs Redis component cache to PostgreSQL snapshot table so Directus can display:
- Components in Redis (temporary, low quality)
- Components in Database (permanent, high quality)
- Unified view for comparison

Run via:
- Cron job (every 5 minutes)
- Temporal scheduled workflow
- API endpoint trigger
"""

import json
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.cache.redis_cache import RedisCache
from app.config import settings

logger = logging.getLogger(__name__)


class RedisSnapshotSync:
    """Sync Redis components to PostgreSQL for Directus visibility"""

    def __init__(self, db_session: Session, worker_id: Optional[str] = None):
        """
        Initialize sync manager

        Args:
            db_session: SQLAlchemy session (Components V2 DB)
            worker_id: Unique worker ID for lock acquisition (auto-generated if not provided)
        """
        self.db = db_session
        redis_url = settings.redis_url
        default_ttl = settings.redis_cache_ttl or settings.cache_ttl_seconds
        self.redis_cache = RedisCache(redis_url=redis_url, default_ttl=default_ttl)
        self.redis_cache.connect()
        self.redis_client = self.redis_cache.get_client()
        if not self.redis_client:
            raise RuntimeError(f"Unable to connect to Redis at {redis_url}")
        self.worker_id = worker_id or f"worker_{uuid.uuid4().hex[:8]}"

    def sync_all_components(self) -> Dict[str, int]:
        """
        Sync all Redis components to PostgreSQL snapshot table

        Uses advisory lock to prevent concurrent syncs (race condition protection).

        Returns:
            Dict with sync statistics:
            {
                'synced': 45,
                'expired': 12,
                'errors': 2,
                'total_redis_keys': 47,
                'lock_acquired': true
            }
        """
        stats = {
            'synced': 0,
            'expired': 0,
            'errors': 0,
            'total_redis_keys': 0,
            'lock_acquired': False,
        }

        # Try to acquire lock
        lock_acquired = self._acquire_sync_lock()
        stats['lock_acquired'] = lock_acquired

        if not lock_acquired:
            logger.warning(f"Redis sync already in progress by another worker. Skipping.")
            return stats

        try:
            # Scan all component keys in Redis (non-blocking)
            redis_keys = list(self.redis_client.scan_iter("component:*:data", count=100))
            stats['total_redis_keys'] = len(redis_keys)

            logger.info(f"[{self.worker_id}] Found {len(redis_keys)} components in Redis, syncing to PostgreSQL...")

            for key in redis_keys:
                try:
                    success = self._sync_single_component(key)
                    if success:
                        stats['synced'] += 1
                    else:
                        stats['errors'] += 1
                except Exception as e:
                    logger.error(f"Error syncing key {key}: {e}", exc_info=True)
                    stats['errors'] += 1

            # Mark expired entries
            expired_count = self._mark_expired_components()
            stats['expired'] = expired_count

            # Cleanup old expired entries (older than 7 days)
            self._cleanup_old_expired()

            self.db.commit()

            logger.info(f"[{self.worker_id}] Redis sync completed: {stats}")
            return stats

        except Exception as e:
            logger.error(f"[{self.worker_id}] Redis sync failed: {e}", exc_info=True)
            self.db.rollback()
            raise

        finally:
            # Always release lock
            self._release_sync_lock()

    def _sync_single_component(self, redis_key: str) -> bool:
        """
        Sync a single component from Redis to PostgreSQL

        Args:
            redis_key: Redis key (e.g., "component:line_123:data")

        Returns:
            True if synced successfully
        """
        try:
            # Get component data from Redis
            component_data = self.redis_cache.get(redis_key)
            if not component_data:
                logger.warning(f"No data found for key: {redis_key}")
                return False

            # Get TTL (time to live)
            ttl_seconds = self.redis_client.ttl(redis_key)
            if ttl_seconds == -1:
                # No expiration set (shouldn't happen for component cache)
                ttl_seconds = 259200  # Default 72 hours

            # Extract line_id from key
            # Format: "component:line_123:data" or "component:line_123"
            key_parts = redis_key.split(":")
            line_id = key_parts[1] if len(key_parts) >= 2 else "unknown"

            # Calculate expiration time
            expires_at = datetime.now() + timedelta(seconds=ttl_seconds)

            # Determine reason for Redis storage
            quality_score = component_data.get('quality_score', 0)
            if quality_score < 80:
                reason = f"Quality score {quality_score} below threshold (80)"
            else:
                reason = "Staff bulk upload (temporary cache)"

            # Insert or update snapshot
            query = text("""
                INSERT INTO redis_component_snapshot (
                    redis_key,
                    line_id,
                    mpn,
                    manufacturer,
                    quality_score,
                    component_data,
                    storage_ttl_seconds,
                    expires_at,
                    reason_for_redis,
                    can_promote,
                    last_synced_at,
                    sync_status
                ) VALUES (
                    :redis_key,
                    :line_id,
                    :mpn,
                    :manufacturer,
                    :quality_score,
                    :component_data::jsonb,
                    :ttl,
                    :expires_at,
                    :reason,
                    :can_promote,
                    NOW(),
                    'active'
                )
                ON CONFLICT (redis_key) DO UPDATE SET
                    mpn = EXCLUDED.mpn,
                    manufacturer = EXCLUDED.manufacturer,
                    quality_score = EXCLUDED.quality_score,
                    component_data = EXCLUDED.component_data,
                    storage_ttl_seconds = EXCLUDED.storage_ttl_seconds,
                    expires_at = EXCLUDED.expires_at,
                    reason_for_redis = EXCLUDED.reason_for_redis,
                    last_synced_at = NOW(),
                    sync_status = CASE
                        WHEN redis_component_snapshot.sync_status = 'promoted' THEN 'promoted'
                        ELSE 'active'
                    END
            """)

            self.db.execute(query, {
                'redis_key': redis_key,
                'line_id': line_id,
                'mpn': component_data.get('mpn') or component_data.get('manufacturer_part_number'),
                'manufacturer': component_data.get('manufacturer'),
                'quality_score': quality_score,
                'component_data': json.dumps(component_data),
                'ttl': ttl_seconds,
                'expires_at': expires_at,
                'reason': reason,
                'can_promote': (quality_score >= 70),  # Allow promotion if quality >= 70
            })

            return True

        except Exception as e:
            logger.error(f"Failed to sync component {redis_key}: {e}", exc_info=True)
            return False

    def _mark_expired_components(self) -> int:
        """
        Mark components as expired if their TTL has passed

        Returns:
            Number of components marked as expired
        """
        try:
            query = text("""
                UPDATE redis_component_snapshot
                SET sync_status = 'expired',
                    last_synced_at = NOW()
                WHERE expires_at < NOW()
                  AND sync_status = 'active'
                RETURNING id
            """)

            result = self.db.execute(query)
            expired_count = result.rowcount

            if expired_count > 0:
                logger.info(f"Marked {expired_count} components as expired")

            return expired_count

        except Exception as e:
            logger.error(f"Failed to mark expired components: {e}", exc_info=True)
            return 0

    def _cleanup_old_expired(self) -> int:
        """
        Delete expired snapshots older than 7 days

        Returns:
            Number of snapshots deleted
        """
        try:
            query = text("SELECT cleanup_expired_redis_snapshots()")
            result = self.db.execute(query)
            deleted_count = result.scalar()

            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} old expired snapshots")

            return deleted_count

        except Exception as e:
            logger.error(f"Failed to cleanup old expired snapshots: {e}", exc_info=True)
            return 0

    def get_sync_stats(self) -> Dict[str, Any]:
        """
        Get current sync statistics

        Returns:
            Dict with sync stats
        """
        try:
            query = text("""
                SELECT
                    COUNT(*) as total_snapshots,
                    COUNT(*) FILTER (WHERE sync_status = 'active') as active,
                    COUNT(*) FILTER (WHERE sync_status = 'expired') as expired,
                    COUNT(*) FILTER (WHERE sync_status = 'promoted') as promoted,
                    COUNT(*) FILTER (WHERE expires_at < NOW() + INTERVAL '24 hours' AND sync_status = 'active') as expiring_soon,
                    AVG(quality_score) as avg_quality_score,
                    MAX(last_synced_at) as last_sync_time
                FROM redis_component_snapshot
            """)

            result = self.db.execute(query).fetchone()

            return {
                'total_snapshots': result.total_snapshots,
                'active': result.active,
                'expired': result.expired,
                'promoted': result.promoted,
                'expiring_soon': result.expiring_soon,
                'avg_quality_score': float(result.avg_quality_score) if result.avg_quality_score else 0,
                'last_sync_time': result.last_sync_time.isoformat() if result.last_sync_time else None,
            }

        except Exception as e:
            logger.error(f"Failed to get sync stats: {e}", exc_info=True)
            return {}

    def _acquire_sync_lock(self, lock_duration_seconds: int = 300) -> bool:
        """
        Acquire advisory lock for Redis sync to prevent race conditions

        Args:
            lock_duration_seconds: Lock duration in seconds (default 5 minutes)

        Returns:
            True if lock acquired, False if already locked
        """
        try:
            query = text("SELECT acquire_redis_sync_lock(:worker_id, :duration)")
            result = self.db.execute(query, {
                'worker_id': self.worker_id,
                'duration': lock_duration_seconds
            })
            lock_acquired = result.scalar()

            if lock_acquired:
                logger.info(f"[{self.worker_id}] Acquired Redis sync lock")
            else:
                logger.warning(f"[{self.worker_id}] Failed to acquire Redis sync lock (already locked)")

            return lock_acquired

        except Exception as e:
            # If lock table doesn't exist yet (migration not applied), allow sync
            if "relation \"redis_sync_lock\" does not exist" in str(e):
                logger.warning(f"Lock table not found, allowing sync without locking")
                return True

            logger.error(f"[{self.worker_id}] Error acquiring sync lock: {e}", exc_info=True)
            return False

    def _release_sync_lock(self) -> bool:
        """
        Release advisory lock for Redis sync

        Returns:
            True if lock released, False otherwise
        """
        try:
            query = text("SELECT release_redis_sync_lock(:worker_id)")
            result = self.db.execute(query, {'worker_id': self.worker_id})
            lock_released = result.scalar()

            if lock_released:
                logger.info(f"[{self.worker_id}] Released Redis sync lock")
            else:
                logger.warning(f"[{self.worker_id}] Failed to release Redis sync lock (not owner or already released)")

            return lock_released

        except Exception as e:
            # If lock table doesn't exist, silently continue
            if "relation \"redis_sync_lock\" does not exist" in str(e):
                return True

            logger.error(f"[{self.worker_id}] Error releasing sync lock: {e}", exc_info=True)
            return False

    def promote_component_to_vault(
        self,
        snapshot_id: str,
        override_quality: bool = False,
        admin_notes: Optional[str] = None
    ) -> bool:
        """
        Promote a Redis component to permanent vault storage

        Args:
            snapshot_id: UUID of redis_component_snapshot record
            override_quality: Force promotion even if quality < 80
            admin_notes: Admin notes about promotion decision

        Returns:
            True if promoted successfully
        """
        try:
            query = text("""
                SELECT promote_redis_component_to_vault(
                    :snapshot_id::uuid,
                    :override_quality,
                    :admin_notes
                )
            """)

            result = self.db.execute(query, {
                'snapshot_id': snapshot_id,
                'override_quality': override_quality,
                'admin_notes': admin_notes,
            })

            success = result.scalar()
            self.db.commit()

            if success:
                logger.info(f"Promoted component {snapshot_id} to vault (override={override_quality})")
            else:
                logger.warning(f"Failed to promote component {snapshot_id}")

            return success

        except Exception as e:
            logger.error(f"Failed to promote component {snapshot_id}: {e}", exc_info=True)
            self.db.rollback()
            return False


# ============================================================================
# API ENDPOINT INTEGRATION
# ============================================================================

def sync_redis_to_directus_endpoint(db: Session) -> Dict[str, Any]:
    """
    FastAPI endpoint to trigger Redis → PostgreSQL sync

    Usage:
        @router.post("/api/admin/sync-redis")
        def sync_redis(db: Session = Depends(get_db)):
            return sync_redis_to_directus_endpoint(db)
    """
    sync = RedisSnapshotSync(db)
    stats = sync.sync_all_components()

    return {
        'success': True,
        'stats': stats,
        'timestamp': datetime.now().isoformat(),
    }


def get_redis_sync_stats_endpoint(db: Session) -> Dict[str, Any]:
    """
    FastAPI endpoint to get current sync stats

    Usage:
        @router.get("/api/admin/redis-sync-stats")
        def get_sync_stats(db: Session = Depends(get_db)):
            return get_redis_sync_stats_endpoint(db)
    """
    sync = RedisSnapshotSync(db)
    stats = sync.get_sync_stats()

    return {
        'success': True,
        'stats': stats,
        'timestamp': datetime.now().isoformat(),
    }
