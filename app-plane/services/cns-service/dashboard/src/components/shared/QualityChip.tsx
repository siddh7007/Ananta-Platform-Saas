/**
 * QualityChip - Status chip with quality routing variants
 */
import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import type { ChipProps } from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import CancelIcon from '@mui/icons-material/Cancel';
import ErrorIcon from '@mui/icons-material/Error';
import { qualityColors, getQualityStatus } from '../../theme';

export type QualityStatus = 'production' | 'staging' | 'rejected' | 'failed';

export interface QualityChipProps {
  status?: QualityStatus;
  score?: number;
  showScore?: boolean;
  showIcon?: boolean;
  size?: ChipProps['size'];
  variant?: ChipProps['variant'];
}

const statusConfig: Record<QualityStatus, { label: string; icon: React.ReactNode; color: string }> = {
  production: {
    label: 'Production',
    icon: <CheckCircleIcon fontSize="small" />,
    color: qualityColors.production,
  },
  staging: {
    label: 'Staging',
    icon: <WarningIcon fontSize="small" />,
    color: qualityColors.staging,
  },
  rejected: {
    label: 'Rejected',
    icon: <CancelIcon fontSize="small" />,
    color: qualityColors.rejected,
  },
  failed: {
    label: 'Failed',
    icon: <ErrorIcon fontSize="small" />,
    color: qualityColors.failed,
  },
};

export const QualityChip: React.FC<QualityChipProps> = ({
  status,
  score,
  showScore = false,
  showIcon = true,
  size = 'small',
  variant = 'filled',
}) => {
  // Determine status from score if not provided
  const resolvedStatus = status ?? (score !== undefined ? getQualityStatus(score) : 'failed');
  const config = statusConfig[resolvedStatus];

  const label = showScore && score !== undefined ? `${score}%` : config.label;

  const tooltipText = score !== undefined
    ? `Quality Score: ${score}% (${config.label})`
    : config.label;

  return (
    <Tooltip title={tooltipText} arrow>
      <Chip
        label={label}
        size={size}
        variant={variant}
        icon={showIcon ? (config.icon as React.ReactElement) : undefined}
        sx={{
          backgroundColor: variant === 'filled' ? config.color : 'transparent',
          color: variant === 'filled' ? '#fff' : config.color,
          borderColor: config.color,
          fontWeight: 600,
          '& .MuiChip-icon': {
            color: variant === 'filled' ? '#fff' : config.color,
          },
        }}
      />
    </Tooltip>
  );
};

// Convenience components for specific statuses
export const ProductionChip: React.FC<Omit<QualityChipProps, 'status'>> = (props) => (
  <QualityChip status="production" {...props} />
);

export const StagingChip: React.FC<Omit<QualityChipProps, 'status'>> = (props) => (
  <QualityChip status="staging" {...props} />
);

export const RejectedChip: React.FC<Omit<QualityChipProps, 'status'>> = (props) => (
  <QualityChip status="rejected" {...props} />
);

export default QualityChip;
