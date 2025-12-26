/**
 * EnrichmentStageIndicator Component
 *
 * Displays the current enrichment stage with visual indicators.
 * Shows stage transitions and batch progress.
 */

import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Paper,
  Stack,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload,
  Search,
  DataObject,
  CheckCircle,
  Error,
  PlayArrow,
  Pause,
} from '@mui/icons-material';
import type { EnrichmentState } from '../../../hooks/useEnrichmentStream';

interface EnrichmentStageIndicatorProps {
  state: EnrichmentState | null;
  showBatchProgress?: boolean;
  compact?: boolean;
}

const STAGE_ICONS: Record<string, React.ReactElement> = {
  'preparing': <CloudUpload />,
  'fetching': <Search />,
  'normalizing': <DataObject />,
  'validating': <CheckCircle />,
  'completed': <CheckCircle />,
  'failed': <Error />,
  'paused': <Pause />,
};

const STAGE_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info'> = {
  'preparing': 'info',
  'fetching': 'primary',
  'normalizing': 'secondary',
  'validating': 'warning',
  'completed': 'success',
  'failed': 'error',
  'paused': 'default',
};

export const EnrichmentStageIndicator: React.FC<EnrichmentStageIndicatorProps> = ({
  state,
  showBatchProgress = true,
  compact = false,
}) => {
  if (!state) {
    return null;
  }

  const { current_stage, status, current_batch, total_batches } = state;
  const stage = current_stage || status || 'preparing';
  const icon = STAGE_ICONS[stage] || <PlayArrow />;
  const color = STAGE_COLORS[stage] || 'default';

  const hasBatchInfo = current_batch !== undefined && total_batches !== undefined && total_batches > 1;
  const batchProgress = hasBatchInfo
    ? ((current_batch! / total_batches!) * 100)
    : 0;

  if (compact) {
    return (
      <Tooltip title={`Current stage: ${stage}${hasBatchInfo ? ` (Batch ${current_batch}/${total_batches})` : ''}`}>
        <Chip
          icon={icon}
          label={stage.charAt(0).toUpperCase() + stage.slice(1)}
          color={color}
          size="small"
          variant="filled"
        />
      </Tooltip>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        borderColor: `${color}.main`,
        borderWidth: 2,
      }}
    >
      <Stack spacing={1.5}>
        {/* Stage header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: `${color}.50`,
              color: `${color}.main`,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary" fontSize="0.75rem">
              Current Stage
            </Typography>
            <Typography variant="h6" fontWeight={600}>
              {stage.charAt(0).toUpperCase() + stage.slice(1)}
            </Typography>
          </Box>
        </Box>

        {/* Batch progress */}
        {showBatchProgress && hasBatchInfo && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Batch Progress
              </Typography>
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                {current_batch}/{total_batches}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={batchProgress}
              color={color}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: 'action.disabledBackground',
              }}
            />
          </Box>
        )}

        {/* Status description */}
        <Typography variant="caption" color="text.secondary">
          {getStageDescription(stage)}
        </Typography>
      </Stack>
    </Paper>
  );
};

function getStageDescription(stage: string): string {
  const descriptions: Record<string, string> = {
    'preparing': 'Preparing components for enrichment...',
    'fetching': 'Fetching data from supplier APIs...',
    'normalizing': 'Normalizing and matching component data...',
    'validating': 'Validating enriched data quality...',
    'completed': 'Enrichment completed successfully',
    'failed': 'Enrichment encountered errors',
    'paused': 'Enrichment is paused',
    'enriching': 'Enriching components...',
  };

  return descriptions[stage] || 'Processing...';
}
