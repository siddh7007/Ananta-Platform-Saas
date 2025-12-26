/**
 * Role-Based Access Control (RBAC) System
 *
 * Defines the 5-level role hierarchy and permission mappings for the CBP customer portal.
 * Aligned with admin-app and control plane role hierarchy.
 *
 * Role Hierarchy (Level 1-5):
 * - analyst (1): Read-only access to BOMs, components, reports
 * - engineer (2): Can create/edit BOMs, manage components
 * - admin (3): Organization management, user administration
 * - owner (4): Organization owner - billing, subscription management
 * - super_admin (5): Platform-wide access (Ananta staff only)
 */

/**
 * Application role types - aligned with CBP/CNS role hierarchy
 */
export type AppRole = 'super_admin' | 'owner' | 'admin' | 'engineer' | 'analyst';

/**
 * Role hierarchy mapping - higher number = higher privilege
 * Used for role comparison and minimum role checks
 */
export const ROLE_HIERARCHY: Record<AppRole, number> = {
  super_admin: 5, // Platform staff - highest privilege
  owner: 4, // Org owner - billing, subscription, delete org
  admin: 3, // Org admin - user management, settings
  engineer: 2, // Technical user - create/edit BOMs, manage components
  analyst: 1, // Read-only user - lowest privilege
};

/**
 * Permission types for fine-grained access control
 * Format: resource:action
 */
export type Permission =
  // BOM operations
  | 'bom:create'
  | 'bom:read'
  | 'bom:update'
  | 'bom:delete'
  | 'bom:export'
  | 'bom:import'
  | 'bom:share'
  // Component operations
  | 'component:search'
  | 'component:compare'
  | 'component:export'
  | 'component:view_pricing'
  // Team management
  | 'team:view'
  | 'team:invite'
  | 'team:manage'
  | 'team:remove'
  // Billing and subscription
  | 'billing:view'
  | 'billing:manage'
  | 'subscription:view'
  | 'subscription:manage'
  // Organization settings
  | 'settings:view'
  | 'settings:manage'
  | 'settings:api_keys'
  | 'settings:integrations'
  // Admin operations
  | 'admin:access'
  | 'admin:audit_logs'
  | 'admin:platform_settings';

/**
 * Map permissions to minimum role required
 * Defines the lowest role level that can perform each permission
 */
export const PERMISSION_ROLES: Record<Permission, AppRole> = {
  // BOM operations - engineers can create/edit, analysts can read
  'bom:create': 'engineer',
  'bom:read': 'analyst',
  'bom:update': 'engineer',
  'bom:delete': 'admin',
  'bom:export': 'analyst',
  'bom:import': 'engineer',
  'bom:share': 'engineer',

  // Component operations - all users can search/view
  'component:search': 'analyst',
  'component:compare': 'analyst',
  'component:export': 'analyst',
  'component:view_pricing': 'analyst',

  // Team management - admin required for invites/management
  'team:view': 'analyst',
  'team:invite': 'admin',
  'team:manage': 'admin',
  'team:remove': 'admin',

  // Billing - owner only
  'billing:view': 'owner',
  'billing:manage': 'owner',
  'subscription:view': 'owner',
  'subscription:manage': 'owner',

  // Settings - engineers can view, admins can manage
  'settings:view': 'engineer',
  'settings:manage': 'admin',
  'settings:api_keys': 'admin',
  'settings:integrations': 'admin',

  // Admin operations - super_admin only
  'admin:access': 'super_admin',
  'admin:audit_logs': 'super_admin',
  'admin:platform_settings': 'super_admin',
};

/**
 * Check if user role meets minimum role requirement
 * Uses role hierarchy to determine if userRole >= requiredRole
 *
 * @param userRole - Current user's role
 * @param requiredRole - Minimum role required
 * @returns true if user has sufficient privileges
 *
 * @example
 * hasMinimumRole('admin', 'engineer') // true - admin > engineer
 * hasMinimumRole('analyst', 'admin') // false - analyst < admin
 * hasMinimumRole('engineer', 'engineer') // true - equal
 */
export function hasMinimumRole(userRole: AppRole, requiredRole: AppRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if user has specific permission
 * Determines if user's role level is sufficient for the requested permission
 *
 * @param userRole - Current user's role
 * @param permission - Permission to check
 * @returns true if user has the permission
 *
 * @example
 * hasPermission('engineer', 'bom:create') // true
 * hasPermission('analyst', 'bom:delete') // false
 */
export function hasPermission(userRole: AppRole, permission: Permission): boolean {
  const requiredRole = PERMISSION_ROLES[permission];
  if (!requiredRole) {
    console.warn(`[Permissions] Unknown permission: ${permission}`);
    return false;
  }
  return hasMinimumRole(userRole, requiredRole);
}

/**
 * Get all permissions available for a given role
 * Returns array of permissions that the role can perform
 *
 * @param role - Role to get permissions for
 * @returns Array of permissions available to the role
 *
 * @example
 * getPermissionsForRole('analyst')
 * // Returns: ['bom:read', 'bom:export', 'component:search', ...]
 */
export function getPermissionsForRole(role: AppRole): Permission[] {
  return (Object.keys(PERMISSION_ROLES) as Permission[]).filter((permission) =>
    hasPermission(role, permission)
  );
}

/**
 * Convenience role check functions
 * Type-safe shortcuts for common role checks
 */

/**
 * Check if user is a super admin (exact match - highest privilege)
 */
export function isSuperAdmin(role: AppRole): boolean {
  return role === 'super_admin';
}

/**
 * Check if user is at least an owner (owner or super_admin)
 */
export function isOwner(role: AppRole): boolean {
  return hasMinimumRole(role, 'owner');
}

/**
 * Check if user is at least an admin (admin, owner, or super_admin)
 */
export function isAdmin(role: AppRole): boolean {
  return hasMinimumRole(role, 'admin');
}

/**
 * Check if user is at least an engineer (engineer, admin, owner, or super_admin)
 */
export function isEngineer(role: AppRole): boolean {
  return hasMinimumRole(role, 'engineer');
}

/**
 * Check if user is at least an analyst (all authenticated users)
 */
export function isAnalyst(role: AppRole): boolean {
  return hasMinimumRole(role, 'analyst');
}

/**
 * Get human-readable role label
 *
 * @param role - Role to get label for
 * @returns Formatted role label
 */
export function getRoleLabel(role: AppRole): string {
  const labels: Record<AppRole, string> = {
    super_admin: 'Super Admin',
    owner: 'Owner',
    admin: 'Admin',
    engineer: 'Engineer',
    analyst: 'Analyst',
  };
  return labels[role];
}

/**
 * Get role description
 *
 * @param role - Role to get description for
 * @returns Role description
 */
export function getRoleDescription(role: AppRole): string {
  const descriptions: Record<AppRole, string> = {
    super_admin: 'Platform-wide access across all organizations',
    owner: 'Organization owner with billing and subscription management',
    admin: 'Organization administrator with user management',
    engineer: 'Technical user with BOM and component management',
    analyst: 'Read-only access to BOMs and components',
  };
  return descriptions[role];
}
