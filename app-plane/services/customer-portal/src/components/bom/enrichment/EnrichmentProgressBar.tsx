/**
 * EnrichmentProgressBar Component
 *
 * Animated real-time progress bar for BOM enrichment.
 * Shows percentage completion with smooth transitions and color coding.
 */

import React from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  Chip,
  Stack,
  Tooltip,
} from '@mui/material';
import { CheckCircle, Error, HourglassEmpty, Autorenew } from '@mui/icons-material';
import type { EnrichmentState } from '../../../hooks/useEnrichmentStream';

interface EnrichmentProgressBarProps {
  state: EnrichmentState | null;
  showStats?: boolean;
  height?: number;
  animated?: boolean;
}

export const EnrichmentProgressBar: React.FC<EnrichmentProgressBarProps> = ({
  state,
  showStats = true,
  height = 12,
  animated = true,
}) => {
  if (!state) {
    return (
      <Box>
        <LinearProgress
          variant="indeterminate"
          sx={{ height, borderRadius: height / 2 }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          Waiting for enrichment to start...
        </Typography>
      </Box>
    );
  }

  const {
    percent_complete = 0,
    total_items = 0,
    enriched_items = 0,
    failed_items = 0,
    not_found_items = 0,
    pending_items = 0,
    status,
  } = state;

  const processedItems = enriched_items + failed_items + (not_found_items || 0);
  const successRate = processedItems > 0 ? (enriched_items / processedItems) * 100 : 100;

  // Color based on status and success rate
  const getProgressColor = () => {
    if (status === 'completed') {
      return successRate >= 90 ? 'success' : successRate >= 70 ? 'warning' : 'error';
    }
    if (status === 'failed') return 'error';
    return 'primary';
  };

  const progressColor = getProgressColor();

  return (
    <Box>
      {/* Progress bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: showStats ? 1 : 0 }}>
        <Box sx={{ flex: 1 }}>
          <LinearProgress
            variant="determinate"
            value={percent_complete}
            color={progressColor}
            sx={{
              height,
              borderRadius: height / 2,
              transition: animated ? 'all 0.3s ease' : 'none',
              bgcolor: 'action.disabledBackground',
              '& .MuiLinearProgress-bar': {
                transition: animated ? 'transform 0.3s ease' : 'none',
              },
            }}
          />
        </Box>
        <Typography
          variant="body2"
          fontWeight="bold"
          color="text.secondary"
          sx={{ minWidth: 50, textAlign: 'right' }}
        >
          {percent_complete.toFixed(1)}%
        </Typography>
      </Box>

      {/* Stats */}
      {showStats && (
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Tooltip title="Total components">
            <Chip
              icon={<HourglassEmpty sx={{ fontSize: 14 }} />}
              label={`${processedItems}/${total_items}`}
              size="small"
              variant="outlined"
            />
          </Tooltip>

          {enriched_items > 0 && (
            <Tooltip title="Successfully enriched">
              <Chip
                icon={<CheckCircle sx={{ fontSize: 14 }} />}
                label={enriched_items}
                size="small"
                color="success"
                variant="outlined"
              />
            </Tooltip>
          )}

          {pending_items > 0 && status === 'enriching' && (
            <Tooltip title="Pending">
              <Chip
                icon={<Autorenew sx={{ fontSize: 14 }} />}
                label={pending_items}
                size="small"
                color="info"
                variant="outlined"
              />
            </Tooltip>
          )}

          {failed_items + (not_found_items || 0) > 0 && (
            <Tooltip title="Failed or not found">
              <Chip
                icon={<Error sx={{ fontSize: 14 }} />}
                label={failed_items + (not_found_items || 0)}
                size="small"
                color="error"
                variant="outlined"
              />
            </Tooltip>
          )}

          {processedItems > 0 && (
            <Tooltip title="Success rate">
              <Chip
                label={`${successRate.toFixed(0)}% success`}
                size="small"
                color={successRate >= 90 ? 'success' : successRate >= 70 ? 'warning' : 'error'}
                variant="filled"
              />
            </Tooltip>
          )}
        </Stack>
      )}
    </Box>
  );
};
