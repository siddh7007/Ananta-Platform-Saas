/**
 * Keycloak OIDC Configuration
 *
 * Configure these values in your .env file:
 * VITE_KEYCLOAK_URL=http://localhost:8180
 * VITE_KEYCLOAK_REALM=ananta-saas
 * VITE_KEYCLOAK_CLIENT_ID=admin-app
 *
 * Port Notes:
 * - Local development (direct): port 8180 (VITE_KEYCLOAK_URL=http://localhost:8180)
 * - Docker (through compose): port 14003 externally (VITE_KEYCLOAK_URL=http://localhost:14003)
 * - Within Docker network: port 8080 internally (KEYCLOAK_URL=http://keycloak:8080)
 */

import { WebStorageStateStore } from "oidc-client-ts";
import { getEnv, checkKeycloakUrlConsistency } from "../config/env.schema";

// =============================================================================
// Validated Environment Configuration
// =============================================================================

/**
 * Get validated environment config.
 * This runs Zod validation and logs warnings in dev mode for missing vars.
 */
const env = getEnv();

// Log Keycloak URL consistency info in dev mode
checkKeycloakUrlConsistency();

// =============================================================================
// Exported Configuration
// =============================================================================

// Keycloak server configuration
export const keycloakConfig = {
  url: env.VITE_KEYCLOAK_URL,
  realm: env.VITE_KEYCLOAK_REALM,
  clientId: env.VITE_KEYCLOAK_CLIENT_ID,
};

/**
 * OIDC Configuration for react-oidc-context
 */
export const oidcConfig = {
  authority: `${keycloakConfig.url}/realms/${keycloakConfig.realm}`,
  client_id: keycloakConfig.clientId,
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: window.location.origin,
  scope: "openid profile email",
  response_type: "code",
  automaticSilentRenew: true,
  loadUserInfo: true,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  // Optional: for silent refresh
  // silent_redirect_uri: `${window.location.origin}/silent-renew.html`,
};

/**
 * Check if Keycloak is properly configured
 */
export const isKeycloakConfigured = (): boolean => {
  return Boolean(keycloakConfig.url && keycloakConfig.clientId);
};

/**
 * Authentication mode
 * - 'keycloak': Use Keycloak OAuth for authentication
 * - 'local': Use local email/password authentication
 * - 'both': Show both options on login page
 */
export type AuthMode = "keycloak" | "local" | "both";

export const getAuthMode = (): AuthMode => {
  const mode = env.VITE_AUTH_MODE;
  if (mode === "keycloak" || mode === "local" || mode === "both") {
    return mode;
  }
  // Default to 'keycloak' if configured, otherwise 'local'
  return isKeycloakConfigured() ? "keycloak" : "local";
};
