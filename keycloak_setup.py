#!/usr/bin/env python3
"""
Keycloak Setup Script - Unified Role/Tenant Configuration

This script:
1. Cleans up unused Keycloak realms
2. Ensures ananta-saas realm has proper roles and clients
3. Creates test users for each role level
"""
import requests
import json
import sys

KEYCLOAK_URL = 'http://localhost:8180'
REALM = 'ananta-saas'

# Unified 5-level role hierarchy
ROLES = [
    {'name': 'super_admin', 'description': 'Platform super admin - full access across all tenants'},
    {'name': 'owner', 'description': 'Organization owner - billing, delete org'},
    {'name': 'admin', 'description': 'Organization admin - user management, settings'},
    {'name': 'engineer', 'description': 'Engineer - manage BOMs, components, specs'},
    {'name': 'analyst', 'description': 'Analyst - read-only access, reports'},
]

# Clients for each portal
CLIENTS = [
    {
        'clientId': 'admin-app',
        'name': 'Admin Portal',
        'description': 'Control Plane Admin Portal (arc-saas)',
        'publicClient': True,
        'redirectUris': [
            'http://localhost:27555/*',
            'http://localhost:14003/*',
        ],
        'webOrigins': [
            'http://localhost:27555',
            'http://localhost:14003',
        ],
    },
    {
        'clientId': 'cbp-frontend',
        'name': 'Customer Portal',
        'description': 'Customer Business Portal (CBP)',
        'publicClient': True,
        'redirectUris': [
            'http://localhost:27100/*',
            'http://localhost:27510/*',
        ],
        'webOrigins': [
            'http://localhost:27100',
            'http://localhost:27510',
        ],
    },
]

# Test users - one for each role
TEST_USERS = [
    {
        'username': 'superadmin',
        'email': 'superadmin@platform.local',
        'firstName': 'Super',
        'lastName': 'Admin',
        'password': 'Test123!',
        'role': 'super_admin',
    },
    {
        'username': 'orgowner',
        'email': 'owner@test.local',
        'firstName': 'Org',
        'lastName': 'Owner',
        'password': 'Test123!',
        'role': 'owner',
    },
    {
        'username': 'orgadmin',
        'email': 'admin@test.local',
        'firstName': 'Org',
        'lastName': 'Admin',
        'password': 'Test123!',
        'role': 'admin',
    },
    {
        'username': 'engineer1',
        'email': 'engineer@test.local',
        'firstName': 'Test',
        'lastName': 'Engineer',
        'password': 'Test123!',
        'role': 'engineer',
    },
    {
        'username': 'analyst1',
        'email': 'analyst@test.local',
        'firstName': 'Test',
        'lastName': 'Analyst',
        'password': 'Test123!',
        'role': 'analyst',
    },
    # Keep existing cbpadmin user
    {
        'username': 'cbpadmin',
        'email': 'admin@cbp.local',
        'firstName': 'CBP',
        'lastName': 'Admin',
        'password': 'Test123!',
        'role': 'super_admin',  # Full access for testing
    },
]

# Realms to delete (cleanup)
REALMS_TO_DELETE = ['arc-saas', 'cbp-users', 'tenant-demo', 'components-platform']


def get_admin_token():
    """Get admin token from master realm"""
    resp = requests.post(
        f'{KEYCLOAK_URL}/realms/master/protocol/openid-connect/token',
        data={
            'grant_type': 'password',
            'client_id': 'admin-cli',
            'username': 'admin',
            'password': 'admin'
        }
    )
    if resp.status_code != 200:
        print(f"[ERROR] Failed to get admin token: {resp.text}")
        sys.exit(1)
    return resp.json()['access_token']


def delete_unused_realms(headers):
    """Delete unused/legacy realms"""
    print("\n[1] CLEANING UP UNUSED REALMS")
    print("-" * 50)

    for realm in REALMS_TO_DELETE:
        resp = requests.delete(f'{KEYCLOAK_URL}/admin/realms/{realm}', headers=headers)
        if resp.status_code == 204:
            print(f"  [OK] Deleted realm: {realm}")
        elif resp.status_code == 404:
            print(f"  [SKIP] Realm not found: {realm}")
        else:
            print(f"  [ERROR] Failed to delete {realm}: {resp.status_code} - {resp.text}")


def ensure_roles(headers):
    """Ensure all 5-level roles exist in the realm"""
    print(f"\n[2] ENSURING ROLES IN {REALM}")
    print("-" * 50)

    existing_roles = requests.get(
        f'{KEYCLOAK_URL}/admin/realms/{REALM}/roles',
        headers=headers
    ).json()
    existing_names = {r['name'] for r in existing_roles}

    for role in ROLES:
        if role['name'] in existing_names:
            print(f"  [EXISTS] {role['name']}")
        else:
            resp = requests.post(
                f'{KEYCLOAK_URL}/admin/realms/{REALM}/roles',
                headers={**headers, 'Content-Type': 'application/json'},
                json=role
            )
            if resp.status_code == 201:
                print(f"  [CREATED] {role['name']}")
            else:
                print(f"  [ERROR] Failed to create {role['name']}: {resp.text}")


def ensure_clients(headers):
    """Ensure all clients exist in the realm"""
    print(f"\n[3] ENSURING CLIENTS IN {REALM}")
    print("-" * 50)

    existing_clients = requests.get(
        f'{KEYCLOAK_URL}/admin/realms/{REALM}/clients',
        headers=headers
    ).json()
    existing_ids = {c['clientId'] for c in existing_clients}

    for client in CLIENTS:
        if client['clientId'] in existing_ids:
            print(f"  [EXISTS] {client['clientId']}")
            # Update redirect URIs
            client_data = next(c for c in existing_clients if c['clientId'] == client['clientId'])
            client_uuid = client_data['id']
            resp = requests.put(
                f'{KEYCLOAK_URL}/admin/realms/{REALM}/clients/{client_uuid}',
                headers={**headers, 'Content-Type': 'application/json'},
                json={
                    **client_data,
                    'redirectUris': client['redirectUris'],
                    'webOrigins': client['webOrigins'],
                }
            )
            if resp.status_code == 204:
                print(f"      [UPDATED] redirect URIs for {client['clientId']}")
        else:
            client_payload = {
                'clientId': client['clientId'],
                'name': client['name'],
                'description': client.get('description', ''),
                'enabled': True,
                'publicClient': client.get('publicClient', True),
                'directAccessGrantsEnabled': True,  # Allow password grant for testing
                'standardFlowEnabled': True,
                'implicitFlowEnabled': False,
                'redirectUris': client.get('redirectUris', ['*']),
                'webOrigins': client.get('webOrigins', ['*']),
                'protocol': 'openid-connect',
            }
            resp = requests.post(
                f'{KEYCLOAK_URL}/admin/realms/{REALM}/clients',
                headers={**headers, 'Content-Type': 'application/json'},
                json=client_payload
            )
            if resp.status_code == 201:
                print(f"  [CREATED] {client['clientId']}")
            else:
                print(f"  [ERROR] Failed to create {client['clientId']}: {resp.text}")


def ensure_users(headers):
    """Ensure test users exist with correct roles"""
    print(f"\n[4] ENSURING TEST USERS IN {REALM}")
    print("-" * 50)

    # Get existing users
    existing_users = requests.get(
        f'{KEYCLOAK_URL}/admin/realms/{REALM}/users',
        headers=headers
    ).json()
    existing_usernames = {u['username'] for u in existing_users}

    # Get all roles for mapping
    roles_resp = requests.get(
        f'{KEYCLOAK_URL}/admin/realms/{REALM}/roles',
        headers=headers
    ).json()
    role_map = {r['name']: r for r in roles_resp}

    for user in TEST_USERS:
        if user['username'] in existing_usernames:
            print(f"  [EXISTS] {user['username']} ({user['email']})")
            # Get user ID and update role
            user_data = next(u for u in existing_users if u['username'] == user['username'])
            user_id = user_data['id']
        else:
            # Create user
            user_payload = {
                'username': user['username'],
                'email': user['email'],
                'firstName': user.get('firstName', ''),
                'lastName': user.get('lastName', ''),
                'enabled': True,
                'emailVerified': True,
                'credentials': [{
                    'type': 'password',
                    'value': user['password'],
                    'temporary': False
                }]
            }
            resp = requests.post(
                f'{KEYCLOAK_URL}/admin/realms/{REALM}/users',
                headers={**headers, 'Content-Type': 'application/json'},
                json=user_payload
            )
            if resp.status_code == 201:
                # Get created user ID from Location header
                user_id = resp.headers['Location'].split('/')[-1]
                print(f"  [CREATED] {user['username']} ({user['email']})")
            else:
                print(f"  [ERROR] Failed to create {user['username']}: {resp.text}")
                continue

        # Assign role to user
        role_name = user['role']
        if role_name in role_map:
            role = role_map[role_name]
            resp = requests.post(
                f'{KEYCLOAK_URL}/admin/realms/{REALM}/users/{user_id}/role-mappings/realm',
                headers={**headers, 'Content-Type': 'application/json'},
                json=[role]
            )
            if resp.status_code == 204:
                print(f"      [ROLE] Assigned '{role_name}' to {user['username']}")
            elif resp.status_code == 409:
                print(f"      [ROLE] '{role_name}' already assigned to {user['username']}")
            else:
                print(f"      [ERROR] Failed to assign role: {resp.status_code}")


def verify_setup(headers):
    """Verify the final setup"""
    print(f"\n[5] VERIFICATION")
    print("-" * 50)

    # List realms
    realms = requests.get(f'{KEYCLOAK_URL}/admin/realms', headers=headers).json()
    print(f"  Realms: {[r['realm'] for r in realms if r.get('enabled')]}")

    # List roles
    roles = requests.get(f'{KEYCLOAK_URL}/admin/realms/{REALM}/roles', headers=headers).json()
    app_roles = [r['name'] for r in roles if not r['name'].startswith('default-') and not r['name'].startswith('offline') and not r['name'].startswith('uma')]
    print(f"  {REALM} Roles: {app_roles}")

    # List clients
    clients = requests.get(f'{KEYCLOAK_URL}/admin/realms/{REALM}/clients', headers=headers).json()
    app_clients = [c['clientId'] for c in clients if not c['clientId'].startswith('account') and not c['clientId'].startswith('admin-') and not c['clientId'].startswith('realm-') and not c['clientId'].startswith('broker') and not c['clientId'].startswith('security-admin')]
    print(f"  {REALM} Clients: {app_clients}")

    # List users with roles
    users = requests.get(f'{KEYCLOAK_URL}/admin/realms/{REALM}/users', headers=headers).json()
    print(f"  {REALM} Users:")
    for user in users:
        user_id = user['id']
        user_roles = requests.get(
            f'{KEYCLOAK_URL}/admin/realms/{REALM}/users/{user_id}/role-mappings/realm',
            headers=headers
        ).json()
        role_names = [r['name'] for r in user_roles if not r['name'].startswith('default-') and not r['name'].startswith('offline') and not r['name'].startswith('uma')]
        print(f"    - {user['username']} ({user.get('email', 'N/A')}): {role_names}")


def main():
    print("=" * 70)
    print("KEYCLOAK SETUP - UNIFIED ROLE/TENANT CONFIGURATION")
    print("=" * 70)

    token = get_admin_token()
    headers = {'Authorization': f'Bearer {token}'}

    # Step 1: Delete unused realms
    delete_unused_realms(headers)

    # Step 2: Ensure roles exist
    ensure_roles(headers)

    # Step 3: Ensure clients exist
    ensure_clients(headers)

    # Step 4: Ensure test users exist
    ensure_users(headers)

    # Step 5: Verify setup
    verify_setup(headers)

    print("\n" + "=" * 70)
    print("SETUP COMPLETE!")
    print("=" * 70)
    print("""
Test Users (all password: Test123!):
  - superadmin@platform.local (super_admin)
  - owner@test.local (owner)
  - admin@test.local (admin)
  - engineer@test.local (engineer)
  - analyst@test.local (analyst)
  - cbpadmin / admin@cbp.local (super_admin - existing)

Clients:
  - admin-app: Admin Portal (port 27555)
  - cbp-frontend: Customer Portal (port 27100)

Both portals use realm: ananta-saas
""")


if __name__ == '__main__':
    main()
