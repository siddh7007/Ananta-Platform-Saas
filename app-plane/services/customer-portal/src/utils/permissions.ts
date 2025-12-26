/**
 * Role-Based Access Control Utilities
 *
 * Provides helper functions for checking user permissions based on
 * the 5-level role hierarchy (matches backend roles.py):
 *
 * super_admin (5) > owner (4) > admin (3) > engineer (2) > analyst (1)
 *
 * Legacy role mappings:
 * - 'member' → 'analyst'
 * - 'viewer' → 'analyst'
 * - 'developer' → 'engineer'
 * - 'user' → 'analyst'
 */

// Current valid roles (5-level hierarchy)
export type UserRole = 'super_admin' | 'owner' | 'admin' | 'engineer' | 'analyst';

// Legacy roles that get normalized
type LegacyRole = 'member' | 'viewer' | 'developer' | 'user' | 'platform_admin' | 'org_admin';

// Union type for any role that might come in
type AnyRole = UserRole | LegacyRole;

/**
 * Role hierarchy map for comparison (matches backend ROLE_HIERARCHY)
 */
const ROLE_LEVELS: Record<UserRole, number> = {
  analyst: 1,      // Read-only + reports (lowest customer role)
  engineer: 2,     // Can manage BOMs, components
  admin: 3,        // Org management (Enterprise only)
  owner: 4,        // Org owner - billing, delete org
  super_admin: 5,  // Platform-wide access (Ananta staff only)
};

/**
 * Legacy role mappings (matches backend LEGACY_ROLE_MAPPINGS)
 */
const LEGACY_ROLE_MAPPINGS: Record<string, UserRole> = {
  // Deprecated roles → analyst (lowest level)
  user: 'analyst',
  platform_user: 'analyst',
  member: 'analyst',       // REMOVED: member → analyst
  viewer: 'analyst',       // REMOVED: viewer → analyst
  developer: 'engineer',   // REMOVED: developer → engineer
  // Platform admin → super_admin
  platform_admin: 'super_admin',
  // Org admin aliases
  org_admin: 'admin',
};

/**
 * Normalize a role string to ensure backwards compatibility.
 *
 * This mirrors the backend's normalize_role() function.
 *
 * @param role - Role string (may be legacy or current)
 * @returns Normalized role (one of the current valid roles)
 */
export const normalizeRole = (role: string | null | undefined): UserRole => {
  if (!role) {
    return 'analyst';
  }

  const roleLower = role.toLowerCase().trim();

  // Check if it's already a valid current role
  if (roleLower in ROLE_LEVELS) {
    return roleLower as UserRole;
  }

  // Check legacy mappings
  if (roleLower in LEGACY_ROLE_MAPPINGS) {
    const normalized = LEGACY_ROLE_MAPPINGS[roleLower];
    console.debug(`[Permissions] Role normalized: '${role}' → '${normalized}'`);
    return normalized;
  }

  // Unknown role - default to analyst
  console.warn(
    `[Permissions] Unknown role '${role}' encountered - defaulting to 'analyst'. ` +
    `Consider adding to LEGACY_ROLE_MAPPINGS if this is a valid legacy role.`
  );
  return 'analyst';
};

/**
 * Get the privilege level for a role
 *
 * @param role - Role string (may be legacy or current)
 * @returns Integer privilege level (1-5), or 0 for invalid/null roles
 */
export const getRoleLevel = (role: string | null | undefined): number => {
  if (!role) {
    return 0;
  }
  const normalized = normalizeRole(role);
  return ROLE_LEVELS[normalized] || 0;
};

/**
 * Check if user has minimum required role level
 *
 * @param userRole - Current user's role (may be legacy)
 * @param requiredRole - Minimum required role
 * @returns true if user has sufficient permissions
 */
export const hasMinimumRole = (userRole: string, requiredRole: UserRole): boolean => {
  return getRoleLevel(userRole) >= ROLE_LEVELS[requiredRole];
};

/**
 * Check if user can delete a resource
 *
 * Permission Rules:
 * - super_admin/owner/admin: Can delete any resource in their organization
 * - engineer: Can delete only resources they created
 * - analyst: Cannot delete anything
 *
 * @param userRole - Current user's role (may be legacy)
 * @param resourceOwnerId - ID of the user who created the resource (optional)
 * @param currentUserId - Current user's ID (optional)
 * @returns true if user can delete the resource
 */
export const canDelete = (
  userRole: string,
  resourceOwnerId?: string,
  currentUserId?: string
): boolean => {
  const normalized = normalizeRole(userRole);

  // Analysts cannot delete anything
  if (normalized === 'analyst') {
    return false;
  }

  // super_admin, owners and admins can delete anything in their org
  if (normalized === 'super_admin' || normalized === 'owner' || normalized === 'admin') {
    return true;
  }

  // Engineers can delete only their own resources
  if (normalized === 'engineer') {
    return !!(resourceOwnerId && currentUserId && resourceOwnerId === currentUserId);
  }

  return false;
};

/**
 * Check if user can edit a resource
 *
 * Permission Rules:
 * - super_admin/owner/admin: Can edit any resource in their organization
 * - engineer: Can edit only resources they created
 * - analyst: Cannot edit anything
 *
 * @param userRole - Current user's role (may be legacy)
 * @param resourceOwnerId - ID of the user who created the resource (optional)
 * @param currentUserId - Current user's ID (optional)
 * @returns true if user can edit the resource
 */
export const canEdit = (
  userRole: string,
  resourceOwnerId?: string,
  currentUserId?: string
): boolean => {
  // Same rules as delete
  return canDelete(userRole, resourceOwnerId, currentUserId);
};

/**
 * Check if user can manage organization (delete org, manage members)
 *
 * Permission Rules:
 * - super_admin: Full platform-wide access
 * - owner: Full organization management
 * - admin: Can manage members but not delete org
 * - engineer/analyst: No org management
 *
 * @param userRole - Current user's role (may be legacy)
 * @param action - Specific action ('delete' | 'manage_members')
 * @returns true if user can perform the action
 */
export const canManageOrganization = (
  userRole: string,
  action: 'delete' | 'manage_members'
): boolean => {
  const normalized = normalizeRole(userRole);

  if (action === 'delete') {
    // Only owners and super_admins can delete organizations
    return normalized === 'owner' || normalized === 'super_admin';
  }

  if (action === 'manage_members') {
    // Owners, admins, and super_admins can manage members
    return normalized === 'owner' || normalized === 'admin' || normalized === 'super_admin';
  }

  return false;
};

/**
 * Check if user is an admin (owner, admin, or super_admin role)
 *
 * @param userRole - Current user's role (may be legacy)
 * @returns true if user is owner, admin, or super_admin
 */
export const isAdmin = (userRole: string): boolean => {
  const normalized = normalizeRole(userRole);
  return normalized === 'owner' || normalized === 'admin' || normalized === 'super_admin';
};

/**
 * Check if user is a super admin (platform-wide access)
 *
 * @param userRole - Current user's role (may be legacy)
 * @returns true if user is super_admin
 */
export const isSuperAdmin = (userRole: string): boolean => {
  return normalizeRole(userRole) === 'super_admin';
};

/**
 * Get user's role from organization membership
 * Helper to extract role from Supabase query result
 *
 * @param memberships - Array of organization memberships
 * @param organizationId - Target organization ID
 * @returns User's normalized role in the organization or null
 */
export const getUserRoleInOrganization = (
  memberships: Array<{ organization_id: string; role: string }>,
  organizationId: string
): UserRole | null => {
  const membership = memberships.find(m => m.organization_id === organizationId);
  if (!membership?.role) {
    return null;
  }
  return normalizeRole(membership.role);
};

/**
 * Permission Matrix for Quick Reference:
 *
 * Resource        | super_admin | owner | admin | engineer | analyst
 * ----------------|-------------|-------|-------|----------|--------
 * Delete BOM      | ✓           | ✓     | ✓     | Own      | ✗
 * Edit BOM        | ✓           | ✓     | ✓     | Own      | ✗
 * Delete Project  | ✓           | ✓     | ✓     | Own      | ✗
 * Edit Project    | ✓           | ✓     | ✓     | Own      | ✗
 * Delete User     | ✓           | ✓     | ✓     | ✗        | ✗
 * Delete Org      | ✓           | ✓     | ✗     | ✗        | ✗
 * Manage Members  | ✓           | ✓     | ✓     | ✗        | ✗
 * View Resources  | ✓           | ✓     | ✓     | ✓        | ✓
 */
