"""
Project Management API

Full CRUD operations for projects within workspaces:
- GET /api/projects - List projects in workspace
- POST /api/projects - Create new project
- GET /api/projects/{project_id} - Get project details
- PATCH /api/projects/{project_id} - Update project
- DELETE /api/projects/{project_id} - Soft delete project

**Phase 3: CNS Projects Alignment**

Authorization:
    - Automatic validation: project → workspace → organization
    - Users can only access projects in their workspace
    - Staff users can bypass scope validation

Security:
    - Server derives workspace_id and organization_id from validated FK chain
    - Cross-tenant access automatically denied
    - Comprehensive audit logging
"""

import json
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth.dependencies import User, get_current_user
from app.core.scope_decorators import require_workspace, require_project
from app.dependencies.scope_deps import get_supabase_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


# ============================================================================
# Pydantic Models
# ============================================================================

class ProjectResponse(BaseModel):
    id: str
    organization_id: str
    workspace_id: str
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    project_code: Optional[str] = None
    status: str = "active"
    visibility: str = "private"
    project_owner_id: Optional[str] = None
    created_by_id: Optional[str] = None
    total_boms: int = 0
    total_components: int = 0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    last_activity_at: Optional[str] = None
    tags: List[str] = []
    metadata: Dict[str, Any] = {}
    created_at: str
    updated_at: str


class CreateProjectRequest(BaseModel):
    workspace_id: str = Field(..., description="Workspace UUID")
    name: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = Field(None, max_length=100, pattern=r'^[a-z0-9-]+$')
    description: Optional[str] = Field(None, max_length=1000)
    project_code: Optional[str] = Field(None, max_length=50)
    status: str = Field(default="active", pattern=r'^(active|archived|on_hold|completed)$')
    visibility: str = Field(default="private", pattern=r'^(private|team|organization)$')
    project_owner_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    project_code: Optional[str] = Field(None, max_length=50)
    status: Optional[str] = Field(None, pattern=r'^(active|archived|on_hold|completed)$')
    visibility: Optional[str] = Field(None, pattern=r'^(private|team|organization)$')
    project_owner_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class ProjectListResponse(BaseModel):
    items: List[ProjectResponse]
    total: int


# ============================================================================
# Helper Functions
# ============================================================================

def get_project_or_404(
    db: Session,
    project_id: str,
    workspace_id: Optional[str] = None
) -> Any:
    """
    Get project by ID and optionally verify workspace membership.

    Args:
        db: Database session
        project_id: Project UUID
        workspace_id: Optional workspace UUID to verify project belongs to workspace

    Returns:
        Project row

    Raises:
        HTTPException(404): Project not found
        HTTPException(403): Project not in specified workspace
    """
    conditions = ["p.id = CAST(:project_id AS UUID)", "p.status != 'archived'"]
    params = {"project_id": project_id}

    if workspace_id:
        conditions.append("p.workspace_id = CAST(:workspace_id AS UUID)")
        params["workspace_id"] = workspace_id

    where_clause = " AND ".join(conditions)

    project = db.execute(
        text(f"""
            SELECT
                p.id, p.organization_id, p.workspace_id, p.name, p.slug,
                p.description, p.project_code, p.status, p.visibility,
                p.project_owner_id, p.created_by_id, p.total_boms,
                p.total_components, p.start_date, p.end_date,
                p.last_activity_at, p.tags, p.metadata,
                p.created_at, p.updated_at
            FROM projects p
            WHERE {where_clause}
        """),
        params
    ).fetchone()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    return project


def check_dependent_boms(db: Session, project_id: str) -> int:
    """
    Check if project has any BOMs.

    Args:
        db: Database session
        project_id: Project UUID

    Returns:
        Count of BOMs in project
    """
    count = db.execute(
        text("""
            SELECT COUNT(*) FROM boms
            WHERE project_id = CAST(:project_id AS UUID)
        """),
        {"project_id": project_id}
    ).scalar()

    return count or 0


# ============================================================================
# Project CRUD Endpoints
# ============================================================================

@router.get("", response_model=ProjectListResponse)
async def list_projects(
    workspace_id: str = Query(..., description="Workspace UUID to list projects for"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    search: Optional[str] = Query(None, description="Search by name or project_code"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user)
):
    """
    List all projects in a workspace.

    Requires user to be a member of the workspace's organization.
    """
    logger.info(
        f"[PROJECT] Listing projects: workspace={workspace_id}, user={user.id}, is_platform_admin={user.is_platform_admin}"
    )

    # Platform admins can access any workspace without membership check
    is_admin = user.is_platform_admin

    if is_admin:
        # Just verify workspace exists
        workspace = db.execute(
            text("""
                SELECT w.id, w.organization_id
                FROM workspaces w
                WHERE w.id = CAST(:workspace_id AS UUID)
            """),
            {"workspace_id": workspace_id}
        ).fetchone()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )
    else:
        # Verify workspace exists and user is a MEMBER of the workspace
        # Note: user.id is the Keycloak user ID (sub claim), not the database user ID
        # We need to join with users table to find the database user and their workspace membership
        workspace = db.execute(
            text("""
                SELECT w.id, w.organization_id, wm.role, u.id as db_user_id
                FROM workspaces w
                JOIN workspace_members wm ON wm.workspace_id = w.id
                JOIN users u ON u.id = wm.user_id
                WHERE w.id = CAST(:workspace_id AS UUID)
                AND (u.keycloak_user_id = :keycloak_user_id
                     OR u.auth0_user_id = :keycloak_user_id
                     OR CAST(u.id AS TEXT) = :keycloak_user_id)
            """),
            {"workspace_id": workspace_id, "keycloak_user_id": user.id}
        ).fetchone()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Workspace not found or you are not a member of this workspace"
            )

    # Build query conditions
    conditions = [
        "p.workspace_id = CAST(:workspace_id AS UUID)",
        "p.status != 'archived'"
    ]
    params: Dict[str, Any] = {
        "workspace_id": workspace_id,
        "limit": limit,
        "offset": offset
    }

    if status_filter:
        conditions.append("p.status = :status_filter")
        params["status_filter"] = status_filter

    if search:
        conditions.append("(p.name ILIKE :pattern OR p.project_code ILIKE :pattern)")
        params["pattern"] = f"%{search}%"

    where_clause = " AND ".join(conditions)

    # Get total count
    total = db.execute(
        text(f"SELECT COUNT(*) FROM projects p WHERE {where_clause}"),
        params
    ).scalar() or 0

    # Get projects
    result = db.execute(
        text(f"""
            SELECT
                p.id, p.organization_id, p.workspace_id, p.name, p.slug,
                p.description, p.project_code, p.status, p.visibility,
                p.project_owner_id, p.created_by_id, p.total_boms,
                p.total_components, p.start_date, p.end_date,
                p.last_activity_at, p.tags, p.metadata,
                p.created_at, p.updated_at
            FROM projects p
            WHERE {where_clause}
            ORDER BY p.created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params
    )

    items = []
    for row in result.fetchall():
        items.append(ProjectResponse(
            id=str(row.id),
            organization_id=str(row.organization_id),
            workspace_id=str(row.workspace_id),
            name=row.name,
            slug=row.slug,
            description=row.description,
            project_code=row.project_code,
            status=row.status,
            visibility=row.visibility,
            project_owner_id=str(row.project_owner_id) if row.project_owner_id else None,
            created_by_id=str(row.created_by_id) if row.created_by_id else None,
            total_boms=row.total_boms or 0,
            total_components=row.total_components or 0,
            start_date=row.start_date.isoformat() if row.start_date else None,
            end_date=row.end_date.isoformat() if row.end_date else None,
            last_activity_at=row.last_activity_at.isoformat() if row.last_activity_at else None,
            tags=row.tags or [],
            metadata=row.metadata or {},
            created_at=row.created_at.isoformat() if row.created_at else None,
            updated_at=row.updated_at.isoformat() if row.updated_at else None
        ))

    return ProjectListResponse(items=items, total=total)


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: CreateProjectRequest,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user)
):
    """
    Create a new project in a workspace.

    Requires user to be a member of the workspace.
    """
    logger.info(
        f"[PROJECT] Creating project: name={data.name}, "
        f"workspace={data.workspace_id}, user={user.id}"
    )

    # Verify workspace exists and user is a MEMBER of the workspace
    # Note: user.id is the Keycloak user ID (sub claim), not the database user ID
    workspace = db.execute(
        text("""
            SELECT w.id, w.organization_id, wm.role, u.id as db_user_id
            FROM workspaces w
            JOIN workspace_members wm ON wm.workspace_id = w.id
            JOIN users u ON u.id = wm.user_id
            WHERE w.id = CAST(:workspace_id AS UUID)
            AND (u.keycloak_user_id = :keycloak_user_id
                 OR u.auth0_user_id = :keycloak_user_id
                 OR CAST(u.id AS TEXT) = :keycloak_user_id)
        """),
        {"workspace_id": data.workspace_id, "keycloak_user_id": user.id}
    ).fetchone()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace not found or you are not a member of this workspace"
        )

    organization_id = str(workspace.organization_id)
    db_user_id = str(workspace.db_user_id)

    # Generate slug if not provided
    if data.slug:
        slug = data.slug
        # Check uniqueness within workspace
        existing = db.execute(
            text("""
                SELECT id FROM projects
                WHERE workspace_id = CAST(:workspace_id AS UUID)
                AND slug = :slug
                AND status != 'archived'
            """),
            {"workspace_id": data.workspace_id, "slug": slug}
        ).fetchone()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This slug is already used in this workspace"
            )
    else:
        # Auto-generate slug from name
        import secrets
        base_slug = data.name.lower()
        base_slug = ''.join(c if c.isalnum() else '-' for c in base_slug)
        base_slug = '-'.join(filter(None, base_slug.split('-')))[:50]
        slug = f"{base_slug}-{secrets.token_hex(3)}"

    # Serialize metadata to JSON string for PostgreSQL JSONB column
    # Tags is a text[] array, so we format as PostgreSQL array literal
    metadata_json = json.dumps(data.metadata) if data.metadata else None
    # Format tags as PostgreSQL array literal: {"tag1","tag2"}
    tags_array = '{' + ','.join(f'"{t}"' for t in data.tags) + '}' if data.tags else None

    # Create project
    result = db.execute(
        text("""
            INSERT INTO projects (
                organization_id, workspace_id, name, slug, description,
                project_code, status, visibility, project_owner_id,
                created_by_id, start_date, end_date, tags, metadata
            )
            VALUES (
                CAST(:org_id AS UUID), CAST(:workspace_id AS UUID), :name, :slug,
                :description, :project_code, :status, :visibility,
                CAST(:project_owner_id AS UUID), CAST(:created_by_id AS UUID),
                CAST(:start_date AS DATE), CAST(:end_date AS DATE),
                CAST(:tags AS TEXT[]), CAST(:metadata AS JSONB)
            )
            RETURNING
                id, organization_id, workspace_id, name, slug, description,
                project_code, status, visibility, project_owner_id,
                created_by_id, total_boms, total_components, start_date,
                end_date, last_activity_at, tags, metadata, created_at, updated_at
        """),
        {
            "org_id": organization_id,
            "workspace_id": data.workspace_id,
            "name": data.name,
            "slug": slug,
            "description": data.description,
            "project_code": data.project_code,
            "status": data.status,
            "visibility": data.visibility,
            "project_owner_id": data.project_owner_id,
            "created_by_id": db_user_id,  # Use database user ID, not Keycloak ID
            "start_date": data.start_date,
            "end_date": data.end_date,
            "tags": tags_array,
            "metadata": metadata_json
        }
    ).fetchone()

    db.commit()
    logger.info(f"[PROJECT] Project created: id={result.id}, slug={slug}")

    return ProjectResponse(
        id=str(result.id),
        organization_id=str(result.organization_id),
        workspace_id=str(result.workspace_id),
        name=result.name,
        slug=result.slug,
        description=result.description,
        project_code=result.project_code,
        status=result.status,
        visibility=result.visibility,
        project_owner_id=str(result.project_owner_id) if result.project_owner_id else None,
        created_by_id=str(result.created_by_id) if result.created_by_id else None,
        total_boms=result.total_boms or 0,
        total_components=result.total_components or 0,
        start_date=result.start_date.isoformat() if result.start_date else None,
        end_date=result.end_date.isoformat() if result.end_date else None,
        last_activity_at=result.last_activity_at.isoformat() if result.last_activity_at else None,
        tags=result.tags or [],
        metadata=result.metadata or {},
        created_at=result.created_at.isoformat() if result.created_at else None,
        updated_at=result.updated_at.isoformat() if result.updated_at else None
    )


@router.get("/{project_id}", response_model=ProjectResponse)
@require_project(enforce=True, log_access=True)
async def get_project(
    project_id: str,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user)
):
    """
    Get project details with automatic scope validation.

    **Phase 3: CNS Projects Alignment**

    Authorization:
        - Automatic validation: project → workspace → organization
        - Users can only access projects in their organization
        - Staff users can bypass scope validation

    Security:
        - Server derives workspace_id and organization_id from validated FK chain
        - Cross-tenant access automatically denied
        - Comprehensive audit logging
    """
    # Extract validated scope from request state (set by @require_project decorator)
    scope = request.state.validated_scope
    workspace_id = scope["workspace_id"]

    logger.info(
        f"[PROJECT] Getting project {project_id} "
        f"(workspace={workspace_id}, user={user.id})"
    )

    # Get project (already validated by decorator)
    project = get_project_or_404(db, project_id)

    return ProjectResponse(
        id=str(project.id),
        organization_id=str(project.organization_id),
        workspace_id=str(project.workspace_id),
        name=project.name,
        slug=project.slug,
        description=project.description,
        project_code=project.project_code,
        status=project.status,
        visibility=project.visibility,
        project_owner_id=str(project.project_owner_id) if project.project_owner_id else None,
        created_by_id=str(project.created_by_id) if project.created_by_id else None,
        total_boms=project.total_boms or 0,
        total_components=project.total_components or 0,
        start_date=project.start_date.isoformat() if project.start_date else None,
        end_date=project.end_date.isoformat() if project.end_date else None,
        last_activity_at=project.last_activity_at.isoformat() if project.last_activity_at else None,
        tags=project.tags or [],
        metadata=project.metadata or {},
        created_at=project.created_at.isoformat() if project.created_at else None,
        updated_at=project.updated_at.isoformat() if project.updated_at else None
    )


@router.patch("/{project_id}", response_model=ProjectResponse)
@require_project(enforce=True, log_access=True)
async def update_project(
    project_id: str,
    data: UpdateProjectRequest,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user)
):
    """
    Update project details with automatic scope validation.

    **Phase 3: CNS Projects Alignment**

    Authorization:
        - Automatic validation: project → workspace → organization
        - Users can only update projects in their organization
        - Staff users can bypass scope validation

    Security:
        - Server derives workspace_id and organization_id from validated FK chain
        - Cross-tenant access automatically denied
        - Comprehensive audit logging
    """
    # Extract validated scope from request state (set by @require_project decorator)
    scope = request.state.validated_scope
    workspace_id = scope["workspace_id"]

    logger.info(
        f"[PROJECT] Updating project {project_id} "
        f"(workspace={workspace_id}, user={user.id})"
    )

    # Verify project exists (already validated by decorator)
    project = get_project_or_404(db, project_id)

    # Build update statement
    updates = []
    params: Dict[str, Any] = {"project_id": project_id}

    if data.name is not None:
        updates.append("name = :name")
        params["name"] = data.name

    if data.description is not None:
        updates.append("description = :description")
        params["description"] = data.description

    if data.project_code is not None:
        updates.append("project_code = :project_code")
        params["project_code"] = data.project_code

    if data.status is not None:
        updates.append("status = :status")
        params["status"] = data.status

    if data.visibility is not None:
        updates.append("visibility = :visibility")
        params["visibility"] = data.visibility

    if data.project_owner_id is not None:
        updates.append("project_owner_id = CAST(:project_owner_id AS UUID)")
        params["project_owner_id"] = data.project_owner_id

    if data.start_date is not None:
        updates.append("start_date = CAST(:start_date AS DATE)")
        params["start_date"] = data.start_date

    if data.end_date is not None:
        updates.append("end_date = CAST(:end_date AS DATE)")
        params["end_date"] = data.end_date

    if data.tags is not None:
        # Tags is a text[] array, format as PostgreSQL array literal
        updates.append("tags = CAST(:tags AS TEXT[])")
        params["tags"] = '{' + ','.join(f'"{t}"' for t in data.tags) + '}' if data.tags else None

    if data.metadata is not None:
        # Metadata is JSONB
        updates.append("metadata = CAST(:metadata AS JSONB)")
        params["metadata"] = json.dumps(data.metadata)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    # Always update timestamp
    updates.append("updated_at = NOW()")

    # Execute update
    result = db.execute(
        text(f"""
            UPDATE projects
            SET {', '.join(updates)}
            WHERE id = CAST(:project_id AS UUID)
            RETURNING
                id, organization_id, workspace_id, name, slug, description,
                project_code, status, visibility, project_owner_id,
                created_by_id, total_boms, total_components, start_date,
                end_date, last_activity_at, tags, metadata, created_at, updated_at
        """),
        params
    ).fetchone()

    db.commit()
    logger.info(f"[PROJECT] Project updated: id={project_id}")

    return ProjectResponse(
        id=str(result.id),
        organization_id=str(result.organization_id),
        workspace_id=str(result.workspace_id),
        name=result.name,
        slug=result.slug,
        description=result.description,
        project_code=result.project_code,
        status=result.status,
        visibility=result.visibility,
        project_owner_id=str(result.project_owner_id) if result.project_owner_id else None,
        created_by_id=str(result.created_by_id) if result.created_by_id else None,
        total_boms=result.total_boms or 0,
        total_components=result.total_components or 0,
        start_date=result.start_date.isoformat() if result.start_date else None,
        end_date=result.end_date.isoformat() if result.end_date else None,
        last_activity_at=result.last_activity_at.isoformat() if result.last_activity_at else None,
        tags=result.tags or [],
        metadata=result.metadata or {},
        created_at=result.created_at.isoformat() if result.created_at else None,
        updated_at=result.updated_at.isoformat() if result.updated_at else None
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_project(enforce=True, log_access=True)
async def delete_project(
    project_id: str,
    request: Request,
    db: Session = Depends(get_supabase_session),
    user: User = Depends(get_current_user),
    force: bool = Query(
        default=False,
        description="Force delete even if project has BOMs (will orphan BOMs)"
    )
):
    """
    Delete a project (soft delete) with automatic scope validation.

    **Phase 3: CNS Projects Alignment**

    By default, prevents deletion if project has BOMs.
    Use force=true to allow deletion (BOMs will be orphaned).

    Authorization:
        - Automatic validation: project → workspace → organization
        - Users can only delete projects in their organization
        - Staff users can bypass scope validation

    Security:
        - Server derives workspace_id and organization_id from validated FK chain
        - Cross-tenant access automatically denied
        - Comprehensive audit logging
    """
    # Extract validated scope from request state (set by @require_project decorator)
    scope = request.state.validated_scope
    workspace_id = scope["workspace_id"]

    logger.info(
        f"[PROJECT] Deleting project {project_id} "
        f"(workspace={workspace_id}, user={user.id}, force={force})"
    )

    # Verify project exists (already validated by decorator)
    project = get_project_or_404(db, project_id)

    # Check for dependent BOMs
    bom_count = check_dependent_boms(db, project_id)

    if bom_count > 0 and not force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot delete project: {bom_count} BOMs are associated with this project. "
                f"Use force=true to delete anyway (BOMs will be orphaned)."
            )
        )

    # Soft delete project (use 'archived' status per CHECK constraint)
    db.execute(
        text("""
            UPDATE projects
            SET status = 'archived', updated_at = NOW()
            WHERE id = CAST(:project_id AS UUID)
        """),
        {"project_id": project_id}
    )

    db.commit()

    if bom_count > 0:
        logger.warning(
            f"[PROJECT] Project deleted with {bom_count} BOMs orphaned: "
            f"id={project_id}"
        )
    else:
        logger.info(f"[PROJECT] Project deleted: id={project_id}")
