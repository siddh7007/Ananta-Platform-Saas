/**
 * usePortfolioAlerts Hook
 * @module hooks/usePortfolioAlerts
 *
 * React hook for fetching and managing portfolio alerts.
 * Alerts refresh more frequently than full metrics.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Alert } from '../types/dashboard';
import { getPortfolioAlerts } from '../services/portfolio.service';

export interface UsePortfolioAlertsOptions {
  /** Organization/tenant ID */
  tenantId: string;
  /** Auto-refresh interval in milliseconds (default: 2 minutes) */
  refreshInterval?: number;
  /** Enable/disable the hook (default: true) */
  enabled?: boolean;
  /** Callback when alerts are fetched */
  onAlertsUpdate?: (alerts: Alert[]) => void;
}

export interface UsePortfolioAlertsReturn {
  /** List of critical alerts */
  alerts: Alert[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Manual refresh function */
  refetch: () => Promise<void>;
  /** Number of critical alerts */
  criticalCount: number;
  /** Number of warning alerts */
  warningCount: number;
}

/**
 * Hook to fetch and manage portfolio alerts
 *
 * @example
 * ```tsx
 * const { alerts, criticalCount, isLoading, refetch } = usePortfolioAlerts({
 *   tenantId: 'org-123',
 *   refreshInterval: 120000, // 2 minutes
 * });
 *
 * return (
 *   <AlertBanner
 *     alerts={alerts}
 *     criticalCount={criticalCount}
 *     onRefresh={refetch}
 *   />
 * );
 * ```
 */
export function usePortfolioAlerts(
  options: UsePortfolioAlertsOptions
): UsePortfolioAlertsReturn {
  const {
    tenantId,
    refreshInterval = 120000, // 2 minutes default
    enabled = true,
    onAlertsUpdate,
  } = options;

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const callbackRef = useRef(onAlertsUpdate);

  // Update callback ref
  useEffect(() => {
    callbackRef.current = onAlertsUpdate;
  });

  /**
   * Fetch alerts from API
   */
  const fetchAlerts = useCallback(async () => {
    if (!enabled || !tenantId) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);

      const fetchedAlerts = await getPortfolioAlerts(tenantId);

      if (isMountedRef.current) {
        setAlerts(fetchedAlerts);
        setIsLoading(false);

        // Call update callback if provided
        if (callbackRef.current) {
          callbackRef.current(fetchedAlerts);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch alerts');

      if (isMountedRef.current) {
        setError(error);
        setIsLoading(false);
      }

      console.error('[usePortfolioAlerts] Error:', error);
    }
  }, [tenantId, enabled]);

  /**
   * Manual refetch function
   */
  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchAlerts();
  }, [fetchAlerts]);

  /**
   * Initial fetch on mount and when dependencies change
   */
  useEffect(() => {
    if (enabled && tenantId) {
      fetchAlerts();
    }
  }, [enabled, tenantId, fetchAlerts]);

  /**
   * Set up auto-refresh interval
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
        fetchAlerts();
      }, refreshInterval);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, refreshInterval, tenantId, fetchAlerts]);

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

  // Calculate alert counts by severity
  const criticalCount = alerts.filter(a => a.severity === 'error').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  return {
    alerts,
    isLoading,
    error,
    refetch,
    criticalCount,
    warningCount,
  };
}
