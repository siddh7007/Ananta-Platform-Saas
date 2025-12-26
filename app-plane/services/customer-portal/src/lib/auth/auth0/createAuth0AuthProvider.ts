import { AuthProvider } from 'react-admin';
import { SupabaseClient } from '@supabase/supabase-js';
import { getAuth0State, waitForAuth0Ready, resetAuth0State } from './auth0State';

export interface Auth0AuthProviderConfig {
  /**
   * Supabase client instance
   */
  supabase: SupabaseClient;

  /**
   * Middleware API URL for session creation
   * @default 'http://localhost:27700'
   */
  middlewareUrl?: string;

  /**
   * Auth0 domain (e.g., 'dev-xxxxx.us.auth0.com')
   */
  auth0Domain: string;

  /**
   * Auth0 client ID
   */
  auth0ClientId: string;

  /**
   * Platform organization ID for admin users
   * @default 'org_oNtVXvVrzXz1ubua'
   */
  platformOrgId?: string;

  /**
   * Auth0 custom claims namespace
   * @default 'https://ananta.component.platform'
   */
  namespace?: string;

  /**
   * Default tenant ID for new users
   * @default 'a1111111-1111-1111-1111-111111111111'
   */
  defaultTenantId?: string;

  /**
   * Enable gate logging (verbose auth flow logs)
   * @default false
   */
  enableGateLogging?: boolean;

  /**
   * Use Auth0 JWT directly with Supabase PostgREST (Option A)
   *
   * When enabled:
   * - Auth0 JWT with custom claims is used directly for API calls
   * - PostgREST must be configured to validate Auth0 JWTs via JWKS
   * - Auth0 Action must add organization_id and role to JWT claims
   * - Middleware session creation is bypassed
   *
   * When disabled (default):
   * - Middleware creates Supabase JWT with organization_id
   * - PostgREST validates Supabase JWT with shared secret
   *
   * @default false
   */
  useDirectAuth0JWT?: boolean;

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
   * Function to get Auth0 access token (required for useDirectAuth0JWT)
   * This should be the getAccessTokenSilently function from @auth0/auth0-react
   */
  getAccessToken?: () => Promise<string>;

  /**
   * Allowed roles for platform admin access
   * If provided, user must have at least one of these roles to access the application
   * @example ['platform:admin', 'platform:staff', 'platform:super_admin']
   * @default undefined (no role check)
   */
  allowedRoles?: string[];
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

  // Auth0-specific errors
  if (errorStr.includes('access_denied')) {
    return 'Access denied. You may not have permission to access this application.';
  }

  if (errorStr.includes('login_required')) {
    return 'Please log in to continue.';
  }

  if (errorStr.includes('ADMIN_LOGIN_REQUIRES_ORG')) {
    return 'Admin login requires organization membership. Please contact your administrator.';
  }

  if (errorStr.includes('ADMIN_LOGIN_REQUIRES_ROLE')) {
    return 'You do not have the required role to access this application. Please contact your administrator.';
  }

  // Session errors
  if (errorStr.includes('Failed to create session')) {
    return 'Unable to create your session. Please try logging in again.';
  }

  if (errorStr.includes('Failed to set Supabase session')) {
    return 'Session setup failed. Please try logging in again.';
  }

  // Middleware errors
  if (errorStr.includes('MIDDLEWARE_SYNC_FAILED')) {
    return 'Unable to sync your account. Please try again or contact support.';
  }

  // Generic fallback
  return `Authentication error: ${errorStr}`;
}

/**
 * Create Auth0 Auth Provider for React Admin
 *
 * This factory creates an auth provider that integrates Auth0 authentication with Supabase authorization.
 *
 * Flow:
 * 1. User logs in with Auth0 (Google/Microsoft/Email)
 * 2. Auth0 returns user profile (email, name, picture, sub)
 * 3. We sync the user to Supabase via middleware API
 * 4. We retrieve the user's role and organization_id from Supabase
 * 5. We store organization_id in localStorage for RLS
 */
export function createAuth0AuthProvider(config: Auth0AuthProviderConfig): AuthProvider {
  const {
    supabase,
    middlewareUrl = 'http://localhost:27700',
    auth0Domain,
    auth0ClientId,
    platformOrgId = 'org_oNtVXvVrzXz1ubua',
    namespace = 'https://ananta.component.platform',
    defaultTenantId = 'a1111111-1111-1111-1111-111111111111',
    enableGateLogging = false,
    useDirectAuth0JWT = false,
    onLogin,
    onLogout,
    onClearCache,
    getAccessToken,
    allowedRoles,
  } = config;

  // Flag to prevent infinite logout loop
  let isLoggingOut = false;

  const log = (...args: any[]) => {
    if (enableGateLogging) console.log('[GATE: Auth0]', ...args);
  };

  const warn = (...args: any[]) => {
    if (enableGateLogging) console.warn('[GATE: Auth0]', ...args);
  };

  const error = (...args: any[]) => {
    console.error('[GATE: Auth0]', ...args);
  };

  const persistIdentityLocally = (user: { id: string; email?: string | null; name?: string | null; picture?: string | null } | null) => {
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
  let refreshTimerId: NodeJS.Timeout | null = null;

  const refreshToken = async () => {
    try {
      log('Refreshing access token...');

      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !session) {
        error('Token refresh failed:', refreshError);
        // Don't force logout on refresh failure - user may still have valid token
        return;
      }

      log('✅ Token refreshed successfully');
    } catch (err) {
      error('Token refresh error:', err);
    }
  };

  const startTokenRefresh = () => {
    // Clear any existing timer
    if (refreshTimerId) {
      clearInterval(refreshTimerId);
    }

    // Refresh token every 50 minutes (tokens expire after 1 hour)
    const REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minutes in milliseconds
    refreshTimerId = setInterval(refreshToken, REFRESH_INTERVAL);

    log('Token refresh timer started (50 minute interval)');
  };

  const stopTokenRefresh = () => {
    if (refreshTimerId) {
      clearInterval(refreshTimerId);
      refreshTimerId = null;
      log('Token refresh timer stopped');
    }
  };

  return {
    login: async ({ auth0User, auth0AccessToken }: any) => {
      if (!auth0User) {
        error('Login failed: No Auth0 user provided');
        return Promise.reject(new Error('No Auth0 user provided'));
      }

      const { email, name, picture, sub } = auth0User;

      // Extract Auth0 organization and roles from custom claims
      const auth0OrgId = auth0User[`${namespace}/org_id`];
      const auth0Roles = auth0User[`${namespace}/roles`] || [];

      // Extract custom claims for Option A (direct Auth0 JWT)
      const auth0OrganizationId = auth0User[`${namespace}/organization_id`];
      const auth0Role = auth0User[`${namespace}/role`];

      log('Processing Auth0 login', {
        email,
        name,
        provider: sub?.split('|')[0],
        auth0OrgId,
        auth0Roles,
        auth0OrganizationId,
        auth0Role,
        useDirectAuth0JWT
      });

      let userData: any = null;

      // ========================================
      // OPTION A: Direct Auth0 JWT Flow
      // ========================================
      if (useDirectAuth0JWT) {
        log('Using Option A: Direct Auth0 JWT with Supabase PostgREST');

        // Validate that Auth0 JWT has required custom claims
        if (!auth0OrganizationId) {
          error('Auth0 JWT missing organization_id custom claim');
          error('Ensure Auth0 Action is deployed and adds https://ananta.component.platform/organization_id');
          return Promise.reject(new Error(
            'Account setup incomplete. Please contact support if this persists.'
          ));
        }

        // Get access token from Auth0
        let accessToken = auth0AccessToken;
        if (!accessToken && getAccessToken) {
          try {
            accessToken = await getAccessToken();
          } catch (err) {
            error('Failed to get Auth0 access token:', err);
            return Promise.reject(new Error('Failed to get authentication token'));
          }
        }

        if (!accessToken) {
          error('No Auth0 access token available');
          return Promise.reject(new Error('Authentication token not available'));
        }

        // Store user data from Auth0 claims
        userData = {
          id: sub,
          email: email,
          organization_id: auth0OrganizationId,
          role: auth0Role || 'user',
          is_platform_admin: auth0OrgId === platformOrgId,
          full_name: name
        };

        // Store user data in localStorage
        localStorage.setItem('user_id', userData.id);
        localStorage.setItem('user_email', userData.email);
        localStorage.setItem('organization_id', userData.organization_id);
        localStorage.setItem('user_role', userData.role);
        localStorage.setItem('is_admin', userData.is_platform_admin ? 'true' : 'false');

        // Store Auth0 roles for platform super admin detection
        localStorage.setItem('auth0_roles', JSON.stringify(auth0Roles));

        // Store Auth0 access token for use by data provider
        localStorage.setItem('auth0_access_token', accessToken);
        localStorage.setItem('auth_mode', 'auth0_direct');

        log('✅ Auth0 Direct JWT session established', {
          email,
          organization_id: userData.organization_id,
          role: userData.role,
          hasAccessToken: !!accessToken
        });
      }
      // ========================================
      // ORIGINAL FLOW: Middleware creates Supabase JWT
      // ========================================
      else {
        try {
          log('Using original flow: Middleware creates Supabase JWT');

          log('Calling middleware API to create session', {
            email,
            auth0OrgId,
            auth0Roles
          });

          const sessionResponse = await fetch(`${middlewareUrl}/auth/create-supabase-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              user_id: sub,
              org_id: auth0OrgId,
              roles: auth0Roles,
              full_name: name
            })
          });

          if (!sessionResponse.ok) {
            const errorText = await sessionResponse.text();
            error('Middleware API error:', errorText);
            return Promise.reject(new Error(`Failed to create session: ${errorText}`));
          }

          const sessionData = await sessionResponse.json();
          userData = sessionData.user;

          log('Middleware API response', {
            email: userData.email,
            organization_id: userData.organization_id,
            role: userData.role,
            is_platform_admin: userData.is_platform_admin
          });

          // Store user data in localStorage
          localStorage.setItem('user_id', userData.id);
          localStorage.setItem('user_email', userData.email);
          localStorage.setItem('organization_id', userData.organization_id);
          localStorage.setItem('user_role', userData.role);
          localStorage.setItem('is_admin', userData.is_platform_admin ? 'true' : 'false');
          localStorage.setItem('auth_mode', 'supabase_jwt');

          // Store Auth0 roles for platform super admin detection
          localStorage.setItem('auth0_roles', JSON.stringify(auth0Roles));

          // Set Supabase session using the generated tokens
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: sessionData.session.access_token,
            refresh_token: sessionData.session.refresh_token
          });

          if (sessionError) {
            error('Failed to set Supabase session:', sessionError);
            const friendlyMessage = getUserFriendlyError(sessionError);
            return Promise.reject(new Error(friendlyMessage));
          }

          log('✅ Supabase session established', {
            email,
            hasAccessToken: !!sessionData.session.access_token
          });

        } catch (err) {
          error('Error in login flow:', err);
          const friendlyMessage = getUserFriendlyError(err);
          return Promise.reject(new Error(friendlyMessage));
        }
      }

      // Call onLogin callback
      if (onLogin) {
        try {
          await onLogin({
            id: userData?.id || sub,
            email: email || 'unknown',
            provider: sub?.split('|')[0] || 'auth0',
          });
        } catch (err) {
          error('Error in onLogin callback:', err);
        }
      }

      persistIdentityLocally({
        id: userData?.id || sub,
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

        // Reset Auth0 state
        resetAuth0State();

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
        localStorage.removeItem('organization_id');
        // Clear Auth0 roles
        localStorage.removeItem('auth0_roles');
        // Option A: Clear Auth0 direct JWT items
        localStorage.removeItem('auth0_access_token');
        localStorage.removeItem('auth_mode');
      } catch {}

      // Clear Auth0 SDK localStorage keys (race condition fix)
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('@@auth0spajs@@::')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        log(`Cleared ${keysToRemove.length} Auth0 SDK cache keys`);
      } catch (err) {
        error('Failed to clear Auth0 SDK cache:', err);
      }

      // Clear data provider cache to prevent data leaks across sessions
      if (onClearCache) onClearCache();

      // Reset Auth0 state
      resetAuth0State();

      log('Logout complete, redirecting to Auth0...');

      // Reset flag after a delay (in case redirect fails)
      setTimeout(() => { isLoggingOut = false; }, 5000);

      // Redirect to Auth0 logout URL
      const returnTo = window.location.origin;
      window.location.href = `https://${auth0Domain}/v2/logout?client_id=${auth0ClientId}&returnTo=${encodeURIComponent(returnTo)}`;

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
        // Wait for Auth0 to initialize with production-grade retry logic (10s timeout, 2 retries)
        const auth0State = await waitForAuth0Ready(10000, 2, useDirectAuth0JWT);

        if (auth0State.isAuthenticated && auth0State.user) {
          // ADMIN LOGIN GUARD: If accessing /admin-login, verify org_id in token
          const isAdminLoginRoute = window.location.hash.includes('/admin-login') ||
                                     window.location.pathname.includes('/admin-login');
          if (isAdminLoginRoute) {
            const auth0OrgId = auth0State.user[`${namespace}/org_id`];

            if (!auth0OrgId || auth0OrgId !== platformOrgId) {
              warn('Admin login route accessed but no platform org_id in token - forcing re-authentication');
              // Clear any existing session data to force fresh login
              localStorage.removeItem('user_id');
              localStorage.removeItem('user_email');
              localStorage.removeItem('organization_id');
              return Promise.reject(new Error('ADMIN_LOGIN_REQUIRES_ORG'));
            }

            // ROLE CHECK: Verify user has an allowed role (if configured)
            if (allowedRoles && allowedRoles.length > 0) {
              const auth0Roles = auth0State.user[`${namespace}/roles`] || [];
              const hasAllowedRole = auth0Roles.some((role: string) => allowedRoles.includes(role));
              if (!hasAllowedRole) {
                warn('User does not have required role for admin access', {
                  userRoles: auth0Roles,
                  allowedRoles
                });
                // Clear any existing session data to force fresh login
                localStorage.removeItem('user_id');
                localStorage.removeItem('user_email');
                localStorage.removeItem('organization_id');
                return Promise.reject(new Error('ADMIN_LOGIN_REQUIRES_ROLE'));
              }
              log('Role check passed', { userRoles: auth0Roles, allowedRoles });
            }
          }

          // Verify localStorage has user data
          const userId = localStorage.getItem('user_id');
          const userEmail = localStorage.getItem('user_email');

          // ALWAYS extract and store Auth0 roles from token (even if localStorage exists)
          const auth0Roles = auth0State.user[`${namespace}/roles`] || [];
          localStorage.setItem('auth0_roles', JSON.stringify(auth0Roles));
          log('Updated auth0_roles from token', { auth0Roles });

          if (userId && userEmail) {
            log('Session valid', {
              userId,
              email: userEmail,
              auth0User: auth0State.user.email,
              auth0Roles,
            });
            return Promise.resolve();
          } else {
            // Auth0 says authenticated but localStorage is empty
            const { email, name, sub, picture } = auth0State.user;
            const auth0OrgId = auth0State.user[`${namespace}/org_id`];
            const auth0Roles = auth0State.user[`${namespace}/roles`] || [];

            // Extract custom claims for Option A (direct Auth0 JWT)
            const auth0OrganizationId = auth0State.user[`${namespace}/organization_id`];
            const auth0Role = auth0State.user[`${namespace}/role`];

            // ========================================
            // OPTION A: Direct Auth0 JWT Flow (checkAuth)
            // ========================================
            if (useDirectAuth0JWT) {
              log('Auth0 authenticated but localStorage empty - using Option A (hybrid: middleware sync + direct JWT)');

              // Step 1: Call middleware to ensure user exists in database
              let userData: any = null;
              try {
                log('Syncing user via middleware (ensures user exists in DB)...');
                const syncResponse = await fetch(`${middlewareUrl}/auth/create-supabase-session`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email,
                    user_id: sub,
                    org_id: auth0OrgId,
                    roles: auth0Roles,
                    full_name: name
                  })
                });

                if (syncResponse.ok) {
                  const syncData = await syncResponse.json();
                  userData = syncData.user;
                  log('✅ User synced via middleware', {
                    userId: userData?.id,
                    organizationId: userData?.organization_id,
                    role: userData?.role
                  });

                  // AUTO-DETECT PLATFORM ADMIN
                  const isPlatformOrg = userData?.organization_id === 'a0000000-0000-0000-0000-000000000000';
                  const hasNoAuth0Roles = !auth0Roles || auth0Roles.length === 0;
                  const notAlreadyReauthenticating = !sessionStorage.getItem('platform_reauth_attempted');

                  if (isPlatformOrg && hasNoAuth0Roles && notAlreadyReauthenticating) {
                    log('🔄 Platform admin detected without Auth0 roles - forcing organization login to get roles');
                    sessionStorage.setItem('platform_reauth_attempted', 'true');

                    // Redirect to Auth0 with organization parameter
                    window.location.href = `https://${auth0Domain}/authorize?` +
                      `client_id=${auth0ClientId}` +
                      `&redirect_uri=${encodeURIComponent(window.location.origin)}` +
                      `&response_type=code` +
                      `&scope=openid%20profile%20email` +
                      `&organization=${platformOrgId}` +
                      `&prompt=none`;

                    return Promise.reject(new Error('PLATFORM_ADMIN_REAUTH'));
                  }

                  // Clear re-auth flag on successful auth with roles
                  if (auth0Roles && auth0Roles.length > 0) {
                    sessionStorage.removeItem('platform_reauth_attempted');
                  }
                } else {
                  warn('Middleware sync failed, continuing with direct JWT (RLS will use DB fallback)');
                }
              } catch (err) {
                warn('Middleware unreachable, continuing with direct JWT:', err);
              }

              // Step 2: Get Auth0 access token for direct API calls
              let accessToken: string | null = null;
              if (getAccessToken) {
                try {
                  accessToken = await getAccessToken();
                } catch (err) {
                  error('Failed to get Auth0 access token in checkAuth:', err);
                  return Promise.reject(new Error('Failed to get authentication token'));
                }
              }

              if (!accessToken) {
                error('No Auth0 access token available (Option A requires getAccessToken)');
                return Promise.reject(new Error('Authentication token not available'));
              }

              // Step 3: Store user data in localStorage
              const finalOrgId = userData?.organization_id || auth0OrganizationId;
              const finalRole = userData?.role || auth0Role || 'user';
              const finalUserId = userData?.id || sub;

              localStorage.setItem('user_id', finalUserId || '');
              localStorage.setItem('user_email', email || '');
              if (finalOrgId) {
                localStorage.setItem('organization_id', finalOrgId);
              }
              localStorage.setItem('user_role', finalRole);
              // Set is_admin for platform admins OR organization owners/admins
              const isPlatformAdmin = userData?.is_platform_admin || auth0OrgId === platformOrgId;
              const isOrgAdmin = ['owner', 'admin'].includes(finalRole);
              localStorage.setItem('is_admin', (isPlatformAdmin || isOrgAdmin) ? 'true' : 'false');

              // Store Auth0 roles for platform super admin detection
              localStorage.setItem('auth0_roles', JSON.stringify(auth0Roles));

              // Store Auth0 access token for use by data provider (direct JWT mode)
              localStorage.setItem('auth0_access_token', accessToken);
              localStorage.setItem('auth_mode', 'auth0_direct');

              persistIdentityLocally({
                id: finalUserId || '',
                email: email || null,
                name: name || null,
                picture: picture || null,
              });

              log('✅ Auth0 Direct JWT session established via checkAuth (hybrid mode)', {
                email,
                organization_id: finalOrgId || '(will use DB fallback)',
                role: finalRole,
                hasAccessToken: !!accessToken,
                userSyncedViaMiddleware: !!userData
              });

              return Promise.resolve();
            }

            // ========================================
            // ORIGINAL FLOW: Middleware creates Supabase JWT (checkAuth)
            // ========================================
            warn('Auth0 authenticated but localStorage empty, syncing via middleware...');

            log('Syncing user via middleware', {
              email,
              auth0OrgId,
              auth0Roles
            });

            try {
              const sessionResponse = await fetch(`${middlewareUrl}/auth/create-supabase-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email,
                  user_id: sub,
                  org_id: auth0OrgId,
                  roles: auth0Roles,
                  full_name: name
                })
              });

              if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json();

                // Store user data in localStorage
                if (sessionData.user) {
                  localStorage.setItem('user_id', sessionData.user.id);
                  localStorage.setItem('user_email', sessionData.user.email);
                  localStorage.setItem('organization_id', sessionData.user.organization_id);
                  localStorage.setItem('user_role', sessionData.user.role || 'engineer');
                  localStorage.setItem('is_admin', sessionData.user.is_platform_admin ? 'true' : 'false');
                  localStorage.setItem('auth_mode', 'supabase_jwt');

                  // Store Auth0 roles for platform super admin detection
                  localStorage.setItem('auth0_roles', JSON.stringify(auth0Roles));

                  persistIdentityLocally({
                    id: sessionData.user.id,
                    email: sessionData.user.email,
                    name: name,
                    picture: auth0State.user.picture,
                  });
                }

                // Set Supabase session
                const { error: sessionError } = await supabase.auth.setSession({
                  access_token: sessionData.session.access_token,
                  refresh_token: sessionData.session.refresh_token
                });

                if (sessionError) {
                  error('Failed to set Supabase session:', sessionError);
                } else {
                  log('✅ Supabase session established via checkAuth');
                }

                return Promise.resolve();
              } else {
                const errorText = await sessionResponse.text();
                error('Middleware sync failed:', errorText);
                return Promise.reject(new Error('MIDDLEWARE_SYNC_FAILED'));
              }
            } catch (err) {
              error('Error syncing via middleware:', err);
              return Promise.reject(new Error('MIDDLEWARE_SYNC_ERROR'));
            }
          }
        } else {
          warn('No active Auth0 session');
          return Promise.reject(new Error('NO_SESSION'));
        }
      } catch (err) {
        error('Auth0 initialization failed:', err);

        // Production-grade graceful fallback
        log('Checking for cached Supabase session as fallback...');

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && session.user) {
            log('Using cached Supabase session while Auth0 initializes', {
              userId: session.user.id,
              email: session.user.email
            });
            return Promise.resolve();
          }
        } catch (supabaseErr) {
          warn('Supabase session check failed:', supabaseErr);
        }

        // Fall back to localStorage check as final resort
        const userId = localStorage.getItem('user_id');
        const userEmail = localStorage.getItem('user_email');

        if (userId && userEmail) {
          log('Using cached session from localStorage while Auth0 initializes');
          return Promise.resolve();
        }

        // Only reject if all fallbacks fail
        warn('No cached session found - Auth0 must complete initialization');
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

      const role = localStorage.getItem('user_role') || 'engineer';
      log('User permissions retrieved', { role });
      return Promise.resolve(role);
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

      // Ensure organization_id is in localStorage (in case of page refresh)
      if (!localStorage.getItem('organization_id') && userEmail) {
        const authMode = localStorage.getItem('auth_mode');

        // Option A: Use middleware API to get user info (Supabase client has no session)
        if (authMode === 'auth0_direct' || useDirectAuth0JWT) {
          log('Option A mode: Fetching organization_id from middleware API');
          try {
            // Get Auth0 state to extract user info for middleware call
            const auth0State = getAuth0State();
            const auth0User = auth0State.user;

            if (auth0User) {
              const { email, name, sub } = auth0User;
              const auth0OrgId = auth0User[`${namespace}/org_id`];
              const auth0Roles = auth0User[`${namespace}/roles`] || [];

              // Call middleware to get/sync user data
              const syncResponse = await fetch(`${middlewareUrl}/auth/create-supabase-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email,
                  user_id: sub,
                  org_id: auth0OrgId,
                  roles: auth0Roles,
                  full_name: name
                })
              });

              if (syncResponse.ok) {
                const syncData = await syncResponse.json();
                const userData = syncData.user;

                if (userData?.organization_id) {
                  localStorage.setItem('organization_id', userData.organization_id);
                  localStorage.setItem('user_role', userData.role || 'user');
                  localStorage.setItem('is_admin', userData.is_platform_admin ? 'true' : 'false');
                  log('✅ Organization ID restored from middleware', {
                    organizationId: userData.organization_id,
                    role: userData.role
                  });
                } else {
                  warn('Middleware response missing organization_id');
                }
              } else {
                warn('Middleware sync failed in getIdentity:', await syncResponse.text());
              }
            } else {
              warn('No Auth0 user in state for organization_id restoration');
            }
          } catch (err) {
            error('Failed to restore organization_id from middleware:', err);
          }
        } else {
          // Original flow: Use Supabase client (has valid session)
          const { data: userData } = await supabase
            .from('users')
            .select('organization_id, role')
            .eq('email', userEmail)
            .single();

          if (userData?.organization_id) {
            localStorage.setItem('organization_id', userData.organization_id);
            localStorage.setItem('user_role', userData.role);
            localStorage.setItem('is_admin', userData.role === 'admin' || userData.role === 'super_admin' ? 'true' : 'false');
            log('Tenant ID restored from database', { tenantId: userData.organization_id });
          } else {
            localStorage.setItem('organization_id', defaultTenantId);
            warn('Using default tenant ID (restore)', { tenantId: defaultTenantId });
          }
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
