import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { UserManager, User } from 'oidc-client-ts';
import {
  oidcConfig,
  parseKeycloakRoles,
  hasMinimumRole,
  validateAudience,
  validateExpiration,
  AppRole,
} from '@/config/auth';
import { env } from '@/config/env';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  tenantId?: string;
  accessToken: string;
}

interface AuthError {
  code: 'INVALID_AUDIENCE' | 'TOKEN_EXPIRED' | 'INVALID_TOKEN';
  message: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSessionExpired: boolean;
  /** Authentication error (invalid audience, expired token, etc.) */
  authError: AuthError | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => string | null;
  /**
   * Check if the current user has at least the specified role level
   * @param requiredRole - The minimum role required
   * @returns true if user has the required role level or higher
   */
  hasPermission: (requiredRole: AppRole) => boolean;
  /**
   * Dismiss the session expired dialog (continue offline mode)
   */
  dismissSessionExpired: () => void;
  /**
   * Clear authentication error and retry login
   */
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const userManager = new UserManager(oidcConfig);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [authError, setAuthError] = useState<AuthError | null>(null);

  const mapOidcUser = useCallback((oidcUser: User | null): AuthUser | null => {
    if (!oidcUser || oidcUser.expired) return null;

    // Parse the ID token to extract claims
    const idTokenPayload = oidcUser.profile;
    const accessTokenPayload = parseJwt(oidcUser.access_token);

    if (!accessTokenPayload) {
      console.error('[Auth] Failed to parse access token');
      setAuthError({
        code: 'INVALID_TOKEN',
        message: 'Failed to parse access token',
      });
      return null;
    }

    // Validate token expiration with 60-second buffer
    const expValidation = validateExpiration(accessTokenPayload.exp as number | undefined);
    if (!expValidation.valid) {
      console.warn('[Auth] Token expiration validation failed:', expValidation.error);
      // Don't set error here - let silent renewal handle it
      // The oidc-client-ts library will trigger renewal or expired event
    }

    // Validate audience claim - CRITICAL for security
    // Token must include cbp-frontend, cns-api, or account
    // Also check azp (authorized party) as fallback - Keycloak uses this for the requesting client
    const audValidation = validateAudience(
      accessTokenPayload.aud as string | string[] | undefined,
      accessTokenPayload.azp as string | undefined
    );
    if (!audValidation.valid) {
      console.error('[Auth] Audience validation failed:', audValidation.error);
      setAuthError({
        code: 'INVALID_AUDIENCE',
        message: audValidation.error || 'Invalid token audience',
      });
      return null;
    }

    if (import.meta.env.DEV) {
      console.debug('[Auth] Token validated - aud:', accessTokenPayload.aud, 'azp:', accessTokenPayload.azp);
    }

    let role = parseKeycloakRoles({
      realm_access: accessTokenPayload?.realm_access as { roles?: string[] } | undefined,
      resource_access: accessTokenPayload?.resource_access as Record<string, { roles?: string[] }> | undefined,
      roles: idTokenPayload?.roles as string[] | undefined,
      groups: idTokenPayload?.groups as string[] | undefined,
    });

    const email = (idTokenPayload.email || '').toLowerCase();
    if (email && env.auth.superAdminEmails.includes(email)) {
      role = 'super_admin';
    }

    // Clear any previous auth errors on successful validation
    setAuthError(null);

    return {
      id: idTokenPayload.sub || '',
      email: idTokenPayload.email || '',
      name: idTokenPayload.name || idTokenPayload.preferred_username || '',
      role,
      tenantId: (idTokenPayload as { tenant_id?: string }).tenant_id,
      accessToken: oidcUser.access_token,
    };
  }, []);

  // Memoize user object to prevent infinite re-renders
  const memoizedUser = useMemo(() => user, [
    user?.id,
    user?.email,
    user?.name,
    user?.role,
    user?.tenantId,
    user?.accessToken,
  ]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const oidcUser = await userManager.getUser();
        setUser(mapOidcUser(oidcUser));
      } catch (error) {
        console.error('Failed to load user:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();

    // Listen for user loaded events (e.g., after silent refresh)
    const handleUserLoaded = (oidcUser: User) => {
      setUser(mapOidcUser(oidcUser));
    };

    const handleUserUnloaded = () => {
      setUser(null);
    };

    const handleSilentRenewError = (error: Error) => {
      console.error('Silent renew error:', error);
      // On silent renew failure, show session expired dialog instead of immediate redirect
      setIsSessionExpired(true);
    };

    const handleAccessTokenExpired = () => {
      console.warn('Access token expired');
      setIsSessionExpired(true);
    };

    userManager.events.addUserLoaded(handleUserLoaded);
    userManager.events.addUserUnloaded(handleUserUnloaded);
    userManager.events.addSilentRenewError(handleSilentRenewError);
    userManager.events.addAccessTokenExpired(handleAccessTokenExpired);

    return () => {
      userManager.events.removeUserLoaded(handleUserLoaded);
      userManager.events.removeUserUnloaded(handleUserUnloaded);
      userManager.events.removeSilentRenewError(handleSilentRenewError);
      userManager.events.removeAccessTokenExpired(handleAccessTokenExpired);
    };
  }, [mapOidcUser]);

  // Cross-tab session synchronization using BroadcastChannel
  useEffect(() => {
    // BroadcastChannel is not available in all browsers (e.g., Safari < 15.4)
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('[Auth] BroadcastChannel not supported - cross-tab sync disabled');
      return;
    }

    const authChannel = new BroadcastChannel('cbp-auth-sync');

    // Listen for auth events from other tabs
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'LOGOUT') {
        console.log('[Auth] Logout event received from another tab');
        // Clear local user state immediately
        setUser(null);
        setIsSessionExpired(false);
        setAuthError(null);
        // The oidc-client-ts library will handle clearing tokens via localStorage
      } else if (event.data?.type === 'LOGIN') {
        console.log('[Auth] Login event received from another tab');
        // Reload user from storage (another tab completed login)
        try {
          const oidcUser = await userManager.getUser();
          if (oidcUser && !oidcUser.expired) {
            setUser(mapOidcUser(oidcUser));
            setIsSessionExpired(false);
            setAuthError(null);
          }
        } catch (error) {
          console.error('[Auth] Failed to sync user from another tab:', error);
        }
      } else if (event.data?.type === 'SESSION_REFRESH') {
        console.log('[Auth] Session refresh event received from another tab');
        // Another tab successfully refreshed the token
        try {
          const oidcUser = await userManager.getUser();
          if (oidcUser && !oidcUser.expired) {
            setUser(mapOidcUser(oidcUser));
            setIsSessionExpired(false);
          }
        } catch (error) {
          console.error('[Auth] Failed to sync refreshed session:', error);
        }
      }
    };

    authChannel.addEventListener('message', handleMessage);

    return () => {
      authChannel.removeEventListener('message', handleMessage);
      authChannel.close();
    };
  }, [mapOidcUser]);

  const login = useCallback(async () => {
    try {
      await userManager.signinRedirect();
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Broadcast logout event to other tabs BEFORE signing out
      // This ensures other tabs clear their state before the Keycloak redirect
      if (typeof BroadcastChannel !== 'undefined') {
        const authChannel = new BroadcastChannel('cbp-auth-sync');
        authChannel.postMessage({ type: 'LOGOUT' });
        authChannel.close();
      }

      await userManager.signoutRedirect();
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }, []);

  const getAccessToken = useCallback(() => {
    return memoizedUser?.accessToken || null;
  }, [memoizedUser?.accessToken]);

  const hasPermission = useCallback(
    (requiredRole: AppRole): boolean => {
      if (!memoizedUser) return false;
      return hasMinimumRole(memoizedUser.role, requiredRole);
    },
    [memoizedUser?.role]
  );

  const dismissSessionExpired = useCallback(() => {
    setIsSessionExpired(false);
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: memoizedUser,
        isAuthenticated: !!memoizedUser,
        isLoading,
        isSessionExpired,
        authError,
        login,
        logout,
        getAccessToken,
        hasPermission,
        dismissSessionExpired,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Export userManager for callback handling
export { userManager };

/**
 * Parse a JWT token without validation (for extracting claims)
 */
function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}
