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
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'cns-dashboard',
};

// Create Keycloak instance (singleton)
let keycloakInstance: Keycloak | null = null;

export const getKeycloak = (): Keycloak => {
  if (!keycloakInstance) {
    keycloakInstance = new Keycloak(keycloakConfig);
  }
  return keycloakInstance;
};

// Get the base URL for redirects (handles /cns/ base path)
const getBaseUrl = (): string => {
  const base = import.meta.env.BASE_URL || '/';
  return window.location.origin + base;
};

// Check if URL contains OAuth callback params (in query string OR hash fragment)
const hasOAuthCallback = (): boolean => {
  // Check query string params
  const queryParams = new URLSearchParams(window.location.search);
  const hasQueryCallback = queryParams.has('code') && queryParams.has('state');

  // Check hash fragment params (Keycloak sometimes puts OAuth params in hash)
  const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
  const hasHashCallback = hashParams.has('code') && hashParams.has('state');

  // Also check if the hash contains OAuth-like params (after #/)
  const hashPath = window.location.hash;
  const hasHashPathCallback = hashPath.includes('code=') && hashPath.includes('state=');

  return hasQueryCallback || hasHashCallback || hasHashPathCallback;
};

// Clean OAuth params from URL after successful authentication
const cleanOAuthParamsFromUrl = (): void => {
  // Remove OAuth params, redirect to base path with hash for react-admin
  const baseUrl = getBaseUrl();
  window.history.replaceState({}, document.title, baseUrl + '#/');
  console.log('[Keycloak] Cleaned OAuth params from URL, redirected to:', baseUrl);
};

// Initialize Keycloak with check-sso (silent SSO check)
export const initKeycloak = async (): Promise<boolean> => {
  const keycloak = getKeycloak();
  const isCallback = hasOAuthCallback();
  const baseUrl = getBaseUrl();

  console.log('[Keycloak] Initializing...', { isCallback, baseUrl, url: window.location.href });

  try {
    const authenticated = await keycloak.init({
      onLoad: 'check-sso', // Check SSO silently without redirect
      silentCheckSsoRedirectUri: baseUrl + 'silent-check-sso.html',
      pkceMethod: 'S256',
      checkLoginIframe: false, // Disable iframe check for better cross-origin support
      redirectUri: baseUrl, // Ensure redirect goes to base path (e.g., /cns/)
      responseMode: 'query', // Use query params instead of hash fragment (avoids conflicts with HashRouter)
    });

    console.log('[Keycloak] Initialized, authenticated:', authenticated);

    // Clean up OAuth params from URL after successful callback authentication
    if (isCallback && authenticated) {
      cleanOAuthParamsFromUrl();
    }

    // Setup token refresh
    if (authenticated) {
      setupTokenRefresh(keycloak);
    }

    return authenticated;
  } catch (error) {
    console.error('[Keycloak] Init error:', error);
    // If callback failed, clean URL and return false
    if (isCallback) {
      cleanOAuthParamsFromUrl();
    }
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
  const kc = getKeycloak();
  const token = kc.token;
  console.debug('[Keycloak] getAccessToken called, token exists:', !!token, 'authenticated:', kc.authenticated);
  return token;
};

// Login
export const login = (redirectUri?: string) => {
  const baseUrl = getBaseUrl();
  console.log('[Keycloak] Initiating login, redirect to:', redirectUri || baseUrl);
  getKeycloak().login({
    redirectUri: redirectUri || baseUrl,
  });
};

// Logout
export const logout = (redirectUri?: string) => {
  const baseUrl = getBaseUrl();
  console.log('[Keycloak] Initiating logout, redirect to:', redirectUri || baseUrl);
  getKeycloak().logout({
    redirectUri: redirectUri || baseUrl,
  });
};

// Export keycloak instance for advanced usage
export { keycloakInstance };
