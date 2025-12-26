import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface OnlineStatusContextType {
  isOnline: boolean;
  lastOnlineAt: Date | null;
}

const OnlineStatusContext = createContext<OnlineStatusContextType>({
  isOnline: true,
  lastOnlineAt: null,
});

const PING_RESOURCE = '/ping.txt';
const TIMEOUT_MS = 3000;
const POLLING_INTERVAL_MS = 15000;

/**
 * Timeout wrapper for fetch promises
 */
function timeout(timeMs: number, promise: Promise<Response>): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Request timed out'));
    }, timeMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Check if we're actually online by pinging a resource
 */
async function checkOnlineStatus(): Promise<boolean> {
  // If browser reports offline, trust it
  if (!navigator.onLine) {
    return false;
  }

  const controller = new AbortController();

  try {
    await timeout(
      TIMEOUT_MS,
      fetch(PING_RESOURCE, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      })
    );
    return true;
  } catch {
    controller.abort();
    return false;
  }
}

interface OnlineStatusProviderProps {
  children: ReactNode;
  /** Enable polling for slow connections (disabled in dev by default) */
  enablePolling?: boolean;
}

/**
 * Provider that monitors network connectivity status.
 * Uses both browser events and optional polling for reliability.
 *
 * @example
 * // In your app wrapper
 * <OnlineStatusProvider>
 *   <App />
 * </OnlineStatusProvider>
 *
 * // In a component
 * const { isOnline } = useOnlineStatus();
 * if (!isOnline) {
 *   return <OfflineBanner />;
 * }
 */
export function OnlineStatusProvider({
  children,
  enablePolling = process.env.NODE_ENV !== 'development',
}: OnlineStatusProviderProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(new Date());
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Listen to browser online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Optional polling for slow/unstable connections
    let intervalId: NodeJS.Timeout | undefined;

    if (enablePolling) {
      intervalId = setInterval(async () => {
        const online = await checkOnlineStatus();
        if (online !== isOnline) {
          setIsOnline(online);
          if (online) {
            setLastOnlineAt(new Date());
          }
        }
      }, POLLING_INTERVAL_MS);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [enablePolling, isOnline]);

  return (
    <OnlineStatusContext.Provider value={{ isOnline, lastOnlineAt }}>
      {children}
    </OnlineStatusContext.Provider>
  );
}

/**
 * Hook to access the current online status
 *
 * @returns Object with isOnline boolean and lastOnlineAt timestamp
 */
export function useOnlineStatus(): OnlineStatusContextType {
  const context = useContext(OnlineStatusContext);
  if (!context) {
    throw new Error('useOnlineStatus must be used within an OnlineStatusProvider');
  }
  return context;
}

export default OnlineStatusProvider;
