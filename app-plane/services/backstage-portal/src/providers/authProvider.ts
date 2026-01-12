import { AuthProvider } from 'react-admin';
import { supabase } from './dataProvider';

/**
 * Supabase Auth Provider for React Admin
 *
 * Handles:
 * - Login (email/password)
 * - Logout
 * - Check authentication
 * - Check error (401/403 handling)
 * - Get permissions (role-based access control)
 * - Get identity (user profile)
 */
export const authProvider: AuthProvider = {
  /**
   * Login with email and password
   *
   * @example
   * authProvider.login({ username: 'user@example.com', password: 'password123' })
   */
  login: async ({ username, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: username,
      password: password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data?.session) {
      // Store session in localStorage (handled by Supabase client)
      // Store user metadata for quick access
      localStorage.setItem('user', JSON.stringify(data.user));
      return Promise.resolve();
    }

    throw new Error('Login failed');
  },

  /**
   * Logout and clear session
   */
  logout: async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    localStorage.removeItem('user');
    return Promise.resolve();
  },

  /**
   * Check if user is authenticated
   */
  checkAuth: async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      return Promise.resolve();
    }

    return Promise.reject();
  },

  /**
   * Handle authentication errors
   * Called when API returns 401 or 403
   */
  checkError: async (error) => {
    const status = error.status;

    if (status === 401 || status === 403) {
      localStorage.removeItem('user');
      return Promise.reject();
    }

    return Promise.resolve();
  },

  /**
   * Get user permissions
   * Used for role-based access control
   *
   * Returns user role from JWT claims
   */
  getPermissions: async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Promise.reject();
    }

    // Get role from user metadata or JWT claims
    const role = user.user_metadata?.role || user.role || 'user';

    return Promise.resolve(role);
  },

  /**
   * Get user identity
   * Used to display user info in app bar
   */
  getIdentity: async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Promise.reject();
    }

    return Promise.resolve({
      id: user.id,
      fullName: user.user_metadata?.full_name || user.email,
      avatar: user.user_metadata?.avatar_url,
      email: user.email,
    });
  },
};

/**
 * Helper function to get current user
 */
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

/**
 * Helper function to check if user has specific role
 */
export const hasRole = async (role: string): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return false;

  const userRole = user.user_metadata?.role || user.role || 'user';

  return userRole === role;
};

/**
 * Helper function to check if user is admin
 */
export const isAdmin = async (): Promise<boolean> => {
  return hasRole('admin');
};

/**
 * Sign up a new user
 * Not part of React Admin auth provider, but useful for registration
 */
export const signUp = async (email: string, password: string, metadata?: any) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

/**
 * Reset password
 */
export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/admin/reset-password`,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Promise.resolve();
};

/**
 * Update password
 */
export const updatePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Promise.resolve();
};

/**
 * Get access token for API requests
 * Used by data providers to authenticate requests to backend APIs
 */
export const getToken = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};
