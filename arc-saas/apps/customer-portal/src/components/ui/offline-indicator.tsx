/**
 * Offline Indicator Component
 *
 * Displays a banner when the app is offline, providing user feedback
 * about network connectivity status.
 *
 * Features:
 * - Auto-detects online/offline state using navigator.onLine
 * - Listens to online/offline events for real-time updates
 * - Slide-in animation when offline
 * - Auto-dismisses when connection is restored
 * - Accessible with proper ARIA attributes
 *
 * Usage:
 * ```tsx
 * import { OfflineIndicator } from '@/components/ui/offline-indicator';
 *
 * function App() {
 *   return (
 *     <>
 *       <OfflineIndicator />
 *       <YourAppContent />
 *     </>
 *   );
 * }
 * ```
 */

import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OfflineIndicatorProps {
  className?: string;
  position?: 'top' | 'bottom';
  showOnlineMessage?: boolean;
}

export function OfflineIndicator({
  className,
  position = 'top',
  showOnlineMessage = false,
}: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [showOnlineBriefly, setShowOnlineBriefly] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      console.log('[Network] Connection restored');
      setIsOnline(true);

      if (wasOffline && showOnlineMessage) {
        setShowOnlineBriefly(true);
        setTimeout(() => {
          setShowOnlineBriefly(false);
          setWasOffline(false);
        }, 3000);
      }
    };

    const handleOffline = () => {
      console.log('[Network] Connection lost');
      setIsOnline(false);
      setWasOffline(true);
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline, showOnlineMessage]);

  // Don't show anything if online and not showing the brief reconnection message
  if (isOnline && !showOnlineBriefly) {
    return null;
  }

  const isOffline = !isOnline;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'fixed left-0 right-0 z-50 transform transition-all duration-300 ease-in-out',
        position === 'top' ? 'top-0' : 'bottom-0',
        isOffline
          ? 'translate-y-0 opacity-100'
          : position === 'top'
          ? '-translate-y-full opacity-0'
          : 'translate-y-full opacity-0',
        className
      )}
    >
      <div
        className={cn(
          'px-4 py-3 text-center text-sm font-medium shadow-lg',
          isOffline
            ? 'bg-yellow-500 text-yellow-950 dark:bg-yellow-600 dark:text-yellow-50'
            : 'bg-green-500 text-green-950 dark:bg-green-600 dark:text-green-50'
        )}
      >
        <div className="flex items-center justify-center gap-2">
          {isOffline ? (
            <>
              <WifiOff className="h-4 w-4" aria-hidden="true" />
              <span>
                You are currently offline. Some features may be limited.
              </span>
            </>
          ) : (
            <>
              <Wifi className="h-4 w-4" aria-hidden="true" />
              <span>
                Connection restored. You are back online.
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Offline Badge - Smaller indicator for use in headers or status bars
 */
export function OfflineBadge({ className }: { className?: string }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-label="Offline mode"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
        className
      )}
    >
      <WifiOff className="h-3 w-3" aria-hidden="true" />
      <span>Offline</span>
    </div>
  );
}

/**
 * Hook to get online status
 * Useful for conditional rendering or logic based on network state
 *
 * @returns boolean indicating if the app is online
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
