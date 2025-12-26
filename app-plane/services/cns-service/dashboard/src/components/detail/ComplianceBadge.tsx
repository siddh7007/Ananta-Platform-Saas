/**
 * ComplianceBadge Component
 *
 * Icon indicator chip for compliance status.
 * Displays checkmark for compliant, X for non-compliant, ? for unknown.
 */
import React from 'react';
import { Chip, Tooltip, Box, ChipProps } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';

export type ComplianceStatus = 'Compliant' | 'Non-Compliant' | 'Unknown' | 'N/A' | boolean | null | undefined;

export interface ComplianceBadgeProps {
  /** Compliance status */
  status: ComplianceStatus;
  /** Label to display */
  label: string;
  /** Size variant (default: 'small') */
  size?: 'small' | 'medium';
  /** Show label in chip (default: true) */
  showLabel?: boolean;
  /** Tooltip override */
  tooltip?: string;
  /** Full width mode */
  fullWidth?: boolean;
}

export const ComplianceBadge: React.FC<ComplianceBadgeProps> = ({
  status,
  label,
  size = 'small',
  showLabel = true,
  tooltip,
  fullWidth = false,
}) => {
  // Normalize status
  const normalizedStatus = normalizeStatus(status);

  // Get configuration based on status
  const config = getStatusConfig(normalizedStatus);

  const chipContent = (
    <Chip
      icon={config.icon}
      label={showLabel ? label : undefined}
      size={size}
      sx={{
        bgcolor: config.bgColor,
        color: config.textColor,
        border: '1px solid',
        borderColor: config.borderColor,
        fontWeight: 500,
        fontSize: size === 'small' ? '0.7rem' : '0.8rem',
        height: size === 'small' ? 26 : 32,
        width: fullWidth ? '100%' : 'auto',
        justifyContent: fullWidth ? 'flex-start' : 'center',
        '& .MuiChip-icon': {
          color: config.iconColor,
          marginLeft: showLabel ? undefined : '0',
          marginRight: showLabel ? undefined : '0',
        },
        '@media print': {
          border: '1px solid #999',
        },
      }}
    />
  );

  const tooltipText = tooltip || `${label}: ${config.statusText}`;

  return (
    <Tooltip title={tooltipText} arrow placement="top">
      {chipContent}
    </Tooltip>
  );
};

// Normalize various status formats to a consistent type
function normalizeStatus(status: ComplianceStatus): 'compliant' | 'non-compliant' | 'unknown' | 'na' {
  if (status === true || status === 'Compliant' || status === 'Yes') {
    return 'compliant';
  }
  if (status === false || status === 'Non-Compliant' || status === 'No') {
    return 'non-compliant';
  }
  if (status === 'N/A' || status === 'Not Applicable') {
    return 'na';
  }
  return 'unknown';
}

// Get visual configuration for each status
function getStatusConfig(status: 'compliant' | 'non-compliant' | 'unknown' | 'na') {
  switch (status) {
    case 'compliant':
      return {
        icon: <CheckCircleIcon sx={{ fontSize: '1rem' }} />,
        bgColor: 'success.light',
        textColor: 'success.dark',
        borderColor: 'success.light',
        iconColor: 'success.main',
        statusText: 'Compliant',
      };
    case 'non-compliant':
      return {
        icon: <CancelIcon sx={{ fontSize: '1rem' }} />,
        bgColor: 'error.light',
        textColor: 'error.dark',
        borderColor: 'error.light',
        iconColor: 'error.main',
        statusText: 'Non-Compliant',
      };
    case 'na':
      return {
        icon: <RemoveCircleOutlineIcon sx={{ fontSize: '1rem' }} />,
        bgColor: 'grey.100',
        textColor: 'grey.600',
        borderColor: 'grey.300',
        iconColor: 'grey.500',
        statusText: 'Not Applicable',
      };
    default:
      return {
        icon: <HelpOutlineIcon sx={{ fontSize: '1rem' }} />,
        bgColor: 'grey.50',
        textColor: 'grey.600',
        borderColor: 'grey.200',
        iconColor: 'grey.400',
        statusText: 'Unknown',
      };
  }
}

/**
 * ComplianceBadgeRow - Displays a compliance badge with label in a row format
 */
export interface ComplianceBadgeRowProps {
  /** Compliance status */
  status: ComplianceStatus;
  /** Label to display */
  label: string;
  /** Additional description */
  description?: string;
}

export const ComplianceBadgeRow: React.FC<ComplianceBadgeRowProps> = ({
  status,
  label,
  description,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box>
        <Box sx={{ fontWeight: 500, fontSize: '0.875rem' }}>{label}</Box>
        {description && (
          <Box sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            {description}
          </Box>
        )}
      </Box>
      <ComplianceBadge status={status} label={getStatusLabel(status)} />
    </Box>
  );
};

function getStatusLabel(status: ComplianceStatus): string {
  if (status === true || status === 'Compliant') return 'Yes';
  if (status === false || status === 'Non-Compliant') return 'No';
  if (status === 'N/A') return 'N/A';
  return 'Unknown';
}

export default ComplianceBadge;
