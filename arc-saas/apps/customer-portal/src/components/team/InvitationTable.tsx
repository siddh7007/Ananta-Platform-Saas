/**
 * InvitationTable Component
 *
 * Displays pending invitations with actions to resend or cancel.
 * Admin+ can manage invitations.
 */

import { useState } from 'react';
import {
  Mail,
  Clock,
  RefreshCw,
  X,
  MoreVertical,
  Loader2,
  Shield,
} from 'lucide-react';
import type { AppRole } from '@/config/auth';
import { hasMinimumRole } from '@/config/auth';
import type { Invitation } from '@/types/team';
import {
  getInvitationStatusColor,
  INVITATION_STATUS_CONFIG,
  getRoleColor,
  getRoleLabel,
  getExpirationText,
  isInvitationExpired,
} from '@/types/team';
import { cn } from '@/lib/utils';

interface InvitationTableProps {
  invitations: Invitation[];
  isLoading?: boolean;
  currentUserRole: AppRole;
  onResend?: (invitation: Invitation) => Promise<void>;
  onCancel?: (invitation: Invitation) => Promise<void>;
}

export function InvitationTable({
  invitations,
  isLoading = false,
  currentUserRole,
  onResend,
  onCancel,
}: InvitationTableProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const isAdmin = hasMinimumRole(currentUserRole, 'admin');

  const handleResend = async (invitation: Invitation) => {
    if (!onResend || actionLoading) return;
    setActionLoading(invitation.id);
    setOpenMenu(null);
    try {
      await onResend(invitation);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (invitation: Invitation) => {
    if (!onCancel || actionLoading) return;
    setActionLoading(invitation.id);
    setOpenMenu(null);
    try {
      await onCancel(invitation);
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No pending invitations</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-sm text-muted-foreground">
            <th className="pb-3 font-medium">Email</th>
            <th className="pb-3 font-medium">Role</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium">Expires</th>
            {isAdmin && <th className="pb-3 font-medium w-10"></th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {invitations.map((invitation) => {
            const statusConfig = INVITATION_STATUS_CONFIG[invitation.status];
            const expired = isInvitationExpired(invitation);
            const isPending = invitation.status === 'pending' && !expired;
            const isActionLoading = actionLoading === invitation.id;

            return (
              <tr key={invitation.id} className="hover:bg-muted/50">
                {/* Email */}
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{invitation.email}</span>
                  </div>
                  {invitation.invitedByName && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Invited by {invitation.invitedByName}
                    </p>
                  )}
                </td>

                {/* Role */}
                <td className="py-3">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                      getRoleColor(invitation.roleKey)
                    )}
                  >
                    <Shield className="h-3 w-3" />
                    {getRoleLabel(invitation.roleKey)}
                  </span>
                </td>

                {/* Status */}
                <td className="py-3">
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      expired
                        ? 'bg-gray-100 text-gray-700'
                        : getInvitationStatusColor(invitation.status)
                    )}
                  >
                    {expired ? 'Expired' : statusConfig.label}
                  </span>
                </td>

                {/* Expiration */}
                <td className="py-3">
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {getExpirationText(invitation.expiresAt)}
                  </span>
                </td>

                {/* Actions */}
                {isAdmin && (
                  <td className="py-3">
                    {isPending && (onResend || onCancel) && (
                      <div className="relative">
                        <button
                          onClick={() =>
                            setOpenMenu(
                              openMenu === invitation.id ? null : invitation.id
                            )
                          }
                          disabled={isActionLoading}
                          className="p-1.5 rounded-md hover:bg-muted disabled:opacity-50"
                        >
                          {isActionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreVertical className="h-4 w-4" />
                          )}
                        </button>

                        {openMenu === invitation.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenu(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-md border bg-popover shadow-lg">
                              {onResend && (
                                <button
                                  onClick={() => handleResend(invitation)}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted text-left"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                  Resend
                                </button>
                              )}
                              {onCancel && (
                                <button
                                  onClick={() => handleCancel(invitation)}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted text-left text-red-600"
                                >
                                  <X className="h-4 w-4" />
                                  Cancel
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default InvitationTable;
