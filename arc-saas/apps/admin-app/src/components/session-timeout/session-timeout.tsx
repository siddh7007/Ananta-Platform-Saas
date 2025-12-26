import { useState, useCallback, useRef } from 'react';
import { useIdleTimer, IIdleTimer } from 'react-idle-timer';
import { useLogout } from '@refinedev/core';
import { WarningLogoutDialog } from './warning-logout-dialog';
import { BackdropLoader } from '../backdrop-loader';
import { useConfig } from '../../hooks/use-config';

const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const MINUTE_TO_MS = SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

export interface SessionTimeoutProps {
  /** Duration of inactivity (in minutes) after which the user will be logged out */
  expiryTimeInMinute?: number;
  /** Duration (in minutes) before idle timeout when the warning dialog appears */
  promptTimeBeforeIdleInMinute?: number;
  /** Whether session timeout is enabled */
  enabled?: boolean;
}

/**
 * Session timeout component that manages automatic logout on inactivity.
 * Shows a warning dialog before logging out with a countdown timer.
 * Supports cross-tab synchronization.
 */
export function SessionTimeout({
  expiryTimeInMinute,
  promptTimeBeforeIdleInMinute,
  enabled = true,
}: SessionTimeoutProps) {
  const { config } = useConfig();
  const { mutate: logout } = useLogout();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  // Use ref to access idle timer methods in callbacks without stale closure issues
  const idleTimerRef = useRef<IIdleTimer | null>(null);

  // Use config values as defaults
  const timeout = expiryTimeInMinute ?? config.sessionTimeoutMinutes;
  const promptBefore = promptTimeBeforeIdleInMinute ?? config.sessionWarningMinutes;

  const handleLogout = useCallback(async () => {
    setShowWarning(false);
    setIsLoggingOut(true);
    logout();
  }, [logout]);

  const onIdle = useCallback(() => {
    setShowWarning(false);
    handleLogout();
  }, [handleLogout]);

  const onPrompt = useCallback(() => {
    setShowWarning(true);
  }, []);

  const onMessage = useCallback((data: { action: string }) => {
    switch (data.action) {
      case 'LOGOUT':
        handleLogout();
        break;
      case 'STAY':
        setShowWarning(false);
        idleTimerRef.current?.reset();
        break;
    }
  }, [handleLogout]);

  const onAction = useCallback(() => {
    if (!idleTimerRef.current?.isPrompted()) {
      setShowWarning(false);
    }
  }, []);

  const idleTimer = useIdleTimer({
    onIdle,
    onPrompt,
    onMessage,
    onAction,
    timeout: timeout * MINUTE_TO_MS,
    promptBeforeIdle: promptBefore * MINUTE_TO_MS,
    throttle: 500,
    crossTab: true,
    leaderElection: true,
    syncTimers: 200,
    disabled: !enabled,
  });

  // Store the idle timer instance in ref for use in callbacks
  idleTimerRef.current = idleTimer;

  const handleStayLoggedIn = useCallback(() => {
    setShowWarning(false);
    idleTimer.reset();
    idleTimer.message({ action: 'STAY' }, true);
  }, [idleTimer]);

  const handleSignOut = useCallback(() => {
    idleTimer.message({ action: 'LOGOUT' }, true);
    handleLogout();
  }, [idleTimer, handleLogout]);

  if (!enabled) {
    return null;
  }

  return (
    <>
      {isLoggingOut && <BackdropLoader />}
      <WarningLogoutDialog
        open={showWarning}
        getRemainingTime={idleTimer.getRemainingTime}
        onStayLoggedIn={handleStayLoggedIn}
        onSignOut={handleSignOut}
      />
    </>
  );
}

export default SessionTimeout;
