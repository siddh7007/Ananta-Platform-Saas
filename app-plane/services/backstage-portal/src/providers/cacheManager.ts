/**
 * Shared Cache Manager - Single Instance
 *
 * This module creates a SINGLE cache manager instance shared between
 * auth0AuthProvider.ts and other modules that need caching.
 *
 * SECURITY: This prevents the cache leak vulnerability where multiple
 * cache instances would cause logout to only clear one cache, leaving
 * user data in the other cache for the next user.
 *
 * NOTE: Backstage Portal is a platform admin tool, so there's no tenant
 * filtering - admins see all organizations. However, we still need cache
 * management to prevent data leaking between admin user sessions.
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
