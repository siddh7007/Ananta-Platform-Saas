/**
 * Keycloak Auth Module - CNS Dashboard
 *
 * Alternative to Auth0 for SSO authentication
 * Configure via VITE_AUTH_PROVIDER=keycloak
 */

export * from './keycloakConfig';
export { keycloakAuthProvider, getToken, hasRole, isAdmin, isSuperAdmin, waitForAuth } from './keycloakAuthProvider';
export { KeycloakLogin } from './KeycloakLogin';
