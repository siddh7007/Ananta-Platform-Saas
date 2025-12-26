/**
 * VaultKanban Component
 *
 * Main kanban board for component vault stages.
 * Supports drag-and-drop between stages.
 */

import React, { useState } from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { VaultStageColumn } from './VaultStageColumn';
import type { VaultComponent } from './VaultComponentCard';
import type { VaultStage } from '../discovery/SendToVaultDrawer';

interface VaultKanbanProps {
  components: VaultComponent[];
  loading?: boolean;
  error?: string | null;
  onStageChange: (componentId: string, newStage: VaultStage) => Promise<void>;
  onViewDetails: (component: VaultComponent) => void;
  onAddComponent?: (stage: VaultStage) => void;
}

const STAGES: VaultStage[] = ['pending', 'approved', 'deprecated'];

export function VaultKanban({
  components,
  loading = false,
  error = null,
  onStageChange,
  onViewDetails,
  onAddComponent,
}: VaultKanbanProps) {
  const [draggedComponent, setDraggedComponent] = useState<VaultComponent | null>(
    null
  );
  const [updating, setUpdating] = useState(false);

  // Group components by stage
  const componentsByStage = STAGES.reduce(
    (acc, stage) => {
      acc[stage] = components.filter((c) => c.stage === stage);
      return acc;
    },
    {} as Record<VaultStage, VaultComponent[]>
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
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onAddComponent={onAddComponent}
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
