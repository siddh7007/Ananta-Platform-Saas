/**
 * Custom Query Hooks with Optimized Caching
 * CBP-P3-006: Client-Side Caching Strategy
 *
 * Provides type-safe, optimized hooks for common data fetching patterns.
 * Each hook is configured with appropriate stale times and cache behavior.
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { cnsApi, platformApi } from '@/lib/axios';
import { queryKeys, BomListFilters, ComponentSearchFilters } from '@/lib/query-keys';
import { STALE_TIMES, invalidateResource } from '@/lib/query-client';
import { apiLogger } from '@/lib/logger';

// ============================================
// Type Definitions
// ============================================

/**
 * BOM data structure
 */
export interface Bom {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'enriching' | 'enriched' | 'error';
  totalLines?: number;
  enrichedLines?: number;
  errorLines?: number;
  createdAt: string;
  updatedAt: string;
  projectId?: string;
  organizationId: string;
}

/**
 * BOM list response
 */
export interface BomListResponse {
  data: Bom[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * BOM detail response (includes line items)
 */
export interface BomDetail extends Bom {
  lineItems?: BomLineItem[];
}

/**
 * BOM line item
 */
export interface BomLineItem {
  id: string;
  bomId: string;
  lineNumber: number;
  quantity: number;
  designator: string;
  manufacturerPartNumber?: string;
  manufacturer?: string;
  description?: string;
  enrichmentStatus: 'pending' | 'enriched' | 'failed' | 'manual';
  enrichedData?: Record<string, unknown>;
  qualityScore?: number;
}

/**
 * Component search result
 */
export interface ComponentSearchResult {
  id: string;
  mpn: string;
  manufacturer: string;
  description: string;
  category: string;
  package?: string;
  inStock: boolean;
  lifecycle: 'active' | 'nrnd' | 'obsolete' | 'unknown';
  leadTime?: number;
  minPrice?: number;
  maxPrice?: number;
  specs?: Record<string, string | number>;
}

/**
 * Component search response
 */
export interface ComponentSearchResponse {
  results: ComponentSearchResult[];
  totalCount: number;
  facets?: {
    categories?: Array<{ value: string; label: string; count: number }>;
    manufacturers?: Array<{ value: string; label: string; count: number }>;
    packages?: Array<{ value: string; label: string; count: number }>;
  };
}

/**
 * User profile
 */
export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role: string;
  organizationId: string;
  preferences?: Record<string, unknown>;
}

// ============================================
// BOM Hooks
// ============================================

/**
 * Hook to fetch BOM list with filters
 *
 * Features:
 * - 2 minute stale time (BOMs update frequently during enrichment)
 * - Placeholder data from previous query during refetch
 * - Background refetch on window focus
 * - Optimistic updates via cache
 *
 * @param filters - Filter criteria for the BOM list
 * @param options - Additional query options
 */
export function useBomList(
  filters?: BomListFilters,
  options?: Omit<UseQueryOptions<BomListResponse>, 'queryKey' | 'queryFn'>
) {
  const queryKey = queryKeys.boms.list(filters);

  return useQuery<BomListResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters?.status?.length) {
        params.set('status', filters.status.join(','));
      }
      if (filters?.search) {
        params.set('search', filters.search);
      }
      if (filters?.projectId) {
        params.set('projectId', filters.projectId);
      }
      if (filters?.dateRange) {
        params.set('fromDate', filters.dateRange.from.toISOString());
        params.set('toDate', filters.dateRange.to.toISOString());
      }
      if (filters?.sortBy) {
        params.set('sortBy', filters.sortBy);
        params.set('sortOrder', filters.sortOrder || 'desc');
      }

      const response = await cnsApi.get<BomListResponse>(`/boms?${params}`);
      return response.data;
    },
    staleTime: STALE_TIMES.BOM_LIST, // 2 minutes
    placeholderData: (previousData) => previousData, // Keep showing old data while refetching
    ...options,
  });
}

/**
 * Hook to fetch a single BOM with details
 *
 * Features:
 * - 5 minute stale time (details are more stable)
 * - Includes line items by default
 * - Optimistic updates for mutations
 *
 * @param id - BOM ID
 * @param options - Additional query options
 */
export function useBomDetail(
  id: string,
  options?: Omit<UseQueryOptions<BomDetail>, 'queryKey' | 'queryFn'>
) {
  const queryKey = queryKeys.boms.detail(id);

  return useQuery<BomDetail>({
    queryKey,
    queryFn: async () => {
      const response = await cnsApi.get<BomDetail>(`/boms/${id}?include=lineItems`);
      return response.data;
    },
    staleTime: STALE_TIMES.BOM_DETAIL, // 5 minutes
    enabled: !!id, // Don't run if no ID provided
    ...options,
  });
}

/**
 * Hook to create a new BOM
 *
 * Features:
 * - Invalidates BOM list queries after success
 * - Optimistic update support
 *
 * @param options - Mutation options
 */
export function useCreateBom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; projectId?: string }) => {
      const response = await cnsApi.post<BomDetail>('/boms', data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all BOM list queries to refetch with new BOM
      invalidateResource('boms');
      apiLogger.info('BOM created successfully');
    },
  });
}

/**
 * Hook to update a BOM
 *
 * Features:
 * - Optimistic updates - immediately updates cache
 * - Rollback on error
 * - Invalidates detail and list queries
 */
export function useUpdateBom(id: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.boms.detail(id);

  return useMutation({
    mutationFn: async (data: Partial<Bom>) => {
      const response = await cnsApi.patch<BomDetail>(`/boms/${id}`, data);
      return response.data;
    },
    // Optimistic update
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousBom = queryClient.getQueryData<BomDetail>(queryKey);

      // Optimistically update to the new value
      if (previousBom) {
        queryClient.setQueryData<BomDetail>(queryKey, {
          ...previousBom,
          ...newData,
        });
      }

      // Return context with the previous value
      return { previousBom };
    },
    // Rollback on error
    onError: (_err, _newData, context) => {
      if (context?.previousBom) {
        queryClient.setQueryData(queryKey, context.previousBom);
      }
      apiLogger.error('Failed to update BOM');
    },
    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.boms.lists() });
    },
  });
}

/**
 * Hook to delete a BOM
 *
 * Features:
 * - Invalidates list queries after success
 * - Removes detail from cache
 */
export function useDeleteBom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await cnsApi.delete(`/boms/${id}`);
    },
    onSuccess: (_data, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.boms.detail(id) });
      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: queryKeys.boms.lists() });
      apiLogger.info('BOM deleted successfully');
    },
  });
}

// ============================================
// Component Search Hooks
// ============================================

/**
 * Hook to search components with parametric filters
 *
 * Features:
 * - 10 minute stale time (component catalog is relatively stable)
 * - Debounced search support via enabled option
 * - Placeholder data during refetch
 * - Faceted search results
 *
 * @param query - Search query string
 * @param filters - Parametric filters
 * @param options - Additional query options
 */
export function useComponentSearch(
  query: string,
  filters?: ComponentSearchFilters,
  options?: Omit<UseQueryOptions<ComponentSearchResponse>, 'queryKey' | 'queryFn'>
) {
  const queryKey = queryKeys.components.search(query, filters);

  return useQuery<ComponentSearchResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();

      if (query) {
        params.set('q', query);
      }

      if (filters?.categories?.length) {
        params.set('categories', filters.categories.join(','));
      }
      if (filters?.manufacturers?.length) {
        params.set('manufacturers', filters.manufacturers.join(','));
      }
      if (filters?.packages?.length) {
        params.set('packages', filters.packages.join(','));
      }
      if (filters?.inStockOnly) {
        params.set('inStockOnly', 'true');
      }
      if (filters?.excludeObsolete) {
        params.set('excludeObsolete', 'true');
      }
      if (filters?.capacitanceRange) {
        params.set('capacitanceMin', String(filters.capacitanceRange[0]));
        params.set('capacitanceMax', String(filters.capacitanceRange[1]));
      }
      if (filters?.resistanceRange) {
        params.set('resistanceMin', String(filters.resistanceRange[0]));
        params.set('resistanceMax', String(filters.resistanceRange[1]));
      }
      if (filters?.voltageRange) {
        params.set('voltageMin', String(filters.voltageRange[0]));
        params.set('voltageMax', String(filters.voltageRange[1]));
      }
      if (filters?.sortBy) {
        params.set('sortBy', filters.sortBy);
        params.set('sortOrder', filters.sortOrder || 'asc');
      }

      // Use CNS API for component search (not Supabase - different JWT validation)
      // CNS endpoint: /catalog/search?query=...&search_type=mpn|manufacturer|category|description
      const response = await cnsApi.get<ComponentSearchResponse>(
        `/catalog/search?${params}`
      );
      return response.data;
    },
    staleTime: STALE_TIMES.COMPONENT_SEARCH, // 10 minutes
    placeholderData: (previousData) => previousData,
    enabled: query.length >= 2, // Only search if query is at least 2 characters
    ...options,
  });
}

/**
 * Hook to fetch component details
 *
 * @param id - Component ID
 * @param options - Additional query options
 */
export function useComponentDetail(
  id: string,
  options?: Omit<UseQueryOptions<ComponentSearchResult>, 'queryKey' | 'queryFn'>
) {
  const queryKey = queryKeys.components.detail(id);

  return useQuery<ComponentSearchResult>({
    queryKey,
    queryFn: async () => {
      // Use CNS API for component detail (not Supabase - different JWT validation)
      // CNS endpoint: /catalog/component/id/{component_id}
      const response = await cnsApi.get<ComponentSearchResult>(`/catalog/component/id/${id}`);
      return response.data;
    },
    staleTime: STALE_TIMES.COMPONENT_DETAIL, // 15 minutes
    enabled: !!id,
    ...options,
  });
}

// ============================================
// User Profile Hooks
// ============================================

/**
 * Hook to fetch current user profile
 *
 * Features:
 * - 5 minute stale time
 * - Cached across the app
 * - Automatically refetches on window focus
 */
export function useCurrentUser(
  options?: Omit<UseQueryOptions<UserProfile>, 'queryKey' | 'queryFn'>
) {
  const queryKey = queryKeys.user.current();

  return useQuery<UserProfile>({
    queryKey,
    queryFn: async () => {
      const response = await platformApi.get<UserProfile>('/auth/me');
      return response.data;
    },
    staleTime: STALE_TIMES.USER_PROFILE, // 5 minutes
    ...options,
  });
}

/**
 * Hook to update user profile
 *
 * Features:
 * - Optimistic updates
 * - Invalidates user queries on success
 */
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.user.profile();

  return useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      const response = await platformApi.patch<UserProfile>('/users/me', data);
      return response.data;
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey });
      const previousProfile = queryClient.getQueryData<UserProfile>(queryKey);

      if (previousProfile) {
        queryClient.setQueryData<UserProfile>(queryKey, {
          ...previousProfile,
          ...newData,
        });
      }

      return { previousProfile };
    },
    onError: (_err, _newData, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(queryKey, context.previousProfile);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
    },
  });
}

// ============================================
// Utility Hooks
// ============================================

/**
 * Hook to prefetch BOM detail
 * Useful for preloading on hover or navigation
 */
export function usePrefetchBomDetail() {
  const queryClient = useQueryClient();

  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.boms.detail(id),
      queryFn: async () => {
        const response = await cnsApi.get<BomDetail>(`/boms/${id}?include=lineItems`);
        return response.data;
      },
      staleTime: STALE_TIMES.BOM_DETAIL,
    });
  };
}

/**
 * Hook to invalidate all BOM queries
 * Useful after batch operations
 */
export function useInvalidateBoms() {
  return () => invalidateResource('boms');
}

/**
 * Hook to invalidate all component queries
 * Useful after catalog updates
 */
export function useInvalidateComponents() {
  return () => invalidateResource('components');
}

export default {
  useBomList,
  useBomDetail,
  useCreateBom,
  useUpdateBom,
  useDeleteBom,
  useComponentSearch,
  useComponentDetail,
  useCurrentUser,
  useUpdateUserProfile,
  usePrefetchBomDetail,
  useInvalidateBoms,
  useInvalidateComponents,
};
