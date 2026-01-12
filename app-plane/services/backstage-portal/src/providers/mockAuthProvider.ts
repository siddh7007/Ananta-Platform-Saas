import { AuthProvider } from 'react-admin';

/**
 * Mock Auth Provider for Demo/Testing
 *
 * Bypasses authentication to allow UI testing without Supabase
 * Use this temporarily until Supabase is fully configured
 */
export const mockAuthProvider: AuthProvider = {
  login: async ({ username, password }) => {
    // Accept any username/password for demo
    localStorage.setItem('user', JSON.stringify({
      id: 'demo-user-001',
      email: username,
      fullName: 'Demo User',
    }));
    return Promise.resolve();
  },

  logout: async () => {
    localStorage.removeItem('user');
    return Promise.resolve();
  },

  checkAuth: async () => {
    // Always authenticated in demo mode
    return localStorage.getItem('user')
      ? Promise.resolve()
      : Promise.reject();
  },

  checkError: async (error) => {
    return Promise.resolve();
  },

  getPermissions: async () => {
    return Promise.resolve('admin'); // Full access in demo
  },

  getIdentity: async () => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return Promise.resolve(JSON.parse(userStr));
    }
    return Promise.resolve({
      id: 'demo-user-001',
      fullName: 'Demo User',
      email: 'demo@example.com',
    });
  },
};

/**
 * Demo credentials (accept anything):
 * Username: demo@example.com (or anything)
 * Password: demo (or anything)
 */
