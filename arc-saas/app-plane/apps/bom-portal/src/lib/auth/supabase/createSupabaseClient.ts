/**
 * Supabase Client Factory with Keycloak JWT Support
 *
 * This module creates Supabase clients that can work with:
 * 1. Standard Supabase Auth (for testing/standalone)
 * 2. Keycloak JWTs (for Arc-SaaS integration)
 *
 * For Keycloak integration:
 * - The Keycloak access token is passed to Supabase's global headers
 * - PostgREST validates the JWT and extracts claims
 * - RLS policies use the JWT claims for tenant isolation
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  /**
   * Supabase project URL
   */
  url: string;

  /**
   * Supabase anonymous key
   */
  anonKey: string;

  /**
   * Auto-refresh token (default: true)
   * Set to false when using external auth (Keycloak)
   */
  autoRefreshToken?: boolean;

  /**
   * Persist session (default: true)
   * Set to false when using external auth (Keycloak)
   */
  persistSession?: boolean;

  /**
   * Detect session in URL (default: true)
   * Set to false when using external auth (Keycloak)
   */
  detectSessionInUrl?: boolean;
}

export interface SupabaseWithKeycloakConfig extends SupabaseConfig {
  /**
   * Function to get the current Keycloak access token
   * This will be called for each request to get a fresh token
   */
  getAccessToken: () => Promise<string | null>;
}

// Store the singleton client instance
let supabaseClient: SupabaseClient | null = null;

// Store the token getter for dynamic token updates
let tokenGetter: (() => Promise<string | null>) | null = null;

// Store config for creating authenticated clients
let supabaseUrl: string = '';
let supabaseAnonKey: string = '';

/**
 * Create Supabase client with standard configuration
 * Use this for standalone Supabase auth or testing
 */
export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  const {
    url,
    anonKey,
    autoRefreshToken = true,
    persistSession = true,
    detectSessionInUrl = true,
  } = config;

  supabaseUrl = url;
  supabaseAnonKey = anonKey;

  supabaseClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken,
      persistSession,
      detectSessionInUrl,
    },
  });

  return supabaseClient;
}

/**
 * Create Supabase client configured for Keycloak JWT authentication
 *
 * This creates a client that:
 * - Disables Supabase's built-in auth (no session persistence)
 * - Uses Keycloak access tokens for PostgREST authentication
 * - Supports dynamic token refresh via getAccessToken callback
 *
 * @example
 * ```typescript
 * const client = createSupabaseClientWithKeycloak({
 *   url: 'http://localhost:27540',
 *   anonKey: 'your-anon-key',
 *   getAccessToken: async () => keycloak.token || null,
 * });
 * ```
 */
export function createSupabaseClientWithKeycloak(
  config: SupabaseWithKeycloakConfig
): SupabaseClient {
  const { url, anonKey, getAccessToken } = config;

  // Store for later use
  supabaseUrl = url;
  supabaseAnonKey = anonKey;
  tokenGetter = getAccessToken;

  // Create client with auth disabled (we use Keycloak tokens)
  supabaseClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return supabaseClient;
}

/**
 * Get the current Supabase client instance
 * Returns null if not initialized
 */
export function getSupabaseClient(): SupabaseClient | null {
  return supabaseClient;
}

/**
 * Get a Supabase client with fresh Keycloak token in headers
 *
 * This is the recommended way to make authenticated requests.
 * It ensures the token is fresh before making the request.
 *
 * @example
 * ```typescript
 * const client = await getAuthenticatedSupabaseClient();
 * const { data, error } = await client.from('organizations').select('*');
 * ```
 */
export async function getAuthenticatedSupabaseClient(): Promise<SupabaseClient | null> {
  if (!supabaseClient) {
    console.error('[Supabase] Client not initialized');
    return null;
  }

  if (tokenGetter) {
    const token = await tokenGetter();
    if (token) {
      // Create a new client instance with the fresh token
      // This ensures each request uses the current token
      return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });
    }
  }

  return supabaseClient;
}

/**
 * Create a one-off Supabase client with a specific token
 * Useful for server-side operations or testing
 *
 * @param url - Supabase URL
 * @param anonKey - Supabase anon key
 * @param accessToken - The access token to use
 */
export function createSupabaseClientWithToken(
  url: string,
  anonKey: string,
  accessToken: string
): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Reset the Supabase client (useful for logout)
 */
export function resetSupabaseClient(): void {
  supabaseClient = null;
  tokenGetter = null;
}
