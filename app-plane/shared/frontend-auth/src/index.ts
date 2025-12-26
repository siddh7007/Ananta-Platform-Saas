/**
 * @components-platform/frontend-auth
 *
 * Shared Auth0 + Supabase authentication for Components Platform frontends.
 *
 * This package provides:
 * - Auth0 authentication with React Admin integration
 * - Supabase authorization with RLS support
 * - Platform admin organization detection
 * - Data provider cache management (prevents data leaks)
 *
 * @example
 * ```ts
 * import { createAuth0AuthProvider, Auth0Login, createSupabaseClient } from '@components-platform/frontend-auth';
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
