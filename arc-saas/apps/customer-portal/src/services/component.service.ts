import { cnsApi } from '@/lib/axios';
import type {
  Component,
  AlternateComponent,
  ComponentSearchParams,
  ComponentSearchResult,
} from '@/types/component';

// Re-export types for backwards compatibility
export type {
  Component,
  AlternateComponent,
  ComponentSearchParams,
  ComponentSearchResult,
};

/**
 * Component catalog service
 * Handles component search, lookup, and catalog operations
 *
 * SECURITY NOTE: All requests now route through CNS service which validates
 * Keycloak JWTs. Previously used supabaseApi (PostgREST) which uses a different
 * JWT secret and cannot validate Keycloak tokens.
 *
 * Endpoints prefix: /catalog (CNS routes component catalog operations)
 */

/**
 * Search components in the catalog
 * CNS endpoint: GET /catalog/search?query=...&search_type=mpn|manufacturer|category|description
 */
export async function searchComponents(
  params: ComponentSearchParams
): Promise<ComponentSearchResult> {
  const response = await cnsApi.get('/catalog/search', {
    params: {
      query: params.query || params.mpn || '',
      search_type: params.mpn ? 'mpn' : params.manufacturer ? 'manufacturer' : params.category ? 'category' : 'mpn',
      limit: params.limit ?? 50,
    },
  });

  // CNS returns { results: [...], total: number }
  const results = response.data.results ?? response.data.data ?? [];
  return {
    data: results,
    total: response.data.total ?? results.length,
    page: params.page ?? 1,
    limit: params.limit ?? 50,
  };
}

/**
 * Get component by ID
 * CNS endpoint: GET /catalog/component/id/{component_id}
 */
export async function getComponent(id: string): Promise<Component> {
  const response = await cnsApi.get(`/catalog/component/id/${id}`);
  return response.data;
}

/**
 * Get My Component (BOM line item) by ID
 * CNS endpoint: GET /catalog/my-components/{line_item_id}
 *
 * This is for viewing details of components from the user's BOMs,
 * which have different IDs than the global component catalog.
 */
export async function getMyComponent(id: string, organizationId: string): Promise<Component> {
  const response = await cnsApi.get(`/catalog/my-components/${id}`, {
    params: { organization_id: organizationId },
  });
  return response.data;
}

/**
 * Get component by MPN and manufacturer
 * CNS endpoint: GET /catalog/component/{mpn}
 */
export async function getComponentByMpn(
  mpn: string,
  manufacturer?: string
): Promise<Component | null> {
  try {
    const response = await cnsApi.get(`/catalog/component/${encodeURIComponent(mpn)}`);
    return response.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Get alternates for a component
 */
export async function getAlternates(
  mpn: string,
  manufacturer?: string
): Promise<AlternateComponent[]> {
  const response = await cnsApi.get('/components/alternates', {
    params: { mpn, manufacturer },
  });

  return response.data.alternates ?? [];
}

/**
 * Get categories list
 * CNS endpoint: GET /catalog/filters/categories
 */
export async function getCategories(): Promise<string[]> {
  try {
    const response = await cnsApi.get('/catalog/filters/categories');
    const categories = response.data.categories ?? [];
    return categories.map((c: { id: number }) => String(c.id));
  } catch {
    console.warn('[component.service] Categories endpoint unavailable');
    return [];
  }
}

/**
 * Get manufacturers list
 * CNS endpoint: GET /catalog/filters/manufacturers
 */
export async function getManufacturers(search?: string): Promise<string[]> {
  try {
    const response = await cnsApi.get('/catalog/filters/manufacturers', {
      params: { limit: 50 },
    });
    const manufacturers = response.data.manufacturers ?? [];
    return manufacturers.map((m: { id: number }) => String(m.id));
  } catch {
    console.warn('[component.service] Manufacturers endpoint unavailable');
    return [];
  }
}

/**
 * Get component lifecycle statistics
 *
 * Note: This endpoint may not be implemented in CNS yet.
 * Returns default zeros if the endpoint is unavailable.
 */
export async function getLifecycleStats(): Promise<{
  active: number;
  nrnd: number;
  obsolete: number;
  unknown: number;
}> {
  try {
    // CNS endpoint: GET /catalog/stats
    const response = await cnsApi.get('/catalog/stats');
    const stats = response.data;
    const byLifecycle = stats.by_lifecycle ?? {};
    return {
      active: byLifecycle['Active'] ?? byLifecycle['active'] ?? 0,
      nrnd: byLifecycle['NRND'] ?? byLifecycle['nrnd'] ?? 0,
      obsolete: byLifecycle['Obsolete'] ?? byLifecycle['obsolete'] ?? 0,
      unknown: byLifecycle['Unknown'] ?? byLifecycle['unknown'] ?? 0,
    };
  } catch {
    // If the stats endpoint doesn't exist (404), return default zeros
    console.warn('[component.service] Lifecycle stats endpoint unavailable, returning defaults');
    return {
      active: 0,
      nrnd: 0,
      obsolete: 0,
      unknown: 0,
    };
  }
}

/**
 * Bulk lookup components by MPNs
 */
export async function bulkLookup(
  mpns: { mpn: string; manufacturer?: string }[]
): Promise<{ found: Component[]; notFound: string[] }> {
  const response = await cnsApi.post('/components/bulk-lookup', { items: mpns });
  return response.data;
}

/**
 * Result from getComponentsById with explicit success/failure tracking
 */
export interface ComponentsFetchResult {
  components: Component[];
  failedIds: string[];
  errors: Array<{ id: string; error: string }>;
}

/**
 * Get multiple components by IDs (for comparison view)
 *
 * Improvements:
 * - Deduplicates IDs before fetching
 * - Returns explicit success/failure lists
 * - Aggregates errors for surfacing to user
 * - Preserves order of successfully fetched components
 */
export async function getComponentsById(
  ids: string[]
): Promise<ComponentsFetchResult> {
  // Handle empty input
  if (ids.length === 0) {
    return { components: [], failedIds: [], errors: [] };
  }

  // Deduplicate IDs
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return { components: [], failedIds: [], errors: [] };
  }

  const components: Component[] = [];
  const failedIds: string[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  // Fetch each component individually with error tracking
  // CNS endpoint: GET /catalog/component/id/{component_id}
  const results = await Promise.allSettled(
    uniqueIds.map(async (id) => {
      const response = await cnsApi.get(`/catalog/component/id/${id}`);
      return { id, data: response.data as Component };
    })
  );

  // Process results, maintaining order from input
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const id = uniqueIds[i];

    if (result.status === 'fulfilled') {
      components.push(result.value.data);
    } else {
      failedIds.push(id);
      const errorMessage = result.reason instanceof Error
        ? result.reason.message
        : 'Unknown error';
      errors.push({ id, error: errorMessage });
      console.warn(`Failed to fetch component ${id}:`, errorMessage);
    }
  }

  return { components, failedIds, errors };
}

export default {
  searchComponents,
  getComponent,
  getMyComponent,
  getComponentByMpn,
  getAlternates,
  getCategories,
  getManufacturers,
  getLifecycleStats,
  bulkLookup,
  getComponentsById,
};
