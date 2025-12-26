# Phase 2 Implementation Plan - BOM Read Endpoints

**Date:** 2025-12-14
**Status:** 🔄 IN PROGRESS
**Prerequisites:** ✅ Phase 1 Complete
**Scope:** Apply `@require_bom` decorator to BOM read endpoints

---

## Overview

Phase 2 applies scope validation to BOM read (GET) endpoints, ensuring users can only access BOMs that belong to their organization. This builds on Phase 1's upload endpoint security.

### Goals

1. **Replace manual auth checks** with `@require_bom` decorator
2. **Server-derive organization_id** from validated BOM → project → workspace → org FK chain
3. **Remove client-supplied organization_id** parameters where possible
4. **Maintain backward compatibility** during transition

---

## Target Endpoints

| Endpoint | File | Current Auth | Target Auth | Priority |
|----------|------|--------------|-------------|----------|
| `GET /boms/{bom_id}/line_items` | bom_line_items.py:123 | Manual RLS check | `@require_bom` | HIGH |
| `GET /boms/{bom_id}/line_items/{item_id}` | bom_line_items.py:292 | Manual RLS check | `@require_bom` | HIGH |
| `GET /boms/{bom_id}/enrichment/status` | bom_enrichment.py:809 | None (public) | `@require_bom` | MEDIUM |
| `GET /boms/{bom_id}/components` | bom_enrichment.py:913 | Manual org_id param | `@require_bom` | HIGH |
| `GET /boms/{bom_id}/ingest/status` | bom_ingest_status.py:33 | Unknown | `@require_bom` | LOW |

**Note:** Admin endpoints (`/admin/boms`, `/admin/boms/count`) and risk endpoints (`/risk/boms/*`) will be handled separately.

---

## Current Auth Patterns

### Pattern 1: Optional Auth with Manual RLS (bom_line_items.py)

```python
@router.get("/{bom_id}/line_items", response_model=BOMLineItemListResponse)
async def list_bom_line_items(
    bom_id: str = Path(...),
    auth: Optional[AuthContext] = Depends(get_optional_auth_context)
):
    # Manual auth check
    if auth and auth.user_id:
        bom_check = db.execute(
            text("SELECT organization_id FROM boms WHERE id = :bom_id"),
            {"bom_id": bom_id}
        ).mappings().first()

        if not bom_check:
            raise HTTPException(404, "BOM not found")

        bom_org_id = bom_check.get("organization_id")
        can_access = auth.can_access_organization(str(bom_org_id))

        if not can_access:
            raise HTTPException(403, "Not authorized")
```

**Issues:**
- Optional auth allows unauthenticated access (security risk)
- Manual RLS check duplicates decorator logic
- Doesn't leverage validated scope from decorator

### Pattern 2: Client-Supplied organization_id (bom_enrichment.py:913)

```python
@router.get("/boms/{bom_id}/components")
async def get_bom_components(
    bom_id: str,
    organization_id: Optional[str] = None,  # Client-supplied
    project_id: Optional[str] = None,
):
    # Uses organization_id from query param (not secure!)
```

**Issues:**
- Client can supply arbitrary `organization_id`
- No validation that BOM belongs to that organization
- Cross-tenant data leakage risk

### Pattern 3: No Auth (bom_enrichment.py:809)

```python
@router.get("/boms/{bom_id}/enrichment/status")
async def get_enrichment_status(bom_id: str):
    # No auth check at all! Anyone can query any BOM status
```

**Issues:**
- Unauthenticated access to BOM data
- Information disclosure vulnerability

---

## Target Pattern (After Phase 2)

### Pattern: @require_bom Decorator

```python
@router.get("/{bom_id}/line_items", response_model=BOMLineItemListResponse)
@require_bom(enforce=True, log_access=True)  # ✅ NEW
async def list_bom_line_items(
    bom_id: str,  # Path parameter
    request: Request,  # Required for decorator
    page: int = 1,
    page_size: int = 100,
    enrichment_status: Optional[str] = None,
    db: Session = Depends(get_supabase_session),  # Required for decorator
    user: User = Depends(get_current_user),  # Required for decorator
):
    """List all line items for a BOM with automatic scope validation."""

    # Extract validated scope (set by decorator)
    scope = request.state.validated_scope
    # scope = {"tenant_id": "...", "workspace_id": "...", "project_id": "...", "bom_id": "..."}

    organization_id = scope["tenant_id"]  # Server-derived (secure)
    project_id = scope["project_id"]  # Server-derived from BOM's FK chain

    # Query line items (bom_id already validated by decorator)
    query = text("""
        SELECT * FROM bom_line_items
        WHERE bom_id = :bom_id
        ORDER BY line_number
        LIMIT :page_size OFFSET :offset
    """)

    # ... rest of implementation
```

**Benefits:**
- ✅ Automatic validation: bom → project → workspace → org
- ✅ Server-derived `organization_id` (not client-supplied)
- ✅ Standardized error messages
- ✅ Audit logging built-in
- ✅ Staff bypass support

---

## Implementation Steps

### Step 1: Update bom_line_items.py (HIGH Priority)

**File:** `app/api/bom_line_items.py`

**Endpoint 1:** `GET /{bom_id}/line_items` (line 123)

**Changes:**
1. Add imports:
```python
from app.core.scope_decorators import require_bom
from app.dependencies.scope_deps import get_supabase_session
from app.auth.dependencies import get_current_user, User
```

2. Update endpoint signature:
```python
@router.get("/{bom_id}/line_items", response_model=BOMLineItemListResponse)
@require_bom(enforce=True, log_access=True)  # ✅ NEW
async def list_bom_line_items(
    bom_id: str,  # Path parameter
    request: Request,  # ✅ NEW: Required for decorator
    page: int = 1,
    page_size: int = 100,
    enrichment_status: Optional[str] = None,
    db: Session = Depends(get_supabase_session),  # ✅ CHANGED: Use decorator's dependency
    user: User = Depends(get_current_user),  # ✅ NEW: Required for decorator
):
```

3. Replace manual auth check with scope extraction:
```python
# OLD: Manual RLS check (REMOVE)
if auth and auth.user_id:
    bom_check = db.execute(...)
    can_access = auth.can_access_organization(...)
    if not can_access:
        raise HTTPException(403, ...)

# NEW: Use validated scope
scope = request.state.validated_scope
organization_id = scope["tenant_id"]  # Server-derived
```

4. Remove `auth: Optional[AuthContext]` parameter entirely

**Endpoint 2:** `GET /{bom_id}/line_items/{item_id}` (line 292)

Apply same pattern as Endpoint 1.

---

### Step 2: Update bom_enrichment.py (MEDIUM Priority)

**File:** `app/api/bom_enrichment.py`

**Endpoint 1:** `GET /boms/{bom_id}/enrichment/status` (line 809)

**Changes:**
1. Add decorator and required parameters
2. Extract organization_id from validated scope
3. Remove any manual auth checks

**Endpoint 2:** `GET /boms/{bom_id}/components` (line 913)

**Changes:**
1. Add `@require_bom` decorator
2. **Remove `organization_id` query parameter** (security fix!)
3. Extract organization_id from validated scope instead
4. Keep `project_id` as optional filter (but validate it matches scope)

---

### Step 3: Update bom_ingest_status.py (LOW Priority)

**File:** `app/api/bom_ingest_status.py`

**Endpoint:** `GET /{bom_id}/ingest/status` (line 33)

Apply standard `@require_bom` pattern.

---

## Security Improvements

| Issue | Before (Phase 1) | After (Phase 2) |
|-------|------------------|-----------------|
| Client-supplied org_id | ⚠️ `organization_id` query param | ✅ Server-derived from BOM FK chain |
| Unauthenticated access | ⚠️ Optional auth (some endpoints) | ✅ Required auth via `@require_bom` |
| Manual RLS checks | ⚠️ Duplicated logic in each endpoint | ✅ Centralized in decorator |
| Cross-tenant access | ⚠️ Possible if checks are wrong | ✅ Prevented by FK validation |
| Audit logging | ⚠️ Inconsistent or missing | ✅ Built into decorator |

---

## Backward Compatibility

### Breaking Changes:
1. **Removed parameter:** `organization_id` from `GET /boms/{bom_id}/components`
   - **Impact:** Frontend must stop sending this parameter
   - **Migration:** Simply remove the query param from API calls

2. **Auth now required:** Unauthenticated access no longer allowed
   - **Impact:** Public endpoints now require JWT
   - **Migration:** Ensure all clients send valid `Authorization: Bearer` header

### Non-Breaking Changes:
- `project_id` query parameter retained (optional filter)
- Pagination parameters unchanged
- Response models unchanged
- HTTP status codes unchanged (404, 403 same as before)

---

## Testing Plan

### Test Scenario 1: Authenticated User - Same Org
```bash
# Get JWT for user in Organization A
TOKEN_ORG_A="eyJhbGci..."

# Get BOM from Organization A
BOM_ID_ORG_A="uuid-here"

# Should succeed
curl -H "Authorization: Bearer $TOKEN_ORG_A" \
  "http://localhost:27200/api/boms/$BOM_ID_ORG_A/line_items"

# Expected: 200 OK with line items
```

### Test Scenario 2: Cross-Tenant Access Denial
```bash
# Get JWT for user in Organization B
TOKEN_ORG_B="eyJhbGci..."

# Try to access BOM from Organization A
curl -H "Authorization: Bearer $TOKEN_ORG_B" \
  "http://localhost:27200/api/boms/$BOM_ID_ORG_A/line_items"

# Expected: 404 "BOM not found or does not belong to your organization"
```

### Test Scenario 3: Enrichment Status
```bash
# Before: Anyone could query (no auth)
curl "http://localhost:27200/api/boms/$BOM_ID/enrichment/status"
# Expected (before): 200 OK (SECURITY BUG!)

# After: Auth required
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/boms/$BOM_ID/enrichment/status"
# Expected (after): 200 OK with status data
```

### Test Scenario 4: Components Endpoint (organization_id removed)
```bash
# Before: Client sends organization_id
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/boms/$BOM_ID/components?organization_id=uuid"

# After: organization_id removed, server derives it
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/boms/$BOM_ID/components"

# Expected: Same response, more secure
```

---

## Rollout Plan

### Stage 1: Code Changes (This Phase)
1. ✅ Update bom_line_items.py endpoints
2. ✅ Update bom_enrichment.py endpoints
3. ✅ Update bom_ingest_status.py endpoint
4. ✅ Add comprehensive tests

### Stage 2: Testing
1. ⏭️ Test all endpoints with sample data
2. ⏭️ Verify cross-tenant access denial
3. ⏭️ Verify staff bypass works
4. ⏭️ Check logs for validation errors

### Stage 3: Frontend Updates
1. ⏭️ Remove `organization_id` param from components endpoint calls
2. ⏭️ Ensure all BOM read requests include JWT
3. ⏭️ Update error handling for new error messages

### Stage 4: Documentation
1. ⏭️ Update API docs with new endpoint signatures
2. ⏭️ Document removed parameters
3. ⏭️ Update integration guide

---

## Implementation Checklist

### bom_line_items.py
- [ ] Add imports (`require_bom`, `get_supabase_session`, `get_current_user`, `User`)
- [ ] Update `list_bom_line_items` signature (add decorator, request, db, user)
- [ ] Replace manual RLS check with scope extraction
- [ ] Remove `auth: Optional[AuthContext]` parameter
- [ ] Update `get_bom_line_item` signature (same pattern)
- [ ] Test both endpoints

### bom_enrichment.py
- [ ] Add imports
- [ ] Update `get_enrichment_status` (add auth requirement)
- [ ] Update `get_bom_components` (remove org_id param, add decorator)
- [ ] Replace manual checks with scope extraction
- [ ] Test both endpoints

### bom_ingest_status.py
- [ ] Add imports
- [ ] Update `get_ingest_status` signature
- [ ] Add scope validation
- [ ] Test endpoint

### Documentation
- [ ] Update BACKEND_INTEGRATION_PLAN.md (mark Phase 2 complete)
- [ ] Create PHASE_2_TESTING_GUIDE.md
- [ ] Update API changelog

---

## Success Criteria

- ✅ All BOM read endpoints require authentication
- ✅ `@require_bom` decorator applied to all target endpoints
- ✅ Manual RLS checks removed (replaced by decorator)
- ✅ Client-supplied `organization_id` removed from components endpoint
- ✅ Cross-tenant access properly denied (404 errors)
- ✅ Staff bypass functional for all endpoints
- ✅ All tests passing
- ✅ Logs show proper validation markers

---

## Next Steps After Phase 2

Once Phase 2 is complete:

1. **Phase 3:** Apply scope validation to workspace endpoints
   - `GET /api/workspaces/{workspace_id}`
   - `POST /api/workspaces/{workspace_id}/projects`

2. **Phase 4:** Apply scope validation to project endpoints
   - `GET /api/projects/{project_id}`
   - `PATCH /api/projects/{project_id}`

3. **Frontend Integration:** Update all BOM read calls to use new endpoints

---

**Status:** 🔄 Ready to Begin Implementation
**Started:** 2025-12-14
