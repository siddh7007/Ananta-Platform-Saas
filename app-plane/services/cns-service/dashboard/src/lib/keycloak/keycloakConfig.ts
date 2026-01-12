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
let initializationPromise: Promise<boolean> | null = null;
let isInitialized = false;

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

// Initialize Keycloak - handles both callback and fresh page loads
// Prevents double-initialization which causes "can only be initialized once" error
export const initKeycloak = async (): Promise<boolean> => {
  // If already initialized, return the cached result
  if (isInitialized) {
    const keycloak = getKeycloak();
    console.log('[Keycloak] Already initialized, returning cached state:', keycloak.authenticated);
    return keycloak.authenticated || false;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    console.log('[Keycloak] Initialization in progress, waiting...');
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = (async () => {
    const keycloak = getKeycloak();
    const isCallback = hasOAuthCallback();
    const baseUrl = getBaseUrl();

    console.log('[Keycloak] Initializing...', { isCallback, baseUrl, url: window.location.href });

    try {
      // When handling OAuth callback, don't use check-sso (causes iframe timeout)
      // Just initialize and let Keycloak process the auth code
      const initOptions: Keycloak.KeycloakInitOptions = {
        pkceMethod: 'S256',
        checkLoginIframe: false, // Disable iframe check - causes timeouts
        redirectUri: baseUrl,
        responseMode: 'query',
      };

      // Don't auto-login - always show login page first
      // Users must explicitly click "Sign In" to authenticate
      // This prevents automatic SSO redirect and shows the login UI
      // Note: Remove this block and use 'check-sso' if you want automatic SSO
      // if (!isCallback) {
      //   initOptions.onLoad = 'check-sso';
      //   initOptions.silentCheckSsoRedirectUri = baseUrl + 'silent-check-sso.html';
      // }

      const authenticated = await keycloak.init(initOptions);

      console.log('[Keycloak] Initialized, authenticated:', authenticated);
      isInitialized = true;

      // Log detailed info when OAuth callback fails
      if (isCallback && !authenticated) {
        console.error('[Keycloak] OAuth callback returned authenticated=false', {
          // Check for Keycloak error properties
          // @ts-expect-error Keycloak error properties may not be typed
          error: keycloak.error,
          // @ts-expect-error Keycloak error properties may not be typed
          errorDescription: keycloak.errorDescription,
          tokenParsed: keycloak.tokenParsed,
          token: keycloak.token ? 'present' : 'missing',
          refreshToken: keycloak.refreshToken ? 'present' : 'missing',
          idToken: keycloak.idToken ? 'present' : 'missing',
          responseMode: initOptions.responseMode,
          pkceMethod: initOptions.pkceMethod,
          redirectUri: initOptions.redirectUri,
          currentUrl: window.location.href,
        });
        // Don't clean params yet - let user see what failed
      }

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
      isInitialized = true; // Mark as initialized even on error to prevent retry loops
      // If callback failed, clean URL and return false
      if (isCallback) {
        cleanOAuthParamsFromUrl();
      }
      return false;
    }
  })();

  return initializationPromise;
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
