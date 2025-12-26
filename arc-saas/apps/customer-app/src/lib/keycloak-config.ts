/**
 * Keycloak OIDC Configuration for Customer App
 *
 * The customer app connects to tenant-specific Keycloak realms.
 * Each tenant has their own realm created during provisioning.
 *
 * Environment Variables:
 * VITE_KEYCLOAK_URL=http://localhost:8180
 */

import { WebStorageStateStore } from "oidc-client-ts";

// Keycloak server configuration
export const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL || "http://localhost:8180",
};

/**
 * Create OIDC configuration for a tenant-specific realm
 * Each tenant gets their own Keycloak realm (e.g., tenant-acme-corp)
 */
export function createOidcConfig(tenantKey: string) {
  const realm = `tenant-${tenantKey}`;
  const clientId = `${tenantKey}-app`;

  return {
    authority: `${keycloakConfig.url}/realms/${realm}`,
    client_id: clientId,
    redirect_uri: `${window.location.origin}/callback`,
    post_logout_redirect_uri: window.location.origin,
    scope: "openid profile email",
    response_type: "code",
    automaticSilentRenew: true,
    loadUserInfo: true,
    userStore: new WebStorageStateStore({ store: window.localStorage }),
  };
}

/**
 * Check if Keycloak is properly configured
 */
export const isKeycloakConfigured = (): boolean => {
  return Boolean(keycloakConfig.url);
};

/**
 * Authentication mode for customer app
 * - 'keycloak': Use Keycloak OAuth for authentication (tenant realm)
 * - 'local': Use local email/password authentication
 * - 'both': Show both options on login page
 */
export type AuthMode = "keycloak" | "local" | "both";

export const getAuthMode = (): AuthMode => {
  const mode = import.meta.env.VITE_AUTH_MODE as AuthMode;
  if (mode === "keycloak" || mode === "local" || mode === "both") {
    return mode;
  }
  // Default to 'keycloak' if configured
  return isKeycloakConfigured() ? "keycloak" : "local";
};
