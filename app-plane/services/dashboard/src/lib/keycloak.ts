/**
 * Keycloak SSO Configuration
 *
 * Provides centralized authentication for all services
 */

import Keycloak from 'keycloak-js';

let keycloakInstance: Keycloak | null = null;

/**
 * Initialize Keycloak client
 */
export const initKeycloak = (): Keycloak => {
  if (keycloakInstance) {
    return keycloakInstance;
  }

  keycloakInstance = new Keycloak({
    url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8180',
    realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'components-platform',
    clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'dashboard',
  });

  return keycloakInstance;
};

/**
 * Get Keycloak instance
 */
export const getKeycloak = (): Keycloak => {
  if (!keycloakInstance) {
    throw new Error('Keycloak not initialized. Call initKeycloak() first.');
  }
  return keycloakInstance;
};

/**
 * Login to Keycloak
 */
export const login = async (): Promise<void> => {
  const keycloak = getKeycloak();

  try {
    const authenticated = await keycloak.init({
      onLoad: 'login-required',
      checkLoginIframe: false,
    });

    if (!authenticated) {
      throw new Error('Authentication failed');
    }
  } catch (error) {
    console.error('Keycloak login failed:', error);
    throw error;
  }
};

/**
 * Logout from Keycloak
 */
export const logout = (): void => {
  try {
    const keycloak = getKeycloak();
    // Check if keycloak is initialized and has logout function
    if (keycloak && typeof keycloak.logout === 'function') {
      keycloak.logout({
        redirectUri: window.location.origin,
      });
    } else {
      console.warn('[Keycloak] Logout called but Keycloak not fully initialized');
    }
  } catch (error) {
    console.error('[Keycloak] Logout error:', error);
    // Fallback: just reload the page to clear session
    window.location.href = window.location.origin;
  }
};

/**
 * Get user info
 */
export const getUserInfo = () => {
  const keycloak = getKeycloak();

  if (!keycloak.authenticated) {
    return null;
  }

  return {
    username: keycloak.tokenParsed?.preferred_username,
    email: keycloak.tokenParsed?.email,
    name: keycloak.tokenParsed?.name,
    roles: keycloak.tokenParsed?.realm_access?.roles || [],
  };
};

/**
 * Get access token
 */
export const getToken = (): string | undefined => {
  const keycloak = getKeycloak();
  return keycloak.token;
};

/**
 * Refresh token
 */
export const refreshToken = async (): Promise<boolean> => {
  const keycloak = getKeycloak();

  try {
    const refreshed = await keycloak.updateToken(30);
    return refreshed;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  const keycloak = getKeycloak();
  return keycloak.authenticated || false;
};
