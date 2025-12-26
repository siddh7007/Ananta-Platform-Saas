/**
 * Secure Logout Hook
 * CBP-P1-005: Token Revocation on Logout
 * FIX M2: Memoized config to prevent unnecessary re-renders
 * FIX C2: Added ID token support
 */

import { useCallback, useEffect, useMemo } from 'react';
import { secureLogout, setupLogoutListener, SecureLogoutConfig } from '@/lib/auth/secure-logout';

interface UseSecureLogoutOptions {
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  onLogoutFromOtherTab?: () => void;
}

export function useSecureLogout(options: UseSecureLogoutOptions = {}) {
  const { accessToken, refreshToken, idToken, onLogoutFromOtherTab } = options;

  // FIX M2: Memoize config to prevent recreation on every render
  const config: SecureLogoutConfig = useMemo(
    () => ({
      keycloakUrl: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180',
      realm: import.meta.env.VITE_KEYCLOAK_REALM || 'ananta-saas',
      clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'cbp-frontend',
      postLogoutRedirectUri: window.location.origin,
    }),
    []
  );

  const logout = useCallback(async () => {
    // FIX C2: Pass ID token to secureLogout
    await secureLogout(config, accessToken, refreshToken, idToken);
  }, [config, accessToken, refreshToken, idToken]);

  // Listen for logout from other tabs
  useEffect(() => {
    if (onLogoutFromOtherTab) {
      return setupLogoutListener(onLogoutFromOtherTab);
    }
  }, [onLogoutFromOtherTab]);

  return { logout };
}

export default useSecureLogout;
