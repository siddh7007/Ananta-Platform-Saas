"""
AI Test Generation API

Allows users to ask AI to generate tests for specific functionality,
then automatically runs those tests to verify the code.

Endpoints:
- POST /api/ai-dev/generate-test - Generate test from description
- POST /api/ai-dev/generate-and-run - Generate test and run it immediately
"""

import logging
import os
import requests
from datetime import datetime

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

# Import structured logging
from catalog.logging_config import get_logger

logger = get_logger(__name__)


@csrf_exempt
@require_http_methods(["POST"])
def generate_test(request):
    """
    Generate test code from natural language description

    Request body:
    {
        "description": "Test that user login works with valid credentials",
        "file_path": "tests/test_auth.py",  // Optional - where to save test
        "test_type": "unit",  // Optional: unit, integration, e2e
        "framework": "pytest"  // Optional: pytest, unittest
    }

    Response:
    {
        "success": true,
        "test_code": "def test_user_login():\n    ...",
        "file_path": "tests/test_auth.py",
        "suggestions": ["Import requests library", "Add fixtures"],
        "explanation": "This test verifies..."
    }
    """

    try:
        import json
        data = json.loads(request.body)

        description = data.get('description', '')
        file_path = data.get('file_path', 'tests/test_generated.py')
        test_type = data.get('test_type', 'unit')
        framework = data.get('framework', 'pytest')
        service = data.get('service', 'backend')

        if not description:
            return JsonResponse({
                "success": False,
                "error": "Description is required"
            }, status=400)

        logger.info(f"Generating test: {description}")

        # Call AI service to generate test
        ai_url = os.getenv('LANGFLOW_API_URL', 'http://localhost:8765/analyze')

        # Build prompt for test generation
        test_gen_prompt = f"""Generate a {test_type} test using {framework} framework.

Description: {description}

Requirements:
1. Use {framework} best practices
2. Include clear assertions
3. Add docstrings explaining what's being tested
4. Include any necessary fixtures or setup
5. Make it a complete, runnable test

Return ONLY valid JSON in this format:
{{
  "test_code": "# Complete test code here",
  "imports": ["import pytest", "from myapp import User"],
  "explanation": "This test verifies...",
  "suggestions": ["Add edge case tests", "Mock external APIs"]
}}
"""

        response = requests.post(
            ai_url.replace('/analyze', '/generate-test'),
            json={
                "prompt": test_gen_prompt,
                "description": description,
                "test_type": test_type,
                "framework": framework,
                "service": service
            },
            timeout=120
        )

        if response.status_code == 200:
            result = response.json()

            return JsonResponse({
                "success": True,
                "test_code": result.get('test_code', ''),
                "file_path": file_path,
                "imports": result.get('imports', []),
                "explanation": result.get('explanation', ''),
                "suggestions": result.get('suggestions', []),
                "ai_metadata": result.get('metadata', {})
            })
        else:
            # Fallback: use analyze endpoint with custom prompt
            response = requests.post(
                ai_url,
                json={
                    "service": service,
                    "test_results": {},
                    "code_context": {},
                    "instructions": test_gen_prompt
                },
                timeout=120
            )

            if response.status_code == 200:
                result = response.json()

                # Extract test code from AI response
                analysis = result.get('analysis', '')

                return JsonResponse({
                    "success": True,
                    "test_code": analysis,
                    "file_path": file_path,
                    "explanation": "Generated using AI analysis endpoint",
                    "ai_metadata": result.get('metadata', {})
                })
            else:
                raise Exception(f"AI service error: {response.status_code}")

    except Exception as e:
        logger.error(f"Test generation failed: {e}", exc_info=True)
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def generate_and_run_test(request):
    """
    Generate test from description AND run it immediately

    Request body:
    {
        "description": "Test that API returns 404 for invalid user ID",
        "service": "backend",
        "auto_fix": true,  // Optional - if test fails, trigger AI to fix it
        "save_test": true  // Optional - save generated test to file
    }

    Response:
    {
        "success": true,
        "test_generated": {...},
        "test_results": {
            "passed": true/false,
            "output": "test output",
            "duration": 1.5
        },
        "fix_workflow_id": "..." // If auto_fix=true and test failed
    }
    """

    try:
        import json
        import subprocess
        import tempfile

        data = json.loads(request.body)

        description = data.get('description', '')
        service = data.get('service', 'backend')
        auto_fix = data.get('auto_fix', False)
        save_test = data.get('save_test', True)

        if not description:
            return JsonResponse({
                "success": False,
                "error": "Description is required"
            }, status=400)

        logger.info(f"Generate and run test: {description}")

        # Step 1: Generate test
        gen_response = generate_test(request)
        gen_data = json.loads(gen_response.content)

        if not gen_data.get('success'):
            return JsonResponse({
                "success": False,
                "error": "Failed to generate test",
                "details": gen_data
            }, status=500)

        test_code = gen_data.get('test_code', '')
        file_path = gen_data.get('file_path', 'tests/test_generated.py')

        # Step 2: Save test to temporary file (or permanent if save_test=True)
        if save_test:
            # Save to actual test directory
            full_path = os.path.join('/app', file_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)

            with open(full_path, 'w') as f:
                f.write(test_code)

            test_file = full_path
            logger.info(f"Saved test to: {test_file}")
        else:
            # Save to temp file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                f.write(test_code)
                test_file = f.name

            logger.info(f"Saved test to temp file: {test_file}")

        # Step 3: Run the test
        start_time = datetime.now()

        try:
            result = subprocess.run(
                ['pytest', test_file, '-v', '--tb=short'],
                capture_output=True,
                text=True,
                timeout=60,
                cwd='/app'
            )

            duration = (datetime.now() - start_time).total_seconds()

            test_passed = result.returncode == 0

            test_results = {
                "passed": test_passed,
                "exit_code": result.returncode,
                "output": result.stdout,
                "errors": result.stderr,
                "duration": duration
            }

            logger.info(f"Test execution: {'PASSED' if test_passed else 'FAILED'} ({duration:.2f}s)")

            # Step 4: If test failed and auto_fix enabled, trigger fix workflow
            fix_workflow_id = None

            if not test_passed and auto_fix:
                # Trigger AI development workflow to fix the failing test
                from temporalio.client import Client
                from temporal_worker.workflows import AIDevCycleWorkflow

                temporal_client = Client(
                    target_url=os.getenv('TEMPORAL_HOST', 'temporal:7233')
                )

                workflow_id = f"ai-dev-{service}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

                handle = temporal_client.start_workflow(
                    AIDevCycleWorkflow.run,
                    args=[{
                        "service": service,
                        "description": f"Fix failing test: {description}",
                        "max_iterations": 3,
                        "require_approval": False
                    }],
                    id=workflow_id,
                    task_queue="ai-dev-cycle"
                )

                fix_workflow_id = workflow_id

                logger.info(f"Started fix workflow: {fix_workflow_id}")

            # Clean up temp file if not saved
            if not save_test:
                os.unlink(test_file)

            return JsonResponse({
                "success": True,
                "test_generated": gen_data,
                "test_results": test_results,
                "test_file": file_path if save_test else "temp_file",
                "fix_workflow_id": fix_workflow_id,
                "auto_fix_triggered": fix_workflow_id is not None
            })

        except subprocess.TimeoutExpired:
            return JsonResponse({
                "success": False,
                "error": "Test execution timeout (60s)"
            }, status=500)

    except Exception as e:
        logger.error(f"Generate and run test failed: {e}", exc_info=True)
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def test_generation_examples(request):
    """
    Return example prompts for test generation
    """

    examples = [
        {
            "category": "API Testing",
            "examples": [
                "Test that GET /api/users returns 200 with list of users",
                "Test that POST /api/users creates a new user with valid data",
                "Test that API returns 401 for unauthenticated requests",
                "Test that API validates email format in user registration"
            ]
        },
        {
            "category": "Unit Testing",
            "examples": [
                "Test that calculate_total() sums prices correctly",
                "Test that password_hash() generates secure hashes",
                "Test that parse_date() handles invalid dates gracefully",
                "Test that email validator rejects invalid emails"
            ]
        },
        {
            "category": "Integration Testing",
            "examples": [
                "Test that user can login, create post, and logout",
                "Test that payment flow works end-to-end",
                "Test that file upload and download works",
                "Test that database transaction rollback works"
            ]
        },
        {
            "category": "Edge Cases",
            "examples": [
                "Test that division by zero is handled",
                "Test that empty input returns appropriate error",
                "Test that very long strings are truncated",
                "Test that concurrent requests don't cause race conditions"
            ]
        }
    ]

    return JsonResponse({
        "examples": examples,
        "usage": {
            "generate_only": "POST /api/ai-dev/generate-test",
            "generate_and_run": "POST /api/ai-dev/generate-and-run",
            "with_auto_fix": "Add 'auto_fix': true to request body"
        }
    })
