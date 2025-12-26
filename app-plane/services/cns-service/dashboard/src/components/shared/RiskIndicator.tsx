/**
 * RiskIndicator Component
 *
 * Visual indicator for risk levels with consistent styling.
 * Used for supply chain risk, obsolescence risk, and other risk metrics.
 *
 * @module components/shared/RiskIndicator
 */

import React from 'react';
import { Box, Typography, LinearProgress, Tooltip, Chip } from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { getRiskLevel, getRiskColor } from '../../theme';

// ============================================================
// Types
// ============================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskIndicatorProps {
  /** Risk score (0-100) or risk level */
  value: number | RiskLevel;
  /** Indicator variant */
  variant?: 'badge' | 'bar' | 'chip' | 'icon';
  /** Size */
  size?: 'small' | 'medium' | 'large';
  /** Show numeric value */
  showValue?: boolean;
  /** Show label */
  showLabel?: boolean;
  /** Tooltip text */
  tooltip?: string;
  /** Custom label */
  label?: string;
}

// ============================================================
// Risk Level Labels
// ============================================================

const riskLabels: Record<RiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  critical: 'Critical Risk',
};

const riskIcons: Record<RiskLevel, React.ElementType> = {
  low: CheckCircleIcon,
  medium: InfoIcon,
  high: WarningIcon,
  critical: ErrorIcon,
};

// ============================================================
// Size Configurations
// ============================================================

const sizeConfig = {
  small: {
    iconSize: 16,
    fontSize: '0.75rem',
    barHeight: 4,
    chipSize: 'small' as const,
  },
  medium: {
    iconSize: 20,
    fontSize: '0.875rem',
    barHeight: 6,
    chipSize: 'medium' as const,
  },
  large: {
    iconSize: 24,
    fontSize: '1rem',
    barHeight: 8,
    chipSize: 'medium' as const,
  },
};

// ============================================================
// Component
// ============================================================

export const RiskIndicator: React.FC<RiskIndicatorProps> = ({
  value,
  variant = 'badge',
  size = 'medium',
  showValue = false,
  showLabel = true,
  tooltip,
  label,
}) => {
  // Determine risk level and score
  const isNumeric = typeof value === 'number';
  const riskLevel: RiskLevel = isNumeric ? getRiskLevel(value) : value;
  const score = isNumeric ? value : undefined;

  // Get styling
  const color = getRiskColor(isNumeric ? value : (riskLevel === 'low' ? 0 : riskLevel === 'medium' ? 30 : riskLevel === 'high' ? 60 : 80));
  const config = sizeConfig[size];
  const Icon = riskIcons[riskLevel];

  // Build tooltip text
  const tooltipText = tooltip ?? (score !== undefined ? `Risk Score: ${score}` : riskLabels[riskLevel]);
  const displayLabel = label ?? riskLabels[riskLevel];

  // Render based on variant
  const renderContent = () => {
    switch (variant) {
      case 'badge':
        return (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              backgroundColor: `${color}15`,
              border: `1px solid ${color}40`,
            }}
          >
            <Icon sx={{ fontSize: config.iconSize, color }} />
            {showLabel && (
              <Typography
                sx={{
                  fontSize: config.fontSize,
                  fontWeight: 600,
                  color,
                  lineHeight: 1.2,
                }}
              >
                {displayLabel}
              </Typography>
            )}
            {showValue && score !== undefined && (
              <Typography
                sx={{
                  fontSize: config.fontSize,
                  fontWeight: 500,
                  color: 'text.secondary',
                  lineHeight: 1.2,
                }}
              >
                ({score})
              </Typography>
            )}
          </Box>
        );

      case 'bar':
        return (
          <Box sx={{ width: '100%' }}>
            {(showLabel || showValue) && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                {showLabel && (
                  <Typography
                    sx={{
                      fontSize: config.fontSize,
                      fontWeight: 500,
                      color,
                    }}
                  >
                    {displayLabel}
                  </Typography>
                )}
                {showValue && score !== undefined && (
                  <Typography
                    sx={{
                      fontSize: config.fontSize,
                      color: 'text.secondary',
                    }}
                  >
                    {score}%
                  </Typography>
                )}
              </Box>
            )}
            <LinearProgress
              variant="determinate"
              value={score ?? (riskLevel === 'low' ? 15 : riskLevel === 'medium' ? 40 : riskLevel === 'high' ? 70 : 90)}
              sx={{
                height: config.barHeight,
                borderRadius: config.barHeight / 2,
                backgroundColor: `${color}20`,
                '& .MuiLinearProgress-bar': {
                  backgroundColor: color,
                  borderRadius: config.barHeight / 2,
                },
              }}
            />
          </Box>
        );

      case 'chip':
        return (
          <Chip
            icon={<Icon sx={{ fontSize: config.iconSize }} />}
            label={showLabel ? displayLabel : score}
            size={config.chipSize}
            sx={{
              backgroundColor: `${color}15`,
              color,
              fontWeight: 600,
              '& .MuiChip-icon': {
                color,
              },
            }}
          />
        );

      case 'icon':
        return (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon sx={{ fontSize: config.iconSize, color }} />
          </Box>
        );

      default:
        return null;
    }
  };

  const content = renderContent();

  // Wrap with tooltip
  if (tooltip !== undefined || variant === 'icon') {
    return (
      <Tooltip title={tooltipText} arrow>
        <span style={{ display: 'inline-flex' }}>{content}</span>
      </Tooltip>
    );
  }

  return content;
};

// ============================================================
// Convenience Components
// ============================================================

export const LowRisk: React.FC<Omit<RiskIndicatorProps, 'value'>> = (props) => (
  <RiskIndicator value="low" {...props} />
);

export const MediumRisk: React.FC<Omit<RiskIndicatorProps, 'value'>> = (props) => (
  <RiskIndicator value="medium" {...props} />
);

export const HighRisk: React.FC<Omit<RiskIndicatorProps, 'value'>> = (props) => (
  <RiskIndicator value="high" {...props} />
);

export const CriticalRisk: React.FC<Omit<RiskIndicatorProps, 'value'>> = (props) => (
  <RiskIndicator value="critical" {...props} />
);

export default RiskIndicator;
