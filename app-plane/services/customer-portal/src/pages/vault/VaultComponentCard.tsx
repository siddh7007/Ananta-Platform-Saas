/**
 * VaultComponentCard
 *
 * Draggable component card for kanban board.
 * Shows component summary with quick actions.
 */

import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Checkbox,
} from '@mui/material';
import MemoryIcon from '@mui/icons-material/Memory';
import DescriptionIcon from '@mui/icons-material/Description';
import InfoIcon from '@mui/icons-material/Info';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import type { VaultStage } from '../discovery/SendToVaultDrawer';

export interface VaultComponent {
  id: string;
  mpn: string;
  manufacturer: string;
  description?: string;
  category?: string;
  quality_score?: number;
  lifecycle_status?: string;
  image_url?: string;
  datasheet_url?: string;
  stage: VaultStage;
  reviewer?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
}

interface VaultComponentCardProps {
  component: VaultComponent;
  onViewDetails: (component: VaultComponent) => void;
  draggable?: boolean;
  /** P1-4: Selection support for bulk operations */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function VaultComponentCard({
  component,
  onViewDetails,
  draggable = true,
  selectable = false,
  selected = false,
  onToggleSelect,
}: VaultComponentCardProps) {
  const getQualityIcon = (score?: number) => {
    if (!score) return null;
    if (score >= 95) return <CheckCircleIcon fontSize="inherit" color="success" />;
    if (score >= 70) return <WarningIcon fontSize="inherit" color="warning" />;
    return <ErrorIcon fontSize="inherit" color="error" />;
  };

  const getLifecycleColor = (status?: string): 'success' | 'warning' | 'error' | 'default' => {
    if (!status) return 'default';
    const s = status.toLowerCase();
    if (s === 'active') return 'success';
    if (s === 'nrnd') return 'warning';
    if (s === 'obsolete' || s === 'eol') return 'error';
    return 'default';
  };

  const getPriorityColor = (p?: string): 'error' | 'warning' | 'default' => {
    if (p === 'high') return 'error';
    if (p === 'medium') return 'warning';
    return 'default';
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.(component.id);
  };

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 1.5,
        cursor: draggable ? 'grab' : 'default',
        '&:hover': {
          boxShadow: 2,
          borderColor: 'primary.light',
        },
        '&:active': {
          cursor: draggable ? 'grabbing' : 'default',
        },
        // P1-4: Highlight selected cards
        ...(selected && {
          borderColor: 'primary.main',
          borderWidth: 2,
          bgcolor: 'primary.50',
        }),
      }}
    >
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        {/* Header with drag handle and checkbox */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
          {/* P1-4: Selection checkbox */}
          {selectable && (
            <Checkbox
              size="small"
              checked={selected}
              onClick={handleCheckboxClick}
              sx={{ p: 0, mt: 0.5 }}
              inputProps={{
                'aria-label': `Select ${component.mpn} for bulk action`,
              }}
            />
          )}
          {draggable && !selectable && (
            <DragIndicatorIcon
              fontSize="small"
              sx={{ color: 'text.disabled', mt: 0.5 }}
            />
          )}
          <Avatar
            src={component.image_url}
            variant="rounded"
            sx={{ width: 40, height: 40 }}
          >
            <MemoryIcon />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              noWrap
              title={component.mpn}
            >
              {component.mpn}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {component.manufacturer}
            </Typography>
          </Box>
          {component.priority && component.priority !== 'low' && (
            <Chip
              label={component.priority}
              size="small"
              color={getPriorityColor(component.priority)}
              sx={{ height: 20, fontSize: 10 }}
            />
          )}
        </Box>

        {/* Category & Lifecycle */}
        <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
          {component.category && (
            <Chip
              label={component.category}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: 10 }}
            />
          )}
          {component.lifecycle_status && (
            <Chip
              label={component.lifecycle_status}
              size="small"
              color={getLifecycleColor(component.lifecycle_status)}
              sx={{ height: 20, fontSize: 10 }}
            />
          )}
        </Stack>

        {/* Quality Score & Actions */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {component.quality_score !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {getQualityIcon(component.quality_score)}
              <Typography variant="caption" color="text.secondary">
                {component.quality_score}%
              </Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', ml: 'auto' }}>
            {component.datasheet_url && (
              <Tooltip title="Open Datasheet">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(component.datasheet_url, '_blank');
                  }}
                >
                  <DescriptionIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="View Details">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDetails(component);
                }}
              >
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Due Date / Reviewer */}
        {(component.dueDate || component.reviewer) && (
          <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              {component.reviewer && `Reviewer: ${component.reviewer}`}
              {component.reviewer && component.dueDate && ' • '}
              {component.dueDate &&
                `Due: ${new Date(component.dueDate).toLocaleDateString()}`}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default VaultComponentCard;
