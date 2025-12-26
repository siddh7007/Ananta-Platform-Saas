#!/usr/bin/env python3
"""Test script for Phase 1 BOM upload endpoint"""

import os
import sys
import requests
import json
from pathlib import Path

# Add tests directory to path for JWT utils
sys.path.insert(0, str(Path(__file__).parent / "tests"))

from utils.jwt_utils import generate_test_token

# Configuration
BASE_URL = "http://localhost:27200"
CSV_FILE = Path("test-bom-upload.csv")
INVALID_CSV_FILE = Path("test-bom-upload-invalid.csv")

# From database query - real test data
# NOTE: Using control_plane_tenant_id (not organization.id) because scope validation
# compares JWT org_id against organizations.control_plane_tenant_id
ORG_ID = "468224c2-82a0-6286-57e7-eff8da9982f2"  # Control Plane Tenant ID
PROJECT_ID = "b1111111-1111-1111-1111-111111111111"  # Demo Project
USER_ID = "00000000-0000-4000-8000-000000000001"

def generate_token():
    """Generate JWT token for testing."""
    # Use the same JWT secret as CNS service
    os.environ["JWT_SECRET_KEY"] = "cns-jwt-secret-key-change-in-production-at-least-32-chars"

    return generate_test_token(
        user_id=USER_ID,
        organization_id=ORG_ID,
        role="admin",
        email="admin@cbp.local"
    )

def test_upload_success():
    """Test 1: Upload BOM to own project (should succeed)."""
    print("\n" + "="*80)
    print("TEST 1: Upload BOM to Own Project (Expected: Success)")
    print("="*80)

    token = generate_token()
    headers = {"Authorization": f"Bearer {token}"}

    if not CSV_FILE.exists():
        print(f"[ERROR] CSV file not found: {CSV_FILE}")
        return False

    with open(CSV_FILE, "rb") as f:
        files = {"file": ("test-bom-upload.csv", f, "text/csv")}
        data = {
            "bom_name": "Test BOM Upload - Phase 1",
            "priority": "normal",
            "source": "customer",
            "start_enrichment": "false"  # Disable enrichment for testing
        }

        url = f"{BASE_URL}/api/boms/projects/{PROJECT_ID}/boms/upload"
        print(f"[INFO] Uploading to: {url}")
        print(f"[INFO] Data: {data}")

        try:
            response = requests.post(url, headers=headers, files=files, data=data, timeout=30)

            print(f"[RESULT] Status Code: {response.status_code}")

            if response.status_code in (200, 201):
                result = response.json()
                print(f"[SUCCESS] BOM created successfully!")
                print(json.dumps(result, indent=2))
                return result.get("bom_id")
            else:
                print(f"[FAILURE] Request failed")
                print(f"[ERROR] {response.text}")
                return None

        except Exception as e:
            print(f"[ERROR] Exception: {e}")
            return None

def test_upload_no_auth():
    """Test 2: Upload BOM without authentication (should fail with 401)."""
    print("\n" + "="*80)
    print("TEST 2: Upload Without Authentication (Expected: HTTP 401)")
    print("="*80)

    if not CSV_FILE.exists():
        print(f"[ERROR] CSV file not found: {CSV_FILE}")
        return False

    with open(CSV_FILE, "rb") as f:
        files = {"file": ("test-bom-upload.csv", f, "text/csv")}
        data = {
            "bom_name": "Test BOM - No Auth",
            "priority": "normal",
            "source": "customer"
        }

        url = f"{BASE_URL}/api/boms/projects/{PROJECT_ID}/boms/upload"
        print(f"[INFO] Uploading to: {url} (no auth header)")

        try:
            response = requests.post(url, files=files, data=data, timeout=30)

            print(f"[RESULT] Status Code: {response.status_code}")

            if response.status_code == 401:
                print("[SUCCESS] Request rejected as expected (401 Unauthorized)")
                return True
            else:
                print(f"[FAILURE] Expected 401, got {response.status_code}")
                print(f"[ERROR] {response.text}")
                return False

        except Exception as e:
            print(f"[ERROR] Exception: {e}")
            return False

def test_upload_cross_tenant():
    """Test 3: Upload BOM to project in different organization (should fail with 403/404)."""
    print("\n" + "="*80)
    print("TEST 3: Upload to Different Organization's Project (Expected: HTTP 403 or 404)")
    print("="*80)

    # Using a different project ID that doesn't belong to the user's org
    different_project_id = "00000000-0000-0000-0000-000000000000"

    token = generate_token()
    headers = {"Authorization": f"Bearer {token}"}

    if not CSV_FILE.exists():
        print(f"[ERROR] CSV file not found: {CSV_FILE}")
        return False

    with open(CSV_FILE, "rb") as f:
        files = {"file": ("test-bom-upload.csv", f, "text/csv")}
        data = {
            "bom_name": "Test BOM - Cross Tenant",
            "priority": "normal",
            "source": "customer"
        }

        url = f"{BASE_URL}/api/boms/projects/{different_project_id}/boms/upload"
        print(f"[INFO] Uploading to: {url}")
        print(f"[INFO] Using project_id: {different_project_id} (not owned by user)")

        try:
            response = requests.post(url, headers=headers, files=files, data=data, timeout=30)

            print(f"[RESULT] Status Code: {response.status_code}")

            # Accept either 403 (from decorator) or 404 (not found)
            if response.status_code in (403, 404):
                print(f"[SUCCESS] Request rejected as expected (HTTP {response.status_code})")
                print("[VERIFIED] Cross-tenant access prevented")
                return True
            else:
                print(f"[FAILURE] Expected 403 or 404, got {response.status_code}")
                print(f"[ERROR] {response.text}")
                return False

        except Exception as e:
            print(f"[ERROR] Exception: {e}")
            return False

def test_upload_invalid_csv():
    """Test 4: Upload invalid CSV (should fail with 400)."""
    print("\n" + "="*80)
    print("TEST 4: Upload Invalid CSV (Expected: HTTP 400)")
    print("="*80)

    token = generate_token()
    headers = {"Authorization": f"Bearer {token}"}

    if not INVALID_CSV_FILE.exists():
        print(f"[ERROR] Invalid CSV file not found: {INVALID_CSV_FILE}")
        return False

    with open(INVALID_CSV_FILE, "rb") as f:
        files = {"file": ("test-bom-upload-invalid.csv", f, "text/csv")}
        data = {
            "bom_name": "Test BOM - Invalid CSV",
            "priority": "normal",
            "source": "customer"
        }

        url = f"{BASE_URL}/api/boms/projects/{PROJECT_ID}/boms/upload"
        print(f"[INFO] Uploading to: {url}")
        print(f"[INFO] File: {INVALID_CSV_FILE} (missing required columns)")

        try:
            response = requests.post(url, headers=headers, files=files, data=data, timeout=30)

            print(f"[RESULT] Status Code: {response.status_code}")

            if response.status_code == 400:
                print("[SUCCESS] Request rejected as expected (400 Bad Request)")
                print(f"[ERROR MESSAGE] {response.json().get('detail', response.text)}")
                return True
            else:
                print(f"[FAILURE] Expected 400, got {response.status_code}")
                print(f"[ERROR] {response.text}")
                return False

        except Exception as e:
            print(f"[ERROR] Exception: {e}")
            return False

def verify_bom_created(bom_id):
    """Verify BOM was created in database."""
    print("\n" + "="*80)
    print("VERIFICATION: Check BOM in Database")
    print("="*80)

    if not bom_id:
        print("[SKIP] No BOM ID to verify")
        return False

    print(f"[INFO] BOM ID: {bom_id}")
    print("\n[SQL] Run these queries to verify:")
    print(f"""
-- Check BOM record
SELECT id, name, organization_id, project_id, component_count, status, priority, created_at
FROM boms
WHERE id = '{bom_id}';

-- Check line items
SELECT id, line_number, manufacturer_part_number, manufacturer, quantity, reference_designator, description
FROM bom_line_items
WHERE bom_id = '{bom_id}'
ORDER BY line_number;

-- Check organization derivation
SELECT b.id as bom_id, b.organization_id as bom_org, w.organization_id as workspace_org
FROM boms b
JOIN projects p ON b.project_id = p.id
JOIN workspaces w ON p.workspace_id = w.id
WHERE b.id = '{bom_id}';
""")

    return True

def main():
    """Run all tests."""
    print("\n" + "="*80)
    print("PHASE 1 BOM UPLOAD ENDPOINT TESTING")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Project ID: {PROJECT_ID}")
    print(f"CSV File: {CSV_FILE}")

    results = {
        "Test 1 (Upload Success)": False,
        "Test 2 (No Auth)": False,
        "Test 3 (Cross Tenant)": False,
        "Test 4 (Invalid CSV)": False,
    }

    # Test 1: Successful upload
    bom_id = test_upload_success()
    results["Test 1 (Upload Success)"] = bom_id is not None

    # Test 2: No authentication
    results["Test 2 (No Auth)"] = test_upload_no_auth()

    # Test 3: Cross-tenant access
    results["Test 3 (Cross Tenant)"] = test_upload_cross_tenant()

    # Test 4: Invalid CSV
    results["Test 4 (Invalid CSV)"] = test_upload_invalid_csv()

    # Verify BOM creation
    if bom_id:
        verify_bom_created(bom_id)

    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)

    for test_name, passed in results.items():
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{status} {test_name}")

    total_tests = len(results)
    passed_tests = sum(results.values())

    print("\n" + "-"*80)
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(f"Success Rate: {passed_tests/total_tests*100:.1f}%")
    print("="*80)

    return 0 if passed_tests == total_tests else 1

if __name__ == "__main__":
    sys.exit(main())
