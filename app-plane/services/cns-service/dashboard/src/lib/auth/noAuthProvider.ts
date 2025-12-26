/**
 * No-Auth Provider for Development
 *
 * Bypasses authentication for local development and testing.
 * Use VITE_AUTH_PROVIDER=none to enable.
 *
 * WARNING: Never use in production!
 */

import { AuthProvider } from 'react-admin';

/**
 * Mock user identity for no-auth mode
 */
const mockIdentity = {
  id: 'dev-user-001',
  fullName: 'Development User',
  email: 'dev@localhost',
  role: 'super_admin',
  roles: ['super_admin', 'admin', 'customer'],
  avatar: undefined,
};

/**
 * No-auth provider that always returns authenticated
 */
export const noAuthProvider: AuthProvider = {
  login: async () => {
    console.log('[NoAuth] Login called - auto-authenticated');
    return Promise.resolve();
  },

  logout: async () => {
    console.log('[NoAuth] Logout called');
    return Promise.resolve();
  },

  checkAuth: async () => {
    console.log('[NoAuth] checkAuth - always authenticated');
    return Promise.resolve();
  },

  checkError: async (error: any) => {
    console.log('[NoAuth] checkError:', error);
    // Don't trigger logout on errors in dev mode
    return Promise.resolve();
  },

  getIdentity: async () => {
    console.log('[NoAuth] getIdentity - returning mock user');
    return Promise.resolve(mockIdentity);
  },

  getPermissions: async () => {
    console.log('[NoAuth] getPermissions - returning super_admin');
    return Promise.resolve(['super_admin', 'admin', 'customer']);
  },
};

export default noAuthProvider;
