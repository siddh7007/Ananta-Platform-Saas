/**
 * VaultStageColumn
 *
 * Kanban column for a vault stage (Pending/Approved/Deprecated).
 * Supports drag-and-drop of component cards.
 */

import React from 'react';
import { Box, Typography, Paper, Chip, Button, alpha, Checkbox, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PendingIcon from '@mui/icons-material/Pending';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArchiveIcon from '@mui/icons-material/Archive';
import { VaultComponentCard, type VaultComponent } from './VaultComponentCard';
import type { VaultStage } from '../discovery/SendToVaultDrawer';

interface VaultStageColumnProps {
  stage: VaultStage;
  components: VaultComponent[];
  onViewDetails: (component: VaultComponent) => void;
  onDragStart?: (component: VaultComponent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (stage: VaultStage, e: React.DragEvent) => void;
  onAddComponent?: (stage: VaultStage) => void;
  /** P1-4: Bulk selection support */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAllInStage?: (stage: VaultStage) => void;
}

const STAGE_CONFIG: Record<
  VaultStage,
  {
    label: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
  }
> = {
  pending: {
    label: 'Pending Review',
    icon: <PendingIcon />,
    color: '#ed6c02', // warning.main
    bgColor: '#fff4e5',
  },
  approved: {
    label: 'Approved',
    icon: <CheckCircleIcon />,
    color: '#2e7d32', // success.main
    bgColor: '#edf7ed',
  },
  deprecated: {
    label: 'Deprecated',
    icon: <ArchiveIcon />,
    color: '#757575', // grey.600
    bgColor: '#f5f5f5',
  },
};

export function VaultStageColumn({
  stage,
  components,
  onViewDetails,
  onDragStart,
  onDragOver,
  onDrop,
  onAddComponent,
  selectable = false,
  selectedIds = new Set(),
  onToggleSelect,
  onSelectAllInStage,
}: VaultStageColumnProps) {
  const config = STAGE_CONFIG[stage];

  // P1-4: Calculate selection state for this stage
  const stageSelectedCount = components.filter((c) => selectedIds.has(c.id)).length;
  const allInStageSelected = components.length > 0 && stageSelectedCount === components.length;
  const someInStageSelected = stageSelectedCount > 0 && stageSelectedCount < components.length;

  const handleSelectAllClick = () => {
    onSelectAllInStage?.(stage);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver?.(e);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop?.(stage, e);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        minWidth: 300,
        maxWidth: 360,
        bgcolor: config.bgColor,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        border: 1,
        borderColor: 'divider',
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* P1-4: Select all checkbox for this stage */}
          {selectable && components.length > 0 && (
            <Tooltip title={allInStageSelected ? `Deselect all ${components.length}` : `Select all ${components.length}`}>
              <Checkbox
                size="small"
                checked={allInStageSelected}
                indeterminate={someInStageSelected}
                onChange={handleSelectAllClick}
                sx={{ p: 0 }}
                inputProps={{
                  'aria-label': `Select all ${components.length} ${config.label} components`,
                }}
              />
            </Tooltip>
          )}
          <Box sx={{ color: config.color, display: 'flex' }}>{config.icon}</Box>
          <Typography variant="subtitle1" fontWeight={600}>
            {config.label}
          </Typography>
          <Chip
            label={stageSelectedCount > 0 ? `${stageSelectedCount}/${components.length}` : components.length}
            size="small"
            sx={{
              height: 22,
              bgcolor: alpha(config.color, 0.1),
              color: config.color,
              fontWeight: 600,
            }}
          />
        </Box>
        {onAddComponent && stage === 'pending' && (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => onAddComponent(stage)}
          >
            Add
          </Button>
        )}
      </Box>

      {/* Component Cards */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 1.5,
          minHeight: 200,
        }}
      >
        {components.length === 0 ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 2,
              borderStyle: 'dashed',
              borderColor: 'divider',
              borderRadius: 1,
              p: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {stage === 'pending'
                ? 'Drag components here for review'
                : stage === 'approved'
                  ? 'Approved components appear here'
                  : 'Deprecated components'}
            </Typography>
          </Box>
        ) : (
          components.map((component) => (
            <Box
              key={component.id}
              draggable={!selectable}
              onDragStart={() => onDragStart?.(component)}
            >
              <VaultComponentCard
                component={component}
                onViewDetails={onViewDetails}
                draggable={!selectable}
                selectable={selectable}
                selected={selectedIds.has(component.id)}
                onToggleSelect={onToggleSelect}
              />
            </Box>
          ))
        )}
      </Box>

      {/* Column Footer with stats */}
      <Box
        sx={{
          p: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {components.length} component{components.length !== 1 ? 's' : ''}
        </Typography>
        {stage === 'pending' && components.length > 0 && (
          <Typography variant="caption" color="warning.main">
            {components.filter((c) => c.priority === 'high').length} high priority
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

export default VaultStageColumn;
