/**
 * Auth Library for Customer Portal
 *
 * Provides Auth0 + Supabase authentication for the Components Platform.
 *
 * @example
 * ```ts
 * import { createAuth0AuthProvider, Auth0Login, createSupabaseClient } from './lib/auth';
 *
 * const supabase = createSupabaseClient({
 *   url: 'https://your-project.supabase.co',
 *   anonKey: 'your-anon-key',
 * });
 *
 * const authProvider = createAuth0AuthProvider({
 *   supabase,
 *   auth0Domain: 'dev-xxxxx.us.auth0.com',
 *   auth0ClientId: 'your-client-id',
 *   onClearCache: () => clearDataProviderCache(),
 * });
 * ```
 */

// Auth0 exports
export * from './auth0';

// Supabase exports
export * from './supabase';
