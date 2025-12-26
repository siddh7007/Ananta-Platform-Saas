/**
 * OwnershipTransferModal Component
 *
 * Modal for transferring organization ownership to another admin.
 * Only the current owner can initiate ownership transfer.
 * Requires confirmation to prevent accidental transfers.
 */

import { useState, useMemo } from 'react';
import { AlertTriangle, Crown, Loader2, Search, UserCheck } from 'lucide-react';
import type { AppRole } from '@/config/auth';
import type { TeamMember } from '@/types/team';
import { getRoleColor, getRoleLabel, getInitials } from '@/types/team';
import { cn } from '@/lib/utils';

interface OwnershipTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransfer: (newOwnerId: string) => Promise<void>;
  members: TeamMember[];
  currentUserId?: string;
  organizationName?: string;
}

export function OwnershipTransferModal({
  isOpen,
  onClose,
  onTransfer,
  members,
  currentUserId,
  organizationName,
}: OwnershipTransferModalProps) {
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [step, setStep] = useState<'select' | 'confirm'>('select');

  // Filter eligible members (admins only, excluding current user)
  const eligibleMembers = useMemo(() => {
    return members.filter((member) => {
      // Must be admin (only admins can become owners, not engineers)
      const isEligible = member.roleKey === 'admin';
      const isNotCurrentUser = member.userId !== currentUserId && member.id !== currentUserId;
      const isActive = member.status === 'active';
      return isEligible && isNotCurrentUser && isActive;
    });
  }, [members, currentUserId]);

  // Filter by search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return eligibleMembers;
    const query = searchQuery.toLowerCase();
    return eligibleMembers.filter(
      (member) =>
        member.name?.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query)
    );
  }, [eligibleMembers, searchQuery]);

  const handleSelectMember = (member: TeamMember) => {
    setSelectedMember(member);
    setStep('confirm');
  };

  const handleBack = () => {
    setStep('select');
    setConfirmText('');
  };

  const handleTransfer = async () => {
    if (!selectedMember) return;

    setIsTransferring(true);
    try {
      await onTransfer(selectedMember.userId || selectedMember.id);
      onClose();
      // Reset state
      setSelectedMember(null);
      setConfirmText('');
      setStep('select');
    } catch {
      // Error handling is done by the parent
    } finally {
      setIsTransferring(false);
    }
  };

  const isConfirmValid = confirmText === 'TRANSFER';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !isTransferring && onClose()}
      />

      {/* Modal */}
      <div className="relative bg-background rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Crown className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Transfer Ownership</h2>
              <p className="text-sm text-muted-foreground">
                {organizationName || 'Organization'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'select' && (
            <>
              {/* Warning */}
              <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">This action cannot be undone</p>
                  <p>
                    The new owner will have full control over the organization,
                    including billing and the ability to remove you.
                  </p>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search team members..."
                  className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
                />
              </div>

              {/* Member list */}
              {eligibleMembers.length === 0 ? (
                <div className="text-center py-8">
                  <UserCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold mb-2">No eligible members</h3>
                  <p className="text-sm text-muted-foreground">
                    You need at least one active admin to transfer ownership.
                  </p>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No members match your search
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium mb-3">
                    Select the new owner:
                  </p>
                  {filteredMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleSelectMember(member)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border hover:border-primary hover:bg-muted/50 transition-colors text-left"
                    >
                      {/* Avatar */}
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name || member.email}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium">
                          {getInitials(member.name, member.email)}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {member.name || member.email.split('@')[0]}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {member.email}
                        </p>
                      </div>

                      {/* Role badge */}
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          getRoleColor(member.roleKey)
                        )}
                      >
                        {getRoleLabel(member.roleKey)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 'confirm' && selectedMember && (
            <>
              {/* Selected member preview */}
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg mb-6">
                {selectedMember.avatarUrl ? (
                  <img
                    src={selectedMember.avatarUrl}
                    alt={selectedMember.name || selectedMember.email}
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-lg">
                    {getInitials(selectedMember.name, selectedMember.email)}
                  </div>
                )}
                <div>
                  <p className="font-semibold">
                    {selectedMember.name || selectedMember.email.split('@')[0]}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedMember.email}
                  </p>
                  <p className="text-sm text-amber-600 font-medium mt-1">
                    Will become the new owner
                  </p>
                </div>
              </div>

              {/* Confirmation */}
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 font-medium mb-2">
                    You will lose:
                  </p>
                  <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                    <li>Full administrative control</li>
                    <li>Billing and subscription management</li>
                    <li>Ability to delete the organization</li>
                  </ul>
                  <p className="text-sm text-red-800 mt-3">
                    Your role will be changed to <strong>Admin</strong>.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Type <strong>TRANSFER</strong> to confirm:
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                    placeholder="TRANSFER"
                    className="w-full px-3 py-2 border rounded-md bg-background font-mono"
                    disabled={isTransferring}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-between gap-3">
          {step === 'select' ? (
            <button
              onClick={onClose}
              disabled={isTransferring}
              className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={handleBack}
              disabled={isTransferring}
              className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
            >
              Back
            </button>
          )}

          {step === 'confirm' && (
            <button
              onClick={handleTransfer}
              disabled={!isConfirmValid || isTransferring}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTransferring && <Loader2 className="h-4 w-4 animate-spin" />}
              Transfer Ownership
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default OwnershipTransferModal;
