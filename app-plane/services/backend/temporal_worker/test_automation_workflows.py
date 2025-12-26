"""
Temporal Workflows for AI-Driven Test Automation
=================================================

This module implements workflows for automated testing with AI-powered
analysis and self-healing capabilities.

Based on closed-loop AI development principles.
"""

from temporalio import workflow
from dataclasses import dataclass
from datetime import timedelta
from typing import List, Dict, Any, Optional
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from temporal_worker.test_automation_activities import (
        run_selenium_tests,
        analyze_test_results,
        capture_test_artifacts,
        send_test_notification,
        trigger_code_fixes
    )


@dataclass
class TestAutomationInput:
    """Input for test automation workflow"""
    test_suite: str  # "catalog-api", "dashboard-ui", "bom-workflow", "full"
    auto_fix_on_failure: bool = True
    notify_on_completion: bool = True
    capture_screenshots: bool = True
    capture_logs: bool = True
    max_retry_attempts: int = 3


@dataclass
class TestResult:
    """Result from test execution"""
    success: bool
    total_tests: int
    passed: int
    failed: int
    errors: List[str]
    artifacts: Dict[str, Any]
    execution_time: float


@workflow.defn
class TestAutomationWorkflow:
    """
    AI-Driven Test Automation Workflow

    Steps:
    1. Run Selenium tests against Components Platform
    2. Capture artifacts (screenshots, logs, console output)
    3. Analyze failures with AI if tests fail
    4. Optionally trigger code fixes
    5. Retry tests after fixes
    6. Send notifications

    This workflow enables closed-loop testing where:
    - AI runs tests automatically
    - AI detects failures
    - AI analyzes root cause
    - AI applies fixes
    - AI verifies fixes work
    """

    def __init__(self):
        self._test_results = None
        self._retry_count = 0
        self._fixed = False

    @workflow.run
    async def run(self, input: TestAutomationInput) -> TestResult:
        """Execute test automation workflow"""

        workflow.logger.info(
            f"Starting test automation for suite: {input.test_suite}"
        )

        # Retry loop for test execution
        while self._retry_count <= input.max_retry_attempts:

            # Step 1: Run tests
            workflow.logger.info(
                f"Running tests (attempt {self._retry_count + 1}/{input.max_retry_attempts + 1})"
            )

            test_result = await workflow.execute_activity(
                run_selenium_tests,
                args=[input.test_suite, input.capture_screenshots, input.capture_logs],
                start_to_close_timeout=timedelta(minutes=10),
                retry_policy=RetryPolicy(
                    initial_interval=timedelta(seconds=10),
                    maximum_attempts=2
                )
            )

            self._test_results = test_result

            # Step 2: Capture artifacts
            if test_result["failed"] > 0:
                workflow.logger.info("Tests failed, capturing artifacts...")

                artifacts = await workflow.execute_activity(
                    capture_test_artifacts,
                    args=[test_result],
                    start_to_close_timeout=timedelta(minutes=2)
                )

                test_result["artifacts"] = artifacts

                # Step 3: Analyze failures with AI
                workflow.logger.info("Analyzing test failures with AI...")

                analysis = await workflow.execute_activity(
                    analyze_test_results,
                    args=[test_result, artifacts],
                    start_to_close_timeout=timedelta(minutes=5),
                    retry_policy=RetryPolicy(
                        initial_interval=timedelta(seconds=5),
                        maximum_attempts=2
                    )
                )

                test_result["analysis"] = analysis

                # Step 4: Auto-fix if enabled
                if input.auto_fix_on_failure and self._retry_count < input.max_retry_attempts:
                    workflow.logger.info("Attempting to apply AI-generated fixes...")

                    fix_result = await workflow.execute_activity(
                        trigger_code_fixes,
                        args=[analysis],
                        start_to_close_timeout=timedelta(minutes=10)
                    )

                    if fix_result["applied"]:
                        self._fixed = True
                        self._retry_count += 1

                        # Wait for services to restart
                        await workflow.sleep(timedelta(seconds=30))

                        # Retry tests
                        continue
                    else:
                        workflow.logger.warning("Could not apply fixes automatically")
                        break
                else:
                    break

            else:
                # Tests passed!
                workflow.logger.info("All tests passed!")
                break

        # Step 5: Send notifications
        if input.notify_on_completion:
            await workflow.execute_activity(
                send_test_notification,
                args=[test_result, self._fixed],
                start_to_close_timeout=timedelta(minutes=1)
            )

        # Return final result
        return TestResult(
            success=test_result["failed"] == 0,
            total_tests=test_result["total_tests"],
            passed=test_result["passed"],
            failed=test_result["failed"],
            errors=test_result.get("errors", []),
            artifacts=test_result.get("artifacts", {}),
            execution_time=test_result.get("execution_time", 0.0)
        )


@workflow.defn
class ScheduledTestWorkflow:
    """
    Scheduled Test Workflow

    Runs tests on a schedule (e.g., every hour, daily, on commit)
    """

    @workflow.run
    async def run(self, schedule: str) -> Dict[str, Any]:
        """Run tests on schedule"""

        workflow.logger.info(f"Running scheduled tests: {schedule}")

        # Run catalog API tests
        catalog_result = await workflow.execute_child_workflow(
            TestAutomationWorkflow.run,
            TestAutomationInput(
                test_suite="catalog-api",
                auto_fix_on_failure=True,
                notify_on_completion=False
            ),
            id=f"test-catalog-{workflow.now().isoformat()}"
        )

        # Run dashboard UI tests
        dashboard_result = await workflow.execute_child_workflow(
            TestAutomationWorkflow.run,
            TestAutomationInput(
                test_suite="dashboard-ui",
                auto_fix_on_failure=True,
                notify_on_completion=False,
                capture_screenshots=True
            ),
            id=f"test-dashboard-{workflow.now().isoformat()}"
        )

        # Aggregate results
        total_passed = catalog_result.passed + dashboard_result.passed
        total_failed = catalog_result.failed + dashboard_result.failed

        # Send summary notification
        await workflow.execute_activity(
            send_test_notification,
            args=[{
                "schedule": schedule,
                "catalog": catalog_result,
                "dashboard": dashboard_result,
                "total_passed": total_passed,
                "total_failed": total_failed
            }, False],
            start_to_close_timeout=timedelta(minutes=1)
        )

        return {
            "schedule": schedule,
            "success": total_failed == 0,
            "catalog_result": catalog_result,
            "dashboard_result": dashboard_result
        }


@workflow.defn
class RegressionTestWorkflow:
    """
    Regression Test Workflow

    Runs comprehensive regression tests across all features
    """

    @workflow.run
    async def run(self, commit_sha: Optional[str] = None) -> Dict[str, Any]:
        """Run full regression test suite"""

        workflow.logger.info(f"Running regression tests for commit: {commit_sha}")

        # Run all test suites in parallel
        results = await workflow.execute_activity(
            run_selenium_tests,
            args=["full", True, True],
            start_to_close_timeout=timedelta(minutes=30)
        )

        # Analyze results
        analysis = None
        if results["failed"] > 0:
            artifacts = await workflow.execute_activity(
                capture_test_artifacts,
                args=[results],
                start_to_close_timeout=timedelta(minutes=5)
            )

            analysis = await workflow.execute_activity(
                analyze_test_results,
                args=[results, artifacts],
                start_to_close_timeout=timedelta(minutes=10)
            )

        # Send detailed report
        await workflow.execute_activity(
            send_test_notification,
            args=[{
                "type": "regression",
                "commit_sha": commit_sha,
                "results": results,
                "analysis": analysis
            }, False],
            start_to_close_timeout=timedelta(minutes=2)
        )

        return {
            "success": results["failed"] == 0,
            "results": results,
            "analysis": analysis,
            "commit_sha": commit_sha
        }
