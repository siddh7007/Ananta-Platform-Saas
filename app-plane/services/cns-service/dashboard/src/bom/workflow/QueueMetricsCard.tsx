/**
 * Queue Metrics Card
 *
 * Displays queue progress metrics in a 4-column grid layout.
 * Used in both upload queue and enrichment queue sections.
 *
 * @module bom/workflow/QueueMetricsCard
 */

import React from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

export interface QueueMetrics {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface QueueMetricsCardProps {
  metrics: QueueMetrics;
}

/**
 * QueueMetricsCard - Hero metrics display for queue status
 *
 * Shows 4-column layout with:
 * - Pending (hourglass icon)
 * - Processing (spinning icon)
 * - Completed (checkmark icon)
 * - Failed (error icon)
 */
export const QueueMetricsCard: React.FC<QueueMetricsCardProps> = ({ metrics }) => (
  <Paper sx={{ p: 2, mb: 2 }}>
    <Grid container spacing={2}>
      <Grid item xs={3}>
        <Box textAlign="center">
          <HourglassEmptyIcon sx={{ color: 'text.secondary', fontSize: 28 }} />
          <Typography variant="h5" fontWeight={600}>{metrics.pending}</Typography>
          <Typography variant="caption" color="text.secondary">Pending</Typography>
        </Box>
      </Grid>
      <Grid item xs={3}>
        <Box textAlign="center">
          <AutorenewIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          <Typography variant="h5" fontWeight={600} color="primary.main">{metrics.processing}</Typography>
          <Typography variant="caption" color="text.secondary">Processing</Typography>
        </Box>
      </Grid>
      <Grid item xs={3}>
        <Box textAlign="center">
          <CheckCircleIcon sx={{ color: 'success.main', fontSize: 28 }} />
          <Typography variant="h5" fontWeight={600} color="success.main">{metrics.completed}</Typography>
          <Typography variant="caption" color="text.secondary">Completed</Typography>
        </Box>
      </Grid>
      <Grid item xs={3}>
        <Box textAlign="center">
          <ErrorIcon sx={{ color: 'error.main', fontSize: 28 }} />
          <Typography variant="h5" fontWeight={600} color="error.main">{metrics.failed}</Typography>
          <Typography variant="caption" color="text.secondary">Failed</Typography>
        </Box>
      </Grid>
    </Grid>
  </Paper>
);

export default QueueMetricsCard;
