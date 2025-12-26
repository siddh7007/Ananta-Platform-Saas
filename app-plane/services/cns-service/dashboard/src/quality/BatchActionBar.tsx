/**
 * Batch Action Bar Component
 *
 * Floating action bar for batch operations on selected items.
 */

import React from 'react';
import {
  Paper,
  Stack,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Slide,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Close as CloseIcon,
  SelectAll as SelectAllIcon,
} from '@mui/icons-material';

export interface BatchActionBarProps {
  selectedCount: number;
  totalCount: number;
  processing: boolean;
  onApproveSelected: () => void;
  onRejectSelected: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedCount,
  totalCount,
  processing,
  onApproveSelected,
  onRejectSelected,
  onSelectAll,
  onClearSelection,
}) => {
  const isVisible = selectedCount > 0;

  return (
    <Slide direction="up" in={isVisible} mountOnEnter unmountOnExit>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          px: 3,
          py: 1.5,
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          zIndex: 1300,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          {/* Selection Count */}
          <Typography variant="body2" fontWeight={600} sx={{ minWidth: 120 }}>
            {selectedCount} of {totalCount} selected
          </Typography>

          {/* Select All */}
          {selectedCount < totalCount && (
            <Tooltip title="Select All (Ctrl+A)">
              <Button
                size="small"
                startIcon={<SelectAllIcon />}
                onClick={onSelectAll}
                disabled={processing}
              >
                Select All
              </Button>
            </Tooltip>
          )}

          {/* Approve Selected */}
          <Tooltip title="Approve Selected (Shift+A)">
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={processing ? <CircularProgress size={16} /> : <ApproveIcon />}
              onClick={onApproveSelected}
              disabled={processing}
            >
              Approve {selectedCount}
            </Button>
          </Tooltip>

          {/* Reject Selected */}
          <Tooltip title="Reject Selected (Shift+R)">
            <Button
              variant="contained"
              color="error"
              size="small"
              startIcon={<RejectIcon />}
              onClick={onRejectSelected}
              disabled={processing}
            >
              Reject {selectedCount}
            </Button>
          </Tooltip>

          {/* Clear Selection */}
          <Tooltip title="Clear Selection (Esc)">
            <IconButton size="small" onClick={onClearSelection} disabled={processing}>
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>
    </Slide>
  );
};

export default BatchActionBar;
