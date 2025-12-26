"""
Test script for EventLogger

Quick verification that the EventLogger service works correctly.
Run this to test database connectivity and event logging.
"""

import sys
import os

# Add parent directories to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(current_dir)
sys.path.insert(0, app_dir)

from app.services.event_logger import EventLogger
from app.database import get_db_session


def test_basic_logging():
    """Test basic event logging functionality"""
    print("\n" + "=" * 80)
    print("TEST 1: Basic Event Logging")
    print("=" * 80)

    try:
        with get_db_session() as db:
            event_logger = EventLogger(db)

            # Test data
            bom_id = "550e8400-e29b-41d4-a716-446655440000"
            organization_id = "550e8400-e29b-41d4-a716-446655440001"
            workflow_id = "test-workflow-001"

            # Log processing started
            print("\n1. Logging processing_started event...")
            event_id = event_logger.log_processing_started(
                bom_id=bom_id,
                organization_id=organization_id,
                workflow_id=workflow_id,
                source="customer",
                total_items=10,
                user_id="550e8400-e29b-41d4-a716-446655440002"
            )

            if event_id:
                print(f"   SUCCESS: Event logged with ID: {event_id}")
            else:
                print("   FAILED: Event not logged")
                return False

            # Log stage started
            print("\n2. Logging stage_started event...")
            event_id = event_logger.log_stage_started(
                bom_id=bom_id,
                stage_name="enrichment",
                organization_id=organization_id,
                workflow_id=workflow_id,
                source="customer"
            )

            if event_id:
                print(f"   SUCCESS: Event logged with ID: {event_id}")
            else:
                print("   FAILED: Event not logged")
                return False

            # Log enrichment progress
            print("\n3. Logging enrichment_progress event...")
            event_id = event_logger.log_enrichment_progress(
                bom_id=bom_id,
                organization_id=organization_id,
                mpn="LM358",
                manufacturer="Texas Instruments",
                status="matched",
                confidence=0.95,
                source="DigiKey",
                workflow_id=workflow_id
            )

            if event_id:
                print(f"   SUCCESS: Event logged with ID: {event_id}")
            else:
                print("   FAILED: Event not logged")
                return False

            print("\n" + "-" * 80)
            print("TEST 1: PASSED - All events logged successfully")
            print("-" * 80)
            return True

    except Exception as e:
        print(f"\n   ERROR: {e}")
        import traceback
        traceback.print_exc()
        print("\n" + "-" * 80)
        print("TEST 1: FAILED")
        print("-" * 80)
        return False


def test_query_events():
    """Test event querying functionality"""
    print("\n" + "=" * 80)
    print("TEST 2: Event Querying")
    print("=" * 80)

    try:
        with get_db_session() as db:
            event_logger = EventLogger(db)

            bom_id = "550e8400-e29b-41d4-a716-446655440000"
            workflow_id = "test-workflow-001"

            # Query events by BOM
            print("\n1. Querying events by BOM...")
            events = event_logger.get_events_by_bom(
                bom_id=bom_id,
                limit=10
            )

            print(f"   Found {len(events)} events")
            for i, event in enumerate(events[:3], 1):
                print(f"   {i}. {event.event_type} - {event.created_at}")

            # Query events by workflow
            print("\n2. Querying events by workflow...")
            events = event_logger.get_events_by_workflow(
                workflow_id=workflow_id,
                limit=10
            )

            print(f"   Found {len(events)} events")
            for i, event in enumerate(events[:3], 1):
                print(f"   {i}. {event.event_type} - {event.created_at}")

            # Query specific event types
            print("\n3. Querying specific event types...")
            events = event_logger.get_events_by_bom(
                bom_id=bom_id,
                event_types=["enrichment_progress"],
                limit=10
            )

            print(f"   Found {len(events)} enrichment_progress events")

            print("\n" + "-" * 80)
            print("TEST 2: PASSED - Queries executed successfully")
            print("-" * 80)
            return True

    except Exception as e:
        print(f"\n   ERROR: {e}")
        import traceback
        traceback.print_exc()
        print("\n" + "-" * 80)
        print("TEST 2: FAILED")
        print("-" * 80)
        return False


def test_error_logging():
    """Test error event logging"""
    print("\n" + "=" * 80)
    print("TEST 3: Error Event Logging")
    print("=" * 80)

    try:
        with get_db_session() as db:
            event_logger = EventLogger(db)

            bom_id = "550e8400-e29b-41d4-a716-446655440000"
            organization_id = "550e8400-e29b-41d4-a716-446655440001"

            # Log error
            print("\n1. Logging error event...")
            event_id = event_logger.log_error(
                bom_id=bom_id,
                organization_id=organization_id,
                error_message="Test error message",
                error_code="TEST_ERROR",
                workflow_id="test-workflow-001",
                error_details={
                    "component": "test_component",
                    "severity": "low",
                    "retryable": True
                }
            )

            if event_id:
                print(f"   SUCCESS: Error event logged with ID: {event_id}")
            else:
                print("   FAILED: Error event not logged")
                return False

            # Query recent errors
            print("\n2. Querying recent errors...")
            errors = event_logger.get_recent_errors(
                organization_id=organization_id,
                hours=24,
                limit=10
            )

            print(f"   Found {len(errors)} recent errors")
            for i, error in enumerate(errors[:3], 1):
                msg = error.payload.get('error_message', 'N/A')
                print(f"   {i}. {msg}")

            print("\n" + "-" * 80)
            print("TEST 3: PASSED - Error logging works correctly")
            print("-" * 80)
            return True

    except Exception as e:
        print(f"\n   ERROR: {e}")
        import traceback
        traceback.print_exc()
        print("\n" + "-" * 80)
        print("TEST 3: FAILED")
        print("-" * 80)
        return False


def test_risk_alerts():
    """Test risk alert logging"""
    print("\n" + "=" * 80)
    print("TEST 4: Risk Alert Logging")
    print("=" * 80)

    try:
        with get_db_session() as db:
            event_logger = EventLogger(db)

            bom_id = "550e8400-e29b-41d4-a716-446655440000"
            organization_id = "550e8400-e29b-41d4-a716-446655440001"

            # Log critical risk alert
            print("\n1. Logging critical risk alert...")
            event_id = event_logger.log_risk_alert(
                bom_id=bom_id,
                organization_id=organization_id,
                component_id="comp-123",
                mpn="OBSOLETE-CHIP-2000",
                manufacturer="Legacy Semiconductors",
                risk_score=85.5,
                risk_factors=[
                    "End of Life (EOL) status",
                    "No alternative suppliers",
                    "High lead time (26+ weeks)"
                ],
                workflow_id="test-workflow-001"
            )

            if event_id:
                print(f"   SUCCESS: Risk alert logged with ID: {event_id}")
            else:
                print("   FAILED: Risk alert not logged")
                return False

            # Log medium risk alert
            print("\n2. Logging medium risk alert...")
            event_id = event_logger.log_risk_alert(
                bom_id=bom_id,
                organization_id=organization_id,
                component_id="comp-456",
                mpn="STM32F407VGT6",
                manufacturer="STMicroelectronics",
                risk_score=62.0,
                risk_factors=[
                    "Limited stock at primary supplier",
                    "Single source component"
                ],
                workflow_id="test-workflow-001"
            )

            if event_id:
                print(f"   SUCCESS: Risk alert logged with ID: {event_id}")
            else:
                print("   FAILED: Risk alert not logged")
                return False

            print("\n" + "-" * 80)
            print("TEST 4: PASSED - Risk alerts logged successfully")
            print("-" * 80)
            return True

    except Exception as e:
        print(f"\n   ERROR: {e}")
        import traceback
        traceback.print_exc()
        print("\n" + "-" * 80)
        print("TEST 4: FAILED")
        print("-" * 80)
        return False


def test_workflow_control():
    """Test workflow control events"""
    print("\n" + "=" * 80)
    print("TEST 5: Workflow Control Events")
    print("=" * 80)

    try:
        with get_db_session() as db:
            event_logger = EventLogger(db)

            bom_id = "550e8400-e29b-41d4-a716-446655440000"
            organization_id = "550e8400-e29b-41d4-a716-446655440001"
            workflow_id = "test-workflow-001"
            admin_id = "550e8400-e29b-41d4-a716-446655440003"

            # Log workflow paused
            print("\n1. Logging workflow_paused event...")
            event_id = event_logger.log_workflow_paused(
                bom_id=bom_id,
                workflow_id=workflow_id,
                organization_id=organization_id,
                user_id=admin_id,
                reason="Supplier API maintenance window"
            )

            if event_id:
                print(f"   SUCCESS: Workflow paused event logged with ID: {event_id}")
            else:
                print("   FAILED: Workflow paused event not logged")
                return False

            # Log workflow resumed
            print("\n2. Logging workflow_resumed event...")
            event_id = event_logger.log_workflow_resumed(
                bom_id=bom_id,
                workflow_id=workflow_id,
                organization_id=organization_id,
                user_id=admin_id,
                reason="Maintenance completed"
            )

            if event_id:
                print(f"   SUCCESS: Workflow resumed event logged with ID: {event_id}")
            else:
                print("   FAILED: Workflow resumed event not logged")
                return False

            print("\n" + "-" * 80)
            print("TEST 5: PASSED - Workflow control events logged successfully")
            print("-" * 80)
            return True

    except Exception as e:
        print(f"\n   ERROR: {e}")
        import traceback
        traceback.print_exc()
        print("\n" + "-" * 80)
        print("TEST 5: FAILED")
        print("-" * 80)
        return False


def main():
    """Run all tests"""
    print("\n" + "=" * 80)
    print("EventLogger Test Suite")
    print("=" * 80)

    results = []

    # Run tests
    results.append(("Basic Logging", test_basic_logging()))
    results.append(("Event Querying", test_query_events()))
    results.append(("Error Logging", test_error_logging()))
    results.append(("Risk Alerts", test_risk_alerts()))
    results.append(("Workflow Control", test_workflow_control()))

    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        status = "PASSED" if result else "FAILED"
        symbol = "✓" if result else "✗"
        print(f"{symbol} {name}: {status}")

    print("\n" + "-" * 80)
    print(f"Results: {passed}/{total} tests passed")
    print("-" * 80)

    if passed == total:
        print("\nAll tests passed successfully!")
        return 0
    else:
        print(f"\n{total - passed} test(s) failed!")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
