/**
 * InviteModal Component
 *
 * Modal form for inviting new team members.
 * Includes email validation and role selection.
 */

import { useState } from 'react';
import { X, Mail, Send, Loader2, AlertCircle } from 'lucide-react';
import type { AppRole } from '@/config/auth';
import { RoleDropdown } from './RoleDropdown';
import { isValidEmail, getAssignableRoles } from '@/types/team';
import { cn } from '@/lib/utils';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: AppRole, message?: string) => Promise<void>;
  currentUserRole: AppRole;
  tenantName?: string;
}

export function InviteModal({
  isOpen,
  onClose,
  onInvite,
  currentUserRole,
  tenantName,
}: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('analyst');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignableRoles = getAssignableRoles(currentUserRole);
  const defaultRole = assignableRoles[0] || 'analyst';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      await onInvite(email.trim(), role, message.trim() || undefined);
      // Reset form on success
      setEmail('');
      setRole(defaultRole);
      setMessage('');
      onClose();
    } catch (err) {
      console.error('Failed to send invitation:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to send invitation. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setEmail('');
      setRole(defaultRole);
      setMessage('');
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-background rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Invite Team Member</h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-1 rounded-md hover:bg-muted disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {tenantName && (
            <p className="text-sm text-muted-foreground">
              Invite someone to join <strong>{tenantName}</strong>
            </p>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-2">
            <label
              htmlFor="invite-email"
              className="text-sm font-medium flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Email Address
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              disabled={isLoading}
              className={cn(
                'w-full px-3 py-2 border rounded-md bg-background',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            />
          </div>

          {/* Role Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Role</label>
            {assignableRoles.length > 0 ? (
              <RoleDropdown
                value={role}
                onChange={setRole}
                currentUserRole={currentUserRole}
                disabled={isLoading}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                You cannot assign roles at this time.
              </p>
            )}
          </div>

          {/* Optional Message */}
          <div className="space-y-2">
            <label
              htmlFor="invite-message"
              className="text-sm font-medium"
            >
              Personal Message{' '}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <textarea
              id="invite-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal note to the invitation email..."
              rows={3}
              disabled={isLoading}
              className={cn(
                'w-full px-3 py-2 border rounded-md bg-background resize-none',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !email.trim() || assignableRoles.length === 0}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Invitation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default InviteModal;
