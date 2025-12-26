/**
 * AlertBatchActions Component
 *
 * Toolbar for batch operations on selected alerts:
 * - Mark as read
 * - Assign to user
 * - Mute alert type
 * - Escalate
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

export interface AlertBatchActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onMarkAsRead: () => Promise<void>;
  onAssign: (assignee: string) => Promise<void>;
  onMute: (duration: 'day' | 'week' | 'forever') => Promise<void>;
  onEscalate: () => Promise<void>;
  onDismissAll: () => Promise<void>;
}

// Mock team members - in production, fetch from API
const teamMembers = [
  { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
  { id: 'user-2', name: 'Jane Smith', email: 'jane@example.com' },
  { id: 'user-3', name: 'Bob Wilson', email: 'bob@example.com' },
];

export const AlertBatchActions: React.FC<AlertBatchActionsProps> = ({
  selectedCount,
  onClearSelection,
  onMarkAsRead,
  onAssign,
  onMute,
  onEscalate,
  onDismissAll,
}) => {
  const [assignAnchor, setAssignAnchor] = useState<null | HTMLElement>(null);
  const [muteAnchor, setMuteAnchor] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: string, fn: () => Promise<void>) => {
    setLoading(action);
    try {
      await fn();
    } finally {
      setLoading(null);
    }
  };

  const handleAssign = async (userId: string) => {
    setAssignAnchor(null);
    await handleAction('assign', () => onAssign(userId));
  };

  const handleMute = async (duration: 'day' | 'week' | 'forever') => {
    setMuteAnchor(null);
    await handleAction('mute', () => onMute(duration));
  };

  if (selectedCount === 0) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1.5,
        bgcolor: 'primary.50',
        borderRadius: 1,
        mb: 2,
        flexWrap: 'wrap',
      }}
    >
      {/* Selection Count */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
        <Chip
          label={`${selectedCount} selected`}
          color="primary"
          size="small"
          onDelete={onClearSelection}
        />
      </Box>

      <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

      {/* Mark as Read */}
      <Button
        size="small"
        variant="outlined"
        startIcon={loading === 'read' ? <CircularProgress size={16} /> : <DoneAllIcon />}
        onClick={() => handleAction('read', onMarkAsRead)}
        disabled={loading !== null}
      >
        Mark Read
      </Button>

      {/* Assign */}
      <Button
        size="small"
        variant="outlined"
        startIcon={loading === 'assign' ? <CircularProgress size={16} /> : <PersonAddIcon />}
        endIcon={<KeyboardArrowDownIcon />}
        onClick={(e) => setAssignAnchor(e.currentTarget)}
        disabled={loading !== null}
      >
        Assign
      </Button>
      <Menu
        anchorEl={assignAnchor}
        open={Boolean(assignAnchor)}
        onClose={() => setAssignAnchor(null)}
      >
        <Typography variant="caption" sx={{ px: 2, py: 0.5, display: 'block', color: 'text.secondary' }}>
          Assign to team member
        </Typography>
        <Divider />
        {teamMembers.map((member) => (
          <MenuItem key={member.id} onClick={() => handleAssign(member.id)}>
            <ListItemIcon>
              <PersonAddIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={member.name} secondary={member.email} />
          </MenuItem>
        ))}
      </Menu>

      {/* Mute */}
      <Button
        size="small"
        variant="outlined"
        startIcon={loading === 'mute' ? <CircularProgress size={16} /> : <VolumeOffIcon />}
        endIcon={<KeyboardArrowDownIcon />}
        onClick={(e) => setMuteAnchor(e.currentTarget)}
        disabled={loading !== null}
      >
        Mute
      </Button>
      <Menu
        anchorEl={muteAnchor}
        open={Boolean(muteAnchor)}
        onClose={() => setMuteAnchor(null)}
      >
        <Typography variant="caption" sx={{ px: 2, py: 0.5, display: 'block', color: 'text.secondary' }}>
          Mute similar alerts
        </Typography>
        <Divider />
        <MenuItem onClick={() => handleMute('day')}>
          <ListItemText primary="For 1 day" secondary="Until tomorrow" />
        </MenuItem>
        <MenuItem onClick={() => handleMute('week')}>
          <ListItemText primary="For 1 week" secondary="Until next week" />
        </MenuItem>
        <MenuItem onClick={() => handleMute('forever')}>
          <ListItemText primary="Forever" secondary="Until manually unmuted" />
        </MenuItem>
      </Menu>

      {/* Escalate */}
      <Button
        size="small"
        variant="outlined"
        color="warning"
        startIcon={loading === 'escalate' ? <CircularProgress size={16} /> : <PriorityHighIcon />}
        onClick={() => handleAction('escalate', onEscalate)}
        disabled={loading !== null}
      >
        Escalate
      </Button>

      {/* Dismiss All */}
      <Button
        size="small"
        variant="outlined"
        color="error"
        startIcon={loading === 'dismiss' ? <CircularProgress size={16} /> : <DeleteSweepIcon />}
        onClick={() => handleAction('dismiss', onDismissAll)}
        disabled={loading !== null}
      >
        Dismiss All
      </Button>

      {/* Clear Selection */}
      <Box sx={{ flex: 1 }} />
      <Tooltip title="Clear selection">
        <IconButton size="small" onClick={onClearSelection}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default AlertBatchActions;
