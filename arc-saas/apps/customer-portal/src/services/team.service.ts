import { platformApi } from '@/lib/axios';
import type {
  TeamMember,
  Invitation,
  Role,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  ActivityLogEntry,
} from '@/types/team';

// Re-export types for backward compatibility
export type {
  TeamMember,
  Invitation,
  Role,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  ActivityLogEntry,
};

/**
 * Get all team members for current tenant
 */
export async function getTeamMembers(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}): Promise<{ data: TeamMember[]; total: number }> {
  const response = await platformApi.get('/tenant-users', {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 50,
      status: params?.status,
      search: params?.search,
    },
  });

  return {
    data: response.data.data ?? response.data,
    total: response.data.total ?? response.data.length,
  };
}

/**
 * Get a specific team member
 */
export async function getTeamMember(userId: string): Promise<TeamMember> {
  const response = await platformApi.get(`/tenant-users/${userId}`);
  return response.data;
}

/**
 * Update a team member's role
 */
export async function updateMemberRole(
  request: UpdateMemberRoleRequest
): Promise<TeamMember> {
  const response = await platformApi.patch(`/tenant-users/${request.userId}`, {
    roleKey: request.roleKey,
  });
  return response.data;
}

/**
 * Remove a team member from tenant
 */
export async function removeMember(userId: string): Promise<void> {
  await platformApi.delete(`/tenant-users/${userId}`);
}

/**
 * Get all pending invitations
 */
export async function getInvitations(params?: {
  page?: number;
  limit?: number;
  status?: 'pending' | 'accepted' | 'expired' | 'cancelled';
}): Promise<{ data: Invitation[]; total: number }> {
  const response = await platformApi.get('/user-invitations', {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 50,
      status: params?.status ?? 'pending',
    },
  });

  return {
    data: response.data.data ?? response.data,
    total: response.data.total ?? response.data.length,
  };
}

/**
 * Send an invitation to a new team member
 */
export async function inviteMember(request: InviteMemberRequest): Promise<Invitation> {
  const response = await platformApi.post('/user-invitations', {
    email: request.email,
    roleKey: request.roleKey,
    tenantId: request.tenantId,
    customMessage: request.message,
  });
  return response.data;
}

/**
 * Resend an invitation
 */
export async function resendInvitation(invitationId: string): Promise<Invitation> {
  const response = await platformApi.post(`/user-invitations/${invitationId}/resend`);
  return response.data;
}

/**
 * Cancel a pending invitation
 */
export async function cancelInvitation(invitationId: string): Promise<void> {
  await platformApi.delete(`/user-invitations/${invitationId}`);
}

/**
 * Get available roles for the tenant
 */
export async function getAvailableRoles(): Promise<Role[]> {
  const response = await platformApi.get('/roles');
  return response.data.data ?? response.data;
}

/**
 * Get team activity log
 */
export async function getTeamActivity(params?: {
  page?: number;
  limit?: number;
  userId?: string;
}): Promise<{
  data: ActivityLogEntry[];
  total: number;
}> {
  const response = await platformApi.get('/user-activity', {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 50,
      userId: params?.userId,
    },
  });

  return {
    data: response.data.data ?? response.data,
    total: response.data.total ?? response.data.length,
  };
}

/**
 * Transfer ownership of tenant (owner only)
 */
export async function transferOwnership(newOwnerId: string): Promise<void> {
  await platformApi.post('/tenants/transfer-ownership', {
    newOwnerId,
  });
}

export default {
  getTeamMembers,
  getTeamMember,
  updateMemberRole,
  removeMember,
  getInvitations,
  inviteMember,
  resendInvitation,
  cancelInvitation,
  getAvailableRoles,
  getTeamActivity,
  transferOwnership,
};
