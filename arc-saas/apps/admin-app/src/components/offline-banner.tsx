import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../providers/online-status-provider';

/**
 * Banner displayed when the user is offline.
 * Uses the OnlineStatusProvider to detect network status.
 */
export function OfflineBanner() {
  const { isOnline } = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-900 px-4 py-2">
      <div className="container mx-auto flex items-center justify-center gap-2 text-sm font-medium">
        <WifiOff className="w-4 h-4" />
        <span>You are currently offline. Some features may not be available.</span>
      </div>
    </div>
  );
}

export default OfflineBanner;
