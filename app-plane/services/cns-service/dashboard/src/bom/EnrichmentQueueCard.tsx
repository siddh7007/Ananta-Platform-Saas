/**
 * EnrichmentQueueCard Component (CNS Dashboard)
 *
 * Rich enrichment progress card matching Customer Portal's EnrichmentQueueSection.
 * Shows progress bar, status cards (Pending/Enriching/Completed/Failed),
 * success rate, and file info.
 */

import React, { useRef, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Divider,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Grid,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useEnrichmentPolling, EnrichmentState } from '../hooks';

interface EnrichmentQueueCardProps {
  bomId: string;
  filename: string;
  onComplete?: (state: EnrichmentState) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  showControls?: boolean;
}

export function EnrichmentQueueCard({
  bomId,
  filename,
  onComplete,
  onError,
  onCancel,
  showControls = true,
}: EnrichmentQueueCardProps) {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLDivElement>(null);

  // Use polling-based progress
  const { state, isPolling, error, refresh } = useEnrichmentPolling({
    bomId,
    pollInterval: 2000,
    enabled: true,
    onCompleted: (completedState) => {
      console.log('[EnrichmentQueueCard] Completed:', completedState);
      onComplete?.(completedState);
    },
    onFailed: (failedState) => {
      console.error('[EnrichmentQueueCard] Failed:', failedState);
      onError?.(new Error('Enrichment failed'));
    },
    onProgress: (progressState) => {
      console.debug('[EnrichmentQueueCard] Progress:', progressState.percent_complete, '%');
    },
  });

  // Auto-scroll to section on mount
  useEffect(() => {
    if (sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [bomId]);

  // Calculate metrics
  const metrics = {
    pending: state?.pending_items || 0,
    enriching: state?.total_items && state?.enriched_items !== undefined && state?.failed_items !== undefined
      ? Math.max(0, state.total_items - state.enriched_items - state.failed_items - (state.pending_items || 0))
      : 0,
    completed: state?.enriched_items || 0,
    failed: (state?.failed_items || 0) + (state?.not_found_items || 0),
    total: state?.total_items || 0,
  };

  const progressPercent = metrics.total > 0
    ? ((metrics.completed + metrics.failed) / metrics.total) * 100
    : (state?.percent_complete || 0);

  const successRate = metrics.completed + metrics.failed > 0
    ? (metrics.completed / (metrics.completed + metrics.failed)) * 100
    : 100;

  const isComplete = state?.status === 'completed';
  const isFailed = state?.status === 'failed';
  const isRunning = state?.status === 'enriching' || isPolling;

  // Loading state
  if (!state && isPolling && !error) {
    return (
      <Card ref={sectionRef} sx={{ mt: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={24} />
            <Typography>Connecting to enrichment queue...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card ref={sectionRef} sx={{ mt: 2 }}>
        <CardContent>
          <Alert
            severity="warning"
            action={
              <Button color="inherit" size="small" onClick={refresh}>
                Retry
              </Button>
            }
          >
            Failed to connect. Enrichment may still be running in background.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      ref={sectionRef}
      sx={{
        mt: 2,
        border: '2px solid',
        borderColor: isComplete
          ? 'success.main'
          : isFailed
          ? 'error.main'
          : 'primary.main',
      }}
    >
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutorenewIcon
              color={isComplete ? 'success' : 'primary'}
              sx={{
                animation: isRunning && !isComplete ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }}
            />
            <Typography variant="h6">
              Enrichment Queue
            </Typography>
          </Box>
          {/* Compact Status Chips */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={<HourglassEmptyIcon sx={{ fontSize: 14 }} />}
              label={metrics.pending}
              size="small"
              variant={metrics.pending > 0 ? 'filled' : 'outlined'}
            />
            <Chip
              icon={<AutorenewIcon sx={{ fontSize: 14 }} />}
              label={metrics.enriching}
              size="small"
              color="primary"
              variant={metrics.enriching > 0 ? 'filled' : 'outlined'}
            />
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
              label={metrics.completed}
              size="small"
              color="success"
              variant={metrics.completed > 0 ? 'filled' : 'outlined'}
            />
            {metrics.failed > 0 && (
              <Chip
                icon={<ErrorIcon sx={{ fontSize: 14 }} />}
                label={metrics.failed}
                size="small"
                color="error"
                variant="filled"
              />
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Progress Section */}
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
                {metrics.completed + metrics.failed} / {metrics.total} components
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
                    ? 'error.main'
                    : 'success.main',
                },
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
              <Typography variant="caption" fontWeight={600}>
                {progressPercent.toFixed(0)}%
              </Typography>
            </Box>
          </Box>

          {/* Metrics Grid - 4 Status Cards */}
          <Grid container spacing={1}>
            {/* Pending */}
            <Grid item xs={3}>
              <StatusCard
                icon={<HourglassEmptyIcon />}
                value={metrics.pending}
                label="Pending"
                active={metrics.pending > 0}
                color="default"
              />
            </Grid>

            {/* Enriching */}
            <Grid item xs={3}>
              <StatusCard
                icon={<AutorenewIcon />}
                value={metrics.enriching}
                label="Enriching"
                active={metrics.enriching > 0}
                color="primary"
                spinning={metrics.enriching > 0}
              />
            </Grid>

            {/* Completed */}
            <Grid item xs={3}>
              <StatusCard
                icon={<CheckCircleIcon />}
                value={metrics.completed}
                label="Completed"
                active={metrics.completed > 0}
                color="success"
              />
            </Grid>

            {/* Failed */}
            <Grid item xs={3}>
              <StatusCard
                icon={<ErrorIcon />}
                value={metrics.failed}
                label="Failed"
                active={metrics.failed > 0}
                color="error"
              />
            </Grid>
          </Grid>

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

        {/* File Info */}
        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {filename}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {metrics.total} components • {isComplete ? 'Enrichment Complete' : isRunning ? 'Enriching...' : 'Pending'}
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            endIcon={<OpenInNewIcon />}
            onClick={() => navigate(`/bom-jobs/${bomId}`)}
          >
            View Details
          </Button>
        </Box>

        {/* Completion/Failure Alerts */}
        {isComplete && (
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Successfully enriched {metrics.completed} components.
              {metrics.failed > 0 && ` ${metrics.failed} components could not be enriched.`}
            </Typography>
          </Alert>
        )}

        {isFailed && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Enrichment failed. Please check the logs for more details.
            </Typography>
          </Alert>
        )}

        {/* Controls */}
        {showControls && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                {onCancel && (
                  <Button
                    variant="text"
                    onClick={onCancel}
                    startIcon={<ArrowBackIcon />}
                  >
                    Back to Upload
                  </Button>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={refresh}
                  startIcon={<RefreshIcon />}
                >
                  Refresh
                </Button>
              </Box>
            </Box>
          </>
        )}

        {/* Quick Links on Complete */}
        {isComplete && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<OpenInNewIcon />}
              onClick={() => navigate(`/bom-jobs/${bomId}`)}
            >
              View BOM Details
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AssessmentIcon />}
              onClick={() => navigate('/enrichment-monitor')}
            >
              Enrichment Monitor
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// Status Card Component
interface StatusCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  active: boolean;
  color: 'default' | 'primary' | 'success' | 'error';
  spinning?: boolean;
}

function StatusCard({ icon, value, label, active, color, spinning = false }: StatusCardProps) {
  const colorMap = {
    default: { bg: 'background.paper', border: active ? 'action.disabled' : 'divider', text: 'text.secondary', icon: 'action.disabled' },
    primary: { bg: active ? 'primary.light' : 'background.paper', border: active ? 'primary.main' : 'divider', text: 'primary.main', icon: 'action.disabled' },
    success: { bg: active ? 'success.light' : 'background.paper', border: active ? 'success.main' : 'divider', text: 'success.main', icon: 'action.disabled' },
    error: { bg: active ? 'error.light' : 'background.paper', border: active ? 'error.main' : 'divider', text: 'error.main', icon: 'action.disabled' },
  };

  const colors = colorMap[color];

  return (
    <Box
      sx={{
        textAlign: 'center',
        p: 1,
        bgcolor: colors.bg,
        borderRadius: 1,
        border: '1px solid',
        borderColor: colors.border,
      }}
    >
      <Box
        sx={{
          fontSize: 20,
          color: active ? colors.text : colors.icon,
          mb: 0.5,
          display: 'flex',
          justifyContent: 'center',
          '& svg': {
            fontSize: 20,
            animation: spinning ? 'spin 1s linear infinite' : 'none',
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' },
            },
          },
        }}
      >
        {icon}
      </Box>
      <Typography variant="h6" fontWeight={700} color={active ? colors.text : 'text.disabled'}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

export default EnrichmentQueueCard;
