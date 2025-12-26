/**
 * Auth0 Auth Provider - Backstage Portal (Platform Admins Only)
 *
 * This provider uses the local lib/auth module
 * with STRICT platform organization enforcement.
 *
 * The auth library handles:
 * - Auth0 authentication flow with organization enforcement
 * - Middleware API integration for session creation
 * - Platform admin organization detection (org_oNtVXvVrzXz1ubua)
 * - Data provider cache clearing on logout
 */

import { createAuth0AuthProvider } from '../lib/auth';
import { supabase } from './supabaseDataProvider';
import { clearCache } from './cacheManager';
import { publishCustomEvent } from '../services/eventPublisher';

// Export for backward compatibility
export { clearCache as clearDataProviderCache };

/**
 * Auth0 Auth Provider configured for Backstage Portal
 *
 * Features:
 * - STRICT platform admin enforcement (org_oNtVXvVrzXz1ubua)
 * - ALL users MUST access via /admin-login route
 * - Middleware API integration for Supabase session creation
 * - Data provider cache clearing on logout
 * - Organization ID filtering enforced
 */
export const auth0AuthProvider = createAuth0AuthProvider({
  supabase,
  auth0Domain: import.meta.env.VITE_AUTH0_DOMAIN!,
  auth0ClientId: import.meta.env.VITE_AUTH0_CLIENT_ID!,
  middlewareUrl: import.meta.env.VITE_MIDDLEWARE_API_URL || 'http://localhost:27700',
  platformOrgId: 'org_oNtVXvVrzXz1ubua', // REQUIRED - Platform admin organization
  namespace: import.meta.env.VITE_AUTH0_NAMESPACE || 'https://ananta.component.platform',
  allowedRoles: ['platform:admin', 'platform:staff', 'platform:super_admin'], // REQUIRED - Only these roles can access Backstage
  enableGateLogging: import.meta.env.VITE_ENABLE_GATE_LOGGING !== 'false',
  // Use Auth0 JWT directly with Supabase PostgREST (Option A)
  useDirectAuth0JWT: import.meta.env.VITE_USE_DIRECT_AUTH0_JWT === 'true',
  onClearCache: clearCache,

  // Custom event hooks for RabbitMQ integration (Backstage-specific events)
  onLogin: async (user) => {
    await publishCustomEvent(
      'auth.backstage.login',
      'backstage_user_login',
      {
        user_id: user.id,
        email: user.email || 'unknown',
        auth_provider: user.provider || 'auth0',
        ip_address: 'browser',
        user_agent: navigator.userAgent,
        source: 'backstage-portal',
      },
      6 // High priority for security events
    );
  },

  onLogout: async () => {
    const userId = localStorage.getItem('user_id');
    const userEmail = localStorage.getItem('user_email');

    if (userId && userEmail) {
      await publishCustomEvent(
        'auth.backstage.logout',
        'backstage_user_logout',
        {
          user_id: userId,
          email: userEmail,
          source: 'backstage-portal',
        },
        6 // High priority for security events
      );
    }
  },
});
