"""
Role Definitions and Hierarchy

This module defines the role system used across the platform:
- Role enum with privilege levels
- Role hierarchy for comparison
- Legacy role mappings for backwards compatibility
- Helper functions for role normalization and comparison
"""

import logging
from enum import Enum
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class Role(str, Enum):
    """
    User roles in order of privilege (lowest to highest).

    Role hierarchy (privilege levels 1-5):
    - analyst (1): Read-only access + reports (lowest level for customers)
    - engineer (2): Can manage BOMs, components, specifications
    - admin (3): Organization management, user administration (Enterprise only)
    - owner (4): Organization owner - billing, delete org (created the org)
    - super_admin (5): Platform-wide access across all organizations (Ananta staff)

    Note: 'member' role was removed - use 'analyst' for basic access.
    Note: 'viewer' and 'developer' roles were deprecated and mapped to analyst.
    """

    ANALYST = "analyst"
    ENGINEER = "engineer"
    ADMIN = "admin"
    ORG_ADMIN = "org_admin"  # Same level as admin (backwards compatibility)
    OWNER = "owner"  # Organization owner (created the org, billing owner)
    SUPER_ADMIN = "super_admin"


# Role hierarchy for comparison (higher number = more privileges)
# Simplified hierarchy: analyst < engineer < admin/owner < super_admin
ROLE_HIERARCHY: Dict[Role, int] = {
    Role.ANALYST: 1,      # Read-only + reports (lowest customer role)
    Role.ENGINEER: 2,     # Can manage BOMs, components
    Role.ADMIN: 3,        # Org management (Enterprise only)
    Role.ORG_ADMIN: 3,    # Same level as admin (backwards compatibility)
    Role.OWNER: 4,        # Org owner - higher than admin (billing, delete org)
    Role.SUPER_ADMIN: 5,  # Platform-wide access (Ananta staff only)
}


# Maps old/legacy role names to current role values
# This ensures code doesn't break when encountering unmigrated data
LEGACY_ROLE_MAPPINGS: Dict[str, str] = {
    # Deprecated roles → analyst (lowest level)
    "user": Role.ANALYST.value,           # Generic user → analyst
    "platform_user": Role.ANALYST.value,  # Platform user → analyst
    "member": Role.ANALYST.value,         # REMOVED: member → analyst
    "viewer": Role.ANALYST.value,         # REMOVED: viewer → analyst
    "developer": Role.ENGINEER.value,     # REMOVED: developer → engineer
    # Platform admin → super_admin
    "platform_admin": Role.SUPER_ADMIN.value,
    # Current valid roles (keep as-is)
    "org_admin": Role.ORG_ADMIN.value,
    "admin": Role.ADMIN.value,
    "owner": Role.OWNER.value,
    "analyst": Role.ANALYST.value,
    "engineer": Role.ENGINEER.value,
    "super_admin": Role.SUPER_ADMIN.value,
}


def normalize_role(role: Optional[str]) -> str:
    """
    Normalize a role string to ensure backwards compatibility.

    This function handles legacy role names that may exist in:
    - JWT tokens issued before migration
    - Database rows not yet migrated
    - External systems using old role names

    Args:
        role: The role string to normalize (may be legacy or current)

    Returns:
        Normalized role string (one of the current valid roles)

    Examples:
        normalize_role("user") → "analyst"
        normalize_role("member") → "analyst" (member role removed)
        normalize_role("platform_admin") → "super_admin"
        normalize_role("admin") → "admin" (no change)
        normalize_role(None) → "analyst" (default)
        normalize_role("invalid") → "analyst" (default for unknown)
    """
    if not role:
        return Role.ANALYST.value

    role_lower = role.lower().strip()

    # Check legacy mappings first
    if role_lower in LEGACY_ROLE_MAPPINGS:
        normalized = LEGACY_ROLE_MAPPINGS[role_lower]
        if normalized != role_lower:
            logger.debug(f"[Auth] Role normalized: '{role}' → '{normalized}'")
        return normalized

    # Unknown role - default to analyst and log warning
    logger.warning(
        f"[Auth] Unknown role '{role}' encountered - defaulting to 'analyst'. "
        f"Consider adding to LEGACY_ROLE_MAPPINGS if this is a valid legacy role."
    )
    return Role.ANALYST.value


def get_role_level(role: Optional[str]) -> int:
    """
    Get the privilege level for a role (with backwards compatibility).

    Args:
        role: Role string (may be legacy or current)

    Returns:
        Integer privilege level (1-7), or 0 for invalid/None roles
    """
    if not role:
        return 0

    normalized = normalize_role(role)

    # Find the Role enum and get its hierarchy level
    try:
        role_enum = Role(normalized)
        return ROLE_HIERARCHY.get(role_enum, 0)
    except ValueError:
        return 0
