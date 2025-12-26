import { AuthProvider } from 'react-admin';
import { authConfig, validateDevModeAccess } from '../config/authConfig';

/**
 * Mock Auth Provider for Development/Testing
 *
 * SECURITY WARNING
 * This provider bypasses real authentication and should NEVER be used in production.
 * It is controlled by authConfig which enforces strict dev-only usage.
 *
 * Features:
 * - Short-lived sessions (configurable duration)
 * - IP-based access control (optional)
 * - Comprehensive logging of all auth events
 * - Automatic session expiration
 */

// Platform Super Admin organization ID - consistent across all portals
// Uses environment variable with fallback to seeded default
const PLATFORM_ORG_ID = import.meta.env.VITE_PLATFORM_ORG_ID || 'a0000000-0000-0000-0000-000000000000';

interface DevSession {
  id: string;
  email: string;
  fullName: string;
  user_metadata: {
    organization_id: string;
  };
  sessionStart: number;
  sessionExpiry: number;
}

const DEV_SESSION_KEY = 'dev_session';

/**
 * Create a new dev session with expiration
 */
const createDevSession = (username: string): DevSession => {
  const now = Date.now();
  const expiryMs = authConfig.sessionDurationMinutes * 60 * 1000;

  const session: DevSession = {
    id: 'demo-user-001',
    email: username,
    fullName: 'Demo User',
    user_metadata: {
      organization_id: PLATFORM_ORG_ID, // Platform Super Admin org ID
    },
    sessionStart: now,
    sessionExpiry: now + expiryMs,
  };

  if (authConfig.logAuthEvents) {
    const expiryDate = new Date(session.sessionExpiry).toLocaleString();
    console.log(
      `🔓 DEV SESSION CREATED\n` +
      `   User: ${username}\n` +
      `   Tenant: Ananta Platform\n` +
      `   Duration: ${authConfig.sessionDurationMinutes}min\n` +
      `   Expires: ${expiryDate}`
    );
  }

  return session;
};

/**
 * Check if a dev session is still valid
 */
const isSessionValid = (session: DevSession | null): boolean => {
  if (!session) return false;

  const now = Date.now();
  const isValid = now < session.sessionExpiry;

  if (!isValid && authConfig.logAuthEvents) {
    console.warn(
      `⏱️ DEV SESSION EXPIRED\n` +
      `   User: ${session.email}\n` +
      `   Expired: ${new Date(session.sessionExpiry).toLocaleString()}`
    );
  }

  return isValid;
};

/**
 * Get the current dev session if valid
 */
const getCurrentSession = (): DevSession | null => {
  const sessionStr = localStorage.getItem(DEV_SESSION_KEY);
  if (!sessionStr) return null;

  try {
    const session = JSON.parse(sessionStr) as DevSession;
    return isSessionValid(session) ? session : null;
  } catch {
    return null;
  }
};

export const mockAuthProvider: AuthProvider = {
  login: async ({ username, password }) => {
    // CRITICAL: Verify dev bypass is enabled
    if (!authConfig.devBypassEnabled) {
      if (authConfig.logAuthEvents) {
        console.error(
          '🚫 DEV BYPASS DISABLED\n' +
          'Mock authentication cannot be used when dev bypass is disabled. ' +
          'Use real authentication provider instead.'
        );
      }
      return Promise.reject(new Error('Dev bypass authentication is disabled'));
    }

    // Validate IP-based access if configured
    const accessAllowed = await validateDevModeAccess();
    if (!accessAllowed) {
      return Promise.reject(new Error('Access denied: IP not in allowed list'));
    }

    // Create and store new dev session
    const session = createDevSession(username);
    localStorage.setItem(DEV_SESSION_KEY, JSON.stringify(session));

    // Also store for compatibility
    localStorage.setItem('user', JSON.stringify({
      id: session.id,
      email: session.email,
      fullName: session.fullName,
      user_metadata: session.user_metadata,
    }));
    localStorage.setItem('user_id', session.id);
    localStorage.setItem('user_email', session.email);
    localStorage.setItem('user_name', session.fullName);
    localStorage.setItem('organization_id', session.user_metadata.organization_id);

    return Promise.resolve();
  },

  logout: async () => {
    const session = getCurrentSession();

    if (authConfig.logAuthEvents && session) {
      const durationMin = Math.round((Date.now() - session.sessionStart) / 60000);
      console.log(
        `🔐 DEV SESSION ENDED\n` +
        `   User: ${session.email}\n` +
        `   Duration: ${durationMin}min of ${authConfig.sessionDurationMinutes}min`
      );
    }

    localStorage.removeItem(DEV_SESSION_KEY);
    localStorage.removeItem('user');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_name');
    return Promise.resolve();
  },

  checkAuth: async () => {
    // CRITICAL: Verify dev bypass is enabled
    if (!authConfig.devBypassEnabled) {
      return Promise.reject(new Error('Dev bypass authentication is disabled'));
    }

    const session = getCurrentSession();

    if (!session) {
      if (authConfig.logAuthEvents) {
        console.warn('🔒 No valid dev session found. Please log in.');
      }
      return Promise.reject(new Error('No valid dev session'));
    }

    return Promise.resolve();
  },

  checkError: async (error) => {
    // In dev mode, be lenient with errors unless session expired
    const session = getCurrentSession();
    if (!session) {
      return Promise.reject(new Error('Session expired'));
    }
    return Promise.resolve();
  },

  getPermissions: async () => {
    // Full admin access in dev mode
    return Promise.resolve('admin');
  },

  getIdentity: async () => {
    const session = getCurrentSession();

    if (session) {
      return Promise.resolve({
        id: session.id,
        fullName: session.fullName,
        email: session.email,
        user_metadata: session.user_metadata,
      });
    }

    // Fallback for compatibility
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return Promise.resolve(JSON.parse(userStr));
    }

    return Promise.resolve({
      id: 'demo-user-001',
      fullName: 'Demo User',
      email: 'demo@example.com',
      user_metadata: {
        organization_id: PLATFORM_ORG_ID, // Platform Super Admin org ID
      },
    });
  },
};

/**
 * Demo credentials (accept anything):
 * Username: demo@example.com (or anything)
 * Password: demo (or anything)
 */
