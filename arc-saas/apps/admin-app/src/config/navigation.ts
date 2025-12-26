/**
 * Navigation Manifest for Admin App
 *
 * Config-driven navigation with role-based and plan-based access control.
 * Resources are filtered based on:
 * - User roles (RBAC)
 * - Environment feature flags
 * - Plan-based feature access (from platform.config.ts)
 *
 * @see platform.config.ts for plan-based feature definitions
 * @see role-parser.ts for role hierarchy
 */

import type { ResourceProps } from "@refinedev/core";
import type { AppRole } from "../lib/role-parser";
import { hasMinimumRole } from "../lib/role-parser";
import { getEnv } from "./env.schema";
import {
  isPlanFeatureEnabled,
  type FeatureFlag,
} from "./platform.config";

/**
 * Navigation item with role and plan requirements
 */
export interface NavigationItem {
  name: string;
  list?: string;
  show?: string;
  create?: string;
  edit?: string;
  meta: {
    label: string;
    icon?: string;
    /** Minimum role required to see this resource */
    minRole?: AppRole;
    /** Hide from sidebar but still accessible */
    hidden?: boolean;
    /** Feature flag key - if set, resource only shows when flag is enabled */
    featureFlag?: string;
    /** Plan feature required - resource only shows if user's plan has this feature */
    planFeature?: FeatureFlag;
    /** Parent resource for nested navigation */
    parent?: string;
  };
}

/**
 * Get environment feature flags
 * Reads from validated env schema
 */
function getEnvFeatureFlags(): Record<string, boolean> {
  const env = getEnv();
  return {
    billing: env.VITE_FEATURE_BILLING,
    workflows: env.VITE_FEATURE_WORKFLOWS,
    monitoring: env.VITE_FEATURE_MONITORING,
    auditLogs: env.VITE_FEATURE_AUDIT_LOGS,
    notifications: env.VITE_FEATURE_NOTIFICATIONS,
  };
}

/**
 * Check if a feature flag is enabled (environment level)
 */
export function isFeatureEnabled(flag: string): boolean {
  const flags = getEnvFeatureFlags();
  return flags[flag] ?? true; // Default to enabled if not defined
}

/**
 * Check if user's plan has access to a feature
 * Combines environment flags with plan-based access
 */
export function isPlanFeatureAccessible(
  flag: string,
  userPlanId?: string
): boolean {
  // First check environment flag
  if (!isFeatureEnabled(flag)) {
    return false;
  }

  // If no plan check required, allow access
  if (!userPlanId) {
    return true;
  }

  // Check plan-based access for premium features
  const planFeatures: FeatureFlag[] = ['billing', 'workflows', 'monitoring', 'auditLogs', 'analytics', 'notifications'];
  if (planFeatures.includes(flag as FeatureFlag)) {
    return isPlanFeatureEnabled(userPlanId, flag as FeatureFlag);
  }

  return true;
}

/**
 * Master navigation manifest
 * All resources defined here with their role requirements
 */
export const navigationManifest: NavigationItem[] = [
  // Dashboard - accessible to all authenticated users
  {
    name: "dashboard",
    list: "/",
    meta: {
      label: "Dashboard",
      icon: "LayoutDashboard",
    },
  },

  // Tenant Management - admin+ only
  {
    name: "tenants",
    list: "/tenants",
    show: "/tenants/:id",
    create: "/tenants/create",
    meta: {
      label: "Tenants",
      icon: "Building2",
      minRole: "admin",
    },
  },

  // Plans - admin+ only
  {
    name: "plans",
    list: "/plans",
    create: "/plans/create",
    edit: "/plans/:id/edit",
    meta: {
      label: "Plans",
      icon: "CreditCard",
      minRole: "admin",
    },
  },

  // Subscriptions - engineer+ can view
  {
    name: "subscriptions",
    list: "/subscriptions",
    show: "/subscriptions/:id",
    meta: {
      label: "Subscriptions",
      icon: "Receipt",
      minRole: "engineer",
    },
  },

  // Workflows - engineer+ can view, feature flagged, requires plan feature
  {
    name: "workflows",
    list: "/workflows",
    show: "/workflows/:id",
    meta: {
      label: "Workflows",
      icon: "GitBranch",
      minRole: "engineer",
      featureFlag: "workflows",
      planFeature: "workflows",
    },
  },

  // User Management - admin+ only
  {
    name: "users",
    list: "/users",
    show: "/users/:id",
    create: "/users/create",
    meta: {
      label: "Users",
      icon: "Users",
      minRole: "admin",
    },
  },

  // Invitations - admin+ only
  {
    name: "user-invitations",
    list: "/invitations",
    meta: {
      label: "Invitations",
      icon: "Mail",
      minRole: "admin",
    },
  },

  // Billing - super_admin only, feature flagged, requires plan feature
  {
    name: "billing",
    list: "/billing",
    meta: {
      label: "Billing",
      icon: "DollarSign",
      minRole: "super_admin",
      featureFlag: "billing",
      planFeature: "billing",
    },
  },

  // Roles - super_admin only
  {
    name: "roles",
    list: "/roles",
    meta: {
      label: "Roles",
      icon: "Shield",
      minRole: "super_admin",
    },
  },

  // Audit Logs - admin+ only, feature flagged, requires plan feature
  {
    name: "audit-logs",
    list: "/audit-logs",
    meta: {
      label: "Audit Logs",
      icon: "FileText",
      minRole: "admin",
      featureFlag: "auditLogs",
      planFeature: "auditLogs",
    },
  },

  // Settings - admin+ only
  {
    name: "settings",
    list: "/settings",
    meta: {
      label: "Settings",
      icon: "Settings",
      minRole: "admin",
    },
  },

  // Notifications - admin+ only, feature flagged, requires plan feature
  {
    name: "notifications",
    list: "/notifications",
    meta: {
      label: "Notifications",
      icon: "Bell",
      minRole: "admin",
      featureFlag: "notifications",
      planFeature: "notifications",
    },
  },

  // Notification Preferences - admin+ only, child of notifications
  {
    name: "notification-preferences",
    list: "/notifications/preferences",
    meta: {
      label: "Preferences",
      icon: "Settings",
      minRole: "admin",
      featureFlag: "notifications",
      planFeature: "notifications",
      parent: "notifications",
    },
  },

  // Alerts - admin+ only, feature flagged
  {
    name: "alerts",
    list: "/alerts",
    meta: {
      label: "Alerts",
      icon: "AlertTriangle",
      minRole: "admin",
      featureFlag: "monitoring",
      planFeature: "monitoring",
    },
  },

  // Monitoring - engineer+ can view, feature flagged, requires plan feature
  {
    name: "monitoring",
    list: "/monitoring",
    meta: {
      label: "Monitoring",
      icon: "Activity",
      minRole: "engineer",
      featureFlag: "monitoring",
      planFeature: "monitoring",
    },
  },
];

/**
 * Get filtered resources based on user role, feature flags, and plan
 * @param userRole - User's application role
 * @param userPlanId - Optional plan ID for plan-based feature gating
 */
export function getResourcesForRole(userRole: AppRole, userPlanId?: string): ResourceProps[] {
  return navigationManifest
    .filter((item) => {
      // Check role requirement
      if (item.meta.minRole && !hasMinimumRole(userRole, item.meta.minRole)) {
        return false;
      }

      // Check feature flag (environment level)
      if (item.meta.featureFlag && !isFeatureEnabled(item.meta.featureFlag)) {
        return false;
      }

      // Check plan-based feature access
      if (item.meta.planFeature && !isPlanFeatureAccessible(item.meta.planFeature, userPlanId)) {
        return false;
      }

      return true;
    })
    .map((item) => ({
      name: item.name,
      list: item.list,
      show: item.show,
      create: item.create,
      edit: item.edit,
      meta: {
        label: item.meta.label,
        icon: item.meta.icon,
        hidden: item.meta.hidden,
        parent: item.meta.parent,
      },
    }));
}

/**
 * Get all resources (for unauthenticated state or full access)
 * Used when role is not yet determined
 * @param userPlanId - Optional plan ID for plan-based feature gating
 */
export function getAllResources(userPlanId?: string): ResourceProps[] {
  return navigationManifest
    .filter((item) => {
      // Only check feature flags, not roles
      if (item.meta.featureFlag && !isFeatureEnabled(item.meta.featureFlag)) {
        return false;
      }
      // Check plan-based feature access
      if (item.meta.planFeature && !isPlanFeatureAccessible(item.meta.planFeature, userPlanId)) {
        return false;
      }
      return true;
    })
    .map((item) => ({
      name: item.name,
      list: item.list,
      show: item.show,
      create: item.create,
      edit: item.edit,
      meta: {
        label: item.meta.label,
        icon: item.meta.icon,
        hidden: item.meta.hidden,
        parent: item.meta.parent,
      },
    }));
}

/**
 * Get sidebar items for navigation component
 * Returns only visible items with proper structure
 * @param userRole - User's application role
 * @param userPlanId - Optional plan ID for plan-based feature gating
 */
export function getSidebarItems(userRole: AppRole, userPlanId?: string): NavigationItem[] {
  return navigationManifest.filter((item) => {
    // Skip hidden items
    if (item.meta.hidden) {
      return false;
    }

    // Check role requirement
    if (item.meta.minRole && !hasMinimumRole(userRole, item.meta.minRole)) {
      return false;
    }

    // Check feature flag (environment level)
    if (item.meta.featureFlag && !isFeatureEnabled(item.meta.featureFlag)) {
      return false;
    }

    // Check plan-based feature access
    if (item.meta.planFeature && !isPlanFeatureAccessible(item.meta.planFeature, userPlanId)) {
      return false;
    }

    return true;
  });
}

/**
 * Check if user can access a specific resource
 * @param resourceName - Name of the resource to check
 * @param userRole - User's application role
 * @param userPlanId - Optional plan ID for plan-based feature gating
 */
export function canAccessResource(resourceName: string, userRole: AppRole, userPlanId?: string): boolean {
  const item = navigationManifest.find((n) => n.name === resourceName);
  if (!item) {
    return false;
  }

  // Check role requirement
  if (item.meta.minRole && !hasMinimumRole(userRole, item.meta.minRole)) {
    return false;
  }

  // Check feature flag (environment level)
  if (item.meta.featureFlag && !isFeatureEnabled(item.meta.featureFlag)) {
    return false;
  }

  // Check plan-based feature access
  if (item.meta.planFeature && !isPlanFeatureAccessible(item.meta.planFeature, userPlanId)) {
    return false;
  }

  return true;
}
