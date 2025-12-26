/**
 * AlertDetailPanel Component
 *
 * Right panel showing detailed view of a selected alert with:
 * - Timeline/history
 * - Impacted BOMs
 * - Notes section
 * - SLA badges
 * - Direct links to component/project
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Divider,
  Button,
  IconButton,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Tooltip,
  Avatar,
  Link,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import DescriptionIcon from '@mui/icons-material/Description';
import LinkIcon from '@mui/icons-material/Link';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import NotesIcon from '@mui/icons-material/Notes';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TuneIcon from '@mui/icons-material/Tune';
import PersonIcon from '@mui/icons-material/Person';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, AlertType } from '../../services/alertService';
import { alertTypeColors } from '../../theme';

interface TimelineEvent {
  id: string;
  action: string;
  user: string;
  timestamp: Date;
  details?: string;
}

interface ImpactedBom {
  id: string;
  name: string;
  projectName: string;
  componentCount: number;
}

export interface AlertDetailPanelProps {
  alert: Alert | null;
  onClose: () => void;
  onMarkAsRead: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
  onAssign?: (alertId: string, assignee: string) => void;
  onAddNote?: (alertId: string, note: string) => void;
}

// Mock timeline data - in production, fetch from API
const getMockTimeline = (alert: Alert): TimelineEvent[] => [
  {
    id: '1',
    action: 'Alert created',
    user: 'System',
    timestamp: new Date(alert.created_at),
  },
  ...(alert.is_read
    ? [
        {
          id: '2',
          action: 'Marked as read',
          user: 'Current User',
          timestamp: new Date(),
        },
      ]
    : []),
];

// Mock impacted BOMs - in production, fetch from API
const getMockImpactedBoms = (alert: Alert): ImpactedBom[] => [
  {
    id: 'bom-1',
    name: 'Main Assembly BOM',
    projectName: 'Product X',
    componentCount: 1,
  },
  {
    id: 'bom-2',
    name: 'Power Supply BOM',
    projectName: 'Product Y',
    componentCount: 2,
  },
];

// Calculate SLA status
const getSlaStatus = (alert: Alert): { label: string; color: 'success' | 'warning' | 'error'; hoursRemaining: number } => {
  const createdAt = new Date(alert.created_at);
  const now = new Date();
  const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

  // SLA thresholds based on severity
  const slaHours = alert.severity === 'critical' ? 4 : alert.severity === 'warning' ? 24 : 72;
  const hoursRemaining = Math.max(0, slaHours - hoursSinceCreation);

  if (hoursRemaining <= 0) {
    return { label: 'SLA Breached', color: 'error', hoursRemaining: 0 };
  } else if (hoursRemaining <= slaHours * 0.25) {
    return { label: `${Math.round(hoursRemaining)}h remaining`, color: 'warning', hoursRemaining };
  } else {
    return { label: `${Math.round(hoursRemaining)}h remaining`, color: 'success', hoursRemaining };
  }
};

const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

export const AlertDetailPanel: React.FC<AlertDetailPanelProps> = ({
  alert,
  onClose,
  onMarkAsRead,
  onDismiss,
  onAssign,
  onAddNote,
}) => {
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState<Array<{ text: string; timestamp: Date }>>([]);

  if (!alert) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
          p: 4,
          textAlign: 'center',
        }}
      >
        <Box>
          <WarningIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Select an alert to view details
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Click on any alert in the list to see its timeline, impacted BOMs, and actions
          </Typography>
        </Box>
      </Box>
    );
  }

  const timeline = getMockTimeline(alert);
  const impactedBoms = getMockImpactedBoms(alert);
  const slaStatus = getSlaStatus(alert);
  const alertColor = alertTypeColors[alert.alert_type as AlertType] || '#9e9e9e';

  const handleAddNote = () => {
    if (noteText.trim()) {
      const newNote = { text: noteText.trim(), timestamp: new Date() };
      setNotes([newNote, ...notes]);
      setNoteText('');
      onAddNote?.(alert.id, noteText.trim());
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip
              label={alert.alert_type}
              size="small"
              sx={{
                bgcolor: alertColor,
                color: 'white',
                fontWeight: 600,
                fontSize: '0.7rem',
              }}
            />
            <Chip
              label={alert.severity}
              size="small"
              color={
                alert.severity === 'critical'
                  ? 'error'
                  : alert.severity === 'warning'
                  ? 'warning'
                  : 'info'
              }
              variant="outlined"
            />
            {!alert.is_read && (
              <Chip label="Unread" size="small" color="primary" variant="filled" />
            )}
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {alert.title || `${alert.alert_type} Alert`}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {alert.mpn} • {alert.manufacturer || 'Unknown'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content - Scrollable */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* SLA Badge */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderColor: slaStatus.color === 'error' ? 'error.main' : 'divider',
            bgcolor: slaStatus.color === 'error' ? 'error.50' : 'transparent',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccessTimeIcon color={slaStatus.color} />
            <Box>
              <Typography variant="body2" fontWeight={600}>
                Response SLA
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Based on {alert.severity} severity
              </Typography>
            </Box>
          </Box>
          <Chip
            label={slaStatus.label}
            color={slaStatus.color}
            size="small"
            icon={slaStatus.color === 'error' ? <WarningIcon /> : <CheckCircleIcon />}
          />
        </Paper>

        {/* Alert Message */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Message
          </Typography>
          <Typography variant="body2">{alert.message}</Typography>
        </Box>

        {/* Quick Links */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            <LinkIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            Quick Links
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              component={RouterLink}
              to={`/search?q=${encodeURIComponent(alert.mpn)}`}
              size="small"
              variant="outlined"
            >
              View Component
            </Button>
            <Button
              component={RouterLink}
              to="/alerts/preferences"
              size="small"
              variant="outlined"
              startIcon={<TuneIcon />}
            >
              Adjust Thresholds
            </Button>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Impacted BOMs */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            <DescriptionIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            Impacted BOMs ({impactedBoms.length})
          </Typography>
          <List dense disablePadding>
            {impactedBoms.map((bom) => (
              <ListItem
                key={bom.id}
                component={RouterLink}
                to={`/boms/${bom.id}`}
                sx={{
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  mb: 0.5,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <DescriptionIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={bom.name}
                  secondary={`${bom.projectName} • ${bom.componentCount} component(s) affected`}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
          </List>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Timeline */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            <HistoryIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            Timeline
          </Typography>
          <List dense disablePadding>
            {timeline.map((event, index) => (
              <ListItem key={event.id} sx={{ py: 0.5, px: 0 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: 12 }}>
                    {event.user === 'System' ? 'S' : event.user.charAt(0)}
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={event.action}
                  secondary={`${event.user} • ${formatRelativeTime(event.timestamp)}`}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
          </List>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Notes Section */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            <NotesIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            Notes
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Add a note..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
            />
            <Button variant="contained" size="small" onClick={handleAddNote} disabled={!noteText.trim()}>
              Add
            </Button>
          </Box>
          {notes.length > 0 && (
            <List dense disablePadding>
              {notes.map((note, index) => (
                <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
                  <ListItemText
                    primary={note.text}
                    secondary={formatRelativeTime(note.timestamp)}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              ))}
            </List>
          )}
          {notes.length === 0 && (
            <Typography variant="caption" color="text.disabled">
              No notes yet
            </Typography>
          )}
        </Box>
      </Box>

      {/* Footer Actions */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end',
        }}
      >
        {!alert.is_read && (
          <Button variant="outlined" size="small" onClick={() => onMarkAsRead(alert.id)}>
            Mark as Read
          </Button>
        )}
        <Button
          variant="outlined"
          size="small"
          color="error"
          onClick={() => onDismiss(alert.id)}
        >
          Dismiss
        </Button>
      </Box>
    </Box>
  );
};

export default AlertDetailPanel;
