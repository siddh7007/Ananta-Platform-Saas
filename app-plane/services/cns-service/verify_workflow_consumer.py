#!/usr/bin/env python3
"""
Verification script for Workflow Control Consumer integration

Tests that the WorkflowControlConsumer is properly registered in main.py
and can be started/stopped as a background task.

Usage:
    python verify_workflow_consumer.py
"""

import sys
import asyncio
import logging
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_consumer_runner():
    """Test workflow_control_runner module"""
    logger.info("=" * 70)
    logger.info("TEST 1: Workflow Control Runner Module")
    logger.info("=" * 70)

    try:
        from app.workers.workflow_control_runner import (
            start_workflow_control_consumer,
            stop_workflow_control_consumer,
            is_consumer_running,
            get_consumer_stats,
        )
        logger.info("✅ Successfully imported workflow_control_runner module")
    except ImportError as e:
        logger.error(f"❌ Failed to import workflow_control_runner: {e}")
        return False

    # Test stats when not running
    stats = get_consumer_stats()
    logger.info(f"Stats (before start): {stats}")
    assert not stats['running'], "Consumer should not be running initially"
    logger.info("✅ Stats correctly show consumer not running")

    # Test start
    try:
        logger.info("Starting workflow control consumer...")
        task = start_workflow_control_consumer()

        if task is None:
            logger.error("❌ start_workflow_control_consumer() returned None")
            return False

        logger.info("✅ Consumer task created successfully")

        # Wait a moment for consumer to initialize
        await asyncio.sleep(2)

        # Check if running
        is_running = is_consumer_running()
        logger.info(f"Consumer running status: {is_running}")

        stats = get_consumer_stats()
        logger.info(f"Stats (after start): {stats}")

        # Give it a moment to connect
        logger.info("Waiting 5 seconds for consumer to connect...")
        await asyncio.sleep(5)

        # Stop consumer
        logger.info("Stopping workflow control consumer...")
        await stop_workflow_control_consumer()
        logger.info("✅ Consumer stopped successfully")

        # Verify stopped
        await asyncio.sleep(1)
        is_running = is_consumer_running()
        logger.info(f"Consumer running status (after stop): {is_running}")
        assert not is_running, "Consumer should be stopped"
        logger.info("✅ Consumer correctly stopped")

        return True

    except Exception as e:
        logger.error(f"❌ Error during consumer test: {e}", exc_info=True)

        # Try to stop if still running
        try:
            await stop_workflow_control_consumer()
        except:
            pass

        return False


def test_main_py_integration():
    """Test that main.py has the correct imports and integration"""
    logger.info("")
    logger.info("=" * 70)
    logger.info("TEST 2: main.py Integration")
    logger.info("=" * 70)

    main_py_path = Path(__file__).parent / "app" / "main.py"

    if not main_py_path.exists():
        logger.error(f"❌ main.py not found at {main_py_path}")
        return False

    logger.info(f"Reading {main_py_path}")
    content = main_py_path.read_text(encoding='utf-8')

    # Check for required imports
    required_imports = [
        "from app.workers.workflow_control_runner import",
        "start_workflow_control_consumer",
        "stop_workflow_control_consumer",
    ]

    for import_str in required_imports:
        if import_str in content:
            logger.info(f"✅ Found: {import_str}")
        else:
            logger.error(f"❌ Missing: {import_str}")
            return False

    # Check for startup code
    startup_checks = [
        "workflow_control_task = None",
        "workflow_control_task = start_workflow_control_consumer()",
        "Workflow control consumer started successfully",
    ]

    for check in startup_checks:
        if check in content:
            logger.info(f"✅ Found startup: {check}")
        else:
            logger.error(f"❌ Missing startup: {check}")
            return False

    # Check for shutdown code
    shutdown_checks = [
        "if workflow_control_task:",
        "await stop_workflow_control_consumer()",
    ]

    for check in shutdown_checks:
        if check in content:
            logger.info(f"✅ Found shutdown: {check}")
        else:
            logger.error(f"❌ Missing shutdown: {check}")
            return False

    # Check lifespan docstring updated
    if "Start workflow control consumer (RabbitMQ)" in content:
        logger.info("✅ Lifespan docstring updated with consumer info")
    else:
        logger.warning("⚠️  Lifespan docstring may not mention consumer")

    logger.info("✅ All main.py integration checks passed")
    return True


def test_consumer_class():
    """Test WorkflowControlConsumer class structure"""
    logger.info("")
    logger.info("=" * 70)
    logger.info("TEST 3: WorkflowControlConsumer Class")
    logger.info("=" * 70)

    try:
        from app.workers.workflow_control_consumer import WorkflowControlConsumer
        logger.info("✅ Successfully imported WorkflowControlConsumer")
    except ImportError as e:
        logger.error(f"❌ Failed to import WorkflowControlConsumer: {e}")
        return False

    # Check inheritance
    from app.workers.base_consumer import BaseRStreamConsumer
    if issubclass(WorkflowControlConsumer, BaseRStreamConsumer):
        logger.info("✅ WorkflowControlConsumer inherits from BaseRStreamConsumer")
    else:
        logger.error("❌ WorkflowControlConsumer does not inherit from BaseRStreamConsumer")
        return False

    # Check instance attributes
    try:
        consumer = WorkflowControlConsumer()

        # Check stream name
        assert consumer.stream == 'stream.platform.admin', f"Expected stream='stream.platform.admin', got '{consumer.stream}'"
        logger.info(f"✅ Stream: {consumer.stream}")

        # Check consumer name
        assert consumer.consumer_name == 'workflow-control-consumer', f"Expected consumer_name='workflow-control-consumer', got '{consumer.consumer_name}'"
        logger.info(f"✅ Consumer name: {consumer.consumer_name}")

        # Check routing keys
        expected_keys = [
            'admin.workflow.paused',
            'admin.workflow.resumed',
            'admin.workflow.cancelled',
        ]
        assert set(consumer.routing_keys) == set(expected_keys), f"Routing keys mismatch"
        logger.info(f"✅ Routing keys: {consumer.routing_keys}")

        # Check method exists
        assert hasattr(consumer, 'handle_message'), "Missing handle_message method"
        logger.info("✅ handle_message method exists")

        logger.info("✅ WorkflowControlConsumer structure is correct")
        return True

    except Exception as e:
        logger.error(f"❌ Error checking WorkflowControlConsumer: {e}", exc_info=True)
        return False


async def main():
    """Run all verification tests"""
    logger.info("")
    logger.info("=" * 70)
    logger.info("WORKFLOW CONTROL CONSUMER - VERIFICATION SUITE")
    logger.info("=" * 70)
    logger.info("")

    results = {}

    # Test 1: Consumer class structure
    results['consumer_class'] = test_consumer_class()

    # Test 2: main.py integration
    results['main_py_integration'] = test_main_py_integration()

    # Test 3: Consumer runner module
    results['consumer_runner'] = await test_consumer_runner()

    # Summary
    logger.info("")
    logger.info("=" * 70)
    logger.info("VERIFICATION SUMMARY")
    logger.info("=" * 70)

    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        logger.info(f"{status}: {test_name}")

    all_passed = all(results.values())

    logger.info("")
    if all_passed:
        logger.info("🎉 ALL TESTS PASSED - Workflow Control Consumer is properly integrated!")
        logger.info("")
        logger.info("Next steps:")
        logger.info("1. Start CNS service: python -m app.main")
        logger.info("2. Check logs for: '✅ Workflow control consumer started successfully'")
        logger.info("3. Monitor consumer health: GET /health/critical-fixes")
        logger.info("4. Send test event to RabbitMQ stream to verify message handling")
        return 0
    else:
        logger.error("❌ SOME TESTS FAILED - Please review errors above")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
