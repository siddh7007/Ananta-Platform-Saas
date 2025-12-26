import React from 'react';
import { Chip, Box } from '@mui/material';
import { useRecordContext } from 'react-admin';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

/**
 * Compliance Field Component
 *
 * Displays compliance status with color-coded badges matching V1 UI:
 * - Compliant (Green): Meets all requirements
 * - Non-Compliant (Red): Fails requirements
 * - Unknown (Gray): Status not assessed
 *
 * Supports multiple compliance types:
 * - RoHS (Restriction of Hazardous Substances)
 * - REACH (Registration, Evaluation, Authorization of Chemicals)
 * - Conflict Minerals
 * - Other certifications
 */

interface ComplianceFieldProps {
  source?: string;
  label?: string;
  type?: 'rohs' | 'reach' | 'conflict_minerals' | 'generic';
}

const COMPLIANCE_STATUS_CONFIG: Record<string, { icon: React.ReactElement; bgColor: string; textColor: string; label: string }> = {
  'COMPLIANT': {
    icon: <CheckCircleIcon sx={{ fontSize: 14 }} />,
    bgColor: '#22c55e', // green-500
    textColor: '#ffffff',
    label: 'Compliant',
  },
  'NON_COMPLIANT': {
    icon: <CancelIcon sx={{ fontSize: 14 }} />,
    bgColor: '#ef4444', // red-500
    textColor: '#ffffff',
    label: 'Non-Compliant',
  },
  'UNKNOWN': {
    icon: <HelpOutlineIcon sx={{ fontSize: 14 }} />,
    bgColor: '#9ca3af', // gray-400
    textColor: '#ffffff',
    label: 'Unknown',
  },
  'EXEMPT': {
    icon: <CheckCircleIcon sx={{ fontSize: 14 }} />,
    bgColor: '#3b82f6', // blue-500
    textColor: '#ffffff',
    label: 'Exempt',
  },
};

export const ComplianceField: React.FC<ComplianceFieldProps> = ({
  source = 'compliance_status',
  label,
  type = 'generic',
}) => {
  const record = useRecordContext();

  if (!record) return null;

  const complianceStatus = record[source] || 'UNKNOWN';
  const config = COMPLIANCE_STATUS_CONFIG[complianceStatus] || COMPLIANCE_STATUS_CONFIG['UNKNOWN'];

  // Get type-specific label
  const typeLabel = type === 'rohs' ? 'RoHS' : type === 'reach' ? 'REACH' : type === 'conflict_minerals' ? 'Conflict Minerals' : label || 'Compliance';

  return (
    <Chip
      icon={config.icon}
      label={`${typeLabel}: ${config.label}`}
      size="small"
      sx={{
        fontWeight: 600,
        backgroundColor: config.bgColor,
        color: config.textColor,
        '& .MuiChip-icon': {
          color: config.textColor,
        },
      }}
    />
  );
};

/**
 * RoHS Compliance Field (Shortcut)
 */
export const RoHSComplianceField: React.FC<Omit<ComplianceFieldProps, 'type'>> = (props) => {
  return <ComplianceField {...props} source="rohs_compliant" type="rohs" />;
};

/**
 * REACH Compliance Field (Shortcut)
 */
export const REACHComplianceField: React.FC<Omit<ComplianceFieldProps, 'type'>> = (props) => {
  return <ComplianceField {...props} source="reach_compliant" type="reach" />;
};

/**
 * Multi-Compliance Field
 * Shows multiple compliance statuses in a row
 */
interface MultiComplianceFieldProps {
  sources?: {
    rohs?: string;
    reach?: string;
    conflict_minerals?: string;
  };
}

export const MultiComplianceField: React.FC<MultiComplianceFieldProps> = ({
  sources = {
    rohs: 'rohs_compliant',
    reach: 'reach_compliant',
    conflict_minerals: 'conflict_minerals_compliant',
  },
}) => {
  const record = useRecordContext();

  if (!record) return null;

  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {sources.rohs && record[sources.rohs] && (
        <RoHSComplianceField source={sources.rohs} />
      )}
      {sources.reach && record[sources.reach] && (
        <REACHComplianceField source={sources.reach} />
      )}
      {sources.conflict_minerals && record[sources.conflict_minerals] && (
        <ComplianceField source={sources.conflict_minerals} type="conflict_minerals" />
      )}
    </Box>
  );
};

ComplianceField.defaultProps = {
  label: 'Compliance',
};
