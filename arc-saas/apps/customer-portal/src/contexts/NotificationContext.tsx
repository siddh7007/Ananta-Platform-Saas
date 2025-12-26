import { createContext, useContext, ReactNode } from 'react';
import { NovuProvider } from '@novu/notification-center';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationContextValue {
  // Future: Add methods for custom notification handling
  isReady: boolean;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

interface NotificationProviderProps {
  children: ReactNode;
  appIdentifier?: string;
  apiUrl?: string;
  socketUrl?: string;
}

/**
 * Notification provider that wraps the app with Novu
 * Uses the authenticated user's ID as the subscriber ID
 */
export function NotificationProvider({
  children,
  appIdentifier,
  apiUrl,
  socketUrl,
}: NotificationProviderProps) {
  const { user, isAuthenticated } = useAuth();

  // Use environment variables with fallback to provided props
  const novuAppId =
    appIdentifier ||
    import.meta.env.VITE_NOVU_APP_IDENTIFIER ||
    '6931905380e6f7e26e0ddaad';
  const novuApiUrl =
    apiUrl || import.meta.env.VITE_NOVU_API_URL || 'http://localhost:13100';
  const novuSocketUrl =
    socketUrl || import.meta.env.VITE_NOVU_WS_URL || 'http://localhost:13101';

  // If user is not authenticated, don't initialize Novu
  if (!isAuthenticated || !user?.id) {
    return (
      <NotificationContext.Provider value={{ isReady: false }}>
        {children}
      </NotificationContext.Provider>
    );
  }

  return (
    <NovuProvider
      subscriberId={user.id}
      applicationIdentifier={novuAppId}
      backendUrl={novuApiUrl}
      socketUrl={novuSocketUrl}
      initialFetchingStrategy={{
        fetchNotifications: true,
        fetchUserPreferences: true,
      }}
    >
      <NotificationContext.Provider value={{ isReady: true }}>
        {children}
      </NotificationContext.Provider>
    </NovuProvider>
  );
}

/**
 * Hook to access notification context
 */
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
