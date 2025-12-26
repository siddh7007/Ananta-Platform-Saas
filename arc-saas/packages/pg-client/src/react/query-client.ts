/**
 * Query client factory for tenant apps
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Create a configured QueryClient for tenant applications
 */
export function createQueryClient(options?: {
  staleTime?: number;
  cacheTime?: number;
  retries?: number;
}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: options?.staleTime ?? 30000, // 30 seconds
        gcTime: options?.cacheTime ?? 300000, // 5 minutes
        retry: options?.retries ?? 1,
        refetchOnWindowFocus: false,
        refetchOnMount: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
