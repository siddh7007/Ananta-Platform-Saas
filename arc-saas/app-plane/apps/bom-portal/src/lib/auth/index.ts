/**
 * Auth Library for BOM Portal
 *
 * Provides authentication for the ARC-SaaS App Plane applications.
 *
 * Supports two authentication modes:
 * 1. Keycloak + LoopBack (recommended for ARC-SaaS Control Plane integration)
 * 2. Auth0 + Supabase (legacy/standalone Components Platform deployments)
 *
 * @example Keycloak Authentication (Recommended for ARC-SaaS)
 * ```tsx
 * import { ReactKeycloakProvider } from '@react-keycloak/web';
 * import Keycloak from 'keycloak-js';
 * import { createKeycloakAuthProvider, KeycloakStateSync } from './lib/auth';
 *
 * const keycloak = new Keycloak({
 *   url: 'http://localhost:8180',
 *   realm: 'ananta-saas',
 *   clientId: 'bom-portal',
 * });
 *
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
 *       <KeycloakStateSync />
 *       <Admin authProvider={authProvider} dataProvider={dataProvider}>
 *         ...
 *       </Admin>
 *     </ReactKeycloakProvider>
 *   );
 * }
 * ```
 *
 * @example Auth0 Authentication (Legacy/Standalone)
 * ```ts
 * import { createAuth0AuthProvider, createSupabaseClient } from './lib/auth';
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

// Keycloak exports (recommended for ARC-SaaS)
export * from './keycloak';

// Auth0 exports (legacy/standalone)
export * from './auth0';

// Supabase exports (used with Auth0)
export * from './supabase';
