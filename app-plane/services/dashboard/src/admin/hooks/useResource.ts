import { useState, useEffect, useCallback } from 'react';
import { apiClient, buildResourcePath } from '@/admin/lib/apiClient';
import type { EnhancedError } from '@/admin/lib/errorMapping';

/**
 * Generic resource hook options
 */
export interface UseResourceOptions<T = unknown> {
  /** Resource path (e.g., '/boms', '/users', '/invoices') */
  resource: string;
  /** Filter criteria */
  filter?: Record<string, unknown>;
  /** Sort configuration */
  sort?: { field: string; order: 'asc' | 'desc' };
  /** Pagination */
  pagination?: { page: number; perPage: number };
  /** Enable/disable automatic fetching */
  enabled?: boolean;
  /** Refresh interval in milliseconds (0 = no auto-refresh) */
  refreshInterval?: number;
  /** Transform function to apply to each item */
  transform?: (item: unknown) => T;
}

/**
 * Return type for useResource hook
 */
export interface UseResourceResult<T = unknown> {
  /** List of resources */
  data: T[];
  /** Total count (if available) */
  total: number | null;
  /** Loading state */
  loading: boolean;
  /** Error message (if any) */
  error: string | null;
  /** Refetch function to manually trigger fetch */
  refetch: () => Promise<void>;
}

/**
 * Generic custom hook to fetch any resource list
 *
 * This hook provides a flexible way to fetch data from any API endpoint
 * with filtering, sorting, and pagination support.
 *
 * @example
 * ```tsx
 * // Fetch BOMs
 * const { data: boms, loading, error } = useResource({
 *   resource: '/boms',
 *   filter: { status: 'active' },
 *   sort: { field: 'createdAt', order: 'desc' },
 * });
 *
 * // Fetch users
 * const { data: users } = useResource({
 *   resource: '/users',
 *   filter: { tenantId: 'tenant-123' },
 * });
 *
 * // Fetch invoices with pagination
 * const { data: invoices, total } = useResource({
 *   resource: '/invoices',
 *   pagination: { page: 1, perPage: 25 },
 * });
 * ```
 */
export function useResource<T = unknown>(options: UseResourceOptions<T>): UseResourceResult<T> {
  const {
    resource,
    filter = {},
    sort = { field: 'createdAt', order: 'desc' },
    pagination,
    enabled = true,
    refreshInterval = 0,
    transform,
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResource = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const params: Record<string, unknown> = {
        ...filter,
        _sort: sort.field,
        _order: sort.order,
      };

      // Add pagination if provided
      if (pagination) {
        params._start = (pagination.page - 1) * pagination.perPage;
        params._end = pagination.page * pagination.perPage;
      }

      const response = await apiClient.get(buildResourcePath(resource), {
        params,
      });

      // Handle different response formats
      let items: unknown[];
      let count: number | null = null;

      if (Array.isArray(response.data)) {
        items = response.data;
      } else if (response.data?.data) {
        items = Array.isArray(response.data.data) ? response.data.data : [];
        count = response.data.total ?? null;
      } else {
        items = [];
      }

      // Apply transform if provided
      const transformedData = transform ? items.map(transform) : (items as T[]);

      setData(transformedData);
      setTotal(count);
    } catch (err) {
      const enhancedError = err as EnhancedError;
      setError(enhancedError.friendlyMessage || `Failed to fetch ${resource}`);
      setData([]);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  }, [resource, enabled, JSON.stringify(filter), sort.field, sort.order, pagination?.page, pagination?.perPage, transform]);

  // Initial fetch
  useEffect(() => {
    fetchResource();
  }, [fetchResource]);

  // Auto-refresh interval
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;

    const intervalId = setInterval(fetchResource, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval, fetchResource]);

  return {
    data,
    total,
    loading,
    error,
    refetch: fetchResource,
  };
}

/**
 * Hook to fetch a single resource by ID
 */
export interface UseResourceByIdOptions<T = unknown> {
  /** Resource path (e.g., '/boms', '/users') */
  resource: string;
  /** Resource ID */
  id: string | null;
  /** Enable/disable automatic fetching */
  enabled?: boolean;
  /** Transform function to apply to the item */
  transform?: (item: unknown) => T;
}

export interface UseResourceByIdResult<T = unknown> {
  /** Resource data */
  data: T | null;
  /** Loading state */
  loading: boolean;
  /** Error message (if any) */
  error: string | null;
  /** Refetch function */
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch a single resource by ID
 *
 * @example
 * ```tsx
 * const { data: bom, loading, error } = useResourceById({
 *   resource: '/boms',
 *   id: 'bom-123',
 * });
 * ```
 */
export function useResourceById<T = unknown>(options: UseResourceByIdOptions<T>): UseResourceByIdResult<T> {
  const { resource, id, enabled = true, transform } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResource = useCallback(async () => {
    if (!enabled || !id) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(buildResourcePath(`${resource}/${id}`));

      // Handle different response formats
      const item = response.data?.data || response.data;

      // Apply transform if provided
      const transformedData = transform ? transform(item) : (item as T);

      setData(transformedData);
    } catch (err) {
      const enhancedError = err as EnhancedError;
      setError(enhancedError.friendlyMessage || `Failed to fetch ${resource}`);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [resource, id, enabled, transform]);

  // Fetch when ID or resource changes
  useEffect(() => {
    fetchResource();
  }, [fetchResource]);

  return {
    data,
    loading,
    error,
    refetch: fetchResource,
  };
}
