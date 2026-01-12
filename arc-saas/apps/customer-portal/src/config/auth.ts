import { UserManagerSettings, WebStorageStateStore } from 'oidc-client-ts';
import { env } from './env';

/**
 * Expected audience claim values for token validation
 * Tokens must include at least one of these audiences
 */
export const EXPECTED_AUDIENCES = [
  env.keycloak.clientId,      // cbp-frontend (or customer-portal if configured)
  'customer-portal',          // Keycloak client name (Kubernetes deployment)
  'cbp-frontend',             // Legacy client name (docker-compose)
  'cns-api',                  // CNS service API
  'account',                  // Keycloak account
];

/**
 * OIDC configuration for Keycloak authentication
 * Client: cbp-frontend
 * Scopes: openid profile email roles
 */
export const oidcConfig: UserManagerSettings = {
  authority: `${env.keycloak.url}/realms/${env.keycloak.realm}`,
  client_id: env.keycloak.clientId,
  redirect_uri: `${window.location.origin}/authentication/callback`,
  post_logout_redirect_uri: `${window.location.origin}/login`,
  response_type: 'code',
  scope: 'openid profile email roles',
  automaticSilentRenew: true,
  loadUserInfo: true,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  // PKCE is enabled by default in oidc-client-ts
};

/**
 * Role hierarchy for the platform
 * Higher number = higher privilege
 */
export const ROLE_HIERARCHY = {
  analyst: 1,
  engineer: 2,
  admin: 3,
  owner: 4,
  super_admin: 5,
} as const;

export type AppRole = keyof typeof ROLE_HIERARCHY;

/**
 * Keycloak role mappings - maps various Keycloak role names to app roles
 */
export const KEYCLOAK_ROLE_MAPPINGS: Record<string, AppRole> = {
  // super_admin mappings
  'platform:super_admin': 'super_admin',
  'platform-super-admin': 'super_admin',
  'super-admin': 'super_admin',
  'superadmin': 'super_admin',
  'super_admin': 'super_admin',
  'realm-admin': 'super_admin',
  'platform_admin': 'super_admin',

  // owner mappings
  'owner': 'owner',
  'org-owner': 'owner',
  'organization-owner': 'owner',
  'billing_admin': 'owner',

  // admin mappings
  'platform:admin': 'admin',
  'tenant-admin': 'admin',
  'admin': 'admin',
  'administrator': 'admin',
  'org_admin': 'admin',
  'org-admin': 'admin',

  // engineer mappings
  'platform:engineer': 'engineer',
  'platform:staff': 'engineer',
  'engineer': 'engineer',
  'staff': 'engineer',
  'developer': 'engineer',
  'support': 'engineer',
  'operator': 'engineer',

  // analyst mappings
  'analyst': 'analyst',
  'user': 'analyst',
  'customer': 'analyst',
  'viewer': 'analyst',
  'member': 'analyst',
};

/**
 * Check if a role meets the minimum required role level
 */
export function hasMinimumRole(userRole: AppRole | undefined, requiredRole: AppRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Parse roles from Keycloak token and return the highest-priority app role
 */
export function parseKeycloakRoles(tokenPayload: {
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  roles?: string[];
  groups?: string[];
}): AppRole {
  const allRoles: string[] = [];

  // Collect roles from realm_access
  if (tokenPayload.realm_access?.roles) {
    allRoles.push(...tokenPayload.realm_access.roles);
  }

  // Collect roles from resource_access (all clients)
  if (tokenPayload.resource_access) {
    for (const client of Object.values(tokenPayload.resource_access)) {
      if (client.roles) {
        allRoles.push(...client.roles);
      }
    }
  }

  // Collect direct roles
  if (tokenPayload.roles) {
    allRoles.push(...tokenPayload.roles);
  }

  // Collect from groups (strip leading /)
  if (tokenPayload.groups) {
    allRoles.push(...tokenPayload.groups.map((g) => g.replace(/^\//, '')));
  }

  // Map to app roles and find highest
  let highestRole: AppRole = 'analyst';
  let highestLevel = 0;

  // DEBUG: Log raw roles from Keycloak for troubleshooting
  if (import.meta.env.DEV) {
    console.debug('[Auth] Raw Keycloak roles:', allRoles);
  }

  for (const role of allRoles) {
    const normalizedRole = role.toLowerCase();
    const appRole = KEYCLOAK_ROLE_MAPPINGS[normalizedRole];
    if (appRole && ROLE_HIERARCHY[appRole] > highestLevel) {
      highestRole = appRole;
      highestLevel = ROLE_HIERARCHY[appRole];
      if (import.meta.env.DEV) {
        console.debug(`[Auth] Matched role: ${role} -> ${appRole}`);
      }
    }
  }

  if (import.meta.env.DEV && highestLevel === 0) {
    console.warn('[Auth] No matching role found in KEYCLOAK_ROLE_MAPPINGS. Using default: analyst');
    console.warn('[Auth] Available mappings:', Object.keys(KEYCLOAK_ROLE_MAPPINGS));
    console.warn('[Auth] Add one of these roles to your Keycloak user: admin, engineer, owner, super_admin');
  }

  return highestRole;
}

/**
 * User info extracted from token
 */
export interface ExtractedUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  tenantId?: string;
}

/**
 * Extract user info from a decoded Keycloak token profile
 * Used by AuthContext and tests
 */
export function extractUserFromToken(profile: {
  sub?: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  tenant_id?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  roles?: string[];
  groups?: string[];
}): ExtractedUser {
  const role = parseKeycloakRoles({
    realm_access: profile.realm_access,
    resource_access: profile.resource_access,
    roles: profile.roles,
    groups: profile.groups,
  });

  return {
    id: profile.sub || '',
    email: profile.email || '',
    name: profile.name || profile.preferred_username || '',
    role,
    tenantId: profile.tenant_id,
  };
}

/**
 * Validate that the token audience includes at least one expected value
 * @param aud - Audience claim from JWT (can be string or array)
 * @param azp - Authorized party claim (optional, used as fallback when aud is missing)
 * @returns Object with valid flag and error message if invalid
 */
export function validateAudience(
  aud: string | string[] | undefined,
  azp?: string
): {
  valid: boolean;
  error?: string;
} {
  // If aud is missing, check if azp (authorized party) is a valid audience
  // Keycloak uses azp for the client that requested the token
  if (!aud) {
    if (azp && EXPECTED_AUDIENCES.includes(azp)) {
      return { valid: true };
    }
    return {
      valid: false,
      error: 'Token missing audience claim (aud)',
    };
  }

  const audiences = Array.isArray(aud) ? aud : [aud];
  const hasValidAudience = audiences.some((a) => EXPECTED_AUDIENCES.includes(a));

  if (!hasValidAudience) {
    // Also check azp as fallback
    if (azp && EXPECTED_AUDIENCES.includes(azp)) {
      return { valid: true };
    }
    return {
      valid: false,
      error: `Invalid audience. Expected one of [${EXPECTED_AUDIENCES.join(', ')}], got [${audiences.join(', ')}]`,
    };
  }

  return { valid: true };
}

/**
 * Validate token expiration
 * @param exp - Token expiration timestamp in seconds
 * @param bufferSeconds - Buffer time before expiration to consider expired (default: 60)
 * @returns Object with valid flag and error message if expired
 */
export function validateExpiration(
  exp: number | undefined,
  bufferSeconds = 60
): { valid: boolean; error?: string } {
  if (!exp) {
    return {
      valid: false,
      error: 'Token missing expiration claim (exp)',
    };
  }

  const expiresAt = exp * 1000; // Convert to milliseconds
  const bufferMs = bufferSeconds * 1000;
  const now = Date.now();

  if (expiresAt - bufferMs < now) {
    const expiresIn = Math.round((expiresAt - now) / 1000);
    return {
      valid: false,
      error: `Token ${expiresIn > 0 ? `expires in ${expiresIn}s` : 'has expired'}`,
    };
  }

  return { valid: true };
}
