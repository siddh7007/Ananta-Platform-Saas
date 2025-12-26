/**
 * Role Parser - Keycloak JWT Role Extraction
 *
 * Handles role extraction from Keycloak tokens and provides role-based utilities.
 * Aligned with platform-wide 5-level role hierarchy.
 *
 * Role Hierarchy (highest to lowest):
 * 5. super_admin - Platform staff (Ananta employees)
 * 4. owner - Organization owner (billing, delete org)
 * 3. admin - Organization admin (user management, settings)
 * 2. engineer - Technical user (manage BOMs, components, specs)
 * 1. analyst - Read-only user (view data, reports)
 */

// Role type - aligned with platform hierarchy
export type AppRole = 'super_admin' | 'owner' | 'admin' | 'engineer' | 'analyst';

/**
 * Role level mapping - higher number = higher privilege
 */
const ROLE_LEVELS: Record<AppRole, number> = {
  super_admin: 5,
  owner: 4,
  admin: 3,
  engineer: 2,
  analyst: 1,
};

/**
 * Keycloak role mappings to app roles
 * Multiple Keycloak roles can map to each app role
 */
const KEYCLOAK_ROLE_MAPPINGS: Record<string, AppRole> = {
  // super_admin mappings (platform staff)
  'platform:super_admin': 'super_admin',
  'platform-super-admin': 'super_admin',
  'super-admin': 'super_admin',
  'superadmin': 'super_admin',
  'super_admin': 'super_admin',
  'realm-admin': 'super_admin',
  'platform_admin': 'super_admin',

  // owner mappings (organization owner)
  'owner': 'owner',
  'org-owner': 'owner',
  'organization-owner': 'owner',
  'billing_admin': 'owner',

  // admin mappings (organization admin)
  'platform:admin': 'admin',
  'tenant-admin': 'admin',
  'admin': 'admin',
  'administrator': 'admin',
  'org_admin': 'admin',
  'org-admin': 'admin',

  // engineer mappings (technical user)
  'platform:engineer': 'engineer',
  'platform:staff': 'engineer',
  'engineer': 'engineer',
  'staff': 'engineer',
  'developer': 'engineer',
  'support': 'engineer',
  'operator': 'engineer',

  // analyst mappings (read-only user)
  'analyst': 'analyst',
  'user': 'analyst',
  'customer': 'analyst',
  'viewer': 'analyst',
  'member': 'analyst',
};

/**
 * Parse roles from Keycloak JWT token
 *
 * Extracts roles from multiple token locations in priority order:
 * 1. realm_access.roles - Realm-level roles
 * 2. resource_access.{client}.roles - Client-specific roles
 * 3. roles - Direct roles claim
 * 4. groups - Group memberships (leading / stripped)
 *
 * @param decodedToken - Decoded Keycloak JWT token
 * @returns Array of app roles found in token
 */
export function parseRolesFromToken(decodedToken: any): AppRole[] {
  if (!decodedToken || typeof decodedToken !== 'object') {
    return [];
  }

  const foundRoles = new Set<AppRole>();
  const rawRoles: string[] = [];

  // 1. Extract realm roles
  if (decodedToken.realm_access?.roles && Array.isArray(decodedToken.realm_access.roles)) {
    rawRoles.push(...decodedToken.realm_access.roles);
  }

  // 2. Extract resource/client roles (check all clients)
  if (decodedToken.resource_access && typeof decodedToken.resource_access === 'object') {
    for (const client of Object.values(decodedToken.resource_access)) {
      if (client && typeof client === 'object' && Array.isArray((client as any).roles)) {
        rawRoles.push(...(client as any).roles);
      }
    }
  }

  // 3. Extract direct roles claim
  if (decodedToken.roles && Array.isArray(decodedToken.roles)) {
    rawRoles.push(...decodedToken.roles);
  }

  // 4. Extract from groups (strip leading /)
  if (decodedToken.groups && Array.isArray(decodedToken.groups)) {
    const groupRoles = decodedToken.groups.map((g: string) =>
      typeof g === 'string' && g.startsWith('/') ? g.substring(1) : g
    );
    rawRoles.push(...groupRoles);
  }

  // Map raw roles to app roles
  for (const rawRole of rawRoles) {
    if (typeof rawRole === 'string') {
      const appRole = KEYCLOAK_ROLE_MAPPINGS[rawRole.toLowerCase()];
      if (appRole) {
        foundRoles.add(appRole);
      }
    }
  }

  return Array.from(foundRoles);
}

/**
 * Get highest privilege role from array of roles
 *
 * @param roles - Array of app roles
 * @returns Highest privilege role (or 'analyst' if empty)
 */
export function getHighestRole(roles: AppRole[]): AppRole {
  if (!roles || roles.length === 0) {
    return 'analyst'; // Default to lowest privilege
  }

  return roles.reduce((highest, current) => {
    return ROLE_LEVELS[current] > ROLE_LEVELS[highest] ? current : highest;
  }, roles[0]);
}

/**
 * Check if user role meets minimum required role level
 *
 * @param userRole - User's role
 * @param requiredRole - Minimum required role
 * @returns true if user has sufficient privileges
 *
 * @example
 * hasMinimumRole('admin', 'engineer') // true (admin > engineer)
 * hasMinimumRole('analyst', 'admin') // false (analyst < admin)
 */
export function hasMinimumRole(userRole: AppRole, requiredRole: AppRole): boolean {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
}

/**
 * Check if role is super_admin (exact match)
 *
 * @param role - Role to check
 * @returns true if exactly super_admin
 */
export function isSuperAdmin(role: AppRole): boolean {
  return role === 'super_admin';
}

/**
 * Check if role is owner or higher
 *
 * @param role - Role to check
 * @returns true if owner or super_admin
 */
export function isOwner(role: AppRole): boolean {
  return ROLE_LEVELS[role] >= ROLE_LEVELS.owner;
}

/**
 * Check if role is admin or higher
 *
 * @param role - Role to check
 * @returns true if admin, owner, or super_admin
 */
export function isAdmin(role: AppRole): boolean {
  return ROLE_LEVELS[role] >= ROLE_LEVELS.admin;
}

/**
 * Check if role is engineer or higher
 *
 * @param role - Role to check
 * @returns true if engineer or higher
 */
export function isEngineer(role: AppRole): boolean {
  return ROLE_LEVELS[role] >= ROLE_LEVELS.engineer;
}

/**
 * Check if role is analyst or higher
 *
 * @param role - Role to check
 * @returns true for all roles (analyst is minimum)
 */
export function isAnalyst(role: AppRole): boolean {
  return ROLE_LEVELS[role] >= ROLE_LEVELS.analyst;
}

/**
 * Get role display name
 *
 * @param role - App role
 * @returns Human-readable role name
 */
export function getRoleDisplayName(role: AppRole): string {
  const displayNames: Record<AppRole, string> = {
    super_admin: 'Super Admin',
    owner: 'Owner',
    admin: 'Admin',
    engineer: 'Engineer',
    analyst: 'Analyst',
  };
  return displayNames[role];
}

/**
 * Get all roles at or below specified level
 *
 * @param role - Maximum role level
 * @returns Array of roles at or below this level
 */
export function getRolesAtOrBelow(role: AppRole): AppRole[] {
  const level = ROLE_LEVELS[role];
  return (Object.keys(ROLE_LEVELS) as AppRole[]).filter(
    (r) => ROLE_LEVELS[r] <= level
  );
}

/**
 * Get role level number
 *
 * @param role - App role
 * @returns Numeric level (1-5)
 */
export function getRoleLevel(role: AppRole): number {
  return ROLE_LEVELS[role];
}
