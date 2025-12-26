/**
 * Keycloak Auth Provider for React Admin - Dashboard (Next.js)
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

let initPromise: Promise<boolean> | null = null;

const ensureInitialized = async (): Promise<boolean> => {
  if (!initPromise) {
    initPromise = initKeycloak();
  }
  return initPromise;
};

export const keycloakAuthProvider: AuthProvider = {
  login: async () => {
    await ensureInitialized();
    const keycloak = getKeycloak();

    if (!keycloak.authenticated) {
      login();
      return new Promise(() => {});
    }

    return Promise.resolve();
  },

  logout: async () => {
    await ensureInitialized();
    const keycloak = getKeycloak();

    if (keycloak.authenticated) {
      logout();
      return new Promise(() => {});
    }

    return Promise.resolve();
  },

  checkAuth: async () => {
    const authenticated = await ensureInitialized();
    const keycloak = getKeycloak();

    if (authenticated && keycloak.authenticated) {
      return Promise.resolve();
    }

    return Promise.reject({ message: 'Not authenticated' });
  },

  checkError: async (error) => {
    const status = error?.status || error?.response?.status;

    if (status === 401) {
      const keycloak = getKeycloak();
      try {
        const refreshed = await keycloak.updateToken(5);
        if (refreshed) {
          return Promise.resolve();
        }
      } catch {
        return Promise.reject({ message: 'Session expired' });
      }
    }

    if (status === 403) {
      return Promise.reject({ message: 'Access denied' });
    }

    return Promise.resolve();
  },

  getPermissions: async () => {
    await ensureInitialized();
    const roles = getUserRoles();
    return Promise.resolve(roles);
  },

  getIdentity: async () => {
    await ensureInitialized();
    const user = getUserInfo();

    if (!user) {
      return Promise.reject({ message: 'No user info' });
    }

    return Promise.resolve({
      id: user.id || 'unknown',
      fullName: user.fullName || user.username || 'User',
      avatar: undefined,
      email: user.email,
      roles: user.roles,
      username: user.username,
    });
  },
};

export const getToken = async (): Promise<string | null> => {
  await ensureInitialized();
  return getAccessToken() || null;
};

export default keycloakAuthProvider;
