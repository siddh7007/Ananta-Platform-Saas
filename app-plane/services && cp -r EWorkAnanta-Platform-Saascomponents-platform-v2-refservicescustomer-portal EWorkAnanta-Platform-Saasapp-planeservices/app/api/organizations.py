"""
Organization Management API

Multi-org support endpoints:
- GET /api/organizations/me - Get all orgs user belongs to (paginated)
- POST /api/organizations - Create new organization
- GET /api/organizations/{org_id} - Get org details
- PATCH /api/organizations/{org_id} - Update org
- DELETE /api/organizations/{org_id} - Delete org (owner only)
- POST /api/organizations/{org_id}/invitations - Invite user
- GET /api/organizations/{org_id}/members - List members (paginated)
- DELETE /api/organizations/{org_id}/members/{user_id} - Remove member
- POST /api/organizations/{org_id}/leave - Leave organization
- POST /api/organizations/{org_id}/transfer-ownership - Transfer ownership to another member
"""

import logging
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
    require_owner,
    get_supabase_session,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organizations", tags=["organizations"])


# ============================================================================
# Pydantic Models
# ============================================================================

class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: Optional[str] = None
    plan_type: str = "free"
    role: str
    joined_at: Optional[str] = None
    is_owner: bool = False


class CreateOrganizationRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: Optional[str] = Field(None, max_length=50, pattern=r'^[a-z0-9-]+$')


class UpdateOrganizationRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)


class InviteMemberRequest(BaseModel):
    email: EmailStr
    # Standard roles: admin, engineer, analyst, viewer (owner only via org creation)
    role: str = Field(default="engineer", pattern=r'^(admin|engineer|analyst|viewer)$')


class InvitationResponse(BaseModel):
    id: str
    email: str
    role: str
    expires_at: str
    invite_url: str


class MemberResponse(BaseModel):
    user_id: str
    email: str
    full_name: Optional[str] = None
    role: str
    joined_at: str


class OrganizationDetailResponse(BaseModel):
    id: str
    name: str
    slug: Optional[str] = None
    plan_type: str
    member_count: int
    created_at: str
    your_role: str


class PaginatedOrganizationsResponse(BaseModel):
    items: List[OrganizationResponse]
    total: int
    limit: int
    offset: int


class PaginatedMembersResponse(BaseModel):
    items: List[MemberResponse]
    total: int
    limit: int
    offset: int


class TransferOwnershipRequest(BaseModel):
    new_owner_user_id: str = Field(..., description="UUID of the user to transfer ownership to")


class UpdateMemberRoleRequest(BaseModel):
    role: str = Field(..., pattern=r'^(admin|engineer|analyst|viewer)$')


class PendingInvitationResponse(BaseModel):
    id: str
    email: str
    role: str
    created_at: str
    expires_at: str
    invited_by_email: Optional[str] = None


class PaginatedInvitationsResponse(BaseModel):
    items: List[PendingInvitationResponse]
    total: int
    limit: int
    offset: int


class UsageMetricsResponse(BaseModel):
    organization_id: str
    bom_count: int
    project_count: int
    member_count: int
    storage_mb: float
    api_calls_30d: int
    pending_invitations: int
    plan_type: str
    limits: dict


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/me", response_model=PaginatedOrganizationsResponse)
async def get_my_organizations(
    user: User = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=100, description="Max items to return"),
    offset: int = Query(default=0, ge=0, description="Number of items to skip")
):
    """
    Get all organizations the current user is a member of (paginated).

    Returns empty list if user hasn't created/joined any org yet.
    """
    with get_supabase_session() as session:
        # Get total count
        total = session.execute(
            text("""
                SELECT COUNT(*)
                FROM organizations o
                JOIN organization_memberships om ON om.organization_id = o.id
                WHERE om.user_id = CAST(:user_id AS UUID)
                AND o.deleted_at IS NULL
            """),
            {"user_id": user.id}
        ).scalar()

        # Get paginated items
        result = session.execute(
            text("""
                SELECT
                    o.id,
                    o.name,
                    o.slug,
                    COALESCE(o.org_type, 'free') as plan_type,
                    om.role,
                    om.created_at as joined_at
                FROM organizations o
                JOIN organization_memberships om ON om.organization_id = o.id
                WHERE om.user_id = CAST(:user_id AS UUID)
                AND o.deleted_at IS NULL
                ORDER BY om.created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {"user_id": user.id, "limit": limit, "offset": offset}
        )

        items = [
            OrganizationResponse(
                id=str(row.id),
                name=row.name,
                slug=row.slug,
                plan_type=row.plan_type,
                role=row.role,
                joined_at=row.joined_at.isoformat() if row.joined_at else None,
                is_owner=row.role == "owner",
            )
            for row in result.fetchall()
        ]

        return PaginatedOrganizationsResponse(
            items=items,
            total=total,
            limit=limit,
            offset=offset
        )


@router.post("/", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    data: CreateOrganizationRequest,
    user: User = Depends(get_current_user)
):
    """
    Create a new organization.

    The current user becomes the owner.
    """
    logger.info(f"[Orgs] Creating organization: name={data.name}, user={user.email}")

    with get_supabase_session() as session:
        # Check how many orgs user already owns (plan limit)
        owner_count = session.execute(
            text("""
                SELECT COUNT(*) FROM organization_memberships
                WHERE user_id = CAST(:user_id AS UUID)
                AND role = 'owner'
            """),
            {"user_id": user.id}
        ).scalar()

        # TODO: Get limit from plan
        max_owned_orgs = 5
        if owner_count >= max_owned_orgs:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"You can only own up to {max_owned_orgs} organizations. Upgrade your plan for more."
            )

        # Generate slug
        if data.slug:
            slug = data.slug
            # Check uniqueness
            existing = session.execute(
                text("SELECT id FROM organizations WHERE slug = :slug"),
                {"slug": slug}
            ).fetchone()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This slug is already taken"
                )
        else:
            # Auto-generate slug
            base_slug = data.name.lower()
            base_slug = ''.join(c if c.isalnum() else '-' for c in base_slug)
            base_slug = '-'.join(filter(None, base_slug.split('-')))[:30]
            slug = f"{base_slug}-{secrets.token_hex(4)}"

        # Create organization
        org_result = session.execute(
            text("""
                INSERT INTO organizations (name, slug, created_by)
                VALUES (:name, :slug, CAST(:user_id AS UUID))
                RETURNING id, name, slug, created_at
            """),
            {"name": data.name, "slug": slug, "user_id": user.id}
        ).fetchone()

        org_id = str(org_result.id)

        # Add user as owner
        session.execute(
            text("""
                INSERT INTO organization_memberships (organization_id, user_id, role)
                VALUES (CAST(:org_id AS UUID), CAST(:user_id AS UUID), 'owner')
            """),
            {"org_id": org_id, "user_id": user.id}
        )

        # Set as user's last active org
        session.execute(
            text("""
                INSERT INTO user_preferences (user_id, last_organization_id)
                VALUES (CAST(:user_id AS UUID), CAST(:org_id AS UUID))
                ON CONFLICT (user_id)
                DO UPDATE SET last_organization_id = CAST(:org_id AS UUID), updated_at = NOW()
            """),
            {"user_id": user.id, "org_id": org_id}
        )

        logger.info(f"[Orgs] Organization created: id={org_id}, slug={slug}")

        return OrganizationResponse(
            id=org_id,
            name=org_result.name,
            slug=org_result.slug,
            plan_type="free",
            role="owner",
            joined_at=org_result.created_at.isoformat() if org_result.created_at else None,
            is_owner=True
        )


@router.get("/{org_id}", response_model=OrganizationDetailResponse)
async def get_organization(
    context: OrgContext = Depends(get_org_context)
):
    """
    Get organization details.

    Only accessible to members.
    """
    with get_supabase_session() as session:
        result = session.execute(
            text("""
                SELECT
                    o.id, o.name, o.slug,
                    COALESCE(o.org_type, 'free') as plan_type,
                    o.created_at,
                    (SELECT COUNT(*) FROM organization_memberships WHERE organization_id = o.id) as member_count
                FROM organizations o
                WHERE o.id = CAST(:org_id AS UUID)
            """),
            {"org_id": context.organization.id}
        ).fetchone()

        return OrganizationDetailResponse(
            id=str(result.id),
            name=result.name,
            slug=result.slug,
            plan_type=result.plan_type,
            member_count=result.member_count,
            created_at=result.created_at.isoformat() if result.created_at else None,
            your_role=context.role
        )


@router.patch("/{org_id}", response_model=OrganizationDetailResponse)
async def update_organization(
    data: UpdateOrganizationRequest,
    context: OrgContext = Depends(require_admin)
):
    """
    Update organization details.

    Only admins and owners can update.
    """
    with get_supabase_session() as session:
        updates = []
        params = {"org_id": context.organization.id}

        if data.name is not None:
            updates.append("name = :name")
            params["name"] = data.name

        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        session.execute(
            text(f"""
                UPDATE organizations
                SET {', '.join(updates)}, updated_at = NOW()
                WHERE id = CAST(:org_id AS UUID)
            """),
            params
        )

        logger.info(f"[Orgs] Organization updated: id={context.organization.id}")

    return await get_organization(context)


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    context: OrgContext = Depends(require_owner)
):
    """
    Delete organization.

    Only the owner can delete. This is a soft delete (sets deleted_at).
    """
    with get_supabase_session() as session:
        # Soft delete
        session.execute(
            text("""
                UPDATE organizations
                SET deleted_at = NOW()
                WHERE id = CAST(:org_id AS UUID)
            """),
            {"org_id": context.organization.id}
        )

        logger.info(f"[Orgs] Organization deleted: id={context.organization.id}")


@router.get("/{org_id}/members", response_model=PaginatedMembersResponse)
async def get_members(
    context: OrgContext = Depends(get_org_context),
    limit: int = Query(default=50, ge=1, le=100, description="Max items to return"),
    offset: int = Query(default=0, ge=0, description="Number of items to skip")
):
    """
    Get all members of an organization (paginated).
    """
    with get_supabase_session() as session:
        # Get total count
        total = session.execute(
            text("""
                SELECT COUNT(*)
                FROM organization_memberships
                WHERE organization_id = CAST(:org_id AS UUID)
            """),
            {"org_id": context.organization.id}
        ).scalar()

        # Get paginated items
        result = session.execute(
            text("""
                SELECT
                    u.id as user_id,
                    u.email,
                    u.full_name,
                    om.role,
                    om.created_at as joined_at
                FROM organization_memberships om
                JOIN users u ON u.id = om.user_id
                WHERE om.organization_id = CAST(:org_id AS UUID)
                ORDER BY
                    CASE om.role
                        WHEN 'owner' THEN 1
                        WHEN 'admin' THEN 2
                        WHEN 'engineer' THEN 3
                        WHEN 'analyst' THEN 4
                        WHEN 'viewer' THEN 5
                        ELSE 6
                    END,
                    om.created_at
                LIMIT :limit OFFSET :offset
            """),
            {"org_id": context.organization.id, "limit": limit, "offset": offset}
        )

        items = [
            MemberResponse(
                user_id=str(row.user_id),
                email=row.email,
                full_name=row.full_name,
                role=row.role,
                joined_at=row.joined_at.isoformat() if row.joined_at else None
            )
            for row in result.fetchall()
        ]

        return PaginatedMembersResponse(
            items=items,
            total=total,
            limit=limit,
            offset=offset
        )


@router.post("/{org_id}/invitations", response_model=InvitationResponse)
async def invite_member(
    data: InviteMemberRequest,
    context: OrgContext = Depends(require_admin)
):
    """
    Invite a user to the organization.

    Only admins and owners can invite.
    """
    with get_supabase_session() as session:
        # Lock the organization row to prevent race conditions on member limit
        # This ensures concurrent invitations don't exceed the limit
        session.execute(
            text("""
                SELECT id FROM organizations
                WHERE id = CAST(:org_id AS UUID)
                FOR UPDATE
            """),
            {"org_id": context.organization.id}
        )

        # Check member limit (now protected by row lock)
        member_count = session.execute(
            text("""
                SELECT COUNT(*) FROM organization_memberships
                WHERE organization_id = CAST(:org_id AS UUID)
            """),
            {"org_id": context.organization.id}
        ).scalar()

        pending_invites = session.execute(
            text("""
                SELECT COUNT(*) FROM organization_invitations
                WHERE organization_id = CAST(:org_id AS UUID)
                AND accepted_at IS NULL
                AND revoked_at IS NULL
                AND expires_at > NOW()
            """),
            {"org_id": context.organization.id}
        ).scalar()

        # TODO: Get from plan
        max_members = 10
        if member_count + pending_invites >= max_members:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Organization has reached its member limit ({max_members}). Upgrade to add more."
            )

        # Check if already a member
        existing_member = session.execute(
            text("""
                SELECT 1 FROM organization_memberships om
                JOIN users u ON u.id = om.user_id
                WHERE om.organization_id = CAST(:org_id AS UUID)
                AND u.email = :email
            """),
            {"org_id": context.organization.id, "email": data.email}
        ).fetchone()

        if existing_member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member of this organization"
            )

        # Create invitation
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        result = session.execute(
            text("""
                INSERT INTO organization_invitations
                    (organization_id, email, role, token, invited_by, expires_at)
                VALUES
                    (CAST(:org_id AS UUID), :email, :role, :token, CAST(:user_id AS UUID), :expires_at)
                ON CONFLICT (organization_id, email)
                DO UPDATE SET
                    role = :role,
                    token = :token,
                    invited_by = CAST(:user_id AS UUID),
                    expires_at = :expires_at,
                    accepted_at = NULL
                RETURNING id
            """),
            {
                "org_id": context.organization.id,
                "email": data.email,
                "role": data.role,
                "token": token,
                "user_id": context.user.id,
                "expires_at": expires_at
            }
        ).fetchone()

        # TODO: Send invitation email

        logger.info(f"[Orgs] Invitation created: org={context.organization.id}, email={data.email}")

        # Build invite URL
        from ..config import settings
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:27510')
        invite_url = f"{frontend_url}/invite/{token}"

        return InvitationResponse(
            id=str(result.id),
            email=data.email,
            role=data.role,
            expires_at=expires_at.isoformat(),
            invite_url=invite_url
        )


@router.post("/invitations/{token}/accept")
async def accept_invitation(
    token: str,
    user: User = Depends(get_current_user)
):
    """
    Accept an invitation to join an organization.
    """
    with get_supabase_session() as session:
        # Find invitation
        invite = session.execute(
            text("""
                SELECT
                    i.id, i.organization_id, i.email, i.role, i.expires_at,
                    o.name as org_name
                FROM organization_invitations i
                JOIN organizations o ON o.id = i.organization_id
                WHERE i.token = :token
                AND i.accepted_at IS NULL
                AND i.expires_at > NOW()
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

        # Check if already a member
        existing = session.execute(
            text("""
                SELECT 1 FROM organization_memberships
                WHERE organization_id = CAST(:org_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"org_id": str(invite.organization_id), "user_id": user.id}
        ).fetchone()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already a member of this organization"
            )

        # Add membership
        session.execute(
            text("""
                INSERT INTO organization_memberships (organization_id, user_id, role)
                VALUES (CAST(:org_id AS UUID), CAST(:user_id AS UUID), :role)
            """),
            {"org_id": str(invite.organization_id), "user_id": user.id, "role": invite.role}
        )

        # Mark invitation as accepted
        session.execute(
            text("""
                UPDATE organization_invitations
                SET accepted_at = NOW(), accepted_by = CAST(:user_id AS UUID)
                WHERE id = CAST(:invite_id AS UUID)
            """),
            {"invite_id": str(invite.id), "user_id": user.id}
        )

        logger.info(f"[Orgs] Invitation accepted: org={invite.organization_id}, user={user.email}")

        return {
            "success": True,
            "organization_id": str(invite.organization_id),
            "organization_name": invite.org_name,
            "role": invite.role,
            "message": f"You have joined {invite.org_name} as {invite.role}"
        }


@router.delete("/{org_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    user_id: str,
    context: OrgContext = Depends(require_admin)
):
    """
    Remove a member from the organization.

    Admins can remove members. Owners can remove admins.
    Cannot remove yourself or the last owner.
    """
    # Can't remove yourself via this endpoint (use /leave instead)
    if user_id == context.user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use /leave endpoint to leave an organization"
        )

    with get_supabase_session() as session:
        # Get target membership
        target = session.execute(
            text("""
                SELECT role FROM organization_memberships
                WHERE organization_id = CAST(:org_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"org_id": context.organization.id, "user_id": user_id}
        ).fetchone()

        if not target:
            raise HTTPException(status_code=404, detail="Member not found")

        # Can't remove owner unless you're owner
        if target.role == "owner" and context.role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owners can remove other owners"
            )

        # Can't remove last owner
        if target.role == "owner":
            owner_count = session.execute(
                text("""
                    SELECT COUNT(*) FROM organization_memberships
                    WHERE organization_id = CAST(:org_id AS UUID)
                    AND role = 'owner'
                """),
                {"org_id": context.organization.id}
            ).scalar()

            if owner_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove the last owner. Transfer ownership first."
                )

        # Remove membership
        session.execute(
            text("""
                DELETE FROM organization_memberships
                WHERE organization_id = CAST(:org_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"org_id": context.organization.id, "user_id": user_id}
        )

        logger.info(f"[Orgs] Member removed: org={context.organization.id}, user={user_id}")


@router.post("/{org_id}/leave")
async def leave_organization(
    context: OrgContext = Depends(get_org_context)
):
    """
    Leave an organization.

    Owners cannot leave without transferring ownership first.
    """
    with get_supabase_session() as session:
        # Check owner constraint in same transaction to prevent race condition
        if context.role == "owner":
            owner_count = session.execute(
                text("""
                    SELECT COUNT(*) FROM organization_memberships
                    WHERE organization_id = CAST(:org_id AS UUID)
                    AND role = 'owner'
                """),
                {"org_id": context.organization.id}
            ).scalar()

            if owner_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot leave as the only owner. Transfer ownership or delete the organization."
                )

        # Delete membership in same transaction
        session.execute(
            text("""
                DELETE FROM organization_memberships
                WHERE organization_id = CAST(:org_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"org_id": context.organization.id, "user_id": context.user.id}
        )

        logger.info(f"[Orgs] User left org: org={context.organization.id}, user={context.user.id}")

    return {"success": True, "message": f"You have left {context.organization.name}"}


@router.post("/{org_id}/transfer-ownership")
async def transfer_ownership(
    data: TransferOwnershipRequest,
    context: OrgContext = Depends(require_owner)
):
    """
    Transfer ownership of an organization to another member.

    Only owners can transfer ownership. The new owner must already be a member.
    The current owner is demoted to admin.
    """
    new_owner_id = data.new_owner_user_id

    # Can't transfer to yourself
    if new_owner_id == context.user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot transfer ownership to yourself"
        )

    with get_supabase_session() as session:
        # Lock the organization to prevent concurrent modifications
        session.execute(
            text("""
                SELECT id FROM organizations
                WHERE id = CAST(:org_id AS UUID)
                FOR UPDATE
            """),
            {"org_id": context.organization.id}
        )

        # Verify new owner is a member
        new_owner = session.execute(
            text("""
                SELECT u.id, u.email, u.full_name, om.role
                FROM organization_memberships om
                JOIN users u ON u.id = om.user_id
                WHERE om.organization_id = CAST(:org_id AS UUID)
                AND om.user_id = CAST(:user_id AS UUID)
            """),
            {"org_id": context.organization.id, "user_id": new_owner_id}
        ).fetchone()

        if not new_owner:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User is not a member of this organization"
            )

        # Promote new owner
        session.execute(
            text("""
                UPDATE organization_memberships
                SET role = 'owner', updated_at = NOW()
                WHERE organization_id = CAST(:org_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"org_id": context.organization.id, "user_id": new_owner_id}
        )

        # Demote current owner to admin
        session.execute(
            text("""
                UPDATE organization_memberships
                SET role = 'admin', updated_at = NOW()
                WHERE organization_id = CAST(:org_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"org_id": context.organization.id, "user_id": context.user.id}
        )

        logger.info(
            f"[Orgs] Ownership transferred: org={context.organization.id}, "
            f"from={context.user.id}, to={new_owner_id}"
        )

        return {
            "success": True,
            "message": f"Ownership transferred to {new_owner.email}",
            "new_owner": {
                "user_id": str(new_owner.id),
                "email": new_owner.email,
                "full_name": new_owner.full_name
            },
            "your_new_role": "admin"
        }


@router.get("/{org_id}/usage", response_model=UsageMetricsResponse)
async def get_usage_metrics(
    context: OrgContext = Depends(get_org_context)
):
    """
    Get organization usage metrics.

    Includes counts of BOMs, projects, members, storage, API calls.
    """
    with get_supabase_session() as session:
        # Get BOM count
        bom_count = session.execute(
            text("""
                SELECT COUNT(*) FROM boms
                WHERE organization_id = CAST(:org_id AS UUID)
            """),
            {"org_id": context.organization.id}
        ).scalar() or 0

        # Get project count
        project_count = session.execute(
            text("""
                SELECT COUNT(*) FROM projects
                WHERE organization_id = CAST(:org_id AS UUID)
            """),
            {"org_id": context.organization.id}
        ).scalar() or 0

        # Get member count
        member_count = session.execute(
            text("""
                SELECT COUNT(*) FROM organization_memberships
                WHERE organization_id = CAST(:org_id AS UUID)
            """),
            {"org_id": context.organization.id}
        ).scalar() or 0

        # Get pending invitations count
        pending_invitations = session.execute(
            text("""
                SELECT COUNT(*) FROM organization_invitations
                WHERE organization_id = CAST(:org_id AS UUID)
                AND accepted_at IS NULL
                AND revoked_at IS NULL
                AND expires_at > NOW()
            """),
            {"org_id": context.organization.id}
        ).scalar() or 0

        # Get plan type and limits
        org_info = session.execute(
            text("""
                SELECT
                    COALESCE(org_type, 'free') as plan_type,
                    COALESCE(max_users, 5) as max_users
                FROM organizations
                WHERE id = CAST(:org_id AS UUID)
            """),
            {"org_id": context.organization.id}
        ).fetchone()

        plan_type = org_info.plan_type if org_info else "free"

        # Define plan limits
        plan_limits = {
            "free": {"max_boms": 10, "max_projects": 3, "max_members": 5, "storage_mb": 100},
            "professional": {"max_boms": 100, "max_projects": 20, "max_members": 25, "storage_mb": 1000},
            "enterprise": {"max_boms": -1, "max_projects": -1, "max_members": -1, "storage_mb": -1},  # -1 = unlimited
        }

        limits = plan_limits.get(plan_type, plan_limits["free"])

        # Estimate storage (simplified - count BOM line items)
        line_item_count = session.execute(
            text("""
                SELECT COUNT(*) FROM bom_line_items bli
                JOIN boms b ON b.id = bli.bom_id
                WHERE b.organization_id = CAST(:org_id AS UUID)
            """),
            {"org_id": context.organization.id}
        ).scalar() or 0

        # Rough estimate: ~1KB per line item
        storage_mb = round(line_item_count * 0.001, 2)

        # API calls - check if usage_records table exists
        api_calls_30d = 0
        try:
            api_calls_30d = session.execute(
                text("""
                    SELECT COALESCE(SUM(quantity), 0) FROM usage_records
                    WHERE organization_id = CAST(:org_id AS UUID)
                    AND metric_type = 'api_call'
                    AND recorded_at > NOW() - INTERVAL '30 days'
                """),
                {"org_id": context.organization.id}
            ).scalar() or 0
        except Exception:
            pass  # Table might not exist or be empty

        return UsageMetricsResponse(
            organization_id=context.organization.id,
            bom_count=bom_count,
            project_count=project_count,
            member_count=member_count,
            storage_mb=storage_mb,
            api_calls_30d=int(api_calls_30d),
            pending_invitations=pending_invitations,
            plan_type=plan_type,
            limits=limits
        )


@router.get("/{org_id}/invitations", response_model=PaginatedInvitationsResponse)
async def get_pending_invitations(
    context: OrgContext = Depends(require_admin),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0)
):
    """
    Get pending invitations for an organization.

    Only admins and owners can view invitations.
    """
    with get_supabase_session() as session:
        # Get total count
        total = session.execute(
            text("""
                SELECT COUNT(*) FROM organization_invitations
                WHERE organization_id = CAST(:org_id AS UUID)
                AND accepted_at IS NULL
                AND revoked_at IS NULL
                AND expires_at > NOW()
            """),
            {"org_id": context.organization.id}
        ).scalar()

        # Get paginated items
        result = session.execute(
            text("""
                SELECT
                    oi.id, oi.email, oi.role, oi.created_at, oi.expires_at,
                    u.email as invited_by_email
                FROM organization_invitations oi
                LEFT JOIN users u ON u.id = oi.invited_by
                WHERE oi.organization_id = CAST(:org_id AS UUID)
                AND oi.accepted_at IS NULL
                AND oi.revoked_at IS NULL
                AND oi.expires_at > NOW()
                ORDER BY oi.created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {"org_id": context.organization.id, "limit": limit, "offset": offset}
        )

        items = [
            PendingInvitationResponse(
                id=str(row.id),
                email=row.email,
                role=row.role,
                created_at=row.created_at.isoformat() if row.created_at else None,
                expires_at=row.expires_at.isoformat() if row.expires_at else None,
                invited_by_email=row.invited_by_email
            )
            for row in result.fetchall()
        ]

        return PaginatedInvitationsResponse(
            items=items,
            total=total,
            limit=limit,
            offset=offset
        )


@router.delete("/{org_id}/invitations/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(
    invite_id: str,
    context: OrgContext = Depends(require_admin)
):
    """
    Revoke a pending invitation.

    Only admins and owners can revoke invitations.
    """
    with get_supabase_session() as session:
        result = session.execute(
            text("""
                UPDATE organization_invitations
                SET revoked_at = NOW()
                WHERE id = CAST(:invite_id AS UUID)
                AND organization_id = CAST(:org_id AS UUID)
                AND accepted_at IS NULL
                AND revoked_at IS NULL
            """),
            {"invite_id": invite_id, "org_id": context.organization.id}
        )

        if result.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found or already accepted/revoked"
            )

        logger.info(f"[Orgs] Invitation revoked: org={context.organization.id}, invite={invite_id}")


@router.patch("/{org_id}/members/{user_id}", response_model=MemberResponse)
async def update_member_role(
    user_id: str,
    data: UpdateMemberRoleRequest,
    context: OrgContext = Depends(require_admin)
):
    """
    Update a member's role.

    Admins can update non-admin roles. Owners can update any role except owner.
    Cannot change your own role or an owner's role.
    """
    # Can't change your own role
    if user_id == context.user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role"
        )

    with get_supabase_session() as session:
        # Get target member
        target = session.execute(
            text("""
                SELECT om.role, u.email, u.full_name, om.created_at as joined_at
                FROM organization_memberships om
                JOIN users u ON u.id = om.user_id
                WHERE om.organization_id = CAST(:org_id AS UUID)
                AND om.user_id = CAST(:user_id AS UUID)
            """),
            {"org_id": context.organization.id, "user_id": user_id}
        ).fetchone()

        if not target:
            raise HTTPException(status_code=404, detail="Member not found")

        # Can't change owner's role
        if target.role == "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot change an owner's role. Use transfer ownership instead."
            )

        # Admins can only change to non-admin roles
        if context.role == "admin" and data.role == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owners can promote members to admin"
            )

        # Update role in database
        session.execute(
            text("""
                UPDATE organization_memberships
                SET role = :role, updated_at = NOW()
                WHERE organization_id = CAST(:org_id AS UUID)
                AND user_id = CAST(:user_id AS UUID)
            """),
            {"org_id": context.organization.id, "user_id": user_id, "role": data.role}
        )

        # Get user's Auth0 ID for role sync
        user_auth0_id = session.execute(
            text("SELECT auth0_user_id FROM users WHERE id = CAST(:user_id AS UUID)"),
            {"user_id": user_id}
        ).scalar()

        logger.info(f"[Orgs] Member role updated: org={context.organization.id}, user={user_id}, role={data.role}")

        # Sync role to Auth0 app_metadata (async, non-blocking)
        if user_auth0_id:
            from ..middleware.auth_middleware import sync_role_to_auth0
            import asyncio
            try:
                # Run async sync in background (don't block response)
                asyncio.create_task(sync_role_to_auth0(user_auth0_id, data.role))
            except Exception as e:
                logger.warning(f"[Orgs] Failed to schedule Auth0 role sync: {e}")

        return MemberResponse(
            user_id=user_id,
            email=target.email,
            full_name=target.full_name,
            role=data.role,
            joined_at=target.joined_at.isoformat() if target.joined_at else None
        )
