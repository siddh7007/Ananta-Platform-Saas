/**
 * Deduplicated Fetch Hook
 *
 * Prevents duplicate in-flight API requests.
 * If a request is already pending for a given key, subsequent calls
 * will not trigger new requests until the first one completes.
 *
 * Features:
 * - Tracks in-flight requests by key
 * - Auto-clears after request completes
 * - Optional minimum interval between requests
 */

import { useCallback, useRef } from 'react';

interface FetchOptions {
  /** Unique key to identify this request type */
  key: string;
  /** Minimum interval between requests in ms (default: 0) */
  minInterval?: number;
}

interface FetchState {
  pending: boolean;
  lastFetchTime: number;
}

/**
 * Hook to deduplicate fetch requests.
 *
 * @returns Object with execute function and isPending checker
 *
 * @example
 * ```tsx
 * const { execute, isPending } = useDeduplicatedFetch();
 *
 * const handleRefresh = () => {
 *   execute(
 *     { key: 'enrichments', minInterval: 1000 },
 *     async () => {
 *       await loadEnrichments();
 *     }
 *   );
 * };
 * ```
 */
export function useDeduplicatedFetch() {
  const stateRef = useRef<Map<string, FetchState>>(new Map());

  const execute = useCallback(
    async <T>(
      options: FetchOptions,
      fetchFn: () => Promise<T>
    ): Promise<T | null> => {
      const { key, minInterval = 0 } = options;
      const state = stateRef.current.get(key);
      const now = Date.now();

      // Check if request is already pending
      if (state?.pending) {
        console.debug(`[useDeduplicatedFetch] Skipping duplicate request for: ${key}`);
        return null;
      }

      // Check minimum interval
      if (state && minInterval > 0) {
        const elapsed = now - state.lastFetchTime;
        if (elapsed < minInterval) {
          console.debug(
            `[useDeduplicatedFetch] Skipping request for ${key} (${elapsed}ms < ${minInterval}ms interval)`
          );
          return null;
        }
      }

      // Mark as pending
      stateRef.current.set(key, { pending: true, lastFetchTime: now });

      try {
        const result = await fetchFn();
        return result;
      } finally {
        // Mark as complete
        const currentState = stateRef.current.get(key);
        if (currentState) {
          stateRef.current.set(key, {
            pending: false,
            lastFetchTime: currentState.lastFetchTime,
          });
        }
      }
    },
    []
  );

  const isPending = useCallback((key: string): boolean => {
    return stateRef.current.get(key)?.pending ?? false;
  }, []);

  const reset = useCallback((key?: string) => {
    if (key) {
      stateRef.current.delete(key);
    } else {
      stateRef.current.clear();
    }
  }, []);

  return { execute, isPending, reset };
}

/**
 * Simple function to create a deduplication wrapper outside React.
 * Useful for service-level deduplication.
 */
export function createDeduplicator() {
  const pending = new Map<string, Promise<unknown>>();

  return async function dedupe<T>(
    key: string,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const existing = pending.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = fetchFn().finally(() => {
      pending.delete(key);
    });

    pending.set(key, promise);
    return promise;
  };
}

export default useDeduplicatedFetch;
