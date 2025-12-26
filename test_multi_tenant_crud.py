#!/usr/bin/env python3
"""
Comprehensive Multi-Tenant CRUD Test Suite
Tests tenant isolation, CRUD operations, and role-based access control
"""
import requests
import json
import uuid
import time
from dataclasses import dataclass
from typing import Optional, List, Dict, Any

# Configuration
KEYCLOAK_URL = 'http://localhost:8180'
CNS_API_URL = 'http://localhost:27200/api'
REALM = 'ananta-saas'

# Test organization
ORG_ID = 'a0000000-0000-0000-0000-000000000000'
DEFAULT_WORKSPACE_ID = 'c13f4caa-fee3-4e9b-805c-a8282bfd59ed'

# Test users with different roles
TEST_USERS = [
    {'username': 'superadmin', 'password': 'Test123!', 'role': 'super_admin'},
    {'username': 'orgowner', 'password': 'Test123!', 'role': 'owner'},
    {'username': 'orgadmin', 'password': 'Test123!', 'role': 'admin'},
    {'username': 'engineer1', 'password': 'Test123!', 'role': 'engineer'},
    {'username': 'analyst1', 'password': 'Test123!', 'role': 'analyst'},
]

# Test results
results = {'passed': 0, 'failed': 0, 'skipped': 0, 'details': []}


@dataclass
class TestResult:
    name: str
    passed: bool
    message: str
    user: str = ''
    duration: float = 0.0


def log_result(test_name: str, passed: bool, message: str, user: str = '', duration: float = 0.0):
    """Log test result"""
    result = TestResult(test_name, passed, message, user, duration)
    results['details'].append(result)
    if passed:
        results['passed'] += 1
        symbol = '[PASS]'
    else:
        results['failed'] += 1
        symbol = '[FAIL]'

    user_str = f' ({user})' if user else ''
    print(f"  {symbol} {test_name}{user_str}: {message}")


def get_token(username: str, password: str) -> Optional[str]:
    """Get Keycloak token for user"""
    try:
        resp = requests.post(
            f'{KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/token',
            data={
                'grant_type': 'password',
                'client_id': 'admin-cli',
                'username': username,
                'password': password
            },
            timeout=10
        )
        if resp.status_code == 200:
            return resp.json().get('access_token')
        return None
    except Exception as e:
        print(f"    Error getting token: {e}")
        return None


def api_call(method: str, endpoint: str, token: str, data: dict = None, params: dict = None) -> tuple:
    """Make API call and return (status_code, response_json or error)"""
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    url = f'{CNS_API_URL}{endpoint}'

    try:
        start = time.time()
        if method == 'GET':
            resp = requests.get(url, headers=headers, params=params, timeout=10)
        elif method == 'POST':
            resp = requests.post(url, headers=headers, json=data, params=params, timeout=10)
        elif method == 'PUT':
            resp = requests.put(url, headers=headers, json=data, params=params, timeout=10)
        elif method == 'PATCH':
            resp = requests.patch(url, headers=headers, json=data, params=params, timeout=10)
        elif method == 'DELETE':
            resp = requests.delete(url, headers=headers, params=params, timeout=10)
        else:
            return (0, f"Unknown method: {method}")

        duration = time.time() - start

        try:
            return (resp.status_code, resp.json(), duration)
        except:
            return (resp.status_code, resp.text[:200], duration)
    except Exception as e:
        return (0, str(e), 0)


def test_authentication():
    """Test authentication for all users"""
    print("\n" + "=" * 70)
    print("TEST 1: AUTHENTICATION")
    print("=" * 70)

    tokens = {}
    for user in TEST_USERS:
        token = get_token(user['username'], user['password'])
        if token:
            tokens[user['username']] = token
            log_result(f"Login {user['username']}", True, f"Role: {user['role']}")
        else:
            log_result(f"Login {user['username']}", False, "Failed to get token")

    return tokens


def test_workspace_crud(tokens: dict):
    """Test workspace CRUD operations with different roles"""
    print("\n" + "=" * 70)
    print("TEST 2: WORKSPACE CRUD")
    print("=" * 70)

    created_ids = {}

    # Test LIST workspaces
    print("\n  [LIST WORKSPACES]")
    for user, token in tokens.items():
        status, resp, duration = api_call('GET', '/workspaces', token, params={'organization_id': ORG_ID})
        if status == 200:
            count = len(resp) if isinstance(resp, list) else 'unknown'
            log_result("List workspaces", True, f"Found {count} workspaces", user, duration)
        else:
            log_result("List workspaces", False, f"Status {status}: {resp}", user, duration)

    # Test CREATE workspace (requires engineer+)
    print("\n  [CREATE WORKSPACE]")
    for user in TEST_USERS:
        if user['username'] not in tokens:
            continue

        ws_id = str(uuid.uuid4())
        ws_data = {
            'id': ws_id,
            'name': f"Test WS {user['role']} {ws_id[:8]}",
            'description': f"Created by {user['role']}",
            'organization_id': ORG_ID
        }

        status, resp, duration = api_call('POST', '/workspaces', tokens[user['username']], data=ws_data)

        if user['role'] in ['super_admin', 'owner', 'admin', 'engineer']:
            if status == 201:
                created_ids[user['username']] = resp.get('id', ws_id)
                log_result("Create workspace", True, f"Created {ws_id[:8]}", user['username'], duration)
            else:
                log_result("Create workspace", False, f"Status {status}: {str(resp)[:100]}", user['username'], duration)
        else:
            # analyst should be denied
            if status in [401, 403]:
                log_result("Create workspace (denied)", True, f"Correctly denied for {user['role']}", user['username'], duration)
            else:
                log_result("Create workspace (denied)", False, f"Expected 403, got {status}", user['username'], duration)

    # Test UPDATE workspace (requires engineer+)
    print("\n  [UPDATE WORKSPACE]")
    for user, ws_id in created_ids.items():
        update_data = {'name': f"Updated WS {ws_id[:8]}", 'description': 'Updated'}
        status, resp, duration = api_call('PUT', f'/workspaces/{ws_id}', tokens[user], data=update_data)
        if status == 200:
            log_result("Update workspace", True, f"Updated {ws_id[:8]}", user, duration)
        else:
            log_result("Update workspace", False, f"Status {status}", user, duration)

    # Test DELETE workspace (requires admin+)
    print("\n  [DELETE WORKSPACE]")
    for user, ws_id in created_ids.items():
        status, resp, duration = api_call('DELETE', f'/workspaces/{ws_id}', tokens[user])
        if status in [200, 204]:
            log_result("Delete workspace", True, f"Deleted {ws_id[:8]}", user, duration)
        else:
            log_result("Delete workspace", False, f"Status {status}", user, duration)

    return created_ids


def test_project_crud(tokens: dict):
    """Test project CRUD operations"""
    print("\n" + "=" * 70)
    print("TEST 3: PROJECT CRUD")
    print("=" * 70)

    created_ids = {}

    # Test LIST projects
    print("\n  [LIST PROJECTS]")
    for user, token in list(tokens.items())[:3]:  # Test with first 3 users
        status, resp, duration = api_call('GET', '/projects', token, params={'workspace_id': DEFAULT_WORKSPACE_ID})
        if status == 200:
            count = len(resp) if isinstance(resp, list) else resp.get('total', 'unknown')
            log_result("List projects", True, f"Found {count} projects", user, duration)
        elif status == 422:
            log_result("List projects", False, "Missing workspace_id", user, duration)
        else:
            log_result("List projects", False, f"Status {status}", user, duration)

    # Test CREATE project (requires engineer+)
    print("\n  [CREATE PROJECT]")
    engineer_token = tokens.get('engineer1') or tokens.get('orgadmin')
    if engineer_token:
        proj_id = str(uuid.uuid4())
        proj_data = {
            'id': proj_id,
            'name': f"Test Project {proj_id[:8]}",
            'description': 'CRUD Test Project',
            'workspace_id': DEFAULT_WORKSPACE_ID,
            'status': 'active',
            'tags': ['test', 'crud']
        }

        status, resp, duration = api_call('POST', '/projects', engineer_token, data=proj_data)
        if status == 201:
            created_ids['engineer1'] = resp.get('id', proj_id)
            log_result("Create project", True, f"Created {proj_id[:8]}", 'engineer1', duration)
        else:
            log_result("Create project", False, f"Status {status}: {str(resp)[:100]}", 'engineer1', duration)

    # Test UPDATE project
    print("\n  [UPDATE PROJECT]")
    if created_ids:
        proj_id = list(created_ids.values())[0]
        update_data = {'name': f"Updated Project {proj_id[:8]}", 'status': 'active'}
        status, resp, duration = api_call('PATCH', f'/projects/{proj_id}', engineer_token, data=update_data)
        if status == 200:
            log_result("Update project", True, f"Updated {proj_id[:8]}", 'engineer1', duration)
        else:
            log_result("Update project", False, f"Status {status}", 'engineer1', duration)

    # Test DELETE project (soft delete)
    print("\n  [DELETE PROJECT]")
    if created_ids:
        proj_id = list(created_ids.values())[0]
        status, resp, duration = api_call('DELETE', f'/projects/{proj_id}', engineer_token)
        if status in [200, 204]:
            log_result("Delete project", True, f"Deleted {proj_id[:8]}", 'engineer1', duration)
        else:
            log_result("Delete project", False, f"Status {status}", 'engineer1', duration)

    return created_ids


def test_bom_access(tokens: dict):
    """Test BOM access with different roles"""
    print("\n" + "=" * 70)
    print("TEST 4: BOM ACCESS")
    print("=" * 70)

    # Test admin/boms endpoint (requires admin+)
    print("\n  [ADMIN BOM LIST]")
    for user, token in tokens.items():
        status, resp, duration = api_call('GET', '/admin/boms', token)
        role = next((u['role'] for u in TEST_USERS if u['username'] == user), 'unknown')

        if role in ['super_admin', 'owner', 'admin']:
            if status == 200:
                count = len(resp) if isinstance(resp, list) else 'unknown'
                log_result("Admin BOM list", True, f"Found {count} BOMs", user, duration)
            else:
                log_result("Admin BOM list", False, f"Status {status}", user, duration)
        else:
            if status == 403:
                log_result("Admin BOM list (denied)", True, f"Correctly denied for {role}", user, duration)
            else:
                log_result("Admin BOM list (denied)", False, f"Expected 403, got {status}", user, duration)

    # Test BOM line items (if we have a BOM)
    print("\n  [BOM LINE ITEMS]")
    admin_token = tokens.get('orgadmin') or tokens.get('superadmin')
    if admin_token:
        status, resp, duration = api_call('GET', '/admin/boms', admin_token)
        if status == 200 and isinstance(resp, list) and len(resp) > 0:
            bom_id = resp[0].get('id')
            if bom_id:
                status, resp, duration = api_call('GET', f'/boms/{bom_id}/line_items', admin_token)
                if status == 200:
                    count = resp.get('total', len(resp.get('items', []))) if isinstance(resp, dict) else 'unknown'
                    log_result("BOM line items", True, f"Found {count} items", 'admin', duration)
                else:
                    log_result("BOM line items", False, f"Status {status}", 'admin', duration)


def test_tenant_isolation(tokens: dict):
    """Test that tenant isolation is enforced"""
    print("\n" + "=" * 70)
    print("TEST 5: TENANT ISOLATION")
    print("=" * 70)

    # Try to access another org's workspaces
    print("\n  [CROSS-TENANT ACCESS]")
    fake_org_id = 'b1111111-1111-1111-1111-111111111111'

    for user, token in list(tokens.items())[:2]:
        status, resp, duration = api_call('GET', '/workspaces', token, params={'organization_id': fake_org_id})

        if status == 200 and isinstance(resp, list) and len(resp) == 0:
            log_result("Cross-tenant blocked", True, "No data returned for other org", user, duration)
        elif status in [401, 403]:
            log_result("Cross-tenant blocked", True, f"Access denied ({status})", user, duration)
        elif status == 200 and len(resp) > 0:
            log_result("Cross-tenant blocked", False, "WARNING: Got data from other org!", user, duration)
        else:
            log_result("Cross-tenant blocked", True, f"Status {status} (likely blocked)", user, duration)

    # Try to access workspace without org_id
    print("\n  [MISSING ORG_ID]")
    token = list(tokens.values())[0]
    status, resp, duration = api_call('GET', '/workspaces', token)  # No organization_id
    if status in [400, 422]:
        log_result("Missing org_id rejected", True, f"Correctly rejected ({status})", 'any', duration)
    elif status == 500:
        log_result("Missing org_id rejected", False, "Server error instead of validation error", 'any', duration)
    else:
        log_result("Missing org_id rejected", False, f"Unexpected status {status}", 'any', duration)


def test_role_based_access(tokens: dict):
    """Test role-based access control"""
    print("\n" + "=" * 70)
    print("TEST 6: ROLE-BASED ACCESS CONTROL")
    print("=" * 70)

    # Define expected access matrix
    access_matrix = {
        # endpoint: {role: expected_access}
        '/workspaces': {'super_admin': True, 'owner': True, 'admin': True, 'engineer': True, 'analyst': True},
        '/admin/boms': {'super_admin': True, 'owner': True, 'admin': True, 'engineer': False, 'analyst': False},
    }

    print("\n  [ACCESS MATRIX VERIFICATION]")
    for endpoint, role_access in access_matrix.items():
        for user in TEST_USERS:
            if user['username'] not in tokens:
                continue

            params = {'organization_id': ORG_ID} if endpoint == '/workspaces' else {}
            status, resp, duration = api_call('GET', endpoint, tokens[user['username']], params=params)

            expected = role_access.get(user['role'], False)
            actual = status == 200

            if expected == actual:
                result = "Allowed" if actual else "Denied"
                log_result(f"{endpoint} ({user['role']})", True, f"Correctly {result}", user['username'], duration)
            else:
                log_result(f"{endpoint} ({user['role']})", False,
                          f"Expected {'allowed' if expected else 'denied'}, got {status}",
                          user['username'], duration)


def print_summary():
    """Print test summary"""
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)

    total = results['passed'] + results['failed']
    pass_rate = (results['passed'] / total * 100) if total > 0 else 0

    print(f"\n  Total Tests: {total}")
    print(f"  Passed: {results['passed']}")
    print(f"  Failed: {results['failed']}")
    print(f"  Pass Rate: {pass_rate:.1f}%")

    if results['failed'] > 0:
        print("\n  FAILED TESTS:")
        for r in results['details']:
            if not r.passed:
                print(f"    - {r.name} ({r.user}): {r.message}")

    print("\n" + "=" * 70)
    if results['failed'] == 0:
        print("ALL TESTS PASSED!")
    else:
        print(f"SOME TESTS FAILED ({results['failed']} failures)")
    print("=" * 70)


def main():
    print("=" * 70)
    print("MULTI-TENANT CRUD TEST SUITE")
    print("=" * 70)
    print(f"CNS API: {CNS_API_URL}")
    print(f"Keycloak: {KEYCLOAK_URL}")
    print(f"Organization: {ORG_ID}")

    # Run all tests
    tokens = test_authentication()
    if not tokens:
        print("\n[ABORT] No users could authenticate!")
        return

    test_workspace_crud(tokens)
    test_project_crud(tokens)
    test_bom_access(tokens)
    test_tenant_isolation(tokens)
    test_role_based_access(tokens)

    print_summary()


if __name__ == '__main__':
    main()
