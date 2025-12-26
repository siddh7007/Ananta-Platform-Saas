import { AccessControlProvider } from '@refinedev/core';
import { hasMinimumRole, AppRole } from '@/config/auth';
import { canAccessRoute, navigationManifest, superAdminNavItems, NavItem } from '@/config/navigation';

/**
 * Resource to minimum role mapping
 * Used for action-based access control
 */
const resourceActionRoles: Record<string, Record<string, AppRole>> = {
  // BOM resources
  boms: {
    list: 'analyst',
    show: 'analyst',
    create: 'engineer',
    edit: 'engineer',
    delete: 'admin',
  },
  'bom-line-items': {
    list: 'analyst',
    show: 'analyst',
    create: 'engineer',
    edit: 'engineer',
    delete: 'engineer',
  },

  // Component catalog (read-only for all)
  components: {
    list: 'analyst',
    show: 'analyst',
    create: 'super_admin', // Only super_admin can create components
    edit: 'super_admin',
    delete: 'super_admin',
  },

  // Team management
  'tenant-users': {
    list: 'admin',
    show: 'admin',
    create: 'admin',
    edit: 'admin',
    delete: 'owner',
  },
  'user-invitations': {
    list: 'admin',
    show: 'admin',
    create: 'admin',
    edit: 'admin',
    delete: 'admin',
  },

  // Billing (owner+ only)
  subscriptions: {
    list: 'owner',
    show: 'owner',
    create: 'super_admin',
    edit: 'owner',
    delete: 'super_admin',
  },
  invoices: {
    list: 'owner',
    show: 'owner',
    create: 'super_admin',
    edit: 'super_admin',
    delete: 'super_admin',
  },
  plans: {
    list: 'analyst', // Everyone can view plans
    show: 'analyst',
    create: 'super_admin',
    edit: 'super_admin',
    delete: 'super_admin',
  },

  // Tenant settings
  settings: {
    list: 'admin',
    show: 'admin',
    create: 'admin',
    edit: 'admin',
    delete: 'owner',
  },

  // Admin-only resources
  tenants: {
    list: 'super_admin',
    show: 'admin', // Admins can see their own tenant
    create: 'super_admin',
    edit: 'super_admin',
    delete: 'super_admin',
  },
  users: {
    list: 'super_admin',
    show: 'admin',
    create: 'super_admin',
    edit: 'super_admin',
    delete: 'super_admin',
  },
  roles: {
    list: 'admin',
    show: 'admin',
    create: 'super_admin',
    edit: 'super_admin',
    delete: 'super_admin',
  },
};

/**
 * Default roles for common actions
 */
const defaultActionRoles: Record<string, AppRole> = {
  list: 'analyst',
  show: 'analyst',
  create: 'engineer',
  edit: 'engineer',
  delete: 'admin',
};

/**
 * Get the minimum role required for a resource action
 */
function getMinRoleForAction(resource: string, action: string): AppRole {
  const resourceRoles = resourceActionRoles[resource];
  if (resourceRoles && resourceRoles[action]) {
    return resourceRoles[action];
  }
  return defaultActionRoles[action] || 'analyst';
}

/**
 * Create Refine access control provider
 * Checks user role against required minimum role for each action
 */
export function createAccessControlProvider(
  getUserRole: () => AppRole | null
): AccessControlProvider {
  return {
    can: async ({ resource, action, params: _params }) => {
      const userRole = getUserRole();

      // No user = no access
      if (!userRole) {
        return {
          can: false,
          reason: 'Not authenticated',
        };
      }

      // Special case: dashboard is always accessible to authenticated users
      if (resource === 'dashboard') {
        return { can: true };
      }

      // Get required role for this resource/action
      const requiredRole = getMinRoleForAction(resource || '', action || '');

      // Check if user has sufficient role
      const canAccess = hasMinimumRole(userRole, requiredRole);

      if (!canAccess) {
        return {
          can: false,
          reason: `Requires ${requiredRole} role or higher`,
        };
      }

      return { can: true };
    },

    options: {
      buttons: {
        // Hide action buttons if user can't perform the action
        enableAccessControl: true,
        hideIfUnauthorized: true,
      },
    },
  };
}

/**
 * Hook-compatible function to check route access
 */
export function checkRouteAccess(userRole: AppRole | null, path: string): boolean {
  if (!userRole) return false;
  return canAccessRoute(userRole, path);
}

/**
 * Get all accessible routes for a user role
 */
export function getAccessibleRoutes(userRole: AppRole): string[] {
  const routes: string[] = [];

  const collectRoutes = (items: NavItem[]) => {
    for (const item of items) {
      if (hasMinimumRole(userRole, item.minRole)) {
        routes.push(item.href);
        if (item.children) {
          collectRoutes(item.children);
        }
      }
    }
  };

  collectRoutes(navigationManifest);
  if (userRole === 'super_admin') {
    collectRoutes(superAdminNavItems);
  }

  return routes;
}

export default createAccessControlProvider;
