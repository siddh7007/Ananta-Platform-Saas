/**
 * SessionTimeoutProvider
 *
 * Wrapper component that provides session timeout functionality.
 * Must be used inside NotificationProvider context for notifications.
 * Must be used inside React Admin context for logout to work.
 *
 * Configuration via environment variables:
 * - VITE_SESSION_TIMEOUT_MINUTES: Timeout in minutes (default: 30, range: 5-480)
 * - VITE_SESSION_WARNING_MINUTES: Warning before timeout (default: 5, range: 1-60)
 * - VITE_SESSION_TIMEOUT_ENABLED: Enable/disable (default: true)
 */

import { ReactNode, useEffect } from 'react';
import { useSessionTimeout } from '../hooks/useSessionTimeout';

// Configuration constants
// 30 minutes: Balance between security and user convenience
// Industry standard for admin interfaces (OWASP recommendation: 15-30 min)
const DEFAULT_TIMEOUT = 30;
const MIN_TIMEOUT = 5;
const MAX_TIMEOUT = 480; // 8 hours max

// 5 minutes: Sufficient time for user to notice and respond
const DEFAULT_WARNING = 5;
const MIN_WARNING = 1;
const MAX_WARNING = 60;

/**
 * Get numeric environment variable with validation
 */
function getEnvNumber(
  key: string,
  defaultValue: number,
  min: number,
  max: number
): number {
  const value = import.meta.env[key];
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`[SessionTimeout] Invalid ${key}="${value}", using default ${defaultValue}`);
    return defaultValue;
  }

  if (parsed < min || parsed > max) {
    console.warn(
      `[SessionTimeout] ${key}=${parsed} is outside valid range (${min}-${max}), using default ${defaultValue}`
    );
    return defaultValue;
  }

  return parsed;
}

/**
 * Get boolean environment variable
 */
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = import.meta.env[key];
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  const str = String(value).toLowerCase();
  return str === 'true' || str === '1';
}

interface SessionTimeoutProviderProps {
  children: ReactNode;
  enabled?: boolean;
  timeoutMinutes?: number;
  warningMinutes?: number;
}

/**
 * SessionTimeoutManager - Internal component that uses the hook
 * This is separate to ensure hooks are called consistently
 */
function SessionTimeoutManager({
  children,
  enabled,
  timeoutMinutes,
  warningMinutes,
}: SessionTimeoutProviderProps) {
  // Parse and validate configuration
  const resolvedEnabled = enabled ?? getEnvBoolean('VITE_SESSION_TIMEOUT_ENABLED', true);
  const resolvedTimeout = timeoutMinutes ?? getEnvNumber(
    'VITE_SESSION_TIMEOUT_MINUTES',
    DEFAULT_TIMEOUT,
    MIN_TIMEOUT,
    MAX_TIMEOUT
  );
  const resolvedWarning = warningMinutes ?? getEnvNumber(
    'VITE_SESSION_WARNING_MINUTES',
    DEFAULT_WARNING,
    MIN_WARNING,
    MAX_WARNING
  );

  // Validate warning < timeout
  const validatedWarning = Math.min(resolvedWarning, resolvedTimeout - 1);

  // Log configuration on startup (dev only)
  useEffect(() => {
    if (import.meta.env.DEV && resolvedEnabled) {
      console.log('[SessionTimeout] Configuration:', {
        enabled: resolvedEnabled,
        timeoutMinutes: resolvedTimeout,
        warningMinutes: validatedWarning,
      });
    }
  }, [resolvedEnabled, resolvedTimeout, validatedWarning]);

  // Use session timeout hook with validated configuration
  const { isWarning, remainingTimeFormatted } = useSessionTimeout({
    enabled: resolvedEnabled,
    timeoutMinutes: resolvedTimeout,
    warningMinutes: validatedWarning,
  });

  // Log warning state for debugging (only when state changes)
  useEffect(() => {
    if (isWarning) {
      console.log(`[SessionTimeout] Warning: Session expires in ${remainingTimeFormatted}`);
    }
  }, [isWarning, remainingTimeFormatted]);

  return <>{children}</>;
}

/**
 * SessionTimeoutProvider
 *
 * Wrap your authenticated app content with this component to enable
 * automatic session timeout after inactivity.
 *
 * Usage:
 * ```tsx
 * <NotificationProvider>
 *   <SessionTimeoutProvider>
 *     <Admin ... />
 *   </SessionTimeoutProvider>
 * </NotificationProvider>
 * ```
 */
export function SessionTimeoutProvider({
  children,
  enabled,
  timeoutMinutes,
  warningMinutes,
}: SessionTimeoutProviderProps) {
  return (
    <SessionTimeoutManager
      enabled={enabled}
      timeoutMinutes={timeoutMinutes}
      warningMinutes={warningMinutes}
    >
      {children}
    </SessionTimeoutManager>
  );
}

export default SessionTimeoutProvider;
