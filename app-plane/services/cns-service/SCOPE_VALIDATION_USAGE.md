# Scope Validation Usage Guide

Complete guide for using scope decorators and dependencies in CNS service endpoints.

## Overview

The CNS service provides two approaches for scope validation:

1. **Decorators** (`app.core.scope_decorators`) - Function decorators for path-based validation
2. **Dependencies** (`app.dependencies.scope_deps`) - FastAPI dependencies for header-based validation

Both approaches use the same underlying validators from `app.core.scope_validators`.

---

## Approach 1: Decorators (Path-Based)

Use decorators when scope IDs come from URL path parameters.

### Available Decorators

| Decorator | Validates | Sets `request.state.validated_scope` |
|-----------|-----------|--------------------------------------|
| `@require_workspace` | workspace_id in tenant | `{tenant_id, workspace_id}` |
| `@require_project` | project → workspace → tenant | `{tenant_id, workspace_id, project_id}` |
| `@require_bom` | bom → project → workspace → tenant | `{tenant_id, workspace_id, project_id, bom_id}` |
| `@staff_can_cross_scope` | Allows staff to bypass | `is_staff_override=True` |

### Example: Workspace Decorator

```python
from fastapi import APIRouter, Request, Depends
from app.auth.dependencies import get_current_user, User
from app.core.scope_decorators import require_workspace
from app.models.dual_database import get_dual_database

router = APIRouter()

def get_supabase_session():
    dual_db = get_dual_database()
    session = dual_db.SupabaseSession()
    try:
        yield session
    finally:
        session.close()

@router.get("/workspaces/{workspace_id}/stats")
@require_workspace(enforce=True, log_access=True)
async def get_workspace_stats(
    workspace_id: str,
    request: Request,
    db = Depends(get_supabase_session),
    user: User = Depends(get_current_user)
):
    """
    Get workspace statistics.

    Decorator validates:
    - workspace_id (from path) belongs to user's tenant

    Returns validated scope in request.state.validated_scope
    """
    scope = request.state.validated_scope
    # scope = {"tenant_id": "...", "workspace_id": "..."}

    # workspace_id is guaranteed valid at this point
    stats = calculate_workspace_stats(workspace_id)
    return {"workspace_id": workspace_id, "stats": stats}
```

### Example: Project Decorator

```python
@router.get("/projects/{project_id}/boms")
@require_project(enforce=True, log_access=True)
async def list_boms(
    project_id: str,
    request: Request,
    db = Depends(get_supabase_session),
    user: User = Depends(get_current_user)
):
    """
    List BOMs in a project.

    Decorator validates full chain:
    - project_id belongs to workspace
    - workspace belongs to organization
    - organization belongs to user's tenant
    """
    scope = request.state.validated_scope
    # scope = {"tenant_id": "...", "workspace_id": "...", "project_id": "..."}

    boms = get_boms_for_project(project_id)
    return {"project_id": project_id, "boms": boms}
```

### Example: BOM Decorator

```python
@router.patch("/boms/{bom_id}")
@require_bom(enforce=True, log_access=True)
async def update_bom(
    bom_id: str,
    request: Request,
    db = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
    data: BOMUpdateRequest
):
    """
    Update BOM.

    Decorator validates complete hierarchy:
    - bom_id → project_id → workspace_id → org_id → tenant_id
    """
    scope = request.state.validated_scope
    # scope = {
    #   "tenant_id": "...",
    #   "workspace_id": "...",
    #   "project_id": "...",
    #   "bom_id": "..."
    # }

    updated_bom = update_bom_data(bom_id, data)
    return updated_bom
```

### Example: Staff Cross-Scope Access

```python
@router.get("/admin/all-boms")
@staff_can_cross_scope
async def list_all_boms(
    request: Request,
    user: User = Depends(get_current_user)
):
    """
    List all BOMs across all tenants (staff only).

    Decorator allows super_admin/platform_admin to bypass scope validation.
    All access is logged for compliance.
    """
    if getattr(request.state, "is_staff_override", False):
        # Staff user - can access all BOMs
        return get_all_boms()
    else:
        # Regular user - return only their BOMs
        return get_user_boms(user.id)
```

### Decorator Parameters

All decorators support these parameters:

```python
@require_workspace(
    enforce=True,      # If False, log violations but don't block
    log_access=True    # If True, write to logs (future: audit_logs table)
)
```

**Warning Mode**: Set `enforce=False` to test validation without blocking requests:

```python
@require_workspace(enforce=False, log_access=True)
async def test_endpoint(...):
    # Will log violations but not raise HTTPException
    pass
```

---

## Approach 2: Dependencies (Header-Based)

Use dependencies when scope IDs come from request headers.

### Available Dependencies

| Dependency | Headers Required | Returns |
|------------|------------------|---------|
| `require_workspace_context` | `X-Workspace-ID` | `{tenant_id, workspace_id}` |
| `require_project_context` | `X-Workspace-ID`, `X-Project-ID` | `{tenant_id, workspace_id, project_id}` |
| `require_bom_context` | `X-Workspace-ID`, `X-Project-ID`, `X-BOM-ID` | `{tenant_id, workspace_id, project_id, bom_id}` |
| `get_optional_workspace_context` | `X-Workspace-ID` (optional) | Scope dict or `None` |
| `get_optional_project_context` | `X-Workspace-ID`, `X-Project-ID` (optional) | Scope dict or `None` |

### Example: Workspace Dependency

```python
from fastapi import APIRouter, Depends
from app.dependencies import require_workspace_context

router = APIRouter()

@router.get("/workspaces/current/projects")
async def list_projects(
    scope: dict = Depends(require_workspace_context)
):
    """
    List projects in the workspace specified by X-Workspace-ID header.

    Request:
        GET /workspaces/current/projects
        Headers:
            X-Workspace-ID: workspace-uuid-123
            Authorization: Bearer <token>

    Dependency validates:
    - X-Workspace-ID header present
    - Workspace belongs to user's tenant
    """
    workspace_id = scope["workspace_id"]
    tenant_id = scope["tenant_id"]

    projects = get_projects_for_workspace(workspace_id)
    return {"workspace_id": workspace_id, "projects": projects}
```

### Example: Project Dependency

```python
from app.dependencies import require_project_context

@router.get("/projects/current/boms")
async def list_boms(
    scope: dict = Depends(require_project_context)
):
    """
    List BOMs in the project specified by headers.

    Request:
        GET /projects/current/boms
        Headers:
            X-Workspace-ID: workspace-uuid-123
            X-Project-ID: project-uuid-456
            Authorization: Bearer <token>

    Dependency validates:
    - Both headers present
    - Project belongs to workspace
    - Workspace belongs to user's tenant
    """
    project_id = scope["project_id"]
    workspace_id = scope["workspace_id"]

    boms = get_boms_for_project(project_id)
    return {"project_id": project_id, "boms": boms}
```

### Example: Optional Workspace Dependency

```python
from typing import Optional
from app.dependencies import get_optional_workspace_context

@router.get("/dashboard")
async def get_dashboard(
    scope: Optional[dict] = Depends(get_optional_workspace_context)
):
    """
    Get dashboard data.

    Works with or without workspace context.

    Request (workspace-specific):
        GET /dashboard
        Headers:
            X-Workspace-ID: workspace-uuid-123

    Request (global):
        GET /dashboard
        (no X-Workspace-ID header)
    """
    if scope:
        # Workspace-specific dashboard
        workspace_id = scope["workspace_id"]
        return get_workspace_dashboard(workspace_id)
    else:
        # User's global dashboard
        return get_user_dashboard()
```

### Example: BOM Dependency

```python
from app.dependencies import require_bom_context

@router.patch("/boms/current")
async def update_bom(
    scope: dict = Depends(require_bom_context),
    data: BOMUpdateRequest
):
    """
    Update the BOM specified by headers.

    Request:
        PATCH /boms/current
        Headers:
            X-Workspace-ID: workspace-uuid-123
            X-Project-ID: project-uuid-456
            X-BOM-ID: bom-uuid-789
        Body:
            {"name": "Updated BOM Name"}

    Dependency validates complete chain:
    - All headers present
    - BOM → project → workspace → org → tenant
    """
    bom_id = scope["bom_id"]

    updated_bom = update_bom_data(bom_id, data)
    return updated_bom
```

---

## Choosing Between Decorators and Dependencies

### Use Decorators When:
- Scope IDs are in URL path parameters
- You want validation at the function level
- Endpoint structure: `/workspaces/{workspace_id}/...`

### Use Dependencies When:
- Scope IDs come from request headers
- You want validation at the parameter level
- Endpoint structure: `/workspaces/current/...` + headers
- You need optional scope context

### Can Use Both:
```python
@router.get("/workspaces/{workspace_id}/projects/{project_id}/stats")
@require_workspace(enforce=True)  # Validates workspace_id from path
async def get_stats(
    workspace_id: str,
    project_id: str,
    request: Request,
    db = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
    # Also validate project via dependency
    scope: dict = Depends(require_project_context)
):
    # Double validation for extra security
    # Decorator validated workspace_id
    # Dependency validated project_id via headers
    pass
```

---

## Error Responses

### Missing Header (Dependencies)
```json
{
  "detail": "X-Workspace-ID header required"
}
```
Status: `400 Bad Request`

### Missing Path Parameter (Decorators)
```json
{
  "detail": "workspace_id required in URL path"
}
```
Status: `400 Bad Request`

### Invalid Scope
```json
{
  "detail": "Workspace abc-123 does not belong to your tenant"
}
```
Status: `403 Forbidden`

### Project Validation Failure
```json
{
  "detail": "Project access denied: Project not found in workspace"
}
```
Status: `403 Forbidden`

---

## Testing Endpoints with Scope Validation

### Using cURL (Decorator-based)

```bash
# Valid request
curl -X GET \
  http://localhost:27200/api/workspaces/workspace-uuid-123/stats \
  -H "Authorization: Bearer <token>"

# Invalid workspace (403)
curl -X GET \
  http://localhost:27200/api/workspaces/wrong-workspace-id/stats \
  -H "Authorization: Bearer <token>"
```

### Using cURL (Dependency-based)

```bash
# Valid request
curl -X GET \
  http://localhost:27200/api/workspaces/current/projects \
  -H "Authorization: Bearer <token>" \
  -H "X-Workspace-ID: workspace-uuid-123"

# Missing header (400)
curl -X GET \
  http://localhost:27200/api/workspaces/current/projects \
  -H "Authorization: Bearer <token>"

# Invalid workspace (403)
curl -X GET \
  http://localhost:27200/api/workspaces/current/projects \
  -H "Authorization: Bearer <token>" \
  -H "X-Workspace-ID: wrong-workspace-id"
```

### Using Python Requests

```python
import requests

BASE_URL = "http://localhost:27200/api"
TOKEN = "your-jwt-token"

# Decorator-based endpoint
response = requests.get(
    f"{BASE_URL}/workspaces/workspace-uuid-123/stats",
    headers={"Authorization": f"Bearer {TOKEN}"}
)
print(response.json())

# Dependency-based endpoint
response = requests.get(
    f"{BASE_URL}/workspaces/current/projects",
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "X-Workspace-ID": "workspace-uuid-123"
    }
)
print(response.json())
```

---

## Logging and Auditing

All scope validation is logged:

```
[SCOPE_ACCESS] user=user-123 workspace=workspace-456 tenant=tenant-789
[SCOPE_VIOLATION] User user-123 attempted to access workspace workspace-999 not in tenant tenant-789
[CROSS_SCOPE_ACCESS] Staff user staff-123 accessing /admin/all-boms with scope bypass
```

Log levels:
- `INFO` - Successful validations
- `WARNING` - Violations (enforce=True raises exception, enforce=False logs only)
- `WARNING` - Cross-scope access by staff

Future: Audit logs will be written to `audit_logs` table for compliance.

---

## Advanced Patterns

### Combining with Role Checks

```python
from app.auth.dependencies import require_workspace_write

@router.post("/workspaces/{workspace_id}/projects")
@require_workspace(enforce=True)
async def create_project(
    workspace_id: str,
    request: Request,
    db = Depends(get_supabase_session),
    context = Depends(require_workspace_write)  # Requires engineer/admin role
):
    # Validated: workspace in tenant + user has write access
    scope = request.state.validated_scope
    return create_project_in_workspace(workspace_id, context.user.id)
```

### Warning Mode During Migration

```python
# Phase 1: Deploy with enforce=False to test validation
@require_workspace(enforce=False, log_access=True)
async def legacy_endpoint(...):
    # Logs violations but doesn't block
    pass

# Phase 2: After testing, enable enforcement
@require_workspace(enforce=True, log_access=True)
async def legacy_endpoint(...):
    # Now blocks invalid requests
    pass
```

### Staff Override with Logging

```python
@router.delete("/admin/workspaces/{workspace_id}")
@staff_can_cross_scope
@require_workspace(enforce=True)
async def delete_workspace(
    workspace_id: str,
    request: Request,
    db = Depends(get_supabase_session),
    user: User = Depends(get_current_user)
):
    # Staff can delete any workspace
    # Regular users can only delete their own
    if not getattr(request.state, "is_staff_override", False):
        # Extra validation for non-staff
        if not user_owns_workspace(user.id, workspace_id):
            raise HTTPException(403, "Only workspace owner can delete")

    delete_workspace_data(workspace_id)
    return {"status": "deleted"}
```

---

## Migration Guide

### Migrating Existing Endpoints

**Before:**
```python
@router.get("/workspaces/{workspace_id}/stats")
async def get_stats(workspace_id: str, user: User = Depends(get_current_user)):
    # No scope validation!
    return get_workspace_stats(workspace_id)
```

**After (Decorator):**
```python
@router.get("/workspaces/{workspace_id}/stats")
@require_workspace(enforce=True)
async def get_stats(
    workspace_id: str,
    request: Request,
    db = Depends(get_supabase_session),
    user: User = Depends(get_current_user)
):
    # Validated: workspace belongs to user's tenant
    return get_workspace_stats(workspace_id)
```

**After (Dependency):**
```python
@router.get("/workspaces/current/stats")
async def get_stats(scope: dict = Depends(require_workspace_context)):
    workspace_id = scope["workspace_id"]
    return get_workspace_stats(workspace_id)
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `app/core/scope_validators.py` | Core validation logic (DB queries) |
| `app/core/scope_decorators.py` | Function decorators for path-based validation |
| `app/dependencies/scope_deps.py` | FastAPI dependencies for header-based validation |
| `test_decorators.py` | Test suite |
| `SCOPE_VALIDATION_USAGE.md` | This file |

---

## Support

For questions or issues with scope validation:
1. Check logs for `[SCOPE_ACCESS]` and `[SCOPE_VIOLATION]` messages
2. Review `app/core/scope_validators.py` for validation logic
3. Verify database FK relationships (organizations, workspaces, projects, boms)
4. Test with `enforce=False` first to identify issues without blocking requests
