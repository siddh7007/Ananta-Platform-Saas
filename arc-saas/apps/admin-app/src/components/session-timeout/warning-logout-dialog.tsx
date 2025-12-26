import { useEffect, useState } from 'react';
import { Clock, LogOut } from 'lucide-react';

interface WarningLogoutDialogProps {
  open: boolean;
  getRemainingTime: () => number;
  onStayLoggedIn: () => void;
  onSignOut: () => void;
}

/**
 * Warning dialog shown before automatic logout due to inactivity.
 * Displays a countdown timer and allows user to extend session or sign out.
 */
export function WarningLogoutDialog({
  open,
  getRemainingTime,
  onStayLoggedIn,
  onSignOut,
}: WarningLogoutDialogProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      const remaining = Math.ceil(getRemainingTime() / 1000);
      setRemainingSeconds(remaining);
    }, 500);

    return () => clearInterval(interval);
  }, [open, getRemainingTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-yellow-50 dark:bg-yellow-900/30 px-6 py-4 border-b border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-800 rounded-full">
              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200">
              Session Expiring Soon
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Your session will expire due to inactivity. You will be automatically
            logged out in:
          </p>

          {/* Countdown Timer */}
          <div className="flex justify-center mb-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-red-600 dark:text-red-400 tabular-nums">
                {formatTime(remainingSeconds)}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                remaining
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Click "Stay Logged In" to continue your session, or "Sign Out" to
            logout now.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex gap-3 justify-end">
          <button
            onClick={onSignOut}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
          <button
            onClick={onStayLoggedIn}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}

export default WarningLogoutDialog;
