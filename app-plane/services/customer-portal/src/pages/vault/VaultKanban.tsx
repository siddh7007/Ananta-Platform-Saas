/**
 * VaultKanban Component
 *
 * Main kanban board for component vault stages.
 * Supports drag-and-drop between stages.
 *
 * P1-4: Added bulk selection and approval support.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Typography, Alert, CircularProgress, Button, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { VaultStageColumn } from './VaultStageColumn';
import { BulkApprovalToolbar } from './BulkApprovalToolbar';
import type { VaultComponent } from './VaultComponentCard';
import type { VaultStage } from '../discovery/SendToVaultDrawer';

interface VaultKanbanProps {
  components: VaultComponent[];
  loading?: boolean;
  error?: string | null;
  onStageChange: (componentId: string, newStage: VaultStage) => Promise<void>;
  /** P1-4: Bulk stage change for multiple components */
  onBulkStageChange?: (componentIds: string[], newStage: VaultStage) => Promise<void>;
  onViewDetails: (component: VaultComponent) => void;
  onAddComponent?: (stage: VaultStage) => void;
}

const STAGES: VaultStage[] = ['pending', 'approved', 'deprecated'];

export function VaultKanban({
  components,
  loading = false,
  error = null,
  onStageChange,
  onBulkStageChange,
  onViewDetails,
  onAddComponent,
}: VaultKanbanProps) {
  const [draggedComponent, setDraggedComponent] = useState<VaultComponent | null>(
    null
  );
  const [updating, setUpdating] = useState(false);

  // P1-4: Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Toggle individual component selection
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select/deselect all components in a stage
  const handleSelectAllInStage = useCallback((stage: VaultStage) => {
    const stageComponents = components.filter((c) => c.stage === stage);
    const stageIds = stageComponents.map((c) => c.id);

    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = stageIds.every((id) => next.has(id));

      if (allSelected) {
        // Deselect all in stage
        stageIds.forEach((id) => next.delete(id));
      } else {
        // Select all in stage
        stageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [components]);

  // Clear all selections
  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Handle bulk stage change
  const handleBulkStageChange = useCallback(async (ids: string[], newStage: VaultStage) => {
    if (onBulkStageChange) {
      await onBulkStageChange(ids, newStage);
    } else {
      // Fallback: update one by one if no bulk handler provided
      setUpdating(true);
      const errors: Array<{ id: string; error: Error }> = [];
      try {
        for (const id of ids) {
          try {
            await onStageChange(id, newStage);
          } catch (err) {
            errors.push({ id, error: err as Error });
          }
        }
        // Report partial failures
        if (errors.length > 0) {
          throw new Error(`Failed to update ${errors.length} of ${ids.length} components`);
        }
      } finally {
        setUpdating(false);
      }
    }
  }, [onBulkStageChange, onStageChange]);

  // Toggle selection mode
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    if (selectionMode) {
      // Clear selections when exiting selection mode
      setSelectedIds(new Set());
    }
  }, [selectionMode]);

  // Group components by stage (memoized for performance)
  const componentsByStage = useMemo(
    () =>
      STAGES.reduce(
        (acc, stage) => {
          acc[stage] = components.filter((c) => c.stage === stage);
          return acc;
        },
        {} as Record<VaultStage, VaultComponent[]>
      ),
    [components]
  );

  const handleDragStart = (component: VaultComponent) => {
    setDraggedComponent(component);
  };

  const handleDrop = async (targetStage: VaultStage) => {
    if (!draggedComponent || draggedComponent.stage === targetStage) {
      setDraggedComponent(null);
      return;
    }

    setUpdating(true);
    try {
      await onStageChange(draggedComponent.id, targetStage);
    } catch (err) {
      console.error('Failed to update stage', err);
    } finally {
      setUpdating(false);
      setDraggedComponent(null);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      {/* P1-4: Selection mode toggle and bulk toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Tooltip title={selectionMode ? 'Exit bulk selection mode' : 'Enter bulk selection mode'}>
          <Button
            variant={selectionMode ? 'contained' : 'outlined'}
            size="small"
            startIcon={selectionMode ? <DragIndicatorIcon /> : <EditIcon />}
            onClick={toggleSelectionMode}
          >
            {selectionMode ? 'Done Selecting' : 'Bulk Select'}
          </Button>
        </Tooltip>
        {!selectionMode && (
          <Typography variant="caption" color="text.secondary">
            Drag components between stages or use bulk select for multiple updates
          </Typography>
        )}
      </Box>

      {/* P1-4: Bulk approval toolbar */}
      {selectionMode && (
        <BulkApprovalToolbar
          selectedIds={selectedIds}
          components={components}
          onClearSelection={handleClearSelection}
          onSelectAllInStage={handleSelectAllInStage}
          onBulkStageChange={handleBulkStageChange}
          loading={updating}
        />
      )}

      {/* Updating overlay */}
      {updating && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(255,255,255,0.7)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress size={32} />
        </Box>
      )}

      {/* Kanban Board */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          overflow: 'auto',
          pb: 2,
          minHeight: 500,
        }}
      >
        {STAGES.map((stage) => (
          <VaultStageColumn
            key={stage}
            stage={stage}
            components={componentsByStage[stage]}
            onViewDetails={onViewDetails}
            onDragStart={selectionMode ? undefined : handleDragStart}
            onDrop={selectionMode ? undefined : handleDrop}
            onAddComponent={onAddComponent}
            selectable={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAllInStage={handleSelectAllInStage}
          />
        ))}
      </Box>

      {/* Summary Stats */}
      <Box
        sx={{
          display: 'flex',
          gap: 3,
          mt: 2,
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 1,
        }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary">
            Total Components
          </Typography>
          <Typography variant="h6" fontWeight={600}>
            {components.length}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Pending Review
          </Typography>
          <Typography variant="h6" fontWeight={600} color="warning.main">
            {componentsByStage.pending.length}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Approved
          </Typography>
          <Typography variant="h6" fontWeight={600} color="success.main">
            {componentsByStage.approved.length}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Deprecated
          </Typography>
          <Typography variant="h6" fontWeight={600} color="text.secondary">
            {componentsByStage.deprecated.length}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default VaultKanban;
