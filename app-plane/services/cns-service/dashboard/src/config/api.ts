/**
 * API Configuration
 *
 * Centralized API URL configuration.
 * Default ports: CNS API=27800, Dashboard=27810
 *
 * When running behind Traefik:
 * - Dashboard served at: http://localhost:27500/cns
 * - CNS API accessible at: http://localhost:27800/api (direct access)
 */

import { getAccessToken } from '../lib/keycloak/keycloakConfig';

// Read build-time API URL (set via VITE_CNS_API_URL build arg in docker-compose)
const BUILD_TIME_API_URL = import.meta.env.VITE_CNS_API_URL;

// Use environment variables with fallback defaults
const CNS_PORT = import.meta.env.VITE_CNS_PORT || '27800';
const CNS_DASHBOARD_PORT = import.meta.env.VITE_CNS_DASHBOARD_PORT || '27810';

const BUILD_TIME_DIRECTUS_URL = import.meta.env.VITE_DIRECTUS_URL || 'http://localhost:27500/directus';

// Construct API URLs
// Priority 1: Use build-time VITE_CNS_API_URL if set (docker-compose build arg)
// Priority 2: Fall back to localhost with CNS_PORT
let CNS_API_BASE_URL: string;

if (BUILD_TIME_API_URL) {
  // Use build-time URL and append /api if not already present
  CNS_API_BASE_URL = BUILD_TIME_API_URL.endsWith('/api')
    ? BUILD_TIME_API_URL
    : `${BUILD_TIME_API_URL}/api`;
} else {
  // Fallback to localhost
  CNS_API_BASE_URL = `http://localhost:${CNS_PORT}/api`;
}

export { CNS_API_BASE_URL };
export const CNS_API_URL = CNS_API_BASE_URL;
export const CNS_DASHBOARD_URL = `http://localhost:${CNS_DASHBOARD_PORT}`;
export const DIRECTUS_URL = BUILD_TIME_DIRECTUS_URL.replace(/\/$/, '');

// Export individual parts for flexibility
export const API_CONFIG = {
  cnsPort: CNS_PORT,
  dashboardPort: CNS_DASHBOARD_PORT,
  apiBaseUrl: CNS_API_BASE_URL,
  BASE_URL: CNS_API_BASE_URL,  // Alias for compatibility
  dashboardUrl: CNS_DASHBOARD_URL,
  buildTimeApiUrl: BUILD_TIME_API_URL,
  directusUrl: DIRECTUS_URL,
};

export default API_CONFIG;

// ============================================================================
// CNS Staff Organization Configuration
// ============================================================================
// All CNS Dashboard uploads use this single organization for consistency.
// This ensures staff uploads are isolated from customer data.

/**
 * CNS Staff Organization ID
 * Used for all BOM uploads from CNS Dashboard (unified workflow, legacy wizard, etc.)
 * This is the "Platform Super Admin" organization.
 */
export const CNS_STAFF_ORGANIZATION_ID = 'a0000000-0000-0000-0000-000000000000';

/**
 * CNS Staff Organization Name (for display purposes)
 */
export const CNS_STAFF_ORGANIZATION_NAME = 'Platform Super Admin';

// Helper: build Authorization header for CNS staff endpoints.
// Supports multiple auth strategies:
// 1. Keycloak JWT token (when VITE_AUTH_PROVIDER=keycloak, default)
// 2. Auth0 access token (when VITE_AUTH_PROVIDER=auth0)

const AUTH_PROVIDER = (import.meta.env.VITE_AUTH_PROVIDER || 'keycloak').toLowerCase();

const normalizeToken = (raw: string | null | undefined): string | undefined => {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
    return undefined;
  }
  return trimmed;
};

/**
 * Get authentication headers for API calls.
 *
 * Priority:
 * 1. Keycloak JWT token (if using Keycloak auth provider)
 * 2. Auth0 access token from localStorage (auth0_access_token)
 *
 * ALWAYS returns a HeadersInit object (never undefined) to prevent
 * runtime errors in fetch calls.
 */
export function getAuthHeaders(): HeadersInit {
  if (AUTH_PROVIDER === 'keycloak') {
    const keycloakToken = getAccessToken();
    if (keycloakToken) {
      return { Authorization: `Bearer ${keycloakToken}` };
    }
    console.warn('[CNS Dashboard] Keycloak auth enabled but no token yet. User may need to login.');
    return {};
  }

  if (AUTH_PROVIDER === 'auth0') {
    const auth0Token = typeof window !== 'undefined'
      ? normalizeToken(localStorage.getItem('auth0_access_token'))
      : undefined;
    if (auth0Token) {
      return { Authorization: `Bearer ${auth0Token}` };
    }
    console.warn('[CNS Dashboard] Auth0 auth enabled but no access token found.');
    return {};
  }

  console.warn('[CNS Dashboard] No auth provider configured. API calls will fail with 401.');
  return {};
}

/**
 * Check if auth headers contain a valid Authorization token.
 * Use this to validate before making authenticated API calls.
 */
export function hasValidAuthToken(): boolean {
  const headers = getAuthHeaders();
  return 'Authorization' in headers && typeof headers.Authorization === 'string' && headers.Authorization.length > 10;
}

/**
 * Async version of getAuthHeaders that ensures Keycloak is initialized.
 * Use this for initial API calls where Keycloak may still be initializing.
 * ALWAYS returns a HeadersInit object (never undefined).
 */
export async function getAuthHeadersAsync(): Promise<HeadersInit> {
  if (AUTH_PROVIDER === 'keycloak') {
    // Dynamic import to avoid circular dependency
    const { getToken } = await import('../lib/keycloak');
    const keycloakToken = await getToken();
    if (keycloakToken) {
      return { Authorization: `Bearer ${keycloakToken}` };
    }
    console.warn('[CNS Dashboard] Keycloak auth enabled but no token available.');
    return {};
  }

  return getAuthHeaders();
}
