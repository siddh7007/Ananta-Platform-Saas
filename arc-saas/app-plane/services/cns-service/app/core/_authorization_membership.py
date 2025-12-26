"""
CNS-Specific Membership Functions

This module contains membership lookup functions that are specific to the CNS
service and require database access. These are kept separate from the shared
auth module which is database-agnostic.

Usage:
    from app.core._authorization_membership import (
        lookup_membership, lookup_user_role, assert_membership,
        get_cached_membership, clear_membership_cache,
        build_auth_context_from_request_body,
    )
"""

import logging
import time
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

from shared.auth_billing.auth import (
    AuthContext,
    AuthContextError,
    AuthErrorCode,
    Role,
    ROLE_HIERARCHY,
    normalize_role,
    get_role_level,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Membership Caching (In-Memory)
# =============================================================================

# Cache structure: {(user_id, org_id): {"membership": dict, "expires_at": timestamp}}
_membership_cache: Dict[Tuple[str, str], Dict[str, Any]] = {}
_MEMBERSHIP_CACHE_TTL_SECONDS = 300  # 5 minutes


def get_cached_membership(user_id: str, organization_id: str) -> Optional[dict]:
    """
    Get membership from cache if valid.

    Args:
        user_id: User UUID
        organization_id: Organization UUID

    Returns:
        Cached membership dict or None if not cached/expired
    """
    cache_key = (user_id, organization_id)
    cached = _membership_cache.get(cache_key)

    if cached:
        if time.time() < cached["expires_at"]:
            logger.debug(f"[Auth] Cache HIT: membership for user={user_id} org={organization_id}")
            return cached["membership"]
        else:
            # Expired - remove from cache
            del _membership_cache[cache_key]
            logger.debug(f"[Auth] Cache EXPIRED: membership for user={user_id} org={organization_id}")

    return None


def _cache_membership(user_id: str, organization_id: str, membership: Optional[dict]) -> None:
    """Cache membership lookup result."""
    cache_key = (user_id, organization_id)
    _membership_cache[cache_key] = {
        "membership": membership,
        "expires_at": time.time() + _MEMBERSHIP_CACHE_TTL_SECONDS,
    }
    logger.debug(f"[Auth] Cache SET: membership for user={user_id} org={organization_id}")


def clear_membership_cache(user_id: Optional[str] = None, organization_id: Optional[str] = None) -> int:
    """
    Clear membership cache entries.

    Args:
        user_id: If provided, clear only entries for this user
        organization_id: If provided, clear only entries for this org

    Returns:
        Number of entries cleared
    """
    if user_id is None and organization_id is None:
        # Clear all
        count = len(_membership_cache)
        _membership_cache.clear()
        logger.info(f"[Auth] Cache CLEARED: {count} entries")
        return count

    # Clear matching entries
    keys_to_remove = []
    for key in _membership_cache:
        if user_id and key[0] == user_id:
            keys_to_remove.append(key)
        elif organization_id and key[1] == organization_id:
            keys_to_remove.append(key)

    for key in keys_to_remove:
        del _membership_cache[key]

    logger.info(f"[Auth] Cache CLEARED: {len(keys_to_remove)} entries for user={user_id} org={organization_id}")
    return len(keys_to_remove)


# =============================================================================
# Database Membership Lookup
# =============================================================================

def lookup_membership(
    db: Session,
    user_id: str,
    organization_id: str,
    use_cache: bool = True
) -> Optional[dict]:
    """
    Look up a user's membership in an organization.

    Args:
        db: Database session
        user_id: User UUID
        organization_id: Organization UUID
        use_cache: If True, check cache first (default: True)

    Returns:
        Membership dict with 'role' key, or None if not found
    """
    # Check cache first
    if use_cache:
        cached = get_cached_membership(user_id, organization_id)
        if cached is not None:
            return cached

    try:
        result = db.execute(
            text("""
                SELECT role, created_at
                FROM organization_memberships
                WHERE user_id = :user_id
                AND organization_id = :org_id
            """),
            {"user_id": user_id, "org_id": organization_id}
        ).mappings().first()

        membership = None
        if result:
            logger.debug(
                f"[Auth] Membership found: user={user_id} org={organization_id} "
                f"role={result.get('role')}"
            )
            membership = dict(result)
        else:
            logger.debug(
                f"[Auth] No membership found: user={user_id} org={organization_id}"
            )

        # Cache the result (even None, to avoid repeated lookups)
        if use_cache:
            _cache_membership(user_id, organization_id, membership)

        return membership

    except Exception as e:
        logger.error(
            f"[Auth] Membership lookup failed: user={user_id} org={organization_id} "
            f"error={str(e)}",
            exc_info=True
        )
        return None


def lookup_user_role(db: Session, user_id: str) -> Optional[str]:
    """
    Look up a user's global/platform role (e.g., super_admin).

    This checks the users table for platform-wide roles, separate from
    organization-specific membership roles.

    Args:
        db: Database session
        user_id: User UUID

    Returns:
        Role string or None if user not found
    """
    try:
        result = db.execute(
            text("""
                SELECT role FROM users WHERE id = :user_id
            """),
            {"user_id": user_id}
        ).mappings().first()

        if result:
            return result.get("role")
        return None

    except Exception as e:
        logger.error(
            f"[Auth] User role lookup failed: user={user_id} error={str(e)}",
            exc_info=True
        )
        return None


def assert_membership(
    db: Session,
    user_id: str,
    organization_id: str,
    require_admin: bool = False
) -> dict:
    """
    Assert that a user has membership in an organization.

    This is a more strict version of lookup_membership that raises
    an exception if the membership is not found.

    IMPORTANT: Super admins bypass membership check - they can access any org.

    Args:
        db: Database session
        user_id: User UUID
        organization_id: Organization UUID
        require_admin: If True, also verify admin/super_admin role

    Returns:
        Membership dict (or synthetic dict for super_admin)

    Raises:
        AuthContextError: If membership not found or role insufficient
    """
    from fastapi import status

    if not user_id:
        logger.error("[Auth] assert_membership called without user_id")
        raise AuthContextError(
            error_code=AuthErrorCode.MISSING_USER_ID,
            detail="User ID is required",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    if not organization_id:
        logger.error("[Auth] assert_membership called without organization_id")
        raise AuthContextError(
            error_code=AuthErrorCode.MISSING_ORG_ID,
            detail="Organization ID is required",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # CRITICAL FIX: Check for super_admin FIRST (before membership lookup)
    # Super admins can access any organization without membership
    user_global_role = lookup_user_role(db, user_id)
    if user_global_role:
        normalized_global_role = normalize_role(user_global_role)
        if normalized_global_role == Role.SUPER_ADMIN.value:
            logger.info(
                f"[Auth] Super admin BYPASS: user={user_id} can access org={organization_id} "
                f"(original role: {user_global_role})"
            )
            # Return synthetic membership for super_admin
            return {
                "role": Role.SUPER_ADMIN.value,
                "user_id": user_id,
                "organization_id": organization_id,
                "is_super_admin_override": True,
            }

    membership = lookup_membership(db, user_id, organization_id)

    if not membership:
        logger.warning(
            f"[Auth] DENIED: No membership for user={user_id} in org={organization_id}"
        )
        raise AuthContextError(
            error_code=AuthErrorCode.MEMBERSHIP_NOT_FOUND,
            detail="Not authorized for this organization",
            status_code=status.HTTP_403_FORBIDDEN,
            user_id=user_id,
            organization_id=organization_id,
        )

    if require_admin:
        # Normalize role for backwards compatibility
        role_level = get_role_level(membership.get("role"))
        admin_level = ROLE_HIERARCHY[Role.ADMIN]

        if role_level < admin_level:
            logger.warning(
                f"[Auth] DENIED: user={user_id} role={membership.get('role')} (level {role_level}) "
                f"requires admin (level {admin_level}) for org={organization_id}"
            )
            raise AuthContextError(
                error_code=AuthErrorCode.ROLE_INSUFFICIENT,
                detail="Admin permission required for this operation",
                status_code=status.HTTP_403_FORBIDDEN,
                user_id=user_id,
                organization_id=organization_id,
            )

    logger.info(
        f"[Auth] Membership VERIFIED: user={user_id} org={organization_id} "
        f"role={membership.get('role')}"
    )

    return membership


# =============================================================================
# Utility Functions
# =============================================================================

def build_auth_context_from_request_body(
    actor_id: Optional[str],
    actor_email: Optional[str] = None,
    actor_name: Optional[str] = None,
    organization_id: Optional[str] = None,
    db: Optional[Session] = None
) -> AuthContext:
    """
    Build an AuthContext from request body parameters.

    This is useful for endpoints that receive actor information in the
    request body rather than from JWT/session.

    Args:
        actor_id: User ID from request
        actor_email: User email from request
        actor_name: User name from request
        organization_id: Organization ID from request
        db: Database session for role lookup

    Returns:
        AuthContext instance
    """
    from fastapi import status

    if not actor_id:
        raise AuthContextError(
            error_code=AuthErrorCode.MISSING_USER_ID,
            detail="actor_id is required",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    role = Role.ANALYST.value

    # Look up role if db and org_id provided
    if db and organization_id:
        membership = lookup_membership(db, actor_id, organization_id)
        if membership:
            role = membership.get("role", Role.ANALYST.value)

    return AuthContext(
        user_id=actor_id,
        organization_id=organization_id or "",
        role=role,
        email=actor_email,
        username=actor_name,
        auth_provider="request_body",
    )
