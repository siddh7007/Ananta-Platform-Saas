/**
 * Shared Cache Manager - Single Instance
 *
 * This module creates a SINGLE cache manager instance shared across
 * the CNS dashboard application.
 *
 * SECURITY: This prevents the cache leak vulnerability where multiple
 * cache instances would cause logout to only clear one cache, leaving
 * user data in the other cache for the next user.
 *
 * NOTE: CNS Dashboard is a platform staff tool with Auth0 enforcement.
 * All users must be members of the platform organization (configurable via VITE_DEFAULT_ORG_ID).
 */

import { createCacheManager } from './lib/auth';

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
