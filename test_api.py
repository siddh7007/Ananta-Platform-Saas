#!/usr/bin/env python3
"""Quick CNS API test"""
import requests
import json
import uuid

KEYCLOAK_URL = 'http://localhost:8180'
CNS_API_URL = 'http://localhost:27200/api'

def get_token():
    resp = requests.post(f'{KEYCLOAK_URL}/realms/ananta-saas/protocol/openid-connect/token',
        data={'grant_type': 'password', 'client_id': 'admin-cli', 'username': 'cbpadmin', 'password': 'Test123!'})
    return resp.json()['access_token']

token = get_token()
org_id = 'a0000000-0000-0000-0000-000000000000'

print('=' * 70)
print('CNS SERVICE API TEST - COMPREHENSIVE')
print('=' * 70)

passed = 0
failed = 0

def check(name, status_code, expected):
    global passed, failed
    ok = status_code in expected if isinstance(expected, list) else status_code == expected
    if ok:
        passed += 1
        print(f'  [OK] {name}: HTTP {status_code}')
    else:
        failed += 1
        print(f'  [FAIL] {name}: HTTP {status_code}')
    return ok

# ===============================
# WORKSPACES
# ===============================
print('\n[1] WORKSPACES API')
print('-' * 50)

resp = requests.get(f'{CNS_API_URL}/workspaces', headers={'Authorization': f'Bearer {token}'}, params={'organization_id': org_id})
check('GET /workspaces', resp.status_code, 200)
ws_data = resp.json()
workspace_id = ws_data['items'][0]['id'] if ws_data.get('items') else None
print(f'      Found {len(ws_data.get("items", []))} workspace(s)')

test_ws_id = str(uuid.uuid4())
resp = requests.post(f'{CNS_API_URL}/workspaces', headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
    json={'id': test_ws_id, 'organization_id': org_id, 'name': f'Test WS {test_ws_id[:8]}', 'description': 'API Test'})
check('POST /workspaces', resp.status_code, 201)
created_ws_id = resp.json().get('id') if resp.status_code == 201 else None

if created_ws_id:
    # Note: Workspace update uses PUT, not PATCH
    resp = requests.put(f'{CNS_API_URL}/workspaces/{created_ws_id}', headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
        json={'name': 'Updated WS', 'description': 'Updated'})
    check(f'PUT /workspaces/{created_ws_id[:8]}...', resp.status_code, 200)

if created_ws_id:
    resp = requests.delete(f'{CNS_API_URL}/workspaces/{created_ws_id}', headers={'Authorization': f'Bearer {token}'})
    check(f'DELETE /workspaces/{created_ws_id[:8]}...', resp.status_code, [200, 204])

# ===============================
# PROJECTS (MAIN FIX)
# ===============================
print('\n[2] PROJECTS API (text[] tags fix)')
print('-' * 50)

proj_ws_id = str(uuid.uuid4())
resp = requests.post(f'{CNS_API_URL}/workspaces', headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
    json={'id': proj_ws_id, 'organization_id': org_id, 'name': 'Project Test WS', 'description': 'For project testing'})
proj_ws = resp.json().get('id') if resp.status_code == 201 else workspace_id

resp = requests.get(f'{CNS_API_URL}/projects', headers={'Authorization': f'Bearer {token}'}, params={'workspace_id': proj_ws})
check('GET /projects', resp.status_code, 200)

test_proj_id = str(uuid.uuid4())
resp = requests.post(f'{CNS_API_URL}/projects', headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
    json={
        'id': test_proj_id,
        'workspace_id': proj_ws,
        'name': f'Test Project {test_proj_id[:8]}',
        'description': 'Project with tags and metadata',
        'tags': ['test', 'api', 'fix-verified'],
        'metadata': {'version': 1, 'nested': {'key': 'value'}}
    })
if check('POST /projects (with tags/metadata)', resp.status_code, 201):
    result = resp.json()
    print(f'      Tags: {result.get("tags")}')
    print(f'      Metadata: {result.get("metadata")}')
    created_proj_id = result.get('id')
else:
    print(f'      Error: {resp.text[:200]}')
    created_proj_id = None

if created_proj_id:
    resp = requests.patch(f'{CNS_API_URL}/projects/{created_proj_id}', headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
        json={'name': 'Updated Project', 'tags': ['updated', 'v2'], 'metadata': {'updated': True, 'version': 2}})
    if check(f'PATCH /projects/{created_proj_id[:8]}...', resp.status_code, 200):
        updated = resp.json()
        print(f'      Updated Tags: {updated.get("tags")}')
        print(f'      Updated Metadata: {updated.get("metadata")}')

if created_proj_id:
    resp = requests.get(f'{CNS_API_URL}/projects/{created_proj_id}', headers={'Authorization': f'Bearer {token}'})
    check(f'GET /projects/{created_proj_id[:8]}...', resp.status_code, 200)

if created_proj_id:
    resp = requests.delete(f'{CNS_API_URL}/projects/{created_proj_id}', headers={'Authorization': f'Bearer {token}'})
    check(f'DELETE /projects/{created_proj_id[:8]}...', resp.status_code, [200, 204])

# ===============================
# BOMs (Admin API - requires admin role)
# ===============================
print('\n[3] BOMs API (Admin Lookup)')
print('-' * 50)
print('      Note: BOM creation is via /boms/upload endpoint (file upload)')
print('      Using /admin/boms for listing existing BOMs')

resp = requests.get(f'{CNS_API_URL}/admin/boms', headers={'Authorization': f'Bearer {token}'})
if check('GET /admin/boms', resp.status_code, 200):
    bom_data = resp.json()
    print(f'      Found {len(bom_data)} BOM(s)')
    if bom_data:
        bom_id = bom_data[0].get('id')
        print(f'      First BOM: {bom_id[:8] if bom_id else "N/A"}...')

        # Test BOM line items if we have a BOM
        if bom_id:
            resp = requests.get(f'{CNS_API_URL}/boms/{bom_id}/line_items', headers={'Authorization': f'Bearer {token}'})
            if check(f'GET /boms/{bom_id[:8]}.../line_items', resp.status_code, 200):
                items = resp.json()
                print(f'      Line items: {items.get("total", 0)} items')
else:
    print(f'      Error: {resp.text[:200]}')

# ===============================
# Summary
# ===============================
print('\n' + '=' * 70)
print(f'RESULTS: {passed} passed, {failed} failed')
print('=' * 70)
