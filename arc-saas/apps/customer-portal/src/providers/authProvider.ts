import { AuthProvider as RefineAuthProvider } from '@refinedev/core';
import { parseKeycloakRoles } from '@/config/auth';
import { clearTenantCache } from '@/lib/axios';
import { userManager } from '@/contexts/AuthContext';

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

/**
 * Refine auth provider for Keycloak OIDC authentication
 */
export const authProvider: RefineAuthProvider = {
  login: async () => {
    try {
      await userManager.signinRedirect();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          name: 'LoginError',
          message: error instanceof Error ? error.message : 'Login failed',
        },
      };
    }
  },

  logout: async () => {
    try {
      // Clear all tenant-related caches before logout
      clearTenantCache();

      await userManager.signoutRedirect();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          name: 'LogoutError',
          message: error instanceof Error ? error.message : 'Logout failed',
        },
      };
    }
  },

  check: async () => {
    try {
      const user = await userManager.getUser();
      if (user && !user.expired) {
        return { authenticated: true };
      }
      return {
        authenticated: false,
        redirectTo: '/login',
      };
    } catch {
      return {
        authenticated: false,
        redirectTo: '/login',
      };
    }
  },

  getPermissions: async () => {
    try {
      const user = await userManager.getUser();
      if (!user) return [];

      const accessTokenPayload = parseJwt(user.access_token);
      if (!accessTokenPayload) return [];

      const role = parseKeycloakRoles({
        realm_access: accessTokenPayload.realm_access as { roles?: string[] } | undefined,
        resource_access: accessTokenPayload.resource_access as
          | Record<string, { roles?: string[] }>
          | undefined,
        roles: accessTokenPayload.roles as string[] | undefined,
        groups: accessTokenPayload.groups as string[] | undefined,
      });

      return [role];
    } catch {
      return [];
    }
  },

  getIdentity: async () => {
    try {
      const user = await userManager.getUser();
      if (!user) return null;

      const idTokenPayload = user.profile;
      const accessTokenPayload = parseJwt(user.access_token);

      const role = parseKeycloakRoles({
        realm_access: accessTokenPayload?.realm_access as { roles?: string[] } | undefined,
        resource_access: accessTokenPayload?.resource_access as
          | Record<string, { roles?: string[] }>
          | undefined,
        roles: idTokenPayload?.roles as string[] | undefined,
        groups: idTokenPayload?.groups as string[] | undefined,
      });

      return {
        id: idTokenPayload.sub || '',
        email: idTokenPayload.email || '',
        name: idTokenPayload.name || idTokenPayload.preferred_username || '',
        avatar: idTokenPayload.picture,
        role,
        tenantId: (idTokenPayload as { tenant_id?: string }).tenant_id,
      };
    } catch {
      return null;
    }
  },

  onError: async (error) => {
    console.error('Auth error:', error);
    // Don't redirect to login for every 401 error
    // Only redirect for actual authentication failures (token expired/invalid)
    // Let individual pages/components handle 401s from external services (CNS, etc.)
    // which might be service configuration issues rather than auth issues
    return { error };
  },
};

// Re-export userManager from AuthContext for backwards compatibility
export { userManager };
