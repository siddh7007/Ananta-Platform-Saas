"""
Auth Dependencies for Multi-Org Support

Provides FastAPI dependencies for:
1. get_current_user - Lazy provisions user on first API call
2. get_current_org - Verifies user membership in org
3. require_role - Enforces role-based access

Usage:
    @router.get("/me")
    async def get_profile(user: User = Depends(get_current_user)):
        return user

    @router.get("/orgs/{org_id}/boms")
    async def get_boms(
        org_id: str,
        context: OrgContext = Depends(get_org_context)
    ):
        return context.user, context.organization
"""

import logging
import asyncio
from dataclasses import dataclass
from typing import Optional, List
from contextlib import contextmanager
import re

from fastapi import Depends, HTTPException, Header, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..models.dual_database import get_dual_database
from ..config import settings

# Import for Novu sync
try:
    from shared.notification.client import get_novu_client
    NOVU_AVAILABLE = True
except ImportError:
    NOVU_AVAILABLE = False

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class User:
    """Authenticated user."""
    id: str
    auth0_user_id: str
    email: str
    full_name: Optional[str] = None
    is_platform_admin: bool = False
    is_new: bool = False  # True if just provisioned


@dataclass
class Organization:
    """Organization context."""
    id: str
    name: str
    slug: Optional[str] = None
    plan_type: str = "free"


@dataclass
class OrgContext:
    """Combined user + organization context with role."""
    user: User
    organization: Organization
    role: str  # owner, admin, member, viewer

    @property
    def is_owner(self) -> bool:
        return self.role == "owner"

    @property
    def is_admin(self) -> bool:
        return self.role in ("owner", "admin")

    @property
    def is_engineer(self) -> bool:
        return self.role in ("owner", "admin", "engineer")

    @property
    def can_write(self) -> bool:
        return self.role in ("owner", "admin", "engineer")


@dataclass
class Workspace:
    """Workspace context."""
    id: str
    organization_id: str
    name: str
    slug: Optional[str] = None
    is_default: bool = False


@dataclass
class WorkspaceContext:
    """Combined user + workspace context with role."""
    user: User
    workspace: Workspace
    organization: Organization
    role: str  # admin, engineer, analyst, viewer

    @property
    def is_workspace_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_engineer(self) -> bool:
        return self.role in ("admin", "engineer")

    @property
    def can_upload_bom(self) -> bool:
        return self.role in ("admin", "engineer")

    @property
    def can_view_bom(self) -> bool:
        return self.role in ("admin", "engineer", "analyst")

    @property
    def can_write(self) -> bool:
        return self.role in ("admin", "engineer")


# ============================================================================
# Database Helper
# ============================================================================

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


# ============================================================================
# JWT Verification
# ============================================================================

def verify_jwt_claims(credentials: HTTPAuthorizationCredentials) -> dict:
    """
    Verify JWT and extract claims.

    Supports both:
    - Auth0 JWTs (RS256) - when VITE_USE_DIRECT_AUTH0_JWT=true
    - Supabase JWTs (HS256) - when middleware creates session (Option B)

    JWT verification is controlled by settings.AUTH0_VERIFY_SIGNATURE:
    - False (default for dev): Trust middleware verification, decode without signature check
    - True (production): Full JWKS verification for Auth0 tokens
    """
    import jwt
    from jwt import PyJWKClient

    token = credentials.credentials

    try:
        # Check if we should verify signature
        verify_signature = getattr(settings, 'AUTH0_VERIFY_SIGNATURE', False)

        if verify_signature:
            # Production: Full JWKS verification (Auth0 RS256)
            auth0_domain = getattr(settings, 'AUTH0_DOMAIN', None)
            auth0_audience = getattr(settings, 'AUTH0_AUDIENCE', None)

            if not auth0_domain:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="AUTH0_DOMAIN not configured"
                )

            jwks_url = f"https://{auth0_domain}/.well-known/jwks.json"
            jwks_client = PyJWKClient(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)

            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=auth0_audience,
                issuer=f"https://{auth0_domain}/"
            )
        else:
            # Development: Decode without verification (middleware already verified)
            # Support both RS256 (Auth0) and HS256 (Supabase) tokens
            claims = jwt.decode(
                token,
                options={"verify_signature": False},
                algorithms=["RS256", "HS256"]
            )

        # Extract namespace claims (for Auth0 tokens with custom namespace)
        namespace = "https://ananta.component.platform"

        # Get sub - Auth0 uses "sub", Supabase also uses "sub" (but it's a UUID)
        sub = claims.get("sub") or claims.get(f"{namespace}/sub")

        # Get email - both Auth0 and Supabase put email at top level
        email = claims.get("email") or claims.get(f"{namespace}/email")

        # For Supabase JWTs, email might also be in user_metadata
        if not email and claims.get("user_metadata"):
            email = claims.get("user_metadata", {}).get("email")

        return {
            "sub": sub,
            "email": email,
            "email_verified": claims.get("email_verified", False),
            "name": claims.get("name") or claims.get("user_metadata", {}).get("full_name"),
            "picture": claims.get("picture"),
            # Legacy claims for backwards compatibility (Auth0)
            "org_id": claims.get(f"{namespace}/org_id") or claims.get("user_metadata", {}).get("organization_id"),
            "roles": claims.get(f"{namespace}/roles", []),
            # Supabase-specific claims
            "role": claims.get("role"),  # Supabase role (authenticated, anon, etc.)
            "user_metadata": claims.get("user_metadata", {}),
        }

    except jwt.ExpiredSignatureError:
        logger.warning("[Auth] JWT expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError as e:
        logger.warning(f"[Auth] Invalid JWT: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )


# ============================================================================
# Lazy User Provisioning
# ============================================================================

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> User:
    """
    Get current authenticated user, lazily provisioning if needed.

    This is the core auth dependency. It:
    1. Verifies the JWT
    2. Looks up the user in database
    3. Creates the user if this is their first API call
    4. Syncs user to Novu for notifications

    Usage:
        @router.get("/me")
        async def get_profile(user: User = Depends(get_current_user)):
            return {"id": user.id, "email": user.email}
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Verify JWT and extract claims
    claims = verify_jwt_claims(credentials)

    auth0_user_id = claims.get("sub")
    email = claims.get("email")

    # Auth0 access tokens don't include email by default, only ID tokens do.
    # Fall back to X-User-Email header sent by frontend.
    if not email:
        email = request.headers.get("X-User-Email")
        if email:
            logger.info(f"[Auth] Email from X-User-Email header: {email}")

    if not auth0_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing sub claim"
        )

    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing email claim (provide X-User-Email header or configure Auth0 to include email in access token)"
        )

    # Look up or provision user
    with get_supabase_session() as session:
        # Check if user exists
        result = session.execute(
            text("""
                SELECT id, auth0_user_id, email, full_name, is_platform_admin
                FROM users
                WHERE auth0_user_id = :auth0_id
            """),
            {"auth0_id": auth0_user_id}
        )
        row = result.fetchone()

        if row:
            # User exists
            user = User(
                id=str(row.id),
                auth0_user_id=row.auth0_user_id,
                email=row.email,
                full_name=row.full_name,
                is_platform_admin=row.is_platform_admin or False,
                is_new=False
            )
        else:
            # Lazy provision new user
            logger.info(f"[Auth] Provisioning new user: {email}")

            name = claims.get("name") or email.split("@")[0]

            result = session.execute(
                text("""
                    INSERT INTO users (auth0_user_id, email, full_name)
                    VALUES (:auth0_id, :email, :name)
                    RETURNING id
                """),
                {"auth0_id": auth0_user_id, "email": email, "name": name}
            )
            user_id = result.fetchone().id

            user = User(
                id=str(user_id),
                auth0_user_id=auth0_user_id,
                email=email,
                full_name=name,
                is_platform_admin=False,
                is_new=True
            )

            logger.info(f"[Auth] User provisioned: id={user_id}, email={email}")

            # Sync to Novu for notifications (fire-and-forget, don't block)
            if NOVU_AVAILABLE:
                async def sync_novu_subscriber():
                    try:
                        novu = get_novu_client()
                        if novu:
                            await novu.create_or_update_subscriber(
                                subscriber_id=str(user_id),
                                email=email,
                                first_name=name
                            )
                    except Exception as e:
                        logger.warning(f"[Auth] Failed to sync Novu subscriber: {e}")

                # Fire and forget - don't await
                asyncio.create_task(sync_novu_subscriber())

    # Attach user to request for later use
    request.state.current_user = user

    return user


# ============================================================================
# Organization Context
# ============================================================================

def _is_valid_uuid(value: str) -> bool:
    """Check if string is a valid UUID."""
    uuid_pattern = re.compile(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        re.IGNORECASE
    )
    return bool(uuid_pattern.match(value))


async def get_org_context(
    org_id: str,
    user: User = Depends(get_current_user)
) -> OrgContext:
    """
    Get organization context with role verification.

    Verifies the user is a member of the organization and returns
    their role. Raises 403 if not a member.

    Usage:
        @router.get("/orgs/{org_id}/boms")
        async def get_boms(context: OrgContext = Depends(get_org_context)):
            if not context.can_write:
                raise HTTPException(403, "Read-only access")
            return get_boms_for_org(context.organization.id)
    """
    # Validate UUID format to prevent SQL errors
    if not _is_valid_uuid(org_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organization ID format"
        )

    with get_supabase_session() as session:
        # Get membership and org in one query
        result = session.execute(
            text("""
                SELECT
                    o.id as org_id,
                    o.name as org_name,
                    o.slug as org_slug,
                    COALESCE(o.org_type, 'free') as plan_type,
                    om.role
                FROM organizations o
                JOIN organization_memberships om ON om.organization_id = o.id
                WHERE o.id = CAST(:org_id AS UUID)
                AND om.user_id = CAST(:user_id AS UUID)
            """),
            {"org_id": org_id, "user_id": user.id}
        )
        row = result.fetchone()

        # Super admin bypass
        if not row and user.is_platform_admin:
            # Get org without membership check
            org_result = session.execute(
                text("""
                    SELECT id, name, slug, COALESCE(org_type, 'free') as plan_type
                    FROM organizations
                    WHERE id = CAST(:org_id AS UUID)
                """),
                {"org_id": org_id}
            )
            org_row = org_result.fetchone()

            if not org_row:
                raise HTTPException(status_code=404, detail="Organization not found")

            return OrgContext(
                user=user,
                organization=Organization(
                    id=str(org_row.id),
                    name=org_row.name,
                    slug=org_row.slug,
                    plan_type=org_row.plan_type
                ),
                role="super_admin"
            )

        if not row:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this organization"
            )

        return OrgContext(
            user=user,
            organization=Organization(
                id=str(row.org_id),
                name=row.org_name,
                slug=row.org_slug,
                plan_type=row.plan_type
            ),
            role=row.role
        )


async def get_user_organizations(
    user: User = Depends(get_current_user)
) -> List[dict]:
    """
    Get all organizations the current user is a member of.

    Returns list of orgs with role info.
    """
    with get_supabase_session() as session:
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
            """),
            {"user_id": user.id}
        )

        return [
            {
                "id": str(row.id),
                "name": row.name,
                "slug": row.slug,
                "plan_type": row.plan_type,
                "role": row.role,
                "joined_at": row.joined_at.isoformat() if row.joined_at else None,
                "is_owner": row.role == "owner",
            }
            for row in result.fetchall()
        ]


# ============================================================================
# Role Requirement Decorators
# ============================================================================

def require_admin(context: OrgContext = Depends(get_org_context)) -> OrgContext:
    """Require admin or owner role."""
    if not context.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return context


def require_owner(context: OrgContext = Depends(get_org_context)) -> OrgContext:
    """Require owner role."""
    if not context.is_owner and context.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner access required"
        )
    return context


def require_write(context: OrgContext = Depends(get_org_context)) -> OrgContext:
    """Require write access (owner, admin, or engineer)."""
    if not context.can_write:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Write access required"
        )
    return context


# ============================================================================
# Header-based Org Selection (Backwards Compatibility)
# ============================================================================

async def get_org_from_header(
    x_organization_id: Optional[str] = Header(None, alias="X-Organization-ID"),
    user: User = Depends(get_current_user)
) -> Optional[OrgContext]:
    """
    Get organization context from X-Organization-ID header.

    Returns None if header not provided. Use for endpoints that
    optionally need org context.
    """
    if not x_organization_id:
        return None

    return await get_org_context(x_organization_id, user)


async def require_org_from_header(
    x_organization_id: str = Header(..., alias="X-Organization-ID"),
    user: User = Depends(get_current_user)
) -> OrgContext:
    """
    Require organization context from X-Organization-ID header.

    Raises 400 if header not provided.
    """
    if not x_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Organization-ID header required"
        )

    return await get_org_context(x_organization_id, user)


# ============================================================================
# Workspace Context (Multi-Org + Workspace Architecture)
# ============================================================================

async def get_workspace_context(
    workspace_id: str,
    user: User = Depends(get_current_user)
) -> WorkspaceContext:
    """
    Get workspace context with role verification.

    Verifies the user is a member of the workspace and returns
    their role. Raises 403 if not a member.

    Usage:
        @router.get("/workspaces/{workspace_id}/projects")
        async def get_projects(context: WorkspaceContext = Depends(get_workspace_context)):
            if not context.can_write:
                raise HTTPException(403, "Read-only access")
            return get_projects_for_workspace(context.workspace.id)
    """
    # Validate UUID format
    if not _is_valid_uuid(workspace_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid workspace ID format"
        )

    with get_supabase_session() as session:
        # Get workspace, org, and membership in one query
        result = session.execute(
            text("""
                SELECT
                    w.id as workspace_id,
                    w.name as workspace_name,
                    w.slug as workspace_slug,
                    w.is_default,
                    w.organization_id,
                    o.name as org_name,
                    o.slug as org_slug,
                    COALESCE(o.org_type, 'free') as plan_type,
                    wm.role as workspace_role
                FROM workspaces w
                JOIN organizations o ON o.id = w.organization_id
                LEFT JOIN workspace_memberships wm ON wm.workspace_id = w.id
                    AND wm.user_id = CAST(:user_id AS UUID)
                WHERE w.id = CAST(:workspace_id AS UUID)
                AND w.deleted_at IS NULL
            """),
            {"workspace_id": workspace_id, "user_id": user.id}
        )
        row = result.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )

        # Super admin bypass
        if not row.workspace_role and user.is_platform_admin:
            return WorkspaceContext(
                user=user,
                workspace=Workspace(
                    id=str(row.workspace_id),
                    organization_id=str(row.organization_id),
                    name=row.workspace_name,
                    slug=row.workspace_slug,
                    is_default=row.is_default
                ),
                organization=Organization(
                    id=str(row.organization_id),
                    name=row.org_name,
                    slug=row.org_slug,
                    plan_type=row.plan_type
                ),
                role="admin"  # Super admin gets full access
            )

        if not row.workspace_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this workspace"
            )

        return WorkspaceContext(
            user=user,
            workspace=Workspace(
                id=str(row.workspace_id),
                organization_id=str(row.organization_id),
                name=row.workspace_name,
                slug=row.workspace_slug,
                is_default=row.is_default
            ),
            organization=Organization(
                id=str(row.organization_id),
                name=row.org_name,
                slug=row.org_slug,
                plan_type=row.plan_type
            ),
            role=row.workspace_role
        )


async def get_workspace_from_header(
    x_workspace_id: Optional[str] = Header(None, alias="X-Workspace-ID"),
    user: User = Depends(get_current_user)
) -> Optional[WorkspaceContext]:
    """
    Get workspace context from X-Workspace-ID header.

    Returns None if header not provided. Use for endpoints that
    optionally need workspace context.
    """
    if not x_workspace_id:
        return None

    return await get_workspace_context(x_workspace_id, user)


async def require_workspace_from_header(
    x_workspace_id: str = Header(..., alias="X-Workspace-ID"),
    user: User = Depends(get_current_user)
) -> WorkspaceContext:
    """
    Require workspace context from X-Workspace-ID header.

    Raises 400 if header not provided.
    """
    if not x_workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Workspace-ID header required"
        )

    return await get_workspace_context(x_workspace_id, user)


# Workspace Role Requirements
def require_workspace_admin(context: WorkspaceContext = Depends(get_workspace_context)) -> WorkspaceContext:
    """Require workspace admin role."""
    if not context.is_workspace_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace admin access required"
        )
    return context


def require_workspace_engineer(context: WorkspaceContext = Depends(get_workspace_context)) -> WorkspaceContext:
    """Require workspace engineer or admin role."""
    if not context.is_engineer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Engineer access required"
        )
    return context


def require_workspace_write(context: WorkspaceContext = Depends(get_workspace_context)) -> WorkspaceContext:
    """Require workspace write access (admin or engineer)."""
    if not context.can_write:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Write access required"
        )
    return context
