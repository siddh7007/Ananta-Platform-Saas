/**
 * React hooks for pg-client
 *
 * Provides React Query integration for tenant database operations.
 * Requires @tanstack/react-query as a peer dependency.
 */

export { TenantDbProvider, useTenantDb } from './provider';
export { useQuery, useMutation, useInfiniteQuery } from './hooks';
export { createQueryClient } from './query-client';
export type { TenantDbContextValue, QueryOptions, MutationOptions } from './types';
