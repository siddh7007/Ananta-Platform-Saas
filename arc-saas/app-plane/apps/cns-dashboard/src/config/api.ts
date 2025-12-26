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
//
// IMPORTANT: Set VITE_PLATFORM_ORG_ID in .env to override the default.
// The default matches the seeded Platform Super Admin organization.

/**
 * CNS Staff Organization ID
 * Used for all BOM uploads from CNS Dashboard (unified workflow, legacy wizard, etc.)
 * This is the "Platform Super Admin" organization.
 *
 * Priority:
 * 1. VITE_PLATFORM_ORG_ID environment variable (recommended for production)
 * 2. Fallback to seeded default (for local development)
 */
export const CNS_STAFF_ORGANIZATION_ID = import.meta.env.VITE_PLATFORM_ORG_ID || 'a0000000-0000-0000-0000-000000000000';

/**
 * CNS Staff Organization Name (for display purposes)
 */
export const CNS_STAFF_ORGANIZATION_NAME = import.meta.env.VITE_PLATFORM_ORG_NAME || 'Platform Super Admin';

// Helper: build Authorization header for CNS admin endpoints.
// Reads build-time VITE_CNS_ADMIN_TOKEN and allows runtime override via localStorage 'cns_admin_api_token'.

// IMPORTANT: Direct access to import.meta.env for proper Vite replacement in production builds
const BUILD_TIME_ADMIN_TOKEN = import.meta.env.VITE_CNS_ADMIN_TOKEN;

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
 * Initialize admin token on app startup.
 * Forces sync from build-time env to localStorage.
 * Call this ONCE at app initialization (main.tsx) to ensure token is always available.
 *
 * This is crucial for private browsing mode where localStorage doesn't persist between sessions.
 */
export function initializeAdminToken(): void {
  if (typeof window === 'undefined') return;

  const envToken = normalizeToken(BUILD_TIME_ADMIN_TOKEN as string | undefined);
  const lsToken = normalizeToken(localStorage.getItem('cns_admin_api_token'));

  if (envToken) {
    // Force sync build-time token to localStorage on every app load
    // This ensures private mode always gets the token
    if (lsToken !== envToken) {
      console.log('[CNS Dashboard] 🔧 Initializing admin token from build-time environment');
      localStorage.setItem('cns_admin_api_token', envToken);
    }
  } else {
    console.warn('[CNS Dashboard] ⚠️ No build-time admin token found. Admin endpoints will fail.');
  }
}

export function getAdminAuthHeaders(): HeadersInit | undefined {
  // CNS Dashboard is a platform admin tool - ALWAYS use the admin token for API calls
  // Auth0 is used only for UI authentication, not for API authorization
  // This ensures consistent access to all tenant data for support purposes

  // CNS Admin API token (for service/admin authentication)
  const envToken = normalizeToken(BUILD_TIME_ADMIN_TOKEN as string | undefined);
  const lsToken = typeof window !== 'undefined' ? normalizeToken(localStorage.getItem('cns_admin_api_token')) : undefined;
  const token = lsToken ?? envToken;

  // Fallback sync if initializeAdminToken() wasn't called
  if (!lsToken && envToken && typeof window !== 'undefined') {
    console.log('[CNS Dashboard] Syncing build-time admin token to localStorage (fallback)');
    localStorage.setItem('cns_admin_api_token', envToken);
  }

  if (!token && typeof window !== 'undefined') {
    // Surface a console warning to help diagnose missing admin auth headers in dev environments.
    console.warn('[CNS Dashboard] Missing admin API token. Admin endpoints will return 401 until a token is set.');
    console.warn('[CNS Dashboard] Build-time token:', BUILD_TIME_ADMIN_TOKEN ? 'present' : 'missing');
    console.warn('[CNS Dashboard] localStorage token:', lsToken ? 'present' : 'missing');
  }

  return token ? { Authorization: `Bearer ${token}` } : undefined;
}
