import {
  NovuProvider,
  PopoverNotificationCenter,
  NotificationBell,
  IMessage,
} from '@novu/notification-center';
import { Bell } from 'lucide-react';

interface NotificationInboxProps {
  subscriberId: string;
  applicationIdentifier: string;
  backendUrl?: string;
  socketUrl?: string;
  onNotificationClick?: (message: IMessage) => void;
  colorScheme?: 'light' | 'dark';
}

export function NotificationInbox({
  subscriberId,
  applicationIdentifier,
  backendUrl = 'http://localhost:3100',
  socketUrl = 'http://localhost:3100',
  onNotificationClick,
  colorScheme = 'light',
}: NotificationInboxProps) {
  const handleNotificationClick = (message: IMessage) => {
    if (onNotificationClick) {
      onNotificationClick(message);
    }
    // Default behavior: if notification has a CTA URL, navigate to it
    if (message.cta?.data?.url) {
      window.location.href = message.cta.data.url;
    }
  };

  return (
    <NovuProvider
      subscriberId={subscriberId}
      applicationIdentifier={applicationIdentifier}
      backendUrl={backendUrl}
      socketUrl={socketUrl}
      styles={{
        bellButton: {
          root: {
            padding: '8px',
            borderRadius: '8px',
            '&:hover': {
              backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            },
          },
          dot: {
            backgroundColor: '#ef4444',
          },
        },
        popover: {
          dropdown: {
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          },
        },
        notifications: {
          root: {
            '.nc-notifications-list-item': {
              borderRadius: '8px',
              margin: '4px 8px',
            },
          },
        },
        header: {
          root: {
            backgroundColor: colorScheme === 'dark' ? '#1e1e2e' : '#ffffff',
          },
          title: {
            color: colorScheme === 'dark' ? '#ffffff' : '#1a1a1a',
          },
        },
        layout: {
          root: {
            backgroundColor: colorScheme === 'dark' ? '#1e1e2e' : '#ffffff',
          },
        },
        loader: {
          root: {
            stroke: '#6366f1',
          },
        },
      }}
    >
      <PopoverNotificationCenter
        colorScheme={colorScheme}
        onNotificationClick={handleNotificationClick}
        position="bottom-end"
        offset={12}
      >
        {({ unseenCount }) => <NotificationBell unseenCount={unseenCount} />}
      </PopoverNotificationCenter>
    </NovuProvider>
  );
}

// Simple bell button for custom implementations
export function NotificationBellButton({
  unseenCount,
  onClick,
  className,
}: {
  unseenCount?: number;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative p-2 rounded-lg hover:bg-accent transition-colors ${className || ''}`}
    >
      <Bell className="h-5 w-5 text-muted-foreground" />
      {unseenCount && unseenCount > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs font-medium text-white bg-red-500 rounded-full">
          {unseenCount > 9 ? '9+' : unseenCount}
        </span>
      )}
    </button>
  );
}

export default NotificationInbox;
