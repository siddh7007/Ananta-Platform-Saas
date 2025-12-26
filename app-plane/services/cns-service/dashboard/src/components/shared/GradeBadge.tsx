/**
 * GradeBadge Component
 *
 * Displays a letter grade (A-F) with consistent visual styling.
 * Used for quality scores, data completeness, and other metrics.
 *
 * @module components/shared/GradeBadge
 */

import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { getGradeColor, getGradeFromScore } from '../../theme';

// ============================================================
// Types
// ============================================================

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface GradeBadgeProps {
  /** Letter grade (A-F) or numeric score (0-100) */
  value: Grade | number;
  /** Badge size */
  size?: 'small' | 'medium' | 'large';
  /** Tooltip text */
  tooltip?: string;
  /** Show numeric score alongside grade */
  showScore?: boolean;
  /** Numeric score (required if showScore is true and value is a letter) */
  score?: number;
  /** Custom label to show instead of grade */
  label?: string;
}

// ============================================================
// Size Configurations
// ============================================================

const sizeConfig = {
  small: {
    width: 24,
    height: 24,
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  medium: {
    width: 32,
    height: 32,
    fontSize: '0.875rem',
    fontWeight: 700,
  },
  large: {
    width: 48,
    height: 48,
    fontSize: '1.25rem',
    fontWeight: 700,
  },
};

// ============================================================
// Component
// ============================================================

export const GradeBadge: React.FC<GradeBadgeProps> = ({
  value,
  size = 'medium',
  tooltip,
  showScore = false,
  score,
  label,
}) => {
  // Determine grade and score
  const isNumeric = typeof value === 'number';
  const grade: Grade = isNumeric ? getGradeFromScore(value) : value;
  const numericScore = isNumeric ? value : score;

  // Get styling
  const color = getGradeColor(grade);
  const config = sizeConfig[size];

  // Build content
  const displayLabel = label ?? grade;
  const tooltipText = tooltip ?? (numericScore !== undefined ? `Score: ${numericScore}%` : undefined);

  const badge = (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      {/* Grade Circle */}
      <Box
        sx={{
          width: config.width,
          height: config.height,
          borderRadius: '50%',
          backgroundColor: color,
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: config.fontSize,
          fontWeight: config.fontWeight,
          lineHeight: 1,
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        }}
      >
        {displayLabel}
      </Box>

      {/* Optional Score */}
      {showScore && numericScore !== undefined && (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            fontSize: size === 'small' ? '0.75rem' : '0.875rem',
          }}
        >
          {numericScore}%
        </Typography>
      )}
    </Box>
  );

  // Wrap with tooltip if provided
  if (tooltipText) {
    return (
      <Tooltip title={tooltipText} arrow>
        {badge}
      </Tooltip>
    );
  }

  return badge;
};

// ============================================================
// Convenience Components
// ============================================================

export const GradeA: React.FC<Omit<GradeBadgeProps, 'value'>> = (props) => (
  <GradeBadge value="A" {...props} />
);

export const GradeB: React.FC<Omit<GradeBadgeProps, 'value'>> = (props) => (
  <GradeBadge value="B" {...props} />
);

export const GradeC: React.FC<Omit<GradeBadgeProps, 'value'>> = (props) => (
  <GradeBadge value="C" {...props} />
);

export const GradeD: React.FC<Omit<GradeBadgeProps, 'value'>> = (props) => (
  <GradeBadge value="D" {...props} />
);

export const GradeF: React.FC<Omit<GradeBadgeProps, 'value'>> = (props) => (
  <GradeBadge value="F" {...props} />
);

export default GradeBadge;
