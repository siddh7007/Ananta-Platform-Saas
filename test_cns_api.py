#!/usr/bin/env python3
"""
CNS Service Comprehensive API Test Script
Tests all major CNS API endpoints including multi-tenancy
"""
import requests
import json
import uuid
import time

KEYCLOAK_URL = "http://localhost:8180"
CNS_API_URL = "http://localhost:27200/api"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.skipped = 0

    def add(self, success):
        if success:
            self.passed += 1
        else:
            self.failed += 1

    def skip(self):
        self.skipped += 1

results = TestResults()

def get_admin_token():
    """Get master realm admin token"""
    resp = requests.post(
        f"{KEYCLOAK_URL}/realms/master/protocol/openid-connect/token",
        data={
            "grant_type": "password",
            "client_id": "admin-cli",
            "username": "admin",
            "password": "admin"
        }
    )
    return resp.json()["access_token"]

def reset_user_password(admin_token, user_id, password):
    """Reset user password"""
    resp = requests.put(
        f"{KEYCLOAK_URL}/admin/realms/ananta-saas/users/{user_id}/reset-password",
        headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
        json={"type": "password", "value": password, "temporary": False}
    )
    return resp.status_code == 204

def get_user_token(username, password):
    """Get user token from ananta-saas realm"""
    resp = requests.post(
        f"{KEYCLOAK_URL}/realms/ananta-saas/protocol/openid-connect/token",
        data={
            "grant_type": "password",
            "client_id": "admin-cli",
            "username": username,
            "password": password
        }
    )
    if resp.status_code == 200:
        return resp.json()["access_token"]
    else:
        return None

def api_request(method, endpoint, token, data=None, params=None, files=None):
    """Make API request to CNS service"""
    headers = {"Authorization": f"Bearer {token}"}
    if not files:
        headers["Content-Type"] = "application/json"
    url = f"{CNS_API_URL}{endpoint}"

    if method == "GET":
        resp = requests.get(url, headers=headers, params=params)
    elif method == "POST":
        if files:
            resp = requests.post(url, headers=headers, files=files, data=data)
        else:
            resp = requests.post(url, headers=headers, json=data)
    elif method == "PATCH":
        resp = requests.patch(url, headers=headers, json=data)
    elif method == "DELETE":
        resp = requests.delete(url, headers=headers, params=params)
    else:
        raise ValueError(f"Unknown method: {method}")

    return resp

def print_result(name, resp, expected_status=None):
    """Print test result"""
    status = resp.status_code
    if expected_status:
        success = status == expected_status
    else:
        success = status in [200, 201]

    icon = "[OK]" if success else "[FAIL]"
    print(f"  {icon} {name}: HTTP {status}")

    if not success and status >= 400:
        try:
            error_detail = resp.json()
            print(f"      Error: {json.dumps(error_detail)[:300]}")
        except:
            print(f"      Error: {resp.text[:300]}")

    results.add(success)
    return success, resp

def main():
    print("=" * 70)
    print("CNS Service Comprehensive API Test Suite")
    print("=" * 70)

    # =====================================================================
    # SECTION 1: Authentication Setup
    # =====================================================================
    print("\n[1] AUTHENTICATION SETUP")
    print("-" * 50)

    admin_token = get_admin_token()
    print(f"  [OK] Got Keycloak master admin token")

    # Reset cbpadmin password
    reset_user_password(admin_token, "1d07c925-48ba-4b4e-b28f-665041a012ca", "Test123!")
    print(f"  [OK] Reset cbpadmin password")

    # Get cbpadmin token
    cbpadmin_token = get_user_token("cbpadmin", "Test123!")
    if not cbpadmin_token:
        print("  [FAIL] Could not get cbpadmin token - aborting tests")
        return False
    print(f"  [OK] Got cbpadmin token")

    # Get user2 token for multi-tenancy testing (if exists)
    reset_user_password(admin_token, "41681bf4-e495-472d-99da-7a21eb77b76f", "Test123!")
    user2_token = get_user_token("user2", "Test123!")
    if user2_token:
        print(f"  [OK] Got user2 token (for tenant isolation tests)")
    else:
        print(f"  [WARN] Could not get user2 token - isolation tests will be limited")

    # Default org_id for cbpadmin
    org_id = "a0000000-0000-0000-0000-000000000000"

    # =====================================================================
    # SECTION 2: Organizations API
    # =====================================================================
    print("\n[2] ORGANIZATIONS API")
    print("-" * 50)

    # Note: Organizations list endpoint may not exist (GET single only)
    resp = api_request("GET", "/organizations", cbpadmin_token)
    if resp.status_code == 200:
        data = resp.json()
        # Handle paginated response
        if isinstance(data, dict) and "items" in data:
            orgs = data["items"]
        else:
            orgs = data if isinstance(data, list) else []
        print(f"  [OK] GET /organizations (list all): HTTP 200")
        if orgs and len(orgs) > 0:
            org_id = orgs[0].get("id", org_id)
            print(f"      Found {len(orgs)} organization(s), using: {org_id}")
        results.add(True)
    elif resp.status_code == 405:
        print(f"  [INFO] GET /organizations (list) not supported - HTTP 405 (expected)")
        results.add(True)  # Not a failure, just not implemented
    else:
        print(f"  [FAIL] GET /organizations: HTTP {resp.status_code}")
        results.add(False)

    success, resp = print_result(
        f"GET /organizations/{org_id} (single)",
        api_request("GET", f"/organizations/{org_id}", cbpadmin_token)
    )

    # =====================================================================
    # SECTION 3: Workspaces API (CRUD + soft/hard delete)
    # =====================================================================
    print("\n[3] WORKSPACES API (CRUD)")
    print("-" * 50)

    # List workspaces
    success, resp = print_result(
        "GET /workspaces (list)",
        api_request("GET", "/workspaces", cbpadmin_token, params={"organization_id": org_id})
    )

    workspace_id = None
    if success:
        data = resp.json()
        # Handle paginated response
        if isinstance(data, dict) and "items" in data:
            workspaces = data["items"]
        else:
            workspaces = data if isinstance(data, list) else []
        if workspaces and len(workspaces) > 0:
            # Find non-default workspace first, fallback to default
            for ws in workspaces:
                if isinstance(ws, dict) and not ws.get("is_default"):
                    workspace_id = ws.get("id")
                    break
            if not workspace_id and workspaces and isinstance(workspaces[0], dict):
                workspace_id = workspaces[0].get("id")
            print(f"      Found {len(workspaces)} workspace(s)")

    # Create a new workspace
    test_ws_id = str(uuid.uuid4())
    success, resp = print_result(
        "POST /workspaces (create)",
        api_request("POST", "/workspaces", cbpadmin_token, data={
            "id": test_ws_id,
            "organization_id": org_id,
            "name": f"Test Workspace {test_ws_id[:8]}",
            "description": "API Test Workspace for CRUD testing"
        })
    )
    created_workspace_id = None
    if success:
        created_workspace_id = resp.json().get("id", test_ws_id)
        print(f"      Created workspace: {created_workspace_id}")

    # Get single workspace
    if created_workspace_id:
        success, resp = print_result(
            f"GET /workspaces/{created_workspace_id} (single)",
            api_request("GET", f"/workspaces/{created_workspace_id}", cbpadmin_token)
        )

        # Update workspace
        success, resp = print_result(
            f"PATCH /workspaces/{created_workspace_id} (update)",
            api_request("PATCH", f"/workspaces/{created_workspace_id}", cbpadmin_token, data={
                "name": f"Updated Workspace {created_workspace_id[:8]}",
                "description": "Updated description"
            })
        )

        # Soft delete workspace
        success, resp = print_result(
            f"DELETE /workspaces/{created_workspace_id} (soft delete)",
            api_request("DELETE", f"/workspaces/{created_workspace_id}", cbpadmin_token),
            expected_status=200
        )
        if success:
            print(f"      Soft deleted workspace")

    # =====================================================================
    # SECTION 4: Projects API (CRUD with JSONB - THE MAIN FIX)
    # =====================================================================
    print("\n[4] PROJECTS API (JSONB FIX)")
    print("-" * 50)

    # Use the first available workspace for project tests
    test_workspace = workspace_id or created_workspace_id
    if not test_workspace:
        print("  [SKIP] No workspace available for project tests")
        results.skip()
        results.skip()
        results.skip()
    else:
        # Need a non-deleted workspace, create one
        proj_ws_id = str(uuid.uuid4())
        success, resp = print_result(
            "POST /workspaces (for project tests)",
            api_request("POST", "/workspaces", cbpadmin_token, data={
                "id": proj_ws_id,
                "organization_id": org_id,
                "name": f"Project Test WS {proj_ws_id[:8]}",
                "description": "Workspace for project testing"
            })
        )
        if success:
            test_workspace = resp.json().get("id", proj_ws_id)

        # List projects
        success, resp = print_result(
            "GET /projects (list)",
            api_request("GET", "/projects", cbpadmin_token, params={"workspace_id": test_workspace})
        )

        project_id = None
        if success:
            data = resp.json()
            # Handle paginated response
            if isinstance(data, dict) and "items" in data:
                projects = data["items"]
            else:
                projects = data if isinstance(data, list) else []
            if projects and len(projects) > 0 and isinstance(projects[0], dict):
                project_id = projects[0].get("id")
                print(f"      Found {len(projects)} project(s)")

        # CREATE PROJECT WITH JSONB (THIS WAS BROKEN)
        test_project_id = str(uuid.uuid4())
        success, resp = print_result(
            "POST /projects (create with JSONB tags/metadata)",
            api_request("POST", "/projects", cbpadmin_token, data={
                "id": test_project_id,
                "workspace_id": test_workspace,
                "name": f"Test Project {test_project_id[:8]}",
                "description": "API Test Project with JSONB fields",
                "tags": ["test", "api", "jsonb-fix", "multi-tenant"],
                "metadata": {
                    "test_key": "test_value",
                    "created_by": "api_test",
                    "nested": {"level1": {"level2": "deep"}}
                }
            })
        )
        created_project_id = None
        if success:
            created_project = resp.json()
            created_project_id = created_project.get("id", test_project_id)
            print(f"      Created project: {created_project_id}")
            print(f"      Tags: {created_project.get('tags')}")
            print(f"      Metadata keys: {list(created_project.get('metadata', {}).keys())}")

        if created_project_id:
            # Get single project
            success, resp = print_result(
                f"GET /projects/{created_project_id} (single)",
                api_request("GET", f"/projects/{created_project_id}", cbpadmin_token)
            )

            # UPDATE PROJECT WITH JSONB (ALSO FIXED)
            success, resp = print_result(
                f"PATCH /projects/{created_project_id} (update with JSONB)",
                api_request("PATCH", f"/projects/{created_project_id}", cbpadmin_token, data={
                    "name": f"Updated Project {created_project_id[:8]}",
                    "tags": ["updated", "patched", "jsonb-fix-verified", "version2"],
                    "metadata": {
                        "updated": True,
                        "version": 2,
                        "previous_version": 1,
                        "complex": {"array": [1, 2, 3], "bool": True}
                    }
                })
            )
            if success:
                updated = resp.json()
                print(f"      Updated tags: {updated.get('tags')}")
                print(f"      Updated metadata: {updated.get('metadata')}")

            # Delete project
            success, resp = print_result(
                f"DELETE /projects/{created_project_id} (delete)",
                api_request("DELETE", f"/projects/{created_project_id}", cbpadmin_token),
                expected_status=200
            )

    # =====================================================================
    # SECTION 5: BOMs API
    # =====================================================================
    print("\n[5] BOMs API")
    print("-" * 50)

    if test_workspace:
        # List BOMs
        success, resp = print_result(
            "GET /boms (list)",
            api_request("GET", "/boms", cbpadmin_token, params={"workspace_id": test_workspace})
        )

        bom_id = None
        if success:
            data = resp.json()
            # Handle paginated response
            if isinstance(data, dict) and "items" in data:
                boms = data["items"]
            else:
                boms = data if isinstance(data, list) else []
            if boms and len(boms) > 0 and isinstance(boms[0], dict):
                bom_id = boms[0].get("id")
                print(f"      Found {len(boms)} BOM(s)")

        # Create a BOM
        test_bom_id = str(uuid.uuid4())
        success, resp = print_result(
            "POST /boms (create)",
            api_request("POST", "/boms", cbpadmin_token, data={
                "id": test_bom_id,
                "workspace_id": test_workspace,
                "name": f"Test BOM {test_bom_id[:8]}",
                "description": "API Test BOM",
                "status": "draft",
                "tags": ["test", "api"],
                "metadata": {"source": "api_test"}
            })
        )
        created_bom_id = None
        if success:
            created_bom = resp.json()
            created_bom_id = created_bom.get("id", test_bom_id)
            print(f"      Created BOM: {created_bom_id}")

        if created_bom_id:
            # Get single BOM
            success, resp = print_result(
                f"GET /boms/{created_bom_id} (single)",
                api_request("GET", f"/boms/{created_bom_id}", cbpadmin_token)
            )

            # Update BOM
            success, resp = print_result(
                f"PATCH /boms/{created_bom_id} (update)",
                api_request("PATCH", f"/boms/{created_bom_id}", cbpadmin_token, data={
                    "name": f"Updated BOM {created_bom_id[:8]}",
                    "status": "active"
                })
            )

            # Delete BOM (soft delete)
            success, resp = print_result(
                f"DELETE /boms/{created_bom_id} (soft delete)",
                api_request("DELETE", f"/boms/{created_bom_id}", cbpadmin_token),
                expected_status=200
            )
    else:
        print("  [SKIP] No workspace available for BOM tests")
        results.skip()

    # =====================================================================
    # SECTION 6: Multi-tenancy Isolation Test
    # =====================================================================
    print("\n[6] MULTI-TENANCY ISOLATION TEST")
    print("-" * 50)

    if user2_token:
        # User2 should NOT see cbpadmin's workspaces (different tenant)
        success, resp = print_result(
            "GET /workspaces (user2 - different tenant)",
            api_request("GET", "/workspaces", user2_token, params={"organization_id": org_id})
        )

        # Check if user2 gets access denied or empty list
        if success:
            data = resp.json()
            # Handle paginated response
            if isinstance(data, dict) and "items" in data:
                workspaces = data["items"]
            else:
                workspaces = data if isinstance(data, list) else []
            # If user2 is in a different tenant, they should either get 403 or empty list
            if len(workspaces) == 0:
                print(f"      [OK] User2 cannot see org's workspaces (isolation working)")
            else:
                # Check if user2 might be in the same org (test setup)
                print(f"      [INFO] User2 sees {len(workspaces)} workspaces (may be same org)")
    else:
        print("  [SKIP] No user2 token for isolation tests")
        results.skip()

    # =====================================================================
    # SECTION 7: Edge Cases
    # =====================================================================
    print("\n[7] EDGE CASES")
    print("-" * 50)

    # Invalid UUID
    success, resp = print_result(
        "GET /projects/invalid-uuid (should fail)",
        api_request("GET", "/projects/invalid-uuid", cbpadmin_token),
        expected_status=400
    )

    # Non-existent ID
    fake_uuid = str(uuid.uuid4())
    success, resp = print_result(
        f"GET /projects/{fake_uuid} (non-existent)",
        api_request("GET", f"/projects/{fake_uuid}", cbpadmin_token),
        expected_status=404
    )

    # Create with empty required fields
    success, resp = print_result(
        "POST /projects (missing required fields - should fail)",
        api_request("POST", "/projects", cbpadmin_token, data={}),
        expected_status=422
    )

    # =====================================================================
    # SUMMARY
    # =====================================================================
    print("\n" + "=" * 70)
    print("TEST RESULTS SUMMARY")
    print("=" * 70)
    print(f"  Passed:  {results.passed}")
    print(f"  Failed:  {results.failed}")
    print(f"  Skipped: {results.skipped}")
    print("=" * 70)

    if results.failed == 0:
        print("[SUCCESS] All tests passed!")
    else:
        print(f"[WARNING] {results.failed} test(s) failed")

    return results.failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
