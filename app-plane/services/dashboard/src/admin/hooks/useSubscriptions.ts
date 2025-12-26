import { useState, useEffect, useCallback } from 'react';
import { apiClient, buildResourcePath } from '@/admin/lib/apiClient';
import type { AxiosError } from 'axios';
import type { EnhancedError } from '@/admin/lib/errorMapping';

/**
 * Subscription status types
 */
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'cancelled'
  | 'paused'
  | 'expired'
  | 'pending'
  | 'inactive';

/**
 * Subscription data structure
 */
export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  startDate?: string;
  endDate?: string;
  trialEndDate?: string;
  cancelledAt?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * Hook options for filtering and sorting
 */
export interface UseSubscriptionsOptions {
  /** Tenant ID to filter by (optional, uses current tenant if not provided) */
  tenantId?: string;
  /** Additional filter criteria */
  filter?: Record<string, unknown>;
  /** Sort configuration */
  sort?: { field: string; order: 'asc' | 'desc' };
  /** Enable/disable automatic fetching */
  enabled?: boolean;
  /** Refresh interval in milliseconds (0 = no auto-refresh) */
  refreshInterval?: number;
}

/**
 * Return type for useSubscriptions hook
 */
export interface UseSubscriptionsResult {
  /** List of subscriptions */
  subscriptions: Subscription[];
  /** Loading state */
  loading: boolean;
  /** Error message (if any) */
  error: string | null;
  /** Refetch function to manually trigger fetch */
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch subscriptions list
 *
 * @example
 * ```tsx
 * const { subscriptions, loading, error } = useSubscriptions({
 *   filter: { status: 'active' },
 *   sort: { field: 'startDate', order: 'desc' },
 * });
 * ```
 */
export function useSubscriptions(options: UseSubscriptionsOptions = {}): UseSubscriptionsResult {
  const {
    tenantId,
    filter = {},
    sort = { field: 'createdAt', order: 'desc' },
    enabled = true,
    refreshInterval = 0,
  } = options;

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const params: Record<string, unknown> = {
        ...filter,
        _sort: sort.field,
        _order: sort.order,
      };

      // Add tenant filter if provided
      if (tenantId) {
        params.tenantId = tenantId;
      }

      const response = await apiClient.get(buildResourcePath('/subscriptions'), {
        params,
      });

      // Handle different response formats
      const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setSubscriptions(data);
    } catch (err) {
      const enhancedError = err as EnhancedError;
      setError(enhancedError.friendlyMessage || 'Failed to fetch subscriptions');
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, tenantId, JSON.stringify(filter), sort.field, sort.order]);

  // Initial fetch
  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  // Auto-refresh interval
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;

    const intervalId = setInterval(fetchSubscriptions, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval, fetchSubscriptions]);

  return {
    subscriptions,
    loading,
    error,
    refetch: fetchSubscriptions,
  };
}
