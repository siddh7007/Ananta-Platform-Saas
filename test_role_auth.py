#!/usr/bin/env python3
"""
Test authentication and role-based access control across all services
"""
import requests
import json
import jwt

KEYCLOAK_URL = 'http://localhost:8180'
CNS_API_URL = 'http://localhost:27200/api'
REALM = 'ananta-saas'

# Test users (from keycloak_setup.py)
TEST_USERS = [
    {'username': 'superadmin', 'password': 'Test123!', 'expected_role': 'super_admin'},
    {'username': 'orgowner', 'password': 'Test123!', 'expected_role': 'owner'},
    {'username': 'orgadmin', 'password': 'Test123!', 'expected_role': 'admin'},
    {'username': 'engineer1', 'password': 'Test123!', 'expected_role': 'engineer'},
    {'username': 'analyst1', 'password': 'Test123!', 'expected_role': 'analyst'},
    {'username': 'cbpadmin', 'password': 'Test123!', 'expected_role': 'super_admin'},
]

ORG_ID = 'a0000000-0000-0000-0000-000000000000'


def get_token(username, password):
    """Get Keycloak token for user"""
    resp = requests.post(
        f'{KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/token',
        data={
            'grant_type': 'password',
            'client_id': 'admin-cli',  # Can use admin-cli for testing
            'username': username,
            'password': password
        }
    )
    if resp.status_code != 200:
        return None, f"Failed: {resp.text[:100]}"
    return resp.json().get('access_token'), None


def decode_token_roles(token):
    """Decode token and extract roles (without verification)"""
    try:
        decoded = jwt.decode(token, options={"verify_signature": False})
        realm_roles = decoded.get('realm_access', {}).get('roles', [])
        # Filter out default Keycloak roles
        app_roles = [r for r in realm_roles if r in ['super_admin', 'owner', 'admin', 'engineer', 'analyst']]
        return app_roles
    except Exception as e:
        return [f"Error: {e}"]


def test_cns_api(token, endpoint):
    """Test CNS API endpoint with token"""
    try:
        resp = requests.get(
            f'{CNS_API_URL}{endpoint}',
            headers={'Authorization': f'Bearer {token}'},
            params={'organization_id': ORG_ID},
            timeout=5
        )
        return resp.status_code
    except Exception as e:
        return f"Error: {e}"


def main():
    print("=" * 70)
    print("ROLE-BASED ACCESS CONTROL TEST")
    print("=" * 70)

    results = []

    for user in TEST_USERS:
        username = user['username']
        print(f"\n[{username}] Testing...")

        # Get token
        token, error = get_token(username, user['password'])
        if error:
            print(f"  [FAIL] Login: {error}")
            results.append({'user': username, 'login': False})
            continue

        print(f"  [OK] Login successful")

        # Decode and check roles
        roles = decode_token_roles(token)
        expected = user['expected_role']
        role_match = expected in roles
        print(f"  [{'OK' if role_match else 'WARN'}] Role: {roles} (expected: {expected})")

        # Test CNS API endpoints
        endpoints = [
            ('/workspaces', 'workspaces'),
            ('/projects', 'projects'),
            ('/admin/boms', 'admin_boms'),
        ]

        api_results = {}
        for endpoint, name in endpoints:
            status = test_cns_api(token, endpoint)
            api_results[name] = status
            symbol = 'OK' if status == 200 else 'FAIL' if status in [401, 403] else 'WARN'
            print(f"  [{symbol}] GET {endpoint}: {status}")

        results.append({
            'user': username,
            'login': True,
            'roles': roles,
            'expected_role': expected,
            'role_match': role_match,
            'api': api_results
        })

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    print("\n| User | Login | Roles | Expected | Match |")
    print("|------|-------|-------|----------|-------|")
    for r in results:
        login = "OK" if r.get('login') else "FAIL"
        roles = ','.join(r.get('roles', []))
        expected = r.get('expected_role', '-')
        match = "OK" if r.get('role_match') else "FAIL"
        print(f"| {r['user']:<12} | {login:<5} | {roles:<15} | {expected:<10} | {match:<5} |")

    print("\n" + "=" * 70)
    print("TEST COMPLETE")
    print("=" * 70)


if __name__ == '__main__':
    main()
