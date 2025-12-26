/**
 * Keycloak Authentication Module
 *
 * Provides Keycloak OIDC authentication for the ARC-SaaS App Plane applications.
 * Includes optional Supabase integration for authenticated database access.
 *
 * @example
 * ```tsx
 * import { ReactKeycloakProvider } from '@react-keycloak/web';
 * import Keycloak from 'keycloak-js';
 * import { createKeycloakAuthProvider, KeycloakStateSync, getKeycloakState } from './lib/auth/keycloak';
 *
 * // Initialize Keycloak client
 * const keycloak = new Keycloak({
 *   url: 'http://localhost:8180',
 *   realm: 'ananta-saas',
 *   clientId: 'bom-portal',
 * });
 *
 * // Create auth provider
 * const authProvider = createKeycloakAuthProvider({
 *   keycloakUrl: 'http://localhost:8180',
 *   realm: 'ananta-saas',
 *   clientId: 'bom-portal',
 *   onClearCache: () => clearDataProviderCache(),
 * });
 *
 * function App() {
 *   return (
 *     <ReactKeycloakProvider authClient={keycloak}>
 *       <KeycloakStateSync
 *         supabaseUrl={import.meta.env.VITE_SUPABASE_URL}
 *         supabaseAnonKey={import.meta.env.VITE_SUPABASE_ANON_KEY}
 *       />
 *       <Admin authProvider={authProvider} dataProvider={dataProvider}>
 *         ...
 *       </Admin>
 *     </ReactKeycloakProvider>
 *   );
 * }
 * ```
 *
 * When Supabase is configured, the KeycloakStateSync component will:
 * 1. Initialize the Supabase client with Keycloak token getter
 * 2. Pass Keycloak JWTs to Supabase PostgREST for RLS authentication
 * 3. Reset Supabase client on logout
 *
 * To make authenticated Supabase queries:
 * ```ts
 * import { getAuthenticatedSupabaseClient } from './lib/auth/supabase';
 *
 * const client = await getAuthenticatedSupabaseClient();
 * const { data, error } = await client.from('organizations').select('*');
 * ```
 */

export * from './keycloakState';
export * from './createKeycloakAuthProvider';
export * from './KeycloakStateSync';
