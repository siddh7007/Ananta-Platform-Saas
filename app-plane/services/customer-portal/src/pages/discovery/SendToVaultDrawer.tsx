/**
 * SendToVaultDrawer Component
 *
 * Drawer for vaulting components with reviewer, due date, notes.
 * Captures review metadata before sending to vault.
 */

import React, { useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import MemoryIcon from '@mui/icons-material/Memory';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import NotesIcon from '@mui/icons-material/Notes';
import type { ComparisonComponent } from './ComparisonTray';

export type VaultStage = 'pending' | 'approved' | 'deprecated';

interface SendToVaultDrawerProps {
  open: boolean;
  onClose: () => void;
  components: ComparisonComponent[];
  onSubmit: (data: VaultSubmission) => Promise<void>;
  reviewers?: { id: string; name: string; email: string }[];
}

export interface VaultSubmission {
  componentIds: string[];
  reviewerId: string;
  dueDate: Date | null;
  notes: string;
  stage: VaultStage;
  priority: 'low' | 'medium' | 'high';
}

const DEFAULT_REVIEWERS = [
  { id: '1', name: 'John Smith', email: 'john@example.com' },
  { id: '2', name: 'Sarah Johnson', email: 'sarah@example.com' },
  { id: '3', name: 'Mike Chen', email: 'mike@example.com' },
];

export function SendToVaultDrawer({
  open,
  onClose,
  components,
  onSubmit,
  reviewers = DEFAULT_REVIEWERS,
}: SendToVaultDrawerProps) {
  const [reviewerId, setReviewerId] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [stage, setStage] = useState<VaultStage>('pending');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reviewerId) {
      setError('Please select a reviewer');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        componentIds: components.map((c) => c.id),
        reviewerId,
        dueDate,
        notes,
        stage,
        priority,
      });
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit to vault');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReviewerId('');
    setDueDate(null);
    setNotes('');
    setStage('pending');
    setPriority('medium');
    setError(null);
    onClose();
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{ sx: { width: 420 } }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SendIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Send to Vault
            </Typography>
          </Box>
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {/* Selected Components */}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Components ({components.length})
          </Typography>
          <List dense sx={{ mb: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            {components.map((comp) => (
              <ListItem key={comp.id}>
                <ListItemAvatar>
                  <Avatar src={comp.image_url}>
                    <MemoryIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={comp.mpn}
                  secondary={comp.manufacturer}
                  primaryTypographyProps={{ fontWeight: 600 }}
                />
                {comp.quality_score && (
                  <Chip
                    label={`${comp.quality_score}%`}
                    size="small"
                    color={
                      comp.quality_score >= 95
                        ? 'success'
                        : comp.quality_score >= 70
                          ? 'warning'
                          : 'error'
                    }
                  />
                )}
              </ListItem>
            ))}
          </List>

          <Divider sx={{ my: 2 }} />

          {/* Reviewer Selection */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PersonIcon color="action" />
            <Typography variant="subtitle2">Reviewer</Typography>
          </Box>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Select Reviewer *</InputLabel>
            <Select
              value={reviewerId}
              label="Select Reviewer *"
              onChange={(e) => setReviewerId(e.target.value)}
            >
              {reviewers.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  <Box>
                    <Typography variant="body2">{r.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.email}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Due Date */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CalendarTodayIcon color="action" />
            <Typography variant="subtitle2">Due Date</Typography>
          </Box>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Review Due Date"
              value={dueDate}
              onChange={(date) => setDueDate(date)}
              slotProps={{
                textField: { fullWidth: true, sx: { mb: 3 } },
              }}
            />
          </LocalizationProvider>

          {/* Stage & Priority */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Initial Stage</InputLabel>
              <Select
                value={stage}
                label="Initial Stage"
                onChange={(e) => setStage(e.target.value as VaultStage)}
              >
                <MenuItem value="pending">Pending Review</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="deprecated">Deprecated</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                label="Priority"
                onChange={(e) =>
                  setPriority(e.target.value as 'low' | 'medium' | 'high')
                }
              >
                <MenuItem value="low">
                  <Chip label="Low" size="small" />
                </MenuItem>
                <MenuItem value="medium">
                  <Chip label="Medium" size="small" color="warning" />
                </MenuItem>
                <MenuItem value="high">
                  <Chip label="High" size="small" color="error" />
                </MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Notes */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <NotesIcon color="action" />
            <Typography variant="subtitle2">Notes</Typography>
          </Box>
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="Add review notes, context, or special instructions..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {/* Error Display */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>

        {/* Footer Actions */}
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            gap: 2,
          }}
        >
          <Button variant="outlined" fullWidth onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="contained"
            fullWidth
            onClick={handleSubmit}
            disabled={submitting || components.length === 0}
            startIcon={<SendIcon />}
          >
            {submitting ? 'Sending...' : 'Send to Vault'}
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}

export default SendToVaultDrawer;
