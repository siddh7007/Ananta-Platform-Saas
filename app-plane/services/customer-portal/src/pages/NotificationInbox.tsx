/**
 * Notification Inbox Page
 *
 * Full-page view of all Novu notifications with filtering and management.
 * Accessible via /inbox route.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Tooltip,
  Badge,
  Paper,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import RefreshIcon from '@mui/icons-material/Refresh';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import ErrorIcon from '@mui/icons-material/Error';
import SettingsIcon from '@mui/icons-material/Settings';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAuth0 } from '@auth0/auth0-react';
import { supabase } from '../providers/dataProvider';

// Notification types
interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  payload?: Record<string, unknown>;
}

// Mock notifications for development
const mockNotifications: Notification[] = [
  {
    id: '1',
    title: 'BOM Upload Complete',
    message: 'Your BOM "PCB-Assembly-v2.xlsx" has been processed successfully.',
    type: 'success',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    payload: { bom_id: 'bom-123' },
  },
  {
    id: '2',
    title: 'Component Risk Alert',
    message: 'STM32F103C8T6 has been flagged as high risk due to supply chain issues.',
    type: 'warning',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    payload: { component_id: 'comp-456' },
  },
  {
    id: '3',
    title: 'Enrichment Complete',
    message: '42 components enriched with pricing and availability data.',
    type: 'info',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: '4',
    title: 'Team Member Joined',
    message: 'Sarah Johnson has accepted your invitation and joined the team.',
    type: 'success',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: '5',
    title: 'Subscription Renewal',
    message: 'Your Professional plan will renew in 7 days.',
    type: 'info',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
];

const typeIcons: Record<string, React.ReactNode> = {
  info: <InfoIcon color="info" />,
  success: <CheckCircleIcon color="success" />,
  warning: <WarningIcon color="warning" />,
  error: <ErrorIcon color="error" />,
};

const typeColors: Record<string, string> = {
  info: 'info.light',
  success: 'success.light',
  warning: 'warning.light',
  error: 'error.light',
};

export const NotificationInbox: React.FC = () => {
  const navigate = useNavigate();
  const { user: auth0User, isAuthenticated } = useAuth0();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0); // 0 = All, 1 = Unread, 2 = Read
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Calculate counts
  const unreadCount = notifications.filter(n => !n.read).length;
  const readCount = notifications.filter(n => n.read).length;

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      setError(null);
      // In production, this would fetch from Novu API
      // For now, use mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      setNotifications(mockNotifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Filter notifications based on tab
  const filteredNotifications = notifications.filter(n => {
    if (tabValue === 1) return !n.read;
    if (tabValue === 2) return n.read;
    return true;
  });

  // Mark single notification as read
  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  // Mark all as read
  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Delete notification
  const handleDelete = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // Clear all read
  const handleClearRead = () => {
    setNotifications(prev => prev.filter(n => !n.read));
  };

  // Handle notification click - navigate based on payload
  const handleNotificationClick = (notification: Notification) => {
    setSelectedId(notification.id);
    handleMarkAsRead(notification.id);

    const payload = notification.payload;
    if (payload?.bom_id) {
      navigate(`/boms/${payload.bom_id}`);
    } else if (payload?.component_id) {
      navigate(`/components/${payload.component_id}`);
    }
  };

  // Refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  // Format relative time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Badge badgeContent={unreadCount} color="error">
            <NotificationsActiveIcon sx={{ fontSize: 32 }} color="primary" />
          </Badge>
          <Box>
            <Typography variant="h4">Inbox</Typography>
            <Typography variant="body2" color="text.secondary">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<DoneAllIcon />}
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            size="small"
          >
            Mark All Read
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteSweepIcon />}
            onClick={handleClearRead}
            disabled={readCount === 0}
            size="small"
          >
            Clear Read
          </Button>
          <Button
            variant="contained"
            startIcon={<SettingsIcon />}
            onClick={() => navigate('/alerts/preferences')}
            size="small"
          >
            Preferences
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          aria-label="notification filters"
        >
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                All
                <Chip label={notifications.length} size="small" />
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Unread
                <Chip label={unreadCount} size="small" color="error" />
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Read
                <Chip label={readCount} size="small" />
              </Box>
            }
          />
        </Tabs>
      </Paper>

      {/* Notification List */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {filteredNotifications.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <NotificationsIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No notifications
              </Typography>
              <Typography variant="body2" color="text.disabled">
                {tabValue === 1 ? "You're all caught up!" : 'No notifications yet'}
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {filteredNotifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    disablePadding
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {!notification.read && (
                          <Tooltip title="Mark as read">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notification.id);
                              }}
                            >
                              <MarkEmailReadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(notification.id);
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    }
                  >
                    <ListItemButton
                      onClick={() => handleNotificationClick(notification)}
                      selected={selectedId === notification.id}
                      sx={{
                        py: 2,
                        bgcolor: notification.read ? 'transparent' : 'action.hover',
                        borderLeft: notification.read ? 'none' : '4px solid',
                        borderColor: typeColors[notification.type],
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 48 }}>
                        {typeIcons[notification.type]}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                              variant="subtitle2"
                              fontWeight={notification.read ? 400 : 600}
                            >
                              {notification.title}
                            </Typography>
                            {!notification.read && (
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  bgcolor: 'primary.main',
                                }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                              {notification.message}
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                              {formatTime(notification.createdAt)}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default NotificationInbox;
