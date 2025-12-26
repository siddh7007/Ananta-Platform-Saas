"""
Error Queue Management for Enrichment Service

Implements dead-letter queue (DLQ) pattern for failed enrichments:
- Captures failed enrichment attempts
- Implements exponential backoff retry
- Tracks retry count and error history
- Routes to manual review queue if max retries exceeded

Uses Redis for fast queue operations with Supabase as persistent storage.
"""

import logging
import json
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from enum import Enum

from app.cache.redis_cache import RedisCache
from app.models.dual_database import get_dual_database
from sqlalchemy import text

logger = logging.getLogger(__name__)


class ErrorQueueStatus(str, Enum):
    """Error queue item status"""
    PENDING = "pending"  # Waiting for retry
    RETRYING = "retrying"  # Currently retrying
    MAX_RETRIES = "max_retries"  # Exceeded max retries, needs manual review
    RESOLVED = "resolved"  # Successfully resolved
    ABANDONED = "abandoned"  # Manually abandoned


class ErrorQueue:
    """
    Dead-Letter Queue (DLQ) for failed enrichments
    
    Retry Strategy:
    - Attempt 1: Immediate (delay 0s)
    - Attempt 2: +2s (total 2s delay)
    - Attempt 3: +4s (total 6s delay)
    - Attempt 4: +8s (total 14s delay)
    - Attempt 5: +16s (total 30s delay) - MAX
    """

    def __init__(self, redis_client: Optional[RedisCache] = None):
        """Initialize error queue with Redis backend"""
        self.redis = redis_client or self._get_redis()
        self.max_retries = 5
        self.base_delay_seconds = 2  # 2^1 = 2, 2^2 = 4, 2^3 = 8, 2^4 = 16

    @staticmethod
    def _get_redis() -> RedisCache:
        """Get Redis client"""
        import os
        redis_host = os.getenv('REDIS_HOST', 'localhost')
        redis_port = os.getenv('REDIS_PORT', '6379')
        redis_db = os.getenv('REDIS_DB', '0')
        redis_url = f"redis://{redis_host}:{redis_port}/{redis_db}"
        client = RedisCache(redis_url=redis_url)
        client.connect()
        return client

    def add_error(
        self,
        bom_id: str,
        component_id: str,
        mpn: str,
        error_message: str,
        error_type: str,
        enrichment_context: Optional[Dict[str, Any]] = None,
        retry_count: int = 0
    ) -> None:
        """
        Add failed enrichment to error queue

        Args:
            bom_id: BOM ID that failed
            component_id: Component ID that failed
            mpn: MPN of component
            error_message: Error message
            error_type: Type of error (validation, api, timeout, etc.)
            enrichment_context: Context from enrichment attempt
            retry_count: Current retry attempt number
        """
        try:
            # Calculate next retry time (exponential backoff)
            if retry_count >= self.max_retries:
                status = ErrorQueueStatus.MAX_RETRIES
                next_retry_delay = None
                logger.warning(
                    f"Max retries exceeded for {mpn} (component_id={component_id}), "
                    f"routing to manual review"
                )
            else:
                status = ErrorQueueStatus.PENDING
                # Delay = 2^(retry_count + 1) seconds
                next_retry_delay = self.base_delay_seconds ** (retry_count + 1)
                next_retry_time = datetime.utcnow() + timedelta(seconds=next_retry_delay)

            # Create error record
            error_record = {
                "bom_id": bom_id,
                "component_id": component_id,
                "mpn": mpn,
                "error_message": error_message,
                "error_type": error_type,
                "retry_count": retry_count,
                "status": status.value,
                "next_retry_delay": next_retry_delay,
                "timestamp": datetime.utcnow().isoformat(),
                "enrichment_context": enrichment_context or {}
            }

            # Store in Redis for fast lookup
            redis_key = f"error_queue:{bom_id}:{component_id}"
            self.redis.set(redis_key, json.dumps(error_record), ttl=86400)  # 24h TTL

            # Store in Supabase for persistence and audit
            self._store_error_in_database(error_record)

            logger.info(
                f"✅ Error queued: {mpn} (retry_count={retry_count}, "
                f"next_retry={next_retry_delay}s)"
            )

        except Exception as e:
            logger.error(f"Error storing error record: {e}", exc_info=True)

    def _store_error_in_database(self, error_record: Dict[str, Any]) -> None:
        """Store error record in Supabase for persistence"""
        try:
            dual_db = get_dual_database()
            db = next(dual_db.get_session("supabase"))

            query = text("""
                INSERT INTO enrichment_error_queue (
                    bom_id,
                    component_id,
                    mpn,
                    error_message,
                    error_type,
                    retry_count,
                    status,
                    next_retry_delay,
                    enrichment_context,
                    created_at
                )
                VALUES (
                    :bom_id,
                    :component_id,
                    :mpn,
                    :error_message,
                    :error_type,
                    :retry_count,
                    :status,
                    :next_retry_delay,
                    :enrichment_context,
                    NOW()
                )
                ON CONFLICT (component_id, retry_count) DO UPDATE SET
                    error_message = :error_message,
                    status = :status,
                    updated_at = NOW()
            """)

            try:
                db.execute(query, {
                    "bom_id": error_record["bom_id"],
                    "component_id": error_record["component_id"],
                    "mpn": error_record["mpn"],
                    "error_message": error_record["error_message"],
                    "error_type": error_record["error_type"],
                    "retry_count": error_record["retry_count"],
                    "status": error_record["status"],
                    "next_retry_delay": error_record["next_retry_delay"],
                    "enrichment_context": json.dumps(error_record["enrichment_context"])
                })
                db.commit()
            finally:
                next(dual_db.get_session("supabase"))  # Cleanup generator

        except Exception as e:
            logger.error(f"Error storing error record in database: {e}", exc_info=True)

    def should_retry(self, component_id: str, bom_id: str) -> bool:
        """
        Check if component should be retried

        Returns:
            True if should retry, False if max retries exceeded
        """
        try:
            redis_key = f"error_queue:{bom_id}:{component_id}"
            error_json = self.redis.get(redis_key)

            if not error_json:
                return False

            error_record = json.loads(error_json)
            retry_count = error_record.get("retry_count", 0)
            next_retry_delay = error_record.get("next_retry_delay")
            created_at = datetime.fromisoformat(error_record["timestamp"])

            # Check if retry delay has elapsed
            if next_retry_delay:
                retry_time = created_at + timedelta(seconds=next_retry_delay)
                if datetime.utcnow() < retry_time:
                    return False  # Still waiting for retry window

            return retry_count < self.max_retries

        except Exception as e:
            logger.error(f"Error checking retry status: {e}", exc_info=True)
            return False

    def get_pending_retries(self, limit: int = 10) -> list:
        """
        Get items pending retry from database

        Returns:
            List of error records ready for retry
        """
        try:
            dual_db = get_dual_database()
            db = next(dual_db.get_session("supabase"))

            query = text("""
                SELECT
                    id,
                    bom_id,
                    component_id,
                    mpn,
                    error_message,
                    error_type,
                    retry_count,
                    status,
                    enrichment_context,
                    created_at,
                    NOW() - INTERVAL '1 second' * next_retry_delay AS retry_ready_at
                FROM enrichment_error_queue
                WHERE status = :status
                AND retry_count < :max_retries
                AND created_at + INTERVAL '1 second' * COALESCE(next_retry_delay, 0) <= NOW()
                ORDER BY retry_count ASC, created_at ASC
                LIMIT :limit
            """)

            try:
                results = db.execute(query, {
                    "status": ErrorQueueStatus.PENDING.value,
                    "max_retries": self.max_retries,
                    "limit": limit
                }).fetchall()

                pending = []
                for row in results:
                    pending.append({
                        "id": str(row.id),
                        "bom_id": str(row.bom_id),
                        "component_id": str(row.component_id),
                        "mpn": row.mpn,
                        "error_message": row.error_message,
                        "error_type": row.error_type,
                        "retry_count": row.retry_count,
                        "enrichment_context": json.loads(row.enrichment_context) if row.enrichment_context else {}
                    })

                logger.info(f"Found {len(pending)} items pending retry")
                return pending

            finally:
                next(dual_db.get_session("supabase"))  # Cleanup generator

        except Exception as e:
            logger.error(f"Error fetching pending retries: {e}", exc_info=True)
            return []

    def mark_resolved(self, component_id: str, bom_id: str) -> None:
        """Mark error as resolved after successful retry"""
        try:
            redis_key = f"error_queue:{bom_id}:{component_id}"
            self.redis.delete(redis_key)

            # Update database
            dual_db = get_dual_database()
            db = next(dual_db.get_session("supabase"))

            query = text("""
                UPDATE enrichment_error_queue
                SET status = :status, updated_at = NOW()
                WHERE component_id = :component_id AND bom_id = :bom_id
            """)

            try:
                db.execute(query, {
                    "status": ErrorQueueStatus.RESOLVED.value,
                    "component_id": component_id,
                    "bom_id": bom_id
                })
                db.commit()
                logger.info(f"✅ Error marked resolved: {component_id}")
            finally:
                next(dual_db.get_session("supabase"))  # Cleanup generator

        except Exception as e:
            logger.error(f"Error marking as resolved: {e}", exc_info=True)

    def mark_abandoned(self, component_id: str, bom_id: str) -> None:
        """Mark error as abandoned (manual decision)"""
        try:
            redis_key = f"error_queue:{bom_id}:{component_id}"
            self.redis.delete(redis_key)

            dual_db = get_dual_database()
            db = next(dual_db.get_session("supabase"))

            query = text("""
                UPDATE enrichment_error_queue
                SET status = :status, updated_at = NOW()
                WHERE component_id = :component_id AND bom_id = :bom_id
            """)

            try:
                db.execute(query, {
                    "status": ErrorQueueStatus.ABANDONED.value,
                    "component_id": component_id,
                    "bom_id": bom_id
                })
                db.commit()
                logger.info(f"✅ Error marked abandoned: {component_id}")
            finally:
                next(dual_db.get_session("supabase"))  # Cleanup generator

        except Exception as e:
            logger.error(f"Error marking as abandoned: {e}", exc_info=True)


# Global error queue instance
_error_queue = ErrorQueue()


def get_error_queue() -> ErrorQueue:
    """Get global error queue instance"""
    return _error_queue
