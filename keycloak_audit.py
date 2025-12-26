#!/usr/bin/env python3
"""Keycloak audit script to check realm configuration"""
import requests
import json

KEYCLOAK_URL = 'http://localhost:8180'

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
    return resp.json()['access_token']

def main():
    token = get_admin_token()
    headers = {'Authorization': f'Bearer {token}'}

    print("=" * 70)
    print("KEYCLOAK AUDIT REPORT")
    print("=" * 70)

    # List all realms
    print("\n[1] ALL REALMS")
    print("-" * 50)
    realms = requests.get(f'{KEYCLOAK_URL}/admin/realms', headers=headers).json()
    for r in realms:
        status = "ENABLED" if r.get('enabled') else "DISABLED"
        print(f"  - {r['realm']}: {status}")

    # Focus on ananta-saas realm
    realm = 'ananta-saas'
    print(f"\n[2] REALM: {realm} - ROLES")
    print("-" * 50)
    roles = requests.get(f'{KEYCLOAK_URL}/admin/realms/{realm}/roles', headers=headers).json()
    for role in roles:
        print(f"  - {role['name']}: {role.get('description', 'No description')}")

    print(f"\n[3] REALM: {realm} - CLIENTS")
    print("-" * 50)
    clients = requests.get(f'{KEYCLOAK_URL}/admin/realms/{realm}/clients', headers=headers).json()
    for client in clients:
        client_id = client['clientId']
        is_public = client.get('publicClient', False)
        enabled = client.get('enabled', False)
        if not client_id.startswith('account') and not client_id.startswith('admin-') and not client_id.startswith('realm-') and not client_id.startswith('broker') and not client_id.startswith('security-admin'):
            print(f"  - {client_id}: public={is_public}, enabled={enabled}")
            # Get client roles
            client_uuid = client['id']
            client_roles = requests.get(
                f'{KEYCLOAK_URL}/admin/realms/{realm}/clients/{client_uuid}/roles',
                headers=headers
            ).json()
            if client_roles:
                for cr in client_roles:
                    print(f"      Role: {cr['name']}")

    print(f"\n[4] REALM: {realm} - USERS")
    print("-" * 50)
    users = requests.get(f'{KEYCLOAK_URL}/admin/realms/{realm}/users', headers=headers).json()
    for user in users:
        username = user.get('username', 'N/A')
        email = user.get('email', 'N/A')
        enabled = user.get('enabled', False)
        print(f"  - {username} ({email}) - enabled={enabled}")

        # Get user's realm roles
        user_id = user['id']
        user_roles = requests.get(
            f'{KEYCLOAK_URL}/admin/realms/{realm}/users/{user_id}/role-mappings/realm',
            headers=headers
        ).json()
        if user_roles:
            role_names = [r['name'] for r in user_roles]
            print(f"      Realm Roles: {role_names}")

    print("\n" + "=" * 70)
    print("RECOMMENDATIONS")
    print("=" * 70)
    print("""
1. Delete unused realms: arc-saas, cbp-users, tenant-demo, components-platform
2. Keep only: master (admin), ananta-saas (unified)
3. Create unified 5-level roles in ananta-saas realm:
   - super_admin, owner, admin, engineer, analyst
4. Create clients:
   - admin-app (Admin Portal)
   - cbp-frontend (Customer Portal)
5. Create test users for each role level
""")

if __name__ == '__main__':
    main()