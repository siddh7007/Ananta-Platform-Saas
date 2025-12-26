/**
 * Team Service
 *
 * Service for managing team members and invitations.
 * Provides API calls for team management operations.
 *
 * @module services/teamService
 */

import { organizationsApi } from './organizationsApi';

// C2 Fix: UUID validation helper
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidId(id: string): boolean {
  // Accept both UUID format and simple alphanumeric IDs (for mock data)
  return UUID_REGEX.test(id) || /^[a-zA-Z0-9_-]+$/.test(id);
}

// Types
export interface TeamMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl?: string;
  role: TeamRole;
  status: TeamMemberStatus;
  joinedAt: string;
  lastLoginAt?: string;
  invitedBy?: string;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: TeamRole;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  invitedBy: string;
  invitedByName?: string;
}

export type TeamRole = 'analyst' | 'engineer' | 'admin' | 'owner';
export type TeamMemberStatus = 'active' | 'pending' | 'disabled';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface InviteTeamMemberPayload {
  email: string;
  role: TeamRole;
  message?: string;
}

export interface UpdateMemberRolePayload {
  memberId: string;
  role: TeamRole;
}

export interface TeamStats {
  totalMembers: number;
  activeMembers: number;
  pendingInvitations: number;
  roleDistribution: Record<TeamRole, number>;
}

// Role configuration
export const ROLE_CONFIG: Record<TeamRole, {
  label: string;
  description: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  level: number;
}> = {
  analyst: {
    label: 'Analyst',
    description: 'View BOMs and component data, read-only access',
    color: 'default',
    level: 1,
  },
  engineer: {
    label: 'Engineer',
    description: 'Upload BOMs, manage components, run enrichment',
    color: 'info',
    level: 2,
  },
  admin: {
    label: 'Admin',
    description: 'Manage users, org settings, full access',
    color: 'primary',
    level: 3,
  },
  owner: {
    label: 'Owner',
    description: 'Full control including billing and org deletion',
    color: 'warning',
    level: 4,
  },
};

/**
 * Get all team members for the current organization
 */
export async function getTeamMembers(organizationId?: string): Promise<TeamMember[]> {
  const orgId = organizationId || localStorage.getItem('organization_id');

  if (!orgId) {
    console.warn('[TeamService] No organization ID available');
    return getMockTeamMembers();
  }

  try {
    const response = await organizationsApi.getMembers(orgId);

    if (response.items && Array.isArray(response.items)) {
      return response.items.map(mapApiMemberToTeamMember);
    }

    return getMockTeamMembers();
  } catch (error) {
    console.error('[TeamService] Error fetching team members:', error);
    // Fallback to mock data for development
    if (import.meta.env.DEV) {
      console.log('[TeamService] Using mock data in development mode');
      return getMockTeamMembers();
    }
    throw error;
  }
}

/**
 * Get pending invitations for the current organization
 */
export async function getInvitations(organizationId?: string): Promise<TeamInvitation[]> {
  const orgId = organizationId || localStorage.getItem('organization_id');

  if (!orgId) {
    console.warn('[TeamService] No organization ID available');
    return getMockInvitations();
  }

  try {
    const response = await organizationsApi.getPendingInvitations(orgId);

    if (response.items && Array.isArray(response.items)) {
      return response.items.map(mapApiInvitationToInvitation);
    }

    return getMockInvitations();
  } catch (error) {
    console.error('[TeamService] Error fetching invitations:', error);
    if (import.meta.env.DEV) {
      return getMockInvitations();
    }
    throw error;
  }
}

/**
 * Invite a new team member
 */
export async function inviteTeamMember(payload: InviteTeamMemberPayload): Promise<TeamInvitation> {
  const orgId = localStorage.getItem('organization_id');

  if (!orgId) {
    throw new Error('No organization context');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(payload.email)) {
    throw new Error('Invalid email format');
  }

  try {
    const response = await organizationsApi.inviteMember(orgId, {
      email: payload.email.toLowerCase().trim(),
      role: payload.role as any,
    });

    return mapApiInvitationToInvitation(response);
  } catch (error: any) {
    console.error('[TeamService] Error inviting member:', error);

    // Handle specific error cases
    if (error.response?.status === 409) {
      throw new Error('User is already a member or has a pending invitation');
    }
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to invite users');
    }

    // In dev mode, simulate success
    if (import.meta.env.DEV) {
      return {
        id: `invite-${Date.now()}`,
        email: payload.email.toLowerCase(),
        role: payload.role,
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        invitedBy: 'current-user',
        invitedByName: 'You',
      };
    }

    throw error;
  }
}

/**
 * Resend an invitation
 * Note: The backend may not support resend - this will revoke and re-invite
 */
export async function resendInvitation(invitationId: string): Promise<TeamInvitation> {
  const orgId = localStorage.getItem('organization_id');

  if (!orgId) {
    throw new Error('No organization context');
  }

  try {
    // Get the existing invitation first to get the email and role
    const invitations = await getInvitations(orgId);
    const existingInvite = invitations.find(inv => inv.id === invitationId);

    if (!existingInvite) {
      throw new Error('Invitation not found');
    }

    // Revoke the old invitation and create a new one
    await organizationsApi.revokeInvitation(orgId, invitationId);
    const newInvite = await organizationsApi.inviteMember(orgId, {
      email: existingInvite.email,
      role: existingInvite.role as any,
    });

    return mapApiInvitationToInvitation(newInvite);
  } catch (error) {
    console.error('[TeamService] Error resending invitation:', error);
    throw error;
  }
}

/**
 * Revoke an invitation
 */
export async function revokeInvitation(invitationId: string): Promise<void> {
  const orgId = localStorage.getItem('organization_id');

  if (!orgId) {
    throw new Error('No organization context');
  }

  try {
    await organizationsApi.revokeInvitation(orgId, invitationId);
  } catch (error) {
    console.error('[TeamService] Error revoking invitation:', error);
    throw error;
  }
}

/**
 * Update a team member's role
 */
export async function updateMemberRole(memberId: string, role: TeamRole): Promise<TeamMember> {
  const orgId = localStorage.getItem('organization_id');

  if (!orgId) {
    throw new Error('No organization context');
  }

  // C2 Fix: Validate member ID
  if (!isValidId(memberId)) {
    throw new Error('Invalid member ID format');
  }

  // H3 Fix: Validate role
  if (!ROLE_CONFIG[role]) {
    throw new Error('Invalid role');
  }

  try {
    const response = await organizationsApi.updateMemberRole(orgId, memberId, {
      role: role as any,
    });
    return mapApiMemberToTeamMember(response);
  } catch (error: any) {
    console.error('[TeamService] Error updating member role:', error);

    if (error.message?.includes('403') || error.message?.includes('permission')) {
      throw new Error('You cannot change your own role or the role of an owner');
    }

    throw error;
  }
}

/**
 * Remove a team member
 */
export async function removeMember(memberId: string): Promise<void> {
  const orgId = localStorage.getItem('organization_id');

  if (!orgId) {
    throw new Error('No organization context');
  }

  // C2 Fix: Validate member ID
  if (!isValidId(memberId)) {
    throw new Error('Invalid member ID format');
  }

  try {
    await organizationsApi.removeMember(orgId, memberId);
  } catch (error: any) {
    console.error('[TeamService] Error removing member:', error);

    if (error.message?.includes('403') || error.message?.includes('owner')) {
      throw new Error('You cannot remove the organization owner');
    }

    throw error;
  }
}

/**
 * Get team statistics
 */
export async function getTeamStats(organizationId?: string): Promise<TeamStats> {
  const orgId = organizationId || localStorage.getItem('organization_id');

  if (!orgId) {
    return getMockTeamStats();
  }

  try {
    const [members, invitations] = await Promise.all([
      getTeamMembers(orgId),
      getInvitations(orgId),
    ]);

    const activeMembers = members.filter((m) => m.status === 'active');
    const pendingInvitations = invitations.filter((i) => i.status === 'pending');

    const roleDistribution: Record<TeamRole, number> = {
      analyst: 0,
      engineer: 0,
      admin: 0,
      owner: 0,
    };

    members.forEach((member) => {
      roleDistribution[member.role]++;
    });

    return {
      totalMembers: members.length,
      activeMembers: activeMembers.length,
      pendingInvitations: pendingInvitations.length,
      roleDistribution,
    };
  } catch (error) {
    console.error('[TeamService] Error fetching team stats:', error);
    return getMockTeamStats();
  }
}

// Helper functions
function mapApiMemberToTeamMember(apiMember: any): TeamMember {
  return {
    id: apiMember.id || apiMember.user_id,
    email: apiMember.email,
    firstName: apiMember.first_name || apiMember.firstName || '',
    lastName: apiMember.last_name || apiMember.lastName || '',
    fullName: apiMember.full_name || `${apiMember.first_name || ''} ${apiMember.last_name || ''}`.trim() || apiMember.email,
    avatarUrl: apiMember.avatar_url || apiMember.avatarUrl,
    role: apiMember.role || 'analyst',
    status: apiMember.status || 'active',
    joinedAt: apiMember.joined_at || apiMember.joinedAt || apiMember.created_at,
    lastLoginAt: apiMember.last_login_at || apiMember.lastLoginAt,
    invitedBy: apiMember.invited_by || apiMember.invitedBy,
  };
}

function mapApiInvitationToInvitation(apiInvitation: any): TeamInvitation {
  return {
    id: apiInvitation.id,
    email: apiInvitation.email,
    role: apiInvitation.role || 'analyst',
    status: apiInvitation.status || 'pending',
    expiresAt: apiInvitation.expires_at || apiInvitation.expiresAt,
    createdAt: apiInvitation.created_at || apiInvitation.createdAt,
    invitedBy: apiInvitation.invited_by || apiInvitation.invitedBy,
    invitedByName: apiInvitation.invited_by_name || apiInvitation.invitedByName,
  };
}

// Mock data for development
function getMockTeamMembers(): TeamMember[] {
  return [
    {
      id: 'user-1',
      email: 'sarah.johnson@example.com',
      firstName: 'Sarah',
      lastName: 'Johnson',
      fullName: 'Sarah Johnson',
      avatarUrl: undefined,
      role: 'owner',
      status: 'active',
      joinedAt: '2024-01-15T10:00:00Z',
      lastLoginAt: new Date().toISOString(),
    },
    {
      id: 'user-2',
      email: 'david.chen@example.com',
      firstName: 'David',
      lastName: 'Chen',
      fullName: 'David Chen',
      avatarUrl: undefined,
      role: 'admin',
      status: 'active',
      joinedAt: '2024-02-10T14:30:00Z',
      lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'user-3',
      email: 'emily.rodriguez@example.com',
      firstName: 'Emily',
      lastName: 'Rodriguez',
      fullName: 'Emily Rodriguez',
      avatarUrl: undefined,
      role: 'engineer',
      status: 'active',
      joinedAt: '2024-03-05T09:15:00Z',
      lastLoginAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'user-4',
      email: 'michael.kim@example.com',
      firstName: 'Michael',
      lastName: 'Kim',
      fullName: 'Michael Kim',
      avatarUrl: undefined,
      role: 'engineer',
      status: 'active',
      joinedAt: '2024-04-20T11:45:00Z',
      lastLoginAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'user-5',
      email: 'alex.wong@example.com',
      firstName: 'Alex',
      lastName: 'Wong',
      fullName: 'Alex Wong',
      avatarUrl: undefined,
      role: 'analyst',
      status: 'active',
      joinedAt: '2024-05-10T16:00:00Z',
      lastLoginAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function getMockInvitations(): TeamInvitation[] {
  return [
    {
      id: 'invite-1',
      email: 'pending.user@example.com',
      role: 'engineer',
      status: 'pending',
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      invitedBy: 'user-1',
      invitedByName: 'Sarah Johnson',
    },
    {
      id: 'invite-2',
      email: 'another.pending@example.com',
      role: 'analyst',
      status: 'pending',
      expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      invitedBy: 'user-2',
      invitedByName: 'David Chen',
    },
  ];
}

function getMockTeamStats(): TeamStats {
  return {
    totalMembers: 5,
    activeMembers: 5,
    pendingInvitations: 2,
    roleDistribution: {
      analyst: 1,
      engineer: 2,
      admin: 1,
      owner: 1,
    },
  };
}

export const teamService = {
  getTeamMembers,
  getInvitations,
  inviteTeamMember,
  resendInvitation,
  revokeInvitation,
  updateMemberRole,
  removeMember,
  getTeamStats,
  ROLE_CONFIG,
};

export default teamService;
