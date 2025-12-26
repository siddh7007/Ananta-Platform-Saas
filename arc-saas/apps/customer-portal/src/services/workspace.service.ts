/**
 * Workspace Service
 *
 * Manages workspaces and projects for organizing BOMs.
 * Uses CNS API for workspace/project CRUD (workspaces are handled by CNS service).
 *
 * IMPORTANT: CNS API requires `organization_id` as a query parameter.
 * The axios interceptor sets X-Organization-ID header, but query param is also needed.
 */

import { cnsApi, getTenantIdOrNull } from '@/lib/axios';
import type {
  Workspace,
  Project,
  WorkspaceSummary,
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
  CreateProjectPayload,
  UpdateProjectPayload,
  MoveBomPayload,
} from '@/types/workspace';

const API_PREFIX = '/workspaces';

/**
 * Get current organization ID from storage
 */
function getOrganizationId(): string | null {
  return getTenantIdOrNull();
}

// ============================================================================
// Workspace Operations
// ============================================================================

/**
 * Get all workspaces for the current organization
 * Requires organization_id query parameter for CNS API
 */
export async function getWorkspaces(): Promise<Workspace[]> {
  const organizationId = getOrganizationId();
  if (!organizationId) {
    console.warn('[workspace.service] No organization ID set, returning empty workspaces');
    return [];
  }
  const response = await cnsApi.get<Workspace[] | { data: Workspace[] }>(`${API_PREFIX}?organization_id=${organizationId}`);
  // Handle both array and { data: [...] } response formats
  const data = response.data;
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
    return data.data;
  }
  console.warn('[workspace.service] Unexpected response format, returning empty array');
  return [];
}

/**
 * Get a single workspace by ID
 */
export async function getWorkspace(id: string): Promise<Workspace> {
  const response = await cnsApi.get<Workspace>(`${API_PREFIX}/${id}`);
  return response.data;
}

/**
 * Create a new workspace
 */
export async function createWorkspace(
  payload: CreateWorkspacePayload
): Promise<Workspace> {
  const response = await cnsApi.post<Workspace>(API_PREFIX, payload);
  return response.data;
}

/**
 * Update a workspace
 */
export async function updateWorkspace(
  id: string,
  payload: UpdateWorkspacePayload
): Promise<Workspace> {
  const response = await cnsApi.patch<Workspace>(
    `${API_PREFIX}/${id}`,
    payload
  );
  return response.data;
}

/**
 * Delete a workspace (must be empty)
 */
export async function deleteWorkspace(id: string): Promise<void> {
  await cnsApi.delete(`${API_PREFIX}/${id}`);
}

/**
 * Archive a workspace (soft delete)
 */
export async function archiveWorkspace(id: string): Promise<Workspace> {
  return updateWorkspace(id, { isArchived: true });
}

// ============================================================================
// Project Operations
// ============================================================================

/**
 * Get all projects for a workspace
 */
export async function getProjects(workspaceId: string): Promise<Project[]> {
  const response = await cnsApi.get<Project[]>(
    `${API_PREFIX}/${workspaceId}/projects`
  );
  return response.data;
}

/**
 * Get all projects across all workspaces
 */
export async function getAllProjects(): Promise<Project[]> {
  const response = await cnsApi.get<Project[]>('/projects');
  return response.data;
}

/**
 * Get a single project by ID
 */
export async function getProject(
  workspaceId: string,
  projectId: string
): Promise<Project> {
  const response = await cnsApi.get<Project>(
    `${API_PREFIX}/${workspaceId}/projects/${projectId}`
  );
  return response.data;
}

/**
 * Create a new project
 */
export async function createProject(
  payload: CreateProjectPayload
): Promise<Project> {
  const response = await cnsApi.post<Project>(
    `${API_PREFIX}/${payload.workspaceId}/projects`,
    payload
  );
  return response.data;
}

/**
 * Update a project
 */
export async function updateProject(
  workspaceId: string,
  projectId: string,
  payload: UpdateProjectPayload
): Promise<Project> {
  const response = await cnsApi.patch<Project>(
    `${API_PREFIX}/${workspaceId}/projects/${projectId}`,
    payload
  );
  return response.data;
}

/**
 * Delete a project (must be empty)
 */
export async function deleteProject(
  workspaceId: string,
  projectId: string
): Promise<void> {
  await cnsApi.delete(
    `${API_PREFIX}/${workspaceId}/projects/${projectId}`
  );
}

// ============================================================================
// BOM Organization
// ============================================================================

/**
 * Move a BOM to a different project
 */
export async function moveBom(payload: MoveBomPayload): Promise<void> {
  await cnsApi.post('/boms/move', payload);
}

/**
 * Get BOMs for a specific project
 */
export async function getProjectBoms(projectId: string): Promise<unknown[]> {
  const response = await cnsApi.get(`/projects/${projectId}/boms`);
  return response.data;
}

// ============================================================================
// Summary & Stats
// ============================================================================

/**
 * Get workspace summary for dashboard
 *
 * Note: This endpoint may not be implemented in CNS yet.
 * Falls back to fetching basic counts from individual endpoints.
 */
export async function getWorkspaceSummary(): Promise<WorkspaceSummary> {
  const organizationId = getOrganizationId();
  if (!organizationId) {
    console.warn('[workspace.service] No organization ID set, returning empty summary');
    return {
      totalWorkspaces: 0,
      totalProjects: 0,
      totalBoms: 0,
      recentWorkspaces: [],
      recentProjects: [],
    };
  }
  try {
    const response = await cnsApi.get<WorkspaceSummary>(
      `${API_PREFIX}/summary?organization_id=${organizationId}`
    );
    return response.data;
  } catch (error) {
    // If the summary endpoint doesn't exist (404/403), compute from available data
    // This provides graceful degradation while the backend endpoint is being implemented
    console.warn('[workspace.service] Summary endpoint unavailable, computing from available data');

    // Fetch workspaces to compute basic stats
    const workspaces = await getWorkspaces();
    const totalWorkspaces = workspaces.length;

    // Count projects across all workspaces
    let totalProjects = 0;
    let totalBoms = 0;
    const recentWorkspaces = workspaces
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 5);

    // Get project counts (optional - may fail if workspaces have no projects yet)
    try {
      for (const ws of workspaces.slice(0, 5)) { // Limit to avoid too many requests
        const projects = await getProjects(ws.id);
        totalProjects += projects.length;
        totalBoms += projects.reduce((sum, p) => sum + (p.bomCount ?? 0), 0);
      }
    } catch {
      // Ignore project fetch errors - just use what we have
    }

    return {
      totalWorkspaces,
      totalProjects,
      totalBoms,
      recentWorkspaces: recentWorkspaces as WorkspaceSummary['recentWorkspaces'],
      recentProjects: [],
    };
  }
}

// ============================================================================
// Default Exports
// ============================================================================

export default {
  // Workspaces
  getWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  archiveWorkspace,

  // Projects
  getProjects,
  getAllProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,

  // BOMs
  moveBom,
  getProjectBoms,

  // Summary
  getWorkspaceSummary,
};
