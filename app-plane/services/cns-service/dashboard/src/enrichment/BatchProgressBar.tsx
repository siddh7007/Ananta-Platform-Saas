/**
 * Batch Progress Bar Component
 *
 * Visual progress bar with status color coding.
 */

import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { enrichmentStatusColors } from '../theme';

export interface BatchProgressBarProps {
  percent: number;
  status: 'enriching' | 'completed' | 'failed' | 'unknown';
  showLabel?: boolean;
  height?: number;
}

export const BatchProgressBar: React.FC<BatchProgressBarProps> = ({
  percent,
  status,
  showLabel = true,
  height = 6,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return enrichmentStatusColors.completed;
      case 'enriching':
        return enrichmentStatusColors.processing;
      case 'failed':
        return enrichmentStatusColors.failed;
      default:
        return '#9ca3af';
    }
  };

  return (
    <Tooltip title={`${percent.toFixed(1)}% complete`}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            flex: 1,
            height,
            bgcolor: 'grey.200',
            borderRadius: height / 2,
            overflow: 'hidden',
            minWidth: 60,
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: `${Math.min(100, Math.max(0, percent))}%`,
              bgcolor: getStatusColor(),
              transition: 'width 0.3s ease',
              borderRadius: height / 2,
            }}
          />
        </Box>
        {showLabel && (
          <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'right' }}>
            {percent.toFixed(0)}%
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
};

export default BatchProgressBar;
