import React from 'react';
import { Chip } from '@mui/material';
import { useRecordContext } from 'react-admin';

/**
 * Risk Level Field Component
 *
 * Displays risk level with color-coded badges matching V1 UI:
 * - GREEN: Low risk
 * - YELLOW: Medium risk
 * - ORANGE: High risk
 * - RED: Critical risk
 */

interface RiskLevelFieldProps {
  source?: string;
  label?: string;
}

const RISK_LEVEL_CONFIG: Record<string, { color: 'success' | 'warning' | 'error' | 'default'; label: string }> = {
  'GREEN': { color: 'success', label: 'Low Risk' },
  'YELLOW': { color: 'warning', label: 'Medium Risk' },
  'ORANGE': { color: 'error', label: 'High Risk' },
  'RED': { color: 'error', label: 'Critical Risk' },
  'NONE': { color: 'default', label: 'Not Assessed' },
};

export const RiskLevelField: React.FC<RiskLevelFieldProps> = ({ source = 'risk_level', label }) => {
  const record = useRecordContext();

  if (!record) return null;

  const riskLevel = record[source] || 'NONE';
  const config = RISK_LEVEL_CONFIG[riskLevel] || RISK_LEVEL_CONFIG['NONE'];

  return (
    <Chip
      label={config.label}
      color={config.color}
      size="small"
      sx={{
        fontWeight: 600,
        // Custom colors to match V1 exactly
        ...(riskLevel === 'ORANGE' && {
          backgroundColor: '#fb923c', // orange-400
          color: '#ffffff',
        }),
        ...(riskLevel === 'RED' && {
          backgroundColor: '#ef4444', // red-500
          color: '#ffffff',
        }),
        ...(riskLevel === 'YELLOW' && {
          backgroundColor: '#facc15', // yellow-400
          color: '#000000',
        }),
        ...(riskLevel === 'GREEN' && {
          backgroundColor: '#22c55e', // green-500
          color: '#ffffff',
        }),
      }}
    />
  );
};

RiskLevelField.defaultProps = {
  label: 'Risk Level',
};
