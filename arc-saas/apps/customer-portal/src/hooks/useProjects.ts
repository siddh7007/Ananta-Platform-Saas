/**
 * useProjects Hook
 *
 * Fetches projects for the current workspace/tenant.
 * Used by ProjectsSection in the sidebar for dynamic project navigation.
 *
 * Features:
 * - Automatically refetches when workspace changes
 * - Includes upload counts for badge display
 * - Supports project filtering by status
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { cnsApi } from '@/lib/axios';
import { projectKeys } from '@/lib/query-keys';
import { STALE_TIMES, invalidateResource } from '@/lib/query-client';
import { useTenant } from '@/contexts/TenantContext';
import { useWorkspaceId } from '@/contexts/WorkspaceContext';
import { apiLogger } from '@/lib/logger';
import type { Project, ProjectStatus, UpdateProjectPayload } from '@/types/workspace';

// ============================================
// Type Definitions
// ============================================

/**
 * Project with upload statistics for sidebar display
 */
export interface ProjectWithUploads extends Project {
  /** Number of pending/in-progress uploads */
  pendingUploads: number;
  /** Number of completed uploads */
  completedUploads: number;
  /** Total upload count (for badge) */
  uploadsCount: number;
}

/**
 * Project list response from API
 */
export interface ProjectListResponse {
  data: ProjectWithUploads[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Filters for project list queries
 */
export interface ProjectListFilters {
  status?: ProjectStatus[];
  search?: string;
  workspaceId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// Project Hooks
// ============================================

/**
 * Workspace type from CNS API
 */
interface WorkspaceItem {
  id: string;
  name: string;
  is_default?: boolean;
  organization_id?: string;
}

/**
 * Hook to fetch workspaces for the current organization
 * Used internally to get workspace_id for project queries
 */
export function useWorkspaces() {
  const { currentTenant } = useTenant();
  const organizationId = currentTenant?.id;

  console.log('[useWorkspaces] Hook called', { organizationId, hasTenant: !!currentTenant });

  return useQuery({
    queryKey: ['workspaces', organizationId],
    queryFn: async () => {
      if (!organizationId) {
        console.log('[useWorkspaces] No organizationId, returning empty');
        return [];
      }
      // Fetch workspaces for this organization
      // API returns { items: [...], total: number }
      console.log('[useWorkspaces] Fetching workspaces for org:', organizationId);
      const response = await cnsApi.get<{ items: WorkspaceItem[]; total: number }>(
        `/workspaces?organization_id=${organizationId}`
      );
      console.log('[useWorkspaces] Response:', response.data);
      const items = response.data.items || [];
      console.log('[useWorkspaces] Extracted items:', items);
      return items;
    },
    staleTime: STALE_TIMES.BOM_LIST,
    enabled: !!organizationId,
  });
}

/**
 * Hook to fetch projects for the current workspace
 *
 * Features:
 * - 2 minute stale time (projects may update frequently during active work)
 * - Uses WorkspaceContext for current workspace (refetches when workspace changes)
 * - Includes upload counts for sidebar badges
 * - Disabled when no workspace is selected
 *
 * @param filters - Optional filter criteria
 * @param options - Additional query options
 */
export function useProjects(
  filters?: Omit<ProjectListFilters, 'workspaceId'>,
  options?: Omit<UseQueryOptions<ProjectListResponse>, 'queryKey' | 'queryFn'>
) {
  const { currentTenant } = useTenant();
  const organizationId = currentTenant?.id;

  // Use workspace from WorkspaceContext - automatically updates when workspace changes
  const workspaceId = useWorkspaceId();

  apiLogger.debug('[useProjects] Using workspace from context:', { workspaceId, organizationId });

  const fullFilters: ProjectListFilters = {
    ...filters,
    workspaceId: workspaceId || undefined,
  };

  // Cast to Record<string, unknown> for query key compatibility
  const queryKey = projectKeys.list(fullFilters as Record<string, unknown>);

  return useQuery<ProjectListResponse>({
    queryKey,
    queryFn: async () => {
      if (!workspaceId) {
        apiLogger.debug('[useProjects] No workspaceId, returning empty');
        return { data: [], total: 0, page: 1, pageSize: 20 };
      }

      const params = new URLSearchParams();

      // API requires workspace_id (snake_case)
      params.set('workspace_id', workspaceId);

      if (filters?.status?.length) {
        params.set('status', filters.status.join(','));
      }
      if (filters?.search) {
        params.set('search', filters.search);
      }
      if (filters?.sortBy) {
        params.set('sortBy', filters.sortBy);
        params.set('sortOrder', filters.sortOrder || 'desc');
      }

      // Include upload stats for sidebar badges
      params.set('include', 'uploadStats');

      // Note: cnsApi base URL already includes /api, so just use /projects
      apiLogger.debug('[useProjects] Calling /projects API with params:', params.toString());
      const response = await cnsApi.get<ProjectListResponse>(`/projects?${params}`);

      // Map API response to expected format
      const apiData = response.data as unknown as { items?: ProjectWithUploads[]; total?: number };
      const result = {
        data: apiData.items || [],
        total: apiData.total || 0,
        page: 1,
        pageSize: 20,
      };
      apiLogger.debug('[useProjects] Returning projects:', result.total);
      return result;
    },
    staleTime: STALE_TIMES.BOM_LIST, // 2 minutes - same as BOM list
    placeholderData: (previousData) => previousData,
    enabled: !!workspaceId && !!organizationId, // Only run if workspace is available
    ...options,
  });
}

/**
 * Hook to fetch a single project with details
 *
 * @param id - Project ID
 * @param options - Additional query options
 */
export function useProject(
  id: string,
  options?: Omit<UseQueryOptions<ProjectWithUploads>, 'queryKey' | 'queryFn'>
) {
  const queryKey = projectKeys.detail(id);

  return useQuery<ProjectWithUploads>({
    queryKey,
    queryFn: async () => {
      // Note: cnsApi base URL already includes /api
      const response = await cnsApi.get<ProjectWithUploads>(`/projects/${id}?include=uploadStats`);
      return response.data;
    },
    staleTime: STALE_TIMES.BOM_DETAIL, // 5 minutes
    enabled: !!id,
    ...options,
  });
}

/**
 * Input for creating a project
 *
 * Note: workspace_id is required by the CNS API.
 * The organization has workspaces, and projects belong to workspaces.
 */
export interface CreateProjectInput {
  /** Workspace ID where the project will be created (required) */
  workspace_id: string;
  /** Project name */
  name: string;
  /** Optional description */
  description?: string;
  /** Project status (defaults to 'active') */
  status?: 'active' | 'archived' | 'on_hold' | 'completed';
  /** Visibility level */
  visibility?: 'private' | 'team' | 'organization';
  /** Optional project code */
  project_code?: string;
  /** Optional start date (ISO string) */
  start_date?: string;
  /** Optional end date (ISO string) */
  end_date?: string;
  /** Optional tags */
  tags?: string[];
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Hook to create a new project
 *
 * Features:
 * - Invalidates project list queries after success
 * - Requires workspace_id (organization's workspace)
 *
 * Architecture:
 * - Organization (tenant) has many Workspaces
 * - Workspace has many Projects
 * - Project has many BOMs
 */
export function useCreateProject() {
  return useMutation({
    mutationFn: async (data: CreateProjectInput) => {
      if (!data.workspace_id) {
        throw new Error('Workspace ID is required');
      }

      // CNS API expects snake_case for workspace_id
      const payload = {
        workspace_id: data.workspace_id,
        name: data.name,
        description: data.description,
        status: data.status || 'active',
        visibility: data.visibility || 'private',
        project_code: data.project_code,
        start_date: data.start_date,
        end_date: data.end_date,
        tags: data.tags || [],
        metadata: data.metadata || {},
      };

      apiLogger.debug('Creating project with payload:', payload);

      // Note: cnsApi base URL already includes /api
      const response = await cnsApi.post<ProjectWithUploads>('/projects', payload);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all project list queries to refetch with new project
      invalidateResource('projects');
      apiLogger.info('Project created successfully');
    },
    onError: (error) => {
      apiLogger.error('Failed to create project:', error);
    },
  });
}

/**
 * Hook to update a project
 *
 * Features:
 * - Optimistic updates
 * - Invalidates detail and list queries on success
 */
export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();
  const queryKey = projectKeys.detail(id);

  return useMutation({
    mutationFn: async (data: UpdateProjectPayload) => {
      // Note: cnsApi base URL already includes /api
      const response = await cnsApi.patch<ProjectWithUploads>(`/projects/${id}`, data);
      return response.data;
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey });
      const previousProject = queryClient.getQueryData<ProjectWithUploads>(queryKey);

      if (previousProject) {
        queryClient.setQueryData<ProjectWithUploads>(queryKey, {
          ...previousProject,
          ...newData,
        });
      }

      return { previousProject };
    },
    onError: (_err, _newData, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(queryKey, context.previousProject);
      }
      apiLogger.error('Failed to update project');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

/**
 * Hook to delete a project
 *
 * Features:
 * - Removes from cache
 * - Invalidates list queries
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Note: cnsApi base URL already includes /api
      await cnsApi.delete(`/projects/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      apiLogger.info('Project deleted successfully');
    },
  });
}

/**
 * Hook to invalidate all project queries
 * Useful after batch operations or workspace switch
 */
export function useInvalidateProjects() {
  return () => invalidateResource('projects');
}

export default {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useInvalidateProjects,
};
