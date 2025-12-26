/**
 * PWA Update Prompt Component
 *
 * Displays a notification when a new version of the app is available,
 * prompting the user to reload and get the latest updates.
 *
 * Features:
 * - Auto-detects service worker updates
 * - User-friendly update prompt with reload button
 * - Dismissible notification
 * - Accessible with proper ARIA attributes
 * - Integrates with vite-plugin-pwa
 *
 * Usage:
 * ```tsx
 * import { PWAUpdatePrompt } from '@/components/ui/pwa-update-prompt';
 *
 * function App() {
 *   return (
 *     <>
 *       <PWAUpdatePrompt />
 *       <YourAppContent />
 *     </>
 *   );
 * }
 * ```
 */

import React from 'react';
import { RefreshCw, X, Download } from 'lucide-react';
import { useServiceWorkerRegistration } from '@/lib/service-worker-registration';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Session storage key to track that we just reloaded after an update
const SW_UPDATE_RELOADED_KEY = 'cbp_sw_just_reloaded';

/**
 * Check sessionStorage synchronously and clear the flag
 * This runs at module load time before any React lifecycle
 */
function checkAndClearReloadFlag(): boolean {
  try {
    const reloadedFlag = sessionStorage.getItem(SW_UPDATE_RELOADED_KEY);
    if (reloadedFlag === 'true') {
      sessionStorage.removeItem(SW_UPDATE_RELOADED_KEY);
      console.log('[PWA] Just reloaded after update, will suppress prompt');
      return true;
    }
  } catch {
    // sessionStorage might not be available
  }
  return false;
}

export interface PWAUpdatePromptProps {
  className?: string;
  position?: 'top' | 'bottom';
  showOfflineReady?: boolean;
}

export function PWAUpdatePrompt({
  className,
  position = 'bottom',
  showOfflineReady = true,
}: PWAUpdatePromptProps) {
  // Disable PWA update prompt in development mode - HMR causes constant false updates
  const isDev = import.meta.env.DEV;

  // Check synchronously on first render - use lazy initializer for useState
  const [justReloaded] = React.useState(() => checkAndClearReloadFlag());
  // If we just reloaded or in dev mode, start with the prompt dismissed
  const [dismissed, setDismissed] = React.useState(() => justReloaded || isDev);
  const [offlineReadyDismissed, setOfflineReadyDismissed] = React.useState(false);

  // Use a ref to track justReloaded so the callback can access current value
  const justReloadedRef = React.useRef(justReloaded);

  const { needRefresh, offlineReady, updateServiceWorker } = useServiceWorkerRegistration(
    () => {
      // Skip update notifications in dev mode (HMR causes constant false updates)
      if (isDev) {
        console.log('[PWA] Update detected but suppressing (dev mode)');
        return;
      }
      // Only show the update notification if we didn't just reload
      if (!justReloadedRef.current) {
        console.log('[PWA] Update available');
        setDismissed(false);
      } else {
        console.log('[PWA] Update detected but suppressing (just reloaded)');
        // Keep it dismissed
        setDismissed(true);
      }
    },
    () => {
      console.log('[PWA] App ready for offline use');
      setOfflineReadyDismissed(false);
    }
  );

  const handleUpdate = async () => {
    console.log('[PWA] Updating service worker...');
    // Set flag so we don't show the prompt again after reload
    sessionStorage.setItem(SW_UPDATE_RELOADED_KEY, 'true');
    try {
      await updateServiceWorker(true);
      // Fallback: If updateServiceWorker doesn't reload, force reload after a short delay
      // This handles edge cases where the SW update completes but page doesn't reload
      // IMPORTANT: Don't reload if we're on the OAuth callback page to avoid breaking auth flow
      setTimeout(() => {
        if (window.location.pathname.includes('/callback') || window.location.pathname.includes('/authentication')) {
          console.log('[PWA] Skipping fallback reload - on auth callback page');
          sessionStorage.removeItem(SW_UPDATE_RELOADED_KEY); // Clear flag since we didn't reload
          return;
        }
        console.log('[PWA] Fallback reload triggered');
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('[PWA] Update failed, forcing reload:', error);
      // Don't force reload on auth callback to avoid breaking OAuth flow
      if (!window.location.pathname.includes('/callback') && !window.location.pathname.includes('/authentication')) {
        window.location.reload();
      } else {
        sessionStorage.removeItem(SW_UPDATE_RELOADED_KEY); // Clear flag since we didn't reload
      }
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleOfflineReadyDismiss = () => {
    setOfflineReadyDismissed(true);
  };

  // Show update prompt (dismissed is already true if we just reloaded)
  if (needRefresh && !dismissed) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className={cn(
          'fixed left-0 right-0 z-50 transform transition-all duration-300 ease-in-out',
          position === 'top' ? 'top-0' : 'bottom-0',
          'translate-y-0 opacity-100',
          className
        )}
      >
        <div className="mx-auto max-w-4xl p-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-lg dark:border-blue-800 dark:bg-blue-950/50">
            <div className="flex items-start gap-3">
              <RefreshCw className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />

              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  New version available
                </h3>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  A new version is ready. Reload to get the latest features and improvements.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={handleUpdate}
                    className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Reload Now
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDismiss}
                    className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/50"
                  >
                    Later
                  </Button>
                </div>
              </div>

              <button
                onClick={handleDismiss}
                className="flex-shrink-0 rounded-md p-1 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/50"
                aria-label="Dismiss update notification"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show offline ready notification
  if (showOfflineReady && offlineReady && !offlineReadyDismissed) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          'fixed left-0 right-0 z-50 transform transition-all duration-300 ease-in-out',
          position === 'top' ? 'top-0' : 'bottom-0',
          'translate-y-0 opacity-100',
          className
        )}
      >
        <div className="mx-auto max-w-4xl p-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 shadow-lg dark:border-green-800 dark:bg-green-950/50">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />

              <div className="flex-1">
                <h3 className="text-sm font-semibold text-green-900 dark:text-green-100">
                  App ready for offline use
                </h3>
                <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                  Component Platform is now cached and will work offline. You can continue using it even without an internet connection.
                </p>
              </div>

              <button
                onClick={handleOfflineReadyDismiss}
                className="flex-shrink-0 rounded-md p-1 text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/50"
                aria-label="Dismiss offline ready notification"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Compact PWA badge for showing in app header/status bar
 */
export function PWAUpdateBadge({ className }: { className?: string }) {
  const { needRefresh, updateServiceWorker } = useServiceWorkerRegistration();

  if (!needRefresh) {
    return null;
  }

  const handleUpdate = async () => {
    await updateServiceWorker(true);
  };

  return (
    <button
      onClick={handleUpdate}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:hover:bg-blue-900/50',
        className
      )}
      aria-label="Update available - click to reload"
    >
      <RefreshCw className="h-3 w-3" aria-hidden="true" />
      <span>Update Available</span>
    </button>
  );
}
