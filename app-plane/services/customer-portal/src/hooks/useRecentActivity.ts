/**
 * useRecentActivity Hook
 * @module hooks/useRecentActivity
 *
 * React hook for fetching and managing recent activity feed.
 * Supports infinite scroll and load more functionality.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { ActivityItem } from '../types/dashboard';
import { getRecentActivity } from '../services/portfolio.service';

export interface UseRecentActivityOptions {
  /** Organization/tenant ID */
  tenantId: string;
  /** Initial number of items to load (default: 10) */
  initialLimit?: number;
  /** Auto-refresh interval in milliseconds (default: 60 seconds, 0 to disable) */
  refreshInterval?: number;
  /** Enable/disable the hook (default: true) */
  enabled?: boolean;
  /** Callback when new activity is loaded */
  onActivityUpdate?: (activity: ActivityItem[]) => void;
}

export interface UseRecentActivityReturn {
  /** List of activity items */
  activity: ActivityItem[];
  /** Loading state for initial load */
  isLoading: boolean;
  /** Loading state for load more */
  isLoadingMore: boolean;
  /** Error state */
  error: Error | null;
  /** Manual refresh function */
  refetch: () => Promise<void>;
  /** Load more items function */
  loadMore: () => Promise<void>;
  /** Whether more items can be loaded */
  hasMore: boolean;
}

/**
 * Hook to fetch and manage recent activity
 *
 * @example
 * ```tsx
 * const { activity, isLoading, loadMore, hasMore } = useRecentActivity({
 *   tenantId: 'org-123',
 *   initialLimit: 10,
 * });
 *
 * return (
 *   <ActivityFeed
 *     items={activity}
 *     isLoading={isLoading}
 *     onLoadMore={loadMore}
 *     hasMore={hasMore}
 *   />
 * );
 * ```
 */
export function useRecentActivity(
  options: UseRecentActivityOptions
): UseRecentActivityReturn {
  const {
    tenantId,
    initialLimit = 10,
    refreshInterval = 60000, // 1 minute default
    enabled = true,
    onActivityUpdate,
  } = options;

  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentLimit, setCurrentLimit] = useState<number>(initialLimit);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const callbackRef = useRef(onActivityUpdate);

  // Update callback ref
  useEffect(() => {
    callbackRef.current = onActivityUpdate;
  });

  /**
   * Fetch activity from API
   */
  const fetchActivity = useCallback(
    async (limit: number, isLoadMore: boolean = false) => {
      if (!enabled || !tenantId) {
        setIsLoading(false);
        return;
      }

      try {
        setError(null);
        if (isLoadMore) {
          setIsLoadingMore(true);
        }

        const fetchedActivity = await getRecentActivity(tenantId, limit);

        if (isMountedRef.current) {
          setActivity(fetchedActivity);
          setIsLoading(false);
          setIsLoadingMore(false);

          // Update hasMore flag
          // If we got fewer items than requested, there's no more to load
          setHasMore(fetchedActivity.length >= limit);

          // Call update callback if provided
          if (callbackRef.current) {
            callbackRef.current(fetchedActivity);
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch recent activity');

        if (isMountedRef.current) {
          setError(error);
          setIsLoading(false);
          setIsLoadingMore(false);
        }

        console.error('[useRecentActivity] Error:', error);
      }
    },
    [tenantId, enabled]
  );

  /**
   * Manual refetch function
   */
  const refetch = useCallback(async () => {
    setIsLoading(true);
    setCurrentLimit(initialLimit);
    await fetchActivity(initialLimit, false);
  }, [fetchActivity, initialLimit]);

  /**
   * Load more items
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) {
      return;
    }

    const newLimit = currentLimit + initialLimit;
    setCurrentLimit(newLimit);
    await fetchActivity(newLimit, true);
  }, [currentLimit, initialLimit, hasMore, isLoadingMore, fetchActivity]);

  /**
   * Initial fetch on mount and when dependencies change
   */
  useEffect(() => {
    if (enabled && tenantId) {
      fetchActivity(currentLimit, false);
    }
  }, [enabled, tenantId, currentLimit, fetchActivity]);

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
        fetchActivity(currentLimit, false);
      }, refreshInterval);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, refreshInterval, tenantId, currentLimit, fetchActivity]);

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
    activity,
    isLoading,
    isLoadingMore,
    error,
    refetch,
    loadMore,
    hasMore,
  };
}
