/**
 * Permission Hook
 *
 * Provides role-based access control checks for the current authenticated user.
 * Integrates with AuthContext to extract user role and provides convenient
 * permission checking methods.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { can, isAtLeast, role } = usePermissions();
 *
 *   if (!can('bom:create')) {
 *     return <div>You don't have permission to create BOMs</div>;
 *   }
 *
 *   return (
 *     <div>
 *       {isAtLeast('admin') && <AdminPanel />}
 *       <p>Your role: {role}</p>
 *     </div>
 *   );
 * }
 * ```
 */

import { useAuth } from '@/contexts/AuthContext';
import {
  type AppRole,
  type Permission,
  hasPermission,
  hasMinimumRole,
  getPermissionsForRole,
  getRoleLabel,
  getRoleDescription,
} from '@/lib/permissions';

/**
 * Permission hook return type
 */
export interface UsePermissionsResult {
  /**
   * Current user's role (defaults to 'analyst' if not authenticated)
   */
  role: AppRole;

  /**
   * Human-readable role label (e.g., 'Super Admin')
   */
  roleLabel: string;

  /**
   * Role description
   */
  roleDescription: string;

  /**
   * Check if user has a specific permission
   * @param permission - Permission to check (e.g., 'bom:create')
   * @returns true if user has the permission
   */
  hasPermission: (permission: Permission) => boolean;

  /**
   * Check if user meets minimum role requirement
   * @param requiredRole - Minimum role required
   * @returns true if user role >= required role
   */
  hasMinimumRole: (requiredRole: AppRole) => boolean;

  /**
   * Alias for hasPermission - more readable in components
   * @param permission - Permission to check
   * @returns true if user can perform the action
   */
  can: (permission: Permission) => boolean;

  /**
   * Check if user has exact role match
   * @param role - Role to check
   * @returns true if user's role exactly matches
   */
  is: (role: AppRole) => boolean;

  /**
   * Alias for hasMinimumRole - more readable in components
   * @param role - Minimum role required
   * @returns true if user is at least this role level
   */
  isAtLeast: (role: AppRole) => boolean;

  /**
   * Get all permissions available to the current user
   * @returns Array of permissions
   */
  permissions: Permission[];

  /**
   * Check if user is authenticated
   */
  isAuthenticated: boolean;
}

/**
 * Hook for role-based permission checks
 *
 * Integrates with AuthContext to provide convenient permission checking
 * methods based on the current user's role.
 *
 * @returns Permission checking utilities
 *
 * @example
 * ```tsx
 * const { can, isAtLeast, role } = usePermissions();
 *
 * // Check specific permission
 * if (can('bom:create')) {
 *   // Show create button
 * }
 *
 * // Check minimum role
 * if (isAtLeast('admin')) {
 *   // Show admin features
 * }
 *
 * // Check exact role
 * if (is('owner')) {
 *   // Show billing section
 * }
 * ```
 */
export function usePermissions(): UsePermissionsResult {
  const { user, isAuthenticated } = useAuth();

  // Default to 'analyst' (lowest privilege) if not authenticated or role not set
  const role: AppRole = user?.role || 'analyst';

  const permissions = getPermissionsForRole(role);
  const roleLabel = getRoleLabel(role);
  const roleDescription = getRoleDescription(role);

  return {
    role,
    roleLabel,
    roleDescription,
    hasPermission: (permission: Permission) => hasPermission(role, permission),
    hasMinimumRole: (requiredRole: AppRole) => hasMinimumRole(role, requiredRole),
    can: (permission: Permission) => hasPermission(role, permission),
    is: (checkRole: AppRole) => role === checkRole,
    isAtLeast: (requiredRole: AppRole) => hasMinimumRole(role, requiredRole),
    permissions,
    isAuthenticated,
  };
}
