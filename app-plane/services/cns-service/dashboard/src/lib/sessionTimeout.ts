/**
 * Session Timeout Utility
 *
 * Provides automatic session timeout after inactivity.
 * Monitors user activity (mouse, keyboard, touch) and triggers
 * logout after configurable inactivity period.
 *
 * Security Features:
 * - Configurable timeout (default: 30 minutes)
 * - Warning before logout (default: 5 minutes)
 * - Activity debouncing to prevent excessive updates
 * - Cross-tab session sync via BroadcastChannel
 * - Cleanup on unmount
 */

// Configuration
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_WARNING_MS = 5 * 60 * 1000; // 5 minutes before timeout
const ACTIVITY_DEBOUNCE_MS = 1000; // Debounce activity events
const STORAGE_KEY = 'cns_last_activity';
const BROADCAST_CHANNEL = 'cns_session_sync';

export interface SessionTimeoutConfig {
  timeoutMs?: number;
  warningMs?: number;
  onWarning?: (remainingMs: number) => void;
  onTimeout?: () => void;
  onActivity?: () => void;
}

export interface SessionTimeoutInstance {
  start: () => void;
  stop: () => void;
  reset: () => void;
  getRemainingTime: () => number;
  isActive: () => boolean;
}

/**
 * Create a session timeout manager
 */
export function createSessionTimeout(config: SessionTimeoutConfig = {}): SessionTimeoutInstance {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    warningMs = DEFAULT_WARNING_MS,
    onWarning,
    onTimeout,
    onActivity,
  } = config;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let warningId: ReturnType<typeof setTimeout> | null = null;
  let checkIntervalId: ReturnType<typeof setInterval> | null = null;
  let lastActivity = Date.now();
  let isRunning = false;
  let warningShown = false;
  let channel: BroadcastChannel | null = null;

  // Debounced activity tracker
  let activityTimeout: ReturnType<typeof setTimeout> | null = null;

  const updateLastActivity = () => {
    lastActivity = Date.now();
    warningShown = false;

    // Persist to localStorage for cross-tab sync
    try {
      localStorage.setItem(STORAGE_KEY, lastActivity.toString());
    } catch {
      // localStorage may be unavailable in private mode
    }

    // Broadcast to other tabs
    if (channel) {
      try {
        channel.postMessage({ type: 'activity', timestamp: lastActivity });
      } catch {
        // Channel may be closed
      }
    }

    onActivity?.();
    scheduleTimeouts();
  };

  const handleActivity = () => {
    if (!isRunning) return;

    // Debounce activity updates
    if (activityTimeout) {
      clearTimeout(activityTimeout);
    }
    activityTimeout = setTimeout(updateLastActivity, ACTIVITY_DEBOUNCE_MS);
  };

  const scheduleTimeouts = () => {
    // Clear existing timeouts
    if (timeoutId) clearTimeout(timeoutId);
    if (warningId) clearTimeout(warningId);

    const elapsed = Date.now() - lastActivity;
    const remaining = timeoutMs - elapsed;
    const warningTime = timeoutMs - warningMs;

    if (remaining <= 0) {
      // Already timed out
      handleTimeout();
      return;
    }

    // Schedule warning
    if (remaining > warningMs && onWarning) {
      warningId = setTimeout(() => {
        if (!warningShown) {
          warningShown = true;
          onWarning(warningMs);
        }
      }, warningTime - elapsed);
    }

    // Schedule timeout
    timeoutId = setTimeout(handleTimeout, remaining);
  };

  const handleTimeout = () => {
    console.log('[SessionTimeout] Session timed out due to inactivity');
    stop();
    onTimeout?.();
  };

  const handleBroadcastMessage = (event: MessageEvent) => {
    if (event.data?.type === 'activity' && event.data?.timestamp) {
      const remoteActivity = event.data.timestamp;
      if (remoteActivity > lastActivity) {
        lastActivity = remoteActivity;
        warningShown = false;
        scheduleTimeouts();
      }
    }
  };

  const checkStoredActivity = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const storedTime = parseInt(stored, 10);
        if (!isNaN(storedTime) && storedTime > lastActivity) {
          lastActivity = storedTime;
          warningShown = false;
          scheduleTimeouts();
        }
      }
    } catch {
      // localStorage may be unavailable
    }
  };

  const activityEvents: (keyof WindowEventMap)[] = [
    'mousedown',
    'mousemove',
    'keydown',
    'touchstart',
    'scroll',
    'click',
  ];

  const start = () => {
    if (isRunning) {
      console.warn('[SessionTimeout] start() called while already running');
      return;
    }
    isRunning = true;

    // Initialize
    updateLastActivity();

    // Set up BroadcastChannel for cross-tab sync
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL);
      channel.onmessage = handleBroadcastMessage;
    } catch {
      // BroadcastChannel not supported
    }

    // Listen for activity events
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Periodically check localStorage for cross-tab updates (fallback for no BroadcastChannel)
    checkIntervalId = setInterval(checkStoredActivity, 5000);

    // Check for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    console.log('[SessionTimeout] Session timeout monitoring started');
  };

  const stop = () => {
    if (!isRunning) return;
    isRunning = false;

    // Clear timeouts
    if (timeoutId) clearTimeout(timeoutId);
    if (warningId) clearTimeout(warningId);
    if (checkIntervalId) clearInterval(checkIntervalId);
    if (activityTimeout) clearTimeout(activityTimeout);

    // Remove event listeners
    activityEvents.forEach((event) => {
      window.removeEventListener(event, handleActivity);
    });

    document.removeEventListener('visibilitychange', handleVisibilityChange);

    // Close broadcast channel
    if (channel) {
      try {
        channel.close();
      } catch {
        // Already closed
      }
      channel = null;
    }

    console.log('[SessionTimeout] Session timeout monitoring stopped');
  };

  const reset = () => {
    updateLastActivity();
  };

  const getRemainingTime = (): number => {
    const elapsed = Date.now() - lastActivity;
    return Math.max(0, timeoutMs - elapsed);
  };

  const isActiveState = (): boolean => {
    return isRunning;
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // Check if timed out while tab was hidden
      checkStoredActivity();
      const remaining = getRemainingTime();
      if (remaining <= 0) {
        handleTimeout();
      }
    }
  };

  return {
    start,
    stop,
    reset,
    getRemainingTime,
    isActive: isActiveState,
  };
}

/**
 * Format remaining time for display
 */
export function formatRemainingTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Clear session timeout storage and sensitive tokens (call on logout)
 * Removes activity tracking data and admin API token
 */
export function clearSessionStorage(): void {
  try {
    // Remove activity tracking
    localStorage.removeItem(STORAGE_KEY);
    // Remove admin API token for security

    if (import.meta.env.DEV) {
      console.log('[SessionTimeout] Session storage cleared');
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[SessionTimeout] Failed to clear session storage', error);
    }
    // localStorage may be unavailable
  }
}
