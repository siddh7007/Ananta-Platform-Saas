/**
 * React-specific types
 */

import { TenantPgClient } from '../client';
import { TenantContext, PaginatedResult } from '../types';

/**
 * Context value for TenantDbProvider
 */
export interface TenantDbContextValue {
  client: TenantPgClient;
  tenant: TenantContext;
  isReady: boolean;
}

/**
 * Query options for useQuery hook
 */
export interface QueryOptions<T> {
  /** Enable/disable the query */
  enabled?: boolean;
  /** Stale time in milliseconds */
  staleTime?: number;
  /** Cache time in milliseconds */
  cacheTime?: number;
  /** Refetch on window focus */
  refetchOnWindowFocus?: boolean;
  /** Refetch interval in milliseconds */
  refetchInterval?: number;
  /** Select/transform data */
  select?: (data: T) => T;
  /** On success callback */
  onSuccess?: (data: T) => void;
  /** On error callback */
  onError?: (error: Error) => void;
}

/**
 * Mutation options
 */
export interface MutationOptions<TData, TVariables> {
  /** On success callback */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** On error callback */
  onError?: (error: Error, variables: TVariables) => void;
  /** On settled callback */
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
  /** Invalidate queries on success */
  invalidateQueries?: string[];
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

/**
 * Hook return type for paginated queries
 */
export interface UsePaginatedQueryResult<T> {
  data: PaginatedResult<T> | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  // Pagination helpers
  nextPage: () => void;
  previousPage: () => void;
  goToPage: (page: number) => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  currentPage: number;
  totalPages: number;
}
