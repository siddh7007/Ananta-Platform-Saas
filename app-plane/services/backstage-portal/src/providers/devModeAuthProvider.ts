/**
 * Dev Mode Auth Provider
 * Bypass authentication for development with dev@ananta.com user
 */

import { AuthProvider } from 'react-admin';

const DEV_USER = {
  id: 'dev-ananta-temp',
  email: 'dev@ananta.com',
  fullName: 'Ananta Developer',
  organizationId: null, // Will be set after login
  role: 'owner',
};

export const devModeAuthProvider: AuthProvider = {
  // Login - bypass authentication
  login: async ({ username }: { username: string }) => {
    // Accept any login in dev mode, but use dev@ananta.com credentials
    localStorage.setItem('devMode', 'true');
    localStorage.setItem('devUser', JSON.stringify(DEV_USER));

    console.log('🔓 DEV MODE: Logged in as dev@ananta.com with full access');
    return Promise.resolve();
  },

  // Logout
  logout: async () => {
    localStorage.removeItem('devMode');
    localStorage.removeItem('devUser');
    console.log('🔓 DEV MODE: Logged out');
    return Promise.resolve();
  },

  // Check authentication
  checkAuth: async () => {
    const devMode = localStorage.getItem('devMode');
    if (devMode === 'true') {
      return Promise.resolve();
    }
    return Promise.reject();
  },

  // Check error
  checkError: async (error: any) => {
    const status = error.status;
    if (status === 401 || status === 403) {
      // In dev mode, never reject on auth errors
      return Promise.resolve();
    }
    return Promise.resolve();
  },

  // Get identity
  getIdentity: async () => {
    const devUser = localStorage.getItem('devUser');
    if (devUser) {
      const user = JSON.parse(devUser);
      return Promise.resolve({
        id: user.id,
        fullName: user.fullName,
        avatar: undefined,
      });
    }
    return Promise.reject();
  },

  // Get permissions
  getPermissions: async () => {
    // Dev mode has full permissions
    return Promise.resolve({
      role: 'owner',
      permissions: ['read', 'write', 'create', 'delete', 'admin'],
    });
  },
};

/**
 * Check if dev mode is enabled
 */
export const isDevMode = (): boolean => {
  return localStorage.getItem('devMode') === 'true';
};

/**
 * Get dev user info
 */
export const getDevUser = () => {
  const devUser = localStorage.getItem('devUser');
  return devUser ? JSON.parse(devUser) : null;
};
