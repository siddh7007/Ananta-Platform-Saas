/**
 * Inline Enrichment Progress Component
 *
 * Displays real-time enrichment progress within the BOM upload workflow,
 * similar to Customer Portal's inline enrichment view.
 *
 * Uses polling-based progress tracking for reliability.
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Button,
  Alert,
  Grid,
  Paper,
  CircularProgress,
  Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useEnrichmentPolling, EnrichmentState } from '../hooks';
import { CNS_API_URL, getAdminAuthHeaders } from '../config/api';

interface InlineEnrichmentProgressProps {
  bomId: string;
  filename: string;
  onComplete?: (state: EnrichmentState) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  showControls?: boolean;
}

const statusColors: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  pending: 'default',
  enriching: 'primary',
  completed: 'success',
  failed: 'error',
  paused: 'warning',
  stopped: 'error',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  enriching: 'Enriching...',
  completed: 'Completed',
  failed: 'Failed',
  paused: 'Paused',
  stopped: 'Stopped',
};

export const InlineEnrichmentProgress: React.FC<InlineEnrichmentProgressProps> = ({
  bomId,
  filename,
  onComplete,
  onError,
  onCancel,
  showControls = true,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [controlLoading, setControlLoading] = useState(false);

  const {
    state,
    isPolling,
    error,
    refresh,
    startPolling,
    stopPolling,
  } = useEnrichmentPolling({
    bomId,
    pollInterval: 2000,
    enabled: true,
    onCompleted: (completedState) => {
      console.log('[InlineEnrichment] Enrichment completed:', completedState);
      onComplete?.(completedState);
    },
    onFailed: (failedState) => {
      console.log('[InlineEnrichment] Enrichment failed:', failedState);
      onError?.(new Error('Enrichment failed'));
    },
    onProgress: (progressState) => {
      console.debug('[InlineEnrichment] Progress:', progressState.percent_complete, '%');
    },
  });

  // Calculate derived values
  const enrichedCount = state?.enriched_items || 0;
  const failedCount = state?.failed_items || 0;
  const pendingCount = state?.pending_items || 0;
  const totalCount = state?.total_items || 0;
  const percentComplete = state?.percent_complete || 0;
  const status = state?.status || 'pending';

  const isComplete = status === 'completed';
  const isFailed = status === 'failed';
  const isEnriching = status === 'enriching';

  // Enrichment control handlers
  const handlePause = useCallback(async () => {
    setControlLoading(true);
    try {
      const response = await fetch(`${CNS_API_URL}/boms/${bomId}/enrichment/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
      });
      if (response.ok) {
        setIsPaused(true);
        stopPolling();
      }
    } catch (err) {
      console.error('[InlineEnrichment] Failed to pause:', err);
    } finally {
      setControlLoading(false);
    }
  }, [bomId, stopPolling]);

  const handleResume = useCallback(async () => {
    setControlLoading(true);
    try {
      const response = await fetch(`${CNS_API_URL}/boms/${bomId}/enrichment/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
      });
      if (response.ok) {
        setIsPaused(false);
        startPolling();
      }
    } catch (err) {
      console.error('[InlineEnrichment] Failed to resume:', err);
    } finally {
      setControlLoading(false);
    }
  }, [bomId, startPolling]);

  return (
    <Card elevation={2}>
      <CardContent>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h6" gutterBottom>
              Enrichment Progress
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {filename}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip
              label={statusLabels[status] || status}
              color={statusColors[status] || 'default'}
              size="small"
              icon={
                isComplete ? <CheckCircleIcon /> :
                isFailed ? <ErrorIcon /> :
                isPaused ? <PauseIcon /> :
                isEnriching ? <AccessTimeIcon /> : undefined
              }
            />
            {isPolling && (
              <CircularProgress size={16} />
            )}
          </Box>
        </Box>

        {/* Progress Bar */}
        <Box mb={3}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2" color="textSecondary">
              {enrichedCount + failedCount} of {totalCount} components processed
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {percentComplete}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={percentComplete}
            color={isFailed ? 'error' : isComplete ? 'success' : 'primary'}
            sx={{ height: 10, borderRadius: 5 }}
          />
        </Box>

        {/* Stats Grid */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={3}>
            <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'grey.50' }}>
              <Typography variant="h5" color="text.primary">{totalCount}</Typography>
              <Typography variant="caption" color="textSecondary">Total</Typography>
            </Paper>
          </Grid>
          <Grid item xs={3}>
            <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'success.50' }}>
              <Typography variant="h5" color="success.main">{enrichedCount}</Typography>
              <Typography variant="caption" color="textSecondary">Enriched</Typography>
            </Paper>
          </Grid>
          <Grid item xs={3}>
            <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'error.50' }}>
              <Typography variant="h5" color="error.main">{failedCount}</Typography>
              <Typography variant="caption" color="textSecondary">Failed</Typography>
            </Paper>
          </Grid>
          <Grid item xs={3}>
            <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'warning.50' }}>
              <Typography variant="h5" color="warning.main">{pendingCount}</Typography>
              <Typography variant="caption" color="textSecondary">Pending</Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error.message}
          </Alert>
        )}

        {/* Completion Message */}
        {isComplete && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
            <Typography variant="body1" fontWeight={600}>
              Enrichment Complete!
            </Typography>
            <Typography variant="body2">
              {enrichedCount} components enriched, {failedCount} failed out of {totalCount} total.
            </Typography>
          </Alert>
        )}

        {/* Failed Message */}
        {isFailed && (
          <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }}>
            <Typography variant="body1" fontWeight={600}>
              Enrichment Failed
            </Typography>
            <Typography variant="body2">
              Please check the logs for more details.
            </Typography>
          </Alert>
        )}

        {/* Controls */}
        {showControls && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                {onCancel && (
                  <Button
                    variant="text"
                    onClick={onCancel}
                    disabled={controlLoading}
                  >
                    Back to Upload
                  </Button>
                )}
              </Box>
              <Box display="flex" gap={1}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={refresh}
                  startIcon={<RefreshIcon />}
                  disabled={controlLoading}
                >
                  Refresh
                </Button>
                {isEnriching && !isPaused && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handlePause}
                    startIcon={<PauseIcon />}
                    disabled={controlLoading}
                    color="warning"
                  >
                    Pause
                  </Button>
                )}
                {isPaused && (
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleResume}
                    startIcon={<PlayArrowIcon />}
                    disabled={controlLoading}
                    color="primary"
                  >
                    Resume
                  </Button>
                )}
              </Box>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default InlineEnrichmentProgress;
