/**
 * Keycloak Configuration - Staff Tenant SSO (ananta-saas realm)
 *
 * This portal is ONLY accessible by users of the default staff tenant.
 * Uses Keycloak ananta-saas realm for authentication.
 *
 * Required roles: super_admin, admin, or engineer
 */

import Keycloak from 'keycloak-js';

// Keycloak configuration from environment
// Default to ananta-saas realm (staff tenant)
export const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'ananta-saas',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'backstage-portal',
};

// Required roles for access (from environment or defaults)
const requiredRolesEnv = import.meta.env.VITE_REQUIRED_ROLES || 'super_admin,admin,engineer';
export const REQUIRED_ROLES: string[] = requiredRolesEnv.split(',').map((r: string) => r.trim());

// Create Keycloak instance (singleton)
let keycloakInstance: Keycloak | null = null;

export const getKeycloak = (): Keycloak => {
  if (!keycloakInstance) {
    keycloakInstance = new Keycloak(keycloakConfig);
  }
  return keycloakInstance;
};

// Initialize Keycloak with check-sso (silent SSO check)
export const initKeycloak = async (): Promise<boolean> => {
  const keycloak = getKeycloak();

  try {
    const authenticated = await keycloak.init({
      onLoad: 'check-sso', // Check SSO silently without redirect
      silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
      pkceMethod: 'S256',
      checkLoginIframe: false, // Disable iframe check for better cross-origin support
    });

    console.log('[Keycloak] Initialized, authenticated:', authenticated);
    console.log('[Keycloak] Realm:', keycloakConfig.realm);

    // Setup token refresh
    if (authenticated) {
      setupTokenRefresh(keycloak);
    }

    return authenticated;
  } catch (error) {
    console.error('[Keycloak] Init error:', error);
    return false;
  }
};

// Setup automatic token refresh
const setupTokenRefresh = (keycloak: Keycloak) => {
  // Refresh token when it expires in 60 seconds
  setInterval(async () => {
    if (keycloak.token && keycloak.isTokenExpired(60)) {
      try {
        const refreshed = await keycloak.updateToken(60);
        if (refreshed) {
          console.log('[Keycloak] Token refreshed');
        }
      } catch (error) {
        console.error('[Keycloak] Token refresh failed:', error);
        // Token refresh failed, force login
        keycloak.login();
      }
    }
  }, 30000); // Check every 30 seconds
};

// Get current user roles from token
export const getUserRoles = (): string[] => {
  const keycloak = getKeycloak();
  const token = keycloak.tokenParsed;

  if (!token) return [];

  // Get realm roles
  const realmRoles = token.realm_access?.roles || [];

  // Get resource/client roles
  const clientRoles = token.resource_access?.[keycloakConfig.clientId]?.roles || [];

  return [...realmRoles, ...clientRoles];
};

// Check if user has ANY of the required roles
export const hasRequiredRole = (): boolean => {
  const userRoles = getUserRoles();
  return REQUIRED_ROLES.some(role => userRoles.includes(role));
};

// Check if user has specific role
export const hasRole = (role: string): boolean => {
  return getUserRoles().includes(role);
};

// Check if user is admin (has admin or super_admin role)
export const isAdmin = (): boolean => {
  const roles = getUserRoles();
  return roles.includes('admin') || roles.includes('super_admin') || roles.includes('super-admin');
};

// Check if user is super admin
export const isSuperAdmin = (): boolean => {
  return hasRole('super_admin') || hasRole('super-admin');
};

// Get user info from token
export const getUserInfo = () => {
  const keycloak = getKeycloak();
  const token = keycloak.tokenParsed;

  if (!token) return null;

  const givenName = token.given_name || '';
  const familyName = token.family_name || '';
  const fullNameFromParts = (givenName + ' ' + familyName).trim();

  return {
    id: token.sub,
    username: token.preferred_username,
    email: token.email,
    firstName: givenName,
    lastName: familyName,
    fullName: token.name || fullNameFromParts,
    roles: getUserRoles(),
  };
};

// Get access token for API calls
export const getAccessToken = (): string | undefined => {
  return getKeycloak().token;
};

// Login
export const login = (redirectUri?: string) => {
  getKeycloak().login({
    redirectUri: redirectUri || window.location.origin,
  });
};

// Logout
export const logout = (redirectUri?: string) => {
  getKeycloak().logout({
    redirectUri: redirectUri || window.location.origin,
  });
};

// Export keycloak instance for advanced usage
export { keycloakInstance };
