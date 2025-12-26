"""
Example Integration - How to Use Scope Validation in CNS Endpoints

This file demonstrates how to integrate scope decorators and dependencies
into actual CNS service endpoints.

DO NOT RUN THIS FILE - It's for reference only.
Copy patterns to actual endpoint files (e.g., app/api/boms.py).
"""

from typing import List, Optional, Dict
from fastapi import APIRouter, Request, Depends, HTTPException, status
from pydantic import BaseModel

# Import scope validation
from app.core.scope_decorators import (
    require_workspace,
    require_project,
    require_bom,
    staff_can_cross_scope,
)
from app.dependencies import (
    require_workspace_context,
    require_project_context,
    require_bom_context,
    get_optional_workspace_context,
)

# Import existing CNS dependencies
from app.auth.dependencies import get_current_user, User
from app.models.dual_database import get_dual_database

router = APIRouter(prefix="/api/v1", tags=["scope-validated"])


# =============================================================================
# Database Session Helper
# =============================================================================

def get_supabase_session():
    """Get Supabase database session."""
    dual_db = get_dual_database()
    session = dual_db.SupabaseSession()
    try:
        yield session
    finally:
        session.close()


# =============================================================================
# Example Models (Replace with actual CNS models)
# =============================================================================

class WorkspaceStats(BaseModel):
    workspace_id: str
    project_count: int
    bom_count: int
    user_count: int


class Project(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: Optional[str]


class BOM(BaseModel):
    id: str
    project_id: str
    name: str
    line_item_count: int


class BOMUpdateRequest(BaseModel):
    name: Optional[str]
    description: Optional[str]


# =============================================================================
# Pattern 1: Decorator-Based Validation (Path Parameters)
# =============================================================================

@router.get("/workspaces/{workspace_id}/stats", response_model=WorkspaceStats)
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

    Returns:
        WorkspaceStats with counts
    """
    # Scope already validated by decorator
    scope = request.state.validated_scope
    # scope = {"tenant_id": "...", "workspace_id": "..."}

    # Query stats - workspace_id is guaranteed valid
    # Replace with actual query logic
    stats = {
        "workspace_id": workspace_id,
        "project_count": 10,
        "bom_count": 50,
        "user_count": 5,
    }

    return stats


@router.get("/projects/{project_id}/boms", response_model=List[BOM])
@require_project(enforce=True, log_access=True)
async def list_boms_in_project(
    project_id: str,
    request: Request,
    db = Depends(get_supabase_session),
    user: User = Depends(get_current_user)
):
    """
    List all BOMs in a project.

    Decorator validates full chain:
    - project_id belongs to workspace
    - workspace belongs to organization
    - organization belongs to user's tenant

    Returns:
        List of BOMs
    """
    # Scope validated by decorator
    scope = request.state.validated_scope
    # scope = {"tenant_id": "...", "workspace_id": "...", "project_id": "..."}

    # Query BOMs - project_id is guaranteed valid
    # Replace with actual query
    boms = [
        {
            "id": "bom-1",
            "project_id": project_id,
            "name": "BOM 1",
            "line_item_count": 100,
        }
    ]

    return boms


@router.patch("/boms/{bom_id}", response_model=BOM)
@require_bom(enforce=True, log_access=True)
async def update_bom(
    bom_id: str,
    data: BOMUpdateRequest,
    request: Request,
    db = Depends(get_supabase_session),
    user: User = Depends(get_current_user)
):
    """
    Update BOM.

    Decorator validates complete hierarchy:
    - bom_id → project_id → workspace_id → org_id → tenant_id

    Args:
        bom_id: BOM UUID from path
        data: Update request body

    Returns:
        Updated BOM
    """
    # Full chain validated by decorator
    scope = request.state.validated_scope
    # scope = {
    #   "tenant_id": "...",
    #   "workspace_id": "...",
    #   "project_id": "...",
    #   "bom_id": "..."
    # }

    # Update BOM - bom_id is guaranteed valid
    # Replace with actual update logic
    updated_bom = {
        "id": bom_id,
        "project_id": scope["project_id"],
        "name": data.name or "Updated BOM",
        "line_item_count": 100,
    }

    return updated_bom


# =============================================================================
# Pattern 2: Dependency-Based Validation (Headers)
# =============================================================================

@router.get("/workspaces/current/projects", response_model=List[Project])
async def list_projects_in_workspace(
    scope: Dict = Depends(require_workspace_context)
):
    """
    List projects in the workspace specified by X-Workspace-ID header.

    Request:
        GET /api/v1/workspaces/current/projects
        Headers:
            X-Workspace-ID: workspace-uuid-123
            Authorization: Bearer <token>

    Dependency validates:
    - X-Workspace-ID header present
    - Workspace belongs to user's tenant

    Returns:
        List of projects
    """
    workspace_id = scope["workspace_id"]
    tenant_id = scope["tenant_id"]

    # Query projects - workspace_id is validated
    # Replace with actual query
    projects = [
        {
            "id": "project-1",
            "workspace_id": workspace_id,
            "name": "Project 1",
            "description": "First project",
        }
    ]

    return projects


@router.get("/projects/current/boms", response_model=List[BOM])
async def list_boms_in_current_project(
    scope: Dict = Depends(require_project_context)
):
    """
    List BOMs in the project specified by headers.

    Request:
        GET /api/v1/projects/current/boms
        Headers:
            X-Workspace-ID: workspace-uuid-123
            X-Project-ID: project-uuid-456
            Authorization: Bearer <token>

    Dependency validates:
    - Both headers present
    - Project belongs to workspace
    - Workspace belongs to user's tenant

    Returns:
        List of BOMs
    """
    project_id = scope["project_id"]
    workspace_id = scope["workspace_id"]

    # Query BOMs - project_id is validated
    # Replace with actual query
    boms = [
        {
            "id": "bom-1",
            "project_id": project_id,
            "name": "BOM 1",
            "line_item_count": 100,
        }
    ]

    return boms


@router.patch("/boms/current", response_model=BOM)
async def update_current_bom(
    data: BOMUpdateRequest,
    scope: Dict = Depends(require_bom_context)
):
    """
    Update the BOM specified by headers.

    Request:
        PATCH /api/v1/boms/current
        Headers:
            X-Workspace-ID: workspace-uuid-123
            X-Project-ID: project-uuid-456
            X-BOM-ID: bom-uuid-789
            Authorization: Bearer <token>
        Body:
            {"name": "Updated BOM Name"}

    Dependency validates complete chain:
    - All headers present
    - BOM → project → workspace → org → tenant

    Returns:
        Updated BOM
    """
    bom_id = scope["bom_id"]
    project_id = scope["project_id"]

    # Update BOM - bom_id is validated
    # Replace with actual update logic
    updated_bom = {
        "id": bom_id,
        "project_id": project_id,
        "name": data.name or "Updated BOM",
        "line_item_count": 100,
    }

    return updated_bom


# =============================================================================
# Pattern 3: Optional Scope Context
# =============================================================================

@router.get("/dashboard")
async def get_dashboard(
    scope: Optional[Dict] = Depends(get_optional_workspace_context),
    user: User = Depends(get_current_user)
):
    """
    Get dashboard data.

    Works with or without workspace context.

    Request (workspace-specific):
        GET /api/v1/dashboard
        Headers:
            X-Workspace-ID: workspace-uuid-123
            Authorization: Bearer <token>

    Request (global):
        GET /api/v1/dashboard
        Headers:
            Authorization: Bearer <token>

    Returns:
        Dashboard data (workspace-specific or global)
    """
    if scope:
        # Workspace-specific dashboard
        workspace_id = scope["workspace_id"]
        return {
            "type": "workspace",
            "workspace_id": workspace_id,
            "stats": {"projects": 10, "boms": 50},
        }
    else:
        # User's global dashboard (all workspaces)
        return {
            "type": "global",
            "user_id": user.id,
            "workspaces": [
                {"id": "ws-1", "name": "Workspace 1"},
                {"id": "ws-2", "name": "Workspace 2"},
            ],
        }


# =============================================================================
# Pattern 4: Staff Override (Cross-Scope Access)
# =============================================================================

@router.get("/admin/all-boms", response_model=List[BOM])
@staff_can_cross_scope
async def list_all_boms(
    request: Request,
    user: User = Depends(get_current_user)
):
    """
    List all BOMs across all tenants (staff only).

    Decorator allows super_admin/platform_admin to bypass scope validation.
    All access is logged for compliance.

    Returns:
        All BOMs (staff) or user's BOMs (regular users)
    """
    if getattr(request.state, "is_staff_override", False):
        # Staff user - can access all BOMs across all tenants
        # Replace with actual query for all BOMs
        return [
            {"id": "bom-1", "project_id": "proj-1", "name": "BOM 1", "line_item_count": 100},
            {"id": "bom-2", "project_id": "proj-2", "name": "BOM 2", "line_item_count": 200},
            # ... BOMs from all tenants
        ]
    else:
        # Regular user - only their BOMs
        # Replace with actual query for user's BOMs
        return [
            {"id": "bom-1", "project_id": "proj-1", "name": "My BOM", "line_item_count": 50},
        ]


# =============================================================================
# Pattern 5: Combining Decorator + Role Check
# =============================================================================

from app.auth.dependencies import require_workspace_write

@router.post("/workspaces/{workspace_id}/projects", response_model=Project)
@require_workspace(enforce=True, log_access=True)
async def create_project(
    workspace_id: str,
    request: Request,
    db = Depends(get_supabase_session),
    context = Depends(require_workspace_write)  # Requires engineer/admin role
):
    """
    Create a new project in workspace.

    Combines scope validation + role check:
    - Decorator validates workspace belongs to tenant
    - Dependency validates user has write access (engineer/admin role)

    Args:
        workspace_id: Workspace UUID from path

    Returns:
        Created project
    """
    # Both validations passed:
    # 1. workspace_id belongs to user's tenant
    # 2. user has write access to workspace

    scope = request.state.validated_scope
    user = context.user

    # Create project - workspace_id is validated, user has write access
    # Replace with actual creation logic
    new_project = {
        "id": "project-new",
        "workspace_id": workspace_id,
        "name": "New Project",
        "description": f"Created by {user.email}",
    }

    return new_project


# =============================================================================
# Pattern 6: Warning Mode (Testing)
# =============================================================================

@router.get("/workspaces/{workspace_id}/experimental")
@require_workspace(enforce=False, log_access=True)  # Warning mode
async def experimental_endpoint(
    workspace_id: str,
    request: Request,
    db = Depends(get_supabase_session),
    user: User = Depends(get_current_user)
):
    """
    Experimental endpoint with warning mode validation.

    Decorator logs violations but doesn't block requests.
    Useful for testing validation without breaking existing clients.

    Once tested, change to enforce=True.
    """
    scope = request.state.validated_scope

    # Even if validation failed, endpoint still runs
    # Check logs for [SCOPE_WARNING] entries
    return {
        "workspace_id": workspace_id,
        "experimental": True,
        "note": "This endpoint is in testing mode",
    }


# =============================================================================
# Testing Examples
# =============================================================================

"""
cURL Examples:

1. Decorator-based (path parameter):
   curl -X GET http://localhost:27200/api/v1/workspaces/workspace-123/stats \
     -H "Authorization: Bearer <token>"

2. Dependency-based (header):
   curl -X GET http://localhost:27200/api/v1/workspaces/current/projects \
     -H "Authorization: Bearer <token>" \
     -H "X-Workspace-ID: workspace-123"

3. Update BOM (header):
   curl -X PATCH http://localhost:27200/api/v1/boms/current \
     -H "Authorization: Bearer <token>" \
     -H "X-Workspace-ID: workspace-123" \
     -H "X-Project-ID: project-456" \
     -H "X-BOM-ID: bom-789" \
     -H "Content-Type: application/json" \
     -d '{"name": "Updated BOM"}'

4. Optional workspace (with header):
   curl -X GET http://localhost:27200/api/v1/dashboard \
     -H "Authorization: Bearer <token>" \
     -H "X-Workspace-ID: workspace-123"

5. Optional workspace (without header):
   curl -X GET http://localhost:27200/api/v1/dashboard \
     -H "Authorization: Bearer <token>"

6. Staff override:
   curl -X GET http://localhost:27200/api/v1/admin/all-boms \
     -H "Authorization: Bearer <staff-token>"
"""

# =============================================================================
# Error Responses
# =============================================================================

"""
Expected Error Responses:

1. Missing path parameter (400):
   {
     "detail": "workspace_id required in URL path"
   }

2. Missing header (400):
   {
     "detail": "X-Workspace-ID header required"
   }

3. Invalid workspace (403):
   {
     "detail": "Workspace abc-123 does not belong to your tenant"
   }

4. Invalid project (403):
   {
     "detail": "Project access denied: Project not found in workspace"
   }

5. Invalid BOM (403):
   {
     "detail": "BOM access denied: BOM not found"
   }
"""
