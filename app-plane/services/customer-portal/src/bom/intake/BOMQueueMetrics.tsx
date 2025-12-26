/**
 * BOMQueueMetrics Component
 *
 * Displays upload queue statistics - pending, processing, completed, failed counts.
 * Visual summary of batch upload progress.
 */

import React from 'react';
import { Box, Typography, Chip, LinearProgress, Tooltip } from '@mui/material';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { workflowStatusColors } from '../../theme';
import type { BOMUploadStatusType } from './BOMUploadStatus';
import type { QueueItemData } from './BOMQueueItem';

interface BOMQueueMetricsProps {
  /** List of queue items */
  items: QueueItemData[];
  /** Compact display mode */
  compact?: boolean;
}

interface MetricCount {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

/**
 * Calculate counts from queue items
 */
function calculateMetrics(items: QueueItemData[]): MetricCount {
  return items.reduce(
    (acc, item) => {
      switch (item.status) {
        case 'pending':
          acc.pending++;
          break;
        case 'parsing':
        case 'uploading':
        case 'mapping':
        case 'confirming':
        case 'saving':
          acc.processing++;
          break;
        case 'completed':
          acc.completed++;
          break;
        case 'error':
          acc.failed++;
          break;
      }
      return acc;
    },
    { pending: 0, processing: 0, completed: 0, failed: 0 }
  );
}

export function BOMQueueMetrics({ items, compact = false }: BOMQueueMetricsProps) {
  const metrics = calculateMetrics(items);
  const total = items.length;
  const progressPercent = total > 0 ? ((metrics.completed + metrics.failed) / total) * 100 : 0;
  const successRate = metrics.completed + metrics.failed > 0
    ? (metrics.completed / (metrics.completed + metrics.failed)) * 100
    : 100;

  if (total === 0) return null;

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title={`${metrics.pending} pending`}>
          <Chip
            icon={<HourglassEmptyIcon sx={{ fontSize: 14 }} />}
            label={metrics.pending}
            size="small"
            variant={metrics.pending > 0 ? 'filled' : 'outlined'}
            sx={{ minWidth: 50 }}
          />
        </Tooltip>
        <Tooltip title={`${metrics.processing} processing`}>
          <Chip
            icon={<AutorenewIcon sx={{ fontSize: 14 }} />}
            label={metrics.processing}
            size="small"
            color="primary"
            variant={metrics.processing > 0 ? 'filled' : 'outlined'}
            sx={{ minWidth: 50 }}
          />
        </Tooltip>
        <Tooltip title={`${metrics.completed} completed`}>
          <Chip
            icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
            label={metrics.completed}
            size="small"
            color="success"
            variant={metrics.completed > 0 ? 'filled' : 'outlined'}
            sx={{ minWidth: 50 }}
          />
        </Tooltip>
        {metrics.failed > 0 && (
          <Tooltip title={`${metrics.failed} failed`}>
            <Chip
              icon={<ErrorIcon sx={{ fontSize: 14 }} />}
              label={metrics.failed}
              size="small"
              color="error"
              variant="filled"
              sx={{ minWidth: 50 }}
            />
          </Tooltip>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Progress Bar */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" fontWeight={600}>
            Queue Progress
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {metrics.completed + metrics.failed} / {total} files
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progressPercent}
          sx={{
            height: 8,
            borderRadius: 1,
            bgcolor: 'action.disabledBackground',
            '& .MuiLinearProgress-bar': {
              bgcolor: metrics.failed > 0 && metrics.completed === 0
                ? workflowStatusColors.failed
                : workflowStatusColors.completed,
            },
          }}
        />
      </Box>

      {/* Metrics Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
        }}
      >
        {/* Pending */}
        <Box
          sx={{
            textAlign: 'center',
            p: 1,
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: '1px solid',
            borderColor: metrics.pending > 0 ? 'action.disabled' : 'divider',
          }}
        >
          <HourglassEmptyIcon
            sx={{
              fontSize: 20,
              color: metrics.pending > 0 ? 'text.secondary' : 'action.disabled',
              mb: 0.5,
            }}
          />
          <Typography
            variant="h6"
            fontWeight={700}
            color={metrics.pending > 0 ? 'text.primary' : 'text.disabled'}
          >
            {metrics.pending}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Pending
          </Typography>
        </Box>

        {/* Processing */}
        <Box
          sx={{
            textAlign: 'center',
            p: 1,
            bgcolor: metrics.processing > 0 ? 'primary.50' : 'background.paper',
            borderRadius: 1,
            border: '1px solid',
            borderColor: metrics.processing > 0 ? 'primary.main' : 'divider',
          }}
        >
          <AutorenewIcon
            sx={{
              fontSize: 20,
              color: metrics.processing > 0 ? 'primary.main' : 'action.disabled',
              mb: 0.5,
              animation: metrics.processing > 0 ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }}
          />
          <Typography
            variant="h6"
            fontWeight={700}
            color={metrics.processing > 0 ? 'primary.main' : 'text.disabled'}
          >
            {metrics.processing}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Processing
          </Typography>
        </Box>

        {/* Completed */}
        <Box
          sx={{
            textAlign: 'center',
            p: 1,
            bgcolor: metrics.completed > 0 ? 'success.50' : 'background.paper',
            borderRadius: 1,
            border: '1px solid',
            borderColor: metrics.completed > 0 ? 'success.main' : 'divider',
          }}
        >
          <CheckCircleIcon
            sx={{
              fontSize: 20,
              color: metrics.completed > 0 ? 'success.main' : 'action.disabled',
              mb: 0.5,
            }}
          />
          <Typography
            variant="h6"
            fontWeight={700}
            color={metrics.completed > 0 ? 'success.main' : 'text.disabled'}
          >
            {metrics.completed}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Completed
          </Typography>
        </Box>

        {/* Failed */}
        <Box
          sx={{
            textAlign: 'center',
            p: 1,
            bgcolor: metrics.failed > 0 ? 'error.50' : 'background.paper',
            borderRadius: 1,
            border: '1px solid',
            borderColor: metrics.failed > 0 ? 'error.main' : 'divider',
          }}
        >
          <ErrorIcon
            sx={{
              fontSize: 20,
              color: metrics.failed > 0 ? 'error.main' : 'action.disabled',
              mb: 0.5,
            }}
          />
          <Typography
            variant="h6"
            fontWeight={700}
            color={metrics.failed > 0 ? 'error.main' : 'text.disabled'}
          >
            {metrics.failed}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Failed
          </Typography>
        </Box>
      </Box>

      {/* Success Rate */}
      {metrics.completed + metrics.failed > 0 && (
        <Box sx={{ mt: 1.5, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Success Rate:{' '}
            <Typography
              component="span"
              variant="caption"
              fontWeight={600}
              color={successRate >= 80 ? 'success.main' : successRate >= 50 ? 'warning.main' : 'error.main'}
            >
              {successRate.toFixed(0)}%
            </Typography>
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default BOMQueueMetrics;
