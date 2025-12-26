# Phase 3 Implementation Plan - Workspace Endpoints Scope Validation

**Date:** 2025-12-14
**Status:** IN PROGRESS
**Target:** Apply `@require_workspace` scope validation to workspace endpoints

---

## Overview

Phase 3 applies automatic scope validation to workspace-level endpoints using the existing `@require_workspace` decorator. This phase is simpler than Phase 2 because:

1. The `@require_workspace` decorator already exists in [app/core/scope_decorators.py](app-plane/services/cns-service/app/core/scope_decorators.py#L122)
2. Workspace endpoints already have manual authorization checks
3. We're swapping manual checks for automated decorators (not adding new security)

---

## Target Endpoints

| Endpoint | Method | File | Lines | Current Auth | Target Auth |
|----------|--------|------|-------|--------------|-------------|
| `/workspaces/{workspace_id}` | GET | workspaces.py | 372-397 | Manual (`get_workspace_or_404`) | `@require_workspace` |
| `/workspaces/{workspace_id}` | PUT | workspaces.py | 400-459 | Manual (`get_workspace_or_404` + `require_workspace_admin`) | `@require_workspace` |
| `/workspaces/{workspace_id}` | DELETE | workspaces.py | 462-493 | Manual (`get_workspace_or_404` + `require_workspace_admin`) | `@require_workspace` |

**Not in scope for Phase 3:**
- `GET /workspaces` - Uses organization_id query param, not workspace_id path param
- `POST /workspaces` - Creates new workspace, no workspace_id to validate
- Member endpoints (`/workspaces/{workspace_id}/members/*`) - Will be Phase 3b
- Invitation endpoints (`/workspaces/{workspace_id}/invitations/*`) - Will be Phase 3b

---

## Current Authentication Pattern

### Manual Validation (Before)

```python
@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: str,
    user: User = Depends(get_current_user)
):
    with get_supabase_session() as session:
        workspace = get_workspace_or_404(session, workspace_id, user.id)
        require_workspace_member(workspace)
        # ... return response
```

**Problems:**
- Manual session management (`with get_supabase_session()`)
- Manual SQL queries in helper function
- Manual role checking
- Code duplication across endpoints
- Inconsistent error messages

### Automated Validation (After)

```python
@router.get("/{workspace_id}", response_model=WorkspaceResponse)
@require_workspace(enforce=True, log_access=True)
async def get_workspace(
    workspace_id: str,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user)
):
    # Extract validated scope
    scope = request.state.validated_scope
    organization_id = scope["tenant_id"]
    # ... return response
```

**Benefits:**
- Automatic FK chain validation
- Server-derived organization_id
- Consistent security pattern
- Less code duplication
- Better audit logging

---

## Scope Validation Flow

For `GET /workspaces/{workspace_id}`:

1. **User Authentication** → JWT validated by `get_current_user`
2. **Workspace Validation** → `@require_workspace` decorator:
   - Extracts `tenant_id` from JWT (`user.tenant_id`)
   - Queries database: `workspace → organization`
   - Validates workspace belongs to user's organization
   - Stores validated scope in `request.state.validated_scope`
3. **Endpoint Execution** → Endpoint uses validated scope:
   - `scope = request.state.validated_scope`
   - `organization_id = scope["tenant_id"]`
   - `workspace_id = scope["workspace_id"]`

---

## Implementation Steps

### Step 1: Update GET /workspaces/{workspace_id}

**File:** `app/api/workspaces.py` (lines 372-397)

**Changes:**
1. Add imports:
   ```python
   from fastapi import Request
   from app.core.scope_decorators import require_workspace
   from app.dependencies.scope_deps import get_supabase_session
   ```

2. Add decorator:
   ```python
   @router.get("/{workspace_id}", response_model=WorkspaceResponse)
   @require_workspace(enforce=True, log_access=True)
   async def get_workspace(
       workspace_id: str,
       request: Request,
       db: Session = Depends(get_supabase_session),
       user: User = Depends(get_current_user)
   ):
   ```

3. Replace manual validation:
   ```python
   # OLD - Remove
   with get_supabase_session() as session:
       workspace = get_workspace_or_404(session, workspace_id, user.id)
       require_workspace_member(workspace)

   # NEW - Add
   scope = request.state.validated_scope
   organization_id = scope["tenant_id"]

   # Query workspace directly (already validated)
   workspace = db.execute(
       text("SELECT * FROM workspaces WHERE id = CAST(:id AS UUID)"),
       {"id": workspace_id}
   ).fetchone()
   ```

**Lines Removed:** ~10 (manual validation)
**Lines Added:** ~5 (scope extraction)
**Net:** -5 lines

### Step 2: Update PUT /workspaces/{workspace_id}

**File:** `app/api/workspaces.py` (lines 400-459)

**Changes:**
- Same pattern as Step 1
- Add `@require_workspace` decorator
- Replace manual validation with scope extraction
- Remove `with get_supabase_session()` context manager

**Lines Removed:** ~12 (manual validation + session management)
**Lines Added:** ~6 (scope extraction)
**Net:** -6 lines

### Step 3: Update DELETE /workspaces/{workspace_id}

**File:** `app/api/workspaces.py` (lines 462-493)

**Changes:**
- Same pattern as Steps 1 & 2
- Add `@require_workspace` decorator
- Replace manual validation with scope extraction
- Remove `with get_supabase_session()` context manager
- Keep `is_default` check (business logic)

**Lines Removed:** ~12
**Lines Added:** ~6
**Net:** -6 lines

---

## Security Improvements

| Security Feature | Before | After |
|------------------|--------|-------|
| FK Chain Validation | Manual SQL in helper | Automatic via decorator |
| Cross-Tenant Isolation | Manual check | Automatic via decorator |
| Server-Derived organization_id | Manual extraction | Automatic from scope |
| Audit Logging | None | Automatic with `log_access=True` |
| Staff Bypass | Not supported | Supported via decorator |
| Error Messages | Inconsistent | Consistent |

---

## API Changes

### Breaking Changes

**NONE** - All changes are internal improvements.

### Behavioral Changes

**Minor:**
- Error messages become more consistent
- HTTP 404 instead of HTTP 403 for cross-tenant access (security best practice)
- Slightly different log format

### Response Changes

**NONE** - All response structures remain the same.

---

## Testing Scenarios

### Scenario 1: Authenticated Access (Success)

```bash
TOKEN="eyJhbGci..."
WORKSPACE_ID="550e8400-e29b-41d4-a716-446655440000"

# Test GET
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/workspaces/$WORKSPACE_ID"

# Test PUT
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}' \
  "http://localhost:27200/api/workspaces/$WORKSPACE_ID"

# Test DELETE
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/workspaces/$WORKSPACE_ID"
```

**Expected:** HTTP 200/204 with data

### Scenario 2: Cross-Tenant Access (Denied)

```bash
# Org A token trying to access Org B's workspace
TOKEN_ORG_A="eyJhbGci..."
WORKSPACE_ORG_B="00000000-0000-0000-0000-000000000000"

curl -H "Authorization: Bearer $TOKEN_ORG_A" \
  "http://localhost:27200/api/workspaces/$WORKSPACE_ORG_B"
```

**Expected:**
```json
{
  "detail": "Workspace 00000000-0000-0000-0000-000000000000 not found or does not belong to your organization"
}
```
**Status Code:** HTTP 404

### Scenario 3: No Authentication (Denied)

```bash
curl "http://localhost:27200/api/workspaces/$WORKSPACE_ID"
```

**Expected:** HTTP 401 Unauthorized

### Scenario 4: Staff Bypass (Success)

```bash
STAFF_TOKEN="eyJhbGci..."  # Platform admin token

# Access any workspace (even from different org)
curl -H "Authorization: Bearer $STAFF_TOKEN" \
  "http://localhost:27200/api/workspaces/$WORKSPACE_ORG_B"
```

**Expected:** HTTP 200 with data

---

## Code Quality Impact

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Lines of code | ~1,296 | ~1,270 | -26 |
| Manual auth checks | 3 endpoints | 0 endpoints | -3 |
| Helper functions needed | 2 | 0 | -2 |
| Code duplication | High | None | ✅ |
| Security consistency | Medium | High | ✅ |

---

## Risks & Mitigation

### Risk 1: Workspace Member Endpoints

**Risk:** Member endpoints (`/workspaces/{workspace_id}/members/*`) also use manual validation.

**Mitigation:**
- Phase 3 focuses on core CRUD endpoints first
- Member endpoints will be Phase 3b (separate PR)
- Same decorator pattern applies

### Risk 2: Backward Compatibility

**Risk:** Existing clients might rely on specific error messages.

**Mitigation:**
- Error messages are similar (just more consistent)
- HTTP status codes remain the same (404 for not found)
- No breaking changes to request/response structures

### Risk 3: Session Management

**Risk:** Removing `with get_supabase_session()` context manager.

**Mitigation:**
- Decorator provides session via `Depends(get_supabase_session)`
- Session lifecycle managed by FastAPI dependency injection
- No session leaks (FastAPI handles cleanup)

---

## Implementation Order

1. ✅ Add imports to workspaces.py
2. ⏭️ Update GET /workspaces/{workspace_id}
3. ⏭️ Update PUT /workspaces/{workspace_id}
4. ⏭️ Update DELETE /workspaces/{workspace_id}
5. ⏭️ Verify syntax (python -m py_compile)
6. ⏭️ Restart CNS service
7. ⏭️ Test all scenarios
8. ⏭️ Update documentation

---

## Success Criteria

- ✅ All 3 workspace CRUD endpoints use `@require_workspace` decorator
- ✅ No manual `get_workspace_or_404` calls remain
- ✅ Code reduction (~26 lines)
- ✅ Syntax validation passes
- ✅ Service restarts successfully
- ✅ All test scenarios pass
- ✅ Logs show `[OK]` markers for successful operations

---

## Future Work (Phase 3b)

After Phase 3 core endpoints:

1. **Member Endpoints:**
   - `GET /workspaces/{workspace_id}/members`
   - `POST /workspaces/{workspace_id}/members`
   - `PUT /workspaces/{workspace_id}/members/{user_id}`
   - `DELETE /workspaces/{workspace_id}/members/{user_id}`

2. **Invitation Endpoints:**
   - `GET /workspaces/{workspace_id}/invitations`
   - `POST /workspaces/{workspace_id}/invitations`

3. **List Endpoint:**
   - `GET /workspaces` - Needs organization-level scoping

---

**Status:** ⏭️ READY TO IMPLEMENT
**Date:** 2025-12-14
**Next:** Apply @require_workspace to GET /workspaces/{workspace_id}
