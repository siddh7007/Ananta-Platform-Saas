/**
 * BulkApprovalToolbar Component
 *
 * P1-4: Toolbar for bulk operations on selected vault components.
 * Supports approving, deprecating, and managing 20+ components at once.
 *
 * Features:
 * - Bulk approve/deprecate actions
 * - Selection count display
 * - Loading states during operations
 * - Confirmation for destructive actions
 * - Accessibility support
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  Snackbar,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArchiveIcon from '@mui/icons-material/Archive';
import PendingIcon from '@mui/icons-material/Pending';
import CloseIcon from '@mui/icons-material/Close';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import DeselectIcon from '@mui/icons-material/Deselect';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { VaultStage } from '../discovery/SendToVaultDrawer';
import type { VaultComponent } from './VaultComponentCard';

/** Performance warning threshold */
const LARGE_SELECTION_WARNING = 50;

/** Threshold for requiring confirmation dialog */
const BULK_CONFIRMATION_THRESHOLD = 10;

/** Allowed stage values for validation */
const ALLOWED_STAGES: VaultStage[] = ['pending', 'approved', 'deprecated'];

export interface BulkApprovalToolbarProps {
  /** Currently selected component IDs */
  selectedIds: Set<string>;
  /** All components available for selection */
  components: VaultComponent[];
  /** Clear all selections */
  onClearSelection: () => void;
  /** Select all components in a stage */
  onSelectAllInStage: (stage: VaultStage) => void;
  /** Bulk update stage for selected components */
  onBulkStageChange: (ids: string[], newStage: VaultStage) => Promise<void>;
  /** Whether bulk operation is in progress */
  loading?: boolean;
}

export function BulkApprovalToolbar({
  selectedIds,
  components,
  onClearSelection,
  onSelectAllInStage,
  onBulkStageChange,
  loading = false,
}: BulkApprovalToolbarProps) {
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: VaultStage | null;
  }>({ open: false, action: null });
  const [actionLoading, setActionLoading] = useState<VaultStage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = selectedIds.size;

  // Memoize expensive filtering calculations
  const { pendingSelected, approvedSelected, deprecatedSelected } = useMemo(() => {
    const selected = components.filter((c) => selectedIds.has(c.id));
    return {
      pendingSelected: selected.filter((c) => c.stage === 'pending').length,
      approvedSelected: selected.filter((c) => c.stage === 'approved').length,
      deprecatedSelected: selected.filter((c) => c.stage === 'deprecated').length,
    };
  }, [components, selectedIds]);

  // Count all components by stage for "Select All" functionality
  const pendingTotal = useMemo(
    () => components.filter((c) => c.stage === 'pending').length,
    [components]
  );

  if (selectedCount === 0) return null;

  const handleBulkAction = async (newStage: VaultStage) => {
    // Validate stage parameter
    if (!ALLOWED_STAGES.includes(newStage)) {
      setError(`Invalid stage: ${newStage}`);
      return;
    }

    // Show confirmation for large selections or stage changes that might be irreversible
    if (selectedCount >= BULK_CONFIRMATION_THRESHOLD || newStage === 'deprecated') {
      setConfirmDialog({ open: true, action: newStage });
      return;
    }

    await executeBulkAction(newStage);
  };

  const executeBulkAction = async (newStage: VaultStage) => {
    setActionLoading(newStage);
    setError(null);
    try {
      // Validate IDs exist in components list for security
      const validIds = Array.from(selectedIds)
        .filter((id) => components.some((c) => c.id === id))
        .sort(); // Sort for consistent ordering

      if (validIds.length === 0) {
        throw new Error('No valid components selected');
      }

      await onBulkStageChange(validIds, newStage);
      onClearSelection();
      setConfirmDialog({ open: false, action: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update components';
      setError(message);
      console.error('Bulk action failed:', err);
      // Don't clear selection on error so user can retry
    } finally {
      setActionLoading(null);
    }
  };

  const getActionLabel = (stage: VaultStage): string => {
    switch (stage) {
      case 'approved':
        return 'Approve';
      case 'deprecated':
        return 'Deprecate';
      case 'pending':
        return 'Move to Pending';
      default:
        return 'Update';
    }
  };

  const getActionIcon = (stage: VaultStage) => {
    switch (stage) {
      case 'approved':
        return <CheckCircleIcon />;
      case 'deprecated':
        return <ArchiveIcon />;
      case 'pending':
        return <PendingIcon />;
      default:
        return null;
    }
  };

  const isLargeSelection = selectedCount >= LARGE_SELECTION_WARNING;

  return (
    <>
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
        role="toolbar"
        aria-label="Bulk approval actions"
      >
        {/* Selection Count */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
          <Chip
            label={`${selectedCount} selected`}
            color="primary"
            size="small"
            onDelete={onClearSelection}
            aria-label={`${selectedCount} components selected, click to clear`}
          />
          {isLargeSelection && (
            <Tooltip title="Large selection may take longer to process">
              <WarningAmberIcon color="warning" fontSize="small" />
            </Tooltip>
          )}
        </Box>

        {/* Selection breakdown */}
        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
          ({pendingSelected} pending, {approvedSelected} approved, {deprecatedSelected} deprecated)
        </Typography>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {/* Quick select buttons */}
        {pendingTotal > 0 && (
          <Tooltip title={`Select all ${pendingTotal} pending components`}>
            <Button
              size="small"
              variant="text"
              startIcon={<SelectAllIcon />}
              onClick={() => onSelectAllInStage('pending')}
              disabled={loading}
            >
              All Pending
            </Button>
          </Tooltip>
        )}

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {/* Bulk Approve - only for pending components */}
        <Button
          size="small"
          variant="contained"
          color="success"
          startIcon={
            actionLoading === 'approved' ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <CheckCircleIcon />
            )
          }
          onClick={() => handleBulkAction('approved')}
          disabled={loading || actionLoading !== null || pendingSelected === 0}
          aria-label={`Approve ${pendingSelected} pending components`}
        >
          Approve {pendingSelected > 0 ? `(${pendingSelected})` : ''}
        </Button>

        {/* Bulk Deprecate */}
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          startIcon={
            actionLoading === 'deprecated' ? (
              <CircularProgress size={16} />
            ) : (
              <ArchiveIcon />
            )
          }
          onClick={() => handleBulkAction('deprecated')}
          disabled={loading || actionLoading !== null || deprecatedSelected === selectedCount}
          aria-label={`Deprecate ${selectedCount - deprecatedSelected} components`}
        >
          Deprecate
        </Button>

        {/* Move to Pending - for approved/deprecated components */}
        {(approvedSelected > 0 || deprecatedSelected > 0) && (
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={
              actionLoading === 'pending' ? (
                <CircularProgress size={16} />
              ) : (
                <PendingIcon />
              )
            }
            onClick={() => handleBulkAction('pending')}
            disabled={loading || actionLoading !== null}
            aria-label={`Move ${approvedSelected + deprecatedSelected} components to pending`}
          >
            To Pending
          </Button>
        )}

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* Clear Selection */}
        <Tooltip title="Clear selection">
          <IconButton
            size="small"
            onClick={onClearSelection}
            aria-label="Clear selection"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => {
          if (actionLoading === null) {
            setConfirmDialog({ open: false, action: null });
          }
        }}
        maxWidth="sm"
        fullWidth
        aria-labelledby="bulk-confirm-title"
        aria-describedby="bulk-confirm-description"
      >
        <DialogTitle id="bulk-confirm-title">
          Confirm Bulk {confirmDialog.action ? getActionLabel(confirmDialog.action) : 'Action'}
        </DialogTitle>
        <DialogContent>
          {isLargeSelection && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              You are about to update {selectedCount} components. This may take a moment.
            </Alert>
          )}

          <Typography variant="body2" gutterBottom>
            Are you sure you want to {confirmDialog.action ? getActionLabel(confirmDialog.action).toLowerCase() : 'update'}{' '}
            <strong>{selectedCount}</strong> component{selectedCount !== 1 ? 's' : ''}?
          </Typography>

          {confirmDialog.action === 'deprecated' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Deprecated components will be archived and may no longer appear in active searches.
            </Alert>
          )}

          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Selection breakdown:
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
              {pendingSelected > 0 && (
                <Chip label={`${pendingSelected} pending`} size="small" color="warning" variant="outlined" />
              )}
              {approvedSelected > 0 && (
                <Chip label={`${approvedSelected} approved`} size="small" color="success" variant="outlined" />
              )}
              {deprecatedSelected > 0 && (
                <Chip label={`${deprecatedSelected} deprecated`} size="small" variant="outlined" />
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDialog({ open: false, action: null })}
            disabled={actionLoading !== null}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color={confirmDialog.action === 'approved' ? 'success' : confirmDialog.action === 'deprecated' ? 'inherit' : 'warning'}
            onClick={() => confirmDialog.action && executeBulkAction(confirmDialog.action)}
            disabled={actionLoading !== null}
            startIcon={
              actionLoading !== null ? (
                <CircularProgress size={16} color="inherit" />
              ) : confirmDialog.action ? (
                getActionIcon(confirmDialog.action)
              ) : null
            }
          >
            {confirmDialog.action ? getActionLabel(confirmDialog.action) : 'Confirm'} {selectedCount} Components
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Snackbar */}
      <Snackbar
        open={error !== null}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setError(null)}
          severity="error"
          sx={{ width: '100%' }}
          role="alert"
        >
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}

export default BulkApprovalToolbar;
