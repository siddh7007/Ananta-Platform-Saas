import {
  NovuProvider,
  PopoverNotificationCenter,
  NotificationBell,
  IMessage,
} from '@novu/notification-center';

// Novu configuration - in production, these should come from environment variables
const NOVU_APP_IDENTIFIER = import.meta.env.VITE_NOVU_APP_IDENTIFIER || '6931905380e6f7e26e0ddaad';
const NOVU_BACKEND_URL = import.meta.env.VITE_NOVU_BACKEND_URL || 'http://localhost:3100';

interface NotificationInboxProps {
  subscriberId: string;
  subscriberEmail?: string;
  subscriberFirstName?: string;
  subscriberLastName?: string;
  onNotificationClick?: (message: IMessage) => void;
}

export function NotificationInbox({
  subscriberId,
  subscriberEmail: _subscriberEmail,
  subscriberFirstName: _subscriberFirstName,
  subscriberLastName: _subscriberLastName,
  onNotificationClick,
}: NotificationInboxProps) {
  // Note: subscriber metadata properties are available for future use when Novu
  // supports subscriber identification via these properties
  void _subscriberEmail;
  void _subscriberFirstName;
  void _subscriberLastName;
  const handleNotificationClick = (message: IMessage) => {
    if (onNotificationClick) {
      onNotificationClick(message);
    }
    // Default behavior: if notification has a CTA URL, navigate to it
    if (message.cta?.data?.url) {
      window.location.href = message.cta.data.url as string;
    }
  };

  return (
    <NovuProvider
      subscriberId={subscriberId}
      applicationIdentifier={NOVU_APP_IDENTIFIER}
      backendUrl={NOVU_BACKEND_URL}
      socketUrl={NOVU_BACKEND_URL}
      subscriberHash=""
      initialFetchingStrategy={{
        fetchNotifications: true,
        fetchUnseenCount: true,
        fetchOrganization: false,
        fetchUnreadCount: true,
      }}
      styles={{
        bellButton: {
          root: {
            padding: '8px',
            borderRadius: '8px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            '&:hover': {
              backgroundColor: 'hsl(var(--accent))',
            },
          },
          dot: {
            backgroundColor: '#ef4444',
            width: '8px',
            height: '8px',
            top: '6px',
            right: '6px',
          },
        },
        popover: {
          dropdown: {
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            border: '1px solid hsl(var(--border))',
            overflow: 'hidden',
          },
        },
        notifications: {
          root: {
            backgroundColor: 'hsl(var(--card))',
          },
          listItem: {
            layout: {
              borderRadius: '8px',
              margin: '4px 8px',
              '&:hover': {
                backgroundColor: 'hsl(var(--accent))',
              },
            },
            unread: {
              '::before': {
                backgroundColor: 'hsl(var(--primary))',
              },
            },
          },
        },
        header: {
          root: {
            backgroundColor: 'hsl(var(--card))',
            borderBottom: '1px solid hsl(var(--border))',
            padding: '16px',
          },
          title: {
            color: 'hsl(var(--foreground))',
            fontSize: '16px',
            fontWeight: '600',
          },
          markAsRead: {
            color: 'hsl(var(--primary))',
            '&:hover': {
              color: 'hsl(var(--primary))',
              opacity: 0.8,
            },
          },
        },
        layout: {
          root: {
            backgroundColor: 'hsl(var(--card))',
            minWidth: '360px',
            maxWidth: '420px',
          },
        },
        loader: {
          root: {
            stroke: 'hsl(var(--primary))',
          },
        },
        footer: {
          root: {
            backgroundColor: 'hsl(var(--card))',
            borderTop: '1px solid hsl(var(--border))',
          },
        },
        actionsMenu: {
          dropdown: {
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          },
          item: {
            '&:hover': {
              backgroundColor: 'hsl(var(--accent))',
            },
          },
        },
      }}
    >
      <PopoverNotificationCenter
        colorScheme="light"
        onNotificationClick={handleNotificationClick}
        position="bottom-end"
        offset={12}
        showUserPreferences={false}
        footer={() => (
          <div className="p-3 text-center border-t">
            <a
              href="/settings/notifications"
              className="text-sm text-primary hover:underline"
            >
              Notification Settings
            </a>
          </div>
        )}
      >
        {({ unseenCount }) => <NotificationBell unseenCount={unseenCount} />}
      </PopoverNotificationCenter>
    </NovuProvider>
  );
}

export default NotificationInbox;
