"""
Authentication Context

This module defines the AuthContext dataclass that holds all information
needed for authorization decisions throughout the request lifecycle.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional, Union

from shared.auth_billing.auth.roles import (
    Role,
    ROLE_HIERARCHY,
    normalize_role,
    get_role_level,
)

logger = logging.getLogger(__name__)


@dataclass
class AuthContext:
    """
    Authorization context extracted from request.

    This dataclass holds all information needed for authorization decisions.
    It is populated by the auth middleware and passed to endpoints via FastAPI's
    dependency injection.

    Attributes:
        user_id: UUID of the authenticated user
        organization_id: UUID of user's primary organization
        role: User's role within the organization
        email: User's email (for audit logging)
        username: User's display name (for audit logging)
        auth_provider: Source of authentication (supabase, auth0, etc.)
        extra: Additional claims from the auth token
    """

    user_id: str
    organization_id: str
    role: str = Role.ANALYST.value
    email: Optional[str] = None
    username: Optional[str] = None
    auth_provider: str = "unknown"
    extra: dict = field(default_factory=dict)

    @property
    def normalized_role(self) -> str:
        """
        Get the normalized role string (handles legacy role names).

        This property ensures backwards compatibility by mapping old role names
        to current ones. Use this instead of self.role for comparisons.
        """
        return normalize_role(self.role)

    @property
    def role_level(self) -> int:
        """Get the privilege level (1-5) for this user's role."""
        return get_role_level(self.role)

    @property
    def is_super_admin(self) -> bool:
        """Check if user has super_admin role (platform-wide access)."""
        return self.normalized_role == Role.SUPER_ADMIN.value

    @property
    def is_owner(self) -> bool:
        """Check if user has owner or higher role (org owner, billing access)."""
        return self.role_level >= ROLE_HIERARCHY[Role.OWNER]

    @property
    def is_admin(self) -> bool:
        """Check if user has admin or higher role (org management)."""
        return self.role_level >= ROLE_HIERARCHY[Role.ADMIN]

    @property
    def is_engineer(self) -> bool:
        """Check if user has engineer or higher role (can manage BOMs)."""
        return self.role_level >= ROLE_HIERARCHY[Role.ENGINEER]

    @property
    def is_analyst(self) -> bool:
        """Check if user has at least analyst role (lowest customer role)."""
        return self.role_level >= ROLE_HIERARCHY[Role.ANALYST]

    # Backwards compatibility aliases
    @property
    def is_member(self) -> bool:
        """DEPRECATED: Use is_analyst instead. Returns True if user has analyst+ role."""
        return self.is_analyst

    @property
    def is_viewer(self) -> bool:
        """DEPRECATED: Use is_analyst instead. Returns True if user has analyst+ role."""
        return self.is_analyst

    @property
    def is_developer(self) -> bool:
        """DEPRECATED: Use is_engineer instead. Returns True if user has engineer+ role."""
        return self.is_engineer

    def has_role(self, required_role: Union[str, Role]) -> bool:
        """
        Check if user has at least the required role level.

        This method handles backwards compatibility by normalizing both
        the user's role and the required role before comparison.

        Args:
            required_role: Minimum role required (can be legacy or current role name)

        Returns:
            True if user's role >= required_role in hierarchy
        """
        # Get required role level (handles legacy role names)
        if isinstance(required_role, Role):
            required_level = ROLE_HIERARCHY.get(required_role, 0)
        else:
            required_level = get_role_level(required_role)

        # If required_role is invalid/unknown, deny access
        if required_level == 0:
            logger.warning(
                f"[Auth] Invalid required_role: '{required_role}' - "
                f"defaulting to deny access"
            )
            return False

        # Compare levels (user's role is normalized via role_level property)
        return self.role_level >= required_level

    def can_access_organization(self, target_org_id: str) -> bool:
        """
        Check if user can access data in the target organization.

        Super admins can access any organization.
        Regular users can only access their own organization.

        Args:
            target_org_id: Organization ID being accessed

        Returns:
            True if access is allowed
        """
        if self.is_super_admin:
            logger.debug(
                f"[Auth] Super admin access granted: user={self.user_id} "
                f"target_org={target_org_id}"
            )
            return True

        allowed = self.organization_id == target_org_id

        if not allowed:
            logger.warning(
                f"[Auth] Organization mismatch: user={self.user_id} "
                f"user_org={self.organization_id} target_org={target_org_id}"
            )

        return allowed

    def to_audit_dict(self) -> dict:
        """Return dict suitable for audit logging."""
        return {
            "user_id": self.user_id,
            "organization_id": self.organization_id,
            "role": self.role,
            "email": self.email,
            "username": self.username,
            "auth_provider": self.auth_provider,
        }
