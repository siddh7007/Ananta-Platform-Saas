import type { AuthProvider } from "@refinedev/core";
import type { User as OidcUser } from "oidc-client-ts";
import { logger } from "../lib/logger";
import {
  getRoleFromToken,
  decodeJwtPayload,
  extractKeycloakRoles,
  type AppRole,
  DEFAULT_ROLE,
} from "../lib/role-parser";

export interface User {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  permissions: string[];
  picture?: string;
}

/**
 * Decode a JWT token to extract user info (without verification - for UI purposes only)
 * Uses the centralized decodeJwtPayload from role-parser
 */
function decodeJwt(token: string): Record<string, unknown> | null {
  return decodeJwtPayload(token) as Record<string, unknown> | null;
}

/**
 * Base auth provider for local development - uses Keycloak tokens directly
 * The backend accepts Keycloak tokens and decodes them for local development
 */
export const authProvider: AuthProvider = {
  login: async ({ email, password, oidcToken, oidcUser }) => {
    logger.info("Attempting login", { email, isOidc: !!oidcToken });

    try {
      // OIDC token login (from Keycloak) - use token directly
      if (oidcToken) {
        // Store the Keycloak token directly - backend will decode it
        localStorage.setItem("arc_admin_token", oidcToken);

        // Extract user info and role from token for UI
        const decoded = decodeJwt(oidcToken);
        const role = getRoleFromToken(oidcToken);
        const user: User = {
          id: (decoded?.sub as string) || '',
          email: (decoded?.email as string) || (oidcUser?.profile?.email as string) || '',
          name: (decoded?.name as string) || (decoded?.preferred_username as string) || (oidcUser?.profile?.name as string) || '',
          role, // Role extracted from Keycloak token
          permissions: [], // Permissions are handled by backend based on Keycloak roles
          picture: (decoded?.picture as string) || (oidcUser?.profile?.picture as string),
        };
        logger.info("User role extracted from token", { role, keycloakRoles: extractKeycloakRoles(oidcToken) });

        localStorage.setItem("arc_admin_user", JSON.stringify(user));

        logger.info("OIDC login successful (direct token)", { userId: user.id });

        return {
          success: true,
          redirectTo: "/",
        };
      }

      // Local email/password login is not supported without backend endpoint
      // For local dev, use Keycloak authentication
      logger.warn("Local email/password login not supported - use Keycloak");
      return {
        success: false,
        error: {
          name: "LoginError",
          message: "Please use Keycloak authentication",
        },
      };
    } catch (error) {
      logger.error("Login error", { error });
      return {
        success: false,
        error: {
          name: "NetworkError",
          message: "Unable to process authentication",
        },
      };
    }
  },

  logout: async (_params?: unknown) => {
    logger.info("Logging out");

    // Just clear local storage - no backend call needed for Keycloak tokens
    localStorage.removeItem("arc_admin_token");
    localStorage.removeItem("arc_admin_refresh_token");
    localStorage.removeItem("arc_admin_user");

    return {
      success: true,
      redirectTo: "/login",
    };
  },

  check: async () => {
    const token = localStorage.getItem("arc_admin_token");

    if (!token) {
      return {
        authenticated: false,
        redirectTo: "/login",
        error: { name: "Unauthorized", message: "Not authenticated" },
      };
    }

    // Check if token is expired by decoding it
    try {
      const decoded = decodeJwt(token);
      if (decoded?.exp) {
        const expiry = (decoded.exp as number) * 1000; // Convert to milliseconds
        if (Date.now() > expiry) {
          logger.warn("Token expired");
          localStorage.removeItem("arc_admin_token");
          localStorage.removeItem("arc_admin_refresh_token");
          localStorage.removeItem("arc_admin_user");
          return {
            authenticated: false,
            redirectTo: "/login",
            error: { name: "TokenExpired", message: "Session expired" },
          };
        }
      }
      return { authenticated: true };
    } catch (error) {
      logger.error("Auth check failed", { error });
      return {
        authenticated: false,
        redirectTo: "/login",
        error: {
          name: "TokenError",
          message: "Invalid token",
        },
      };
    }
  },

  getPermissions: async () => {
    const userJson = localStorage.getItem("arc_admin_user");
    if (!userJson) return null;

    try {
      const user: User = JSON.parse(userJson);
      return user.permissions;
    } catch {
      return null;
    }
  },

  getIdentity: async () => {
    const userJson = localStorage.getItem("arc_admin_user");
    if (!userJson) return null;

    try {
      const user: User = JSON.parse(userJson);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.picture,
      };
    } catch {
      return null;
    }
  },

  onError: async (error) => {
    logger.error("Auth error", { error });

    if (error.status === 401 || error.status === 403) {
      return {
        logout: true,
        redirectTo: "/login",
        error,
      };
    }

    return { error };
  },
};

/**
 * Create a Keycloak OIDC-aware auth provider
 * For local development, Keycloak tokens are used directly with the backend
 */
export const createKeycloakAuthProvider = (oidc: {
  isAuthenticated: boolean;
  user: OidcUser | null | undefined;
  signinRedirect: () => Promise<void>;
  signoutRedirect: () => Promise<void>;
  removeUser: () => Promise<void>;
}): AuthProvider => {
  return {
    ...authProvider,

    login: async (params) => {
      // If OIDC is authenticated, use that token directly
      if (oidc.isAuthenticated && oidc.user) {
        try {
          const token = oidc.user.access_token;
          if (token) {
            return authProvider.login({ oidcToken: token, oidcUser: oidc.user });
          }
        } catch (error) {
          logger.error("Failed to get OIDC token", { error });
        }
      }

      // Fall back to local login if provided (not supported in local dev)
      if (params?.email && params?.password) {
        return authProvider.login(params);
      }

      // Redirect to Keycloak login
      try {
        await oidc.signinRedirect();
        return { success: true };
      } catch (error) {
        logger.error("Keycloak redirect failed", { error });
        return {
          success: false,
          error: {
            name: "LoginError",
            message: "Failed to redirect to login",
          },
        };
      }
    },

    logout: async (params?: unknown) => {
      // Clear local storage
      localStorage.removeItem("arc_admin_token");
      localStorage.removeItem("arc_admin_refresh_token");
      localStorage.removeItem("arc_admin_user");

      // If using OIDC, trigger Keycloak logout
      if (oidc.isAuthenticated) {
        try {
          await oidc.removeUser();
          await oidc.signoutRedirect();
        } catch (error) {
          logger.warn("Keycloak logout failed", { error });
        }
        return { success: true };
      }

      return authProvider.logout(params);
    },

    check: async () => {
      // Check OIDC authentication first
      if (oidc.isAuthenticated && oidc.user) {
        // Always sync OIDC token to local storage (token may have been refreshed)
        if (oidc.user.access_token) {
          const localToken = localStorage.getItem("arc_admin_token");
          // Always update if token differs (handles token refresh)
          if (localToken !== oidc.user.access_token) {
            localStorage.setItem("arc_admin_token", oidc.user.access_token);

            // Extract user info and role from OIDC token
            const profile = oidc.user.profile;
            const role = getRoleFromToken(oidc.user.access_token);
            const user: User = {
              id: profile.sub || '',
              email: profile.email || '',
              name: profile.name || profile.preferred_username || '',
              role, // Role extracted from Keycloak token
              permissions: [],
              picture: profile.picture,
            };
            localStorage.setItem("arc_admin_user", JSON.stringify(user));
            logger.info("OIDC token synced to local storage", { userId: user.id, role });
          }
        }
        return { authenticated: true };
      }

      // Fall back to local check
      return authProvider.check();
    },

    getIdentity: async () => {
      // Try OIDC user first
      if (oidc.isAuthenticated && oidc.user?.profile) {
        const profile = oidc.user.profile;
        return {
          id: profile.sub || "",
          name: profile.name || profile.preferred_username || profile.email || "",
          email: profile.email || "",
          avatar: profile.picture,
        };
      }

      // Fall back to local identity
      return authProvider.getIdentity?.() ?? null;
    },
  };
};
