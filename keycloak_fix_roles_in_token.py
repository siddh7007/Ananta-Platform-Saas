#!/usr/bin/env python3
"""
Fix Keycloak to include realm roles in access tokens

By default, Keycloak doesn't include realm roles in access tokens.
This script creates a client scope/mapper to include them.
"""
import requests
import json

KEYCLOAK_URL = 'http://localhost:8180'
REALM = 'ananta-saas'


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
    print("=" * 70)
    print("KEYCLOAK: FIX ROLES IN ACCESS TOKEN")
    print("=" * 70)

    token = get_admin_token()
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    # Step 1: Get or create a client scope for roles
    print("\n[1] Creating/updating 'roles' client scope...")

    # Check if 'roles' scope exists
    scopes_resp = requests.get(
        f'{KEYCLOAK_URL}/admin/realms/{REALM}/client-scopes',
        headers=headers
    )
    scopes = scopes_resp.json()
    roles_scope = next((s for s in scopes if s['name'] == 'roles'), None)

    if not roles_scope:
        # Create the roles scope
        scope_payload = {
            'name': 'roles',
            'description': 'OpenID Connect scope for roles',
            'protocol': 'openid-connect',
            'attributes': {
                'include.in.token.scope': 'true',
                'display.on.consent.screen': 'false'
            }
        }
        resp = requests.post(
            f'{KEYCLOAK_URL}/admin/realms/{REALM}/client-scopes',
            headers=headers,
            json=scope_payload
        )
        if resp.status_code == 201:
            print("  [CREATED] 'roles' client scope")
            # Get the created scope ID
            scopes_resp = requests.get(
                f'{KEYCLOAK_URL}/admin/realms/{REALM}/client-scopes',
                headers=headers
            )
            scopes = scopes_resp.json()
            roles_scope = next((s for s in scopes if s['name'] == 'roles'), None)
        else:
            print(f"  [ERROR] Failed to create scope: {resp.text}")
            return
    else:
        print("  [EXISTS] 'roles' client scope")

    scope_id = roles_scope['id']

    # Step 2: Create protocol mapper for realm roles
    print("\n[2] Creating realm roles mapper...")

    # Check existing mappers
    mappers_resp = requests.get(
        f'{KEYCLOAK_URL}/admin/realms/{REALM}/client-scopes/{scope_id}/protocol-mappers/models',
        headers=headers
    )
    mappers = mappers_resp.json()
    realm_mapper = next((m for m in mappers if m['name'] == 'realm roles'), None)

    if not realm_mapper:
        mapper_payload = {
            'name': 'realm roles',
            'protocol': 'openid-connect',
            'protocolMapper': 'oidc-usermodel-realm-role-mapper',
            'consentRequired': False,
            'config': {
                'multivalued': 'true',
                'userinfo.token.claim': 'true',
                'id.token.claim': 'true',
                'access.token.claim': 'true',
                'claim.name': 'realm_access.roles',
                'jsonType.label': 'String'
            }
        }
        resp = requests.post(
            f'{KEYCLOAK_URL}/admin/realms/{REALM}/client-scopes/{scope_id}/protocol-mappers/models',
            headers=headers,
            json=mapper_payload
        )
        if resp.status_code == 201:
            print("  [CREATED] realm roles mapper")
        else:
            print(f"  [ERROR] Failed to create mapper: {resp.text}")
    else:
        print("  [EXISTS] realm roles mapper")

    # Step 3: Add the roles scope to both clients
    print("\n[3] Adding 'roles' scope to clients...")

    clients_resp = requests.get(
        f'{KEYCLOAK_URL}/admin/realms/{REALM}/clients',
        headers=headers
    )
    clients = clients_resp.json()

    for client_id in ['admin-app', 'cbp-frontend', 'admin-cli']:
        client = next((c for c in clients if c['clientId'] == client_id), None)
        if not client:
            print(f"  [SKIP] Client '{client_id}' not found")
            continue

        client_uuid = client['id']

        # Add as default scope
        resp = requests.put(
            f'{KEYCLOAK_URL}/admin/realms/{REALM}/clients/{client_uuid}/default-client-scopes/{scope_id}',
            headers=headers
        )
        if resp.status_code == 204:
            print(f"  [ADDED] 'roles' scope to {client_id}")
        else:
            # Check if already added
            default_scopes = requests.get(
                f'{KEYCLOAK_URL}/admin/realms/{REALM}/clients/{client_uuid}/default-client-scopes',
                headers=headers
            ).json()
            if any(s['name'] == 'roles' for s in default_scopes):
                print(f"  [EXISTS] 'roles' scope already on {client_id}")
            else:
                print(f"  [WARN] {client_id}: {resp.status_code}")

    print("\n" + "=" * 70)
    print("DONE! Roles should now appear in access tokens.")
    print("=" * 70)


if __name__ == '__main__':
    main()
