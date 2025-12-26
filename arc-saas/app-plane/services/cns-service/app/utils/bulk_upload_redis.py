"""
Bulk Upload Redis Storage

Stores CNS staff bulk upload data in Redis (temporary processing storage).
Keeps Supabase clean for customer BOMs only.

Data Structure:
    bulk_upload:{upload_id}:metadata      - Upload metadata (JSON)
    bulk_upload:{upload_id}:line_items    - List of line items (Redis List)
    bulk_upload:{upload_id}:status        - Current status string
    bulk_upload:{upload_id}:progress      - Processing progress (JSON)

All keys have TTL (24 hours default) and auto-expire after processing.
"""

import json
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from redis import Redis
from redis.exceptions import RedisError

from app.cache.redis_cache import get_cache, DecimalEncoder  # Reuse shared encoder

logger = logging.getLogger(__name__)

# TTL Configuration
DEFAULT_TTL_HOURS = 24  # Bulk uploads expire after 24 hours
PROCESSING_TTL_HOURS = 48  # Extend TTL during processing


class BulkUploadRedisStorage:
    """
    Redis storage for CNS bulk uploads

    Usage:
        storage = BulkUploadRedisStorage(upload_id="uuid-123")
        storage.save_metadata(metadata)
        storage.add_line_item(line_item_data)
        storage.set_status("processing")
    """

    def __init__(self, upload_id: str):
        """
        Initialize bulk upload storage

        Args:
            upload_id: Unique upload ID (UUID)
        """
        self.upload_id = upload_id
        self.cache = get_cache()

        if not self.cache or not self.cache.is_connected:
            raise RuntimeError("Redis cache not initialized or connected")

        self.redis_client: Redis = self.cache.get_client()

    # ============================================================================
    # KEY BUILDERS
    # ============================================================================

    def _key_metadata(self) -> str:
        """Redis key for upload metadata"""
        return f"bulk_upload:{self.upload_id}:metadata"

    def _key_line_items(self) -> str:
        """Redis key for line items list"""
        return f"bulk_upload:{self.upload_id}:line_items"

    def _key_status(self) -> str:
        """Redis key for status string"""
        return f"bulk_upload:{self.upload_id}:status"

    def _key_progress(self) -> str:
        """Redis key for progress tracking"""
        return f"bulk_upload:{self.upload_id}:progress"

    def _key_enrichment_config(self) -> str:
        """Redis key for enrichment configuration"""
        return f"bulk_upload:{self.upload_id}:enrichment_config"

    # ============================================================================
    # METADATA OPERATIONS
    # ============================================================================

    def save_metadata(self, metadata: Dict[str, Any], ttl_hours: int = DEFAULT_TTL_HOURS) -> bool:
        """
        Save upload metadata to Redis

        Args:
            metadata: Upload metadata (dict with filename, tenant_id, s3_key, etc.)
            ttl_hours: Time-to-live in hours

        Returns:
            True if saved successfully
        """
        try:
            key = self._key_metadata()
            ttl_seconds = ttl_hours * 3600

            # Add timestamp if not present
            if 'created_at' not in metadata:
                metadata['created_at'] = datetime.utcnow().isoformat()

            self.redis_client.setex(
                key,
                ttl_seconds,
                json.dumps(metadata, cls=DecimalEncoder)
            )

            logger.info(f"[Bulk Upload Redis] Metadata saved: {self.upload_id} (TTL: {ttl_hours}h)")
            return True

        except (RedisError, TypeError) as e:
            logger.error(f"[Bulk Upload Redis] Failed to save metadata: {e}")
            return False

    def get_metadata(self) -> Optional[Dict[str, Any]]:
        """
        Get upload metadata from Redis

        Returns:
            Metadata dict or None if not found
        """
        try:
            key = self._key_metadata()
            value = self.redis_client.get(key)

            if not value:
                return None

            return json.loads(value)

        except (RedisError, json.JSONDecodeError) as e:
            logger.error(f"[Bulk Upload Redis] Failed to get metadata: {e}")
            return None

    # ============================================================================
    # LINE ITEMS OPERATIONS
    # ============================================================================

    def add_line_item(self, line_item: Dict[str, Any], ttl_hours: int = DEFAULT_TTL_HOURS) -> bool:
        """
        Add single line item to Redis list

        Args:
            line_item: Line item data (dict)
            ttl_hours: Time-to-live in hours

        Returns:
            True if added successfully
        """
        try:
            key = self._key_line_items()
            ttl_seconds = ttl_hours * 3600

            # Push to Redis list
            self.redis_client.rpush(key, json.dumps(line_item, cls=DecimalEncoder))

            # Set/refresh TTL
            self.redis_client.expire(key, ttl_seconds)

            return True

        except (RedisError, TypeError) as e:
            logger.error(f"[Bulk Upload Redis] Failed to add line item: {e}")
            return False

    def add_line_items_bulk(self, line_items: List[Dict[str, Any]], ttl_hours: int = DEFAULT_TTL_HOURS) -> bool:
        """
        Add multiple line items in bulk (more efficient)

        Args:
            line_items: List of line item dicts
            ttl_hours: Time-to-live in hours

        Returns:
            True if all added successfully
        """
        try:
            if not line_items:
                return True

            key = self._key_line_items()
            ttl_seconds = ttl_hours * 3600

            # Use pipeline for bulk insert
            pipe = self.redis_client.pipeline()

            for item in line_items:
                pipe.rpush(key, json.dumps(item, cls=DecimalEncoder))

            # Set TTL
            pipe.expire(key, ttl_seconds)

            pipe.execute()

            logger.info(f"[Bulk Upload Redis] {len(line_items)} line items saved in bulk")
            return True

        except (RedisError, TypeError) as e:
            logger.error(f"[Bulk Upload Redis] Failed to add line items bulk: {e}")
            return False

    def get_line_items(self, start: int = 0, end: int = -1) -> List[Dict[str, Any]]:
        """
        Get line items from Redis list

        Args:
            start: Start index (default 0 = first item)
            end: End index (default -1 = last item)

        Returns:
            List of line item dicts
        """
        try:
            key = self._key_line_items()
            items = self.redis_client.lrange(key, start, end)

            return [json.loads(item) for item in items]

        except (RedisError, json.JSONDecodeError) as e:
            logger.error(f"[Bulk Upload Redis] Failed to get line items: {e}")
            return []

    def get_line_items_count(self) -> int:
        """
        Get count of line items

        Returns:
            Number of line items
        """
        try:
            key = self._key_line_items()
            return self.redis_client.llen(key)

        except RedisError as e:
            logger.error(f"[Bulk Upload Redis] Failed to get line items count: {e}")
            return 0

    def update_line_item(
        self,
        line_item_id: str,
        updates: Dict[str, Any],
        ttl_hours: int = PROCESSING_TTL_HOURS
    ) -> bool:
        """
        Update specific line item in Redis list

        Args:
            line_item_id: Line item ID to update
            updates: Dict of fields to update (e.g., enrichment_status, component_id)
            ttl_hours: TTL to extend

        Returns:
            True if updated successfully

        Note: Redis lists don't support in-place updates by ID.
        This method:
        1. Fetches all line items
        2. Finds and updates the matching item
        3. Replaces the entire list
        4. Extends TTL
        """
        try:
            # Get all line items
            line_items = self.get_line_items()

            if not line_items:
                logger.warning(f"[Bulk Upload Redis] No line items found for upload: {self.upload_id}")
                return False

            # Find and update matching item
            updated = False
            for item in line_items:
                if item.get('id') == line_item_id:
                    item.update(updates)
                    updated = True
                    logger.debug(f"[Bulk Upload Redis] Updated line item: {line_item_id}")
                    break

            if not updated:
                logger.warning(f"[Bulk Upload Redis] Line item not found: {line_item_id}")
                return False

            # Replace entire list
            key = self._key_line_items()
            ttl_seconds = ttl_hours * 3600

            # Use pipeline for atomic operation
            pipe = self.redis_client.pipeline()

            # Delete old list
            pipe.delete(key)

            # Add updated items
            for item in line_items:
                pipe.rpush(key, json.dumps(item, cls=DecimalEncoder))

            # Set TTL
            pipe.expire(key, ttl_seconds)

            pipe.execute()

            logger.info(f"[Bulk Upload Redis] Line item updated: {line_item_id}")
            return True

        except Exception as e:
            logger.error(f"[Bulk Upload Redis] Failed to update line item {line_item_id}: {e}")
            return False

    # ============================================================================
    # STATUS OPERATIONS
    # ============================================================================

    def set_status(self, status: str, ttl_hours: int = DEFAULT_TTL_HOURS) -> bool:
        """
        Set upload status

        Args:
            status: Status string (processing, enriching, completed, failed)
            ttl_hours: Time-to-live in hours

        Returns:
            True if set successfully
        """
        try:
            key = self._key_status()
            ttl_seconds = ttl_hours * 3600

            self.redis_client.setex(key, ttl_seconds, status)

            logger.info(f"[Bulk Upload Redis] Status updated: {self.upload_id} -> {status}")
            return True

        except RedisError as e:
            logger.error(f"[Bulk Upload Redis] Failed to set status: {e}")
            return False

    def get_status(self) -> Optional[str]:
        """
        Get upload status

        Returns:
            Status string or None if not found
        """
        try:
            key = self._key_status()
            value = self.redis_client.get(key)

            # Handle both bytes and str (redis-py can return either)
            if value:
                return value.decode() if isinstance(value, bytes) else value
            return None

        except RedisError as e:
            logger.error(f"[Bulk Upload Redis] Failed to get status: {e}")
            return None

    # ============================================================================
    # PROGRESS TRACKING
    # ============================================================================

    def update_progress(
        self,
        total_items: int,
        enriched_items: int = 0,
        failed_items: int = 0,
        ttl_hours: int = PROCESSING_TTL_HOURS
    ) -> bool:
        """
        Update enrichment progress

        Args:
            total_items: Total number of line items
            enriched_items: Number of successfully enriched items
            failed_items: Number of failed items
            ttl_hours: Time-to-live in hours (extended during processing)

        Returns:
            True if updated successfully
        """
        try:
            key = self._key_progress()
            ttl_seconds = ttl_hours * 3600

            # Clamp values to prevent negative numbers
            pending_items = max(0, total_items - enriched_items - failed_items)
            percent_complete = min(100.0, max(0.0,
                (enriched_items + failed_items) / total_items * 100 if total_items > 0 else 0
            ))

            progress = {
                'total_items': total_items,
                'enriched_items': enriched_items,
                'failed_items': failed_items,
                'pending_items': pending_items,
                'percent_complete': percent_complete,
                'last_updated': datetime.utcnow().isoformat()
            }

            self.redis_client.setex(
                key,
                ttl_seconds,
                json.dumps(progress, cls=DecimalEncoder)
            )

            # Align TTLs across all keys to prevent drift
            self.align_ttls()

            return True

        except (RedisError, TypeError) as e:
            logger.error(f"[Bulk Upload Redis] Failed to update progress: {e}")
            return False

    def get_progress(self) -> Optional[Dict[str, Any]]:
        """
        Get enrichment progress

        Returns:
            Progress dict with redis_expires_at field, or None if not found
        """
        try:
            key = self._key_progress()
            value = self.redis_client.get(key)

            if not value:
                return None

            progress = json.loads(value)

            # Add redis_expires_at timestamp
            expires_at = self.get_redis_expires_at()
            if expires_at:
                progress['redis_expires_at'] = expires_at

            return progress

        except (RedisError, json.JSONDecodeError) as e:
            logger.error(f"[Bulk Upload Redis] Failed to get progress: {e}")
            return None

    # ============================================================================
    # ENRICHMENT CONFIG OPERATIONS
    # ============================================================================

    def save_enrichment_config(self, config: Dict[str, Any], ttl_hours: int = DEFAULT_TTL_HOURS) -> bool:
        """
        Save enrichment configuration to Redis

        Args:
            config: Enrichment config (dict with suppliers, quality_threshold, etc.)
            ttl_hours: Time-to-live in hours

        Returns:
            True if saved successfully
        """
        try:
            key = self._key_enrichment_config()
            ttl_seconds = ttl_hours * 3600

            self.redis_client.setex(
                key,
                ttl_seconds,
                json.dumps(config, cls=DecimalEncoder)
            )

            logger.info(f"[Bulk Upload Redis] Enrichment config saved: {self.upload_id}")
            return True

        except (RedisError, TypeError) as e:
            logger.error(f"[Bulk Upload Redis] Failed to save enrichment config: {e}")
            return False

    def get_enrichment_config(self) -> Optional[Dict[str, Any]]:
        """
        Get enrichment configuration from Redis

        Returns:
            Config dict or None if not found
        """
        try:
            key = self._key_enrichment_config()
            value = self.redis_client.get(key)

            if not value:
                return None

            return json.loads(value)

        except (RedisError, json.JSONDecodeError) as e:
            logger.error(f"[Bulk Upload Redis] Failed to get enrichment config: {e}")
            return None

    # ============================================================================
    # CLEANUP OPERATIONS
    # ============================================================================

    def delete_all(self) -> bool:
        """
        Delete all Redis keys for this upload (cleanup after processing)

        Returns:
            True if deleted successfully
        """
        try:
            keys = [
                self._key_metadata(),
                self._key_line_items(),
                self._key_status(),
                self._key_progress(),
                self._key_enrichment_config()
            ]

            self.redis_client.delete(*keys)

            logger.info(f"[Bulk Upload Redis] All keys deleted for upload: {self.upload_id}")
            return True

        except RedisError as e:
            logger.error(f"[Bulk Upload Redis] Failed to delete keys: {e}")
            return False

    def extend_ttl(self, ttl_hours: int = PROCESSING_TTL_HOURS) -> bool:
        """
        Extend TTL for all keys (useful during long-running enrichment)

        Args:
            ttl_hours: New TTL in hours

        Returns:
            True if extended successfully
        """
        try:
            keys = [
                self._key_metadata(),
                self._key_line_items(),
                self._key_status(),
                self._key_progress(),
                self._key_enrichment_config()
            ]

            ttl_seconds = ttl_hours * 3600

            pipe = self.redis_client.pipeline()
            for key in keys:
                pipe.expire(key, ttl_seconds)
            pipe.execute()

            logger.info(f"[Bulk Upload Redis] TTL extended: {self.upload_id} -> {ttl_hours}h")
            return True

        except RedisError as e:
            logger.error(f"[Bulk Upload Redis] Failed to extend TTL: {e}")
            return False

    # ============================================================================
    # TTL MANAGEMENT
    # ============================================================================

    def get_ttl_seconds(self) -> Optional[int]:
        """
        Get remaining TTL of metadata key in seconds.

        Returns:
            TTL in seconds, or None if key doesn't exist or no TTL set
        """
        try:
            key = self._key_metadata()
            ttl = self.redis_client.ttl(key)

            # ttl() returns:
            # -2 if key doesn't exist
            # -1 if key exists but has no TTL
            # positive int for remaining seconds
            if ttl > 0:
                return ttl
            return None

        except RedisError as e:
            logger.error(f"[Bulk Upload Redis] Failed to get TTL: {e}")
            return None

    def get_redis_expires_at(self) -> Optional[str]:
        """
        Get expiration timestamp for this upload.

        Returns:
            ISO 8601 timestamp string, or None if no TTL
        """
        from datetime import datetime, timedelta, timezone

        ttl_seconds = self.get_ttl_seconds()
        if ttl_seconds is None:
            return None

        expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
        return expires_at.isoformat()

    def align_ttls(self) -> bool:
        """
        Align all related keys' TTLs to match metadata key TTL.

        This prevents TTL drift across keys. Uses metadata key as the reference.

        Returns:
            True if TTLs aligned successfully
        """
        try:
            # Get TTL from metadata key (reference key)
            metadata_ttl = self.get_ttl_seconds()
            if metadata_ttl is None or metadata_ttl <= 0:
                logger.warning(f"[Bulk Upload Redis] Cannot align TTLs - metadata key has no TTL")
                return False

            # Apply same TTL to all related keys
            keys_to_align = [
                self._key_line_items(),
                self._key_status(),
                self._key_progress(),
                self._key_enrichment_config()
            ]

            pipe = self.redis_client.pipeline()
            for key in keys_to_align:
                # Only set TTL if key exists
                if self.redis_client.exists(key):
                    pipe.expire(key, metadata_ttl)

            pipe.execute()

            logger.debug(f"[Bulk Upload Redis] Aligned TTLs to {metadata_ttl}s for {self.upload_id}")
            return True

        except RedisError as e:
            logger.error(f"[Bulk Upload Redis] Failed to align TTLs: {e}")
            return False

    def exists(self) -> bool:
        """
        Check if upload exists in Redis

        Returns:
            True if metadata key exists
        """
        try:
            key = self._key_metadata()
            return bool(self.redis_client.exists(key))

        except RedisError:
            return False


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_bulk_upload_storage(upload_id: str) -> Optional[BulkUploadRedisStorage]:
    """
    Get BulkUploadRedisStorage instance

    Args:
        upload_id: Upload ID

    Returns:
        BulkUploadRedisStorage instance or None if Redis not available
    """
    try:
        return BulkUploadRedisStorage(upload_id)
    except RuntimeError as e:
        logger.error(f"Failed to create BulkUploadRedisStorage: {e}")
        return None


def list_active_bulk_uploads() -> List[str]:
    """
    List all active bulk upload IDs in Redis

    Returns:
        List of upload IDs
    """
    cache = get_cache()
    if not cache or not cache.is_connected:
        return []

    try:
        redis_client = cache.get_client()

        # Use scan_iter instead of keys() to avoid blocking Redis
        upload_ids = []
        for key in redis_client.scan_iter(match="bulk_upload:*:metadata", count=100):
            # Decode bytes to string if needed
            key_str = key.decode() if isinstance(key, bytes) else key
            # key format: bulk_upload:{upload_id}:metadata
            parts = key_str.split(':')
            if len(parts) >= 3:
                upload_ids.append(parts[1])

        return upload_ids

    except RedisError as e:
        logger.error(f"Failed to list bulk uploads: {e}")
        return []


def cleanup_expired_bulk_uploads() -> int:
    """
    Cleanup expired bulk uploads (those without metadata key)

    Returns:
        Number of uploads cleaned up
    """
    cache = get_cache()
    if not cache or not cache.is_connected:
        return 0

    try:
        redis_client = cache.get_client()

        # Use scan_iter instead of keys() to avoid blocking Redis
        uploads: Dict[str, List[str]] = {}
        for key in redis_client.scan_iter(match="bulk_upload:*", count=100):
            # Decode bytes to string if needed
            key_str = key.decode() if isinstance(key, bytes) else key
            parts = key_str.split(':')
            if len(parts) >= 3:
                upload_id = parts[1]
                if upload_id not in uploads:
                    uploads[upload_id] = []
                uploads[upload_id].append(key_str)

        # Delete uploads without metadata key (expired/orphaned)
        cleaned = 0
        for upload_id, keys in uploads.items():
            metadata_key = f"bulk_upload:{upload_id}:metadata"
            if metadata_key not in keys:
                # Metadata expired - delete all related keys
                redis_client.delete(*keys)
                cleaned += 1
                logger.info(f"Cleaned up expired bulk upload: {upload_id}")

        if cleaned > 0:
            logger.info(f"Bulk upload cleanup: {cleaned} expired uploads removed")

        return cleaned

    except RedisError as e:
        logger.error(f"Failed to cleanup bulk uploads: {e}")
        return 0
