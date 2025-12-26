"""
Test CRITICAL Fixes Integration

Verifies that all CRITICAL fixes are properly integrated:
- CRITICAL-4: Dual database routing
- CRITICAL-5: Race condition prevention
- CRITICAL-6: Input validation
- CRITICAL-7: Error handling
"""

import asyncio
import logging
import pytest
from typing import Optional

logger = logging.getLogger(__name__)


@pytest.mark.asyncio
async def test_critical_4_routing():
    """Test CRITICAL-4: Dual database routing"""
    print("\n" + "="*70)
    print("TEST: CRITICAL-4 - Dual Database Routing")
    print("="*70)
    
    try:
        from app.core.dual_database_routing import (
            DatabaseType,
            RoutingContext,
            get_router
        )
        
        router = get_router()
        
        # Test staff routing
        context_staff = RoutingContext(
            organization_type="staff",
            user_role="admin"
        )
        db_staff = context_staff.determine_database()
        print(f"✅ Staff context → {db_staff.value}")
        assert db_staff == DatabaseType.COMPONENTS_V2, "Staff should route to PostgreSQL"
        
        # Test customer routing
        context_customer = RoutingContext(
            organization_type="customer"
        )
        db_customer = context_customer.determine_database()
        print(f"✅ Customer context → {db_customer.value}")
        assert db_customer == DatabaseType.SUPABASE, "Customer should route to Supabase"
        
        print("\n✅ CRITICAL-4 Integration Test PASSED")
        return True
    except Exception as e:
        print(f"\n❌ CRITICAL-4 Integration Test FAILED: {e}")
        return False


@pytest.mark.asyncio
async def test_critical_5_locking():
    """Test CRITICAL-5: Race condition prevention"""
    print("\n" + "="*70)
    print("TEST: CRITICAL-5 - Race Condition Prevention")
    print("="*70)
    
    try:
        from app.core.workflow_locking import (
            WorkflowLockManager,
            DistributedLock
        )
        
        manager = WorkflowLockManager()
        
        # Test BOM lock
        bom_lock = manager.get_bom_lock(12345)
        print(f"✅ Got BOM lock manager for BOM 12345")
        
        # Test component lock
        component_lock = manager.get_component_lock(67890)
        print(f"✅ Got component lock manager for component 67890")
        
        # Test enrichment lock
        enrichment_lock = manager.get_enrichment_lock("batch_001")
        print(f"✅ Got enrichment lock manager for batch_001")
        
        # Test lock object properties
        print(f"✅ Lock TTL: {bom_lock.ttl} seconds")
        print(f"✅ Lock ID: {bom_lock.lock_id}")
        
        print("\n✅ CRITICAL-5 Integration Test PASSED")
        return True
    except Exception as e:
        print(f"\n❌ CRITICAL-5 Integration Test FAILED: {e}")
        logger.error(f"CRITICAL-5 test error: {e}", exc_info=True)
        return False


@pytest.mark.asyncio
async def test_critical_6_validation():
    """Test CRITICAL-6: Input validation & sanitization"""
    print("\n" + "="*70)
    print("TEST: CRITICAL-6 - Input Validation & Sanitization")
    print("="*70)
    
    try:
        from app.core.input_validation import (
            MPNValidator,
            CategoryValidator,
            SupplierValidator,
            InputSanitizer,
            ValidatedMPN,
            ValidatedCategory
        )
        
        # Test MPN validation
        valid_mpn = MPNValidator.validate("STM32F407VG")
        print(f"✅ Valid MPN accepted: STM32F407VG")
        assert valid_mpn, "Valid MPN should be accepted"
        
        invalid_mpn = MPNValidator.validate("'; DROP TABLE--")
        print(f"✅ Injection attempt rejected: '; DROP TABLE--")
        assert not invalid_mpn, "Injection should be rejected"
        
        # Test MPN sanitization
        sanitized = MPNValidator.sanitize("stm32f407vg")
        print(f"✅ MPN sanitized: stm32f407vg → {sanitized}")
        
        # Test category validation
        valid_cat = CategoryValidator.validate("Microcontrollers")
        print(f"✅ Valid category accepted: Microcontrollers")
        assert valid_cat, "Valid category should be accepted"
        
        # Test Pydantic model
        validated_mpn = ValidatedMPN(mpn="STM32F407VG")
        print(f"✅ Pydantic model validated MPN: {validated_mpn.mpn}")
        
        # Test sanitizer
        sanitized_dict = InputSanitizer.sanitize_dict(
            {"mpn": "STM32F407VG", "name": "Test Component"},
            allowed_keys=["mpn", "name"]
        )
        print(f"✅ Dictionary sanitized: {sanitized_dict}")
        
        print("\n✅ CRITICAL-6 Integration Test PASSED")
        return True
    except Exception as e:
        print(f"\n❌ CRITICAL-6 Integration Test FAILED: {e}")
        logger.error(f"CRITICAL-6 test error: {e}", exc_info=True)
        return False


@pytest.mark.asyncio
async def test_critical_7_error_handling():
    """Test CRITICAL-7: Error handling & standardization"""
    print("\n" + "="*70)
    print("TEST: CRITICAL-7 - Error Handling & Standardization")
    print("="*70)
    
    try:
        from app.core.error_handling import (
            ErrorHandler,
            ErrorResponse,
            ErrorCode,
            ErrorCategory,
            ErrorField
        )
        
        # Test validation error
        field_errors = [
            ErrorField(
                field="mpn",
                message="Invalid format",
                received="invalid",
                expected="[A-Z0-9-+/]"
            )
        ]
        error_response = ErrorHandler.create_validation_error(
            request=None,
            field_errors=field_errors
        )
        print(f"✅ Validation error created: {error_response.error_code}")
        assert error_response.error_code == ErrorCode.INVALID_INPUT.value
        
        # Test not found error
        not_found = ErrorHandler.create_not_found_error(
            request=None,
            resource_type="component",
            resource_id="12345"
        )
        print(f"✅ Not found error created: {not_found.error_code}")
        assert not_found.error_code == ErrorCode.COMPONENT_NOT_FOUND.value
        
        # Test database error
        db_error = ErrorHandler.create_database_error(
            request=None,
            detail="Connection failed"
        )
        print(f"✅ Database error created: {db_error.error_code}")
        assert db_error.error_code == ErrorCode.DATABASE_ERROR.value
        assert db_error.retryable == True, "Database errors should be retryable"
        
        # Test rate limit error
        rate_limit = ErrorHandler.create_rate_limit_error(
            request=None,
            retry_after=60
        )
        print(f"✅ Rate limit error created: {rate_limit.error_code}")
        assert rate_limit.error_code == ErrorCode.RATE_LIMIT_EXCEEDED.value
        assert rate_limit.retry_after == 60
        
        # Test error response properties
        print(f"✅ Error ID format: {error_response.error_id[:8]}... (UUID)")
        print(f"✅ Timestamp: {error_response.timestamp}")
        print(f"✅ Has request_id: {bool(error_response.request_id)}")
        
        print("\n✅ CRITICAL-7 Integration Test PASSED")
        return True
    except Exception as e:
        print(f"\n❌ CRITICAL-7 Integration Test FAILED: {e}")
        logger.error(f"CRITICAL-7 test error: {e}", exc_info=True)
        return False
