"""
Temporal Workflows for AI Development Cycle

Workflows orchestrate the execution of activities and handle
the overall business logic for the closed-loop AI development cycle.
"""

import asyncio
from dataclasses import dataclass
from datetime import timedelta
from typing import Dict, Any, List, Optional

from temporalio import workflow
from temporalio.common import RetryPolicy

# Import activities (will be registered in worker)
with workflow.unsafe.imports_passed_through():
    from temporal_worker.activities import (
        run_tests,
        analyze_failures_with_ai,
        apply_code_fixes,
        rebuild_service_container,
        send_notification,
        get_code_context,
        TestResult,
        AIAnalysisResult,
        CodeFix,
        ApplyFixesResult,
    )


# ============================================================================
# Workflow Input/Output Data Classes
# ============================================================================

@dataclass
class AIDevCycleInput:
    """Input for AI Development Cycle workflow"""
    service: str  # backend, dashboard, frontend
    description: str  # Human description of the problem
    workflow_id: str  # Unique workflow ID
    max_iterations: int = 3  # Maximum number of fix-test cycles
    require_approval: bool = True  # Require human approval for fixes


@dataclass
class AIDevCycleOutput:
    """Output from AI Development Cycle workflow"""
    success: bool
    iterations: int
    final_test_result: Dict[str, Any]
    fixes_applied: int
    total_duration_seconds: float
    summary: str


# ============================================================================
# Main AI Development Cycle Workflow
# ============================================================================

@workflow.defn
class AIDevCycleWorkflow:
    """
    Closed-loop AI Development Cycle Workflow

    Steps:
    1. Run tests
    2. If tests fail, call Langflow for AI analysis
    3. Wait for human approval (if required)
    4. Apply code fixes
    5. Rebuild service
    6. Re-run tests
    7. Repeat until tests pass or max iterations reached
    8. Send notifications throughout
    """

    def __init__(self) -> None:
        self._iteration = 0
        self._fixes_applied = 0
        self._approval_received = False
        self._approved_suggestions: List[Dict[str, Any]] = []

    @workflow.run
    async def run(self, input: AIDevCycleInput) -> AIDevCycleOutput:
        """Main workflow execution"""

        workflow.logger.info(
            f"Starting AI Dev Cycle for {input.service}: {input.description}"
        )

        start_time = workflow.now()

        # Send start notification
        await workflow.execute_activity(
            send_notification,
            args=[
                input.workflow_id,
                "started",
                {
                    "service": input.service,
                    "description": input.description,
                }
            ],
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )

        final_test_result = None
        success = False

        # Iterative fix-test loop
        for iteration in range(1, input.max_iterations + 1):
            self._iteration = iteration

            workflow.logger.info(f"Iteration {iteration}/{input.max_iterations}")

            # Step 1: Run tests
            test_result = await self._run_tests_step(input.service)

            # Store final test result
            final_test_result = {
                "iteration": iteration,
                "total_tests": test_result.total_tests,
                "passed": test_result.passed,
                "failed": test_result.failed,
                "duration_seconds": test_result.duration_seconds
            }

            # Check if tests passed
            if test_result.success:
                workflow.logger.info("Tests passed! Workflow complete.")
                success = True

                # Send success notification
                await workflow.execute_activity(
                    send_notification,
                    args=[
                        input.workflow_id,
                        "completed",
                        {
                            "iterations": iteration,
                            "fixes_applied": self._fixes_applied,
                            "test_result": final_test_result
                        }
                    ],
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=3)
                )

                break

            # Step 2: Get code context for failed tests
            code_context = await self._get_code_context_step(
                input.service,
                test_result
            )

            # Step 3: Analyze failures with AI
            ai_analysis = await self._ai_analysis_step(
                input.service,
                test_result,
                code_context
            )

            if not ai_analysis.success or not ai_analysis.suggestions:
                workflow.logger.warning("AI analysis failed or no suggestions")

                # Send failure notification
                await workflow.execute_activity(
                    send_notification,
                    args=[
                        input.workflow_id,
                        "failed",
                        {
                            "reason": "AI analysis failed",
                            "iteration": iteration
                        }
                    ],
                    start_to_close_timeout=timedelta(seconds=30)
                )

                break

            # Step 4: Wait for human approval (if required)
            if input.require_approval:
                approved_suggestions = await self._wait_for_approval_step(
                    input.workflow_id,
                    ai_analysis.suggestions
                )

                if not approved_suggestions:
                    workflow.logger.info("No suggestions approved, ending workflow")

                    # Send cancelled notification
                    await workflow.execute_activity(
                        send_notification,
                        args=[
                            input.workflow_id,
                            "cancelled",
                            {"reason": "No suggestions approved"}
                        ],
                        start_to_close_timeout=timedelta(seconds=30)
                    )

                    break
            else:
                approved_suggestions = ai_analysis.suggestions

            # Step 5: Apply code fixes
            fixes = self._convert_suggestions_to_fixes(approved_suggestions)
            apply_result = await self._apply_fixes_step(fixes)

            self._fixes_applied += apply_result.applied

            # Step 6: Rebuild service
            await self._rebuild_service_step(input.service)

            # Continue to next iteration for re-testing

        # Calculate total duration
        duration = (workflow.now() - start_time).total_seconds()

        # Generate summary
        summary = self._generate_summary(
            success,
            self._iteration,
            self._fixes_applied,
            final_test_result
        )

        workflow.logger.info(f"Workflow complete: {summary}")

        return AIDevCycleOutput(
            success=success,
            iterations=self._iteration,
            final_test_result=final_test_result or {},
            fixes_applied=self._fixes_applied,
            total_duration_seconds=duration,
            summary=summary
        )

    # ========================================================================
    # Workflow Steps (Private Methods)
    # ========================================================================

    async def _run_tests_step(self, service: str) -> TestResult:
        """Execute test running activity"""
        workflow.logger.info(f"Running tests for {service}")

        return await workflow.execute_activity(
            run_tests,
            args=[service],
            start_to_close_timeout=timedelta(minutes=10),
            retry_policy=RetryPolicy(
                maximum_attempts=2,
                initial_interval=timedelta(seconds=5)
            )
        )

    async def _get_code_context_step(
        self,
        service: str,
        test_result: TestResult
    ) -> Dict[str, str]:
        """Get code context for failed tests"""
        workflow.logger.info("Getting code context for failed tests")

        # Extract file paths from test errors
        file_paths = []
        for error in test_result.errors[:5]:  # Limit to first 5 errors
            if "file" in error and error["file"]:
                file_paths.append(error["file"])

        if not file_paths:
            return {}

        return await workflow.execute_activity(
            get_code_context,
            args=[service, file_paths],
            start_to_close_timeout=timedelta(seconds=60),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )

    async def _ai_analysis_step(
        self,
        service: str,
        test_result: TestResult,
        code_context: Dict[str, str]
    ) -> AIAnalysisResult:
        """Execute AI analysis activity"""
        workflow.logger.info("Analyzing failures with AI")

        return await workflow.execute_activity(
            analyze_failures_with_ai,
            args=[service, test_result, code_context],
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=RetryPolicy(
                maximum_attempts=2,
                initial_interval=timedelta(seconds=10)
            )
        )

    async def _wait_for_approval_step(
        self,
        workflow_id: str,
        suggestions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Wait for human approval of AI suggestions"""
        workflow.logger.info("Waiting for human approval")

        # Send approval needed notification
        await workflow.execute_activity(
            send_notification,
            args=[
                workflow_id,
                "approval_needed",
                {
                    "suggestions": suggestions,
                    "iteration": self._iteration
                }
            ],
            start_to_close_timeout=timedelta(seconds=30)
        )

        # Wait for approval signal (with 1 hour timeout)
        try:
            await workflow.wait_condition(
                lambda: self._approval_received,
                timeout=timedelta(hours=1)
            )

            workflow.logger.info(
                f"Approval received: {len(self._approved_suggestions)} suggestions"
            )
            return self._approved_suggestions

        except asyncio.TimeoutError:
            workflow.logger.warning("Approval timeout (1 hour)")
            return []

    async def _apply_fixes_step(self, fixes: List[CodeFix]) -> ApplyFixesResult:
        """Execute apply fixes activity"""
        workflow.logger.info(f"Applying {len(fixes)} code fixes")

        return await workflow.execute_activity(
            apply_code_fixes,
            args=[fixes],
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=1)  # Don't retry file operations
        )

    async def _rebuild_service_step(self, service: str) -> Dict[str, Any]:
        """Execute service rebuild activity"""
        workflow.logger.info(f"Rebuilding service: {service}")

        return await workflow.execute_activity(
            rebuild_service_container,
            args=[service],
            start_to_close_timeout=timedelta(minutes=3),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )

    # ========================================================================
    # Helper Methods
    # ========================================================================

    def _convert_suggestions_to_fixes(
        self,
        suggestions: List[Dict[str, Any]]
    ) -> List[CodeFix]:
        """Convert AI suggestions to CodeFix objects"""
        fixes = []

        for suggestion in suggestions:
            try:
                fix = CodeFix(
                    file_path=suggestion["file_path"],
                    old_code=suggestion["old_code"],
                    new_code=suggestion["new_code"],
                    line_start=suggestion.get("line_start", 0),
                    line_end=suggestion.get("line_end", 0),
                    description=suggestion.get("description", "AI-generated fix")
                )
                fixes.append(fix)
            except KeyError as e:
                workflow.logger.error(f"Invalid suggestion format: {e}")

        return fixes

    def _generate_summary(
        self,
        success: bool,
        iterations: int,
        fixes_applied: int,
        final_test_result: Optional[Dict[str, Any]]
    ) -> str:
        """Generate human-readable summary"""
        if success:
            return (
                f"✅ Tests passing after {iterations} iteration(s). "
                f"Applied {fixes_applied} fix(es)."
            )
        elif final_test_result:
            failed = final_test_result.get("failed", 0)
            total = final_test_result.get("total_tests", 0)
            return (
                f"❌ Tests still failing after {iterations} iteration(s). "
                f"{failed}/{total} tests failed. "
                f"Applied {fixes_applied} fix(es)."
            )
        else:
            return (
                f"❌ Workflow failed after {iterations} iteration(s). "
                f"Applied {fixes_applied} fix(es)."
            )

    # ========================================================================
    # Signals (for external control)
    # ========================================================================

    @workflow.signal
    async def approve_suggestions(self, suggestions: List[Dict[str, Any]]) -> None:
        """Signal to approve AI-generated suggestions"""
        workflow.logger.info(f"Received approval for {len(suggestions)} suggestions")
        self._approved_suggestions = suggestions
        self._approval_received = True

    @workflow.signal
    async def reject_suggestions(self) -> None:
        """Signal to reject all suggestions and end workflow"""
        workflow.logger.info("Received rejection of all suggestions")
        self._approved_suggestions = []
        self._approval_received = True

    # ========================================================================
    # Queries (for external status checks)
    # ========================================================================

    @workflow.query
    def get_status(self) -> Dict[str, Any]:
        """Query current workflow status"""
        return {
            "iteration": self._iteration,
            "fixes_applied": self._fixes_applied,
            "awaiting_approval": not self._approval_received,
        }
