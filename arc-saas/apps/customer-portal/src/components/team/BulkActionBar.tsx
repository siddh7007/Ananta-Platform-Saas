/**
 * BulkActionBar Component
 *
 * Floating action bar for bulk operations on selected team members.
 * Shows when members are selected and provides bulk role update and removal.
 */

import { useState } from 'react';
import { X, UserCog, UserMinus, Loader2 } from 'lucide-react';
import type { AppRole } from '@/config/auth';
import { hasMinimumRole } from '@/config/auth';
import type { TeamMember } from '@/types/team';
import { RoleDropdown } from './RoleDropdown';
import { cn } from '@/lib/utils';

interface BulkActionBarProps {
  selectedMembers: TeamMember[];
  currentUserRole: AppRole;
  onClearSelection: () => void;
  onBulkRoleUpdate: (role: AppRole) => Promise<void>;
  onBulkRemove: () => Promise<void>;
  isProcessing?: boolean;
}

export function BulkActionBar({
  selectedMembers,
  currentUserRole,
  onClearSelection,
  onBulkRoleUpdate,
  onBulkRemove,
  isProcessing = false,
}: BulkActionBarProps) {
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>('analyst');

  const isAdmin = hasMinimumRole(currentUserRole, 'admin');
  const isOwner = hasMinimumRole(currentUserRole, 'owner');

  const count = selectedMembers.length;

  if (count === 0) return null;

  const handleRoleUpdate = async () => {
    await onBulkRoleUpdate(selectedRole);
    setShowRoleDropdown(false);
  };

  const handleRemove = async () => {
    await onBulkRemove();
    setShowRemoveConfirm(false);
  };

  return (
    <>
      {/* Floating Action Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center gap-4 px-6 py-3 bg-background border rounded-lg shadow-lg">
          {/* Selection Count */}
          <div className="flex items-center gap-2">
            <span className="font-medium">{count} selected</span>
            <button
              onClick={onClearSelection}
              disabled={isProcessing}
              className="p-1 rounded hover:bg-muted disabled:opacity-50"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Bulk Actions */}
          <div className="flex items-center gap-2">
            {/* Change Role */}
            {isAdmin && (
              <button
                onClick={() => setShowRoleDropdown(true)}
                disabled={isProcessing}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-muted disabled:opacity-50"
              >
                <UserCog className="h-4 w-4" />
                Change Role
              </button>
            )}

            {/* Remove */}
            {isOwner && (
              <button
                onClick={() => setShowRemoveConfirm(true)}
                disabled={isProcessing}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50"
              >
                <UserMinus className="h-4 w-4" />
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Role Update Modal */}
      {showRoleDropdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !isProcessing && setShowRoleDropdown(false)}
          />
          <div className="relative bg-background rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">
              Change Role for {count} Member{count > 1 ? 's' : ''}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Select the new role for the selected members:
            </p>

            <div className="mb-4">
              <RoleDropdown
                value={selectedRole}
                onChange={setSelectedRole}
                currentUserRole={currentUserRole}
                disabled={isProcessing}
              />
            </div>

            <div className="text-sm text-muted-foreground mb-4">
              Affected members:
              <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {selectedMembers.map((member) => (
                  <li key={member.id} className="truncate">
                    {member.name || member.email}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRoleDropdown(false)}
                disabled={isProcessing}
                className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleUpdate}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                Update Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Remove Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !isProcessing && setShowRemoveConfirm(false)}
          />
          <div className="relative bg-background rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-red-700 mb-4">
              Remove {count} Member{count > 1 ? 's' : ''}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to remove the following members from the team?
              They will lose access to this workspace.
            </p>

            <div className="text-sm mb-4 p-3 bg-red-50 rounded-md">
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {selectedMembers.map((member) => (
                  <li key={member.id} className="truncate text-red-700">
                    {member.name || member.email}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRemoveConfirm(false)}
                disabled={isProcessing}
                className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                Remove Members
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default BulkActionBar;