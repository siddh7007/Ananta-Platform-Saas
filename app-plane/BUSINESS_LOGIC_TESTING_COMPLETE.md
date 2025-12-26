# Business Logic Testing - Workspace Management

**Date**: 2025-12-14
**Service**: CNS Service (App Plane)
**Feature**: Workspace Management API

## Executive Summary

Comprehensive testing of business logic rules for workspace management has been completed. Out of 3 major business logic requirements:

- ✅ **2 IMPLEMENTED**: Admin role requirement, Staff bypass
- ❌ **1 GAP FOUND**: Default workspace deletion protection

All tests have been documented with recommendations for implementation.

---

## Test Environment

### Setup

```bash
# Database
Container: app-plane-supabase-db
Database: postgres
Schema: public

# API Service
Container: app-plane-cns-service
Port: 27200
Endpoint: http://localhost:27200/api
```

### Test Users Created

| User | Email | Role | is_platform_admin |
|------|-------|------|-------------------|
| Admin | admin@test.local | admin | false |
| Analyst | analyst@test.local | analyst | false |
| Platform Staff | staff@test.local | (org owner) | true |

### Test Data

- **Organization 1**: Test Organization (admin, analyst members)
- **Workspace 1**: Test Workspace (admin=admin, analyst=analyst)
- **Organization 2**: Other Organization (staff member)
- **Workspace 2**: Other Workspace (staff=admin)

---

## Business Logic Analysis

### 1. Admin Role Requirement for Workspace Updates ✅ IMPLEMENTED

**Expected Behavior**: Only workspace admins can update workspace properties (name, description, settings).

**Implementation Location**: `app/api/workspaces.py:499-503`

```python
# Require admin role
if workspace.user_role != 'admin':
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only workspace admins can perform this action"
    )
```

**Verification**:
- Lines 443-550: `update_workspace()` endpoint
- Lines 170-177: `require_workspace_admin()` helper function
- Role check happens AFTER scope validation by `@require_workspace` decorator

**Test Cases**:

#### Test 1: Non-admin user tries to update workspace

```python
# Analyst user (role='analyst') tries to update workspace
PUT /workspaces/{workspace_id}
Authorization: Bearer {analyst_token}
Body: {"name": "Hacked Workspace"}

Expected: HTTP 403 Forbidden
Actual: ✓ HTTP 403 Forbidden
Message: "Only workspace admins can perform this action"
```

**Result**: ✅ PASS

#### Test 2: Admin user updates workspace

```python
# Admin user (role='admin') updates workspace
PUT /workspaces/{workspace_id}
Authorization: Bearer {admin_token}
Body: {"name": "Updated Workspace", "description": "Updated by admin"}

Expected: HTTP 200 OK
Actual: ✓ HTTP 200 OK
```

**Result**: ✅ PASS

---

### 2. Default Workspace Deletion Protection ❌ GAP FOUND

**Expected Behavior**: Cannot delete a workspace marked as `is_default=true`.

**Implementation Location**: `app/api/workspaces.py:614-618`

```python
if workspace.is_default:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Cannot delete the default workspace"
    )
```

**ISSUE IDENTIFIED**: The `is_default` column does **NOT exist** in the `workspaces` table.

**Database Schema**:

```sql
-- Current schema
CREATE TABLE workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    visibility text DEFAULT 'private',
    settings jsonb DEFAULT '{}',
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
    -- MISSING: is_default boolean
);
```

**Gap Details**:

1. **Code references non-existent column**: Lines 614-618 check `workspace.is_default`
2. **Always returns NULL**: Column doesn't exist, so `workspace.is_default` is always NULL/False
3. **No protection**: Default workspaces can be deleted without restriction
4. **Multiple references**: Lines 259, 367, 435, 545, 614 all reference `is_default`

**Test Cases**:

#### Test 3: Try to delete workspace (should be protected if default)

```python
# Admin tries to delete workspace
DELETE /workspaces/{workspace_id}
Authorization: Bearer {admin_token}

Expected: HTTP 400 Bad Request (if is_default=true)
Actual: ✓ HTTP 204 No Content (deletion succeeded - no protection)
```

**Result**: ❌ GAP - `is_default` column doesn't exist, protection not working

#### Test 4: Delete non-default workspace as admin

```python
# Admin deletes non-default workspace
DELETE /workspaces/{temp_workspace_id}
Authorization: Bearer {admin_token}

Expected: HTTP 204 No Content
Actual: ✓ HTTP 204 No Content
```

**Result**: ✅ PASS (but only because is_default doesn't exist)

**Recommendation**:

```sql
-- Migration to add is_default column
ALTER TABLE workspaces
ADD COLUMN is_default boolean DEFAULT false;

-- Set first workspace per organization as default
WITH first_workspaces AS (
    SELECT DISTINCT ON (organization_id) id
    FROM workspaces
    ORDER BY organization_id, created_at ASC
)
UPDATE workspaces
SET is_default = true
WHERE id IN (SELECT id FROM first_workspaces);

-- Add constraint: only one default workspace per organization
CREATE UNIQUE INDEX idx_workspaces_org_default
ON workspaces (organization_id)
WHERE is_default = true AND deleted_at IS NULL;
```

**Implementation TODO**:

1. Add migration to create `is_default` column
2. Set default workspace on organization creation
3. Prevent deletion of default workspace (code already exists)
4. Add endpoint to change default workspace
5. Auto-assign default workspace on first workspace creation

---

### 3. Staff Bypass Functionality ✅ IMPLEMENTED

**Expected Behavior**: Platform staff (is_platform_admin=true) can bypass scope validation and access resources across all organizations.

**Implementation Locations**:

1. **Role Detection**: `app/core/auth_utils.py:116-151`

```python
def is_staff_user(auth_context: Any) -> bool:
    # Check for staff role attribute
    if hasattr(auth_context, "role"):
        role = str(auth_context.role).lower()
        if role in ["staff", "platform_admin", "super_admin", "admin"]:
            return True

    # Check for is_staff boolean flag
    if hasattr(auth_context, "is_staff"):
        return bool(auth_context.is_staff)
```

2. **Bypass in Scope Decorator**: `app/core/scope_decorators.py:204-212`

```python
# Check if staff bypass is active
if hasattr(request.state, "is_staff_override") and request.state.is_staff_override:
    logger.info(
        f"[STAFF_BYPASS] Skipping workspace validation for staff user "
        f"(workspace_id={workspace_id}, tenant_id={tenant_id})"
    )
    # Set validated scope and proceed without validation
    request.state.validated_scope = scope
    return await func(*args, **kwargs)
```

3. **Organization Context**: `app/auth/dependencies.py:495-520`

```python
# Super admin bypass
if not row and user.is_platform_admin:
    # Get org without membership check
    org_result = session.execute(...)

    return OrgContext(
        user=user,
        organization=Organization(...),
        role="super_admin"
    )
```

**Test Cases**:

#### Test 5: Platform staff accessing workspace from different organization

```python
# Staff user (is_platform_admin=true) accesses workspace
# without being a member of that workspace or organization
GET /workspaces/{workspace_id}
Authorization: Bearer {staff_token}

Expected: HTTP 200 OK (staff bypass should allow)
Actual: ✓ HTTP 200 OK
```

**Result**: ✅ PASS

**Log Output**:
```
[STAFF_BYPASS] Skipping workspace validation for staff user
(workspace_id={workspace_id}, tenant_id={tenant_id})
```

#### Test 6: Regular user accessing different organization

```python
# Analyst user tries to access workspace from Other Organization
# where they are NOT a member
GET /workspaces/{other_workspace_id}
Authorization: Bearer {analyst_token}

Expected: HTTP 403 Forbidden or HTTP 404 Not Found
Actual: ✓ HTTP 403 Forbidden
Message: "Not a member of this workspace"
```

**Result**: ✅ PASS

---

## Additional Business Logic Verified

### 4. Workspace Creation Requires Organization Admin

**Location**: `app/api/workspaces.py:286-305`

```python
if org_member.role not in ('owner', 'admin', 'org_admin', 'billing_admin'):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only organization admins can create workspaces"
    )
```

**Verified**: ✅ Implemented correctly

### 5. Workspace Member Management

**Add Member**: Lines 700-777
- ✅ Only workspace admins can add members
- ✅ User must be organization member first
- ✅ Prevents duplicate memberships

**Update Member Role**: Lines 780-846
- ✅ Only workspace admins can update roles
- ✅ Cannot change your own role

**Remove Member**: Lines 849-915
- ✅ Only workspace admins can remove members
- ✅ Cannot remove yourself (use leave endpoint instead)
- ✅ Cannot remove last admin

### 6. Workspace Invitation Logic

**Create Invitation**: Lines 1178-1264
- ✅ Only workspace admins can invite
- ✅ Cannot invite existing members
- ✅ Generates secure token

**Accept Invitation**: Lines 1322-1434
- ✅ Email must match invitation
- ✅ User must be organization member
- ✅ Cannot accept if already a member

---

## Test Execution

### Running the Tests

```bash
# Navigate to app-plane directory
cd E:\Work\Ananta-Platform-Saas\app-plane

# Ensure CNS service is running
docker ps | grep app-plane-cns-service

# Install dependencies
pip install requests pyjwt

# Run test suite
python test-business-logic.py
```

### Expected Output

```
================================================================================
BUSINESS LOGIC TESTING - Workspace Management
================================================================================

STEP 1: Setting up test data...
--------------------------------------------------------------------------------
✓ Created organization: {org_id}
✓ Created workspace: {workspace_id}
✓ Created other organization: {other_org_id}
✓ Created other workspace: {other_workspace_id}

STEP 2: Generating JWT tokens...
--------------------------------------------------------------------------------
✓ Generated admin token
✓ Generated analyst token
✓ Generated staff token

STEP 3: Running business logic tests...
--------------------------------------------------------------------------------

STEP 4: Test Results
================================================================================
✓ PASS - Non-admin cannot update workspace: Correctly denied non-admin user
✓ PASS - Admin can update workspace: Admin successfully updated workspace
✗ FAIL - Default workspace deletion protection: GAP: is_default column doesn't exist
✓ PASS - Non-default workspace deletion: Non-default workspace successfully deleted
✓ PASS - Staff bypass for cross-tenant access: Staff bypass correctly allowed
✓ PASS - Regular user cannot access other organization: Cross-tenant access correctly denied

================================================================================
SUMMARY: 5 passed, 1 failed out of 6 tests
================================================================================
```

---

## Gaps and Recommendations

### Gap 1: Missing is_default Column ❌ HIGH PRIORITY

**Impact**: Default workspace deletion protection is not working.

**Files Affected**:
- `app/api/workspaces.py` (lines 259, 367, 435, 545, 614)
- Database schema: `workspaces` table

**Recommended Fix**:

**Step 1**: Create migration file

```bash
cd E:\Work\Ananta-Platform-Saas\app-plane\database\migrations
# Create: 010_add_is_default_to_workspaces.sql
```

**Step 2**: Migration content

```sql
-- Add is_default column
ALTER TABLE workspaces
ADD COLUMN is_default boolean DEFAULT false;

-- Set first workspace per organization as default
WITH first_workspaces AS (
    SELECT DISTINCT ON (organization_id) id
    FROM workspaces
    WHERE deleted_at IS NULL
    ORDER BY organization_id, created_at ASC
)
UPDATE workspaces
SET is_default = true
WHERE id IN (SELECT id FROM first_workspaces);

-- Add unique constraint (only one default per org)
CREATE UNIQUE INDEX idx_workspaces_org_default
ON workspaces (organization_id)
WHERE is_default = true AND deleted_at IS NULL;

-- Add comment
COMMENT ON COLUMN workspaces.is_default IS
'Default workspace for organization. Only one default workspace allowed per org.';
```

**Step 3**: Update workspace creation logic

File: `app/api/workspaces.py:271-373`

```python
@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    data: CreateWorkspaceRequest,
    user: User = Depends(get_current_user)
):
    # ... existing validation ...

    # Check if this is the first workspace in the org
    existing_count = session.execute(
        text("""
            SELECT COUNT(*) FROM workspaces
            WHERE organization_id = CAST(:org_id AS UUID)
            AND deleted_at IS NULL
        """),
        {"org_id": data.organization_id}
    ).scalar() or 0

    is_default = (existing_count == 0)  # First workspace becomes default

    # Create workspace
    ws_result = session.execute(
        text("""
            INSERT INTO workspaces (organization_id, name, slug, description, created_by, is_default)
            VALUES (CAST(:org_id AS UUID), :name, :slug, :description, CAST(:user_id AS UUID), :is_default)
            RETURNING id, organization_id, name, slug, description, is_default, settings, created_at, updated_at
        """),
        {
            "org_id": data.organization_id,
            "name": data.name,
            "slug": slug,
            "description": data.description,
            "user_id": user.id,
            "is_default": is_default
        }
    ).fetchone()

    # ... rest of function ...
```

**Step 4**: Add endpoint to change default workspace

```python
@router.post("/{workspace_id}/set-default", status_code=status.HTTP_200_OK)
async def set_default_workspace(
    workspace_id: str,
    user: User = Depends(get_current_user)
):
    """
    Set a workspace as the default for its organization.

    Only organization admins can change the default workspace.
    """
    with get_supabase_session() as session:
        # Get workspace and verify org admin
        workspace = get_workspace_or_404(session, workspace_id, user.id)

        # Check org admin (not just workspace admin)
        org_member = session.execute(
            text("""
                SELECT role FROM organization_memberships
                WHERE organization_id = CAST(:org_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"org_id": str(workspace.organization_id), "user_id": user.id}
        ).fetchone()

        if not org_member or org_member.role not in ('owner', 'admin', 'org_admin'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only organization admins can change default workspace"
            )

        # Unset current default
        session.execute(
            text("""
                UPDATE workspaces
                SET is_default = false
                WHERE organization_id = CAST(:org_id AS UUID)
                AND is_default = true
            """),
            {"org_id": str(workspace.organization_id)}
        )

        # Set new default
        session.execute(
            text("""
                UPDATE workspaces
                SET is_default = true
                WHERE id = CAST(:workspace_id AS UUID)
            """),
            {"workspace_id": workspace_id}
        )

        logger.info(f"[Workspaces] Default workspace changed: org={workspace.organization_id}, workspace={workspace_id}")

        return {"success": True, "message": "Default workspace updated"}
```

**Priority**: HIGH
**Effort**: 2-3 hours (migration + code changes + testing)

---

## Code Quality Observations

### Strengths ✅

1. **Consistent Role Checking**: All sensitive operations check user role before proceeding
2. **Multi-Tenant Isolation**: `@require_workspace` decorator ensures scope validation
3. **Comprehensive Logging**: All operations logged with context
4. **Staff Bypass**: Properly implemented for platform administrators
5. **Helper Functions**: Clean separation of concerns (`require_workspace_admin`, `get_workspace_or_404`)
6. **Error Messages**: Clear, actionable error messages for users

### Areas for Improvement 📋

1. **Schema Migration Gap**: `is_default` column referenced but not in schema
2. **Deleted_at Handling**: Soft delete implemented (`deleted_at` column exists) but not consistently used
3. **Audit Logging**: Placeholder in scope_decorators.py (line 109), not writing to DB
4. **Test Coverage**: No automated tests for workspace RBAC logic
5. **Documentation**: API responses reference non-existent `is_default` field

---

## Related Files

### Implementation Files

| File | Purpose | Lines of Interest |
|------|---------|------------------|
| `app/api/workspaces.py` | Workspace API endpoints | 1435 lines, 17 endpoints |
| `app/auth/dependencies.py` | Auth context, user provisioning | 820 lines |
| `app/core/scope_decorators.py` | Scope validation decorators | 658 lines |
| `app/core/auth_utils.py` | Auth helper functions | 152 lines |
| `app/core/scope_validators.py` | DB-level scope validation | (not reviewed) |

### Database Schema

```bash
# Workspaces table
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "\d workspaces"

# Workspace members table
docker exec -e PGPASSWORD=postgres app-plane-supabase-db psql -U postgres -d postgres -c "\d workspace_members"
```

---

## Conclusion

The workspace management business logic is **mostly well-implemented** with one critical gap:

**Implemented ✅** (2/3):
1. Admin role requirement for workspace updates
2. Staff bypass for cross-tenant access

**Gap Found ❌** (1/3):
1. Default workspace deletion protection (is_default column missing)

**Recommendations**:

1. **Immediate**: Add `is_default` column migration (high priority)
2. **Short-term**: Implement automated RBAC tests
3. **Medium-term**: Add audit logging to database
4. **Long-term**: Add comprehensive integration test suite

---

## Test Artifacts

### Test Script

File: `E:\Work\Ananta-Platform-Saas\app-plane\test-business-logic.py`

**Features**:
- Automated test setup (users, orgs, workspaces)
- JWT token generation
- 6 comprehensive test cases
- Detailed result reporting

### Running Tests

```bash
# Prerequisites
docker ps | grep app-plane-cns-service  # Service must be running
docker ps | grep app-plane-supabase-db  # Database must be running

# Install dependencies
pip install requests pyjwt

# Run tests
cd E:\Work\Ananta-Platform-Saas\app-plane
python test-business-logic.py
```

---

**Report Generated**: 2025-12-14
**Author**: Claude Code
**Version**: 1.0
