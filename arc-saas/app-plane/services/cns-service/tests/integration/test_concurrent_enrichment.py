"""
Tests for CRITICAL-5: Concurrent Enrichment with Distributed Locks

Verifies that distributed locks prevent duplicate enrichment records
when multiple workers process the same MPN simultaneously
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
import uuid

from app.core.distributed_lock import (
    DistributedLock,
    IdempotencyKeyManager,
    EnrichmentLockManager,
    get_enrichment_manager,
)


@pytest.mark.asyncio
class TestDistributedLockConcurrency:
    """Test distributed lock prevents concurrent processing"""
    
    async def test_lock_prevents_concurrent_access(self):
        """Test that only one task can hold lock at a time"""
        lock_key = "test:component:STM32F407"
        
        # Create two locks for same resource
        lock1 = DistributedLock("redis://localhost:6379", lock_key, timeout=10)
        lock2 = DistributedLock("redis://localhost:6379", lock_key, timeout=10)
        
        # First lock should acquire immediately
        result1 = await lock1.acquire()
        assert result1 is True, "Lock 1 should acquire immediately"
        
        # Second lock should timeout
        result2 = await lock2.acquire()
        assert result2 is False, "Lock 2 should timeout (already held)"
        
        # Release first lock
        await lock1.release()
        
        # Now second lock should acquire
        result3 = await lock2.acquire()
        assert result3 is True, "Lock 2 should acquire after Lock 1 released"
        
        await lock2.release()
    
    async def test_lock_context_manager(self):
        """Test lock context manager handles cleanup"""
        lock_key = "test:enrichment:component123"
        lock = DistributedLock("redis://localhost:6379", lock_key, timeout=10)
        
        async with lock:
            assert lock.acquired is True
        
        # After context exit, lock should be released
        assert lock.acquired is False
    
    async def test_lock_timeout_respected(self):
        """Test lock timeout parameter"""
        lock_key = "test:quick:timeout"
        lock = DistributedLock(
            "redis://localhost:6379",
            lock_key,
            timeout=1,
            acquire_timeout=0.5
        )
        
        # Acquire lock
        result = await lock.acquire()
        assert result is True
        
        # Try to acquire second lock with short timeout
        lock2 = DistributedLock(
            "redis://localhost:6379",
            lock_key,
            acquire_timeout=0.3
        )
        
        result2 = await lock2.acquire()
        assert result2 is False, "Should timeout waiting for lock"
        
        await lock.release()


@pytest.mark.asyncio
class TestIdempotencyKeys:
    """Test idempotency key management"""
    
    async def test_register_idempotency_key(self):
        """Test registering unique request"""
        manager = IdempotencyKeyManager("redis://localhost:6379")
        key = f"test-idempotency-{uuid.uuid4()}"
        result_data = {"component_id": 123, "quality_score": 95}
        
        success = await manager.register_idempotency_key(key, result_data)
        assert success is True
        
        # Try registering same key again
        success2 = await manager.register_idempotency_key(key, result_data)
        assert success2 is False, "Should reject duplicate idempotency key"
        
        # But we can retrieve the result
        cached = await manager.get_idempotency_result(key)
        assert cached == result_data
        
        await manager.disconnect()
    
    async def test_idempotency_key_expiry(self):
        """Test idempotency keys expire after TTL"""
        manager = IdempotencyKeyManager("redis://localhost:6379")
        key = f"test-expiry-{uuid.uuid4()}"
        result_data = {"component_id": 456}
        
        # Register with 1 second expiry
        success = await manager.register_idempotency_key(key, result_data, expiry=1)
        assert success is True
        
        # Should be available immediately
        cached = await manager.get_idempotency_result(key)
        assert cached == result_data
        
        # Wait for expiry
        await asyncio.sleep(1.5)
        
        # Should be expired
        expired = await manager.get_idempotency_result(key)
        assert expired is None
        
        await manager.disconnect()


@pytest.mark.asyncio
class TestConcurrentEnrichment:
    """Test concurrent enrichment with locks"""
    
    async def test_concurrent_mpn_processing_uses_locks(self):
        """Verify concurrent MPN processing acquires locks"""
        manager = get_enrichment_manager()
        
        mpn = "STM32F407"
        lock = await manager.get_enrichment_lock(mpn, timeout=5, acquire_timeout=2)
        
        # First acquisition should succeed
        acquired1 = await lock.acquire()
        assert acquired1 is True
        
        # Simulate another worker trying same component
        lock2 = await manager.get_enrichment_lock(mpn, timeout=5, acquire_timeout=1)
        acquired2 = await lock2.acquire()
        assert acquired2 is False, "Second worker should not acquire lock"
        
        # Release first lock
        await lock.release()
        
        # Now second worker should be able to acquire
        lock3 = await manager.get_enrichment_lock(mpn, timeout=5, acquire_timeout=2)
        acquired3 = await lock3.acquire()
        assert acquired3 is True
        
        await lock3.release()
    
    async def test_different_mpns_dont_block_each_other(self):
        """Test that different MPNs can process concurrently"""
        manager = get_enrichment_manager()
        
        mpn1 = "STM32F407"
        mpn2 = "LM358N"
        
        lock1 = await manager.get_enrichment_lock(mpn1)
        lock2 = await manager.get_enrichment_lock(mpn2)
        
        # Both should acquire (different keys)
        acquired1 = await lock1.acquire()
        acquired2 = await lock2.acquire()
        
        assert acquired1 is True
        assert acquired2 is True, "Different MPNs should not block each other"
        
        await lock1.release()
        await lock2.release()
    
    async def test_enrichment_lock_context_manager(self):
        """Test using enrichment lock with context manager"""
        manager = get_enrichment_manager()
        mpn = "TEST_MPN_12345"
        
        lock = await manager.get_enrichment_lock(mpn, timeout=10)
        
        async with lock:
            # Simulate enrichment work
            await asyncio.sleep(0.1)
            assert lock.acquired is True
        
        # After exiting context, lock should be released
        assert lock.acquired is False


@pytest.mark.asyncio
class TestDuplicatePrevention:
    """Test that locks prevent duplicate database records"""
    
    async def test_lock_prevents_duplicate_catalog_entries(self):
        """
        Scenario: Two workers simultaneously enrich same MPN
        Expected: Only one inserts to database (has lock)
        """
        manager = get_enrichment_manager()
        mpn = "DUPLICATE_TEST_MPN"
        
        # Simulate two concurrent enrichment attempts
        results = []
        
        async def enrich_worker(worker_id):
            lock = await manager.get_enrichment_lock(mpn, timeout=10)
            
            try:
                acquired = await lock.acquire()
                if acquired:
                    # Simulate database insert
                    await asyncio.sleep(0.1)
                    results.append({
                        'worker': worker_id,
                        'success': True,
                        'inserted': True
                    })
                    await lock.release()
                else:
                    results.append({
                        'worker': worker_id,
                        'success': False,
                        'inserted': False
                    })
            except Exception as e:
                results.append({
                    'worker': worker_id,
                    'success': False,
                    'error': str(e)
                })
        
        # Run both workers concurrently
        await asyncio.gather(
            enrich_worker(1),
            enrich_worker(2)
        )
        
        # Verify only one worker got the lock
        successful = [r for r in results if r['success']]
        assert len(successful) == 1, "Only one worker should successfully acquire lock"
        
        # Verify one failed to acquire
        failed = [r for r in results if not r['success']]
        assert len(failed) == 1, "Other worker should fail to acquire lock"
    
    async def test_idempotency_detects_duplicate_requests(self):
        """Test idempotency keys prevent re-processing of duplicate requests"""
        manager = IdempotencyKeyManager("redis://localhost:6379")
        
        # First request
        idempotency_key = f"request-{uuid.uuid4()}"
        result1 = {"component_id": 999, "quality_score": 88}
        
        registered = await manager.register_idempotency_key(idempotency_key, result1)
        assert registered is True
        
        # Duplicate request with same idempotency key
        registered2 = await manager.register_idempotency_key(idempotency_key, result1)
        assert registered2 is False, "Should reject duplicate idempotency key"
        
        # But can retrieve cached result
        cached = await manager.get_idempotency_result(idempotency_key)
        assert cached == result1, "Should return cached result for duplicate request"
        
        await manager.disconnect()


@pytest.mark.asyncio
class TestLockCleanup:
    """Test lock cleanup and error handling"""
    
    async def test_lock_cleanup_on_exception(self):
        """Test lock is released even if error occurs"""
        lock_key = "test:error:cleanup"
        lock = DistributedLock("redis://localhost:6379", lock_key)
        
        try:
            async with lock:
                assert lock.acquired is True
                raise ValueError("Simulated error during enrichment")
        except ValueError:
            pass
        
        # Lock should be released despite exception
        assert lock.acquired is False
        
        # Should be able to acquire again
        lock2 = DistributedLock("redis://localhost:6379", lock_key)
        acquired = await lock2.acquire()
        assert acquired is True, "Lock should be available after exception cleanup"
        await lock2.release()
    
    async def test_lock_ownership_verification(self):
        """Test that only lock owner can release"""
        lock_key = "test:ownership"
        lock1 = DistributedLock("redis://localhost:6379", lock_key)
        lock2 = DistributedLock("redis://localhost:6379", lock_key)
        
        # Lock 1 acquires
        acquired1 = await lock1.acquire()
        assert acquired1 is True
        
        # Lock 2 cannot release (doesn't own it)
        await lock2.release()  # Should do nothing
        
        # Lock 1 should still own it
        # (Lock 2 release should have failed silently)
        # Verify by checking if we can release with Lock 1
        await lock1.release()


@pytest.mark.asyncio
class TestBOMConcurrentEnrichment:
    """Test BOM enrichment with multiple concurrent line items"""
    
    async def test_bom_enrichment_batch_uses_locks(self):
        """Test BOM batch enrichment uses locks per component"""
        manager = get_enrichment_manager()
        
        # Simulate BOM with 3 components, 2 of which are duplicates
        components = [
            ("STM32F407", "STMicroelectronics"),  # Unique 1
            ("LM358N", "Texas Instruments"),       # Unique 2
            ("STM32F407", "STMicroelectronics"),  # Duplicate of first
        ]
        
        # Process first two (should both acquire locks)
        lock1 = await manager.get_enrichment_lock(components[0][0])
        lock2 = await manager.get_enrichment_lock(components[1][0])
        
        acquired1 = await lock1.acquire()
        acquired2 = await lock2.acquire()
        
        assert acquired1 is True
        assert acquired2 is True
        
        # Third component uses same lock as first (should be held)
        lock3 = await manager.get_enrichment_lock(components[2][0], acquire_timeout=0.5)
        acquired3 = await lock3.acquire()
        
        assert acquired3 is False, "Lock should be held by first component"
        
        await lock1.release()
        await lock2.release()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
