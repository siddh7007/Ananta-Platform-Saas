"""
Temporal Activities for AI-Driven Test Automation
==================================================

Activities that execute test automation tasks.
"""

import json
import subprocess
import time
import os
from pathlib import Path
from typing import Dict, List, Any
from temporalio import activity


@activity.defn
async def run_selenium_tests(
    test_suite: str,
    capture_screenshots: bool = True,
    capture_logs: bool = True
) -> Dict[str, Any]:
    """
    Run Selenium tests using test_closeloop_catalog_api.py

    Args:
        test_suite: Test suite to run ("catalog-api", "dashboard-ui", "full")
        capture_screenshots: Whether to capture screenshots
        capture_logs: Whether to capture console logs

    Returns:
        Test results dictionary
    """
    activity.logger.info(f"Running test suite: {test_suite}")

    # Path to test script
    test_script = Path("/app/test_closeloop_catalog_api.py")
    if not test_script.exists():
        test_script = Path("C:/components-platform/components-platform-v2/test_closeloop_catalog_api.py")

    try:
        # Run test script
        start_time = time.time()

        result = subprocess.run(
            ["python", str(test_script)],
            capture_output=True,
            text=True,
            timeout=600,  # 10 minute timeout
            cwd=test_script.parent
        )

        execution_time = time.time() - start_time

        # Parse output
        output = result.stdout

        # Extract test results from report file
        report_files = list(test_script.parent.glob("test_report_*.json"))
        if report_files:
            latest_report = max(report_files, key=lambda p: p.stat().st_mtime)
            with open(latest_report, 'r') as f:
                test_results = json.load(f)

            test_results["execution_time"] = execution_time
            test_results["stdout"] = output[:1000]  # First 1000 chars
            test_results["stderr"] = result.stderr[:1000]

            activity.logger.info(
                f"Tests completed: {test_results['passed']}/{test_results['total_tests']} passed"
            )

            return test_results
        else:
            # No report file, parse from stdout
            activity.logger.warning("No test report found, tests may have failed to run")
            return {
                "total_tests": 0,
                "passed": 0,
                "failed": 0,
                "errors": ["Test report file not found"],
                "stdout": output,
                "stderr": result.stderr,
                "execution_time": execution_time
            }

    except subprocess.TimeoutExpired:
        activity.logger.error("Test execution timed out")
        return {
            "total_tests": 0,
            "passed": 0,
            "failed": 1,
            "errors": ["Test execution timed out after 10 minutes"],
            "execution_time": 600
        }
    except Exception as e:
        activity.logger.error(f"Test execution failed: {e}")
        return {
            "total_tests": 0,
            "passed": 0,
            "failed": 1,
            "errors": [str(e)],
            "execution_time": 0
        }


@activity.defn
async def capture_test_artifacts(test_results: Dict[str, Any]) -> Dict[str, Any]:
    """
    Capture test artifacts (screenshots, logs, etc.)

    Args:
        test_results: Test results from run_selenium_tests

    Returns:
        Dictionary of captured artifacts
    """
    activity.logger.info("Capturing test artifacts...")

    artifacts = {
        "screenshots": [],
        "logs": [],
        "console_logs": [],
        "report_file": None
    }

    try:
        # Find screenshots in /tmp or test directory
        screenshot_paths = [
            Path("/tmp"),
            Path("C:/temp"),
            Path("C:/components-platform/components-platform-v2")
        ]

        for base_path in screenshot_paths:
            if base_path.exists():
                screenshots = list(base_path.glob("dashboard_*.png"))
                artifacts["screenshots"].extend([str(s) for s in screenshots[:10]])  # Max 10

        # Get console logs from test results
        if "console_logs" in test_results.get("test_suites", {}).get("dashboard_ui", {}):
            console_logs = test_results["test_suites"]["dashboard_ui"]["console_logs"]
            artifacts["console_logs"] = console_logs[:50]  # Max 50 logs

        # Find latest test report
        test_dir = Path("C:/components-platform/components-platform-v2")
        report_files = list(test_dir.glob("test_report_*.json"))
        if report_files:
            latest_report = max(report_files, key=lambda p: p.stat().st_mtime)
            artifacts["report_file"] = str(latest_report)

        activity.logger.info(
            f"Captured {len(artifacts['screenshots'])} screenshots, "
            f"{len(artifacts['console_logs'])} console logs"
        )

        return artifacts

    except Exception as e:
        activity.logger.error(f"Failed to capture artifacts: {e}")
        return artifacts


@activity.defn
async def analyze_test_results(
    test_results: Dict[str, Any],
    artifacts: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Analyze test failures with AI

    This would integrate with:
    - Open WebUI (Ollama)
    - Langflow
    - Or external AI API

    Args:
        test_results: Test results
        artifacts: Captured artifacts

    Returns:
        Analysis results with suggested fixes
    """
    activity.logger.info("Analyzing test failures with AI...")

    try:
        # Prepare context for AI
        context = {
            "failed_tests": test_results.get("failed", 0),
            "total_tests": test_results.get("total_tests", 0),
            "errors": test_results.get("errors", []),
            "console_logs": artifacts.get("console_logs", [])[:10],  # First 10 logs
            "screenshots": len(artifacts.get("screenshots", []))
        }

        # TODO: Integrate with Open WebUI or Langflow
        # For now, return basic analysis

        analysis = {
            "root_cause": "To be determined",
            "suggested_fixes": [],
            "confidence": 0.0,
            "requires_manual_review": True
        }

        # Basic error pattern matching
        errors = test_results.get("errors", [])

        for error in errors:
            if "connection refused" in error.lower():
                analysis["root_cause"] = "Service not accessible"
                analysis["suggested_fixes"].append({
                    "type": "restart_service",
                    "service": "backend",
                    "command": "docker restart components-v2-backend"
                })
                analysis["confidence"] = 0.7

            elif "tenant context required" in error.lower():
                analysis["root_cause"] = "API endpoint requires tenant context"
                analysis["suggested_fixes"].append({
                    "type": "code_change",
                    "file": "backend/catalog/catalog_api.py",
                    "description": "Add @bypass_tenant_check decorator to public endpoints"
                })
                analysis["confidence"] = 0.8

            elif "timeout" in error.lower():
                analysis["root_cause"] = "Operation timed out"
                analysis["suggested_fixes"].append({
                    "type": "configuration",
                    "description": "Increase timeout values"
                })
                analysis["confidence"] = 0.6

        activity.logger.info(f"Analysis complete: {analysis['root_cause']}")

        return analysis

    except Exception as e:
        activity.logger.error(f"AI analysis failed: {e}")
        return {
            "root_cause": "Analysis failed",
            "suggested_fixes": [],
            "confidence": 0.0,
            "requires_manual_review": True,
            "error": str(e)
        }


@activity.defn
async def trigger_code_fixes(analysis: Dict[str, Any]) -> Dict[str, bool]:
    """
    Apply code fixes based on AI analysis

    Args:
        analysis: Analysis results from analyze_test_results

    Returns:
        Whether fixes were applied
    """
    activity.logger.info("Attempting to apply code fixes...")

    applied = False

    try:
        suggested_fixes = analysis.get("suggested_fixes", [])

        for fix in suggested_fixes:
            fix_type = fix.get("type")

            if fix_type == "restart_service":
                service = fix.get("service")
                command = fix.get("command")

                activity.logger.info(f"Restarting service: {service}")

                result = subprocess.run(
                    command.split(),
                    capture_output=True,
                    text=True,
                    timeout=60
                )

                if result.returncode == 0:
                    activity.logger.info(f"Service {service} restarted successfully")
                    applied = True
                else:
                    activity.logger.warning(f"Failed to restart {service}: {result.stderr}")

            elif fix_type == "code_change":
                # For code changes, we would need to:
                # 1. Generate the fix using AI
                # 2. Apply the fix
                # 3. Test the fix
                # 4. Commit if successful

                activity.logger.info("Code change fixes require manual approval")
                # Don't auto-apply code changes for safety

            elif fix_type == "configuration":
                activity.logger.info("Configuration fixes require manual review")

        return {"applied": applied, "fixes_count": len(suggested_fixes)}

    except Exception as e:
        activity.logger.error(f"Failed to apply fixes: {e}")
        return {"applied": False, "error": str(e)}


@activity.defn
async def send_test_notification(
    test_results: Dict[str, Any],
    was_fixed: bool
) -> None:
    """
    Send test notification via n8n or direct channels

    Args:
        test_results: Test results
        was_fixed: Whether issues were auto-fixed
    """
    activity.logger.info("Sending test notification...")

    try:
        # Prepare notification message
        passed = test_results.get("passed", 0)
        failed = test_results.get("failed", 0)
        total = test_results.get("total_tests", 0)

        success_rate = (passed / total * 100) if total > 0 else 0

        message = f"""
🧪 Test Run Complete

✅ Passed: {passed}/{total}
❌ Failed: {failed}/{total}
📈 Success Rate: {success_rate:.1f}%

{'🔧 Auto-fixed and retested: ✅' if was_fixed else ''}

View full report: http://localhost:27021
        """.strip()

        activity.logger.info(message)

        # TODO: Send via n8n webhook or other notification channels
        # For now, just log

        # Could trigger n8n workflow:
        # POST http://localhost:27061/webhook/test-notification
        # with test_results payload

    except Exception as e:
        activity.logger.error(f"Failed to send notification: {e}")
