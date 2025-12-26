# Scope Validation - Quick Reference Card

## When to Use What

| Scenario | Use This | Example |
|----------|----------|---------|
| Workspace in URL path | `@require_workspace` decorator | `/workspaces/{workspace_id}/stats` |
| Project in URL path | `@require_project` decorator | `/projects/{project_id}/boms` |
| BOM in URL path | `@require_bom` decorator | `/boms/{bom_id}` |
| Workspace in header | `Depends(require_workspace_context)` | Headers: `X-Workspace-ID` |
| Project in header | `Depends(require_project_context)` | Headers: `X-Workspace-ID`, `X-Project-ID` |
| BOM in header | `Depends(require_bom_context)` | Headers: `X-Workspace-ID`, `X-Project-ID`, `X-BOM-ID` |
| Optional workspace | `Depends(get_optional_workspace_context)` | Works with or without header |
| Staff override | `@staff_can_cross_scope` | Before other decorators |

## Import Statements

```python
# Decorators
from app.core.scope_decorators import (
    require_workspace,
    require_project,
    require_bom,
    staff_can_cross_scope,
)

# Dependencies
from app.dependencies import (
    require_workspace_context,
    require_project_context,
    require_bom_context,
    get_optional_workspace_context,
    get_optional_project_context,
)

# Required FastAPI imports
from fastapi import APIRouter, Request, Depends
from app.auth.dependencies import get_current_user, User
from app.models.dual_database import get_dual_database

# Database session helper
def get_supabase_session():
    dual_db = get_dual_database()
    session = dual_db.SupabaseSession()
    try:
        yield session
    finally:
        session.close()
```

## Decorator Templates

### Workspace Validation
```python
@router.get("/workspaces/{workspace_id}/stats")
@require_workspace(enforce=True, log_access=True)
async def get_workspace_stats(
    workspace_id: str,
    request: Request,
    db = Depends(get_supabase_session),
    user: User = Depends(get_current_user)
):
    scope = request.state.validated_scope
    # Use workspace_id safely - already validated
    return {"workspace_id": workspace_id, "stats": {...}}
```

### Project Validation
```python
@router.get("/projects/{project_id}/boms")
@require_project(enforce=True, log_access=True)
async def list_boms(
    project_id: str,
    request: Request,
    db = Depends(get_supabase_session),
    user: User = Depends(get_current_user)
):
    scope = request.state.validated_scope
    # scope = {tenant_id, workspace_id, project_id}
    return get_boms(project_id)
```

### BOM Validation
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
    scope = request.state.validated_scope
    # scope = {tenant_id, workspace_id, project_id, bom_id}
    return update_bom_data(bom_id, data)
```

### Staff Override
```python
@router.get("/admin/all-boms")
@staff_can_cross_scope
async def list_all_boms(
    request: Request,
    user: User = Depends(get_current_user)
):
    if request.state.is_staff_override:
        return get_all_boms()  # Staff: all BOMs
    else:
        return get_user_boms(user.id)  # Regular: user's BOMs only
```

## Dependency Templates

### Workspace Context
```python
@router.get("/workspaces/current/projects")
async def list_projects(
    scope: dict = Depends(require_workspace_context)
):
    workspace_id = scope["workspace_id"]
    tenant_id = scope["tenant_id"]
    return get_projects(workspace_id)
```

### Project Context
```python
@router.get("/projects/current/boms")
async def list_boms(
    scope: dict = Depends(require_project_context)
):
    project_id = scope["project_id"]
    workspace_id = scope["workspace_id"]
    return get_boms(project_id)
```

### BOM Context
```python
@router.patch("/boms/current")
async def update_bom(
    scope: dict = Depends(require_bom_context),
    data: BOMUpdateRequest
):
    bom_id = scope["bom_id"]
    return update_bom_data(bom_id, data)
```

### Optional Context
```python
@router.get("/dashboard")
async def get_dashboard(
    scope: Optional[dict] = Depends(get_optional_workspace_context)
):
    if scope:
        return get_workspace_dashboard(scope["workspace_id"])
    else:
        return get_global_dashboard()
```

## Request Headers (for Dependencies)

```bash
# Workspace context
curl -X GET http://localhost:27200/api/workspaces/current/projects \
  -H "Authorization: Bearer <token>" \
  -H "X-Workspace-ID: workspace-uuid-123"

# Project context
curl -X GET http://localhost:27200/api/projects/current/boms \
  -H "Authorization: Bearer <token>" \
  -H "X-Workspace-ID: workspace-uuid-123" \
  -H "X-Project-ID: project-uuid-456"

# BOM context
curl -X PATCH http://localhost:27200/api/boms/current \
  -H "Authorization: Bearer <token>" \
  -H "X-Workspace-ID: workspace-uuid-123" \
  -H "X-Project-ID: project-uuid-456" \
  -H "X-BOM-ID: bom-uuid-789" \
  -d '{"name": "Updated BOM"}'
```

## Scope Dict Structure

```python
# Workspace scope
{
    "tenant_id": "uuid-string",
    "workspace_id": "uuid-string"
}

# Project scope
{
    "tenant_id": "uuid-string",
    "workspace_id": "uuid-string",
    "project_id": "uuid-string"
}

# BOM scope
{
    "tenant_id": "uuid-string",
    "workspace_id": "uuid-string",
    "project_id": "uuid-string",
    "bom_id": "uuid-string"
}
```

## Error Responses

| Status | Error | Cause |
|--------|-------|-------|
| 400 | `workspace_id required in URL path` | Decorator: missing path parameter |
| 400 | `X-Workspace-ID header required` | Dependency: missing header |
| 403 | `Workspace ... does not belong to tenant ...` | Invalid scope |
| 403 | `Project access denied: ...` | Invalid project chain |
| 403 | `BOM access denied: ...` | Invalid BOM chain |

## Decorator Parameters

```python
@require_workspace(
    enforce=True,      # If False: log violations but don't block
    log_access=True    # If True: write to logs (and future audit_logs)
)
```

**Warning Mode**: Use `enforce=False` during testing to identify issues without blocking requests.

## Required Function Parameters

### For Decorators:
```python
async def endpoint(
    workspace_id: str,        # Path parameter (must match decorator)
    request: Request,         # Required for request.state
    db = Depends(...),        # Required for validation
    user: User = Depends(...) # Required for tenant_id
):
```

### For Dependencies:
```python
async def endpoint(
    scope: dict = Depends(require_workspace_context)  # All validation handled
):
```

## Validation Chain

| Validator | Checks |
|-----------|--------|
| `@require_workspace` | workspace → org → tenant |
| `@require_project` | project → workspace → org → tenant |
| `@require_bom` | bom → project → workspace → org → tenant |

All validations use database FK relationships - no assumptions.

## Common Patterns

### Combine Decorator + Role Check
```python
from app.auth.dependencies import require_workspace_write

@router.post("/workspaces/{workspace_id}/projects")
@require_workspace(enforce=True)
async def create_project(
    workspace_id: str,
    request: Request,
    db = Depends(get_supabase_session),
    context = Depends(require_workspace_write)  # engineer/admin role
):
    # Validated: workspace in tenant + user has write access
    pass
```

### Multiple Scope IDs
```python
@router.get("/workspaces/{workspace_id}/projects/{project_id}/stats")
@require_workspace(enforce=True)  # Validates workspace
async def get_stats(
    workspace_id: str,
    project_id: str,
    request: Request,
    db = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
    # Also validate project
    project_scope: dict = Depends(require_project_context)
):
    # Double validation for extra security
    pass
```

### Testing Mode
```python
# Phase 1: Deploy with warnings only
@require_workspace(enforce=False, log_access=True)

# Phase 2: After verifying logs, enable enforcement
@require_workspace(enforce=True, log_access=True)
```

## Files

| File | Purpose |
|------|---------|
| `app/core/scope_decorators.py` | Decorator implementation |
| `app/dependencies/scope_deps.py` | Dependency implementation |
| `SCOPE_VALIDATION_USAGE.md` | Full guide with examples |
| `SCOPE_QUICK_REFERENCE.md` | This quick reference |

## Getting Help

1. Check `SCOPE_VALIDATION_USAGE.md` for detailed examples
2. Review logs for `[SCOPE_ACCESS]` and `[SCOPE_VIOLATION]` messages
3. Verify database FK relationships exist
4. Test with `enforce=False` to identify issues without blocking
