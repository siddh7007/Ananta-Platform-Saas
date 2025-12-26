/**
 * Organizations API Client
 *
 * Type-safe API client for multi-org management endpoints:
 * - GET /api/organizations/me - Get user's organizations
 * - POST /api/organizations - Create new organization
 * - GET /api/organizations/{org_id} - Get org details
 * - PATCH /api/organizations/{org_id} - Update org
 * - DELETE /api/organizations/{org_id} - Delete org (soft)
 * - GET /api/organizations/{org_id}/members - List members
 * - POST /api/organizations/{org_id}/invitations - Invite member
 * - DELETE /api/organizations/{org_id}/members/{user_id} - Remove member
 * - POST /api/organizations/{org_id}/leave - Leave organization
 * - POST /api/organizations/{org_id}/transfer-ownership - Transfer ownership
 * - POST /api/organizations/invitations/{token}/accept - Accept invitation
 */

import { getAuthHeaders, CNS_BASE_URL } from './cnsApi';

// =====================================================
// Types - Match backend Pydantic models
// =====================================================

export type OrgRole = 'owner' | 'admin' | 'engineer' | 'analyst' | 'viewer' | 'super_admin' | 'billing_admin' | 'member';
export type PlanType = 'free' | 'professional' | 'enterprise';
export type InviteRole = 'admin' | 'engineer' | 'analyst' | 'viewer'; // owner not allowed

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  plan_type: PlanType;
  role: OrgRole;
  joined_at: string | null;
  is_owner: boolean;
}

export interface OrganizationDetail {
  id: string;
  name: string;
  slug: string | null;
  plan_type: string;
  member_count: number;
  created_at: string;
  your_role: OrgRole;
}

export interface Member {
  user_id: string;
  email: string;
  full_name: string | null;
  role: OrgRole;
  joined_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: InviteRole;
  expires_at: string;
  invite_url: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// Request types
export interface CreateOrganizationRequest {
  name: string;
  slug?: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
}

export interface InviteMemberRequest {
  email: string;
  role: InviteRole;
}

export interface TransferOwnershipRequest {
  new_owner_user_id: string;
}

// Response types
export interface AcceptInvitationResponse {
  success: boolean;
  organization_id: string;
  organization_name: string;
  role: string;
  message: string;
}

export interface LeaveOrganizationResponse {
  success: boolean;
  message: string;
}

export interface TransferOwnershipResponse {
  success: boolean;
  message: string;
  new_owner: {
    user_id: string;
    email: string;
    full_name: string | null;
  };
  your_new_role: string;
}

export interface UpdateMemberRoleRequest {
  role: InviteRole;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: InviteRole;
  created_at: string;
  expires_at: string;
  invited_by_email: string | null;
}

export interface UsageMetrics {
  organization_id: string;
  bom_count: number;
  project_count: number;
  member_count: number;
  storage_mb: number;
  api_calls_30d: number;
  pending_invitations: number;
  plan_type: PlanType;
  limits: {
    max_boms: number;
    max_projects: number;
    max_members: number;
    storage_mb: number;
  };
}

// =====================================================
// API Client Class
// =====================================================

class OrganizationsApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = CNS_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get all organizations the current user is a member of
   */
  async getMyOrganizations(
    limit: number = 50,
    offset: number = 0
  ): Promise<PaginatedResponse<Organization>> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const headers = await getAuthHeaders();
    const response = await fetch(
      `${this.baseUrl}/api/organizations/me?${params}`,
      {
        method: 'GET',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to fetch organizations' }));
      throw new Error(error.detail || error.message || 'Failed to fetch organizations');
    }

    return response.json();
  }

  /**
   * Create a new organization
   * The current user becomes the owner
   */
  async createOrganization(data: CreateOrganizationRequest): Promise<Organization> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create organization' }));
      throw new Error(error.detail || error.message || 'Failed to create organization');
    }

    return response.json();
  }

  /**
   * Get organization details
   */
  async getOrganization(orgId: string): Promise<OrganizationDetail> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/organizations/${orgId}`, {
      method: 'GET',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to fetch organization' }));
      throw new Error(error.detail || error.message || 'Failed to fetch organization');
    }

    return response.json();
  }

  /**
   * Update organization details
   * Only admins and owners can update
   */
  async updateOrganization(
    orgId: string,
    data: UpdateOrganizationRequest
  ): Promise<OrganizationDetail> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/organizations/${orgId}`, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update organization' }));
      throw new Error(error.detail || error.message || 'Failed to update organization');
    }

    return response.json();
  }

  /**
   * Delete organization (soft delete)
   * Only the owner can delete
   */
  async deleteOrganization(orgId: string): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/organizations/${orgId}`, {
      method: 'DELETE',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete organization' }));
      throw new Error(error.detail || error.message || 'Failed to delete organization');
    }
  }

  /**
   * Get all members of an organization
   */
  async getMembers(
    orgId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PaginatedResponse<Member>> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const headers = await getAuthHeaders();
    const response = await fetch(
      `${this.baseUrl}/api/organizations/${orgId}/members?${params}`,
      {
        method: 'GET',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to fetch members' }));
      throw new Error(error.detail || error.message || 'Failed to fetch members');
    }

    return response.json();
  }

  /**
   * Invite a user to the organization
   * Only admins and owners can invite
   */
  async inviteMember(orgId: string, data: InviteMemberRequest): Promise<Invitation> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${this.baseUrl}/api/organizations/${orgId}/invitations`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to send invitation' }));
      throw new Error(error.detail || error.message || 'Failed to send invitation');
    }

    return response.json();
  }

  /**
   * Remove a member from the organization
   * Admins can remove members, owners can remove admins
   */
  async removeMember(orgId: string, userId: string): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${this.baseUrl}/api/organizations/${orgId}/members/${userId}`,
      {
        method: 'DELETE',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to remove member' }));
      throw new Error(error.detail || error.message || 'Failed to remove member');
    }
  }

  /**
   * Leave an organization
   * Owners cannot leave without transferring ownership first
   */
  async leaveOrganization(orgId: string): Promise<LeaveOrganizationResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${this.baseUrl}/api/organizations/${orgId}/leave`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to leave organization' }));
      throw new Error(error.detail || error.message || 'Failed to leave organization');
    }

    return response.json();
  }

  /**
   * Transfer ownership to another member
   * Only the owner can transfer ownership
   */
  async transferOwnership(
    orgId: string,
    data: TransferOwnershipRequest
  ): Promise<TransferOwnershipResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${this.baseUrl}/api/organizations/${orgId}/transfer-ownership`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to transfer ownership' }));
      throw new Error(error.detail || error.message || 'Failed to transfer ownership');
    }

    return response.json();
  }

  /**
   * Accept an invitation to join an organization
   */
  async acceptInvitation(token: string): Promise<AcceptInvitationResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${this.baseUrl}/api/organizations/invitations/${token}/accept`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to accept invitation' }));
      throw new Error(error.detail || error.message || 'Failed to accept invitation');
    }

    return response.json();
  }

  /**
   * Get organization usage metrics
   */
  async getUsageMetrics(orgId: string): Promise<UsageMetrics> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${this.baseUrl}/api/organizations/${orgId}/usage`,
      {
        method: 'GET',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to fetch usage metrics' }));
      throw new Error(error.detail || error.message || 'Failed to fetch usage metrics');
    }

    return response.json();
  }

  /**
   * Get pending invitations for an organization
   */
  async getPendingInvitations(
    orgId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PaginatedResponse<PendingInvitation>> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const headers = await getAuthHeaders();
    const response = await fetch(
      `${this.baseUrl}/api/organizations/${orgId}/invitations?${params}`,
      {
        method: 'GET',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to fetch invitations' }));
      throw new Error(error.detail || error.message || 'Failed to fetch invitations');
    }

    return response.json();
  }

  /**
   * Revoke a pending invitation
   */
  async revokeInvitation(orgId: string, inviteId: string): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${this.baseUrl}/api/organizations/${orgId}/invitations/${inviteId}`,
      {
        method: 'DELETE',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to revoke invitation' }));
      throw new Error(error.detail || error.message || 'Failed to revoke invitation');
    }
  }

  /**
   * Update a member's role
   */
  async updateMemberRole(
    orgId: string,
    userId: string,
    data: UpdateMemberRoleRequest
  ): Promise<Member> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${this.baseUrl}/api/organizations/${orgId}/members/${userId}`,
      {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update member role' }));
      throw new Error(error.detail || error.message || 'Failed to update member role');
    }

    return response.json();
  }
}

// =====================================================
// Permission Helpers
// =====================================================

/**
 * Check if a role can perform admin actions (invite, remove members, edit org)
 */
export function canAdminister(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'super_admin' || role === 'billing_admin';
}

/**
 * Check if a role can write data (upload BOMs, create projects)
 */
export function canWrite(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'engineer' || role === 'super_admin' || role === 'billing_admin';
}

/**
 * Check if a role can view analytics (risk dashboard, reports)
 */
export function canViewAnalytics(role: OrgRole): boolean {
  // All roles except viewer and member can view analytics
  return role !== 'viewer' && role !== 'member';
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: OrgRole) {
  return {
    canInvite: canAdminister(role),
    canRemoveMembers: canAdminister(role),
    canEditOrg: canAdminister(role),
    canDeleteOrg: role === 'owner' || role === 'super_admin',
    canTransferOwnership: role === 'owner' || role === 'super_admin',
    canUploadBOM: canWrite(role),
    canCreateProject: canWrite(role),
    canViewRisk: canViewAnalytics(role),
    canViewAlerts: true, // All roles can view alerts
    canViewMembers: true, // All roles can view members
  };
}

// =====================================================
// Export singleton instance
// =====================================================

export const organizationsApi = new OrganizationsApiClient();
export default organizationsApi;
