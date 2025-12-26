/**
 * Keycloak Auth Provider - Using Local Auth Library
 *
 * This provider uses the local lib/auth/keycloak module
 * which provides Keycloak OIDC authentication for ARC-SaaS integration.
 *
 * The auth library handles:
 * - Keycloak authentication flow (OAuth2/OIDC)
 * - JWT token management and refresh
 * - Tenant context from Keycloak groups/claims
 * - Role-based access control
 * - Data provider cache clearing on logout
 */

import { createKeycloakAuthProvider, getKeycloakState } from '../lib/auth';
import { publishCustomEvent } from '../services/eventPublisher';
import { clearCache } from './cacheManager';

/**
 * Keycloak Auth Provider configured for ARC-SaaS
 *
 * Features:
 * - Keycloak OIDC authentication
 * - Tenant ID from JWT claims (tenant_id or groups)
 * - Role-based permissions from realm_access/resource_access
 * - Data provider cache clearing on logout
 * - Event publishing for auth events
 */
export const keycloakAuthProvider = createKeycloakAuthProvider({
  keycloakUrl: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'ananta-saas',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'bom-portal',
  controlPlaneApiUrl: import.meta.env.VITE_CONTROL_PLANE_API_URL || 'http://localhost:14000',
  enableGateLogging: import.meta.env.VITE_ENABLE_GATE_LOGGING !== 'false',
  onClearCache: clearCache,

  // Custom event hooks for RabbitMQ integration
  onLogin: async (user) => {
    await publishCustomEvent(
      'auth.user.login',
      'user_login',
      {
        user_id: user.id,
        email: user.email || 'unknown',
        auth_provider: 'keycloak',
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

// Re-export for convenience
export { getKeycloakState };

// Export for backward compatibility (if needed elsewhere)
export { clearCache as clearDataProviderCache };
