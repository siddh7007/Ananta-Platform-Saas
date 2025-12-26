/**
 * StatusChip Component
 *
 * Consistent status badge using theme tokens for semantic colors.
 * Supports risk levels, grades, workflow status, alert types, and custom variants.
 *
 * Features:
 * - Maps to theme semantic colors (risk, grade, workflow, alert)
 * - Optional icon prefix
 * - Size variants (small, medium)
 * - Filled and outlined variants
 */

import React from 'react';
import { Chip, ChipProps } from '@mui/material';
import {
  riskColors,
  gradeColors,
  workflowStatusColors,
  alertTypeColors,
  alertSeverityColors,
  withAlpha,
} from '../../theme';

// Status category types
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
export type WorkflowStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'mapping_pending';
export type AlertType = 'LIFECYCLE' | 'RISK' | 'PRICE' | 'AVAILABILITY' | 'COMPLIANCE' | 'PCN' | 'SUPPLY_CHAIN';
export type AlertSeverity = 'info' | 'warning' | 'critical';

// Combined status type
export type StatusType =
  | { category: 'risk'; value: RiskLevel }
  | { category: 'grade'; value: Grade }
  | { category: 'workflow'; value: WorkflowStatus }
  | { category: 'alertType'; value: AlertType }
  | { category: 'alertSeverity'; value: AlertSeverity }
  | { category: 'custom'; value: string; color: string };

export interface StatusChipProps {
  /** The status to display */
  status: StatusType;
  /** Optional label override (defaults to status value) */
  label?: string;
  /** Size variant */
  size?: 'small' | 'medium';
  /** Visual variant */
  variant?: 'filled' | 'outlined';
  /** Optional icon */
  icon?: React.ReactElement;
  /** Click handler */
  onClick?: () => void;
  /** Additional MUI Chip props */
  chipProps?: Partial<ChipProps>;
}

/**
 * Get color based on status category and value
 */
function getStatusColor(status: StatusType): string {
  switch (status.category) {
    case 'risk':
      return riskColors[status.value];
    case 'grade':
      return gradeColors[status.value];
    case 'workflow':
      return workflowStatusColors[status.value] || workflowStatusColors.pending;
    case 'alertType':
      return alertTypeColors[status.value];
    case 'alertSeverity':
      return alertSeverityColors[status.value];
    case 'custom':
      return status.color;
    default:
      return '#757575';
  }
}

/**
 * Get display label for status
 */
function getStatusLabel(status: StatusType): string {
  switch (status.category) {
    case 'risk':
      return status.value.charAt(0).toUpperCase() + status.value.slice(1);
    case 'grade':
      return `Grade ${status.value}`;
    case 'workflow':
      return status.value.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    case 'alertType':
      return status.value.replace(/_/g, ' ');
    case 'alertSeverity':
      return status.value.charAt(0).toUpperCase() + status.value.slice(1);
    case 'custom':
      return status.value;
    default:
      return 'Unknown';
  }
}

/**
 * StatusChip Component
 */
export function StatusChip({
  status,
  label,
  size = 'small',
  variant = 'filled',
  icon,
  onClick,
  chipProps,
}: StatusChipProps) {
  const color = getStatusColor(status);
  const displayLabel = label || getStatusLabel(status);

  const isFilled = variant === 'filled';

  return (
    <Chip
      label={displayLabel}
      size={size}
      icon={icon}
      onClick={onClick}
      sx={{
        backgroundColor: isFilled ? color : 'transparent',
        color: isFilled ? '#fff' : color,
        borderColor: color,
        fontWeight: 600,
        fontSize: size === 'small' ? '0.6875rem' : '0.75rem',
        height: size === 'small' ? 20 : 24,
        '& .MuiChip-icon': {
          color: isFilled ? '#fff' : color,
          fontSize: size === 'small' ? 14 : 16,
        },
        '&:hover': onClick
          ? {
              backgroundColor: isFilled ? color : withAlpha(color, 0.1),
              opacity: isFilled ? 0.9 : 1,
            }
          : {},
        ...chipProps?.sx,
      }}
      variant={isFilled ? 'filled' : 'outlined'}
      {...chipProps}
    />
  );
}

// Convenience factory functions
export const RiskChip = ({
  level,
  ...props
}: { level: RiskLevel } & Omit<StatusChipProps, 'status'>) => (
  <StatusChip status={{ category: 'risk', value: level }} {...props} />
);

export const GradeChip = ({
  grade,
  ...props
}: { grade: Grade } & Omit<StatusChipProps, 'status'>) => (
  <StatusChip status={{ category: 'grade', value: grade }} {...props} />
);

export const WorkflowChip = ({
  status: workflowStatus,
  ...props
}: { status: WorkflowStatus } & Omit<StatusChipProps, 'status'>) => (
  <StatusChip status={{ category: 'workflow', value: workflowStatus }} {...props} />
);

export const AlertTypeChip = ({
  type,
  ...props
}: { type: AlertType } & Omit<StatusChipProps, 'status'>) => (
  <StatusChip status={{ category: 'alertType', value: type }} {...props} />
);

export const SeverityChip = ({
  severity,
  ...props
}: { severity: AlertSeverity } & Omit<StatusChipProps, 'status'>) => (
  <StatusChip status={{ category: 'alertSeverity', value: severity }} {...props} />
);

export default StatusChip;
