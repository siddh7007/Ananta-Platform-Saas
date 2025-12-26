#!/usr/bin/env python3
"""
Business Logic Testing for Workspace Management

Tests the following business rules:
1. Admin role requirement for workspace updates
2. Default workspace deletion protection
3. Staff bypass functionality (cross-tenant access)
4. Role-based access control in workspace operations

Dependencies:
- CNS Service running on http://localhost:27200
- Supabase DB with test users and workspaces
- Valid JWT tokens for different user roles
"""

import os
import sys
import json
import requests
import logging
from typing import Optional, Dict, Any
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# API Configuration
API_BASE_URL = os.getenv("CNS_API_URL", "http://localhost:27200/api")
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "dev-ananta.us.auth0.com")
AUTH0_CLIENT_ID = os.getenv("AUTH0_CLIENT_ID", "")
AUTH0_CLIENT_SECRET = os.getenv("AUTH0_CLIENT_SECRET", "")


# =============================================================================
# Test Data Setup
# =============================================================================

# Test users (will be created in DB if needed)
TEST_USERS = {
    "admin": {
        "email": "admin@test.local",
        "auth0_user_id": "auth0|admin-test",
        "full_name": "Admin User",
        "role": "admin"
    },
    "analyst": {
        "email": "analyst@test.local",
        "auth0_user_id": "auth0|analyst-test",
        "full_name": "Analyst User",
        "role": "analyst"
    },
    "platform_staff": {
        "email": "staff@test.local",
        "auth0_user_id": "auth0|staff-test",
        "full_name": "Platform Staff",
        "is_platform_admin": True
    }
}


# =============================================================================
# Database Helper Functions
# =============================================================================

def execute_sql(sql: str, params: Dict[str, Any] = None) -> list:
    """Execute SQL query against Supabase DB."""
    import subprocess

    # Format SQL with parameters
    if params:
        for key, value in params.items():
            if isinstance(value, str):
                sql = sql.replace(f":{key}", f"'{value}'")
            elif isinstance(value, bool):
                sql = sql.replace(f":{key}", "true" if value else "false")
            else:
                sql = sql.replace(f":{key}", str(value))

    cmd = [
        "docker", "exec", "-e", "PGPASSWORD=postgres",
        "app-plane-supabase-db", "psql",
        "-U", "postgres", "-d", "postgres",
        "-t", "-A", "-c", sql
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        logger.error(f"SQL error: {result.stderr}")
        return []

    # Parse output
    output = result.stdout.strip()
    if not output:
        return []

    rows = []
    for line in output.split('\n'):
        if line.strip():
            rows.append(line.split('|'))

    return rows


def create_test_user(user_data: Dict[str, Any]) -> Optional[str]:
    """Create or get test user in database."""
    # Check if user exists
    result = execute_sql(
        "SELECT id FROM users WHERE email = :email",
        {"email": user_data["email"]}
    )

    if result:
        user_id = result[0][0]
        logger.info(f"User {user_data['email']} already exists: {user_id}")
        return user_id

    # Create user
    is_platform_admin = user_data.get("is_platform_admin", False)
    sql = f"""
        INSERT INTO users (auth0_user_id, email, first_name, last_name, is_platform_admin)
        VALUES (
            '{user_data['auth0_user_id']}',
            '{user_data['email']}',
            '{user_data.get('full_name', '').split()[0]}',
            '{user_data.get('full_name', '').split()[-1] if ' ' in user_data.get('full_name', '') else ''}',
            {is_platform_admin}
        )
        RETURNING id;
    """

    result = execute_sql(sql)
    if result:
        user_id = result[0][0]
        logger.info(f"Created user {user_data['email']}: {user_id}")
        return user_id

    return None


def create_test_organization(org_name: str, owner_user_id: str) -> Optional[str]:
    """Create test organization."""
    # Check if org exists
    result = execute_sql(
        "SELECT id FROM organizations WHERE name = :name",
        {"name": org_name}
    )

    if result:
        org_id = result[0][0]
        logger.info(f"Organization {org_name} already exists: {org_id}")
        return org_id

    # Create organization
    # Note: control_plane_tenant_id is required (NOT NULL constraint)
    # Using organization UUID as tenant_id for testing
    import uuid
    tenant_id = str(uuid.uuid4())
    slug = org_name.lower().replace(' ', '-')

    sql = f"""
        INSERT INTO organizations (name, slug, control_plane_tenant_id)
        VALUES ('{org_name}', '{slug}', '{tenant_id}')
        RETURNING id;
    """

    result = execute_sql(sql)
    if not result:
        return None

    org_id = result[0][0]
    logger.info(f"Created organization {org_name}: {org_id}")

    # Add owner membership
    execute_sql(f"""
        INSERT INTO organization_memberships (organization_id, user_id, role)
        VALUES ('{org_id}', '{owner_user_id}', 'owner');
    """)

    return org_id


def create_test_workspace(
    org_id: str,
    workspace_name: str,
    creator_user_id: str,
    is_default: bool = False
) -> Optional[str]:
    """Create test workspace."""
    slug = workspace_name.lower().replace(' ', '-')

    sql = f"""
        INSERT INTO workspaces (organization_id, name, slug, created_by)
        VALUES ('{org_id}', '{workspace_name}', '{slug}', '{creator_user_id}')
        RETURNING id;
    """

    result = execute_sql(sql)
    if not result:
        return None

    workspace_id = result[0][0]
    logger.info(f"Created workspace {workspace_name}: {workspace_id}")

    return workspace_id


def add_workspace_member(workspace_id: str, user_id: str, role: str):
    """Add user to workspace with specific role."""
    execute_sql(f"""
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ('{workspace_id}', '{user_id}', '{role}')
        ON CONFLICT DO NOTHING;
    """)
    logger.info(f"Added user {user_id} to workspace {workspace_id} as {role}")


# =============================================================================
# API Helper Functions
# =============================================================================

def make_api_request(
    method: str,
    endpoint: str,
    token: str,
    data: Dict = None,
    expected_status: int = None
) -> Dict[str, Any]:
    """Make API request with JWT token."""
    url = f"{API_BASE_URL}{endpoint}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    logger.info(f"{method} {url}")

    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data)
        elif method == "PUT":
            response = requests.put(url, headers=headers, json=data)
        elif method == "PATCH":
            response = requests.patch(url, headers=headers, json=data)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)
        else:
            raise ValueError(f"Unsupported method: {method}")

        result = {
            "status": response.status_code,
            "success": response.ok,
            "data": None,
            "error": None
        }

        try:
            result["data"] = response.json()
        except:
            result["data"] = response.text

        if not response.ok:
            result["error"] = result["data"]

        # Check expected status
        if expected_status is not None:
            if response.status_code == expected_status:
                logger.info(f"+ Expected status {expected_status}")
            else:
                logger.error(f"X Expected {expected_status}, got {response.status_code}")

        return result

    except Exception as e:
        logger.error(f"API request failed: {e}")
        return {
            "status": 0,
            "success": False,
            "data": None,
            "error": str(e)
        }


def get_mock_jwt_token(user_data: Dict[str, Any]) -> str:
    """
    Generate mock JWT token for testing.

    In production, this would call Auth0 to get a real token.
    For testing, we create a simple JWT with required claims.
    """
    import jwt
    from datetime import datetime, timedelta

    # JWT payload
    payload = {
        "sub": user_data["auth0_user_id"],
        "email": user_data["email"],
        "name": user_data.get("full_name", ""),
        "email_verified": True,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=24),
        "iss": f"https://{AUTH0_DOMAIN}/",
        "aud": "test-audience"
    }

    # Sign with HS256 (for development, signature not verified)
    token = jwt.encode(payload, "test-secret", algorithm="HS256")

    return token


# =============================================================================
# Test Cases
# =============================================================================

class TestResult:
    """Test result container."""
    def __init__(self, test_name: str):
        self.test_name = test_name
        self.passed = False
        self.message = ""
        self.details = {}

    def __str__(self):
        status = "[PASS]" if self.passed else "[FAIL]"
        return f"{status} - {self.test_name}: {self.message}"


def test_1_non_admin_cannot_update_workspace(
    workspace_id: str,
    analyst_token: str
) -> TestResult:
    """Test 1: Non-admin user tries to update workspace."""
    result = TestResult("Non-admin cannot update workspace")

    # Try to update workspace as analyst (should fail with 403)
    response = make_api_request(
        "PUT",
        f"/workspaces/{workspace_id}",
        analyst_token,
        {"name": "Hacked Workspace"},
        expected_status=403
    )

    if response["status"] == 403:
        result.passed = True
        result.message = "Correctly denied non-admin user from updating workspace"
        result.details = {"error": response.get("error")}
    else:
        result.passed = False
        result.message = f"Expected 403, got {response['status']}"
        result.details = response

    return result


def test_2_admin_can_update_workspace(
    workspace_id: str,
    admin_token: str
) -> TestResult:
    """Test 2: Admin user updates workspace."""
    result = TestResult("Admin can update workspace")

    # Update workspace as admin (should succeed)
    new_name = f"Updated Workspace {datetime.now().isoformat()}"
    response = make_api_request(
        "PUT",
        f"/workspaces/{workspace_id}",
        admin_token,
        {"name": new_name, "description": "Updated by admin"},
        expected_status=200
    )

    if response["status"] == 200:
        result.passed = True
        result.message = "Admin successfully updated workspace"
        result.details = response.get("data")
    else:
        result.passed = False
        result.message = f"Expected 200, got {response['status']}"
        result.details = response

    return result


def test_3_default_workspace_deletion_check(
    workspace_id: str,
    admin_token: str
) -> TestResult:
    """Test 3: Try to delete workspace with is_default protection."""
    result = TestResult("Default workspace deletion protection")

    # IMPORTANT: is_default column doesn't exist in current schema
    # This test documents the gap

    # Try to delete workspace
    response = make_api_request(
        "DELETE",
        f"/workspaces/{workspace_id}",
        admin_token,
        expected_status=204  # Should succeed since is_default doesn't exist
    )

    # Check if deletion succeeded (gap in implementation)
    if response["status"] == 204:
        result.passed = False  # This is a gap - should have been protected
        result.message = "GAP: is_default column doesn't exist, deletion not protected"
        result.details = {
            "issue": "workspaces.py line 614 checks workspace.is_default, but column doesn't exist",
            "recommendation": "Add is_default column to workspaces table and set default workspace on creation"
        }
    elif response["status"] == 400:
        result.passed = True
        result.message = "Default workspace deletion correctly blocked"
        result.details = response.get("error")
    else:
        result.passed = False
        result.message = f"Unexpected status: {response['status']}"
        result.details = response

    return result


def test_4_non_default_workspace_deletion(
    org_id: str,
    admin_user_id: str,
    admin_token: str
) -> TestResult:
    """Test 4: Try to delete non-default workspace as admin."""
    result = TestResult("Non-default workspace deletion")

    # Create a temporary workspace for deletion test
    temp_ws_id = create_test_workspace(
        org_id,
        f"Temp Workspace {datetime.now().isoformat()}",
        admin_user_id,
        is_default=False
    )

    if not temp_ws_id:
        result.passed = False
        result.message = "Failed to create test workspace"
        return result

    # Add admin as member
    add_workspace_member(temp_ws_id, admin_user_id, "admin")

    # Try to delete
    response = make_api_request(
        "DELETE",
        f"/workspaces/{temp_ws_id}",
        admin_token,
        expected_status=204
    )

    if response["status"] == 204:
        result.passed = True
        result.message = "Non-default workspace successfully deleted"
    else:
        result.passed = False
        result.message = f"Expected 204, got {response['status']}"
        result.details = response

    return result


def test_5_staff_cross_tenant_access(
    workspace_id: str,
    staff_token: str,
    regular_org_id: str
) -> TestResult:
    """Test 5: Platform staff accessing workspace from different organization."""
    result = TestResult("Staff bypass for cross-tenant access")

    # Staff user accesses workspace without being a member
    # Should succeed due to is_platform_admin bypass
    response = make_api_request(
        "GET",
        f"/workspaces/{workspace_id}",
        staff_token,
        expected_status=200
    )

    if response["status"] == 200:
        result.passed = True
        result.message = "Staff bypass correctly allowed cross-tenant access"
        result.details = response.get("data")
    else:
        result.passed = False
        result.message = f"Expected 200, got {response['status']}"
        result.details = response

    return result


def test_6_regular_user_cross_tenant_denied(
    other_workspace_id: str,
    analyst_token: str
) -> TestResult:
    """Test 6: Regular user accessing different organization."""
    result = TestResult("Regular user cannot access other organization")

    # Regular user tries to access workspace from different org
    # Should fail with 403 or 404
    response = make_api_request(
        "GET",
        f"/workspaces/{other_workspace_id}",
        analyst_token
    )

    if response["status"] in [403, 404]:
        result.passed = True
        result.message = "Cross-tenant access correctly denied"
        result.details = {"status": response["status"]}
    else:
        result.passed = False
        result.message = f"Expected 403/404, got {response['status']}"
        result.details = response

    return result


# =============================================================================
# Main Test Runner
# =============================================================================

def main():
    """Run all business logic tests."""
    print("=" * 80)
    print("BUSINESS LOGIC TESTING - Workspace Management")
    print("=" * 80)
    print()

    # Step 1: Setup test data
    print("STEP 1: Setting up test data...")
    print("-" * 80)

    # Create test users
    admin_user_id = create_test_user(TEST_USERS["admin"])
    analyst_user_id = create_test_user(TEST_USERS["analyst"])
    staff_user_id = create_test_user(TEST_USERS["platform_staff"])

    if not all([admin_user_id, analyst_user_id, staff_user_id]):
        print("X Failed to create test users")
        return 1

    # Create test organization
    org_id = create_test_organization("Test Organization", admin_user_id)
    if not org_id:
        print("X Failed to create test organization")
        return 1

    # Add analyst to organization
    execute_sql(f"""
        INSERT INTO organization_memberships (organization_id, user_id, role)
        VALUES ('{org_id}', '{analyst_user_id}', 'analyst')
        ON CONFLICT DO NOTHING;
    """)

    # Create test workspace
    workspace_id = create_test_workspace(org_id, "Test Workspace", admin_user_id)
    if not workspace_id:
        print("X Failed to create test workspace")
        return 1

    # Add members with different roles
    add_workspace_member(workspace_id, admin_user_id, "admin")
    add_workspace_member(workspace_id, analyst_user_id, "analyst")

    # Create second organization for cross-tenant test
    other_org_id = create_test_organization("Other Organization", staff_user_id)
    other_workspace_id = create_test_workspace(other_org_id, "Other Workspace", staff_user_id)
    add_workspace_member(other_workspace_id, staff_user_id, "admin")

    print(f"+ Created organization: {org_id}")
    print(f"+ Created workspace: {workspace_id}")
    print(f"+ Created other organization: {other_org_id}")
    print(f"+ Created other workspace: {other_workspace_id}")
    print()

    # Step 2: Generate JWT tokens
    print("STEP 2: Generating JWT tokens...")
    print("-" * 80)

    admin_token = get_mock_jwt_token(TEST_USERS["admin"])
    analyst_token = get_mock_jwt_token(TEST_USERS["analyst"])
    staff_token = get_mock_jwt_token(TEST_USERS["platform_staff"])

    print("+ Generated admin token")
    print("+ Generated analyst token")
    print("+ Generated staff token")
    print()

    # Step 3: Run tests
    print("STEP 3: Running business logic tests...")
    print("-" * 80)

    results = []

    # Test 1: Non-admin cannot update workspace
    results.append(test_1_non_admin_cannot_update_workspace(workspace_id, analyst_token))

    # Test 2: Admin can update workspace
    results.append(test_2_admin_can_update_workspace(workspace_id, admin_token))

    # Test 3: Default workspace deletion protection
    results.append(test_3_default_workspace_deletion_check(workspace_id, admin_token))

    # Test 4: Non-default workspace deletion
    results.append(test_4_non_default_workspace_deletion(org_id, admin_user_id, admin_token))

    # Test 5: Staff cross-tenant access
    results.append(test_5_staff_cross_tenant_access(workspace_id, staff_token, org_id))

    # Test 6: Regular user cross-tenant denied
    results.append(test_6_regular_user_cross_tenant_denied(other_workspace_id, analyst_token))

    # Step 4: Report results
    print()
    print("STEP 4: Test Results")
    print("=" * 80)

    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed

    for result in results:
        print(result)
        if result.details:
            print(f"   Details: {json.dumps(result.details, indent=6)}")
        print()

    print("=" * 80)
    print(f"SUMMARY: {passed} passed, {failed} failed out of {len(results)} tests")
    print("=" * 80)

    # Return exit code
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
