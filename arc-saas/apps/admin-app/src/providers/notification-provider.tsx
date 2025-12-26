import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  showNotification: (
    message: string,
    type?: NotificationType,
    options?: { title?: string; duration?: number }
  ) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const DEFAULT_DURATION = 5000;

const icons: Record<NotificationType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error: <AlertCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
};

const bgColors: Record<NotificationType, string> = {
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  warning: 'bg-yellow-50 border-yellow-200',
  info: 'bg-blue-50 border-blue-200',
};

interface NotificationProviderProps {
  children: ReactNode;
  /** Maximum number of notifications to show at once */
  maxNotifications?: number;
  /** Position of the notification stack */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

/**
 * Provider for displaying toast notifications throughout the app.
 *
 * @example
 * // In your app wrapper
 * <NotificationProvider>
 *   <App />
 * </NotificationProvider>
 *
 * // In a component
 * const { success, error } = useNotification();
 * success('Changes saved successfully!');
 * error('Failed to save changes', 'Error');
 */
export function NotificationProvider({
  children,
  maxNotifications = 5,
  position = 'top-right',
}: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const showNotification = useCallback(
    (
      message: string,
      type: NotificationType = 'info',
      options?: { title?: string; duration?: number }
    ) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const duration = options?.duration ?? DEFAULT_DURATION;

      const notification: Notification = {
        id,
        type,
        message,
        title: options?.title,
        duration,
      };

      setNotifications((prev) => {
        const updated = [...prev, notification];
        // Keep only the latest maxNotifications
        return updated.slice(-maxNotifications);
      });

      // Auto-dismiss after duration
      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss, maxNotifications]
  );

  const success = useCallback(
    (message: string, title?: string) => showNotification(message, 'success', { title }),
    [showNotification]
  );

  const error = useCallback(
    (message: string, title?: string) => showNotification(message, 'error', { title }),
    [showNotification]
  );

  const warning = useCallback(
    (message: string, title?: string) => showNotification(message, 'warning', { title }),
    [showNotification]
  );

  const info = useCallback(
    (message: string, title?: string) => showNotification(message, 'info', { title }),
    [showNotification]
  );

  const positionClasses: Record<string, string> = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        showNotification,
        success,
        error,
        warning,
        info,
        dismiss,
        dismissAll,
      }}
    >
      {children}

      {/* Notification Container */}
      <div
        className={`fixed ${positionClasses[position]} z-50 flex flex-col gap-2 pointer-events-none`}
        aria-live="polite"
      >
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`
              pointer-events-auto
              min-w-[300px] max-w-[400px]
              p-4 rounded-lg border shadow-lg
              animate-in slide-in-from-right fade-in duration-200
              ${bgColors[notification.type]}
            `}
            role="alert"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">{icons[notification.type]}</div>
              <div className="flex-1 min-w-0">
                {notification.title && (
                  <p className="font-semibold text-gray-900 text-sm">{notification.title}</p>
                )}
                <p className="text-gray-700 text-sm">{notification.message}</p>
              </div>
              <button
                onClick={() => dismiss(notification.id)}
                className="flex-shrink-0 p-1 rounded hover:bg-gray-200 transition-colors"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

/**
 * Hook to access notification functions
 *
 * @returns Object with notification methods (success, error, warning, info, dismiss, dismissAll)
 */
export function useNotification(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

export default NotificationProvider;
