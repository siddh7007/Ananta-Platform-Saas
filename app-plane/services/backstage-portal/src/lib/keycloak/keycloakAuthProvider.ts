/**
 * Keycloak Auth Provider for React Admin - Staff Tenant Only
 *
 * RESTRICTED ACCESS: Only users from the ananta-saas realm (staff tenant)
 * with required roles (super_admin, admin, engineer) can access this portal.
 *
 * Features:
 * - SSO with ananta-saas realm (staff tenant)
 * - Role-based access control
 * - Automatic token refresh
 * - Silent SSO check
 */

import { AuthProvider } from 'react-admin';
import {
  getKeycloak,
  initKeycloak,
  getUserInfo,
  getUserRoles,
  hasRequiredRole,
  login,
  logout,
  getAccessToken,
  REQUIRED_ROLES,
  keycloakConfig,
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
 * Restricted to staff tenant users only
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

    // Check if user has required role after login
    if (!hasRequiredRole()) {
      console.error('[Auth] Access denied - user lacks required roles:', REQUIRED_ROLES);
      logout();
      return Promise.reject({ 
        message: 'Access denied. This portal is restricted to staff users with roles: ' + REQUIRED_ROLES.join(', ')
      });
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
   * Check if user is authenticated AND has required role
   */
  checkAuth: async () => {
    const authenticated = await ensureInitialized();
    const keycloak = getKeycloak();

    if (authenticated && keycloak.authenticated) {
      // Also check required roles
      if (!hasRequiredRole()) {
        console.error('[Auth] User authenticated but lacks required roles');
        console.error('[Auth] User roles:', getUserRoles());
        console.error('[Auth] Required roles:', REQUIRED_ROLES);
        console.error('[Auth] Realm:', keycloakConfig.realm);
        return Promise.reject({ 
          message: 'Access denied. This portal requires one of: ' + REQUIRED_ROLES.join(', ')
        });
      }
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
  return roles.includes('admin') || roles.includes('super_admin') || roles.includes('super-admin');
};

/**
 * Check if current user is super admin
 */
export const isSuperAdmin = async (): Promise<boolean> => {
  const roles = getUserRoles();
  return roles.includes('super_admin') || roles.includes('super-admin');
};

export default keycloakAuthProvider;
