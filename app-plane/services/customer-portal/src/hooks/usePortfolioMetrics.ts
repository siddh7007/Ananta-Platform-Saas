/**
 * usePortfolioMetrics Hook
 * @module hooks/usePortfolioMetrics
 *
 * React hook for fetching and managing portfolio dashboard metrics.
 * Supports automatic refresh, error handling, and loading states.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { PortfolioMetrics } from '../types/dashboard';
import { getPortfolioMetrics, PortfolioServiceOptions } from '../services/portfolio.service';

export interface UsePortfolioMetricsOptions {
  /** Organization/tenant ID */
  tenantId: string;
  /** Start date for metrics calculation */
  startDate?: Date;
  /** End date for metrics calculation */
  endDate?: Date;
  /** Auto-refresh interval in milliseconds (default: 5 minutes, 0 to disable) */
  refreshInterval?: number;
  /** Enable/disable the hook (default: true) */
  enabled?: boolean;
  /** Callback when data is successfully fetched */
  onSuccess?: (data: PortfolioMetrics) => void;
  /** Callback when fetch fails */
  onError?: (error: Error) => void;
}

export interface UsePortfolioMetricsReturn {
  /** Portfolio metrics data */
  data: PortfolioMetrics | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Manual refresh function */
  refetch: () => Promise<void>;
  /** Last update timestamp */
  lastUpdated: Date | null;
}

/**
 * Hook to fetch and manage portfolio metrics
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = usePortfolioMetrics({
 *   tenantId: 'org-123',
 *   refreshInterval: 300000, // 5 minutes
 * });
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorMessage error={error} />;
 * if (!data) return null;
 *
 * return <Dashboard metrics={data} onRefresh={refetch} />;
 * ```
 */
export function usePortfolioMetrics(
  options: UsePortfolioMetricsOptions
): UsePortfolioMetricsReturn {
  const {
    tenantId,
    startDate,
    endDate,
    refreshInterval = 300000, // 5 minutes default
    enabled = true,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<PortfolioMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Store callbacks in refs to avoid effect re-runs
  const callbackRefs = useRef({ onSuccess, onError });
  useEffect(() => {
    callbackRefs.current = { onSuccess, onError };
  });

  // Store fetchMetrics in a ref to avoid interval recreation
  const fetchMetricsRef = useRef<() => Promise<void>>();

  /**
   * Fetch portfolio metrics from API
   */
  const fetchMetrics = useCallback(async () => {
    if (!enabled || !tenantId) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);

      const serviceOptions: PortfolioServiceOptions = {
        tenantId,
        startDate,
        endDate,
      };

      const metrics = await getPortfolioMetrics(serviceOptions);

      if (isMountedRef.current) {
        setData(metrics);
        setLastUpdated(new Date());
        setIsLoading(false);

        // Call success callback if provided
        if (callbackRefs.current.onSuccess) {
          callbackRefs.current.onSuccess(metrics);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch portfolio metrics');

      if (isMountedRef.current) {
        setError(error);
        setIsLoading(false);

        // Call error callback if provided
        if (callbackRefs.current.onError) {
          callbackRefs.current.onError(error);
        }
      }

      console.error('[usePortfolioMetrics] Error:', error);
    }
  }, [tenantId, startDate, endDate, enabled]);

  // Keep ref updated with latest fetchMetrics function
  useEffect(() => {
    fetchMetricsRef.current = fetchMetrics;
  }, [fetchMetrics]);

  /**
   * Manual refetch function
   */
  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchMetrics();
  }, [fetchMetrics]);

  /**
   * Initial fetch on mount and when dependencies change
   */
  useEffect(() => {
    if (enabled && tenantId) {
      fetchMetrics();
    }
  }, [enabled, tenantId, startDate, endDate, fetchMetrics]);

  /**
   * Set up auto-refresh interval
   * Uses ref to avoid recreating interval when fetchMetrics changes
   */
  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Set up new interval if enabled and interval > 0
    if (enabled && refreshInterval > 0 && tenantId) {
      intervalRef.current = setInterval(() => {
        // Use ref to always call the latest version of fetchMetrics
        fetchMetricsRef.current?.();
      }, refreshInterval);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // Note: fetchMetrics is intentionally excluded to prevent interval recreation
    // fetchMetricsRef ensures we always call the latest version
  }, [enabled, refreshInterval, tenantId]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    data,
    isLoading,
    error,
    refetch,
    lastUpdated,
  };
}
