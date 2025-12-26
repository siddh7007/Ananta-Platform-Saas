/**
 * useTeamMembers Hook
 *
 * React hook for managing team members and invitations.
 * Provides data fetching, mutations, and loading states.
 *
 * @module hooks/useTeamMembers
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  teamService,
  TeamMember,
  TeamInvitation,
  TeamRole,
  TeamStats,
  InviteTeamMemberPayload,
} from '../services/teamService';

export interface UseTeamMembersOptions {
  /** Organization ID (defaults to localStorage value) */
  organizationId?: string;
  /** Fetch on mount (default: true) */
  fetchOnMount?: boolean;
  /** Auto-refresh interval in ms (0 to disable) */
  refreshInterval?: number;
}

export interface UseTeamMembersReturn {
  // Data
  members: TeamMember[];
  invitations: TeamInvitation[];
  stats: TeamStats | null;

  // Loading states
  isLoading: boolean;
  isInviting: boolean;
  isUpdating: boolean;

  // Error state
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
  inviteMember: (payload: InviteTeamMemberPayload) => Promise<TeamInvitation>;
  resendInvitation: (invitationId: string) => Promise<void>;
  revokeInvitation: (invitationId: string) => Promise<void>;
  updateMemberRole: (memberId: string, role: TeamRole) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
}

/**
 * Hook for team management operations
 */
export function useTeamMembers(options: UseTeamMembersOptions = {}): UseTeamMembersReturn {
  const {
    organizationId,
    fetchOnMount = true,
    refreshInterval = 0,
  } = options;

  // State
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup
  const mountedRef = useRef(true);
  const refreshRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch all team data
   */
  const fetchTeamData = useCallback(async () => {
    if (!mountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const [membersData, invitationsData, statsData] = await Promise.allSettled([
        teamService.getTeamMembers(organizationId),
        teamService.getInvitations(organizationId),
        teamService.getTeamStats(organizationId),
      ]);

      if (!mountedRef.current) return;

      if (membersData.status === 'fulfilled') {
        setMembers(membersData.value);
      } else {
        console.error('[useTeamMembers] Failed to fetch members:', membersData.reason);
      }

      if (invitationsData.status === 'fulfilled') {
        setInvitations(invitationsData.value);
      } else {
        console.error('[useTeamMembers] Failed to fetch invitations:', invitationsData.reason);
      }

      if (statsData.status === 'fulfilled') {
        setStats(statsData.value);
      }

      // If all failed, set error
      if (
        membersData.status === 'rejected' &&
        invitationsData.status === 'rejected'
      ) {
        setError('Failed to load team data');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[useTeamMembers] Error fetching team data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load team data');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [organizationId]);

  /**
   * Invite a new team member
   */
  const inviteMember = useCallback(async (payload: InviteTeamMemberPayload): Promise<TeamInvitation> => {
    setIsInviting(true);
    setError(null);

    try {
      const invitation = await teamService.inviteTeamMember(payload);

      // Optimistically add to invitations list
      setInvitations((prev) => [invitation, ...prev]);

      // Update stats
      setStats((prev) => prev ? {
        ...prev,
        pendingInvitations: prev.pendingInvitations + 1,
      } : null);

      return invitation;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send invitation';
      setError(errorMessage);
      throw err;
    } finally {
      setIsInviting(false);
    }
  }, []);

  /**
   * Resend an invitation
   */
  const resendInvitation = useCallback(async (invitationId: string): Promise<void> => {
    setIsUpdating(true);
    setError(null);

    try {
      const updated = await teamService.resendInvitation(invitationId);

      // Update invitation in list
      setInvitations((prev) =>
        prev.map((inv) => (inv.id === invitationId ? updated : inv))
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resend invitation';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  /**
   * Revoke an invitation
   */
  const revokeInvitation = useCallback(async (invitationId: string): Promise<void> => {
    setIsUpdating(true);
    setError(null);

    try {
      await teamService.revokeInvitation(invitationId);

      // Remove from invitations list
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));

      // Update stats
      setStats((prev) => prev ? {
        ...prev,
        pendingInvitations: Math.max(0, prev.pendingInvitations - 1),
      } : null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to revoke invitation';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  /**
   * Update a member's role
   */
  const updateMemberRole = useCallback(async (memberId: string, role: TeamRole): Promise<void> => {
    // C1 Fix: Validate inputs
    if (!memberId || typeof memberId !== 'string') {
      throw new Error('Invalid member ID');
    }

    // H3 Fix: Validate role against allowed values
    const validRoles: TeamRole[] = ['analyst', 'engineer', 'admin', 'owner'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role');
    }

    setIsUpdating(true);
    setError(null);

    // C1 Fix: Capture current state for rollback using ref pattern
    let originalMembers: TeamMember[] = [];
    let oldRole: TeamRole | undefined;

    try {
      // Capture original state before optimistic update
      setMembers((prev) => {
        originalMembers = [...prev];
        oldRole = prev.find((m) => m.id === memberId)?.role;
        return prev.map((member) =>
          member.id === memberId ? { ...member, role } : member
        );
      });

      await teamService.updateMemberRole(memberId, role);

      // Update stats using captured oldRole
      if (oldRole && oldRole !== role) {
        setStats((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            roleDistribution: {
              ...prev.roleDistribution,
              [oldRole as TeamRole]: Math.max(0, prev.roleDistribution[oldRole as TeamRole] - 1),
              [role]: prev.roleDistribution[role] + 1,
            },
          };
        });
      }
    } catch (err) {
      // Revert optimistic update on error
      setMembers(originalMembers);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update member role';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  /**
   * Remove a team member
   */
  const removeMember = useCallback(async (memberId: string): Promise<void> => {
    // C1 Fix: Validate input
    if (!memberId || typeof memberId !== 'string') {
      throw new Error('Invalid member ID');
    }

    setIsUpdating(true);
    setError(null);

    // C1 Fix: Capture state for rollback using functional pattern
    let originalMembers: TeamMember[] = [];
    let memberToRemove: TeamMember | undefined;

    try {
      // Capture original state and perform optimistic update atomically
      setMembers((prev) => {
        originalMembers = [...prev];
        memberToRemove = prev.find((m) => m.id === memberId);
        return prev.filter((member) => member.id !== memberId);
      });

      await teamService.removeMember(memberId);

      // Update stats using captured memberToRemove
      if (memberToRemove) {
        setStats((prev) => prev ? {
          ...prev,
          totalMembers: prev.totalMembers - 1,
          activeMembers: memberToRemove!.status === 'active'
            ? prev.activeMembers - 1
            : prev.activeMembers,
          roleDistribution: {
            ...prev.roleDistribution,
            [memberToRemove!.role]: Math.max(0, prev.roleDistribution[memberToRemove!.role] - 1),
          },
        } : null);
      }
    } catch (err) {
      // Revert optimistic update on error
      setMembers(originalMembers);
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove member';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;

    if (fetchOnMount) {
      fetchTeamData();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [fetchOnMount, fetchTeamData]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      refreshRef.current = setInterval(() => {
        if (mountedRef.current) {
          fetchTeamData();
        }
      }, refreshInterval);

      return () => {
        if (refreshRef.current) {
          clearInterval(refreshRef.current);
        }
      };
    }
  }, [refreshInterval, fetchTeamData]);

  return {
    members,
    invitations,
    stats,
    isLoading,
    isInviting,
    isUpdating,
    error,
    refresh: fetchTeamData,
    inviteMember,
    resendInvitation,
    revokeInvitation,
    updateMemberRole,
    removeMember,
  };
}

export default useTeamMembers;
