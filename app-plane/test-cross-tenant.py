#!/usr/bin/env python3
"""
Cross-Tenant Access Testing for CNS Service
Tests that users cannot access resources from other organizations

This test verifies multi-tenant isolation by attempting to access
resources across organization boundaries.

Expected Results: All cross-tenant access attempts should return HTTP 404
"""

import requests
import json
import sys

# Test data setup
print("=" * 70)
print("Setting up test data...")
print("=" * 70)
print()

# Organization 1: Platform Super Admin (a0000000-0000-0000-0000-000000000000)
ORG1_ID = "a0000000-0000-0000-0000-000000000000"
ORG1_NAME = "Platform Super Admin"
USER1_EMAIL = "admin@cbp.local"
USER1_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJIYkxtaGtodXBlLVpyYjlLNmxxaElsX1VUSmRtTE1fQ1prR3poeFBLcXlrIn0.eyJleHAiOjE3NjU3NzkwMjQsImlhdCI6MTc2NTc3NTQyNCwianRpIjoiM2UyOTY2Y2QtMDYxNC00MjUyLWJiZTktNzJkYWEwNTA2NGY4IiwiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDo4MTgwL3JlYWxtcy9hbmFudGEtc2FhcyIsInN1YiI6IjFkMDdjOTI1LTQ4YmEtNGI0ZS1iMjhmLTY2NTA0MWEwMTJjYSIsInR5cCI6IkJlYXJlciIsImF6cCI6ImFkbWluLWNsaSIsInNlc3Npb25fc3RhdGUiOiI4MzJiNjkxOC00YmE2LTRmMTEtODE5MC04NjQzZjk4YmZjNzkiLCJhY3IiOiIxIiwic2NvcGUiOiJlbWFpbCBwcm9maWxlIiwic2lkIjoiODMyYjY5MTgtNGJhNi00ZjExLTgxOTAtODY0M2Y5OGJmYzc5IiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJDQlAgQWRtaW4iLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJjYnBhZG1pbiIsImdpdmVuX25hbWUiOiJDQlAiLCJmYW1pbHlfbmFtZSI6IkFkbWluIiwiZW1haWwiOiJhZG1pbkBjYnAubG9jYWwifQ.Gz0eH5xKwPhcpJuluN7rmxhAp6JQZjV5Zt5aUJdsLc80CwrTi1lM30DreobIkwv6AUYPvXK3psP_-bBZxK7ZeGbuZhvV-GD2J0Zhzp4G0NGqkboNfsilz1CCTOiXxPd0wyyHqPxKhskpBC-ueEJfK5X1LDovYgyUVVJy-7WesvXJ_oLLuQmHZSNhvnReiGABBn-XG6krvgZ244zPZcWN-SyXX7ipg6IN1JvEjf7fBi1caI9Gfag6YoSv0UXx5G9vRQf5He9olf0iS20IOOUqV7xanfefpx-k96qLOPofQ-mRYyDMNj1tfPHfer-M_AUFAFuY4vGwTBUJbn8Mf-BNfg"
BOM1_ID = "ebea1f29-f1f2-4cf5-9444-10ae56db49ed"
WORKSPACE1_ID = "c13f4caa-fee3-4e9b-805c-a8282bfd59ed"

# Organization 2: Ananta Platform (a1111111-1111-1111-1111-111111111111)
ORG2_ID = "a1111111-1111-1111-1111-111111111111"
ORG2_NAME = "Ananta Platform"
USER2_EMAIL = "user2@test.local"
USER2_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJIYkxtaGtodXBlLVpyYjlLNmxxaElsX1VUSmRtTE1fQ1prR3poeFBLcXlrIn0.eyJleHAiOjE3NjU3NzkwMzAsImlhdCI6MTc2NTc3NTQzMCwianRpIjoiZWNiMDRmY2UtYTg2YS00MDA5LWJhY2EtMzUyODE0MWZiNThlIiwiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDo4MTgwL3JlYWxtcy9hbmFudGEtc2FhcyIsInN1YiI6IjQxNjgxYmY0LWU0OTUtNDcyZC05OWRhLTdhMjFlYjc3Yjc2ZiIsInR5cCI6IkJlYXJlciIsImF6cCI6ImFkbWluLWNsaSIsInNlc3Npb25fc3RhdGUiOiJhMjYwN2UxNy03YjhkLTRjMzItOTliNi1iNzcyZDE1ZTkwOGEiLCJhY3IiOiIxIiwic2NvcGUiOiJlbWFpbCBwcm9maWxlIiwic2lkIjoiYTI2MDdlMTctN2I4ZC00YzMyLTk5YjYtYjc3MmQxNWU5MDhhIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJUZXN0IFVzZXIyIiwicHJlZmVycmVkX3VzZXJuYW1lIjoidXNlcjIiLCJnaXZlbl9uYW1lIjoiVGVzdCIsImZhbWlseV9uYW1lIjoiVXNlcjIiLCJlbWFpbCI6InVzZXIyQHRlc3QubG9jYWwifQ.hCTaVc_qU-v1RiX2_L9Eg03rYoFD3XTroiXCPYZ9_0x_vjF5FK_MA8dKKUHLFdI2Fs9JKUvcfYAF9ix8GutO4Y17LuhquU625XZkKblPFDqNE_In5r0OkGXR73yn8TG9Yxi1EA980tkU7ztkqtKI56eAZnH0wzuJz5q7Vvk_Cq7jTwpRueTF_5kGK5gq_6O6InvyrzHeX2lo-t94tUG1plYw4yZW4y8HBn_7iDqvA7LSTC_2L_bd0bjtzV5bKHUXzHiQCeylWivcIR4M8dUTPuRYamh87_Ek9s6-us6CjxrnjjA-YMp3t3TjvwmMKGFsWuwPipuDrkpY6gcriDMiug"
BOM2_ID = "a9d25f0f-da68-458e-adad-4a169afe56b6"
WORKSPACE2_ID = "a2abf8d7-eb19-4699-bf17-fcc0807f4b95"

print(f"Organization 1: {ORG1_NAME} ({ORG1_ID})")
print(f"  User: {USER1_EMAIL}")
print(f"  BOM: {BOM1_ID}")
print(f"  Workspace: {WORKSPACE1_ID}")
print()
print(f"Organization 2: {ORG2_NAME} ({ORG2_ID})")
print(f"  User: {USER2_EMAIL}")
print(f"  BOM: {BOM2_ID}")
print(f"  Workspace: {WORKSPACE2_ID}")
print()

# Test configuration
API_BASE = "http://localhost:27200/api"
EXPECTED_STATUS = 404  # Multi-tenant isolation should return 404 for out-of-scope resources

# Test results tracking
tests_passed = 0
tests_failed = 0
test_results = []

def run_test(test_num, description, url, token, user_email, expected_status=404):
    """Run a single cross-tenant access test"""
    global tests_passed, tests_failed

    print("=" * 70)
    print(f"Test {test_num}: {description}")
    print("=" * 70)
    print(f"User: {user_email}")
    print(f"URL: {url}")
    print(f"Expected: HTTP {expected_status} (access denied)")
    print()

    headers = {"Authorization": f"Bearer {token}"}

    try:
        response = requests.get(url, headers=headers)
        status_code = response.status_code

        print(f"Actual: HTTP {status_code}")

        # Check if status matches expected
        if status_code == expected_status:
            print("RESULT: PASS - Access correctly denied")
            tests_passed += 1
            result = "PASS"
        else:
            print(f"RESULT: FAIL - Expected {expected_status}, got {status_code}")
            tests_failed += 1
            result = "FAIL"

            # Print response for debugging
            try:
                print(f"Response: {json.dumps(response.json(), indent=2)}")
            except:
                print(f"Response: {response.text}")

        print()

        test_results.append({
            "test_num": test_num,
            "description": description,
            "user": user_email,
            "url": url,
            "expected": expected_status,
            "actual": status_code,
            "result": result
        })

        return status_code == expected_status

    except Exception as e:
        print(f"ERROR: {e}")
        print(f"RESULT: FAIL - Exception occurred")
        tests_failed += 1
        print()

        test_results.append({
            "test_num": test_num,
            "description": description,
            "user": user_email,
            "url": url,
            "expected": expected_status,
            "actual": f"Exception: {e}",
            "result": "FAIL"
        })

        return False

# Run cross-tenant access tests
print()
print("=" * 70)
print("CROSS-TENANT ACCESS TESTING - START")
print("=" * 70)
print()
print("Testing multi-tenant isolation by attempting cross-organization access")
print("All tests should return HTTP 404 (not found)")
print()

# Test 1: User 1 tries to access User 2's BOM
run_test(
    test_num=1,
    description="User 1 tries to access User 2's BOM",
    url=f"{API_BASE}/boms/{BOM2_ID}/line_items",
    token=USER1_TOKEN,
    user_email=USER1_EMAIL,
    expected_status=404
)

# Test 2: User 2 tries to access User 1's BOM
run_test(
    test_num=2,
    description="User 2 tries to access User 1's BOM",
    url=f"{API_BASE}/boms/{BOM1_ID}/line_items",
    token=USER2_TOKEN,
    user_email=USER2_EMAIL,
    expected_status=404
)

# Test 3: User 1 tries to access User 2's BOM enrichment status
run_test(
    test_num=3,
    description="User 1 tries to access User 2's BOM enrichment status",
    url=f"{API_BASE}/boms/{BOM2_ID}/enrichment/status",
    token=USER1_TOKEN,
    user_email=USER1_EMAIL,
    expected_status=404
)

# Test 4: User 2 tries to access User 1's BOM enrichment status
run_test(
    test_num=4,
    description="User 2 tries to access User 1's BOM enrichment status",
    url=f"{API_BASE}/boms/{BOM1_ID}/enrichment/status",
    token=USER2_TOKEN,
    user_email=USER2_EMAIL,
    expected_status=404
)

# Test 5: User 1 tries to access User 2's workspace
run_test(
    test_num=5,
    description="User 1 tries to access User 2's workspace",
    url=f"{API_BASE}/workspaces/{WORKSPACE2_ID}",
    token=USER1_TOKEN,
    user_email=USER1_EMAIL,
    expected_status=404
)

# Test 6: User 2 tries to access User 1's workspace
run_test(
    test_num=6,
    description="User 2 tries to access User 1's workspace",
    url=f"{API_BASE}/workspaces/{WORKSPACE1_ID}",
    token=USER2_TOKEN,
    user_email=USER2_EMAIL,
    expected_status=404
)

# Test 7: User 1 tries to access User 2's BOM components
run_test(
    test_num=7,
    description="User 1 tries to access User 2's BOM components",
    url=f"{API_BASE}/boms/{BOM2_ID}/components",
    token=USER1_TOKEN,
    user_email=USER1_EMAIL,
    expected_status=404
)

# Test 8: User 2 tries to access User 1's BOM components
run_test(
    test_num=8,
    description="User 2 tries to access User 1's BOM components",
    url=f"{API_BASE}/boms/{BOM1_ID}/components",
    token=USER2_TOKEN,
    user_email=USER2_EMAIL,
    expected_status=404
)

# Print summary
print()
print("=" * 70)
print("CROSS-TENANT ACCESS TESTING - SUMMARY")
print("=" * 70)
print()
print(f"Total Tests: {tests_passed + tests_failed}")
print(f"Passed: {tests_passed}")
print(f"Failed: {tests_failed}")
print()

if tests_failed == 0:
    print("OVERALL RESULT: ALL TESTS PASSED")
    print()
    print("Multi-tenant isolation is working correctly!")
    print("Users cannot access resources from other organizations.")
else:
    print("OVERALL RESULT: SOME TESTS FAILED")
    print()
    print("WARNING: Multi-tenant isolation may be broken!")
    print("Review failed tests above.")

print()
print("=" * 70)
print("TEST RESULTS DETAIL")
print("=" * 70)
print()

for test in test_results:
    status_icon = "[PASS]" if test["result"] == "PASS" else "[FAIL]"
    print(f"{status_icon} Test {test['test_num']}: {test['description']}")
    print(f"  User: {test['user']}")
    print(f"  Expected: HTTP {test['expected']}")
    print(f"  Actual: HTTP {test['actual']}")
    print(f"  Result: {test['result']}")
    print()

# Exit with appropriate code
sys.exit(0 if tests_failed == 0 else 1)
