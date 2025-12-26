/**
 * useSessionTimeout Hook
 *
 * React hook for session timeout management.
 * Integrates with NotificationContext for warnings and handles logout independently.
 *
 * NOTE: This hook does NOT use React Admin's useLogout() because it needs to work
 * OUTSIDE the Admin component context. Instead, it performs direct navigation
 * and token cleanup.
 *
 * Usage:
 * ```tsx
 * import { useSessionTimeout } from '@/hooks/useSessionTimeout';
 *
 * function App() {
 *   useSessionTimeout({
 *     enabled: true,
 *     timeoutMinutes: 30,
 *     warningMinutes: 5,
 *   });
 *   // ...
 * }
 * ```
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import {
  createSessionTimeout,
  formatRemainingTime,
  clearSessionStorage,
  type SessionTimeoutInstance,
} from '../lib/sessionTimeout';

export interface UseSessionTimeoutOptions {
  /** Enable session timeout (default: true) */
  enabled?: boolean;
  /** Timeout in minutes (default: 30) */
  timeoutMinutes?: number;
  /** Warning before timeout in minutes (default: 5) */
  warningMinutes?: number;
  /** Custom logout handler (default: uses React Admin logout) */
  onLogout?: () => void;
}

export interface UseSessionTimeoutReturn {
  /** Remaining time in milliseconds */
  remainingTime: number;
  /** Formatted remaining time (mm:ss) */
  remainingTimeFormatted: string;
  /** Whether warning is currently shown */
  isWarning: boolean;
  /** Manually reset the timeout */
  reset: () => void;
  /** Whether timeout is active */
  isActive: boolean;
}

export function useSessionTimeout(options: UseSessionTimeoutOptions = {}): UseSessionTimeoutReturn {
  const {
    enabled = true,
    timeoutMinutes = 30,
    warningMinutes = 5,
    onLogout,
  } = options;

  // NOTE: We do NOT use React Admin's useLogout() here because this hook
  // must work OUTSIDE the Admin/QueryClientProvider context.
  // Instead, we perform direct token cleanup and navigation.

  // Use our custom NotificationContext (available outside Admin context)
  const { showWarning } = useNotification();

  const sessionRef = useRef<SessionTimeoutInstance | null>(null);
  const [remainingTime, setRemainingTime] = useState(timeoutMinutes * 60 * 1000);
  const [isWarning, setIsWarning] = useState(false);
  const warningShownRef = useRef(false);

  const handleLogout = useCallback(() => {
    console.log('[SessionTimeout] Logging out due to inactivity');
    clearSessionStorage();

    // Clear any stored tokens
    try {
      // Clear Auth0 tokens if present
      localStorage.removeItem('@@auth0spajs@@::*');
      // Clear any other session data
      sessionStorage.clear();
    } catch {
      // localStorage/sessionStorage may be unavailable
    }

    if (onLogout) {
      onLogout();
    } else {
      // Default logout: redirect to login page
      // This works without React Admin context
      window.location.href = '/login';
    }
  }, [onLogout]);

  const handleWarning = useCallback((remainingMs: number) => {
    if (warningShownRef.current) return;
    warningShownRef.current = true;
    setIsWarning(true);

    const minutes = Math.ceil(remainingMs / 60000);
    console.log('[SessionTimeout] Session warning shown', { remainingMs, minutes });

    // Use our custom NotificationContext which is available outside Admin
    showWarning(
      `Your session will expire in ${minutes} minute${minutes > 1 ? 's' : ''} due to inactivity. Move your mouse or press a key to stay logged in.`
    );
  }, [showWarning]);

  const handleActivity = useCallback(() => {
    if (warningShownRef.current) {
      warningShownRef.current = false;
      setIsWarning(false);
      console.log('[SessionTimeout] Activity detected, warning cleared');
    }
  }, []);

  const reset = useCallback(() => {
    sessionRef.current?.reset();
    warningShownRef.current = false;
    setIsWarning(false);
    console.log('[SessionTimeout] Session manually reset');
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timeoutMs = timeoutMinutes * 60 * 1000;
    const warningMs = warningMinutes * 60 * 1000;

    // Validate configuration
    if (warningMs >= timeoutMs) {
      console.warn('[SessionTimeout] Warning time must be less than timeout. Using defaults.');
    }

    sessionRef.current = createSessionTimeout({
      timeoutMs,
      warningMs: Math.min(warningMs, timeoutMs - 60000), // Ensure warning is at least 1 min before timeout
      onWarning: handleWarning,
      onTimeout: handleLogout,
      onActivity: handleActivity,
    });

    sessionRef.current.start();

    // Update remaining time periodically
    const updateInterval = setInterval(() => {
      if (sessionRef.current) {
        setRemainingTime(sessionRef.current.getRemainingTime());
      }
    }, 1000);

    return () => {
      sessionRef.current?.stop();
      sessionRef.current = null;
      clearInterval(updateInterval);
    };
    // ESLint: handleWarning, handleLogout, handleActivity are stable via useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, timeoutMinutes, warningMinutes]);

  return {
    remainingTime,
    remainingTimeFormatted: formatRemainingTime(remainingTime),
    isWarning,
    reset,
    isActive: !!sessionRef.current?.isActive(),
  };
}

export default useSessionTimeout;
