/**
 * KeycloakStateSync Component
 *
 * This component bridges Keycloak's React context with the auth provider.
 * It syncs Keycloak state to a shared module state that can be accessed
 * outside of React components (like in the auth provider).
 *
 * Also initializes Supabase client with Keycloak tokens for authenticated
 * database access with RLS tenant isolation.
 *
 * Usage:
 * Place this component inside the KeycloakProvider in your App component.
 *
 * @example
 * ```tsx
 * import { ReactKeycloakProvider } from '@react-keycloak/web';
 * import { KeycloakStateSync } from './lib/auth/keycloak';
 *
 * function App() {
 *   return (
 *     <ReactKeycloakProvider authClient={keycloak}>
 *       <KeycloakStateSync
 *         supabaseUrl="http://localhost:27540"
 *         supabaseAnonKey="your-anon-key"
 *       />
 *       <Admin authProvider={authProvider} ...>
 *         ...
 *       </Admin>
 *     </ReactKeycloakProvider>
 *   );
 * }
 * ```
 */

import { useEffect, useCallback, useRef } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { setKeycloakState, resetKeycloakState, KeycloakUser } from './keycloakState';
import {
  createSupabaseClientWithKeycloak,
  resetSupabaseClient,
  getSupabaseClient,
} from '../supabase/createSupabaseClient';

export interface KeycloakStateSyncProps {
  /**
   * Enable verbose logging
   */
  debug?: boolean;

  /**
   * Supabase project URL (optional - enables Supabase integration)
   * When provided, the Supabase client will be initialized with Keycloak tokens
   * for authenticated database access with RLS tenant isolation.
   */
  supabaseUrl?: string;

  /**
   * Supabase anonymous key (required if supabaseUrl is provided)
   */
  supabaseAnonKey?: string;

  /**
   * Callback when Supabase client is initialized
   */
  onSupabaseReady?: () => void;
}

export function KeycloakStateSync({
  debug = false,
  supabaseUrl,
  supabaseAnonKey,
  onSupabaseReady,
}: KeycloakStateSyncProps) {
  const { keycloak, initialized } = useKeycloak();
  const supabaseInitializedRef = useRef(false);

  const log = useCallback((...args: any[]) => {
    if (debug) console.log('[KeycloakStateSync]', ...args);
  }, [debug]);

  useEffect(() => {
    if (!initialized) {
      log('Keycloak not yet initialized');
      setKeycloakState({
        isLoading: true,
        isAuthenticated: false,
        user: null,
        token: null,
        refreshToken: null,
        getToken: null,
        logout: null,
      });
      return;
    }

    log('Keycloak initialized', {
      authenticated: keycloak.authenticated,
      hasToken: !!keycloak.token,
    });

    // Parse token to extract user info
    let user: KeycloakUser | null = null;
    if (keycloak.authenticated && keycloak.tokenParsed) {
      const parsed = keycloak.tokenParsed as any;
      user = {
        sub: parsed.sub,
        email: parsed.email,
        name: parsed.name,
        given_name: parsed.given_name,
        family_name: parsed.family_name,
        preferred_username: parsed.preferred_username,
        picture: parsed.picture,
        realm_access: parsed.realm_access,
        resource_access: parsed.resource_access,
        // Custom claims for tenant context
        tenant_id: parsed.tenant_id,
        organization_id: parsed.organization_id,
        // Groups from Keycloak
        groups: parsed.groups,
      };
      log('User parsed from token', user);
    }

    // Create getToken function that wraps Keycloak's updateToken
    const getToken = async (): Promise<string> => {
      try {
        // Try to refresh the token if it's about to expire (within 30 seconds)
        await keycloak.updateToken(30);
        return keycloak.token || '';
      } catch (err) {
        console.error('[KeycloakStateSync] Failed to refresh token:', err);
        // If refresh fails, return current token (may be expired)
        return keycloak.token || '';
      }
    };

    // Create logout function
    const logout = () => {
      keycloak.logout({
        redirectUri: window.location.origin,
      });
    };

    // Update shared state
    setKeycloakState({
      isLoading: false,
      isAuthenticated: !!keycloak.authenticated,
      user,
      token: keycloak.token || null,
      refreshToken: keycloak.refreshToken || null,
      getToken,
      logout,
    });

  }, [initialized, keycloak, keycloak.authenticated, keycloak.token, log]);

  // Initialize Supabase client with Keycloak token getter
  useEffect(() => {
    // Only initialize if Supabase config is provided and Keycloak is authenticated
    if (!supabaseUrl || !supabaseAnonKey) {
      return;
    }

    if (!initialized || !keycloak.authenticated) {
      // Reset Supabase on logout
      if (supabaseInitializedRef.current && !keycloak.authenticated) {
        log('Resetting Supabase client on logout');
        resetSupabaseClient();
        supabaseInitializedRef.current = false;
      }
      return;
    }

    // Avoid re-initializing if already done
    if (supabaseInitializedRef.current && getSupabaseClient()) {
      log('Supabase client already initialized');
      return;
    }

    log('Initializing Supabase client with Keycloak token getter');

    // Create a token getter that uses Keycloak's updateToken for fresh tokens
    const getAccessToken = async (): Promise<string | null> => {
      try {
        // Refresh token if it's about to expire (within 30 seconds)
        await keycloak.updateToken(30);
        return keycloak.token || null;
      } catch (err) {
        console.error('[KeycloakStateSync] Failed to get Keycloak token for Supabase:', err);
        return keycloak.token || null;
      }
    };

    // Initialize Supabase client with Keycloak token integration
    createSupabaseClientWithKeycloak({
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      getAccessToken,
    });

    supabaseInitializedRef.current = true;
    log('Supabase client initialized successfully');

    // Call the ready callback
    if (onSupabaseReady) {
      onSupabaseReady();
    }
  }, [initialized, keycloak, keycloak.authenticated, supabaseUrl, supabaseAnonKey, log, onSupabaseReady]);

  // Handle token refresh events
  useEffect(() => {
    if (!keycloak) return;

    const onTokenRefreshed = () => {
      log('Token refreshed');
      if (keycloak.token) {
        setKeycloakState({
          token: keycloak.token,
          refreshToken: keycloak.refreshToken || null,
        });
        // Also update localStorage
        localStorage.setItem('keycloak_token', keycloak.token);
      }
    };

    const onTokenExpired = () => {
      log('Token expired, attempting refresh...');
      keycloak.updateToken(30).catch((err) => {
        console.error('[KeycloakStateSync] Token refresh failed:', err);
        // Reset state on refresh failure
        resetKeycloakState();
      });
    };

    const onAuthLogout = () => {
      log('User logged out');
      resetKeycloakState();
      // Also reset Supabase client
      if (supabaseUrl && supabaseAnonKey) {
        resetSupabaseClient();
        supabaseInitializedRef.current = false;
      }
    };

    // Keycloak event handlers
    keycloak.onTokenExpired = onTokenExpired;
    keycloak.onAuthRefreshSuccess = onTokenRefreshed;
    keycloak.onAuthLogout = onAuthLogout;

    return () => {
      // Cleanup event handlers
      keycloak.onTokenExpired = undefined;
      keycloak.onAuthRefreshSuccess = undefined;
      keycloak.onAuthLogout = undefined;
    };
  }, [keycloak, log]);

  // This component doesn't render anything
  return null;
}

export default KeycloakStateSync;
