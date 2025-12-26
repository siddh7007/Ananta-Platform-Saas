"""
CRITICAL-5: Distributed Lock Manager for Concurrent Enrichment

Prevents duplicate enrichment records when multiple workers process the same component
Uses Redis for distributed locking across service instances
"""

import logging
import asyncio
import uuid
from typing import Optional, Callable, Any
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
import redis.asyncio as aioredis
import os
from app.config import settings

logger = logging.getLogger(__name__)


class DistributedLock:
    """Distributed lock using Redis"""
    
    def __init__(
        self,
        redis_url: str,
        lock_key: str,
        timeout: int = 30,
        acquire_timeout: int = 5
    ):
        """
        Args:
            redis_url: Redis connection URL
            lock_key: Key to lock (e.g., "enrichment:STM32F407")
            timeout: How long lock is held (seconds)
            acquire_timeout: How long to wait for lock (seconds)
        """
        self.redis_url = redis_url
        self.lock_key = lock_key
        self.timeout = timeout
        self.acquire_timeout = acquire_timeout
        self.redis_client = None
        self.lock_id = str(uuid.uuid4())
        self.acquired = False
    
    async def connect(self):
        """Connect to Redis"""
        if not self.redis_client:
            self.redis_client = await aioredis.from_url(self.redis_url)
            logger.debug(f"Connected to Redis: {self.redis_url.split('@')[-1]}")
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self.redis_client:
            await self.redis_client.close()
            self.redis_client = None
            logger.debug(f"Disconnected from Redis")
    
    async def acquire(self) -> bool:
        """
        Acquire the lock
        
        Returns:
            True if lock acquired, False if timeout
        """
        await self.connect()
        
        start_time = datetime.utcnow()
        
        while True:
            # Try to set lock (only if doesn't exist)
            result = await self.redis_client.set(
                self.lock_key,
                self.lock_id,
                nx=True,  # Only set if doesn't exist
                ex=self.timeout  # Expire after timeout
            )
            
            if result:
                self.acquired = True
                logger.info(f"✅ Acquired lock: {self.lock_key}")
                return True
            
            # Check timeout
            elapsed = (datetime.utcnow() - start_time).total_seconds()
            if elapsed >= self.acquire_timeout:
                logger.warning(f"⏱️  Lock acquire timeout for {self.lock_key}")
                return False
            
            # Wait before retry
            await asyncio.sleep(0.1)
    
    async def release(self):
        """Release the lock"""
        if not self.acquired:
            logger.debug(f"Lock not acquired, skipping release: {self.lock_key}")
            return
        
        await self.connect()
        
        # Only delete if we still own it (verify by lock_id)
        current_value = await self.redis_client.get(self.lock_key)
        
        if current_value and current_value.decode() == self.lock_id:
            await self.redis_client.delete(self.lock_key)
            self.acquired = False
            logger.info(f"✅ Released lock: {self.lock_key}")
        else:
            logger.warning(f"⚠️  Lock ownership mismatch: {self.lock_key}")
    
    async def __aenter__(self):
        """Context manager support"""
        if not await self.acquire():
            raise TimeoutError(f"Could not acquire lock: {self.lock_key}")
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Context manager cleanup"""
        await self.release()


class IdempotencyKeyManager:
    """Manages idempotency keys to prevent duplicate processing"""
    
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.redis_client = None
    
    async def connect(self):
        """Connect to Redis"""
        if not self.redis_client:
            self.redis_client = await aioredis.from_url(self.redis_url)
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self.redis_client:
            await self.redis_client.close()
            self.redis_client = None
    
    async def register_idempotency_key(
        self,
        idempotency_key: str,
        result: dict,
        expiry: int = 3600
    ) -> bool:
        """
        Register an idempotency key with result
        
        Args:
            idempotency_key: Unique request identifier
            result: Result data to cache
            expiry: How long to cache (seconds)
        
        Returns:
            True if registered, False if already exists
        """
        await self.connect()
        
        # Serialize result
        import json
        result_json = json.dumps(result)
        
        # Set only if doesn't exist
        success = await self.redis_client.set(
            f"idempotency:{idempotency_key}",
            result_json,
            nx=True,
            ex=expiry
        )
        
        if success:
            logger.info(f"Registered idempotency key: {idempotency_key}")
        else:
            logger.warning(f"Idempotency key already exists: {idempotency_key}")
        
        return bool(success)
    
    async def get_idempotency_result(self, idempotency_key: str) -> Optional[dict]:
        """
        Get cached result for idempotency key
        
        Args:
            idempotency_key: Unique request identifier
        
        Returns:
            Cached result or None
        """
        await self.connect()
        
        result = await self.redis_client.get(f"idempotency:{idempotency_key}")
        
        if result:
            import json
            return json.loads(result)
        
        return None


class EnrichmentLockManager:
    """Manages locks for component enrichment to prevent duplicates"""
    
    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or os.getenv(
            "REDIS_URL",
            settings.redis_url
        )
        self.idempotency_manager = IdempotencyKeyManager(self.redis_url)
    
    async def get_enrichment_lock(
        self,
        mpn: str,
        timeout: int = 30,
        acquire_timeout: int = 5
    ) -> DistributedLock:
        """Get lock for MPN enrichment"""
        return DistributedLock(
            self.redis_url,
            f"enrichment:{mpn}",
            timeout=timeout,
            acquire_timeout=acquire_timeout
        )
    
    async def get_bom_lock(
        self,
        bom_id: str,
        timeout: int = 60,
        acquire_timeout: int = 10
    ) -> DistributedLock:
        """Get lock for BOM processing"""
        return DistributedLock(
            self.redis_url,
            f"bom:{bom_id}",
            timeout=timeout,
            acquire_timeout=acquire_timeout
        )
    
    async def with_enrichment_lock(
        self,
        mpn: str,
        func: Callable,
        *args,
        **kwargs
    ) -> Any:
        """
        Execute function with enrichment lock
        
        Usage:
            result = await enrichment_manager.with_enrichment_lock(
                "STM32F407",
                enrich_component,
                mpn="STM32F407"
            )
        """
        lock = await self.get_enrichment_lock(mpn)
        
        try:
            async with lock:
                if asyncio.iscoroutinefunction(func):
                    return await func(*args, **kwargs)
                else:
                    return func(*args, **kwargs)
        except TimeoutError:
            logger.error(f"Could not acquire lock for enrichment: {mpn}")
            raise


# Global instance
_enrichment_manager: Optional[EnrichmentLockManager] = None


def init_enrichment_manager(redis_url: str = None) -> EnrichmentLockManager:
    """Initialize global enrichment lock manager"""
    global _enrichment_manager
    _enrichment_manager = EnrichmentLockManager(redis_url)
    return _enrichment_manager


def get_enrichment_manager() -> EnrichmentLockManager:
    """Get global enrichment lock manager"""
    global _enrichment_manager
    if _enrichment_manager is None:
        _enrichment_manager = EnrichmentLockManager()
    return _enrichment_manager


async def with_enrichment_lock(mpn: str):
    """
    Async context manager decorator for enrichment locks
    
    Usage:
        @with_enrichment_lock("STM32F407")
        async def enrich_component(mpn):
            return await vendor_search(mpn)
    """
    manager = get_enrichment_manager()
    lock = await manager.get_enrichment_lock(mpn)
    return lock


@asynccontextmanager
async def enrichment_lock_context(mpn: str):
    """
    Helper to use enrichment lock in async context

    Usage:
        async with enrichment_lock_context("STM32F407") as lock:
            # Do enrichment work
            pass
    """
    manager = get_enrichment_manager()
    lock = await manager.get_enrichment_lock(mpn)
    async with lock:
        yield lock
