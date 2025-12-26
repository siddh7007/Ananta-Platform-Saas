/**
 * Team Members Page
 *
 * Displays team members with role badges and management actions.
 * Admin+ can invite members and change roles.
 * Owner+ can remove members.
 * Supports bulk selection for batch operations.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  Loader2,
  Filter,
  AlertCircle,
  CheckSquare,
  Crown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { hasMinimumRole } from '@/config/auth';
import type { AppRole } from '@/config/auth';
import { MemberCard, InviteModal, RoleDropdown, BulkActionBar, OwnershipTransferModal } from '@/components/team';
import { TeamListSkeleton, EmptyState, NoFilteredResultsState } from '@/components/shared';
import {
  getTeamMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  transferOwnership,
} from '@/services/team.service';
import type { TeamMember } from '@/types/team';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';

export default function TeamMembersPage() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const userRole = (user?.role || 'analyst') as AppRole;
  const isAdmin = hasMinimumRole(userRole, 'admin');

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [newRole, setNewRole] = useState<AppRole>('analyst');
  const [isUpdating, setIsUpdating] = useState(false);

  // Confirmation modal for removal
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Ownership transfer state
  const [showTransferModal, setShowTransferModal] = useState(false);

  const isOwner = hasMinimumRole(userRole, 'owner');

  // Get selected members
  const selectedMembers = members.filter((m) => selectedMemberIds.has(m.id));

  // Load members
  const loadMembers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getTeamMembers({
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setMembers(result.data);
    } catch (err) {
      console.error('Failed to load team members:', err);
      setError('Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, statusFilter, currentTenant?.id]);

  // Handle invite
  const handleInvite = async (email: string, role: AppRole, message?: string) => {
    if (!currentTenant?.id) {
      console.error('No tenant context available');
      toast({
        title: 'Error',
        description: 'No organization context available',
        variant: 'destructive',
      });
      return;
    }

    try {
      await inviteMember({ email, roleKey: role, message, tenantId: currentTenant.id });
      toast({
        title: 'Invitation sent',
        description: `Successfully invited ${email} to join your team`,
        variant: 'success',
      });
      // Refresh member list after invite
      loadMembers();
    } catch (err: any) {
      console.error('Failed to invite member:', err);
      toast({
        title: 'Failed to send invitation',
        description: err?.response?.data?.error?.message || 'Unable to send invitation. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle role change
  const handleChangeRole = (member: TeamMember) => {
    setSelectedMember(member);
    setNewRole(member.roleKey);
    setShowRoleModal(true);
  };

  const confirmRoleChange = async () => {
    if (!selectedMember || newRole === selectedMember.roleKey) return;

    setIsUpdating(true);
    try {
      await updateMemberRole({
        userId: selectedMember.userId || selectedMember.id,
        roleKey: newRole,
      });
      toast({
        title: 'Role updated',
        description: `Successfully updated ${selectedMember.name || selectedMember.email}'s role to ${newRole}`,
        variant: 'success',
      });
      setShowRoleModal(false);
      setSelectedMember(null);
      loadMembers();
    } catch (err: any) {
      console.error('Failed to update role:', err);
      toast({
        title: 'Failed to update role',
        description: err?.response?.data?.error?.message || 'Unable to update role. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle member removal
  const handleRemove = (member: TeamMember) => {
    setMemberToRemove(member);
    setShowRemoveConfirm(true);
  };

  const confirmRemoval = async () => {
    if (!memberToRemove) return;

    setIsRemoving(true);
    try {
      await removeMember(memberToRemove.userId || memberToRemove.id);
      toast({
        title: 'Member removed',
        description: `Successfully removed ${memberToRemove.name || memberToRemove.email} from your team`,
        variant: 'success',
      });
      setShowRemoveConfirm(false);
      setMemberToRemove(null);
      loadMembers();
    } catch (err: any) {
      console.error('Failed to remove member:', err);
      toast({
        title: 'Failed to remove member',
        description: err?.response?.data?.error?.message || 'Unable to remove member. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRemoving(false);
    }
  };

  // Bulk selection handlers
  const handleSelectionChange = useCallback((member: TeamMember, selected: boolean) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(member.id);
      } else {
        next.delete(member.id);
      }
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedMemberIds(new Set());
    setSelectionMode(false);
  }, []);

  const handleBulkRoleUpdate = async (role: AppRole) => {
    setIsBulkProcessing(true);
    try {
      const promises = selectedMembers.map((member) =>
        updateMemberRole({
          userId: member.userId || member.id,
          roleKey: role,
        })
      );
      const results = await Promise.allSettled(promises);
      const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
      const rejected = results.filter((r) => r.status === 'rejected').length;

      if (rejected === 0) {
        toast({
          title: 'Roles updated',
          description: `Successfully updated ${fulfilled} member${fulfilled > 1 ? 's' : ''} to ${role}`,
          variant: 'success',
        });
      } else if (fulfilled > 0) {
        toast({
          title: 'Partial success',
          description: `Updated ${fulfilled} member${fulfilled > 1 ? 's' : ''}, but ${rejected} failed. Please refresh and retry.`,
          variant: 'warning',
        });
      } else {
        toast({
          title: 'Failed to update roles',
          description: 'All role updates failed. Please try again.',
          variant: 'destructive',
        });
      }
      handleClearSelection();
      loadMembers();
    } catch (err: unknown) {
      console.error('Failed to update roles:', err);
      toast({
        title: 'Failed to update roles',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkRemove = async () => {
    setIsBulkProcessing(true);
    try {
      const promises = selectedMembers.map((member) =>
        removeMember(member.userId || member.id)
      );
      const results = await Promise.allSettled(promises);
      const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
      const rejected = results.filter((r) => r.status === 'rejected').length;

      if (rejected === 0) {
        toast({
          title: 'Members removed',
          description: `Successfully removed ${fulfilled} member${fulfilled > 1 ? 's' : ''} from the team`,
          variant: 'success',
        });
      } else if (fulfilled > 0) {
        toast({
          title: 'Partial success',
          description: `Removed ${fulfilled} member${fulfilled > 1 ? 's' : ''}, but ${rejected} failed. Please refresh and retry.`,
          variant: 'warning',
        });
      } else {
        toast({
          title: 'Failed to remove members',
          description: 'All removals failed. Please try again.',
          variant: 'destructive',
        });
      }
      handleClearSelection();
      loadMembers();
    } catch (err: unknown) {
      console.error('Failed to remove members:', err);
      toast({
        title: 'Failed to remove members',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Handle ownership transfer
  const handleTransferOwnership = async (newOwnerId: string) => {
    try {
      await transferOwnership(newOwnerId);
      toast({
        title: 'Ownership transferred',
        description: 'You are now an Admin. The new owner has full control.',
        variant: 'success',
      });
      setShowTransferModal(false);
      loadMembers();
    } catch (err: unknown) {
      console.error('Failed to transfer ownership:', err);
      toast({
        title: 'Failed to transfer ownership',
        description: 'Unable to transfer ownership. Please try again.',
        variant: 'destructive',
      });
      throw err; // Re-throw so modal knows it failed
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Team Members
          </h1>
          <p className="text-muted-foreground">
            {currentTenant?.name
              ? `Manage your ${currentTenant.name} team`
              : 'Manage your team members and roles'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Bulk Select Toggle (admin+) */}
          {isAdmin && members.length > 1 && (
            <button
              onClick={() => {
                if (selectionMode) {
                  handleClearSelection();
                } else {
                  setSelectionMode(true);
                }
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 border rounded-md',
                selectionMode
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <CheckSquare className="h-4 w-4" />
              {selectionMode ? 'Cancel' : 'Select'}
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <UserPlus className="h-4 w-4" />
              Invite Member
            </button>
          )}

          {/* Transfer Ownership (owner only) */}
          {isOwner && (
            <button
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-md hover:bg-amber-50"
            >
              <Crown className="h-4 w-4" />
              Transfer Ownership
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Refresh */}
        <button
          onClick={loadMembers}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && <TeamListSkeleton members={4} />}

      {/* Members Grid */}
      {!isLoading && members.length === 0 && (
        searchQuery || statusFilter !== 'all' ? (
          <NoFilteredResultsState
            onClearFilters={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No team members found"
            description="Team members will appear here once they join your workspace."
            size="md"
            action={
              isAdmin
                ? {
                    label: 'Invite Member',
                    onClick: () => setShowInviteModal(true),
                    variant: 'default',
                  }
                : undefined
            }
          />
        )
      )}

      {!isLoading && members.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              currentUserRole={userRole}
              currentUserId={user?.id}
              onChangeRole={handleChangeRole}
              onRemove={handleRemove}
              selectionMode={selectionMode}
              isSelected={selectedMemberIds.has(member.id)}
              onSelectionChange={handleSelectionChange}
            />
          ))}
        </div>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedMembers={selectedMembers}
        currentUserRole={userRole}
        onClearSelection={handleClearSelection}
        onBulkRoleUpdate={handleBulkRoleUpdate}
        onBulkRemove={handleBulkRemove}
        isProcessing={isBulkProcessing}
      />

      {/* Invite Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInvite}
        currentUserRole={userRole}
        tenantName={currentTenant?.name}
      />

      {/* Change Role Modal */}
      {showRoleModal && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !isUpdating && setShowRoleModal(false)}
          />
          <div className="relative bg-background rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">Change Role</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Update role for{' '}
              <strong>{selectedMember.name || selectedMember.email}</strong>
            </p>

            <RoleDropdown
              value={newRole}
              onChange={setNewRole}
              currentUserRole={userRole}
              disabled={isUpdating}
            />

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowRoleModal(false)}
                disabled={isUpdating}
                className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRoleChange}
                disabled={isUpdating || newRole === selectedMember.roleKey}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {showRemoveConfirm && memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !isRemoving && setShowRemoveConfirm(false)}
          />
          <div className="relative bg-background rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-red-700 mb-4">
              Remove Team Member
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to remove{' '}
              <strong>{memberToRemove.name || memberToRemove.email}</strong> from
              the team? They will lose access to this workspace.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRemoveConfirm(false)}
                disabled={isRemoving}
                className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoval}
                disabled={isRemoving}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isRemoving && <Loader2 className="h-4 w-4 animate-spin" />}
                Remove Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ownership Transfer Modal */}
      <OwnershipTransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onTransfer={handleTransferOwnership}
        members={members}
        currentUserId={user?.id}
        organizationName={currentTenant?.name}
      />
    </div>
  );
}
