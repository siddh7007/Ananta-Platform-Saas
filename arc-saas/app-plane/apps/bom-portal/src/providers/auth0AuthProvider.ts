/**
 * Auth0 Auth Provider - Using Local Auth Library
 *
 * This provider uses the local lib/auth module
 * which provides Auth0 + Supabase integration.
 *
 * The auth library handles:
 * - Auth0 authentication flow
 * - Middleware API integration for session creation
 * - Platform admin organization detection
 * - Data provider cache clearing on logout
 */

import { createAuth0AuthProvider, getAuth0State } from '../lib/auth';
import { supabase } from './dataProvider';
import { publishCustomEvent } from '../services/eventPublisher';
import { clearCache } from './cacheManager';

/**
 * Wrapper function to get Auth0 access token from the shared state
 *
 * This bridges the gap between:
 * - Auth0's getAccessTokenSilently (which requires React hooks/context)
 * - The auth provider (which is created outside React context)
 *
 * The Auth0StateSync component syncs getAccessTokenSilently to the shared state
 * when Auth0 initializes, making it available here.
 */
async function getAccessTokenFromState(): Promise<string> {
  const state = getAuth0State();

  console.log('[getAccessTokenFromState] State:', 'isAuthenticated:', state.isAuthenticated, 'isLoading:', state.isLoading, 'hasGetAccessTokenSilently:', !!state.getAccessTokenSilently, 'type:', typeof state.getAccessTokenSilently);

  if (!state.getAccessTokenSilently) {
    console.error('[Auth0AuthProvider] getAccessTokenSilently not available in shared state');
    throw new Error('Auth0 not initialized - token function not available');
  }

  try {
    console.log('[getAccessTokenFromState] Calling getAccessTokenSilently...');
    const token = await state.getAccessTokenSilently();
    console.log('[getAccessTokenFromState] Token received:', token ? 'yes (length: ' + token.length + ')' : 'null/undefined');
    return token;
  } catch (err) {
    console.error('[getAccessTokenFromState] Error calling getAccessTokenSilently:', err);
    throw err;
  }
}

// Export for backward compatibility (if needed elsewhere)
export { clearCache as clearDataProviderCache };

/**
 * Auth0 Auth Provider configured with local auth library
 *
 * Features:
 * - Automatic platform admin detection via /admin-login route
 * - Organization ID enforcement for platform admins
 * - Middleware API integration for Supabase session creation
 * - Data provider cache clearing on logout
 */
export const auth0AuthProvider = createAuth0AuthProvider({
  supabase,
  auth0Domain: import.meta.env.VITE_AUTH0_DOMAIN!,
  auth0ClientId: import.meta.env.VITE_AUTH0_CLIENT_ID!,
  middlewareUrl: import.meta.env.VITE_MIDDLEWARE_API_URL || 'http://localhost:27700',
  platformOrgId: 'org_oNtVXvVrzXz1ubua',
  enableGateLogging: import.meta.env.VITE_ENABLE_GATE_LOGGING !== 'false',
  onClearCache: clearCache,

  // Option A: Use Auth0 JWT directly with Supabase PostgREST
  // When enabled, Auth0 JWT is used directly instead of middleware-generated Supabase JWT
  useDirectAuth0JWT: import.meta.env.VITE_USE_DIRECT_AUTH0_JWT === 'true',

  // Provide the getAccessToken function for Option A (Direct Auth0 JWT)
  // This wrapper retrieves getAccessTokenSilently from the shared Auth0 state
  getAccessToken: getAccessTokenFromState,

  // Custom event hooks for RabbitMQ integration
  onLogin: async (user) => {
    await publishCustomEvent(
      'auth.user.login',
      'user_login',
      {
        user_id: user.id,
        email: user.email || 'unknown',
        auth_provider: user.provider || 'auth0',
        ip_address: 'browser',
        user_agent: navigator.userAgent,
      },
      6 // High priority for security events
    );
  },

  onLogout: async () => {
    const userId = localStorage.getItem('user_id');
    const userEmail = localStorage.getItem('user_email');

    if (userId && userEmail) {
      await publishCustomEvent(
        'auth.user.logout',
        'user_logout',
        {
          user_id: userId,
          email: userEmail,
        },
        6 // High priority for security events
      );
    }
  },
});
