/**
 * Secure Logout Service
 * CBP-P1-005: Token Revocation on Logout
 */

import { revokeAllTokens, TokenRevocationConfig } from './token-revocation';

const LOGOUT_CHANNEL = 'cbp-logout';

export interface SecureLogoutConfig extends TokenRevocationConfig {
  postLogoutRedirectUri?: string;
}

/**
 * Clear all local storage items related to auth
 * FIX C1: Added comprehensive auth key patterns including OIDC tokens
 * FIX C3: Added tenant-specific data cleanup
 * FIX H1: Added CBP-specific storage keys
 */
function clearAuthStorage(): void {
  const authKeys = [
    // Standard auth tokens
    'access_token',
    'refresh_token',
    'id_token',
    'token_expiry',
    'user',
    // OIDC token storage (CRITICAL - C1)
    'oidc.',
    // Legacy token storage (HIGH - H1)
    'arc_token',
    // Tenant data (CRITICAL - C3)
    'cbp_selected_tenant',
    'cbp_tenant_list',
    'cbp_tenant_settings',
    'selected_tenant',
    'selected_tenant_timestamp',
    // CBP-specific keys (HIGH - H1)
    'cbp_pending_invitation',
    'cbp_signup_return_url',
    'cbp_correlation_id',
    // Session management
    'pendingInvitationToken',
    'returnUrl',
  ];

  // Clear localStorage
  Object.keys(localStorage).forEach((key) => {
    if (authKeys.some((authKey) => key.includes(authKey))) {
      localStorage.removeItem(key);
    }
  });

  // Clear sessionStorage
  Object.keys(sessionStorage).forEach((key) => {
    if (authKeys.some((authKey) => key.includes(authKey))) {
      sessionStorage.removeItem(key);
    }
  });
}

/**
 * Clear auth-related cookies
 * FIX H2: Improved cookie clearing with proper flags and multiple paths/domains
 */
function clearAuthCookies(): void {
  const cookies = document.cookie.split(';');
  const domains = [
    window.location.hostname,
    `.${window.location.hostname}`,
    '', // No domain (default)
  ];
  const paths = ['/', '/auth', '/realms'];

  cookies.forEach((cookie) => {
    const name = cookie.split('=')[0].trim();
    if (
      name.includes('token') ||
      name.includes('auth') ||
      name.includes('session') ||
      name.toLowerCase().includes('keycloak') ||
      name.toLowerCase().includes('kc_')
    ) {
      // Clear cookie with multiple domain/path combinations
      domains.forEach((domain) => {
        paths.forEach((path) => {
          const domainStr = domain ? `domain=${domain};` : '';
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; ${domainStr} SameSite=Lax`;
        });
      });
    }
  });
}

/**
 * Notify other tabs about logout
 * FIX M1: Delay channel close to ensure message delivery
 */
function broadcastLogout(): void {
  try {
    const channel = new BroadcastChannel(LOGOUT_CHANNEL);
    channel.postMessage({ type: 'logout', timestamp: Date.now() });
    // Delay close to ensure message is delivered (100ms is sufficient for BroadcastChannel)
    setTimeout(() => channel.close(), 100);
  } catch {
    // BroadcastChannel not supported
  }
}

/**
 * Listen for logout events from other tabs
 */
export function setupLogoutListener(onLogout: () => void): () => void {
  try {
    const channel = new BroadcastChannel(LOGOUT_CHANNEL);
    channel.onmessage = (event) => {
      if (event.data?.type === 'logout') {
        onLogout();
      }
    };
    return () => channel.close();
  } catch {
    return () => {};
  }
}

/**
 * Perform complete secure logout
 * FIX C2: Added ID token parameter and revocation
 */
export async function secureLogout(
  config: SecureLogoutConfig,
  accessToken?: string,
  refreshToken?: string,
  idToken?: string
): Promise<void> {
  // 1. Revoke tokens on server (FIX C2: include ID token)
  if (accessToken && refreshToken) {
    await revokeAllTokens(config, accessToken, refreshToken, idToken);
  }

  // 2. Clear local storage
  clearAuthStorage();

  // 3. Clear cookies
  clearAuthCookies();

  // 4. Notify other tabs
  broadcastLogout();

  // 5. Redirect to Keycloak logout
  const logoutUrl = new URL(
    `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/logout`
  );

  if (config.postLogoutRedirectUri) {
    logoutUrl.searchParams.set('post_logout_redirect_uri', config.postLogoutRedirectUri);
    logoutUrl.searchParams.set('client_id', config.clientId);
    // FIX C2: Include id_token_hint for proper OIDC logout
    if (idToken) {
      logoutUrl.searchParams.set('id_token_hint', idToken);
    }
  }

  window.location.href = logoutUrl.toString();
}
