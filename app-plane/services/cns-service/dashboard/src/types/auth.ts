/**
 * Authentication & Authorization Types
 */

// ============================================================================
// Keycloak Token Types
// ============================================================================

/**
 * Keycloak JWT token payload structure
 */
export interface KeycloakTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  realm_access?: {
    roles: string[];
  };
  resource_access?: Record<string, { roles: string[] }>;
  roles?: string[];
  groups?: string[];
  exp: number;
  iat: number;
  iss?: string;
  aud?: string | string[];
  azp?: string;
  scope?: string;
  organization_id?: string;
  tenant_id?: string;
}

/**
 * Keycloak refresh token response
 */
export interface KeycloakTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: string;
  id_token?: string;
  scope?: string;
}

// ============================================================================
// Auth0 Token Types
// ============================================================================

/**
 * Auth0 ID token claims
 */
export interface Auth0IdTokenClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
  updated_at?: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  org_id?: string;
  [key: string]: unknown;
}

/**
 * Auth0 user profile
 */
export interface Auth0User {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
  updated_at?: string;
  [key: string]: unknown;
}

// ============================================================================
// Auth Provider Interface
// ============================================================================

/**
 * Authentication check result
 */
export interface AuthCheckResult {
  authenticated: boolean;
  error?: string;
}

/**
 * Login parameters
 */
export interface LoginParams {
  username?: string;
  email?: string;
  password?: string;
  [key: string]: unknown;
}

/**
 * User identity from auth provider
 */
export interface UserIdentity {
  id: string;
  fullName?: string;
  email?: string;
  avatar?: string;
  [key: string]: unknown;
}

/**
 * Permissions list
 */
export type Permissions = string[] | Record<string, unknown>;

// ============================================================================
// Session & Token Management
// ============================================================================

/**
 * Session state
 */
export interface SessionState {
  isAuthenticated: boolean;
  user?: UserIdentity;
  token?: string;
  expiresAt?: number;
}

/**
 * Token storage interface
 */
export interface TokenStorage {
  getToken: () => string | null;
  setToken: (token: string) => void;
  removeToken: () => void;
  isTokenValid: () => boolean;
}
