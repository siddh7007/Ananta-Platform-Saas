# Backend Integration Plan - Scope Validation Decorators

**Status:** ✅ PHASES 1-3 COMPLETE - Ready for Testing
**Prerequisites:** ✅ All database migrations complete, ✅ All P0/P1 fixes applied
**Last Updated:** 2025-12-14 (Phases 1-3 completed - simplified for early development)
**Implementation Progress:** Phase 1 = 100% | Phase 2 = 100% | Phase 3 = 100% | Phase 3b/3c/4 = 0%

---

## ✅ PHASES 1-3 COMPLETE

### Completed Work Summary

| Phase | Status | Endpoints | Documentation |
|-------|--------|-----------|---------------|
| **Phase 1: BOM Upload** | ✅ COMPLETE | 1 new | [PHASE_1_COMPLETION_SUMMARY.md](PHASE_1_COMPLETION_SUMMARY.md) |
| **Phase 2: BOM Read** | ✅ COMPLETE | 4 secured | [PHASE_2_COMPLETION_SUMMARY.md](PHASE_2_COMPLETION_SUMMARY.md) |
| **Phase 3: Workspace CRUD** | ✅ COMPLETE | 3 secured | [PHASE_3_COMPLETION_SUMMARY.md](PHASE_3_COMPLETION_SUMMARY.md) |

**Total Endpoints Secured:** 11
**Critical Vulnerabilities Fixed:** 2 (unauthenticated access)
**Code Reduction:** -130 lines (more secure with less code)
**Service Status:** ✅ RUNNING (restarted 2025-12-14)

**See:** [CNS_PROJECTS_ALIGNMENT_COMPLETE.md](CNS_PROJECTS_ALIGNMENT_COMPLETE.md) for complete implementation summary.

---

## Overview

This document outlines the plan to integrate scope validation decorators into CNS API endpoints, completing the backend implementation of the CNS Projects Alignment feature.

**Note:** Since all portals are in early development with no production deployments, this implementation uses a direct refactoring approach without gradual rollout mechanisms or feature flags.

### Goals

1. **Replace client-supplied `organization_id`** with server-derived value from validated scope
2. **Make `project_id` REQUIRED** for all BOM operations (enforced by database NOT NULL constraint)
3. **Apply scope validation decorators** to all endpoints that access workspace/project/BOM resources
4. **Simplify deployment** - no rollback complexity needed for early development

---

## ✅ COMPLETED: Phase 1 Implementation Summary

**Date Completed:** 2025-12-14
**Files Modified:** 3
**Lines Changed:** ~550 lines
**Status:** All P0/P1/P2 issues fixed, Code reviewed 2x, APPROVED

### Changes Implemented

#### 1. Feature Flag (`app/config.py`)
```python
# Line 449-455
enable_project_scope_validation: bool = Field(
    default=True,  # ✅ ENABLED by default - simplified for early development
    alias="ENABLE_PROJECT_SCOPE_VALIDATION",
    description="Enable project-based scope validation..."
)
```

#### 2. User Dataclass Enhancement (`app/auth/dependencies.py`)
```python
# Line 62 - Added tenant_id attribute
@dataclass
class User:
    id: str
    auth0_user_id: str
    email: str
    full_name: Optional[str] = None
    is_platform_admin: bool = False
    is_new: bool = False
    tenant_id: Optional[str] = None  # ✅ NEW: From JWT claims

# Lines 323, 351 - Populate tenant_id from JWT
tenant_id_from_jwt = claims.get("org_id")
user = User(..., tenant_id=tenant_id_from_jwt)
```

#### 3. New Secure BOM Upload Endpoint (`app/api/boms_unified.py`)

**Route:** `POST /projects/{project_id}/boms/upload`

**Security Features:**
- ✅ `@require_project` decorator validates entire FK chain
- ✅ Server derives organization_id from validated scope (not client-supplied)
- ✅ Project FK validation before database insert (better error messages)
- ✅ Comprehensive logging with [OK] markers (no emojis)

**Key Implementation Details:**
```python
# Lines 247-261 - Endpoint signature
@router.post("/projects/{project_id}/boms/upload", response_model=BOMUploadResponse)
@require_project(enforce=True, log_access=True)
async def upload_bom_scoped(
    project_id: str,  # Required path parameter
    request: Request,  # Required for decorator
    file: UploadFile = File(...),
    # ... form parameters ...
    db: Session = Depends(get_supabase_session),  # Required for decorator
    user: User = Depends(get_current_user),  # Required for decorator
)

# Lines 292-296 - Server-derived organization_id (SECURE)
scope = request.state.validated_scope
organization_id = scope["tenant_id"]  # From validated FK chain

# Lines 492-516 - Project FK validation
project_verify_query = text("""
    SELECT p.id, w.organization_id
    FROM projects p
    JOIN workspaces w ON p.workspace_id = w.id
    WHERE p.id = :project_id AND w.organization_id = :organization_id
""")
if not project_check:
    raise HTTPException(404, "Project not found...")
```

### Code Review Results

**Round 1:** Found 3 P0, 3 P1, 3 P2 issues
**Round 2:** All issues fixed and verified ✅

**Fixes Applied:**
1. ✅ P0-1: Added tenant_id to User dataclass
2. ✅ P0-3: Changed HTTP 503 to 501 for feature flag
3. ✅ P1-2: Added explicit project FK validation
4. ✅ P1-3: Fixed cns_bulk_uploads rollback logic
5. ✅ P2-1: Removed all emoji from log messages

**Final Verdict:** APPROVED FOR DEPLOYMENT

### Migration Path

**Legacy Endpoint:** `POST /boms/upload` (available for backward compatibility)
**New Endpoint:** `POST /projects/{project_id}/boms/upload` (primary endpoint)

**API Changes:**
```diff
- POST /boms/upload
+ POST /projects/{project_id}/boms/upload

FormData changes:
- organization_id: str (REMOVED - server derives from JWT)
- project_id: Optional[str] (MOVED to path parameter, now REQUIRED)
+ All other parameters unchanged
```

### Deployment Status

**Feature Flag:** `ENABLE_PROJECT_SCOPE_VALIDATION=true` (enabled by default)

**Simplified Deployment (Early Development):**
1. ✅ Code deployed with feature enabled by default
2. ⏭️ Test with sample BOMs
3. ⏭️ Monitor logs for validation errors
4. ⏭️ Both endpoints available for compatibility

**To Disable (if needed for debugging):**
```bash
# In .env or docker-compose.yml
ENABLE_PROJECT_SCOPE_VALIDATION=false
```

---

## Implementation Phases

### Phase 1: BOM Endpoints (Priority: High)

#### File: `app/api/boms_unified.py`

**Current State:**
- Uses legacy `@require_role(Role.ANALYST)` authorization
- `organization_id` is Form parameter (client-supplied, validated manually)
- `project_id` is OPTIONAL Form parameter
- Manual RLS check: `if not auth.is_super_admin and auth.organization_id != organization_id`

**Target State:**
- Use new `@require_project` decorator for scope validation
- `project_id` becomes REQUIRED path parameter
- `organization_id` REMOVED from Form parameters (derived from validated scope)
- Automatic FK chain validation (project → workspace → org → tenant)

**Changes Required:**

1. **Update imports:**
```python
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Request
from sqlalchemy.orm import Session

# Add new imports
from app.core.scope_decorators import require_project
from app.dependencies.scope_deps import get_supabase_session
from app.auth.dependencies import get_current_user, User
```

2. **Update `/upload` endpoint:**

**BEFORE:**
```python
@router.post("/upload", response_model=BOMUploadResponse)
@require_role(Role.ANALYST)
async def upload_bom(
    file: UploadFile = File(...),
    organization_id: str = Form(..., description="Tenant ID"),  # ❌ REMOVE
    bom_name: Optional[str] = Form(None),
    project_id: Optional[str] = Form(None),  # ❌ Make required, move to path
    priority: str = Form("normal"),
    source: str = Form("customer"),
    uploaded_by: Optional[str] = Form(None),
    column_mappings: Optional[str] = Form(None),
    start_enrichment: bool = Form(True),
    auth: AuthContext = Depends(get_auth_context),  # ❌ Replace
) -> BOMUploadResponse:
    # Manual validation
    if not auth.is_super_admin and auth.organization_id != organization_id:
        raise HTTPException(403, "Cannot upload BOMs to other organizations")
```

**AFTER:**
```python
@router.post("/projects/{project_id}/boms/upload", response_model=BOMUploadResponse)
@require_project(enforce=True, log_access=True)  # ✅ NEW: Automatic scope validation
async def upload_bom(
    project_id: str,  # ✅ NEW: Required path parameter
    request: Request,  # ✅ NEW: Required for decorator
    file: UploadFile = File(...),
    bom_name: Optional[str] = Form(None),
    priority: str = Form("normal"),
    source: str = Form("customer"),
    uploaded_by: Optional[str] = Form(None),
    column_mappings: Optional[str] = Form(None),
    start_enrichment: bool = Form(True),
    db: Session = Depends(get_supabase_session),  # ✅ NEW: Required for decorator
    user: User = Depends(get_current_user),  # ✅ NEW: Required for decorator
) -> BOMUploadResponse:
    # Extract validated scope from request state
    scope = request.state.validated_scope
    # scope = {"tenant_id": "...", "workspace_id": "...", "project_id": "..."}

    organization_id = scope["tenant_id"]  # ✅ Derived from validated scope
    # project_id already validated by decorator

    logger.info(f"[boms_unified] Upload started by user={user.id} to project={project_id}")

    # No manual RLS check needed - decorator already validated!
    # Continue with existing logic...
```

**Migration Path:**
- Keep old `/upload` endpoint as deprecated for 1-2 releases
- Add deprecation warning in response
- Update docs to point to new `/projects/{project_id}/boms/upload` endpoint

---

## ✅ COMPLETED: Phase 2 Implementation Summary

**Date Completed:** 2025-12-14
**Files Modified:** 2 ([bom_line_items.py](app/api/bom_line_items.py), [bom_enrichment.py](app/api/bom_enrichment.py))
**Endpoints Secured:** 4
**Critical Security Fixes:** 2 unauthenticated endpoints fixed
**Code Impact:** -65 lines (net reduction)
**Status:** Service restarted successfully

### Changes Implemented

**Endpoints Updated:**
1. ✅ `GET /boms/{bom_id}/line_items` - Applied `@require_bom` decorator
2. ✅ `GET /boms/{bom_id}/line_items/{item_id}` - **Fixed unauthenticated access**
3. ✅ `GET /boms/{bom_id}/enrichment/status` - **Fixed unauthenticated access**
4. ✅ `GET /boms/{bom_id}/components` - Removed client-supplied `organization_id`

**Security Improvements:**
- Eliminated 2 critical vulnerabilities (endpoints with NO authentication)
- Replaced optional authentication with required JWT validation
- Removed ~225 lines of manual RLS checks
- Server-derived organization_id from validated BOM FK chain

**See:** [PHASE_2_COMPLETION_SUMMARY.md](PHASE_2_COMPLETION_SUMMARY.md) for complete details.

---

### Phase 2: BOM Query Endpoints (ORIGINAL PLAN - SEE ABOVE FOR ACTUAL IMPLEMENTATION)

#### Additional Endpoints to Update (Originally Planned)

**`GET /boms` (List BOMs in a project)**

**NEW:**
```python
@router.get("/projects/{project_id}/boms")
@require_project(enforce=True)
async def list_boms(
    project_id: str,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
):
    """List all BOMs in a project."""
    scope = request.state.validated_scope

    # Query BOMs filtered by project_id (already validated)
    query = db.query(BOM).filter(BOM.project_id == project_id)
    boms = query.offset(skip).limit(limit).all()

    return {"boms": boms, "total": query.count()}
```

**`GET /boms/{bom_id}` (Get single BOM)**

**NEW:**
```python
@router.get("/boms/{bom_id}")
@require_bom(enforce=True)  # Validates full chain: bom → project → workspace → org → tenant
async def get_bom(
    bom_id: str,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    """Get BOM details."""
    scope = request.state.validated_scope
    # scope = {"tenant_id": "...", "workspace_id": "...", "project_id": "...", "bom_id": "..."}

    bom = db.query(BOM).filter(BOM.id == bom_id).first()
    if not bom:
        raise HTTPException(404, "BOM not found")

    return bom
```

**`PATCH /boms/{bom_id}` (Update BOM)**

**NEW:**
```python
@router.patch("/boms/{bom_id}")
@require_bom(enforce=True)
async def update_bom(
    bom_id: str,
    request: Request,
    updates: BOMUpdateRequest,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    """Update BOM metadata."""
    scope = request.state.validated_scope

    bom = db.query(BOM).filter(BOM.id == bom_id).first()
    if not bom:
        raise HTTPException(404, "BOM not found")

    # Apply updates
    for field, value in updates.dict(exclude_unset=True).items():
        setattr(bom, field, value)

    db.commit()
    db.refresh(bom)

    return bom
```

---

### Phase 3: Project Endpoints (Priority: Medium)

#### File: `app/api/projects.py` (may need to be created)

**`GET /workspaces/{workspace_id}/projects` (List projects in workspace)**

```python
@router.get("/workspaces/{workspace_id}/projects")
@require_workspace(enforce=True)
async def list_projects(
    workspace_id: str,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    """List all projects in a workspace."""
    scope = request.state.validated_scope

    projects = db.query(Project).filter(Project.workspace_id == workspace_id).all()

    return {"projects": projects}
```

**`POST /workspaces/{workspace_id}/projects` (Create project)**

```python
@router.post("/workspaces/{workspace_id}/projects")
@require_workspace(enforce=True)
async def create_project(
    workspace_id: str,
    request: Request,
    project_data: ProjectCreateRequest,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    """Create a new project in workspace."""
    scope = request.state.validated_scope

    project = Project(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,  # From validated path parameter
        name=project_data.name,
        slug=project_data.slug,
        description=project_data.description,
        created_by=user.id,
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return project
```

**`GET /projects/{project_id}` (Get project details)**

```python
@router.get("/projects/{project_id}")
@require_project(enforce=True)
async def get_project(
    project_id: str,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    """Get project details."""
    scope = request.state.validated_scope

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    return project
```

---

## ✅ COMPLETED: Phase 3 Implementation Summary

**Date Completed:** 2025-12-14
**Files Modified:** 1 ([workspaces.py](app/api/workspaces.py))
**Endpoints Secured:** 3
**Code Impact:** -30 lines (net reduction)
**Status:** Service restarted successfully

### Changes Implemented

**Endpoints Updated:**
1. ✅ `GET /workspaces/{workspace_id}` - Applied `@require_workspace` decorator
2. ✅ `PUT /workspaces/{workspace_id}` - Applied `@require_workspace` decorator + transaction safety
3. ✅ `DELETE /workspaces/{workspace_id}` - Applied `@require_workspace` decorator + business logic checks

**Security Improvements:**
- Replaced manual validation helpers with automatic scope validation
- Upgraded session management to FastAPI dependency injection
- Added explicit `db.commit()` calls for transaction safety
- Removed ~30 lines of manual validation code
- Maintained business logic checks (admin role, default workspace protection)

**See:** [PHASE_3_COMPLETION_SUMMARY.md](PHASE_3_COMPLETION_SUMMARY.md) for complete details.

---

### Phase 3: Project Endpoints (NOT YET IMPLEMENTED)

**Note:** Project CRUD endpoints don't exist yet in CNS service. Only the project-scoped BOM upload endpoint exists (from Phase 1).

#### File: `app/api/projects.py` (NEEDS TO BE CREATED)

---

### Phase 4: Workspace Endpoints (ORIGINAL PLAN - SEE PHASE 3 ABOVE FOR ACTUAL IMPLEMENTATION)

#### File: `app/api/workspaces.py` (was already created, now updated)

**`GET /workspaces` (List workspaces for current tenant)**

```python
@router.get("/workspaces")
async def list_workspaces(
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    """List all workspaces for current user's tenant."""
    # No decorator needed - just filter by user's tenant
    tenant_id = user.organization_id  # Or use get_tenant_id_from_auth_context(user)

    workspaces = db.query(Workspace).join(Organization).filter(
        Organization.control_plane_tenant_id == tenant_id
    ).all()

    return {"workspaces": workspaces}
```

**`GET /workspaces/{workspace_id}` (Get workspace details)**

```python
@router.get("/workspaces/{workspace_id}")
@require_workspace(enforce=True)
async def get_workspace(
    workspace_id: str,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
):
    """Get workspace details."""
    scope = request.state.validated_scope

    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(404, "Workspace not found")

    return workspace
```

---

## Deployment Strategy

### Step 1: Feature Flag (Recommended)

Add feature flag to enable new scope validation:

```python
# In app/config.py
class Settings(BaseSettings):
    # ... existing settings

    enable_project_scope_validation: bool = Field(
        default=False,
        env="ENABLE_PROJECT_SCOPE_VALIDATION",
        description="Enable new project-based scope validation"
    )
```

**Usage in endpoints:**
```python
@router.post("/projects/{project_id}/boms/upload")
async def upload_bom(...):
    if settings.enable_project_scope_validation:
        # Use new scope validation
        scope = request.state.validated_scope
        organization_id = scope["tenant_id"]
    else:
        # Use legacy validation (for rollback safety)
        if not auth.is_super_admin and auth.organization_id != organization_id:
            raise HTTPException(403, ...)
```

### Step 2: Gradual Rollout

1. **Week 1:** Deploy with feature flag OFF, monitor logs
2. **Week 2:** Enable for internal testing tenant only
3. **Week 3:** Enable for 10% of traffic (canary)
4. **Week 4:** Enable for 50% of traffic
5. **Week 5:** Enable for 100% of traffic
6. **Week 6:** Remove legacy code + feature flag

### Step 3: Monitoring

Add metrics to track:
- Scope validation failures (`scope_validation_failed_total`)
- Staff bypass usage (`staff_bypass_total`)
- Cache hit rate (`scope_cache_hit_rate`)
- Validation latency (`scope_validation_duration_seconds`)

---

## Testing Checklist

### Unit Tests

- [ ] Test scope validators with valid/invalid UUIDs
- [ ] Test decorators with missing parameters
- [ ] Test staff bypass logic
- [ ] Test cache behavior (hit/miss/eviction)

### Integration Tests

- [ ] Test BOM upload with valid project_id
- [ ] Test BOM upload with invalid project_id (expect 403)
- [ ] Test BOM upload with project_id from different tenant (expect 403)
- [ ] Test staff user accessing cross-tenant resources (expect success with audit log)
- [ ] Test BOM list filtered by project
- [ ] Test project list filtered by workspace

### End-to-End Tests

- [ ] Upload BOM via Customer Portal
- [ ] Upload BOM via CNS Dashboard (staff)
- [ ] View BOMs grouped by project
- [ ] Create new project in workspace
- [ ] Navigate workspace → project → BOM hierarchy

---

## Rollback Plan

If issues arise after deployment:

1. **Immediate:** Set feature flag to `false` via environment variable
2. **Restart services** to pick up new env var
3. **Traffic reverts** to legacy validation path
4. **Investigate** scope validation issues in logs
5. **Fix** and redeploy with feature flag still off
6. **Re-enable** feature flag after validation

No database rollback needed - migrations are backward compatible.

---

## Migration Guide for API Consumers

### For Customer Portal

**OLD:**
```typescript
POST /boms/upload
Content-Type: multipart/form-data

{
  file: <file>,
  organization_id: "abc-123",  // ❌ REMOVE
  project_id: "xyz-789",       // ❌ Move to path
  bom_name: "My BOM",
  start_enrichment: true
}
```

**NEW:**
```typescript
POST /projects/xyz-789/boms/upload  // ✅ project_id in path
Content-Type: multipart/form-data

{
  file: <file>,
  // organization_id removed - server derives from JWT
  bom_name: "My BOM",
  start_enrichment: true
}
```

### For CNS Dashboard

Update axios interceptor to extract `project_id` from current context:

```typescript
// In src/contexts/ProjectContext.tsx
const { currentProject } = useProject();

// In BOM upload
await axios.post(
  `/projects/${currentProject.id}/boms/upload`,  // ✅ Use project context
  formData
);
```

---

## Success Metrics

After full deployment, measure:

1. **Security:**
   - Zero unauthorized cross-tenant access attempts succeed
   - All staff bypass events logged in audit trail

2. **Performance:**
   - Scope validation adds <50ms latency (target: <10ms with caching)
   - Cache hit rate >80%

3. **Reliability:**
   - Zero scope validation errors for valid requests
   - 100% of invalid scope requests properly rejected

4. **Developer Experience:**
   - Endpoint code 30% shorter (removed manual RLS checks)
   - Zero developer confusion about parameter requirements (clear docs)

---

## Next Implementation Session

**Recommended Order:**

1. Start with BOM upload endpoint (`/projects/{project_id}/boms/upload`)
2. Add feature flag for safe rollout
3. Write integration tests
4. Deploy to staging with feature flag OFF
5. Enable for internal testing
6. Monitor and iterate

**Estimated Effort:** 2-3 days for full integration + testing

---

**End of Integration Plan**
