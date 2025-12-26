/**
 * Component Search Cache
 * Caches component search results to reduce API calls
 *
 * Security: Cache keys include tenant ID to prevent cross-tenant data leakage
 * Performance: LRU eviction with TTL enforcement on read
 */

import type { Component } from '@/types/component';

const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 50;
const DETAIL_CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
const MAX_DETAIL_CACHE_ENTRIES = 100;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  tenantId: string;
}

interface ComponentSearchResult {
  components: Component[];
  total: number;
}

interface SearchParams {
  tenantId: string;
  query?: string;
  manufacturer?: string;
  category?: string;
  lifecycle?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * In-memory LRU cache for component searches
 * Tenant-scoped to prevent cross-tenant data leakage
 */
class ComponentSearchCache {
  private cache: Map<string, CacheEntry<ComponentSearchResult>> = new Map();
  private accessOrder: string[] = [];

  /**
   * Generate cache key from search parameters (includes tenant ID)
   */
  private generateKey(params: SearchParams): string {
    // Ensure tenant is always included in key
    return JSON.stringify({
      t: params.tenantId, // Tenant ID MUST be first for clarity
      q: params.query || '',
      m: params.manufacturer || '',
      c: params.category || '',
      lc: params.lifecycle || '',
      p: params.page || 1,
      l: params.limit || 20,
      sb: params.sortBy || 'mpn',
      so: params.sortOrder || 'asc',
    });
  }

  /**
   * Prune stale entries (called periodically)
   */
  private pruneStaleEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > CACHE_MAX_AGE_MS) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
    }
  }

  /**
   * Get cached search result
   * Returns null if no cache, stale, or wrong tenant
   */
  get(params: SearchParams): ComponentSearchResult | null {
    // Prune stale entries on 10% of reads
    if (Math.random() < 0.1) {
      this.pruneStaleEntries();
    }

    const key = this.generateKey(params);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Validate tenant (defense in depth - key already includes tenant)
    if (entry.tenantId !== params.tenantId) {
      this.cache.delete(key);
      return null;
    }

    // Check if cache entry is stale
    if (Date.now() - entry.timestamp > CACHE_MAX_AGE_MS) {
      this.cache.delete(key);
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      return null;
    }

    // Update access order (move to end for LRU)
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);

    return entry.data;
  }

  /**
   * Set cache entry
   * Only caches successful (non-error) responses
   */
  set(params: SearchParams, result: ComponentSearchResult): void {
    // Don't cache empty error responses
    if (!result || !Array.isArray(result.components)) {
      return;
    }

    const key = this.generateKey(params);

    // Evict oldest entries if cache is full
    while (this.cache.size >= MAX_CACHE_ENTRIES && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data: result,
      timestamp: Date.now(),
      tenantId: params.tenantId,
    });
    this.accessOrder.push(key);
  }

  /**
   * Invalidate all cache entries for a tenant
   */
  invalidateByTenant(tenantId: string): void {
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tenantId === tenantId) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
    }
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Invalidate cache entries matching a query for a tenant
   */
  invalidateByQuery(tenantId: string, query: string): void {
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tenantId === tenantId && key.includes(`"q":"${query}"`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; maxAgeMs: number } {
    return {
      size: this.cache.size,
      maxSize: MAX_CACHE_ENTRIES,
      maxAgeMs: CACHE_MAX_AGE_MS,
    };
  }
}

// Singleton instance
export const componentSearchCache = new ComponentSearchCache();

/**
 * Individual component cache (for component detail views)
 * Tenant-scoped with LRU eviction
 */
class ComponentDetailCache {
  private cache: Map<string, CacheEntry<Component>> = new Map();
  private accessOrder: string[] = [];

  /**
   * Generate tenant-scoped key
   */
  private generateKey(tenantId: string, componentId: string): string {
    return `${tenantId}:${componentId}`;
  }

  get(tenantId: string, componentId: string): Component | null {
    const key = this.generateKey(tenantId, componentId);
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Validate tenant
    if (entry.tenantId !== tenantId) {
      this.cache.delete(key);
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > DETAIL_CACHE_MAX_AGE_MS) {
      this.cache.delete(key);
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      return null;
    }

    // Update LRU order
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);

    return entry.data;
  }

  set(tenantId: string, componentId: string, component: Component): void {
    const key = this.generateKey(tenantId, componentId);

    // LRU eviction
    while (this.cache.size >= MAX_DETAIL_CACHE_ENTRIES && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data: component,
      timestamp: Date.now(),
      tenantId,
    });
    this.accessOrder.push(key);
  }

  invalidate(tenantId: string, componentId: string): void {
    const key = this.generateKey(tenantId, componentId);
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
  }

  invalidateByTenant(tenantId: string): void {
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tenantId === tenantId) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
    }
  }

  invalidateAll(): void {
    this.cache.clear();
    this.accessOrder = [];
  }
}

export const componentDetailCache = new ComponentDetailCache();

/**
 * Hook-friendly cache wrapper with automatic invalidation
 * Pass tenantId from useTenantId() hook
 */
export function createComponentCacheManager(tenantId: string) {
  return {
    search: {
      get: (params: Omit<SearchParams, 'tenantId'>) =>
        componentSearchCache.get({ ...params, tenantId }),
      set: (params: Omit<SearchParams, 'tenantId'>, result: ComponentSearchResult) =>
        componentSearchCache.set({ ...params, tenantId }, result),
      invalidate: () => componentSearchCache.invalidateByTenant(tenantId),
      invalidateByQuery: (query: string) =>
        componentSearchCache.invalidateByQuery(tenantId, query),
      stats: () => componentSearchCache.getStats(),
    },
    detail: {
      get: (componentId: string) => componentDetailCache.get(tenantId, componentId),
      set: (componentId: string, component: Component) =>
        componentDetailCache.set(tenantId, componentId, component),
      invalidate: (componentId: string) =>
        componentDetailCache.invalidate(tenantId, componentId),
      invalidateAll: () => componentDetailCache.invalidateByTenant(tenantId),
    },
    /** Clear all caches for current tenant (e.g., on logout) */
    clearAll: () => {
      componentSearchCache.invalidateByTenant(tenantId);
      componentDetailCache.invalidateByTenant(tenantId);
    },
  };
}

/** Clear all caches globally (e.g., on logout) */
export function clearAllCaches(): void {
  componentSearchCache.invalidateAll();
  componentDetailCache.invalidateAll();
}
