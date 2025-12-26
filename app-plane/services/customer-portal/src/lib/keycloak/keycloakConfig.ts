/**
 * Keycloak Configuration - Components Platform SSO
 *
 * Single Sign-On across all portals:
 * - backstage-portal (Admin/Staff)
 * - customer-portal (Customers)
 * - dashboard (Unified)
 * - cns-dashboard (CNS Admin)
 */

import Keycloak from 'keycloak-js';

// Keycloak configuration from environment
export const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'components-platform',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'customer-portal',
};

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

// Check if user has specific role
export const hasRole = (role: string): boolean => {
  return getUserRoles().includes(role);
};

// Check if user is admin (has admin or super-admin role)
export const isAdmin = (): boolean => {
  const roles = getUserRoles();
  return roles.includes('admin') || roles.includes('super-admin');
};

// Check if user is super admin
export const isSuperAdmin = (): boolean => {
  return hasRole('super-admin');
};

// Get user info from token
export const getUserInfo = () => {
  const keycloak = getKeycloak();
  const token = keycloak.tokenParsed;

  if (!token) return null;

  return {
    id: token.sub,
    username: token.preferred_username,
    email: token.email,
    firstName: token.given_name,
    lastName: token.family_name,
    fullName: token.name || `${token.given_name || ''} ${token.family_name || ''}`.trim(),
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
