"""
Workspace Management API

Workspace support endpoints within organizations:
- GET /api/workspaces - List workspaces user belongs to (in current org)
- POST /api/workspaces - Create new workspace
- GET /api/workspaces/{workspace_id} - Get workspace details
- PUT /api/workspaces/{workspace_id} - Update workspace
- DELETE /api/workspaces/{workspace_id} - Delete workspace
- GET /api/workspaces/{workspace_id}/members - List workspace members
- POST /api/workspaces/{workspace_id}/members - Add member to workspace
- PUT /api/workspaces/{workspace_id}/members/{user_id} - Update member role
- DELETE /api/workspaces/{workspace_id}/members/{user_id} - Remove member
- GET /api/workspaces/{workspace_id}/invitations - List pending invitations
- POST /api/workspaces/{workspace_id}/invitations - Create invitation
- DELETE /api/invitations/{invite_id} - Revoke invitation
- POST /api/invitations/{token}/accept - Accept invitation
"""

import json
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy import text

from ..auth.dependencies import (
    User,
    OrgContext,
    get_current_user,
    get_org_context,
    require_admin,
    get_supabase_session,
)

# Novu client for sending invitation emails
try:
    from shared.notification.client import get_novu_client
    NOVU_AVAILABLE = True
except ImportError:
    NOVU_AVAILABLE = False
    get_novu_client = None

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


# ============================================================================
# Pydantic Models
# ============================================================================

class WorkspaceResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    slug: str
    description: Optional[str] = None
    is_default: bool = False
    settings: dict = {}
    created_at: str
    updated_at: str
    role: Optional[str] = None  # Current user's role in this workspace


class CreateWorkspaceRequest(BaseModel):
    organization_id: str
    name: str = Field(..., min_length=1, max_length=100)
    slug: Optional[str] = Field(None, max_length=50, pattern=r'^[a-z0-9-]+$')
    description: Optional[str] = Field(None, max_length=500)


class UpdateWorkspaceRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    settings: Optional[dict] = None


class WorkspaceMemberResponse(BaseModel):
    id: str
    user_id: str
    workspace_id: str
    role: str
    created_at: str
    user: Optional[dict] = None  # User details if joined


class AddMemberRequest(BaseModel):
    user_id: str
    role: str = Field(default="viewer", pattern=r'^(admin|engineer|analyst|viewer)$')


class UpdateMemberRoleRequest(BaseModel):
    role: str = Field(..., pattern=r'^(admin|engineer|analyst|viewer)$')


class WorkspaceInvitationResponse(BaseModel):
    id: str
    workspace_id: str
    email: str
    role: str
    token: str
    invited_by: Optional[str] = None
    created_at: str
    expires_at: str
    accepted_at: Optional[str] = None
    revoked_at: Optional[str] = None


class CreateInvitationRequest(BaseModel):
    email: EmailStr
    role: str = Field(default="viewer", pattern=r'^(admin|engineer|analyst|viewer)$')
    expires_days: int = Field(default=7, ge=1, le=30)


class WorkspaceListResponse(BaseModel):
    items: List[WorkspaceResponse]
    total: int


class MemberListResponse(BaseModel):
    items: List[WorkspaceMemberResponse]
    total: int


class InvitationListResponse(BaseModel):
    items: List[WorkspaceInvitationResponse]
    total: int


# ============================================================================
# Helper Functions
# ============================================================================

def get_workspace_or_404(session, workspace_id: str, user_id: str) -> tuple:
    """
    Get workspace and verify user is a member.
    Returns (workspace_row, membership_row) or raises 404/403.
    """
    # Get workspace
    workspace = session.execute(
        text("""
            SELECT w.*, wm.role as user_role
            FROM workspaces w
            LEFT JOIN workspace_memberships wm
                ON wm.workspace_id = w.id
                AND wm.user_id = CAST(:user_id AS UUID)
            WHERE w.id = CAST(:workspace_id AS UUID)
            AND w.deleted_at IS NULL
        """),
        {"workspace_id": workspace_id, "user_id": user_id}
    ).fetchone()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    return workspace


def require_workspace_admin(workspace, context_role: str = None):
    """Verify user is admin of the workspace."""
    role = context_role or (workspace.user_role if hasattr(workspace, 'user_role') else None)
    if role != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace admins can perform this action"
        )


def require_workspace_member(workspace, context_role: str = None):
    """Verify user is a member of the workspace."""
    role = context_role or (workspace.user_role if hasattr(workspace, 'user_role') else None)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this workspace"
        )


# ============================================================================
# Workspace CRUD Endpoints
# ============================================================================

@router.get("", response_model=WorkspaceListResponse)
async def list_workspaces(
    organization_id: str = Query(..., description="Organization ID to list workspaces for"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user)
):
    """
    List all workspaces in an organization that the current user has access to.
    """
    with get_supabase_session() as session:
        # Verify user is org member
        org_member = session.execute(
            text("""
                SELECT role FROM organization_memberships
                WHERE organization_id = CAST(:org_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"org_id": organization_id, "user_id": user.id}
        ).fetchone()

        if not org_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this organization"
            )

        # Get total count of workspaces user can access
        total = session.execute(
            text("""
                SELECT COUNT(DISTINCT w.id)
                FROM workspaces w
                JOIN workspace_memberships wm ON wm.workspace_id = w.id
                WHERE w.organization_id = CAST(:org_id AS UUID)
                AND wm.user_id = CAST(:user_id AS UUID)
                AND w.deleted_at IS NULL
            """),
            {"org_id": organization_id, "user_id": user.id}
        ).scalar() or 0

        # Get workspaces with user's role
        result = session.execute(
            text("""
                SELECT
                    w.id, w.organization_id, w.name, w.slug, w.description,
                    w.is_default, w.settings, w.created_at, w.updated_at,
                    wm.role
                FROM workspaces w
                JOIN workspace_memberships wm ON wm.workspace_id = w.id
                WHERE w.organization_id = CAST(:org_id AS UUID)
                AND wm.user_id = CAST(:user_id AS UUID)
                AND w.deleted_at IS NULL
                ORDER BY w.is_default DESC, w.name ASC
                LIMIT :limit OFFSET :offset
            """),
            {"org_id": organization_id, "user_id": user.id, "limit": limit, "offset": offset}
        )

        items = [
            WorkspaceResponse(
                id=str(row.id),
                organization_id=str(row.organization_id),
                name=row.name,
                slug=row.slug,
                description=row.description,
                is_default=row.is_default or False,
                settings=row.settings or {},
                created_at=row.created_at.isoformat() if row.created_at else None,
                updated_at=row.updated_at.isoformat() if row.updated_at else None,
                role=row.role
            )
            for row in result.fetchall()
        ]

        return WorkspaceListResponse(items=items, total=total)


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    data: CreateWorkspaceRequest,
    user: User = Depends(get_current_user)
):
    """
    Create a new workspace in an organization.

    Only org admins/owners can create workspaces.
    The creator becomes the workspace admin.
    """
    logger.info(f"[Workspaces] Creating workspace: name={data.name}, org={data.organization_id}, user={user.email}")

    with get_supabase_session() as session:
        # Verify user is org admin/owner
        org_member = session.execute(
            text("""
                SELECT role FROM organization_memberships
                WHERE organization_id = CAST(:org_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"org_id": data.organization_id, "user_id": user.id}
        ).fetchone()

        if not org_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this organization"
            )

        if org_member.role not in ('owner', 'admin', 'org_admin', 'billing_admin'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only organization admins can create workspaces"
            )

        # Generate slug if not provided
        if data.slug:
            slug = data.slug
            # Check uniqueness within org
            existing = session.execute(
                text("""
                    SELECT id FROM workspaces
                    WHERE organization_id = CAST(:org_id AS UUID)
                    AND slug = :slug
                    AND deleted_at IS NULL
                """),
                {"org_id": data.organization_id, "slug": slug}
            ).fetchone()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This slug is already used in this organization"
                )
        else:
            # Auto-generate slug
            base_slug = data.name.lower()
            base_slug = ''.join(c if c.isalnum() else '-' for c in base_slug)
            base_slug = '-'.join(filter(None, base_slug.split('-')))[:30]
            slug = f"{base_slug}-{secrets.token_hex(4)}"

        # Create workspace
        ws_result = session.execute(
            text("""
                INSERT INTO workspaces (organization_id, name, slug, description, created_by)
                VALUES (CAST(:org_id AS UUID), :name, :slug, :description, CAST(:user_id AS UUID))
                RETURNING id, organization_id, name, slug, description, is_default, settings, created_at, updated_at
            """),
            {
                "org_id": data.organization_id,
                "name": data.name,
                "slug": slug,
                "description": data.description,
                "user_id": user.id
            }
        ).fetchone()

        workspace_id = str(ws_result.id)

        # Add creator as workspace admin
        session.execute(
            text("""
                INSERT INTO workspace_memberships (workspace_id, user_id, role)
                VALUES (CAST(:ws_id AS UUID), CAST(:user_id AS UUID), 'admin')
            """),
            {"ws_id": workspace_id, "user_id": user.id}
        )

        logger.info(f"[Workspaces] Workspace created: id={workspace_id}, slug={slug}")

        return WorkspaceResponse(
            id=workspace_id,
            organization_id=str(ws_result.organization_id),
            name=ws_result.name,
            slug=ws_result.slug,
            description=ws_result.description,
            is_default=ws_result.is_default or False,
            settings=ws_result.settings or {},
            created_at=ws_result.created_at.isoformat() if ws_result.created_at else None,
            updated_at=ws_result.updated_at.isoformat() if ws_result.updated_at else None,
            role='admin'  # Creator is always admin
        )


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: str,
    user: User = Depends(get_current_user)
):
    """
    Get workspace details.

    Only accessible to workspace members.
    """
    with get_supabase_session() as session:
        workspace = get_workspace_or_404(session, workspace_id, user.id)
        require_workspace_member(workspace)

        return WorkspaceResponse(
            id=str(workspace.id),
            organization_id=str(workspace.organization_id),
            name=workspace.name,
            slug=workspace.slug,
            description=workspace.description,
            is_default=workspace.is_default or False,
            settings=workspace.settings or {},
            created_at=workspace.created_at.isoformat() if workspace.created_at else None,
            updated_at=workspace.updated_at.isoformat() if workspace.updated_at else None,
            role=workspace.user_role
        )


@router.put("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: str,
    data: UpdateWorkspaceRequest,
    user: User = Depends(get_current_user)
):
    """
    Update workspace details.

    Only workspace admins can update.
    """
    with get_supabase_session() as session:
        workspace = get_workspace_or_404(session, workspace_id, user.id)
        require_workspace_admin(workspace)

        updates = []
        params = {"workspace_id": workspace_id}

        if data.name is not None:
            updates.append("name = :name")
            params["name"] = data.name

        if data.description is not None:
            updates.append("description = :description")
            params["description"] = data.description

        if data.settings is not None:
            updates.append("settings = CAST(:settings AS JSONB)")
            params["settings"] = json.dumps(data.settings)

        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        result = session.execute(
            text(f"""
                UPDATE workspaces
                SET {', '.join(updates)}, updated_at = NOW()
                WHERE id = CAST(:workspace_id AS UUID)
                RETURNING id, organization_id, name, slug, description, is_default, settings, created_at, updated_at
            """),
            params
        ).fetchone()

        logger.info(f"[Workspaces] Workspace updated: id={workspace_id}")

        return WorkspaceResponse(
            id=str(result.id),
            organization_id=str(result.organization_id),
            name=result.name,
            slug=result.slug,
            description=result.description,
            is_default=result.is_default or False,
            settings=result.settings or {},
            created_at=result.created_at.isoformat() if result.created_at else None,
            updated_at=result.updated_at.isoformat() if result.updated_at else None,
            role=workspace.user_role
        )


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: str,
    user: User = Depends(get_current_user)
):
    """
    Delete a workspace (soft delete).

    Only workspace admins can delete. Cannot delete the default workspace.
    """
    with get_supabase_session() as session:
        workspace = get_workspace_or_404(session, workspace_id, user.id)
        require_workspace_admin(workspace)

        if workspace.is_default:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the default workspace"
            )

        # Soft delete
        session.execute(
            text("""
                UPDATE workspaces
                SET deleted_at = NOW()
                WHERE id = CAST(:workspace_id AS UUID)
            """),
            {"workspace_id": workspace_id}
        )

        logger.info(f"[Workspaces] Workspace deleted: id={workspace_id}")


# ============================================================================
# Workspace Member Endpoints
# ============================================================================

@router.get("/{workspace_id}/members", response_model=MemberListResponse)
async def list_members(
    workspace_id: str,
    user: User = Depends(get_current_user)
):
    """
    List all members of a workspace.
    """
    with get_supabase_session() as session:
        workspace = get_workspace_or_404(session, workspace_id, user.id)
        require_workspace_member(workspace)

        # Get total count
        total = session.execute(
            text("""
                SELECT COUNT(*) FROM workspace_memberships
                WHERE workspace_id = CAST(:workspace_id AS UUID)
            """),
            {"workspace_id": workspace_id}
        ).scalar() or 0

        # Get members with user details
        result = session.execute(
            text("""
                SELECT
                    wm.id, wm.workspace_id, wm.user_id, wm.role, wm.created_at,
                    u.email, u.full_name
                FROM workspace_memberships wm
                JOIN users u ON u.id = wm.user_id
                WHERE wm.workspace_id = CAST(:workspace_id AS UUID)
                ORDER BY
                    CASE wm.role
                        WHEN 'admin' THEN 1
                        WHEN 'engineer' THEN 2
                        WHEN 'analyst' THEN 3
                        WHEN 'viewer' THEN 4
                        ELSE 5
                    END,
                    wm.created_at
            """),
            {"workspace_id": workspace_id}
        )

        items = [
            WorkspaceMemberResponse(
                id=str(row.id),
                workspace_id=str(row.workspace_id),
                user_id=str(row.user_id),
                role=row.role,
                created_at=row.created_at.isoformat() if row.created_at else None,
                user={
                    "id": str(row.user_id),
                    "email": row.email,
                    "full_name": row.full_name
                }
            )
            for row in result.fetchall()
        ]

        return MemberListResponse(items=items, total=total)


@router.post("/{workspace_id}/members", response_model=WorkspaceMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_member(
    workspace_id: str,
    data: AddMemberRequest,
    user: User = Depends(get_current_user)
):
    """
    Add a member to a workspace.

    Only workspace admins can add members.
    The user must be a member of the organization.
    """
    with get_supabase_session() as session:
        workspace = get_workspace_or_404(session, workspace_id, user.id)
        require_workspace_admin(workspace)

        # Verify target user is org member
        org_member = session.execute(
            text("""
                SELECT 1 FROM organization_memberships
                WHERE organization_id = CAST(:org_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"org_id": str(workspace.organization_id), "user_id": data.user_id}
        ).fetchone()

        if not org_member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not a member of this organization"
            )

        # Check if already a member
        existing = session.execute(
            text("""
                SELECT 1 FROM workspace_memberships
                WHERE workspace_id = CAST(:workspace_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"workspace_id": workspace_id, "user_id": data.user_id}
        ).fetchone()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member of this workspace"
            )

        # Add member
        result = session.execute(
            text("""
                INSERT INTO workspace_memberships (workspace_id, user_id, role)
                VALUES (CAST(:workspace_id AS UUID), CAST(:user_id AS UUID), :role)
                RETURNING id, workspace_id, user_id, role, created_at
            """),
            {"workspace_id": workspace_id, "user_id": data.user_id, "role": data.role}
        ).fetchone()

        # Get user details
        user_details = session.execute(
            text("SELECT email, full_name FROM users WHERE id = CAST(:user_id AS UUID)"),
            {"user_id": data.user_id}
        ).fetchone()

        logger.info(f"[Workspaces] Member added: workspace={workspace_id}, user={data.user_id}")

        return WorkspaceMemberResponse(
            id=str(result.id),
            workspace_id=str(result.workspace_id),
            user_id=str(result.user_id),
            role=result.role,
            created_at=result.created_at.isoformat() if result.created_at else None,
            user={
                "id": data.user_id,
                "email": user_details.email if user_details else None,
                "full_name": user_details.full_name if user_details else None
            }
        )


@router.put("/{workspace_id}/members/{member_user_id}", response_model=WorkspaceMemberResponse)
async def update_member_role(
    workspace_id: str,
    member_user_id: str,
    data: UpdateMemberRoleRequest,
    user: User = Depends(get_current_user)
):
    """
    Update a member's role in a workspace.

    Only workspace admins can update roles.
    Cannot change your own role.
    """
    if member_user_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role"
        )

    with get_supabase_session() as session:
        workspace = get_workspace_or_404(session, workspace_id, user.id)
        require_workspace_admin(workspace)

        # Get membership
        membership = session.execute(
            text("""
                SELECT wm.id, wm.workspace_id, wm.user_id, wm.role, wm.created_at,
                       u.email, u.full_name
                FROM workspace_memberships wm
                JOIN users u ON u.id = wm.user_id
                WHERE wm.workspace_id = CAST(:workspace_id AS UUID)
                AND wm.user_id = CAST(:user_id AS UUID)
            """),
            {"workspace_id": workspace_id, "user_id": member_user_id}
        ).fetchone()

        if not membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found"
            )

        # Update role
        session.execute(
            text("""
                UPDATE workspace_memberships
                SET role = :role, updated_at = NOW()
                WHERE workspace_id = CAST(:workspace_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"workspace_id": workspace_id, "user_id": member_user_id, "role": data.role}
        )

        logger.info(f"[Workspaces] Member role updated: workspace={workspace_id}, user={member_user_id}, role={data.role}")

        return WorkspaceMemberResponse(
            id=str(membership.id),
            workspace_id=str(membership.workspace_id),
            user_id=str(membership.user_id),
            role=data.role,
            created_at=membership.created_at.isoformat() if membership.created_at else None,
            user={
                "id": member_user_id,
                "email": membership.email,
                "full_name": membership.full_name
            }
        )


@router.delete("/{workspace_id}/members/{member_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    workspace_id: str,
    member_user_id: str,
    user: User = Depends(get_current_user)
):
    """
    Remove a member from a workspace.

    Only workspace admins can remove members.
    Cannot remove yourself. Cannot remove the last admin.
    """
    if member_user_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove yourself. Use leave endpoint instead."
        )

    with get_supabase_session() as session:
        workspace = get_workspace_or_404(session, workspace_id, user.id)
        require_workspace_admin(workspace)

        # Get target membership
        target = session.execute(
            text("""
                SELECT role FROM workspace_memberships
                WHERE workspace_id = CAST(:workspace_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"workspace_id": workspace_id, "user_id": member_user_id}
        ).fetchone()

        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found"
            )

        # If removing an admin, ensure there's at least one other admin
        if target.role == 'admin':
            admin_count = session.execute(
                text("""
                    SELECT COUNT(*) FROM workspace_memberships
                    WHERE workspace_id = CAST(:workspace_id AS UUID)
                    AND role = 'admin'
                """),
                {"workspace_id": workspace_id}
            ).scalar() or 0

            if admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove the last admin"
                )

        # Remove membership
        session.execute(
            text("""
                DELETE FROM workspace_memberships
                WHERE workspace_id = CAST(:workspace_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"workspace_id": workspace_id, "user_id": member_user_id}
        )

        logger.info(f"[Workspaces] Member removed: workspace={workspace_id}, user={member_user_id}")


@router.post("/{workspace_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_workspace(
    workspace_id: str,
    user: User = Depends(get_current_user)
):
    """
    Leave a workspace (remove yourself).

    Cannot leave if you're the only admin - must transfer admin first.
    Cannot leave the default workspace if it's your only workspace in the org.
    """
    with get_supabase_session() as session:
        workspace = get_workspace_or_404(session, workspace_id, user.id)
        require_workspace_member(workspace)

        # Check if user is admin
        if workspace.user_role == 'admin':
            # Count other admins
            admin_count = session.execute(
                text("""
                    SELECT COUNT(*) FROM workspace_memberships
                    WHERE workspace_id = CAST(:workspace_id AS UUID)
                    AND role = 'admin'
                """),
                {"workspace_id": workspace_id}
            ).scalar() or 0

            if admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot leave: you are the only admin. Transfer admin role first."
                )

        # Remove membership
        session.execute(
            text("""
                DELETE FROM workspace_memberships
                WHERE workspace_id = CAST(:workspace_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"workspace_id": workspace_id, "user_id": user.id}
        )

        # Clear user's last workspace if it was this one
        session.execute(
            text("""
                UPDATE user_preferences
                SET last_workspace_id = NULL
                WHERE user_id = CAST(:user_id AS UUID)
                AND last_workspace_id = CAST(:workspace_id AS UUID)
            """),
            {"user_id": user.id, "workspace_id": workspace_id}
        )

        logger.info(f"[Workspaces] User left workspace: workspace={workspace_id}, user={user.id}")


# ============================================================================
# Novu Notification Helpers
# ============================================================================

async def _send_invitation_notification(
    session,
    workspace,
    inviter: User,
    invitee_email: str,
    role: str,
    token: str,
    expires_at: datetime
):
    """
    Send workspace invitation email via Novu.

    Uses the WORKSPACE_INVITATION workflow to send an email to the invitee.
    This is a best-effort operation - failures are logged but don't block the invitation.
    """
    if not NOVU_AVAILABLE:
        logger.debug("[Workspaces] Novu not available, skipping invitation email")
        return

    try:
        novu_client = get_novu_client()
        if not novu_client:
            logger.debug("[Workspaces] Novu client not configured, skipping invitation email")
            return

        # Get organization name
        org_name = session.execute(
            text("SELECT name FROM organizations WHERE id = CAST(:org_id AS UUID)"),
            {"org_id": str(workspace.organization_id)}
        ).scalar() or "Organization"

        # Build invite URL
        portal_url = os.getenv("CUSTOMER_PORTAL_URL", "http://localhost:27510")
        invite_url = f"{portal_url}/invite/{token}"

        # Use invitee email as subscriber ID for email-only workflows
        # Novu will create a subscriber if one doesn't exist
        subscriber_id = invitee_email

        payload = {
            "inviter_name": inviter.full_name or inviter.email,
            "inviter_email": inviter.email,
            "workspace_name": workspace.name,
            "organization_name": org_name,
            "role": role,
            "invite_url": invite_url,
            "expires_at": expires_at.isoformat(),
        }

        # Trigger Novu workflow
        success = await novu_client.trigger(
            workflow_id="workspace-invitation",
            subscriber_id=subscriber_id,
            payload=payload,
            overrides={
                "email": {
                    "to": invitee_email
                }
            }
        )

        if success:
            logger.info(f"[Workspaces] Invitation email sent to {invitee_email}")
        else:
            logger.warning(f"[Workspaces] Failed to send invitation email to {invitee_email}")

    except Exception as e:
        # Log but don't fail the invitation - email is best-effort
        logger.error(f"[Workspaces] Error sending invitation email: {e}")


async def _send_member_joined_notification(
    session,
    workspace_id: str,
    workspace_name: str,
    organization_id: str,
    new_member: User,
    role: str
):
    """
    Send notification to workspace admins when a new member joins.

    Uses the WORKSPACE_MEMBER_JOINED workflow to send in-app notifications.
    """
    if not NOVU_AVAILABLE:
        return

    try:
        novu_client = get_novu_client()
        if not novu_client:
            return

        # Get organization name
        org_name = session.execute(
            text("SELECT name FROM organizations WHERE id = CAST(:org_id AS UUID)"),
            {"org_id": organization_id}
        ).scalar() or "Organization"

        # Get workspace admins to notify
        admins = session.execute(
            text("""
                SELECT u.id, u.email
                FROM workspace_memberships wm
                JOIN users u ON u.id = wm.user_id
                WHERE wm.workspace_id = CAST(:workspace_id AS UUID)
                AND wm.role = 'admin'
                AND u.id != CAST(:new_member_id AS UUID)
            """),
            {"workspace_id": workspace_id, "new_member_id": new_member.id}
        ).fetchall()

        payload = {
            "new_member_name": new_member.full_name or new_member.email,
            "new_member_email": new_member.email,
            "workspace_name": workspace_name,
            "organization_name": org_name,
            "role": role,
        }

        # Notify each admin
        for admin in admins:
            await novu_client.trigger(
                workflow_id="workspace-member-joined",
                subscriber_id=str(admin.id),
                payload=payload
            )

        if admins:
            logger.info(f"[Workspaces] Member joined notifications sent to {len(admins)} admins")

    except Exception as e:
        logger.error(f"[Workspaces] Error sending member joined notifications: {e}")


# ============================================================================
# Workspace Invitation Endpoints
# ============================================================================

@router.get("/{workspace_id}/invitations", response_model=InvitationListResponse)
async def list_invitations(
    workspace_id: str,
    user: User = Depends(get_current_user)
):
    """
    List pending invitations for a workspace.

    Only workspace admins can view invitations.
    """
    with get_supabase_session() as session:
        workspace = get_workspace_or_404(session, workspace_id, user.id)
        require_workspace_admin(workspace)

        # Get total count of pending invitations
        total = session.execute(
            text("""
                SELECT COUNT(*) FROM workspace_invitations
                WHERE workspace_id = CAST(:workspace_id AS UUID)
                AND accepted_at IS NULL
                AND revoked_at IS NULL
                AND expires_at > NOW()
            """),
            {"workspace_id": workspace_id}
        ).scalar() or 0

        # Get invitations
        result = session.execute(
            text("""
                SELECT
                    wi.id, wi.workspace_id, wi.email, wi.role, wi.token,
                    wi.invited_by, wi.created_at, wi.expires_at,
                    wi.accepted_at, wi.revoked_at
                FROM workspace_invitations wi
                WHERE wi.workspace_id = CAST(:workspace_id AS UUID)
                AND wi.accepted_at IS NULL
                AND wi.revoked_at IS NULL
                AND wi.expires_at > NOW()
                ORDER BY wi.created_at DESC
            """),
            {"workspace_id": workspace_id}
        )

        items = [
            WorkspaceInvitationResponse(
                id=str(row.id),
                workspace_id=str(row.workspace_id),
                email=row.email,
                role=row.role,
                token=row.token,
                invited_by=str(row.invited_by) if row.invited_by else None,
                created_at=row.created_at.isoformat() if row.created_at else None,
                expires_at=row.expires_at.isoformat() if row.expires_at else None,
                accepted_at=row.accepted_at.isoformat() if row.accepted_at else None,
                revoked_at=row.revoked_at.isoformat() if row.revoked_at else None
            )
            for row in result.fetchall()
        ]

        return InvitationListResponse(items=items, total=total)


@router.post("/{workspace_id}/invitations", response_model=WorkspaceInvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    workspace_id: str,
    data: CreateInvitationRequest,
    user: User = Depends(get_current_user)
):
    """
    Create an invitation to join a workspace.

    Only workspace admins can create invitations.
    """
    with get_supabase_session() as session:
        workspace = get_workspace_or_404(session, workspace_id, user.id)
        require_workspace_admin(workspace)

        # Check if user already a member by email
        existing_member = session.execute(
            text("""
                SELECT 1 FROM workspace_memberships wm
                JOIN users u ON u.id = wm.user_id
                WHERE wm.workspace_id = CAST(:workspace_id AS UUID)
                AND u.email = :email
            """),
            {"workspace_id": workspace_id, "email": data.email}
        ).fetchone()

        if existing_member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member of this workspace"
            )

        # Generate token and expiry
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=data.expires_days)

        # Create or update invitation
        result = session.execute(
            text("""
                INSERT INTO workspace_invitations
                    (workspace_id, email, role, token, invited_by, expires_at)
                VALUES
                    (CAST(:workspace_id AS UUID), :email, :role, :token, CAST(:user_id AS UUID), :expires_at)
                ON CONFLICT (workspace_id, email) WHERE accepted_at IS NULL AND revoked_at IS NULL
                DO UPDATE SET
                    role = :role,
                    token = :token,
                    invited_by = CAST(:user_id AS UUID),
                    expires_at = :expires_at,
                    created_at = NOW()
                RETURNING id, workspace_id, email, role, token, invited_by, created_at, expires_at, accepted_at, revoked_at
            """),
            {
                "workspace_id": workspace_id,
                "email": data.email,
                "role": data.role,
                "token": token,
                "user_id": user.id,
                "expires_at": expires_at
            }
        ).fetchone()

        # Send invitation email via Novu
        await _send_invitation_notification(
            session=session,
            workspace=workspace,
            inviter=user,
            invitee_email=data.email,
            role=data.role,
            token=token,
            expires_at=expires_at
        )

        logger.info(f"[Workspaces] Invitation created: workspace={workspace_id}, email={data.email}")

        return WorkspaceInvitationResponse(
            id=str(result.id),
            workspace_id=str(result.workspace_id),
            email=result.email,
            role=result.role,
            token=result.token,
            invited_by=str(result.invited_by) if result.invited_by else None,
            created_at=result.created_at.isoformat() if result.created_at else None,
            expires_at=result.expires_at.isoformat() if result.expires_at else None,
            accepted_at=result.accepted_at.isoformat() if result.accepted_at else None,
            revoked_at=result.revoked_at.isoformat() if result.revoked_at else None
        )


# Invitation management endpoints (not under workspace prefix)
invitations_router = APIRouter(prefix="/invitations", tags=["workspaces"])


@invitations_router.delete("/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(
    invite_id: str,
    user: User = Depends(get_current_user)
):
    """
    Revoke a pending invitation.

    Only workspace admins can revoke invitations.
    """
    with get_supabase_session() as session:
        # Get invitation and verify admin access
        invite = session.execute(
            text("""
                SELECT wi.workspace_id, wm.role as user_role
                FROM workspace_invitations wi
                LEFT JOIN workspace_memberships wm
                    ON wm.workspace_id = wi.workspace_id
                    AND wm.user_id = CAST(:user_id AS UUID)
                WHERE wi.id = CAST(:invite_id AS UUID)
                AND wi.accepted_at IS NULL
                AND wi.revoked_at IS NULL
            """),
            {"invite_id": invite_id, "user_id": user.id}
        ).fetchone()

        if not invite:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found or already accepted/revoked"
            )

        if invite.user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only workspace admins can revoke invitations"
            )

        # Revoke invitation
        session.execute(
            text("""
                UPDATE workspace_invitations
                SET revoked_at = NOW()
                WHERE id = CAST(:invite_id AS UUID)
            """),
            {"invite_id": invite_id}
        )

        logger.info(f"[Workspaces] Invitation revoked: id={invite_id}")


@invitations_router.post("/{token}/accept")
async def accept_invitation(
    token: str,
    user: User = Depends(get_current_user)
):
    """
    Accept a workspace invitation.

    The invitation email must match the user's email.
    User must be a member of the organization.
    """
    with get_supabase_session() as session:
        # Get invitation
        invite = session.execute(
            text("""
                SELECT
                    wi.id, wi.workspace_id, wi.email, wi.role, wi.expires_at,
                    w.name as workspace_name, w.organization_id
                FROM workspace_invitations wi
                JOIN workspaces w ON w.id = wi.workspace_id
                WHERE wi.token = :token
                AND wi.accepted_at IS NULL
                AND wi.revoked_at IS NULL
                AND wi.expires_at > NOW()
            """),
            {"token": token}
        ).fetchone()

        if not invite:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found or expired"
            )

        # Verify email matches
        if invite.email.lower() != user.email.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This invitation was sent to a different email address"
            )

        # Verify user is org member
        org_member = session.execute(
            text("""
                SELECT 1 FROM organization_memberships
                WHERE organization_id = CAST(:org_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"org_id": str(invite.organization_id), "user_id": user.id}
        ).fetchone()

        if not org_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be a member of the organization to join this workspace"
            )

        # Check if already a member
        existing = session.execute(
            text("""
                SELECT 1 FROM workspace_memberships
                WHERE workspace_id = CAST(:workspace_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"workspace_id": str(invite.workspace_id), "user_id": user.id}
        ).fetchone()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already a member of this workspace"
            )

        # Add membership
        session.execute(
            text("""
                INSERT INTO workspace_memberships (workspace_id, user_id, role)
                VALUES (CAST(:workspace_id AS UUID), CAST(:user_id AS UUID), :role)
            """),
            {"workspace_id": str(invite.workspace_id), "user_id": user.id, "role": invite.role}
        )

        # Mark invitation as accepted
        session.execute(
            text("""
                UPDATE workspace_invitations
                SET accepted_at = NOW(), accepted_by = CAST(:user_id AS UUID)
                WHERE id = CAST(:invite_id AS UUID)
            """),
            {"invite_id": str(invite.id), "user_id": user.id}
        )

        logger.info(f"[Workspaces] Invitation accepted: workspace={invite.workspace_id}, user={user.email}")

        # Notify workspace admins that a new member joined
        await _send_member_joined_notification(
            session=session,
            workspace_id=str(invite.workspace_id),
            workspace_name=invite.workspace_name,
            organization_id=str(invite.organization_id),
            new_member=user,
            role=invite.role
        )

        return {
            "success": True,
            "workspace": {
                "id": str(invite.workspace_id),
                "name": invite.workspace_name
            },
            "role": invite.role,
            "message": f"You have joined {invite.workspace_name} as {invite.role}"
        }
