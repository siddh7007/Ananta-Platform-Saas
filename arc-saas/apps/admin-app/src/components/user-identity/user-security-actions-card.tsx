import { useState, useEffect } from 'react';
import {
  Key,
  Lock,
  Unlock,
  RotateCcw,
  Loader2,
  Mail,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
} from 'lucide-react';
import { http } from '@/lib/http-client';
import { cn } from '@/lib/utils';

interface UserSecurityActionsCardProps {
  userId: string;
  userEmail: string;
  onActionComplete?: () => void;
}

// Backend returns { isLockedOut: boolean }
interface LockoutStatus {
  isLockedOut: boolean;
}

export function UserSecurityActionsCard({
  userId,
  userEmail,
  onActionComplete,
}: UserSecurityActionsCardProps) {
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isForcingReset, setIsForcingReset] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [lockoutStatus, setLockoutStatus] = useState<LockoutStatus | null>(null);
  const [isLoadingLockout, setIsLoadingLockout] = useState(false);
  const [actionResult, setActionResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fetchLockoutStatus = async () => {
    setIsLoadingLockout(true);
    try {
      const response = await http.get<LockoutStatus>(
        `/users/${userId}/identity/lockout-status`
      );
      setLockoutStatus(response);
    } catch (err) {
      console.error('Failed to fetch lockout status:', err);
    } finally {
      setIsLoadingLockout(false);
    }
  };

  // Fetch lockout status on mount
  useEffect(() => {
    fetchLockoutStatus();
  }, [userId]);

  const showResult = (type: 'success' | 'error', message: string) => {
    setActionResult({ type, message });
    setTimeout(() => setActionResult(null), 5000);
  };

  const handleSendPasswordReset = async () => {
    if (!confirm(`Send a password reset email to ${userEmail}?`)) {
      return;
    }

    setIsResettingPassword(true);
    try {
      await http.post(`/users/${userId}/identity/password-reset`);
      showResult('success', `Password reset email sent to ${userEmail}`);
      onActionComplete?.();
    } catch (err) {
      showResult('error', err instanceof Error ? err.message : 'Failed to send password reset');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleForcePasswordReset = async () => {
    if (!confirm(`Force ${userEmail} to reset their password on next login? They will not be able to access the application until they set a new password.`)) {
      return;
    }

    setIsForcingReset(true);
    try {
      await http.post(`/users/${userId}/identity/force-password-reset`);
      showResult('success', 'User will be required to reset password on next login');
      onActionComplete?.();
    } catch (err) {
      showResult('error', err instanceof Error ? err.message : 'Failed to force password reset');
    } finally {
      setIsForcingReset(false);
    }
  };

  const handleUnlockUser = async () => {
    if (!confirm(`Unlock the account for ${userEmail}?`)) {
      return;
    }

    setIsUnlocking(true);
    try {
      await http.post(`/users/${userId}/identity/unlock`);
      showResult('success', 'User account has been unlocked');
      setLockoutStatus({ isLockedOut: false });
      onActionComplete?.();
    } catch (err) {
      showResult('error', err instanceof Error ? err.message : 'Failed to unlock user');
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Security Actions
        </h2>
      </div>
      <div className="p-6 space-y-4">
        {/* Action Result Banner */}
        {actionResult && (
          <div
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg",
              actionResult.type === 'success'
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            )}
          >
            {actionResult.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
            <span className="text-sm">{actionResult.message}</span>
          </div>
        )}

        {/* Account Lock Status */}
        {lockoutStatus?.isLockedOut && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-800">
            <Lock className="h-5 w-5" />
            <div className="flex-1">
              <span className="font-medium">Account is locked</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Send Password Reset Email */}
          <button
            onClick={handleSendPasswordReset}
            disabled={isResettingPassword}
            className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-left">
                <div className="font-medium">Send Password Reset Email</div>
                <div className="text-sm text-muted-foreground">
                  User will receive an email with reset instructions
                </div>
              </div>
            </div>
            {isResettingPassword ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Key className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          {/* Force Password Reset */}
          <button
            onClick={handleForcePasswordReset}
            disabled={isForcingReset}
            className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <RotateCcw className="h-5 w-5 text-orange-600" />
              </div>
              <div className="text-left">
                <div className="font-medium">Force Password Reset</div>
                <div className="text-sm text-muted-foreground">
                  User must change password on next login
                </div>
              </div>
            </div>
            {isForcingReset ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Key className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          {/* Unlock Account */}
          <button
            onClick={handleUnlockUser}
            disabled={isUnlocking || isLoadingLockout || !lockoutStatus?.isLockedOut}
            className={cn(
              "w-full flex items-center justify-between p-4 rounded-lg border transition-colors disabled:opacity-50",
              lockoutStatus?.isLockedOut
                ? "hover:bg-green-50 border-green-200"
                : "cursor-not-allowed"
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center",
                  lockoutStatus?.isLockedOut ? "bg-green-100" : "bg-gray-100"
                )}
              >
                <Unlock
                  className={cn(
                    "h-5 w-5",
                    lockoutStatus?.isLockedOut ? "text-green-600" : "text-gray-400"
                  )}
                />
              </div>
              <div className="text-left">
                <div className="font-medium">Unlock Account</div>
                <div className="text-sm text-muted-foreground">
                  {lockoutStatus?.isLockedOut
                    ? "Remove account lockout due to failed logins"
                    : "Account is not currently locked"}
                </div>
              </div>
            </div>
            {isUnlocking || isLoadingLockout ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : lockoutStatus?.isLockedOut ? (
              <Lock className="h-5 w-5 text-red-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
          </button>
        </div>

        {/* Help Text */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p>
            <strong>Password Reset Email:</strong> Sends a secure link to the user's email address.
          </p>
          <p className="mt-1">
            <strong>Force Password Reset:</strong> User will be prompted to create a new password when they next log in.
          </p>
        </div>
      </div>
    </div>
  );
}
