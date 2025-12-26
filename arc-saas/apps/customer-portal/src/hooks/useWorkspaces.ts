/**
 * useWorkspaces Hook
 *
 * Fetches workspaces for the current organization/tenant.
 * Workspaces are the container for projects and BOMs.
 *
 * Architecture:
 * - Organization (tenant) has many Workspaces
 * - Workspace has many Projects
 * - Project has many BOMs
 *
 * Features:
 * - Automatically refetches when organization changes
 * - Returns default workspace if available
 * - Supports workspace selection
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { cnsApi } from '@/lib/axios';
import { STALE_TIMES } from '@/lib/query-client';
import { useTenant } from '@/contexts/TenantContext';
import { apiLogger } from '@/lib/logger';

// ============================================
// Type Definitions
// ============================================

/**
 * Workspace from CNS API
 */
export interface Workspace {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description?: string;
  is_default: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  role?: string; // Current user's role in this workspace
}

/**
 * Workspace list response from CNS API
 */
export interface WorkspaceListResponse {
  items: Workspace[];
  total: number;
}

// Query key factory for workspaces
export const workspaceKeys = {
  all: ['workspaces'] as const,
  lists: () => [...workspaceKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...workspaceKeys.lists(), filters] as const,
  details: () => [...workspaceKeys.all, 'detail'] as const,
  detail: (id: string) => [...workspaceKeys.details(), id] as const,
};

// ============================================
// Workspace Hooks
// ============================================

/**
 * Hook to fetch workspaces for the current organization
 *
 * Features:
 * - 5 minute stale time (workspaces don't change often)
 * - Automatically filters by current tenant/organization
 * - Disabled when no tenant is selected
 *
 * @param options - Additional query options
 */
export function useWorkspaces(
  options?: Omit<UseQueryOptions<WorkspaceListResponse>, 'queryKey' | 'queryFn'>
) {
  const { currentTenant } = useTenant();
  const organizationId = currentTenant?.id;

  const queryKey = workspaceKeys.list({ organizationId });

  return useQuery<WorkspaceListResponse>({
    queryKey,
    queryFn: async () => {
      if (!organizationId) {
        return { items: [], total: 0 };
      }

      apiLogger.debug('Fetching workspaces for organization:', organizationId);

      // CNS API: GET /api/workspaces?organization_id=...
      const response = await cnsApi.get<WorkspaceListResponse>(
        `/workspaces?organization_id=${organizationId}`
      );

      apiLogger.debug('Workspaces fetched:', response.data.total);
      return response.data;
    },
    staleTime: STALE_TIMES.BOM_DETAIL, // 5 minutes
    placeholderData: (previousData) => previousData,
    enabled: !!organizationId,
    ...options,
  });
}

/**
 * Hook to get the default workspace for the current organization
 *
 * Returns:
 * - The default workspace if one exists
 * - The first workspace if no default is set
 * - null if no workspaces exist
 */
export function useDefaultWorkspace() {
  const { data, isLoading, error } = useWorkspaces();

  if (isLoading || error || !data?.items.length) {
    return { workspace: null, isLoading, error };
  }

  // Find default workspace, or fall back to first workspace
  const defaultWorkspace = data.items.find((ws) => ws.is_default) || data.items[0];

  return { workspace: defaultWorkspace, isLoading, error };
}

/**
 * Hook to get a single workspace by ID
 *
 * @param id - Workspace ID
 * @param options - Additional query options
 */
export function useWorkspace(
  id: string,
  options?: Omit<UseQueryOptions<Workspace>, 'queryKey' | 'queryFn'>
) {
  const queryKey = workspaceKeys.detail(id);

  return useQuery<Workspace>({
    queryKey,
    queryFn: async () => {
      const response = await cnsApi.get<Workspace>(`/workspaces/${id}`);
      return response.data;
    },
    staleTime: STALE_TIMES.BOM_DETAIL, // 5 minutes
    enabled: !!id,
    ...options,
  });
}

export default {
  useWorkspaces,
  useDefaultWorkspace,
  useWorkspace,
};
