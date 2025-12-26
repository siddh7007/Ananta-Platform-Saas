/**
 * BOM Portal Providers
 *
 * Centralized exports for all data and auth providers.
 *
 * For App.tsx, use:
 * ```tsx
 * import { dataProviderPromise, authProvider } from './providers';
 * ```
 */

// ============================================
// DATA PROVIDERS
// ============================================

/**
 * Composite Data Provider (recommended for production)
 *
 * Routes requests to appropriate backend:
 * - Domain data (boms, projects, etc.) → Supabase
 * - Control Plane (subscriptions, billing) → LoopBack
 */
export {
  dataProviderPromise,
  getDefaultDataProvider,
  getDataProviderType,
  getResourceRouting,
} from './dataProviderRouter';

/**
 * Individual data providers (for advanced usage)
 */
export { createCompositeDataProvider } from './compositeDataProvider';
export { loopbackDataProvider, createBomPortalDataProvider, RESOURCE_MAP as LOOPBACK_RESOURCE_MAP } from './loopbackDataProvider';
export { dataProvider as supabaseDataProvider, supabase } from './dataProvider';

// ============================================
// AUTH PROVIDERS
// ============================================

/**
 * Auth Provider Router (recommended for production)
 *
 * Selects appropriate auth provider based on configuration:
 * - Keycloak (default for ARC-SaaS)
 * - Auth0 (legacy)
 * - Supabase Auth
 */
export {
  authProvider,
  isUsingMockAuthBypass,
  getAuthMode,
} from './authProvider';

/**
 * Individual auth providers (for advanced usage)
 */
export { keycloakAuthProvider } from './keycloakAuthProvider';
export { createKeycloakAuthProvider } from '../lib/auth';

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Shared cache manager for tenant/admin data
 * Used by both data providers and auth providers
 */
export {
  getCachedTenantId,
  setCachedTenantId,
  getCachedSuperAdmin,
  setCachedSuperAdmin,
  clearCache,
} from './cacheManager';
