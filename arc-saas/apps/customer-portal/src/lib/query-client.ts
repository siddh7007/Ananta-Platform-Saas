/**
 * React Query Client Configuration
 * CBP-P3-006: Client-Side Caching Strategy
 *
 * Centralized configuration for TanStack Query (React Query) with:
 * - Default stale times and cache times
 * - Retry logic that skips 4xx errors
 * - Window focus refetching
 * - Global error handlers
 */

import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { apiLogger } from '@/lib/logger';

/**
 * Default stale times by resource type (in milliseconds)
 */
export const STALE_TIMES = {
  /** BOMs list - 2 minutes (frequently updated during enrichment) */
  BOM_LIST: 2 * 60 * 1000,
  /** BOM details - 5 minutes (more stable, but can change) */
  BOM_DETAIL: 5 * 60 * 1000,
  /** Component search - 10 minutes (relatively stable catalog data) */
  COMPONENT_SEARCH: 10 * 60 * 1000,
  /** Component details - 15 minutes (very stable) */
  COMPONENT_DETAIL: 15 * 60 * 1000,
  /** User profile - 5 minutes (can change but not frequently) */
  USER_PROFILE: 5 * 60 * 1000,
  /** Settings - 10 minutes (rarely changes) */
  SETTINGS: 10 * 60 * 1000,
  /** Default - 5 minutes */
  DEFAULT: 5 * 60 * 1000,
} as const;

/**
 * Cache time - how long to keep unused data in memory
 * Set to 30 minutes by default (6x the default stale time)
 */
export const CACHE_TIME = 30 * 60 * 1000;

/**
 * Retry configuration
 * Skip retries for 4xx errors (client errors) as they won't succeed
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  // Max 3 retries
  if (failureCount >= 3) {
    return false;
  }

  // Don't retry on 4xx errors (client errors)
  if (error && typeof error === 'object' && 'response' in error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status && status >= 400 && status < 500) {
      apiLogger.debug(`Skipping retry for ${status} error`);
      return false;
    }
  }

  // Retry on network errors and 5xx errors
  return true;
}

/**
 * Retry delay with exponential backoff
 * Delays: 1s, 2s, 4s
 */
function getRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 4000);
}

/**
 * Global error handler for queries
 */
function onQueryError(error: Error): void {
  apiLogger.error('[Query Error]', error.message);

  // You can add toast notifications here if needed
  // Example: toast.error('Failed to fetch data');
}

/**
 * Global error handler for mutations
 */
function onMutationError(error: Error): void {
  apiLogger.error('[Mutation Error]', error.message);

  // You can add toast notifications here if needed
  // Example: toast.error('Failed to save changes');
}

/**
 * Query cache with global error handling
 */
const queryCache = new QueryCache({
  onError: onQueryError,
});

/**
 * Mutation cache with global error handling
 */
const mutationCache = new MutationCache({
  onError: onMutationError,
});

/**
 * Create and configure the React Query client
 *
 * Features:
 * - Default stale time of 5 minutes
 * - Cache time of 30 minutes
 * - Retry logic that skips 4xx errors
 * - Refetch on window focus (but not on mount if data is fresh)
 * - Global error handlers
 */
export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      // Default stale time - data is considered fresh for 5 minutes
      staleTime: STALE_TIMES.DEFAULT,

      // Cache time - how long to keep unused data in memory
      gcTime: CACHE_TIME, // Note: gcTime replaced cacheTime in React Query v5

      // Retry configuration
      retry: shouldRetry,
      retryDelay: getRetryDelay,

      // Refetch configuration
      refetchOnWindowFocus: true, // Refetch when user returns to tab
      refetchOnMount: false, // Don't refetch on mount if data is fresh
      refetchOnReconnect: true, // Refetch when internet connection is restored

      // Network mode - fail fast when offline
      networkMode: 'online',

      // Structural sharing - reduce re-renders by reusing unchanged parts of data
      structuralSharing: true,
    },
    mutations: {
      // Retry mutations only once (mutations are more dangerous to retry)
      retry: 1,
      retryDelay: 1000,

      // Network mode
      networkMode: 'online',
    },
  },
});

/**
 * Invalidate all queries for a specific resource
 * Useful after mutations to refresh related data
 *
 * @param resourceKey - The resource key (e.g., 'boms', 'components')
 */
export function invalidateResource(resourceKey: string): Promise<void> {
  apiLogger.debug(`Invalidating queries for resource: ${resourceKey}`);
  return queryClient.invalidateQueries({
    queryKey: [resourceKey],
  });
}

/**
 * Invalidate multiple resources at once
 * Useful for complex mutations that affect multiple resources
 *
 * @param resourceKeys - Array of resource keys to invalidate
 */
export async function invalidateMultipleResources(resourceKeys: string[]): Promise<void> {
  apiLogger.debug(`Invalidating queries for resources: ${resourceKeys.join(', ')}`);
  await Promise.all(
    resourceKeys.map((key) =>
      queryClient.invalidateQueries({
        queryKey: [key],
      })
    )
  );
}

/**
 * Prefetch a query
 * Useful for preloading data before navigation
 *
 * @param queryKey - The query key to prefetch
 * @param queryFn - The function to fetch data
 * @param staleTime - Optional custom stale time
 */
export async function prefetchQuery<T>(
  queryKey: unknown[],
  queryFn: () => Promise<T>,
  staleTime?: number
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime: staleTime ?? STALE_TIMES.DEFAULT,
  });
}

/**
 * Clear all cached data
 * Use sparingly - typically only on logout or major state changes
 */
export function clearAllCache(): void {
  apiLogger.info('Clearing all React Query cache');
  queryClient.clear();
}

/**
 * Get query data from cache without triggering a fetch
 * Useful for optimistic updates or reading cached values
 *
 * @param queryKey - The query key to read
 */
export function getQueryData<T>(queryKey: unknown[]): T | undefined {
  return queryClient.getQueryData<T>(queryKey);
}

/**
 * Set query data in cache
 * Useful for optimistic updates or manual cache updates
 *
 * @param queryKey - The query key to update
 * @param data - The data to set (or updater function)
 */
export function setQueryData<T>(
  queryKey: unknown[],
  data: T | ((old: T | undefined) => T)
): void {
  queryClient.setQueryData<T>(queryKey, data);
}

/**
 * Cancel all outgoing queries
 * Useful when navigating away or on component unmount
 */
export async function cancelQueries(queryKey?: unknown[]): Promise<void> {
  if (queryKey) {
    await queryClient.cancelQueries({ queryKey });
  } else {
    await queryClient.cancelQueries();
  }
}

export default queryClient;
