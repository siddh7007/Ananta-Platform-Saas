/**
 * React Query hooks for tenant database operations
 */

import {
  useQuery as useReactQuery,
  useMutation as useReactMutation,
  useInfiniteQuery as useReactInfiniteQuery,
  useQueryClient,
  QueryKey,
} from '@tanstack/react-query';
import { useTenantClient } from './provider';
import { QueryOptions, MutationOptions, PaginationOptions } from './types';
import { PaginatedResult } from '../types';

/**
 * Query hook for fetching data from a table
 */
export function useQuery<T extends Record<string, unknown>>(
  table: string,
  options?: {
    where?: Record<string, unknown>;
    orderBy?: string;
    queryOptions?: QueryOptions<T[]>;
  }
) {
  const client = useTenantClient();
  const queryKey = ['tenant', client.tenant.tenantKey, table, options?.where, options?.orderBy];

  return useReactQuery({
    queryKey,
    queryFn: async () => {
      return client.findAll<T>(table, {
        where: options?.where,
        orderBy: options?.orderBy,
      });
    },
    enabled: options?.queryOptions?.enabled ?? true,
    staleTime: options?.queryOptions?.staleTime ?? 30000,
    gcTime: options?.queryOptions?.cacheTime ?? 300000,
    refetchOnWindowFocus: options?.queryOptions?.refetchOnWindowFocus ?? false,
    refetchInterval: options?.queryOptions?.refetchInterval,
  });
}

/**
 * Query hook for fetching a single record by ID
 */
export function useQueryById<T extends Record<string, unknown>>(
  table: string,
  id: string | number | null | undefined,
  options?: {
    idColumn?: string;
    queryOptions?: QueryOptions<T | null>;
  }
) {
  const client = useTenantClient();
  const queryKey = ['tenant', client.tenant.tenantKey, table, 'byId', id];

  return useReactQuery({
    queryKey,
    queryFn: async () => {
      if (!id) return null;
      return client.findById<T>(table, id, options?.idColumn);
    },
    enabled: (options?.queryOptions?.enabled ?? true) && id != null,
    staleTime: options?.queryOptions?.staleTime ?? 30000,
  });
}

/**
 * Paginated query hook
 */
export function usePaginatedQuery<T extends Record<string, unknown>>(
  table: string,
  options?: {
    page?: number;
    pageSize?: number;
    where?: Record<string, unknown>;
    orderBy?: string;
    queryOptions?: QueryOptions<PaginatedResult<T>>;
  }
) {
  const client = useTenantClient();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;

  const queryKey = [
    'tenant',
    client.tenant.tenantKey,
    table,
    'paginated',
    page,
    pageSize,
    options?.where,
    options?.orderBy,
  ];

  return useReactQuery({
    queryKey,
    queryFn: async () => {
      return client.findPaginated<T>(table, {
        page,
        pageSize,
        where: options?.where,
        orderBy: options?.orderBy,
      });
    },
    enabled: options?.queryOptions?.enabled ?? true,
    staleTime: options?.queryOptions?.staleTime ?? 30000,
  });
}

/**
 * Infinite query hook for infinite scrolling
 */
export function useInfiniteQuery<T extends Record<string, unknown>>(
  table: string,
  options?: {
    pageSize?: number;
    where?: Record<string, unknown>;
    orderBy?: string;
  }
) {
  const client = useTenantClient();
  const pageSize = options?.pageSize ?? 20;

  const queryKey = [
    'tenant',
    client.tenant.tenantKey,
    table,
    'infinite',
    pageSize,
    options?.where,
    options?.orderBy,
  ];

  return useReactInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 1 }) => {
      return client.findPaginated<T>(table, {
        page: pageParam as number,
        pageSize,
        where: options?.where,
        orderBy: options?.orderBy,
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.hasNextPage) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    getPreviousPageParam: (firstPage) => {
      if (firstPage.hasPreviousPage) {
        return firstPage.page - 1;
      }
      return undefined;
    },
  });
}

/**
 * Mutation hook for inserting data
 */
export function useInsert<T extends Record<string, unknown>>(
  table: string,
  options?: MutationOptions<T, Record<string, unknown>>
) {
  const client = useTenantClient();
  const queryClient = useQueryClient();

  return useReactMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return client.insert<T>(table, data);
    },
    onSuccess: (data, variables) => {
      // Invalidate queries for this table
      queryClient.invalidateQueries({
        queryKey: ['tenant', client.tenant.tenantKey, table],
      });

      // Custom invalidations
      if (options?.invalidateQueries) {
        options.invalidateQueries.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      }

      options?.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      options?.onError?.(error as Error, variables);
    },
  });
}

/**
 * Mutation hook for updating data
 */
export function useUpdate<T extends Record<string, unknown>>(
  table: string,
  options?: MutationOptions<T | null, { id: string | number; data: Record<string, unknown> }>
) {
  const client = useTenantClient();
  const queryClient = useQueryClient();

  return useReactMutation({
    mutationFn: async ({ id, data }: { id: string | number; data: Record<string, unknown> }) => {
      return client.updateById<T>(table, id, data);
    },
    onSuccess: (data, variables) => {
      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: ['tenant', client.tenant.tenantKey, table],
      });

      options?.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      options?.onError?.(error as Error, variables);
    },
  });
}

/**
 * Mutation hook for deleting data
 */
export function useDelete(
  table: string,
  options?: MutationOptions<boolean, string | number>
) {
  const client = useTenantClient();
  const queryClient = useQueryClient();

  return useReactMutation({
    mutationFn: async (id: string | number) => {
      return client.deleteById(table, id);
    },
    onSuccess: (data, variables) => {
      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: ['tenant', client.tenant.tenantKey, table],
      });

      options?.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      options?.onError?.(error as Error, variables);
    },
  });
}

/**
 * Raw query hook
 */
export function useRawQuery<T extends Record<string, unknown>>(
  queryKey: QueryKey,
  sql: string,
  params?: unknown[],
  options?: QueryOptions<T[]>
) {
  const client = useTenantClient();
  const fullKey = ['tenant', client.tenant.tenantKey, 'raw', ...queryKey];

  return useReactQuery({
    queryKey: fullKey,
    queryFn: async () => {
      const result = await client.query<T>(sql, params);
      return result.rows;
    },
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 30000,
  });
}

export { useMutation } from '@tanstack/react-query';
