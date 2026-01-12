/**
 * Keycloak Auth Provider for React Admin
 *
 * Alternative to Auth0 - configured via VITE_AUTH_PROVIDER=keycloak
 *
 * Features:
 * - SSO across all portals (same credentials)
 * - Role-based access control (super-admin, admin, staff)
 * - Automatic token refresh
 * - Silent SSO check
 */

import { AuthProvider } from 'react-admin';
import {
  getKeycloak,
  initKeycloak,
  getUserInfo,
  getUserRoles,
  login,
  logout,
  getAccessToken,
} from './keycloakConfig';

// Track initialization state
let initPromise: Promise<boolean> | null = null;

// Ensure Keycloak is initialized before any auth operation
const ensureInitialized = async (): Promise<boolean> => {
  if (!initPromise) {
    initPromise = initKeycloak();
  }
  return initPromise;
};

/**
 * Keycloak Auth Provider for React Admin
 */
export const keycloakAuthProvider: AuthProvider = {
  /**
   * Login - redirects to Keycloak login page
   */
  login: async () => {
    await ensureInitialized();
    const keycloak = getKeycloak();

    if (!keycloak.authenticated) {
      login();
      // This will redirect, so we return a never-resolving promise
      return new Promise(() => {});
    }

    return Promise.resolve();
  },

  /**
   * Logout - redirects to Keycloak logout
   */
  logout: async () => {
    await ensureInitialized();
    const keycloak = getKeycloak();

    if (keycloak.authenticated) {
      logout();
      // This will redirect, so we return a never-resolving promise
      return new Promise(() => {});
    }

    return Promise.resolve();
  },

  /**
   * Check if user is authenticated
   */
  checkAuth: async () => {
    const authenticated = await ensureInitialized();
    const keycloak = getKeycloak();

    if (authenticated && keycloak.authenticated) {
      return Promise.resolve();
    }

    // Not authenticated - trigger login
    return Promise.reject({ message: 'Not authenticated' });
  },

  /**
   * Handle authentication errors (401/403)
   */
  checkError: async (error) => {
    const status = error?.status || error?.response?.status;

    if (status === 401) {
      // Token expired or invalid - try to refresh
      const keycloak = getKeycloak();
      try {
        const refreshed = await keycloak.updateToken(5);
        if (refreshed) {
          return Promise.resolve();
        }
      } catch {
        // Refresh failed - force re-login
        return Promise.reject({ message: 'Session expired' });
      }
    }

    if (status === 403) {
      return Promise.reject({ message: 'Access denied' });
    }

    return Promise.resolve();
  },

  /**
   * Get user permissions (roles)
   */
  getPermissions: async () => {
    await ensureInitialized();
    const roles = getUserRoles();

    // Return roles as permissions
    // React Admin can use these for resource-level access control
    return Promise.resolve(roles);
  },

  /**
   * Get user identity for display
   */
  getIdentity: async () => {
    await ensureInitialized();
    const user = getUserInfo();

    if (!user) {
      return Promise.reject({ message: 'No user info' });
    }

    return Promise.resolve({
      id: user.id || 'unknown',
      fullName: user.fullName || user.username || 'User',
      avatar: undefined, // Keycloak doesn't have avatars by default
      email: user.email,
      // Additional fields for role-based UI
      roles: user.roles,
      username: user.username,
    });
  },
};

/**
 * Get access token for API calls
 * Use this in data providers to add Authorization header
 */
export const getToken = async (): Promise<string | null> => {
  await ensureInitialized();
  return getAccessToken() || null;
};

/**
 * Check if current user has specific role
 */
export const hasRole = async (role: string): Promise<boolean> => {
  await ensureInitialized();
  return getUserRoles().includes(role);
};

/**
 * Check if current user is admin
 */
export const isAdmin = async (): Promise<boolean> => {
  const roles = getUserRoles();
  return roles.includes('admin') || roles.includes('super-admin');
};

/**
 * Check if current user is super admin
 */
export const isSuperAdmin = async (): Promise<boolean> => {
  return getUserRoles().includes('super-admin');
};

export default keycloakAuthProvider;
