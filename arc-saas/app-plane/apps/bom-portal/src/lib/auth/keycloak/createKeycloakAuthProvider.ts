import { AuthProvider } from 'react-admin';
import { getKeycloakState, waitForKeycloakReady, resetKeycloakState, KeycloakUser } from './keycloakState';

export interface KeycloakAuthProviderConfig {
  /**
   * Keycloak server URL (e.g., 'http://localhost:8180')
   */
  keycloakUrl: string;

  /**
   * Keycloak realm name
   */
  realm: string;

  /**
   * Keycloak client ID
   */
  clientId: string;

  /**
   * Control Plane API URL (LoopBack tenant-management-service)
   * @default 'http://localhost:14000'
   */
  controlPlaneApiUrl?: string;

  /**
   * Default tenant ID for fallback scenarios
   * @default null (will use tenantId from JWT)
   */
  defaultTenantId?: string;

  /**
   * Enable verbose logging for auth flow
   * @default false
   */
  enableGateLogging?: boolean;

  /**
   * Callback to publish login event
   */
  onLogin?: (user: { id: string; email: string; provider: string }) => Promise<void>;

  /**
   * Callback to publish logout event
   */
  onLogout?: (user: { id: string; email: string }) => Promise<void>;

  /**
   * Callback to clear data provider cache
   */
  onClearCache?: () => void;

  /**
   * Allowed roles for access (if provided, user must have at least one)
   * Checks both realm_access.roles and resource_access[clientId].roles
   * @example ['admin', 'user']
   */
  allowedRoles?: string[];

  /**
   * Required groups for access (if provided, user must be in at least one)
   * @example ['/tenants/org-123']
   */
  requiredGroups?: string[];
}

/**
 * Convert technical error messages to user-friendly descriptions
 */
function getUserFriendlyError(error: any): string {
  const errorStr = error?.message || error?.toString() || 'Unknown error';

  // Network errors
  if (errorStr.includes('Failed to fetch') || errorStr.includes('NetworkError')) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }

  // Keycloak-specific errors
  if (errorStr.includes('access_denied')) {
    return 'Access denied. You may not have permission to access this application.';
  }

  if (errorStr.includes('login_required') || errorStr.includes('NO_SESSION')) {
    return 'Please log in to continue.';
  }

  if (errorStr.includes('ROLE_CHECK_FAILED')) {
    return 'You do not have the required role to access this application. Please contact your administrator.';
  }

  if (errorStr.includes('GROUP_CHECK_FAILED')) {
    return 'You are not a member of the required group. Please contact your administrator.';
  }

  if (errorStr.includes('TOKEN_EXPIRED')) {
    return 'Your session has expired. Please log in again.';
  }

  // Generic fallback
  return `Authentication error: ${errorStr}`;
}

/**
 * Extract roles from Keycloak user
 */
function extractRoles(user: KeycloakUser, clientId?: string): string[] {
  const roles: string[] = [];

  // Add realm roles
  if (user.realm_access?.roles) {
    roles.push(...user.realm_access.roles);
  }

  // Add client-specific roles
  if (clientId && user.resource_access?.[clientId]?.roles) {
    roles.push(...user.resource_access[clientId].roles);
  }

  return [...new Set(roles)]; // Remove duplicates
}

/**
 * Create Keycloak Auth Provider for React Admin
 *
 * This factory creates an auth provider that integrates Keycloak authentication
 * with the ARC-SaaS Control Plane for multi-tenant authorization.
 *
 * Flow:
 * 1. User authenticates with Keycloak (SSO/OAuth2/OIDC)
 * 2. Keycloak returns user profile with JWT containing claims
 * 3. JWT includes tenant_id/organization_id from Keycloak groups or custom claims
 * 4. We use the JWT directly for API calls to App Plane services
 * 5. Control Plane APIs are accessed with the same JWT for tenant context
 */
export function createKeycloakAuthProvider(config: KeycloakAuthProviderConfig): AuthProvider {
  const {
    keycloakUrl,
    realm,
    clientId,
    controlPlaneApiUrl = 'http://localhost:14000',
    defaultTenantId = null,
    enableGateLogging = false,
    onLogin,
    onLogout,
    onClearCache,
    allowedRoles,
    requiredGroups,
  } = config;

  // Flag to prevent infinite logout loop
  let isLoggingOut = false;

  const log = (...args: any[]) => {
    if (enableGateLogging) console.log('[GATE: Keycloak]', ...args);
  };

  const warn = (...args: any[]) => {
    if (enableGateLogging) console.warn('[GATE: Keycloak]', ...args);
  };

  const error = (...args: any[]) => {
    console.error('[GATE: Keycloak]', ...args);
  };

  const persistIdentityLocally = (user: {
    id: string;
    email?: string | null;
    name?: string | null;
    picture?: string | null;
  } | null) => {
    if (!user) return;
    try {
      localStorage.setItem('user_id', user.id);
      if (user.email) localStorage.setItem('user_email', user.email);
      const name = user.name || user.email || 'User';
      localStorage.setItem('user_name', name);
      if (user.picture) localStorage.setItem('user_avatar', user.picture);
    } catch {
      // Ignore localStorage failures (e.g., private mode)
    }
  };

  // Token refresh mechanism
  let refreshTimerId: ReturnType<typeof setInterval> | null = null;

  const refreshToken = async () => {
    try {
      log('Refreshing Keycloak token...');

      const state = getKeycloakState();
      if (state.getToken) {
        const newToken = await state.getToken();
        if (newToken) {
          localStorage.setItem('keycloak_token', newToken);
          log('✅ Token refreshed successfully');
        }
      }
    } catch (err) {
      error('Token refresh error:', err);
    }
  };

  const startTokenRefresh = () => {
    // Clear any existing timer
    if (refreshTimerId) {
      clearInterval(refreshTimerId);
    }

    // Refresh token every 4 minutes (Keycloak tokens typically expire after 5 minutes)
    const REFRESH_INTERVAL = 4 * 60 * 1000; // 4 minutes in milliseconds
    refreshTimerId = setInterval(refreshToken, REFRESH_INTERVAL);

    log('Token refresh timer started (4 minute interval)');
  };

  const stopTokenRefresh = () => {
    if (refreshTimerId) {
      clearInterval(refreshTimerId);
      refreshTimerId = null;
      log('Token refresh timer stopped');
    }
  };

  return {
    login: async ({ keycloakUser, keycloakToken }: { keycloakUser?: KeycloakUser; keycloakToken?: string }) => {
      if (!keycloakUser) {
        error('Login failed: No Keycloak user provided');
        return Promise.reject(new Error('No Keycloak user provided'));
      }

      const { email, name, picture, sub, preferred_username, tenant_id, organization_id, groups } = keycloakUser;

      // Extract roles from Keycloak token
      const roles = extractRoles(keycloakUser, clientId);

      log('Processing Keycloak login', {
        email,
        name,
        preferred_username,
        tenant_id,
        organization_id,
        roles,
        groups,
      });

      // Role check (if configured)
      if (allowedRoles && allowedRoles.length > 0) {
        const hasAllowedRole = roles.some(role => allowedRoles.includes(role));
        if (!hasAllowedRole) {
          warn('User does not have required role', { userRoles: roles, allowedRoles });
          return Promise.reject(new Error('ROLE_CHECK_FAILED'));
        }
        log('Role check passed', { userRoles: roles, allowedRoles });
      }

      // Group check (if configured)
      if (requiredGroups && requiredGroups.length > 0 && groups) {
        const hasRequiredGroup = groups.some(group => requiredGroups.includes(group));
        if (!hasRequiredGroup) {
          warn('User not in required group', { userGroups: groups, requiredGroups });
          return Promise.reject(new Error('GROUP_CHECK_FAILED'));
        }
        log('Group check passed', { userGroups: groups, requiredGroups });
      }

      // Determine tenant ID from various sources
      const tenantId = tenant_id || organization_id || defaultTenantId;

      // Determine primary role
      const primaryRole = roles.includes('admin') ? 'admin' :
                         roles.includes('owner') ? 'owner' :
                         roles.includes('manager') ? 'manager' :
                         'user';

      // Store user data in localStorage
      const userId = sub || preferred_username || email || 'unknown';
      localStorage.setItem('user_id', userId);
      localStorage.setItem('user_email', email || '');
      localStorage.setItem('user_name', name || preferred_username || email || 'User');
      if (picture) localStorage.setItem('user_avatar', picture);
      if (tenantId) localStorage.setItem('tenant_id', tenantId);
      localStorage.setItem('user_role', primaryRole);
      localStorage.setItem('keycloak_roles', JSON.stringify(roles));
      if (groups) localStorage.setItem('keycloak_groups', JSON.stringify(groups));
      localStorage.setItem('is_admin', roles.includes('admin') || roles.includes('super_admin') ? 'true' : 'false');
      localStorage.setItem('auth_mode', 'keycloak');

      // Store Keycloak token for API calls
      if (keycloakToken) {
        localStorage.setItem('keycloak_token', keycloakToken);
      }

      log('✅ Keycloak session established', {
        email,
        tenant_id: tenantId,
        role: primaryRole,
        hasToken: !!keycloakToken,
      });

      // Call onLogin callback
      if (onLogin) {
        try {
          await onLogin({
            id: userId,
            email: email || 'unknown',
            provider: 'keycloak',
          });
        } catch (err) {
          error('Error in onLogin callback:', err);
        }
      }

      persistIdentityLocally({
        id: userId,
        email,
        name,
        picture,
      });

      // Start token refresh timer
      startTokenRefresh();

      log('Login complete', { email });
      return Promise.resolve();
    },

    logout: async () => {
      // Prevent infinite logout loop
      if (isLoggingOut) {
        log('Logout already in progress, skipping');
        return Promise.resolve();
      }

      log('Logout triggered');

      const userId = localStorage.getItem('user_id');
      const userEmail = localStorage.getItem('user_email');
      const hasActiveSession = !!userId && !!userEmail;

      if (!hasActiveSession) {
        log('No active session, showing login page');

        // Clear data provider cache
        if (onClearCache) onClearCache();

        // Reset Keycloak state
        resetKeycloakState();

        return Promise.resolve();
      }

      isLoggingOut = true;

      // Stop token refresh timer
      stopTokenRefresh();

      // Call onLogout callback BEFORE clearing storage
      if (onLogout) {
        try {
          await onLogout({
            id: userId!,
            email: userEmail!,
          });
        } catch (err) {
          error('Error in onLogout callback:', err);
        }
      }

      // Clear localStorage
      try {
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_avatar');
        localStorage.removeItem('user_role');
        localStorage.removeItem('is_admin');
        localStorage.removeItem('tenant_id');
        localStorage.removeItem('keycloak_token');
        localStorage.removeItem('keycloak_roles');
        localStorage.removeItem('keycloak_groups');
        localStorage.removeItem('auth_mode');
      } catch {}

      // Clear data provider cache to prevent data leaks across sessions
      if (onClearCache) onClearCache();

      // Reset Keycloak state
      resetKeycloakState();

      // Get logout function from state
      const state = getKeycloakState();
      if (state.logout) {
        log('Calling Keycloak logout...');
        state.logout();
      } else {
        // Fallback: Redirect to Keycloak logout URL manually
        log('Redirecting to Keycloak logout URL...');
        const returnTo = window.location.origin;
        const logoutUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/logout?` +
          `client_id=${clientId}&post_logout_redirect_uri=${encodeURIComponent(returnTo)}`;
        window.location.href = logoutUrl;
      }

      // Reset flag after a delay (in case redirect fails)
      setTimeout(() => { isLoggingOut = false; }, 5000);

      return Promise.resolve();
    },

    checkError: ({ status }: any) => {
      if (status === 401 || status === 403) {
        warn('Auth error detected', { status });
        return Promise.reject();
      }
      return Promise.resolve();
    },

    checkAuth: async () => {
      log('Checking session...');

      try {
        // Wait for Keycloak to initialize
        const keycloakState = await waitForKeycloakReady(10000, 2);

        if (keycloakState.isAuthenticated && keycloakState.user) {
          const user = keycloakState.user;

          // Extract roles for verification
          const roles = extractRoles(user, clientId);

          // Role check (if configured)
          if (allowedRoles && allowedRoles.length > 0) {
            const hasAllowedRole = roles.some(role => allowedRoles.includes(role));
            if (!hasAllowedRole) {
              warn('User does not have required role for access', { userRoles: roles, allowedRoles });
              localStorage.removeItem('user_id');
              localStorage.removeItem('user_email');
              localStorage.removeItem('tenant_id');
              return Promise.reject(new Error('ROLE_CHECK_FAILED'));
            }
          }

          // Group check (if configured)
          if (requiredGroups && requiredGroups.length > 0 && user.groups) {
            const hasRequiredGroup = user.groups.some(group => requiredGroups.includes(group));
            if (!hasRequiredGroup) {
              warn('User not in required group', { userGroups: user.groups, requiredGroups });
              localStorage.removeItem('user_id');
              localStorage.removeItem('user_email');
              localStorage.removeItem('tenant_id');
              return Promise.reject(new Error('GROUP_CHECK_FAILED'));
            }
          }

          // Verify localStorage has user data
          const userId = localStorage.getItem('user_id');
          const userEmail = localStorage.getItem('user_email');

          // Always update roles from token
          localStorage.setItem('keycloak_roles', JSON.stringify(roles));
          if (user.groups) {
            localStorage.setItem('keycloak_groups', JSON.stringify(user.groups));
          }

          if (userId && userEmail) {
            log('Session valid', {
              userId,
              email: userEmail,
              keycloakUser: user.email,
              roles,
            });

            // Ensure token is fresh
            if (keycloakState.getToken) {
              try {
                const token = await keycloakState.getToken();
                if (token) {
                  localStorage.setItem('keycloak_token', token);
                }
              } catch (err) {
                warn('Failed to refresh token in checkAuth:', err);
              }
            }

            return Promise.resolve();
          } else {
            // Keycloak says authenticated but localStorage is empty - populate it
            warn('Keycloak authenticated but localStorage empty, syncing...');

            const { email, name, picture, sub, preferred_username, tenant_id, organization_id, groups } = user;

            const tenantId = tenant_id || organization_id || defaultTenantId;
            const primaryRole = roles.includes('admin') ? 'admin' :
                               roles.includes('owner') ? 'owner' :
                               roles.includes('manager') ? 'manager' :
                               'user';
            const finalUserId = sub || preferred_username || email || 'unknown';

            localStorage.setItem('user_id', finalUserId);
            localStorage.setItem('user_email', email || '');
            localStorage.setItem('user_name', name || preferred_username || email || 'User');
            if (picture) localStorage.setItem('user_avatar', picture);
            if (tenantId) localStorage.setItem('tenant_id', tenantId);
            localStorage.setItem('user_role', primaryRole);
            localStorage.setItem('keycloak_roles', JSON.stringify(roles));
            if (groups) localStorage.setItem('keycloak_groups', JSON.stringify(groups));
            localStorage.setItem('is_admin', roles.includes('admin') || roles.includes('super_admin') ? 'true' : 'false');
            localStorage.setItem('auth_mode', 'keycloak');

            // Get and store token
            if (keycloakState.getToken) {
              try {
                const token = await keycloakState.getToken();
                if (token) {
                  localStorage.setItem('keycloak_token', token);
                }
              } catch (err) {
                warn('Failed to get token in checkAuth:', err);
              }
            }

            persistIdentityLocally({
              id: finalUserId,
              email: email || null,
              name: name || null,
              picture: picture || null,
            });

            log('✅ Keycloak session synced to localStorage', {
              email,
              tenant_id: tenantId,
              role: primaryRole,
            });

            return Promise.resolve();
          }
        } else {
          warn('No active Keycloak session');
          return Promise.reject(new Error('NO_SESSION'));
        }
      } catch (err) {
        error('Keycloak initialization failed:', err);

        // Fall back to localStorage check
        const userId = localStorage.getItem('user_id');
        const userEmail = localStorage.getItem('user_email');
        const keycloakToken = localStorage.getItem('keycloak_token');

        if (userId && userEmail && keycloakToken) {
          log('Using cached session from localStorage while Keycloak initializes');
          return Promise.resolve();
        }

        warn('No cached session found - Keycloak must complete initialization');
        return Promise.reject(new Error('NO_SESSION'));
      }
    },

    getPermissions: async () => {
      log('Getting user permissions...');

      const userId = localStorage.getItem('user_id');
      const userEmail = localStorage.getItem('user_email');

      if (!userId || !userEmail) {
        warn('Cannot get permissions: No active session');
        return Promise.reject(new Error('No active session'));
      }

      // Return roles from localStorage
      const rolesJson = localStorage.getItem('keycloak_roles');
      const roles = rolesJson ? JSON.parse(rolesJson) : [];

      const primaryRole = localStorage.getItem('user_role') || 'user';
      log('User permissions retrieved', { primaryRole, allRoles: roles });

      // Return object with role and all roles for more flexibility
      return Promise.resolve({
        role: primaryRole,
        roles: roles,
      });
    },

    getIdentity: async () => {
      log('Getting user identity...');

      const userId = localStorage.getItem('user_id');
      const userEmail = localStorage.getItem('user_email');
      const userName = localStorage.getItem('user_name');
      const userAvatar = localStorage.getItem('user_avatar');

      if (!userId || !userEmail) {
        warn('Cannot get identity: No active session');
        return Promise.reject(new Error('No active session'));
      }

      // Ensure tenant_id is in localStorage (in case of page refresh)
      if (!localStorage.getItem('tenant_id')) {
        const keycloakState = getKeycloakState();
        const user = keycloakState.user;

        if (user) {
          const tenantId = user.tenant_id || user.organization_id || defaultTenantId;
          if (tenantId) {
            localStorage.setItem('tenant_id', tenantId);
            log('Tenant ID restored from Keycloak state', { tenantId });
          }
        } else if (defaultTenantId) {
          localStorage.setItem('tenant_id', defaultTenantId);
          warn('Using default tenant ID (restore)', { tenantId: defaultTenantId });
        }
      }

      const identity = {
        id: userId,
        fullName: userName || userEmail || 'User',
        avatar: userAvatar || undefined,
      };

      log('User identity retrieved', { userId: identity.id, fullName: identity.fullName });

      return Promise.resolve(identity);
    },
  };
}
