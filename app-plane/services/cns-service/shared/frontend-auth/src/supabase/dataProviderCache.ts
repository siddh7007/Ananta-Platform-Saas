/**
 * Data Provider Cache Management
 *
 * Provides utilities to manage cached state in data providers.
 * This is critical for preventing data leaks across user sessions.
 */

export interface CacheState {
  cachedTenantId?: string;
  cachedSuperAdmin?: boolean;
  [key: string]: any;
}

/**
 * Create cache management utilities
 *
 * This returns functions to get, set, and clear cached state.
 * Use this pattern to ensure cache is properly cleared on logout.
 *
 * @example
 * ```ts
 * const { getCachedTenantId, setCachedTenantId, clearCache } = createCacheManager();
 *
 * // In your auth provider
 * export const clearDataProviderCache = clearCache;
 *
 * // In your data provider
 * const getTenantId = () => {
 *   let tenantId = getCachedTenantId();
 *   if (!tenantId) {
 *     // fetch from API
 *     tenantId = ...;
 *     setCachedTenantId(tenantId);
 *   }
 *   return tenantId;
 * };
 * ```
 */
export function createCacheManager() {
  let cacheState: CacheState = {};

  return {
    /**
     * Get cached tenant ID
     */
    getCachedTenantId: (): string | undefined => {
      return cacheState.cachedTenantId;
    },

    /**
     * Set cached tenant ID
     */
    setCachedTenantId: (tenantId: string | undefined): void => {
      cacheState.cachedTenantId = tenantId;
    },

    /**
     * Get cached super admin status
     */
    getCachedSuperAdmin: (): boolean | undefined => {
      return cacheState.cachedSuperAdmin;
    },

    /**
     * Set cached super admin status
     */
    setCachedSuperAdmin: (isSuperAdmin: boolean | undefined): void => {
      cacheState.cachedSuperAdmin = isSuperAdmin;
    },

    /**
     * Get custom cached value
     */
    getCached: (key: string): any => {
      return cacheState[key];
    },

    /**
     * Set custom cached value
     */
    setCached: (key: string, value: any): void => {
      cacheState[key] = value;
    },

    /**
     * Clear ALL cached state
     *
     * CRITICAL: Must be called on logout to prevent data leaks across user sessions
     */
    clearCache: (): void => {
      cacheState = {};
      console.log('[DataProviderCache] Cache cleared');
    },

    /**
     * Get entire cache state (for debugging)
     */
    getCacheState: (): CacheState => {
      return { ...cacheState };
    },
  };
}
