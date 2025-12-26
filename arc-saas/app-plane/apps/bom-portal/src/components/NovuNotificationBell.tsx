/**
 * Novu Notification Bell Component
 *
 * Real-time notification bell that integrates with Novu's in-app notification center.
 * Shows unread count badge and opens a popover with recent notifications.
 */

import React from 'react';
import {
  NovuProvider,
  PopoverNotificationCenter,
  NotificationBell,
  IMessage,
} from '@novu/notification-center';
import { useNavigate } from 'react-router-dom';
import { Box, Tooltip } from '@mui/material';

// Environment variables for Novu configuration
const NOVU_APP_IDENTIFIER = import.meta.env.VITE_NOVU_APP_IDENTIFIER;
const NOVU_BACKEND_URL = import.meta.env.VITE_NOVU_BACKEND_URL || 'http://localhost:27850';
const NOVU_SOCKET_URL = import.meta.env.VITE_NOVU_SOCKET_URL || 'http://localhost:27851';

interface NovuNotificationBellProps {
  /**
   * Current user ID (subscriber ID in Novu)
   */
  userId: string;
  /**
   * Optional custom styles for the bell container
   */
  containerStyle?: React.CSSProperties;
  /**
   * Color scheme for the notification center
   */
  colorScheme?: 'light' | 'dark';
}

/**
 * NovuNotificationBell - Real-time notification bell with popover
 *
 * Usage:
 * ```tsx
 * <NovuNotificationBell userId={user.id} />
 * ```
 *
 * Environment variables required:
 * - VITE_NOVU_APP_IDENTIFIER: Novu application identifier
 * - VITE_NOVU_BACKEND_URL: Novu API URL (default: http://localhost:27850)
 * - VITE_NOVU_SOCKET_URL: Novu WebSocket URL (default: http://localhost:27851)
 */
export const NovuNotificationBell: React.FC<NovuNotificationBellProps> = ({
  userId,
  containerStyle,
  colorScheme = 'light',
}) => {
  const navigate = useNavigate();

  // Don't render if Novu is not configured or no user
  if (!NOVU_APP_IDENTIFIER || !userId) {
    return null;
  }

  /**
   * Handle notification click - navigate based on payload
   */
  const handleNotificationClick = (notification: IMessage) => {
    const payload = notification.payload as Record<string, unknown>;

    // Navigate based on notification type
    if (payload?.component_id) {
      navigate(`/components/${payload.component_id}`);
    } else if (payload?.bom_id) {
      navigate(`/boms/${payload.bom_id}`);
    } else if (payload?.project_id) {
      navigate(`/projects/${payload.project_id}`);
    } else if (payload?.alert_id) {
      navigate(`/alerts?id=${payload.alert_id}`);
    } else {
      // Default: open full alert center
      navigate('/alerts');
    }
  };

  /**
   * Custom footer with link to full alert history
   */
  const renderFooter = () => (
    <Box
      sx={{
        p: 1.5,
        textAlign: 'center',
        borderTop: '1px solid',
        borderColor: 'divider',
        cursor: 'pointer',
        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
      onClick={() => navigate('/alerts')}
    >
      View All Alerts →
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', ...containerStyle }}>
      <NovuProvider
        subscriberId={userId}
        applicationIdentifier={NOVU_APP_IDENTIFIER}
        backendUrl={NOVU_BACKEND_URL}
        socketUrl={NOVU_SOCKET_URL}
      >
        <PopoverNotificationCenter
          colorScheme={colorScheme}
          onNotificationClick={handleNotificationClick}
          footer={renderFooter}
          listItem={(notification, handleActionButtonClick, handleNotificationClick) => (
            <Box
              key={notification._id}
              sx={{
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                cursor: 'pointer',
                bgcolor: notification.read
                  ? 'transparent'
                  : 'action.selected',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
              onClick={() => handleNotificationClick()}
            >
              <Box sx={{ fontWeight: notification.read ? 400 : 600, mb: 0.5 }}>
                {notification.payload?.title as string || 'Notification'}
              </Box>
              <Box sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                {notification.payload?.message as string || (typeof notification.content === 'string' ? notification.content : '')}
              </Box>
              <Box sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.5 }}>
                {new Date(notification.createdAt).toLocaleString()}
              </Box>
            </Box>
          )}
        >
          {({ unseenCount }) => (
            <Tooltip title={unseenCount > 0 ? `${unseenCount} unread notifications` : 'Notifications'}>
              <Box sx={{ position: 'relative' }}>
                <NotificationBell unseenCount={unseenCount} />
              </Box>
            </Tooltip>
          )}
        </PopoverNotificationCenter>
      </NovuProvider>
    </Box>
  );
};

/**
 * Hook to get Novu configuration status
 */
export const useNovuConfig = () => {
  return {
    isConfigured: Boolean(NOVU_APP_IDENTIFIER),
    appIdentifier: NOVU_APP_IDENTIFIER,
    backendUrl: NOVU_BACKEND_URL,
    socketUrl: NOVU_SOCKET_URL,
  };
};

export default NovuNotificationBell;
