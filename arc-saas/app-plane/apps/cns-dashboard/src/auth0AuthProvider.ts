/**
 * Auth0 Auth Provider - CNS Dashboard (Platform Admins Only)
 *
 * This provider uses the local lib/auth module
 * with STRICT platform organization enforcement.
 *
 * CNS Dashboard is a platform staff tool, so ALL users must be platform admins.
 */

import { createAuth0AuthProvider } from './lib/auth';
import { createClient } from '@supabase/supabase-js';
import { publishCustomEvent } from './services/eventPublisher';
import { clearCache } from './cacheManager';

// Create stub Supabase client for Auth0Auth provider compatibility
// CNS Dashboard doesn't actually use Supabase auth, but the auth library requires it
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:5433';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJzdWIiOiJhbm9ueW1vdXMiLCJyb2xlIjoiYW5vbiIsInJlZiI6ImxvY2FsaG9zdCIsImlhdCI6MTc2MjM3OTgwMywiZXhwIjoxOTIwMDU5ODAzfQ.j1nHQ-lkDL6slYZpBOuLCHSm40Uay_SHHHCv3fYYcWQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Export for backward compatibility
export { clearCache as clearDataProviderCache };

/**
 * Auth0 Auth Provider configured for CNS Dashboard
 *
 * Features:
 * - STRICT platform admin enforcement (org_oNtVXvVrzXz1ubua)
 * - ALL users MUST access via /admin-login route
 * - Middleware API integration for Supabase session creation
 * - Data provider cache clearing on logout
 * - RabbitMQ event publishing for login/logout
 */
export const auth0AuthProvider = createAuth0AuthProvider({
  supabase,
  auth0Domain: import.meta.env.VITE_AUTH0_DOMAIN!,
  auth0ClientId: import.meta.env.VITE_AUTH0_CLIENT_ID!,
  middlewareUrl: import.meta.env.VITE_MIDDLEWARE_API_URL || 'http://localhost:27700',
  platformOrgId: 'org_oNtVXvVrzXz1ubua', // REQUIRED - Platform admin organization
  namespace: import.meta.env.VITE_AUTH0_NAMESPACE || 'https://ananta.component.platform',
  allowedRoles: ['platform:admin', 'platform:staff', 'platform:super_admin'],
  enableGateLogging: import.meta.env.VITE_ENABLE_GATE_LOGGING !== 'false',
  // Use Auth0 JWT directly with Supabase PostgREST (Option A)
  useDirectAuth0JWT: import.meta.env.VITE_USE_DIRECT_AUTH0_JWT === 'true',
  onClearCache: clearCache,

  // Custom event hooks for RabbitMQ integration (CNS-specific events)
  onLogin: async (user) => {
    await publishCustomEvent(
      'auth.cns.login',
      'cns_user_login',
      {
        user_id: user.id,
        email: user.email || 'unknown',
        auth_provider: user.provider || 'auth0',
        ip_address: 'browser',
        user_agent: navigator.userAgent,
        source: 'cns-dashboard',
      },
      6 // High priority for security events
    );
  },

  onLogout: async () => {
    const userId = localStorage.getItem('user_id');
    const userEmail = localStorage.getItem('user_email');

    if (userId && userEmail) {
      await publishCustomEvent(
        'auth.cns.logout',
        'cns_user_logout',
        {
          user_id: userId,
          email: userEmail,
          source: 'cns-dashboard',
        },
        6 // High priority for security events
      );
    }
  },
});
