/**
 * Role Parser for Keycloak JWT Tokens
 *
 * Extracts and maps Keycloak roles to application roles.
 * Keycloak roles can be found in:
 * - realm_access.roles: Realm-level roles
 * - resource_access.{client}.roles: Client-specific roles
 */

import { logger } from './logger';

/**
 * Application role types - aligned with CBP/CNS role hierarchy
 *
 * Role hierarchy (privilege levels 1-5):
 * - analyst (1): Read-only access + reports (lowest level for customers)
 * - engineer (2): Can manage BOMs, components, specifications
 * - admin (3): Organization management, user administration
 * - owner (4): Organization owner - billing, delete org
 * - super_admin (5): Platform-wide access across all organizations (Platform staff)
 *
 * Legacy roles are mapped to current roles:
 * - user -> analyst
 * - staff -> engineer
 * - viewer -> analyst
 * - member -> analyst
 */
export type AppRole = 'super_admin' | 'owner' | 'admin' | 'engineer' | 'analyst';

/**
 * Legacy roles that map to current roles (for backwards compatibility)
 */
export type LegacyRole = 'staff' | 'user' | 'viewer' | 'member' | 'developer' | 'org_admin';

/**
 * All possible role types (current + legacy)
 */
export type AnyRole = AppRole | LegacyRole;

/**
 * Role hierarchy - higher roles include permissions of lower roles
 * Aligned with CBP/CNS: analyst < engineer < admin < owner < super_admin
 */
export const ROLE_HIERARCHY: Record<AppRole, number> = {
  super_admin: 5,  // Platform-wide access (Ananta staff only)
  owner: 4,        // Org owner - higher than admin (billing, delete org)
  admin: 3,        // Org management
  engineer: 2,     // Can manage BOMs, components
  analyst: 1,      // Read-only + reports (lowest customer role)
};

/**
 * Keycloak to App role mappings - aligned with CBP/CNS role hierarchy
 * Multiple Keycloak roles can map to the same app role
 *
 * CBP/CNS uses these role levels:
 * - super_admin: Platform staff (Ananta employees)
 * - owner: Organization owner (billing, delete)
 * - admin: Organization admin (user management)
 * - engineer: Can manage BOMs, components
 * - analyst: Read-only access (lowest customer role)
 */
const KEYCLOAK_ROLE_MAPPINGS: Record<string, AppRole> = {
  // Super admin roles (Platform staff only)
  'platform:super_admin': 'super_admin',
  'platform-super-admin': 'super_admin',
  'super-admin': 'super_admin',
  'superadmin': 'super_admin',
  'super_admin': 'super_admin',
  'realm-admin': 'super_admin',
  'platform_admin': 'super_admin',
  // Keycloak master realm default roles (admin user)
  'default-roles-master': 'super_admin',
  'create-realm': 'super_admin',
  'admin': 'super_admin',  // Keycloak admin role -> super_admin
  // Keycloak ananta realm roles
  'default-roles-ananta': 'admin',  // Default realm user gets admin for now
  'default-roles-ananta-saas': 'admin',  // Ananta-SaaS realm default role

  // Common Keycloak account/management roles (for master realm admin)
  'manage-realm': 'super_admin',
  'manage-users': 'super_admin',
  'manage-clients': 'super_admin',
  'manage-identity-providers': 'super_admin',
  'manage-events': 'super_admin',
  'manage-authorization': 'super_admin',
  'view-realm': 'admin',
  'view-users': 'admin',
  'view-clients': 'admin',
  'view-events': 'admin',
  'view-identity-providers': 'admin',
  'view-authorization': 'admin',
  'query-users': 'engineer',
  'query-clients': 'engineer',
  'query-realms': 'engineer',
  'query-groups': 'engineer',
  // Keycloak account roles
  'manage-account': 'analyst',
  'manage-account-links': 'analyst',
  'view-profile': 'analyst',
  'offline_access': 'analyst',
  'uma_authorization': 'analyst',

  // Owner roles (Organization owners - billing, delete org)
  'owner': 'owner',
  'org-owner': 'owner',
  'organization-owner': 'owner',
  'billing_admin': 'owner',  // Billing admin maps to owner level

  // Admin roles (Organization management)
  'platform:admin': 'admin',
  'tenant-admin': 'admin',
  'administrator': 'admin',
  'org_admin': 'admin',
  'org-admin': 'admin',
  // Note: 'admin' is mapped to super_admin above for Keycloak master realm admin

  // Engineer roles (Can manage BOMs, components)
  'platform:engineer': 'engineer',
  'platform:staff': 'engineer',  // Platform staff maps to engineer
  'engineer': 'engineer',
  'staff': 'engineer',           // Legacy staff -> engineer
  'developer': 'engineer',       // Legacy developer -> engineer
  'support': 'engineer',
  'operator': 'engineer',

  // Analyst roles (Read-only + reports - lowest customer role)
  'analyst': 'analyst',
  'user': 'analyst',             // Legacy user -> analyst
  'customer': 'analyst',
  'viewer': 'analyst',           // Legacy viewer -> analyst
  'member': 'analyst',           // Legacy member -> analyst
};

/**
 * Default role when no roles are found
 * Changed from 'user' to 'analyst' (lowest customer role in CBP/CNS hierarchy)
 */
export const DEFAULT_ROLE: AppRole = 'analyst';

/**
 * Keycloak client ID for role extraction
 */
const KEYCLOAK_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'admin-app';

/**
 * JWT Payload interface for Keycloak tokens
 */
interface KeycloakJwtPayload {
  sub?: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
  exp?: number;
  iat?: number;
  // Keycloak role claims
  realm_access?: {
    roles?: string[];
  };
  resource_access?: {
    [clientId: string]: {
      roles?: string[];
    };
  };
  // Alternative role claim locations
  roles?: string[];
  groups?: string[];
}

/**
 * Decode a JWT token payload (without verification - for UI purposes only)
 */
export function decodeJwtPayload(token: string): KeycloakJwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload as KeycloakJwtPayload;
  } catch (error) {
    logger.error('Failed to decode JWT', { error });
    return null;
  }
}

/**
 * Extract all roles from a Keycloak JWT token
 * Checks multiple locations where roles might be stored
 */
export function extractKeycloakRoles(token: string): string[] {
  const payload = decodeJwtPayload(token);
  if (!payload) return [];

  const roles: Set<string> = new Set();

  // 1. Realm-level roles (realm_access.roles)
  if (payload.realm_access?.roles) {
    payload.realm_access.roles.forEach(role => roles.add(role.toLowerCase()));
  }

  // 2. Client-specific roles (resource_access.{client}.roles)
  if (payload.resource_access) {
    // Check specific client
    const clientRoles = payload.resource_access[KEYCLOAK_CLIENT_ID]?.roles;
    if (clientRoles) {
      clientRoles.forEach(role => roles.add(role.toLowerCase()));
    }

    // Also check account client (common for Keycloak)
    const accountRoles = payload.resource_access['account']?.roles;
    if (accountRoles) {
      accountRoles.forEach(role => roles.add(role.toLowerCase()));
    }
  }

  // 3. Direct roles claim (some Keycloak configurations)
  if (payload.roles && Array.isArray(payload.roles)) {
    payload.roles.forEach(role => roles.add(role.toLowerCase()));
  }

  // 4. Groups (can be used as roles)
  if (payload.groups && Array.isArray(payload.groups)) {
    payload.groups.forEach(group => {
      // Extract role from group path (e.g., "/admins" -> "admins")
      const roleName = group.replace(/^\//, '').toLowerCase();
      roles.add(roleName);
    });
  }

  const roleArray = Array.from(roles);
  // Log to console for easier debugging (visible in browser DevTools)
  console.log('[ROLE-PARSER] Extracted Keycloak roles:', roleArray);
  logger.debug('Extracted Keycloak roles', { roles: roleArray });
  return roleArray;
}

/**
 * Map Keycloak roles to the highest-priority application role
 */
export function mapToAppRole(keycloakRoles: string[]): AppRole {
  let highestRole: AppRole = DEFAULT_ROLE;
  let highestPriority = ROLE_HIERARCHY[DEFAULT_ROLE];

  for (const kcRole of keycloakRoles) {
    const normalizedRole = kcRole.toLowerCase().trim();
    const appRole = KEYCLOAK_ROLE_MAPPINGS[normalizedRole];

    if (appRole && ROLE_HIERARCHY[appRole] > highestPriority) {
      highestRole = appRole;
      highestPriority = ROLE_HIERARCHY[appRole];
    }
  }

  // Log mapping result for debugging
  console.log('[ROLE-PARSER] Mapped to app role:', highestRole, 'from roles:', keycloakRoles);
  logger.debug('Mapped to app role', {
    keycloakRoles,
    appRole: highestRole,
  });

  return highestRole;
}

/**
 * Extract role from JWT token - main entry point
 * Returns the highest-priority application role found in the token
 */
export function getRoleFromToken(token: string): AppRole {
  const keycloakRoles = extractKeycloakRoles(token);
  return mapToAppRole(keycloakRoles);
}

/**
 * Check if a user has at least a certain role level
 */
export function hasMinimumRole(userRole: AppRole, requiredRole: AppRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if a user is a super admin
 */
export function isSuperAdmin(role: AppRole): boolean {
  return role === 'super_admin';
}

/**
 * Check if a user is at least an admin
 */
export function isAdmin(role: AppRole): boolean {
  return hasMinimumRole(role, 'admin');
}

/**
 * Check if a user is at least an owner
 */
export function isOwner(role: AppRole): boolean {
  return hasMinimumRole(role, 'owner');
}

/**
 * Check if a user is at least an engineer
 */
export function isEngineer(role: AppRole): boolean {
  return hasMinimumRole(role, 'engineer');
}

/**
 * Check if a user is an analyst (lowest customer role)
 */
export function isAnalyst(role: AppRole): boolean {
  return hasMinimumRole(role, 'analyst');
}
