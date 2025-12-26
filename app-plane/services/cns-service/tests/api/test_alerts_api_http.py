#!/usr/bin/env python3
"""
API-Level HTTP Tests for Alert System

This script tests the alert API endpoints via actual HTTP requests.
Run with: python tests/api/test_alerts_api_http.py

Requirements:
- CNS service must be running on localhost:27800
- Token is auto-generated using JWT_SECRET_KEY from environment
"""

import os
import sys

# Add parent directory to path for utils import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
import json
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from uuid import uuid4

# Import token generator
from utils.jwt_utils import generate_admin_token

# Base URL for the API
BASE_URL = "http://localhost:27800/api"

# Test results tracking
RESULTS = {
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "tests": []
}


def log_test(name: str, passed: bool, message: str = "", skipped: bool = False):
    """Log a test result."""
    if skipped:
        RESULTS["skipped"] += 1
        status = "SKIP"
    elif passed:
        RESULTS["passed"] += 1
        status = "PASS"
    else:
        RESULTS["failed"] += 1
        status = "FAIL"

    RESULTS["tests"].append({
        "name": name,
        "status": status,
        "message": message
    })

    print(f"[{status}] {name}")
    if message and not passed:
        print(f"       {message}")


def make_request(
    method: str,
    endpoint: str,
    token: Optional[str] = None,
    data: Optional[Dict] = None,
    params: Optional[Dict] = None
) -> Tuple[int, Any]:
    """Make an HTTP request to the API."""
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}

    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, params=params, timeout=10)
        elif method == "POST":
            resp = requests.post(url, headers=headers, json=data, timeout=10)
        elif method == "PUT":
            resp = requests.put(url, headers=headers, json=data, timeout=10)
        elif method == "DELETE":
            resp = requests.delete(url, headers=headers, timeout=10)
        else:
            return -1, {"error": f"Unknown method: {method}"}

        try:
            return resp.status_code, resp.json()
        except:
            return resp.status_code, resp.text
    except requests.exceptions.ConnectionError:
        return -1, {"error": "Connection refused - is the service running?"}
    except Exception as e:
        return -1, {"error": str(e)}


# =============================================================================
# HEALTH CHECK TESTS
# =============================================================================

def test_health_check():
    """Test that the service is healthy."""
    status, data = make_request("GET", "/../health")

    if status == 200:
        log_test("Health Check", True)
        return True
    else:
        log_test("Health Check", False, f"Status: {status}, Response: {data}")
        return False


# =============================================================================
# THRESHOLD OPTIONS TESTS (Public Endpoint - But requires auth via middleware)
# =============================================================================

def test_threshold_options_without_auth():
    """Test threshold-options endpoint without authentication."""
    status, data = make_request("GET", "/alerts/threshold-options")

    # Without auth, should get 401 or 403
    if status in [401, 403]:
        log_test("Threshold Options - No Auth (401/403 expected)", True)
        return True
    elif status == 200:
        # Some endpoints might be public
        log_test("Threshold Options - No Auth (Public)", True, "Endpoint is public")
        return True
    else:
        log_test("Threshold Options - No Auth", False, f"Status: {status}")
        return False


# =============================================================================
# ALERTS ENDPOINT TESTS
# =============================================================================

def test_alerts_list_without_auth():
    """Test alerts list endpoint without authentication."""
    status, data = make_request("GET", "/alerts")

    if status in [401, 403]:
        log_test("Alerts List - No Auth (401/403 expected)", True)
        return True
    else:
        log_test("Alerts List - No Auth", False, f"Status: {status}")
        return False


def test_alerts_unread_count_without_auth():
    """Test unread count endpoint without authentication."""
    status, data = make_request("GET", "/alerts/unread-count")

    if status in [401, 403]:
        log_test("Unread Count - No Auth (401/403 expected)", True)
        return True
    else:
        log_test("Unread Count - No Auth", False, f"Status: {status}")
        return False


def test_alerts_stats_without_auth():
    """Test stats endpoint without authentication."""
    status, data = make_request("GET", "/alerts/stats")

    if status in [401, 403]:
        log_test("Alert Stats - No Auth (401/403 expected)", True)
        return True
    else:
        log_test("Alert Stats - No Auth", False, f"Status: {status}")
        return False


# =============================================================================
# PREFERENCES ENDPOINT TESTS
# =============================================================================

def test_preferences_without_auth():
    """Test preferences endpoint without authentication."""
    status, data = make_request("GET", "/alerts/preferences")

    if status in [401, 403]:
        log_test("Preferences - No Auth (401/403 expected)", True)
        return True
    else:
        log_test("Preferences - No Auth", False, f"Status: {status}")
        return False


def test_preferences_with_thresholds_without_auth():
    """Test preferences with thresholds endpoint without authentication."""
    status, data = make_request("GET", "/alerts/preferences/with-thresholds")

    if status in [401, 403]:
        log_test("Preferences with Thresholds - No Auth (401/403 expected)", True)
        return True
    else:
        log_test("Preferences with Thresholds - No Auth", False, f"Status: {status}")
        return False


# =============================================================================
# WATCHES ENDPOINT TESTS
# =============================================================================

def test_watches_without_auth():
    """Test watches endpoint without authentication."""
    status, data = make_request("GET", "/alerts/watches")

    if status in [401, 403]:
        log_test("Watches - No Auth (401/403 expected)", True)
        return True
    else:
        log_test("Watches - No Auth", False, f"Status: {status}")
        return False


# =============================================================================
# ENDPOINT EXISTENCE TESTS
# =============================================================================

def test_endpoint_returns_not_404(endpoint: str, name: str):
    """Test that an endpoint exists (doesn't return 404)."""
    status, data = make_request("GET", endpoint)

    if status != 404:
        log_test(f"Endpoint Exists: {name}", True, f"Status: {status}")
        return True
    else:
        log_test(f"Endpoint Exists: {name}", False, "404 Not Found")
        return False


# =============================================================================
# AUTHENTICATED TESTS (with token)
# =============================================================================

def test_alerts_list_with_token(token: str):
    """Test alerts list endpoint with authentication."""
    status, data = make_request("GET", "/alerts", token=token)

    if status == 200:
        if isinstance(data, dict) and "items" in data:
            log_test("Alerts List - With Auth", True, f"Got {len(data.get('items', []))} alerts")
            return True
        else:
            log_test("Alerts List - With Auth", False, f"Invalid response format: {data}")
            return False
    else:
        log_test("Alerts List - With Auth", False, f"Status: {status}, Response: {data}")
        return False


def test_preferences_with_token(token: str):
    """Test preferences endpoint with authentication."""
    status, data = make_request("GET", "/alerts/preferences", token=token)

    if status == 200:
        if isinstance(data, list):
            log_test("Preferences - With Auth", True, f"Got {len(data)} preferences")
            return True
        else:
            log_test("Preferences - With Auth", False, f"Invalid response format")
            return False
    else:
        log_test("Preferences - With Auth", False, f"Status: {status}")
        return False


def test_preferences_with_thresholds_with_token(token: str):
    """Test preferences with thresholds endpoint with authentication."""
    status, data = make_request("GET", "/alerts/preferences/with-thresholds", token=token)

    if status == 200:
        if isinstance(data, list):
            # Check that each preference has threshold_options
            has_thresholds = all("threshold_options" in p for p in data)
            if has_thresholds:
                log_test("Preferences with Thresholds - With Auth", True, f"Got {len(data)} preferences with threshold options")
            else:
                log_test("Preferences with Thresholds - With Auth", False, "Missing threshold_options in response")
            return has_thresholds
        else:
            log_test("Preferences with Thresholds - With Auth", False, f"Invalid response format")
            return False
    else:
        log_test("Preferences with Thresholds - With Auth", False, f"Status: {status}")
        return False


def test_update_preference_thresholds_with_token(token: str):
    """Test updating preference thresholds."""
    data = {
        "threshold_config": {
            "risk_min": 70,
            "critical_threshold": 90
        }
    }

    status, resp = make_request("PUT", "/alerts/preferences/RISK/thresholds", token=token, data=data)

    if status == 200:
        log_test("Update RISK Thresholds - With Auth", True)
        return True
    else:
        log_test("Update RISK Thresholds - With Auth", False, f"Status: {status}, Response: {resp}")
        return False


def test_watches_with_token(token: str):
    """Test watches endpoint with authentication."""
    status, data = make_request("GET", "/alerts/watches", token=token)

    if status == 200:
        if isinstance(data, list):
            log_test("Watches - With Auth", True, f"Got {len(data)} watches")
            return True
        else:
            log_test("Watches - With Auth", False, f"Invalid response format")
            return False
    else:
        log_test("Watches - With Auth", False, f"Status: {status}")
        return False


def test_alert_stats_with_token(token: str):
    """Test alert stats endpoint with authentication."""
    status, data = make_request("GET", "/alerts/stats", token=token)

    if status == 200:
        required_fields = ["total_alerts", "unread_count", "by_type", "by_severity"]
        has_fields = all(f in data for f in required_fields)
        if has_fields:
            log_test("Alert Stats - With Auth", True)
            return True
        else:
            log_test("Alert Stats - With Auth", False, f"Missing required fields")
            return False
    else:
        log_test("Alert Stats - With Auth", False, f"Status: {status}")
        return False


# =============================================================================
# VALIDATION TESTS
# =============================================================================

def test_invalid_alert_type_threshold_update(token: str):
    """Test that invalid alert type is rejected."""
    data = {"threshold_config": {"test": 123}}

    status, resp = make_request("PUT", "/alerts/preferences/INVALID_TYPE/thresholds", token=token, data=data)

    if status == 400:
        log_test("Invalid Alert Type - Rejected (400)", True)
        return True
    else:
        log_test("Invalid Alert Type - Rejected", False, f"Expected 400, got {status}")
        return False


# =============================================================================
# MAIN TEST RUNNER
# =============================================================================

def run_tests(token: Optional[str] = None):
    """Run all API tests."""
    print("\n" + "=" * 60)
    print("ALERT API HTTP TESTS")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Token provided: {'Yes' if token else 'No'}")
    print("=" * 60 + "\n")

    # Health check first
    if not test_health_check():
        print("\n[ERROR] Service is not healthy. Aborting tests.")
        return

    print("\n--- Unauthenticated Tests ---\n")

    # Endpoint existence tests
    endpoints = [
        ("/alerts", "GET /alerts"),
        ("/alerts/unread-count", "GET /alerts/unread-count"),
        ("/alerts/stats", "GET /alerts/stats"),
        ("/alerts/threshold-options", "GET /alerts/threshold-options"),
        ("/alerts/preferences", "GET /alerts/preferences"),
        ("/alerts/preferences/with-thresholds", "GET /alerts/preferences/with-thresholds"),
        ("/alerts/watches", "GET /alerts/watches"),
    ]

    for endpoint, name in endpoints:
        test_endpoint_returns_not_404(endpoint, name)

    print("\n--- Auth Required Tests ---\n")

    # Tests that verify auth is required
    test_alerts_list_without_auth()
    test_alerts_unread_count_without_auth()
    test_alerts_stats_without_auth()
    test_preferences_without_auth()
    test_preferences_with_thresholds_without_auth()
    test_watches_without_auth()
    test_threshold_options_without_auth()

    # Authenticated tests (if token provided)
    if token:
        print("\n--- Authenticated Tests ---\n")

        test_alerts_list_with_token(token)
        test_preferences_with_token(token)
        test_preferences_with_thresholds_with_token(token)
        test_watches_with_token(token)
        test_alert_stats_with_token(token)
        test_update_preference_thresholds_with_token(token)
        test_invalid_alert_type_threshold_update(token)
    else:
        print("\n--- Skipping Authenticated Tests (no token provided) ---\n")
        for name in [
            "Alerts List - With Auth",
            "Preferences - With Auth",
            "Preferences with Thresholds - With Auth",
            "Watches - With Auth",
            "Alert Stats - With Auth",
            "Update RISK Thresholds - With Auth",
            "Invalid Alert Type - Rejected",
        ]:
            log_test(name, False, "No token provided", skipped=True)

    # Print summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Passed:  {RESULTS['passed']}")
    print(f"Failed:  {RESULTS['failed']}")
    print(f"Skipped: {RESULTS['skipped']}")
    print(f"Total:   {RESULTS['passed'] + RESULTS['failed'] + RESULTS['skipped']}")
    print("=" * 60)

    if RESULTS['failed'] > 0:
        print("\nFailed Tests:")
        for test in RESULTS['tests']:
            if test['status'] == 'FAIL':
                print(f"  - {test['name']}: {test['message']}")

    return RESULTS['failed'] == 0


if __name__ == "__main__":
    # Use provided token or auto-generate super admin token
    if len(sys.argv) > 1:
        token = sys.argv[1]
        print(f"Using provided token")
    else:
        token = generate_admin_token()
        print(f"Auto-generated super admin token")

    success = run_tests(token)
    sys.exit(0 if success else 1)
