/**
 * Tenant cache utilities with stale detection and validation
 */

const TENANT_CACHE_KEY = 'selected_tenant';
const TENANT_CACHE_TIMESTAMP_KEY = 'selected_tenant_timestamp';
const TENANT_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedTenant {
  id: string;
  name: string;
  key: string;
}

/**
 * Get cached tenant from localStorage with stale detection
 */
export function getCachedTenant(): CachedTenant | null {
  try {
    const cached = localStorage.getItem(TENANT_CACHE_KEY);
    const timestamp = localStorage.getItem(TENANT_CACHE_TIMESTAMP_KEY);

    if (!cached) return null;

    // Check if cache is stale
    if (timestamp) {
      const age = Date.now() - parseInt(timestamp, 10);
      if (age > TENANT_CACHE_MAX_AGE_MS) {
        console.warn('Tenant cache is stale, clearing...');
        clearCachedTenant();
        return null;
      }
    }

    return JSON.parse(cached) as CachedTenant;
  } catch (error) {
    console.error('Failed to read tenant cache:', error);
    clearCachedTenant();
    return null;
  }
}

/**
 * Set cached tenant in localStorage with timestamp
 */
export function setCachedTenant(tenant: CachedTenant): void {
  try {
    localStorage.setItem(TENANT_CACHE_KEY, JSON.stringify(tenant));
    localStorage.setItem(TENANT_CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error('Failed to cache tenant:', error);
  }
}

/**
 * Clear cached tenant from localStorage
 */
export function clearCachedTenant(): void {
  try {
    localStorage.removeItem(TENANT_CACHE_KEY);
    localStorage.removeItem(TENANT_CACHE_TIMESTAMP_KEY);
  } catch (error) {
    console.error('Failed to clear tenant cache:', error);
  }
}

/**
 * Check if cached tenant is in the list of valid tenants
 * Clears cache if tenant no longer exists
 */
export function validateCachedTenant(
  validTenantIds: string[]
): CachedTenant | null {
  const cached = getCachedTenant();

  if (!cached) return null;

  if (!validTenantIds.includes(cached.id)) {
    console.warn('Cached tenant no longer valid, clearing...');
    clearCachedTenant();
    return null;
  }

  return cached;
}

/**
 * Check if tenant cache exists (without loading full data)
 */
export function hasCachedTenant(): boolean {
  return localStorage.getItem(TENANT_CACHE_KEY) !== null;
}

/**
 * Get tenant cache age in milliseconds
 */
export function getTenantCacheAge(): number | null {
  const timestamp = localStorage.getItem(TENANT_CACHE_TIMESTAMP_KEY);
  if (!timestamp) return null;
  return Date.now() - parseInt(timestamp, 10);
}

/**
 * Check if tenant cache is approaching staleness (within 1 hour)
 */
export function isCacheNearStale(): boolean {
  const age = getTenantCacheAge();
  if (age === null) return false;
  return age > TENANT_CACHE_MAX_AGE_MS - 60 * 60 * 1000; // Within 1 hour of expiry
}
