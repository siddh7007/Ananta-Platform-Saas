import { useState, useEffect, useCallback } from 'react';
import { apiClient, buildResourcePath } from '@/admin/lib/apiClient';
import type { AxiosError } from 'axios';
import type { EnhancedError } from '@/admin/lib/errorMapping';

/**
 * Tenant data structure
 */
export interface Tenant {
  id: string;
  name: string;
  key: string;
  status: number;
  domains?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * Hook options for filtering and sorting
 */
export interface UsTenantsOptions {
  /** Filter criteria */
  filter?: Record<string, unknown>;
  /** Sort configuration */
  sort?: { field: string; order: 'asc' | 'desc' };
  /** Enable/disable automatic fetching */
  enabled?: boolean;
  /** Refresh interval in milliseconds (0 = no auto-refresh) */
  refreshInterval?: number;
}

/**
 * Return type for useTenants hook
 */
export interface UsTenantsResult {
  /** List of tenants */
  tenants: Tenant[];
  /** Loading state */
  loading: boolean;
  /** Error message (if any) */
  error: string | null;
  /** Refetch function to manually trigger fetch */
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch tenants list
 *
 * @example
 * ```tsx
 * const { tenants, loading, error, refetch } = useTenants({
 *   filter: { status: 1 },
 *   sort: { field: 'name', order: 'asc' },
 * });
 * ```
 */
export function useTenants(options: UsTenantsOptions = {}): UsTenantsResult {
  const { filter = {}, sort = { field: 'name', order: 'asc' }, enabled = true, refreshInterval = 0 } = options;

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTenants = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get('/tenants/my-tenants', {
        params: {
          ...filter,
          _sort: sort.field,
          _order: sort.order,
        },
      });

      // Handle different response formats
      const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setTenants(data);
    } catch (err) {
      const enhancedError = err as EnhancedError;
      setError(enhancedError.friendlyMessage || 'Failed to fetch tenants');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, JSON.stringify(filter), sort.field, sort.order]);

  // Initial fetch
  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  // Auto-refresh interval
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;

    const intervalId = setInterval(fetchTenants, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval, fetchTenants]);

  return {
    tenants,
    loading,
    error,
    refetch: fetchTenants,
  };
}
