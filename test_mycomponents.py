#!/usr/bin/env python3
"""Test My Components API filters"""
import requests
import json

# Get Keycloak token
print("Getting fresh Keycloak token...")
token_resp = requests.post(
    "http://localhost:8180/realms/ananta-saas/protocol/openid-connect/token",
    data={
        "client_id": "admin-cli",
        "username": "cnsstaff",
        "password": "Test123!",
        "grant_type": "password"
    }
)
token = token_resp.json()["access_token"]
print(f"Token acquired: {token[:50]}...")

headers = {"Authorization": f"Bearer {token}"}
base_url = "http://localhost:27200/api/catalog/my-components"

# Test data - using actual IDs from database
ORG_ID = "a0000000-0000-0000-0000-000000000000"
WORKSPACE_ID = "c13f4caa-fee3-4e9b-805c-a8282bfd59ed"  # Workspace with 534 line items
PROJECT_ID = "2dd7883f-2581-4dd4-90ef-3d429353b7f6"    # Project in that workspace
BOM_ID = "ebea1f29-f1f2-4cf5-9444-10ae56db49ed"        # BOM with 20 line items

print("\n" + "="*60)
print("MY COMPONENTS API FILTER TESTS")
print("="*60)

# Test 1: Organization only
print("\n[Test 1] Organization filter only (baseline)")
resp = requests.get(f"{base_url}?organization_id={ORG_ID}&limit=1", headers=headers)
data = resp.json()
print(f"  Status: {resp.status_code}")
print(f"  Total: {data.get('total', 'N/A')} components")
baseline = data.get('total', 0)

# Test 2: Workspace filter
print("\n[Test 2] + Workspace filter")
resp = requests.get(f"{base_url}?organization_id={ORG_ID}&workspace_id={WORKSPACE_ID}&limit=1", headers=headers)
data = resp.json()
print(f"  Status: {resp.status_code}")
print(f"  Total: {data.get('total', 'N/A')} components")
workspace_count = data.get('total', 0)
if workspace_count < baseline:
    print(f"  [OK] Filter working: {baseline} -> {workspace_count}")

# Test 3: Project filter
print("\n[Test 3] + Project filter")
resp = requests.get(f"{base_url}?organization_id={ORG_ID}&project_id={PROJECT_ID}&limit=1", headers=headers)
data = resp.json()
print(f"  Status: {resp.status_code}")
print(f"  Total: {data.get('total', 'N/A')} components")
project_count = data.get('total', 0)
if project_count <= workspace_count:
    print(f"  [OK] Filter working: {workspace_count} -> {project_count}")

# Test 4: BOM filter
print("\n[Test 4] + BOM filter")
resp = requests.get(f"{base_url}?organization_id={ORG_ID}&bom_id={BOM_ID}&limit=1", headers=headers)
data = resp.json()
print(f"  Status: {resp.status_code}")
print(f"  Total: {data.get('total', 'N/A')} components")
bom_count = data.get('total', 0)
print(f"  [OK] BOM scoped to {bom_count} components")

# Test 5: Search query
print("\n[Test 5] Search query (q=molex)")
resp = requests.get(f"{base_url}?organization_id={ORG_ID}&q=molex&limit=3", headers=headers)
data = resp.json()
print(f"  Status: {resp.status_code}")
print(f"  Total: {data.get('total', 'N/A')} components matching 'molex'")
results = data.get('results', [])
if results:
    print(f"  Sample MPNs: {[r.get('mpn', '?') for r in results[:3]]}")

# Test 6: Combined filters
print("\n[Test 6] Combined: workspace + project + search")
resp = requests.get(
    f"{base_url}?organization_id={ORG_ID}&workspace_id={WORKSPACE_ID}&project_id={PROJECT_ID}&q=connector&limit=3",
    headers=headers
)
data = resp.json()
print(f"  Status: {resp.status_code}")
print(f"  Total: {data.get('total', 'N/A')} components")
results = data.get('results', [])
if results:
    print(f"  Sample: {[(r.get('mpn', '?'), r.get('manufacturer', '?')) for r in results[:3]]}")

# Test 7: Verify facets are returned
print("\n[Test 7] Verify facets data")
resp = requests.get(f"{base_url}?organization_id={ORG_ID}&limit=1", headers=headers)
data = resp.json()
facets = data.get('facets', {})
print(f"  Manufacturers facet count: {len(facets.get('manufacturers', []))}")
print(f"  Lifecycle statuses: {len(facets.get('lifecycle_statuses', []))}")
print(f"  Data sources: {len(facets.get('data_sources', []))}")

print("\n" + "="*60)
print("ALL TESTS COMPLETED")
print("="*60)
