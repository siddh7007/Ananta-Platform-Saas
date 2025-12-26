/**
 * Workspace Service
 *
 * Handles API calls for workspace management:
 * - GET /api/workspaces - List user's workspaces
 * - POST /api/workspaces - Create workspace
 * - GET /api/workspaces/:id - Get workspace details
 * - PUT /api/workspaces/:id - Update workspace
 * - DELETE /api/workspaces/:id - Delete workspace
 * - GET /api/workspaces/:id/members - List members
 * - POST /api/workspaces/:id/members - Add member
 * - DELETE /api/workspaces/:id/members/:userId - Remove member
 * - POST /api/workspaces/:id/invitations - Create invitation
 */

import { getAuthHeaders, getCurrentOrganizationId } from './cnsApi';

// Get CNS API URL from environment
const getCnsApiUrl = (): string => {
  return import.meta.env.VITE_CNS_API_URL || 'http://localhost:27800';
};

// =====================================================
// Storage Keys
// =====================================================

export const WORKSPACE_STORAGE_KEY = 'current_workspace_id';
export const WORKSPACE_NAME_STORAGE_KEY = 'current_workspace_name';

/**
 * Get current workspace ID from localStorage.
 */
export function getCurrentWorkspaceId(): string | null {
  return localStorage.getItem(WORKSPACE_STORAGE_KEY);
}

/**
 * Set current workspace ID in localStorage.
 */
export function setCurrentWorkspaceId(workspaceId: string): void {
  localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
}

/**
 * Clear workspace ID from localStorage.
 */
export function clearWorkspaceId(): void {
  localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  localStorage.removeItem(WORKSPACE_NAME_STORAGE_KEY);
}

// =====================================================
// Types
// =====================================================

export type WorkspaceRole = 'admin' | 'engineer' | 'analyst' | 'viewer';

export interface Workspace {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_default: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Current user's role in this workspace (from membership)
  role?: WorkspaceRole;
}

export interface WorkspaceMember {
  id: string;
  user_id: string;
  workspace_id: string;
  role: WorkspaceRole;
  created_at: string;
  // User details (joined)
  user?: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  invited_by: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

export interface CreateWorkspaceRequest {
  organization_id: string;
  name: string;
  slug?: string;
  description?: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  settings?: Record<string, unknown>;
}

export interface CreateInvitationRequest {
  email: string;
  role: WorkspaceRole;
  expires_days?: number;
}

export interface WorkspaceListResponse {
  items: Workspace[];
  total: number;
}

export interface InvitationListResponse {
  items: WorkspaceInvitation[];
  total: number;
}

export interface MemberListResponse {
  items: WorkspaceMember[];
  total: number;
}

// =====================================================
// Permissions Helper
// =====================================================

export interface WorkspacePermissions {
  canManageWorkspace: boolean;  // admin only
  canInviteMembers: boolean;    // admin only
  canRemoveMembers: boolean;    // admin only
  canCreateProject: boolean;    // admin, engineer
  canEditProject: boolean;      // admin, engineer
  canUploadBOM: boolean;        // admin, engineer
  canViewBOM: boolean;          // admin, engineer, analyst
  canViewProject: boolean;      // everyone
}

export function getWorkspacePermissions(role: WorkspaceRole | null): WorkspacePermissions {
  if (!role) {
    return {
      canManageWorkspace: false,
      canInviteMembers: false,
      canRemoveMembers: false,
      canCreateProject: false,
      canEditProject: false,
      canUploadBOM: false,
      canViewBOM: false,
      canViewProject: false,
    };
  }

  switch (role) {
    case 'admin':
      return {
        canManageWorkspace: true,
        canInviteMembers: true,
        canRemoveMembers: true,
        canCreateProject: true,
        canEditProject: true,
        canUploadBOM: true,
        canViewBOM: true,
        canViewProject: true,
      };
    case 'engineer':
      return {
        canManageWorkspace: false,
        canInviteMembers: false,
        canRemoveMembers: false,
        canCreateProject: true,
        canEditProject: true,
        canUploadBOM: true,
        canViewBOM: true,
        canViewProject: true,
      };
    case 'analyst':
      return {
        canManageWorkspace: false,
        canInviteMembers: false,
        canRemoveMembers: false,
        canCreateProject: false,
        canEditProject: false,
        canUploadBOM: false,
        canViewBOM: true,
        canViewProject: true,
      };
    case 'viewer':
      return {
        canManageWorkspace: false,
        canInviteMembers: false,
        canRemoveMembers: false,
        canCreateProject: false,
        canEditProject: false,
        canUploadBOM: false,
        canViewBOM: false,
        canViewProject: true,
      };
  }
}

// =====================================================
// Workspace Service Class
// =====================================================

class WorkspaceService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getCnsApiUrl();
  }

  /**
   * Get auth headers with workspace ID included
   */
  private async getHeaders(): Promise<HeadersInit> {
    const authHeaders = await getAuthHeaders();
    const workspaceId = getCurrentWorkspaceId();

    return {
      ...authHeaders,
      ...(workspaceId ? { 'X-Workspace-Id': workspaceId } : {}),
    };
  }

  /**
   * List all workspaces the current user has access to
   * @param organizationId - Organization to list workspaces for
   * @param limit - Max items to return (default 100)
   * @param offset - Pagination offset (default 0)
   * @param signal - AbortSignal to cancel the request
   */
  async listWorkspaces(
    organizationId?: string,
    limit: number = 100,
    offset: number = 0,
    signal?: AbortSignal
  ): Promise<WorkspaceListResponse> {
    const orgId = organizationId || getCurrentOrganizationId();
    if (!orgId) {
      throw new Error('No organization selected');
    }

    const params = new URLSearchParams({
      organization_id: orgId,
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/api/workspaces?${params}`, {
      method: 'GET',
      headers,
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to list workspaces' }));
      throw new Error(error.detail || 'Failed to list workspaces');
    }

    return response.json();
  }

  /**
   * Get workspace details by ID
   */
  async getWorkspace(workspaceId: string): Promise<Workspace> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to get workspace' }));
      throw new Error(error.detail || 'Failed to get workspace');
    }

    return response.json();
  }

  /**
   * Create a new workspace
   */
  async createWorkspace(request: CreateWorkspaceRequest): Promise<Workspace> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create workspace' }));
      throw new Error(error.detail || 'Failed to create workspace');
    }

    return response.json();
  }

  /**
   * Update workspace
   */
  async updateWorkspace(workspaceId: string, request: UpdateWorkspaceRequest): Promise<Workspace> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}`, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update workspace' }));
      throw new Error(error.detail || 'Failed to update workspace');
    }

    return response.json();
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete workspace' }));
      throw new Error(error.detail || 'Failed to delete workspace');
    }
  }

  /**
   * List workspace members
   */
  async listMembers(workspaceId: string): Promise<MemberListResponse> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}/members`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to list members' }));
      throw new Error(error.detail || 'Failed to list members');
    }

    return response.json();
  }

  /**
   * Add member to workspace
   */
  async addMember(workspaceId: string, userId: string, role: WorkspaceRole): Promise<WorkspaceMember> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}/members`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId, role }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to add member' }));
      throw new Error(error.detail || 'Failed to add member');
    }

    return response.json();
  }

  /**
   * Update member role
   */
  async updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<WorkspaceMember> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}/members/${userId}`, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update member role' }));
      throw new Error(error.detail || 'Failed to update member role');
    }

    return response.json();
  }

  /**
   * Remove member from workspace
   */
  async removeMember(workspaceId: string, userId: string): Promise<void> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}/members/${userId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to remove member' }));
      throw new Error(error.detail || 'Failed to remove member');
    }
  }

  /**
   * List workspace invitations
   */
  async listInvitations(workspaceId: string): Promise<InvitationListResponse> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}/invitations`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to list invitations' }));
      throw new Error(error.detail || 'Failed to list invitations');
    }

    return response.json();
  }

  /**
   * Create workspace invitation
   */
  async createInvitation(workspaceId: string, request: CreateInvitationRequest): Promise<WorkspaceInvitation> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}/invitations`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create invitation' }));
      throw new Error(error.detail || 'Failed to create invitation');
    }

    return response.json();
  }

  /**
   * Revoke invitation
   */
  async revokeInvitation(invitationId: string): Promise<void> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/api/invitations/${invitationId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to revoke invitation' }));
      throw new Error(error.detail || 'Failed to revoke invitation');
    }
  }

  /**
   * Accept invitation (used during signup/login)
   */
  async acceptInvitation(token: string): Promise<{
    success: boolean;
    workspace: { id: string; name: string };
    role: WorkspaceRole;
    message: string;
  }> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/api/invitations/${token}/accept`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to accept invitation' }));
      throw new Error(error.detail || 'Failed to accept invitation');
    }

    return response.json();
  }

  /**
   * Leave a workspace (remove yourself)
   */
  async leaveWorkspace(workspaceId: string): Promise<void> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}/leave`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to leave workspace' }));
      throw new Error(error.detail || 'Failed to leave workspace');
    }
  }
}

// Export singleton instance
export const workspaceService = new WorkspaceService();
export default workspaceService;
