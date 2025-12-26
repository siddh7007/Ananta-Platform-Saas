/**
 * Team Invitations Page
 *
 * Displays pending invitations with actions to resend or cancel.
 * Admin+ can manage invitations.
 */

import { useEffect, useState } from 'react';
import {
  Mail,
  UserPlus,
  RefreshCw,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { hasMinimumRole } from '@/config/auth';
import type { AppRole } from '@/config/auth';
import { InvitationTable, InviteModal } from '@/components/team';
import {
  getInvitations,
  inviteMember,
  resendInvitation,
  cancelInvitation,
} from '@/services/team.service';
import type { Invitation } from '@/types/team';
import { cn } from '@/lib/utils';

export default function TeamInvitationsPage() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const userRole = (user?.role || 'analyst') as AppRole;
  const isAdmin = hasMinimumRole(userRole, 'admin');

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal state
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Load invitations
  const loadInvitations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getInvitations({
        status: statusFilter !== 'all' ? (statusFilter as Invitation['status']) : undefined,
      });
      setInvitations(result.data);
    } catch (err) {
      console.error('Failed to load invitations:', err);
      setError('Failed to load invitations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations();
  }, [statusFilter]);

  // Handle invite
  const handleInvite = async (email: string, role: AppRole, message?: string) => {
    if (!currentTenant?.id) {
      console.error('No tenant context available');
      return;
    }
    await inviteMember({ email, roleKey: role, message, tenantId: currentTenant.id });
    setSuccessMessage(`Invitation sent to ${email}`);
    setTimeout(() => setSuccessMessage(null), 5000);
    loadInvitations();
  };

  // Handle resend
  const handleResend = async (invitation: Invitation) => {
    try {
      await resendInvitation(invitation.id);
      setSuccessMessage(`Invitation resent to ${invitation.email}`);
      setTimeout(() => setSuccessMessage(null), 5000);
      loadInvitations();
    } catch (err) {
      console.error('Failed to resend invitation:', err);
      setError('Failed to resend invitation');
    }
  };

  // Handle cancel
  const handleCancel = async (invitation: Invitation) => {
    try {
      await cancelInvitation(invitation.id);
      setSuccessMessage(`Invitation to ${invitation.email} has been cancelled`);
      setTimeout(() => setSuccessMessage(null), 5000);
      loadInvitations();
    } catch (err) {
      console.error('Failed to cancel invitation:', err);
      setError('Failed to cancel invitation');
    }
  };

  // Count by status
  const pendingCount = invitations.filter((i) => i.status === 'pending').length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Invitations
          </h1>
          <p className="text-muted-foreground">
            {pendingCount > 0
              ? `${pendingCount} pending invitation${pendingCount > 1 ? 's' : ''}`
              : 'Manage team invitations'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>
        </div>

        {/* Refresh */}
        <button
          onClick={loadInvitations}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {successMessage}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Invitations Table */}
      <div className="rounded-lg border bg-card p-4">
        <InvitationTable
          invitations={invitations}
          isLoading={isLoading}
          currentUserRole={userRole}
          onResend={isAdmin ? handleResend : undefined}
          onCancel={isAdmin ? handleCancel : undefined}
        />
      </div>

      {/* Invite Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInvite}
        currentUserRole={userRole}
        tenantName={currentTenant?.name}
      />
    </div>
  );
}
