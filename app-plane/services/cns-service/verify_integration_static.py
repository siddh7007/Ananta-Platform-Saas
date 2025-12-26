#!/usr/bin/env python3
"""
Static verification of Workflow Control Consumer integration

Checks source code without requiring runtime dependencies.

Usage:
    python verify_integration_static.py
"""

import sys
import os
from pathlib import Path

# Fix Windows console encoding for emoji support
if os.name == 'nt':
    sys.stdout.reconfigure(encoding='utf-8')

def verify_file_exists(filepath: Path, description: str) -> bool:
    """Check if a file exists"""
    if filepath.exists():
        print(f"✅ {description}: {filepath}")
        return True
    else:
        print(f"❌ {description} NOT FOUND: {filepath}")
        return False


def verify_content(filepath: Path, checks: list, description: str) -> bool:
    """Verify file contains required strings"""
    print(f"\nVerifying {description}:")
    print(f"  File: {filepath}")

    try:
        content = filepath.read_text(encoding='utf-8')
    except Exception as e:
        print(f"  ❌ Failed to read file: {e}")
        return False

    all_passed = True
    for check_str in checks:
        if check_str in content:
            print(f"  ✅ Found: {check_str[:80]}...")
        else:
            print(f"  ❌ Missing: {check_str[:80]}...")
            all_passed = False

    return all_passed


def main():
    """Run static verification"""
    print("=" * 80)
    print("WORKFLOW CONTROL CONSUMER - STATIC VERIFICATION")
    print("=" * 80)

    base_dir = Path(__file__).parent
    results = {}

    # 1. Check workflow_control_consumer.py exists
    consumer_file = base_dir / "app" / "workers" / "workflow_control_consumer.py"
    results['consumer_file'] = verify_file_exists(
        consumer_file,
        "WorkflowControlConsumer module"
    )

    # 2. Check workflow_control_runner.py exists
    runner_file = base_dir / "app" / "workers" / "workflow_control_runner.py"
    results['runner_file'] = verify_file_exists(
        runner_file,
        "Workflow control runner module"
    )

    # 3. Verify consumer class structure
    if results['consumer_file']:
        consumer_checks = [
            "class WorkflowControlConsumer(BaseRStreamConsumer):",
            "stream='stream.platform.admin'",
            "consumer_name='workflow-control-consumer'",
            "admin.workflow.paused",
            "admin.workflow.resumed",
            "admin.workflow.cancelled",
            "async def handle_message",
            "await handle.signal(\"pause\")",
            "await handle.signal(\"resume\")",
            "await handle.signal(\"cancel\")",
        ]
        results['consumer_structure'] = verify_content(
            consumer_file,
            consumer_checks,
            "WorkflowControlConsumer structure"
        )

    # 4. Verify runner module structure
    if results['runner_file']:
        runner_checks = [
            "def start_workflow_control_consumer()",
            "async def stop_workflow_control_consumer()",
            "def is_consumer_running()",
            "def get_consumer_stats()",
            "_consumer_task: Optional[asyncio.Task]",
            "_consumer_instance: Optional[WorkflowControlConsumer]",
            "loop.create_task(_run_consumer())",
            "_consumer_task.cancel()",
        ]
        results['runner_structure'] = verify_content(
            runner_file,
            runner_checks,
            "Workflow control runner structure"
        )

    # 5. Verify main.py integration
    main_file = base_dir / "app" / "main.py"
    if verify_file_exists(main_file, "main.py"):
        main_checks = [
            # Imports
            "from app.workers.workflow_control_runner import",
            "start_workflow_control_consumer",
            "stop_workflow_control_consumer",

            # Startup
            "workflow_control_task = None",
            "workflow_control_task = start_workflow_control_consumer()",
            "Workflow control consumer started successfully",

            # Shutdown
            "if workflow_control_task:",
            "await stop_workflow_control_consumer()",

            # Docstring
            "Start workflow control consumer (RabbitMQ)",
        ]
        results['main_integration'] = verify_content(
            main_file,
            main_checks,
            "main.py integration"
        )

    # Summary
    print("\n" + "=" * 80)
    print("VERIFICATION SUMMARY")
    print("=" * 80)

    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {test_name}")

    all_passed = all(results.values())

    print("\n" + "=" * 80)
    if all_passed:
        print("🎉 ALL CHECKS PASSED - Integration is correct!")
        print("=" * 80)
        print("\nNext steps:")
        print("1. Install dependencies: pip install rstream temporalio sqlalchemy")
        print("2. Start CNS service: python -m app.main")
        print("3. Check logs for: '✅ Workflow control consumer started successfully'")
        print("4. Monitor consumer health via stats endpoint")
        print("5. Send test workflow control event to verify message handling")
        return 0
    else:
        print("❌ SOME CHECKS FAILED - Please review errors above")
        print("=" * 80)
        return 1


if __name__ == "__main__":
    sys.exit(main())
