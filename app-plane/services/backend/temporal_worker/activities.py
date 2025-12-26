"""
Temporal Activities for AI Development Cycle

Activities are the building blocks of Temporal workflows.
Each activity performs a specific task like running tests, calling Langflow, etc.

Uses structured logging and comprehensive error handling for production visibility.
"""

import asyncio
import json
import logging
import os
import subprocess
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Any, Optional

import requests
from temporalio import activity

# Import structured logging
from catalog.logging_config import get_logger

logger = get_logger(__name__)


# ============================================================================
# Data Classes for Activity Inputs/Outputs
# ============================================================================

@dataclass
class TestResult:
    """Result from running tests"""
    success: bool
    total_tests: int
    passed: int
    failed: int
    errors: List[Dict[str, Any]]
    output: str
    duration_seconds: float


@dataclass
class AIAnalysisResult:
    """Result from AI analysis via Langflow"""
    success: bool
    suggestions: List[Dict[str, Any]]
    confidence_score: float
    analysis: str
    raw_response: Dict[str, Any]


@dataclass
class CodeFix:
    """A single code fix to apply"""
    file_path: str
    old_code: str
    new_code: str
    line_start: int
    line_end: int
    description: str


@dataclass
class ApplyFixesResult:
    """Result from applying code fixes"""
    success: bool
    applied: int
    failed: int
    results: List[Dict[str, Any]]


# ============================================================================
# Activity: Run Tests
# ============================================================================

@activity.defn
async def run_tests(service: str) -> TestResult:
    """
    Run tests for the specified service (backend, dashboard, frontend)

    Args:
        service: Service name (backend, dashboard, frontend)

    Returns:
        TestResult with test execution details
    """
    activity.logger.info(f"Running tests for service: {service}")

    start_time = datetime.now()

    try:
        # Determine test command based on service
        if service == "backend":
            cmd = ["pytest", ".", "-v", "--tb=short", "--json-report", "--json-report-file=/tmp/test_results.json"]
            cwd = "/app"
        elif service == "dashboard":
            cmd = ["npm", "run", "test", "--", "--json", "--outputFile=/tmp/test_results.json"]
            cwd = "/app"
        elif service == "frontend":
            cmd = ["npm", "run", "test", "--", "--json", "--outputFile=/tmp/test_results.json"]
            cwd = "/app"
        else:
            raise ValueError(f"Unknown service: {service}")

        # Run tests
        activity.logger.info(f"Executing command: {' '.join(cmd)}")
        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await process.communicate()
        duration = (datetime.now() - start_time).total_seconds()

        output = stdout.decode() + "\n" + stderr.decode()

        # Parse test results
        try:
            with open("/tmp/test_results.json", "r") as f:
                results = json.load(f)
        except Exception as e:
            logger.warning("Could not parse test results JSON", exc_info=True, extra={
                'service': service,
                'error_type': type(e).__name__
            })
            results = {}

        # Extract test metrics
        total = results.get("numTotalTests", 0) or results.get("total", 0)
        passed = results.get("numPassedTests", 0) or results.get("passed", 0)
        failed = results.get("numFailedTests", 0) or results.get("failed", 0)

        # Extract error details
        errors = []
        for test in results.get("testResults", []):
            if test.get("status") == "failed":
                errors.append({
                    "name": test.get("name", "unknown"),
                    "message": test.get("message", ""),
                    "file": test.get("file", ""),
                    "line": test.get("line", 0)
                })

        success = process.returncode == 0 and failed == 0

        activity.logger.info(
            f"Tests completed: {passed}/{total} passed, {failed} failed, "
            f"duration: {duration:.2f}s"
        )

        return TestResult(
            success=success,
            total_tests=total,
            passed=passed,
            failed=failed,
            errors=errors,
            output=output,
            duration_seconds=duration
        )

    except Exception as e:
        activity.logger.error(f"Test execution failed: {e}", exc_info=True)
        duration = (datetime.now() - start_time).total_seconds()

        return TestResult(
            success=False,
            total_tests=0,
            passed=0,
            failed=0,
            errors=[{"message": str(e), "type": "execution_error"}],
            output=str(e),
            duration_seconds=duration
        )


# ============================================================================
# Activity: Call Langflow AI Analysis
# ============================================================================

@activity.defn
async def analyze_failures_with_ai(
    service: str,
    test_result: TestResult,
    code_context: Optional[Dict[str, str]] = None
) -> AIAnalysisResult:
    """
    Call Langflow to analyze test failures and generate fix suggestions

    Args:
        service: Service name
        test_result: Test results to analyze
        code_context: Optional dictionary of {file_path: code_content}

    Returns:
        AIAnalysisResult with AI-generated suggestions
    """
    activity.logger.info(f"Analyzing failures for {service} with AI")

    try:
        # Get Langflow endpoint from environment
        langflow_url = os.getenv(
            "LANGFLOW_API_URL",
            "http://langflow:7860/api/v1/run/ai-code-analyzer"
        )

        # Prepare input for Langflow
        input_data = {
            "service": service,
            "test_results": {
                "total": test_result.total_tests,
                "passed": test_result.passed,
                "failed": test_result.failed,
                "errors": test_result.errors[:10],  # Limit to first 10 errors
                "output": test_result.output[:5000]  # Limit output size
            },
            "code_context": code_context or {},
            "instructions": (
                "Analyze the test failures and generate specific code fixes. "
                "For each failure, provide:\n"
                "1. Root cause analysis\n"
                "2. Specific file path and line numbers\n"
                "3. Old code (what to replace)\n"
                "4. New code (replacement)\n"
                "5. Explanation of the fix\n\n"
                "Return structured JSON with fixes array."
            )
        }

        activity.logger.info(f"Calling Langflow at {langflow_url}")

        # Call Langflow API
        response = requests.post(
            langflow_url,
            json=input_data,
            timeout=300  # 5 minute timeout for AI analysis
        )
        response.raise_for_status()

        result = response.json()

        # Parse AI response
        # Expected format: { "suggestions": [...], "analysis": "...", "confidence": 0.85 }
        suggestions = result.get("suggestions", [])
        analysis = result.get("analysis", "")
        confidence = result.get("confidence", 0.0)

        activity.logger.info(
            f"AI analysis complete: {len(suggestions)} suggestions, "
            f"confidence: {confidence}"
        )

        return AIAnalysisResult(
            success=True,
            suggestions=suggestions,
            confidence_score=confidence,
            analysis=analysis,
            raw_response=result
        )

    except requests.exceptions.RequestException as e:
        activity.logger.error(f"Langflow API call failed: {e}", exc_info=True)
        return AIAnalysisResult(
            success=False,
            suggestions=[],
            confidence_score=0.0,
            analysis=f"AI analysis failed: {e}",
            raw_response={"error": str(e)}
        )
    except Exception as e:
        activity.logger.error(f"AI analysis failed: {e}", exc_info=True)
        return AIAnalysisResult(
            success=False,
            suggestions=[],
            confidence_score=0.0,
            analysis=f"Error: {e}",
            raw_response={"error": str(e)}
        )


# ============================================================================
# Activity: Apply Code Fixes
# ============================================================================

@activity.defn
async def apply_code_fixes(fixes: List[CodeFix]) -> ApplyFixesResult:
    """
    Apply AI-generated code fixes to the filesystem

    Args:
        fixes: List of CodeFix objects to apply

    Returns:
        ApplyFixesResult with details about applied/failed fixes
    """
    activity.logger.info(f"Applying {len(fixes)} code fixes")

    applied = 0
    failed = 0
    results = []

    for fix in fixes:
        try:
            file_path = fix.file_path

            # Validate file path (security check)
            if ".." in file_path or file_path.startswith("/"):
                raise ValueError(f"Invalid file path: {file_path}")

            full_path = os.path.join("/app", file_path)

            # Check if file exists
            if not os.path.exists(full_path):
                raise FileNotFoundError(f"File not found: {file_path}")

            # Read current content
            with open(full_path, "r") as f:
                content = f.read()

            # Apply fix (simple string replacement)
            # For production, use proper AST parsing/modification
            if fix.old_code not in content:
                activity.logger.warning(
                    f"Old code not found in {file_path}. "
                    f"File may have changed since analysis."
                )
                results.append({
                    "file_path": file_path,
                    "status": "skipped",
                    "message": "Old code not found in file"
                })
                failed += 1
                continue

            new_content = content.replace(fix.old_code, fix.new_code, 1)

            # Write updated content
            with open(full_path, "w") as f:
                f.write(new_content)

            activity.logger.info(f"Applied fix to {file_path}")
            results.append({
                "file_path": file_path,
                "status": "applied",
                "message": fix.description
            })
            applied += 1

        except Exception as e:
            activity.logger.error(f"Failed to apply fix to {fix.file_path}: {e}")
            results.append({
                "file_path": fix.file_path,
                "status": "failed",
                "message": str(e)
            })
            failed += 1

    activity.logger.info(f"Fixes applied: {applied} success, {failed} failed")

    return ApplyFixesResult(
        success=failed == 0,
        applied=applied,
        failed=failed,
        results=results
    )


# ============================================================================
# Activity: Rebuild Service Container
# ============================================================================

@activity.defn
async def rebuild_service_container(service: str) -> Dict[str, Any]:
    """
    Rebuild and restart the service container after applying code fixes

    Args:
        service: Service name (backend, dashboard, frontend)

    Returns:
        Dict with rebuild status
    """
    activity.logger.info(f"Rebuilding service container: {service}")

    try:
        # Map service name to docker-compose service name
        service_map = {
            "backend": "backend",
            "dashboard": "dashboard",
            "frontend": "frontend"
        }

        compose_service = service_map.get(service)
        if not compose_service:
            raise ValueError(f"Unknown service: {service}")

        # Restart the container (code is mounted as volume, no rebuild needed)
        cmd = ["docker-compose", "restart", compose_service]

        activity.logger.info(f"Executing: {' '.join(cmd)}")
        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd="/app",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            raise RuntimeError(
                f"Container restart failed: {stderr.decode()}"
            )

        activity.logger.info(f"Service {service} restarted successfully")

        # Wait for service to be healthy
        await asyncio.sleep(10)  # Give service time to start

        return {
            "success": True,
            "service": service,
            "message": "Service restarted successfully"
        }

    except Exception as e:
        activity.logger.error(f"Service rebuild failed: {e}", exc_info=True)
        return {
            "success": False,
            "service": service,
            "message": str(e),
            "error": str(e)
        }


# ============================================================================
# Activity: Send Notification
# ============================================================================

@activity.defn
async def send_notification(
    workflow_id: str,
    event_type: str,
    data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Send notification via n8n webhook

    Args:
        workflow_id: Temporal workflow ID
        event_type: Event type (started, completed, failed, approval_needed)
        data: Event data

    Returns:
        Dict with notification status
    """
    activity.logger.info(f"Sending {event_type} notification for workflow {workflow_id}")

    try:
        # Get n8n webhook URL from environment
        n8n_url = os.getenv(
            "N8N_WEBHOOK_URL",
            "http://n8n:5678/webhook/ai-dev-cycle-notifications"
        )

        payload = {
            "workflow_id": workflow_id,
            "event_type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data
        }

        response = requests.post(n8n_url, json=payload, timeout=30)
        response.raise_for_status()

        activity.logger.info(f"Notification sent successfully")

        return {
            "success": True,
            "event_type": event_type,
            "response": response.json() if response.text else {}
        }

    except Exception as e:
        activity.logger.error(f"Notification failed: {e}")
        return {
            "success": False,
            "event_type": event_type,
            "error": str(e)
        }


# ============================================================================
# Activity: Get Code Context
# ============================================================================

@activity.defn
async def get_code_context(
    service: str,
    file_paths: List[str]
) -> Dict[str, str]:
    """
    Read code files to provide context for AI analysis

    Args:
        service: Service name
        file_paths: List of file paths to read

    Returns:
        Dict mapping file_path -> file_content
    """
    activity.logger.info(f"Getting code context for {len(file_paths)} files")

    code_context = {}

    for file_path in file_paths:
        try:
            # Security check
            if ".." in file_path or file_path.startswith("/"):
                activity.logger.warning(f"Skipping invalid path: {file_path}")
                continue

            full_path = os.path.join("/app", file_path)

            if os.path.exists(full_path) and os.path.isfile(full_path):
                with open(full_path, "r") as f:
                    code_context[file_path] = f.read()
            else:
                activity.logger.warning(f"File not found: {file_path}")

        except Exception as e:
            activity.logger.error(f"Error reading {file_path}: {e}")

    activity.logger.info(f"Retrieved {len(code_context)} files")
    return code_context
