import React from 'react';
import { Chip } from '@mui/material';
import { useRecordContext } from 'react-admin';

/**
 * Lifecycle Status Field Component
 *
 * Displays lifecycle status with color-coded badges matching V1 UI:
 * - ACTIVE (Green): Component is actively manufactured
 * - NRND (Yellow): Not Recommended for New Designs
 * - EOL (Orange): End of Life announced
 * - OBSOLETE (Red): No longer available
 */

interface LifecycleStatusFieldProps {
  source?: string;
  label?: string;
}

const LIFECYCLE_STATUS_CONFIG: Record<string, { color: 'success' | 'warning' | 'error' | 'default'; label: string; bgColor: string; textColor: string }> = {
  'ACTIVE': {
    color: 'success',
    label: 'Active',
    bgColor: '#22c55e', // green-500
    textColor: '#ffffff',
  },
  'NRND': {
    color: 'warning',
    label: 'NRND',
    bgColor: '#facc15', // yellow-400
    textColor: '#000000',
  },
  'EOL': {
    color: 'error',
    label: 'EOL',
    bgColor: '#fb923c', // orange-400
    textColor: '#ffffff',
  },
  'OBSOLETE': {
    color: 'error',
    label: 'Obsolete',
    bgColor: '#ef4444', // red-500
    textColor: '#ffffff',
  },
  'UNKNOWN': {
    color: 'default',
    label: 'Unknown',
    bgColor: '#9ca3af', // gray-400
    textColor: '#ffffff',
  },
};

export const LifecycleStatusField: React.FC<LifecycleStatusFieldProps> = ({ source = 'lifecycle_status', label }) => {
  const record = useRecordContext();

  if (!record) return null;

  const lifecycleStatus = record[source] || 'UNKNOWN';
  const config = LIFECYCLE_STATUS_CONFIG[lifecycleStatus] || LIFECYCLE_STATUS_CONFIG['UNKNOWN'];

  return (
    <Chip
      label={config.label}
      size="small"
      sx={{
        fontWeight: 600,
        backgroundColor: config.bgColor,
        color: config.textColor,
      }}
    />
  );
};

LifecycleStatusField.defaultProps = {
  label: 'Lifecycle Status',
};
