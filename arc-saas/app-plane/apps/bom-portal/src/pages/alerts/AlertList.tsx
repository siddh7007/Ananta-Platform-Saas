/**
 * AlertList Component
 *
 * Displays a list of alerts with empty state handling for different tabs.
 * Uses AlertListItem for individual alert rendering.
 */

import React from 'react';
import { Box, List, Typography } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import { AlertListItem } from './AlertListItem';
import type { Alert } from '../../services/alertService';

type EmptyStateVariant = 'all' | 'unread' | 'read';

interface AlertListProps {
  alerts: Alert[];
  onMarkAsRead: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
  emptyStateVariant?: EmptyStateVariant;
}

// Empty state configurations
const EMPTY_STATES: Record<EmptyStateVariant, { icon: React.ReactNode; title: string; subtitle: string }> = {
  all: {
    icon: <NotificationsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />,
    title: 'No alerts found',
    subtitle: 'Alerts will appear here when component changes are detected',
  },
  unread: {
    icon: <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />,
    title: 'All caught up!',
    subtitle: 'You have no unread alerts',
  },
  read: {
    icon: <InfoIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />,
    title: 'No read alerts',
    subtitle: 'Alerts you have read will appear here',
  },
};

export function AlertList({
  alerts,
  onMarkAsRead,
  onDismiss,
  emptyStateVariant = 'all',
}: AlertListProps) {
  if (alerts.length === 0) {
    const emptyState = EMPTY_STATES[emptyStateVariant];
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        {emptyState.icon}
        <Typography variant="h6" color="text.secondary">
          {emptyState.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {emptyState.subtitle}
        </Typography>
      </Box>
    );
  }

  return (
    <List disablePadding>
      {alerts.map((alert) => (
        <AlertListItem
          key={alert.id}
          alert={alert}
          onMarkAsRead={onMarkAsRead}
          onDismiss={onDismiss}
        />
      ))}
    </List>
  );
}

export default AlertList;
