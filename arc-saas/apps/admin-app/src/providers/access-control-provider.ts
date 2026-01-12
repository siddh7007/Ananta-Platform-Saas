/**
 * Access Control Provider for Refine
 *
 * Provides route-level access control based on user roles.
 * This enforces RBAC at the routing layer, not just UI hiding.
 *
 * Uses the navigation manifest to determine which resources
 * require which minimum role level.
 *
 * Role Hierarchy (aligned with CBP/CNS):
 * - analyst (1): Read-only access + reports (lowest customer role)
 * - engineer (2): Can manage BOMs, components, specifications
 * - admin (3): Organization management, user administration
 * - owner (4): Organization owner - billing, delete org
 * - super_admin (5): Platform-wide access (Ananta staff only)
 */

import type { AccessControlProvider } from "@refinedev/core";
import { canAccessResource, navigationManifest } from "../config/navigation";
import { getRoleFromToken, hasMinimumRole, DEFAULT_ROLE, type AppRole } from "../lib/role-parser";
import { logger } from "../lib/logger";

/**
 * Shared state for OIDC token - allows access control provider to use
 * the OIDC token directly without waiting for localStorage sync
 */
let oidcAccessToken: string | null = null;

/**
 * Set the OIDC access token for the access control provider
 * This should be called when OIDC authentication state changes
 */
export function setOidcAccessToken(token: string | null): void {
  oidcAccessToken = token;
  if (token) {
    // Also sync to localStorage immediately to avoid race conditions
    localStorage.setItem("arc_admin_token", token);
    logger.debug("OIDC token set in access control provider", { hasToken: true });
  }
}

/**
 * Get the current user's role from OIDC token or stored token
 * Prioritizes OIDC token over localStorage for freshness
 */
function getCurrentUserRole(): AppRole {
  // Try OIDC token first (most up-to-date source)
  if (oidcAccessToken) {
    const role = getRoleFromToken(oidcAccessToken);
    logger.debug("Role from OIDC token in access control", { role });
    return role;
  }
  // Fall back to localStorage token (synced from OIDC)
  const token = localStorage.getItem("arc_admin_token");
  if (token) {
    return getRoleFromToken(token);
  }
  return DEFAULT_ROLE;
}

/**
 * Extract resource name from a Refine route path
 * E.g., "/tenants/123" -> "tenants"
 */
function extractResourceFromPath(path: string): string | null {
  // Remove leading slash and split
  const segments = path.replace(/^\//, "").split("/");
  if (segments.length === 0 || !segments[0]) {
    return null;
  }
  return segments[0];
}

/**
 * Refine Access Control Provider
 *
 * This provider is called by Refine to determine if the current user
 * can access a resource or perform an action.
 */
export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action, params }) => {
    const userRole = getCurrentUserRole();

    logger.debug("Access control check", { resource, action, params, userRole });

    // Dashboard is accessible to all authenticated users
    if (resource === "dashboard" || !resource) {
      return { can: true };
    }

    // Find the navigation item for this resource
    const navItem = navigationManifest.find((item) => item.name === resource);

    if (!navItem) {
      // Resource not in manifest - allow by default (public routes)
      logger.warn("Resource not in navigation manifest", { resource });
      return { can: true };
    }

    // Check if user has minimum required role
    const minRole = navItem.meta.minRole;
    if (minRole && !hasMinimumRole(userRole, minRole)) {
      logger.warn("Access denied - insufficient role", {
        resource,
        userRole,
        requiredRole: minRole,
      });
      return {
        can: false,
        reason: `You need at least "${minRole}" role to access this resource`,
      };
    }

    // Check feature flag
    if (navItem.meta.featureFlag) {
      const isEnabled = canAccessResource(resource, userRole);
      if (!isEnabled) {
        return {
          can: false,
          reason: "This feature is not enabled",
        };
      }
    }

    // Action-specific checks (optional - can be extended)
    // Role hierarchy: analyst(1) < engineer(2) < admin(3) < owner(4) < super_admin(5)
    switch (action) {
      case "create":
        // Creating requires at least engineer role (can manage BOMs, components)
        if (!hasMinimumRole(userRole, "engineer")) {
          return {
            can: false,
            reason: "You need at least engineer role to create resources",
          };
        }
        break;

      case "delete":
        // Deleting requires at least admin role (organization management)
        if (!hasMinimumRole(userRole, "admin")) {
          return {
            can: false,
            reason: "You need at least admin role to delete resources",
          };
        }
        break;

      case "edit":
        // Editing requires at least engineer role (can manage BOMs, components)
        if (!hasMinimumRole(userRole, "engineer")) {
          return {
            can: false,
            reason: "You need at least engineer role to edit resources",
          };
        }
        break;

      // list, show - rely on resource-level minRole check above
      // analysts can view/list resources that don't have a minRole requirement
    }

    return { can: true };
  },

  options: {
    buttons: {
      // Hide buttons for actions user can't perform
      enableAccessControl: true,
      // Also hide navigation to inaccessible resources
      hideIfUnauthorized: true,
    },
  },
};

export default accessControlProvider;
