/**
 * BOM Status Chip Component
 *
 * Consistent status display for BOM enrichment states.
 */

import React from 'react';
import { Chip, CircularProgress, Box } from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Pause as PausedIcon,
} from '@mui/icons-material';
import { enrichmentStatusColors } from '../theme';

export type BOMStatus = 'enriching' | 'completed' | 'failed' | 'paused' | 'pending' | 'created' | 'unknown';

export interface BOMStatusChipProps {
  status: BOMStatus | string;
  size?: 'small' | 'medium';
  showIcon?: boolean;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  enriching: {
    color: enrichmentStatusColors.processing,
    icon: <CircularProgress size={12} sx={{ color: 'inherit' }} />,
    label: 'Enriching',
  },
  completed: {
    color: enrichmentStatusColors.completed,
    icon: <CheckIcon fontSize="small" />,
    label: 'Completed',
  },
  failed: {
    color: enrichmentStatusColors.failed,
    icon: <ErrorIcon fontSize="small" />,
    label: 'Failed',
  },
  paused: {
    color: '#f59e0b',
    icon: <PausedIcon fontSize="small" />,
    label: 'Paused',
  },
  pending: {
    color: enrichmentStatusColors.pending,
    icon: <PendingIcon fontSize="small" />,
    label: 'Pending',
  },
  created: {
    color: '#9ca3af',
    icon: <PendingIcon fontSize="small" />,
    label: 'Created',
  },
  unknown: {
    color: '#6b7280',
    icon: null,
    label: 'Unknown',
  },
};

export const BOMStatusChip: React.FC<BOMStatusChipProps> = ({
  status,
  size = 'small',
  showIcon = true,
}) => {
  const normalizedStatus = status?.toLowerCase() || 'unknown';
  const config = statusConfig[normalizedStatus] || statusConfig.unknown;

  return (
    <Chip
      label={config.label}
      size={size}
      icon={showIcon && config.icon ? (
        <Box sx={{ display: 'flex', alignItems: 'center', color: 'inherit', ml: 0.5 }}>
          {config.icon}
        </Box>
      ) : undefined}
      sx={{
        bgcolor: `${config.color}20`,
        color: config.color,
        fontWeight: 600,
        '& .MuiChip-icon': {
          color: 'inherit',
        },
      }}
    />
  );
};

export default BOMStatusChip;
