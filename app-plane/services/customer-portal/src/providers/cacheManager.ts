/**
 * Shared Cache Manager - Single Instance
 *
 * This module creates a SINGLE cache manager instance shared between
 * auth0AuthProvider.ts and dataProvider.ts.
 *
 * SECURITY: This prevents the cache leak vulnerability where multiple
 * cache instances would cause logout to only clear one cache, leaving
 * tenant/admin data in the other cache for the next user.
 */

import { createCacheManager } from '../lib/auth';

// Create single shared cache manager instance
const cacheManager = createCacheManager();

// Export all cache functions for use across modules
export const {
  getCachedTenantId,
  setCachedTenantId,
  getCachedSuperAdmin,
  setCachedSuperAdmin,
  clearCache,
} = cacheManager;
