"""
Auth Provisioning API Endpoints

Handles user + organization provisioning for Auth0 self-signup flow:
- POST /api/auth/provision-user - Create org + user + membership on first login
- POST /api/auth/accept-invite - Join existing org (forfeit personal org)

Called by Auth0 Post-Login Action on first login.
"""

import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from contextlib import contextmanager

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy import text

from ..models.dual_database import get_dual_database
from ..services.onboarding_service import get_onboarding_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth-provisioning"])


# =====================================================
# Database Session Helper
# =====================================================
@contextmanager
def get_supabase_session():
    """Get a session for the Supabase database."""
    dual_db = get_dual_database()
    session = dual_db.SupabaseSession()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# =====================================================
# Pydantic Models
# =====================================================
class ProvisionUserRequest(BaseModel):
    """Request to provision a new self-signup user."""
    auth0_user_id: str = Field(..., description="Auth0 user ID (e.g., 'auth0|123' or 'google-oauth2|456')")
    email: EmailStr = Field(..., description="User email address")
    name: Optional[str] = Field(None, description="User full name")
    plan: str = Field(default="free", description="Initial plan tier: free, starter, professional")


class ProvisionUserResponse(BaseModel):
    """Response after provisioning user."""
    success: bool
    auth0_org_id: str = Field(..., description="Synthetic Auth0 org ID for JWT claims")
    roles: List[str] = Field(..., description="Customer org role (owner, admin, engineer, analyst, member, viewer)")
    organization_id: str = Field(..., description="Supabase organization UUID")
    user_id: str = Field(..., description="Supabase user UUID")
    workspace_id: Optional[str] = Field(None, description="Default workspace UUID")
    is_new: bool = Field(..., description="True if newly created, False if already existed")


class AcceptInviteRequest(BaseModel):
    """Request to accept an org invitation."""
    auth0_user_id: str = Field(..., description="Auth0 user ID")
    email: EmailStr = Field(..., description="User email")
    invite_token: str = Field(..., description="Invitation token")


class AcceptInviteResponse(BaseModel):
    """Response after accepting invitation."""
    success: bool
    auth0_org_id: str = Field(..., description="Auth0 org ID of the joined org")
    roles: List[str] = Field(..., description="Customer org role for JWT synchronization")
    organization_id: str = Field(..., description="Supabase organization UUID")
    organization_name: str
    workspace_id: Optional[str] = Field(None, description="Default workspace UUID of the joined org")
    forfeited_org_id: Optional[str] = Field(None, description="Personal org ID that was deleted")


class UserLookupResponse(BaseModel):
    """Response for checking if user exists."""
    exists: bool
    auth0_org_id: Optional[str] = None
    roles: Optional[List[str]] = None
    org_roles: Optional[Dict[str, str]] = None


# =====================================================
# Plan Configuration
# =====================================================
# NOTE: Customer org roles (owner, admin, engineer, analyst, member, viewer) are stored
# in Supabase `organization_memberships.role` AND synchronized to Auth0 JWT tokens.
# Platform:* roles are for CNS staff only and are assigned via Auth0 RBAC.
PLAN_CONFIG = {
    "free": {
        "plan_tier": "free",
        "max_members": 1,
        "trial_days": 0,
    },
    "starter": {
        "plan_tier": "starter",
        "max_members": 1,
        "trial_days": 14,
    },
    "professional": {
        "plan_tier": "professional",
        "max_members": 4,  # Owner + 3 invited
        "trial_days": 14,
    },
}


# =====================================================
# Helper Functions
# =====================================================
def generate_synthetic_org_id(auth0_user_id: str) -> str:
    """
    Generate a synthetic Auth0 org ID for personal organizations.

    Format: personal_{hash}
    This allows self-signup users to have an org_id in their JWT
    that maps to their personal Supabase organization.
    """
    # Use first 12 chars of hash for readability
    user_hash = secrets.token_hex(6)  # 12 hex chars
    return f"personal_{user_hash}"


def generate_org_slug(email: str) -> str:
    """Generate unique org slug from email."""
    base_slug = email.split("@")[0].lower()
    # Replace non-alphanumeric with hyphen
    slug = "".join(c if c.isalnum() else "-" for c in base_slug)
    # Add random suffix for uniqueness
    suffix = secrets.token_hex(3)
    return f"{slug}-{suffix}"


# =====================================================
# API Endpoints
# =====================================================
@router.post("/provision-user", response_model=ProvisionUserResponse)
async def provision_user(request: ProvisionUserRequest):
    """
    Provision a new self-signup user with their personal organization.

    This endpoint is called by Auth0 Post-Login Action on first login.
    It creates:
    1. A personal organization for the user
    2. A user record linked to their Auth0 ID
    3. An organization membership with Owner role

    The returned auth0_org_id should be stored in Auth0 app_metadata
    and included in future JWT tokens.

    **Security**: This endpoint does NOT require authentication.
    It validates by checking the user doesn't already exist.
    Called only from Auth0 Actions (server-side, trusted).
    """
    auth0_user_id = request.auth0_user_id
    email = request.email
    name = request.name or email.split("@")[0]
    plan = request.plan.lower()

    logger.info(f"[AuthProvisioning] Provisioning user: auth0_id={auth0_user_id}, email={email}, plan={plan}")

    # Validate plan
    if plan not in PLAN_CONFIG:
        plan = "free"
    plan_cfg = PLAN_CONFIG[plan]

    try:
        with get_supabase_session() as session:
            # Check if user already exists
            existing = session.execute(
                text("""
                    SELECT u.id, u.organization_id, om.role,
                           (SELECT w.id FROM workspaces w
                            WHERE w.organization_id = u.organization_id AND w.is_default = true
                            LIMIT 1) as default_workspace_id
                    FROM users u
                    LEFT JOIN organization_memberships om ON om.user_id = u.id AND om.organization_id = u.organization_id
                    WHERE u.auth0_user_id = :auth0_id OR u.email = :email
                    LIMIT 1
                """),
                {"auth0_id": auth0_user_id, "email": email}
            ).fetchone()

            if existing:
                # User already exists - return their info
                logger.info(f"[AuthProvisioning] User already exists: user_id={existing.id}, role={existing.role}")

                # Return the actual customer role for JWT synchronization
                # This allows Auth0 to include the role in JWT tokens
                customer_role = existing.role or "member"

                return ProvisionUserResponse(
                    success=True,
                    auth0_org_id=generate_synthetic_org_id(auth0_user_id),
                    roles=[customer_role],  # Include customer org role for JWT sync
                    organization_id=str(existing.organization_id) if existing.organization_id else "",
                    user_id=str(existing.id),
                    workspace_id=str(existing.default_workspace_id) if existing.default_workspace_id else None,
                    is_new=False,
                )

            # Create new organization
            org_slug = generate_org_slug(email)
            auth0_org_id = generate_synthetic_org_id(auth0_user_id)
            org_name = f"{name}'s Organization"

            # Calculate trial end date
            trial_ends_at = None
            if plan_cfg["trial_days"] > 0:
                trial_ends_at = datetime.now(timezone.utc) + timedelta(days=plan_cfg["trial_days"])

            org_result = session.execute(
                text("""
                    INSERT INTO organizations (name, slug, plan_tier, max_users, trial_ends_at, created_at, updated_at)
                    VALUES (:name, :slug, :plan_tier, :max_users, :trial_ends_at, NOW(), NOW())
                    RETURNING id, name
                """),
                {
                    "name": org_name,
                    "slug": org_slug,
                    "plan_tier": plan_cfg.get("plan_tier", "free"),
                    "max_users": plan_cfg["max_members"],
                    "trial_ends_at": trial_ends_at,
                }
            ).fetchone()

            org_id = org_result.id
            logger.info(f"[AuthProvisioning] Created organization: id={org_id}, slug={org_slug}")

            # Create user
            user_result = session.execute(
                text("""
                    INSERT INTO users (email, full_name, auth0_user_id, organization_id, created_at)
                    VALUES (:email, :name, :auth0_id, :org_id, NOW())
                    RETURNING id
                """),
                {
                    "email": email,
                    "name": name,
                    "auth0_id": auth0_user_id,
                    "org_id": org_id,
                }
            ).fetchone()

            user_id = user_result.id
            logger.info(f"[AuthProvisioning] Created user: id={user_id}")

            # Create membership with owner role
            # Note: Owner is the primary role - additional capabilities (admin, engineer) implied
            session.execute(
                text("""
                    INSERT INTO organization_memberships (organization_id, user_id, role, created_at)
                    VALUES (:org_id, :user_id, 'owner', NOW())
                """),
                {"org_id": org_id, "user_id": user_id}
            )
            logger.info(f"[AuthProvisioning] Created membership: user={user_id}, org={org_id}, role=owner")

            # Create default workspace for the organization
            workspace_slug = f"{org_slug}-projects"
            workspace_result = session.execute(
                text("""
                    INSERT INTO workspaces (organization_id, name, slug, is_default, created_by, created_at)
                    VALUES (:org_id, 'My Projects', :slug, true, :user_id, NOW())
                    RETURNING id
                """),
                {"org_id": org_id, "slug": workspace_slug, "user_id": user_id}
            ).fetchone()

            workspace_id = workspace_result.id
            logger.info(f"[AuthProvisioning] Created default workspace: id={workspace_id}, slug={workspace_slug}")

            # Add user as workspace admin
            session.execute(
                text("""
                    INSERT INTO workspace_memberships (workspace_id, user_id, role, created_at)
                    VALUES (:ws_id, :user_id, 'admin', NOW())
                """),
                {"ws_id": workspace_id, "user_id": user_id}
            )
            logger.info(f"[AuthProvisioning] Added user to workspace: user={user_id}, workspace={workspace_id}, role=admin")

            # Set user's last workspace preference
            session.execute(
                text("""
                    INSERT INTO user_preferences (user_id, last_organization_id, last_workspace_id)
                    VALUES (:user_id, :org_id, :ws_id)
                    ON CONFLICT (user_id) DO UPDATE
                    SET last_organization_id = :org_id, last_workspace_id = :ws_id, updated_at = NOW()
                """),
                {"user_id": user_id, "org_id": org_id, "ws_id": workspace_id}
            )

            # Return the actual customer role for JWT synchronization
            # This allows Auth0 to include the role in JWT tokens
            # New users are always created as 'owner' of their personal org
            customer_role = "owner"

            logger.info(f"[AuthProvisioning] User provisioned successfully: auth0_org_id={auth0_org_id}, role={customer_role}")

            return ProvisionUserResponse(
                success=True,
                auth0_org_id=auth0_org_id,
                roles=[customer_role],  # Include customer org role for JWT sync
                organization_id=str(org_id),
                user_id=str(user_id),
                workspace_id=str(workspace_id),
                is_new=True,
            )

    except Exception as e:
        logger.error(f"[AuthProvisioning] Failed to provision user: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to provision user: {str(e)}")


@router.get("/lookup-user/{auth0_user_id}", response_model=UserLookupResponse)
async def lookup_user(auth0_user_id: str):
    """
    Check if a user has already been provisioned.

    Called by Auth0 Action to check if provisioning is needed.
    Returns auth0_org_id and roles if user exists.
    """
    try:
        with get_supabase_session() as session:
            result = session.execute(
                text("""
                    SELECT u.id, u.organization_id, om.role
                    FROM users u
                    LEFT JOIN organization_memberships om ON om.user_id = u.id AND om.organization_id = u.organization_id
                    WHERE u.auth0_user_id = :auth0_id
                    LIMIT 1
                """),
                {"auth0_id": auth0_user_id}
            ).fetchone()

            if not result:
                return UserLookupResponse(exists=False)

            # Return the actual customer role for JWT synchronization
            customer_role = result.role or "member"

            # Get all org memberships for this user
            org_roles_rows = session.execute(
                text("""
                    SELECT o.id as org_id, om.role
                    FROM organization_memberships om
                    JOIN organizations o ON o.id = om.organization_id
                    WHERE om.user_id = :user_id
                """),
                {"user_id": result.id}
            ).fetchall()

            # Build org_roles dict using synthetic auth0_org_id (based on org UUID)
            org_roles = {
                generate_synthetic_org_id(str(row.org_id)): row.role or "member"
                for row in org_roles_rows
            } or None

            return UserLookupResponse(
                exists=True,
                auth0_org_id=generate_synthetic_org_id(auth0_user_id),
                roles=[customer_role],  # Include customer org role for JWT sync
                org_roles=org_roles,
            )

    except Exception as e:
        logger.error(f"[AuthProvisioning] Lookup failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Lookup failed")


@router.post("/accept-invite", response_model=AcceptInviteResponse)
async def accept_invite(request: AcceptInviteRequest):
    """
    Accept an invitation to join an existing organization.

    This endpoint:
    1. Validates the invitation token
    2. Adds user to the new organization
    3. Forfeits (deletes) their personal org if it's empty
    4. Returns the new org's auth0_org_id for JWT claims

    Called by Auth0 Action when user clicks invite link.
    """
    auth0_user_id = request.auth0_user_id
    email = request.email
    invite_token = request.invite_token

    logger.info(f"[AuthProvisioning] Accept invite: auth0_id={auth0_user_id}, email={email}")

    try:
        with get_supabase_session() as session:
            # Validate invitation token
            invite = session.execute(
                text("""
                    SELECT id, organization_id, email, role, expires_at
                    FROM organization_invitations
                    WHERE token = :token
                    AND email = :email
                    AND accepted_at IS NULL
                    AND expires_at > NOW()
                """),
                {"token": invite_token, "email": email}
            ).fetchone()

            if not invite:
                raise HTTPException(status_code=400, detail="Invalid or expired invitation")

            target_org_id = invite.organization_id
            assigned_role = invite.role or "member"

            # Get target org details
            org = session.execute(
                text("SELECT id, name, auth0_org_id FROM organizations WHERE id = :id"),
                {"id": target_org_id}
            ).fetchone()

            if not org:
                raise HTTPException(status_code=404, detail="Organization not found")

            # Find or create user
            user = session.execute(
                text("""
                    SELECT id, organization_id
                    FROM users
                    WHERE auth0_user_id = :auth0_id OR email = :email
                    LIMIT 1
                """),
                {"auth0_id": auth0_user_id, "email": email}
            ).fetchone()

            forfeited_org_id = None

            if user:
                user_id = user.id
                old_org_id = user.organization_id

                # Check if old org should be forfeited
                if old_org_id and old_org_id != target_org_id:
                    # Count members in old org
                    member_count = session.execute(
                        text("""
                            SELECT COUNT(*) FROM organization_memberships
                            WHERE organization_id = :org_id
                        """),
                        {"org_id": old_org_id}
                    ).scalar()

                    if member_count == 1:
                        # This was the only member - delete the personal org
                        logger.info(f"[AuthProvisioning] Forfeiting empty personal org: {old_org_id}")

                        # Delete membership first
                        session.execute(
                            text("DELETE FROM organization_memberships WHERE organization_id = :org_id"),
                            {"org_id": old_org_id}
                        )

                        # Mark org as deleted
                        session.execute(
                            text("UPDATE organizations SET deleted_at = NOW() WHERE id = :org_id"),
                            {"org_id": old_org_id}
                        )

                        forfeited_org_id = str(old_org_id)

                # Update user's primary organization
                session.execute(
                    text("UPDATE users SET organization_id = :org_id WHERE id = :user_id"),
                    {"org_id": target_org_id, "user_id": user_id}
                )
            else:
                # Create new user
                name = email.split("@")[0]
                user_result = session.execute(
                    text("""
                        INSERT INTO users (email, full_name, auth0_user_id, organization_id, created_at)
                        VALUES (:email, :name, :auth0_id, :org_id, NOW())
                        RETURNING id
                    """),
                    {
                        "email": email,
                        "name": name,
                        "auth0_id": auth0_user_id,
                        "org_id": target_org_id,
                    }
                ).fetchone()
                user_id = user_result.id

            # Create membership in new org (if not exists)
            session.execute(
                text("""
                    INSERT INTO organization_memberships (organization_id, user_id, role, created_at)
                    VALUES (:org_id, :user_id, :role, NOW())
                    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = :role
                """),
                {"org_id": target_org_id, "user_id": user_id, "role": assigned_role}
            )

            # Get default workspace of the target org and add user to it
            default_workspace = session.execute(
                text("""
                    SELECT id FROM workspaces
                    WHERE organization_id = :org_id AND is_default = true
                    LIMIT 1
                """),
                {"org_id": target_org_id}
            ).fetchone()

            default_workspace_id = None
            if default_workspace:
                default_workspace_id = default_workspace.id

                # Map org role to workspace role
                # admin -> admin, engineer -> engineer, analyst -> analyst, member -> viewer
                workspace_role = {
                    'owner': 'admin',
                    'admin': 'admin',
                    'engineer': 'engineer',
                    'analyst': 'analyst',
                    'member': 'viewer',
                    'viewer': 'viewer',
                }.get(assigned_role, 'viewer')

                # Add user to default workspace
                session.execute(
                    text("""
                        INSERT INTO workspace_memberships (workspace_id, user_id, role, created_at)
                        VALUES (:ws_id, :user_id, :role, NOW())
                        ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = :role
                    """),
                    {"ws_id": default_workspace_id, "user_id": user_id, "role": workspace_role}
                )
                logger.info(f"[AuthProvisioning] Added user to workspace: user={user_id}, workspace={default_workspace_id}, role={workspace_role}")

                # Update user preferences
                session.execute(
                    text("""
                        INSERT INTO user_preferences (user_id, last_organization_id, last_workspace_id)
                        VALUES (:user_id, :org_id, :ws_id)
                        ON CONFLICT (user_id) DO UPDATE
                        SET last_organization_id = :org_id, last_workspace_id = :ws_id, updated_at = NOW()
                    """),
                    {"user_id": user_id, "org_id": target_org_id, "ws_id": default_workspace_id}
                )

            # Mark invitation as accepted
            session.execute(
                text("""
                    UPDATE organization_invitations
                    SET accepted_at = NOW(), accepted_by = :user_id
                    WHERE id = :invite_id
                """),
                {"invite_id": invite.id, "user_id": user_id}
            )

            # Return the actual customer role for JWT synchronization
            logger.info(f"[AuthProvisioning] User joined org: user={user_id}, org={target_org_id}, role={assigned_role}")

            return AcceptInviteResponse(
                success=True,
                auth0_org_id=org.auth0_org_id,
                roles=[assigned_role],  # Include customer org role for JWT sync
                organization_id=str(target_org_id),
                organization_name=org.name,
                workspace_id=str(default_workspace_id) if default_workspace_id else None,
                forfeited_org_id=forfeited_org_id,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[AuthProvisioning] Accept invite failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to accept invitation: {str(e)}")


@router.post("/sync-novu-subscriber")
async def sync_novu_subscriber(
    auth0_user_id: str,
    email: str,
    name: Optional[str] = None
):
    """
    Sync a user as a Novu subscriber for notifications.

    Called after provisioning to ensure the user can receive notifications.
    """
    try:
        from shared.notification.client import get_novu_client

        novu = get_novu_client()
        if novu:
            # Find the Supabase user ID
            with get_supabase_session() as session:
                user = session.execute(
                    text("SELECT id FROM users WHERE auth0_user_id = :auth0_id"),
                    {"auth0_id": auth0_user_id}
                ).fetchone()

                if user:
                    await novu.create_or_update_subscriber(
                        subscriber_id=str(user.id),
                        email=email,
                        first_name=name or email.split("@")[0],
                    )
                    logger.info(f"[AuthProvisioning] Synced Novu subscriber: {user.id}")
                    return {"success": True, "subscriber_id": str(user.id)}

        return {"success": False, "reason": "Novu not available"}

    except Exception as e:
        logger.error(f"[AuthProvisioning] Failed to sync Novu subscriber: {e}")
        return {"success": False, "reason": str(e)}
