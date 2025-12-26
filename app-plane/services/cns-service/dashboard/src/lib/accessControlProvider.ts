/**
 * Access Control Provider for React Admin
 *
 * Implements role-based access control (RBAC) for CNS Dashboard.
 * Integrates with Keycloak authentication and role hierarchy.
 *
 * Resource Access Levels:
 * - analytics: analyst (all authenticated users)
 * - bom-list: analyst (all authenticated users)
 * - bom-upload: engineer (technical users)
 * - component-search: analyst (all authenticated users)
 * - enrichment-monitor: engineer (technical users)
 * - quality-queue: engineer (staff only)
 * - supplier-apis: admin (admin and above)
 * - rate-limiting: admin (admin and above)
 * - system-health: admin (admin and above)
 * - audit-logs: admin (admin and above)
 * - settings: admin (admin and above)
 */

import { AccessControlProvider } from 'react-admin';
import { getHighestRole, hasMinimumRole, parseRolesFromToken, AppRole } from './role-parser';
import { getKeycloak } from './keycloak/keycloakConfig';

/**
 * Resource access configuration
 * Maps resource names to minimum required role
 */
const RESOURCE_ACCESS: Record<string, AppRole> = {
  // Analytics - all users
  'analytics': 'analyst',
  'dashboard': 'analyst',

  // BOM operations
  'bom-list': 'analyst', // View BOMs
  'bom-upload': 'engineer', // Upload BOMs
  'bom-edit': 'engineer', // Edit BOMs
  'bom-delete': 'admin', // Delete BOMs

  // Component operations
  'component-search': 'analyst', // Search components
  'component-catalog': 'engineer', // Manage catalog

  // Enrichment operations
  'enrichment-monitor': 'engineer', // Monitor enrichment
  'enrichment-config': 'admin', // Configure enrichment

  // Quality operations
  'quality-queue': 'engineer', // Quality review queue (staff only)
  'quality-approve': 'engineer', // Approve quality items

  // Supplier operations
  'supplier-apis': 'admin', // Manage supplier APIs
  'supplier-tokens': 'admin', // Manage API tokens

  // System operations
  'rate-limiting': 'admin', // Rate limit configuration
  'system-health': 'admin', // System health monitoring
  'audit-logs': 'admin', // Audit log access
  'settings': 'admin', // System settings

  // User management
  'users': 'admin', // User management
  'roles': 'owner', // Role management
  'organizations': 'owner', // Organization management
};

/**
 * Action-specific access rules
 * Maps actions to minimum required role (overrides resource defaults)
 */
const ACTION_ACCESS: Record<string, Partial<Record<string, AppRole>>> = {
  'bom-list': {
    'list': 'analyst',
    'show': 'analyst',
    'create': 'engineer',
    'edit': 'engineer',
    'delete': 'admin',
  },
  'component-catalog': {
    'list': 'analyst',
    'show': 'analyst',
    'create': 'engineer',
    'edit': 'engineer',
    'delete': 'admin',
  },
  'enrichment-monitor': {
    'list': 'analyst', // View enrichment status
    'show': 'analyst',
    'create': 'engineer', // Trigger enrichment
    'edit': 'engineer',
    'delete': 'admin',
  },
};

/**
 * Get current user's role from Keycloak token
 *
 * @returns User's highest role or 'analyst' as fallback
 */
function getCurrentUserRole(): AppRole {
  try {
    const keycloak = getKeycloak();
    const token = keycloak.tokenParsed;

    if (!token) {
      console.warn('[AccessControl] No token found, defaulting to analyst');
      return 'analyst';
    }

    const roles = parseRolesFromToken(token);
    if (roles.length === 0) {
      console.warn('[AccessControl] No roles found in token, defaulting to analyst');
      return 'analyst';
    }

    const highestRole = getHighestRole(roles);
    console.log('[AccessControl] User role:', highestRole, 'from roles:', roles);
    return highestRole;
  } catch (error) {
    console.error('[AccessControl] Error getting user role:', error);
    return 'analyst'; // Fail-safe to lowest privilege
  }
}

/**
 * Check if user can access a resource/action combination
 *
 * @param resource - Resource name
 * @param action - Action name (list, show, create, edit, delete, etc.)
 * @returns true if user has access, false otherwise
 */
function checkAccess(resource: string, action?: string): boolean {
  const userRole = getCurrentUserRole();

  // Check action-specific access first
  if (action && ACTION_ACCESS[resource]?.[action]) {
    const requiredRole = ACTION_ACCESS[resource][action]!;
    return hasMinimumRole(userRole, requiredRole);
  }

  // Fall back to resource-level access
  const requiredRole = RESOURCE_ACCESS[resource];
  if (!requiredRole) {
    // No access rule defined - default to analyst (allow all authenticated)
    console.warn(`[AccessControl] No access rule for resource: ${resource}, defaulting to analyst`);
    return true;
  }

  return hasMinimumRole(userRole, requiredRole);
}

/**
 * React Admin Access Control Provider
 */
export const accessControlProvider: AccessControlProvider = {
  /**
   * Check if user can access a resource/action
   *
   * @param params - Access check parameters
   * @param params.resource - Resource name
   * @param params.action - Action name (optional)
   * @returns Promise resolving to true if access granted
   */
  canAccess: async ({ resource, action }) => {
    if (!resource) {
      // No resource specified - allow access
      return true;
    }

    const hasAccess = checkAccess(resource, action);

    if (!hasAccess) {
      console.log(`[AccessControl] Denied: resource=${resource}, action=${action}`);
    }

    return hasAccess;
  },
};

/**
 * Hook-style access check for use in components
 *
 * @param resource - Resource name
 * @param action - Action name (optional)
 * @returns true if user has access
 */
export function useCanAccess(resource: string, action?: string): boolean {
  return checkAccess(resource, action);
}

/**
 * Get user's current role for display/logic
 *
 * @returns User's highest role
 */
export function useUserRole(): AppRole {
  return getCurrentUserRole();
}

/**
 * Check if user has specific minimum role
 *
 * @param requiredRole - Minimum required role
 * @returns true if user meets requirement
 */
export function useHasMinimumRole(requiredRole: AppRole): boolean {
  const userRole = getCurrentUserRole();
  return hasMinimumRole(userRole, requiredRole);
}

export default accessControlProvider;
