/**
 * StatusBadge Component
 *
 * Generic status indicator with consistent visual styling.
 * Used for enrichment status, job status, lifecycle status, etc.
 *
 * @module components/shared/StatusBadge
 */

import React from 'react';
import { Box, Typography, Chip, CircularProgress, Tooltip } from '@mui/material';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  Schedule as ScheduleIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  Warning as WarningIcon,
  HourglassEmpty as HourglassIcon,
} from '@mui/icons-material';
import {
  getEnrichmentStatusColor,
  getJobStatusColor,
  getWorkflowStatusColor,
  getLifecycleColor,
} from '../../theme';

// ============================================================
// Types
// ============================================================

export type StatusType = 'enrichment' | 'job' | 'workflow' | 'lifecycle' | 'custom';

export interface StatusBadgeProps {
  /** Status value */
  status: string;
  /** Status type for color mapping */
  type?: StatusType;
  /** Badge variant */
  variant?: 'badge' | 'chip' | 'dot' | 'text';
  /** Size */
  size?: 'small' | 'medium' | 'large';
  /** Show icon */
  showIcon?: boolean;
  /** Custom color (overrides type-based color) */
  color?: string;
  /** Custom label (overrides status as label) */
  label?: string;
  /** Tooltip text */
  tooltip?: string;
  /** Pulsing animation for active states */
  pulse?: boolean;
}

// ============================================================
// Status Icon Mapping
// ============================================================

const statusIcons: Record<string, React.ElementType> = {
  // Enrichment statuses
  pending: ScheduleIcon,
  processing: PlayArrowIcon,
  enriching: PlayArrowIcon,
  completed: CheckIcon,
  complete: CheckIcon,
  failed: CloseIcon,
  partial: WarningIcon,

  // Job statuses
  created: HourglassIcon,
  queued: HourglassIcon,
  running: PlayArrowIcon,
  success: CheckIcon,
  error: CloseIcon,
  cancelled: CloseIcon,

  // Lifecycle statuses
  active: CheckIcon,
  nrnd: WarningIcon,
  obsolete: CloseIcon,
  eol: CloseIcon,
  unknown: HourglassIcon,

  // Workflow statuses
  inprogress: PlayArrowIcon,
  in_progress: PlayArrowIcon,
  paused: PauseIcon,
};

// ============================================================
// Size Configurations
// ============================================================

const sizeConfig = {
  small: {
    iconSize: 14,
    fontSize: '0.6875rem',
    dotSize: 8,
    chipSize: 'small' as const,
    px: 1,
    py: 0.25,
  },
  medium: {
    iconSize: 16,
    fontSize: '0.75rem',
    dotSize: 10,
    chipSize: 'small' as const,
    px: 1.25,
    py: 0.5,
  },
  large: {
    iconSize: 18,
    fontSize: '0.875rem',
    dotSize: 12,
    chipSize: 'medium' as const,
    px: 1.5,
    py: 0.5,
  },
};

// ============================================================
// Helper Functions
// ============================================================

function getStatusColor(status: string, type: StatusType): string {
  const normalizedStatus = status.toLowerCase();

  switch (type) {
    case 'enrichment':
      return getEnrichmentStatusColor(normalizedStatus);
    case 'job':
      return getJobStatusColor(normalizedStatus);
    case 'workflow':
      return getWorkflowStatusColor(normalizedStatus);
    case 'lifecycle':
      return getLifecycleColor(normalizedStatus);
    default:
      return '#6b7280'; // Default gray
  }
}

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function isActiveStatus(status: string): boolean {
  const activeStatuses = ['processing', 'enriching', 'running', 'inprogress', 'in_progress'];
  return activeStatuses.includes(status.toLowerCase());
}

// ============================================================
// Component
// ============================================================

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = 'custom',
  variant = 'badge',
  size = 'medium',
  showIcon = true,
  color: customColor,
  label,
  tooltip,
  pulse,
}) => {
  // Get styling
  const color = customColor ?? getStatusColor(status, type);
  const config = sizeConfig[size];
  const displayLabel = label ?? formatStatusLabel(status);
  const shouldPulse = pulse ?? isActiveStatus(status);

  // Get icon
  const normalizedStatus = status.toLowerCase().replace(/_/g, '');
  const Icon = statusIcons[normalizedStatus] ?? statusIcons[status.toLowerCase()] ?? ScheduleIcon;

  // Render based on variant
  const renderContent = () => {
    switch (variant) {
      case 'badge':
        return (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: config.px,
              py: config.py,
              borderRadius: 1,
              backgroundColor: `${color}15`,
              border: `1px solid ${color}30`,
            }}
          >
            {showIcon && (
              isActiveStatus(status) && shouldPulse ? (
                <CircularProgress
                  size={config.iconSize}
                  thickness={4}
                  sx={{ color }}
                />
              ) : (
                <Icon sx={{ fontSize: config.iconSize, color }} />
              )
            )}
            <Typography
              sx={{
                fontSize: config.fontSize,
                fontWeight: 600,
                color,
                lineHeight: 1.2,
                textTransform: 'capitalize',
              }}
            >
              {displayLabel}
            </Typography>
          </Box>
        );

      case 'chip':
        return (
          <Chip
            icon={
              showIcon ? (
                isActiveStatus(status) && shouldPulse ? (
                  <CircularProgress
                    size={config.iconSize - 2}
                    thickness={4}
                    sx={{ color }}
                  />
                ) : (
                  <Icon sx={{ fontSize: config.iconSize }} />
                )
              ) : undefined
            }
            label={displayLabel}
            size={config.chipSize}
            sx={{
              backgroundColor: `${color}15`,
              color,
              fontWeight: 600,
              fontSize: config.fontSize,
              textTransform: 'capitalize',
              '& .MuiChip-icon': {
                color,
              },
            }}
          />
        );

      case 'dot':
        return (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
            }}
          >
            <Box
              sx={{
                width: config.dotSize,
                height: config.dotSize,
                borderRadius: '50%',
                backgroundColor: color,
                ...(shouldPulse && {
                  animation: 'pulse 1.5s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                    '100%': { opacity: 1 },
                  },
                }),
              }}
            />
            <Typography
              sx={{
                fontSize: config.fontSize,
                color: 'text.primary',
                textTransform: 'capitalize',
              }}
            >
              {displayLabel}
            </Typography>
          </Box>
        );

      case 'text':
        return (
          <Typography
            sx={{
              fontSize: config.fontSize,
              fontWeight: 600,
              color,
              textTransform: 'capitalize',
            }}
          >
            {displayLabel}
          </Typography>
        );

      default:
        return null;
    }
  };

  const content = renderContent();

  // Wrap with tooltip if provided
  if (tooltip) {
    return (
      <Tooltip title={tooltip} arrow>
        <span style={{ display: 'inline-flex' }}>{content}</span>
      </Tooltip>
    );
  }

  return content;
};

// ============================================================
// Specialized Status Badges
// ============================================================

export const EnrichmentStatusBadge: React.FC<Omit<StatusBadgeProps, 'type'>> = (props) => (
  <StatusBadge type="enrichment" {...props} />
);

export const JobStatusBadge: React.FC<Omit<StatusBadgeProps, 'type'>> = (props) => (
  <StatusBadge type="job" {...props} />
);

export const WorkflowStatusBadge: React.FC<Omit<StatusBadgeProps, 'type'>> = (props) => (
  <StatusBadge type="workflow" {...props} />
);

export const LifecycleStatusBadge: React.FC<Omit<StatusBadgeProps, 'type'>> = (props) => (
  <StatusBadge type="lifecycle" {...props} />
);

export default StatusBadge;
