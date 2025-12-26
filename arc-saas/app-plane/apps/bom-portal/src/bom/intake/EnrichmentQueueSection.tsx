/**
 * EnrichmentQueueSection Component
 *
 * Full enrichment queue section matching the Upload Queue design.
 * Shows progress bar, status cards (Pending/Enriching/Completed/Failed),
 * success rate, and component list with auto-scroll.
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
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { workflowStatusColors } from '../../theme';
import { useEnrichmentPolling, type EnrichmentState } from '../../hooks/useEnrichmentPolling';
import { useEnrichmentQueue, type AnalysisQueueMetrics } from '../../hooks/useEnrichmentQueue';

interface EnrichmentQueueSectionProps {
  bomId: string;
  filename: string;
  organizationId?: string;
  projectId?: string;
  onComplete?: (state: EnrichmentState) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: { percent: number; enriched: number; total: number }) => void;
  /** Callback when analysis metrics update */
  onAnalysisUpdate?: (metrics: AnalysisQueueMetrics) => void;
  /** Link to view BOM details */
  bomDetailUrl?: string;
  /** Callback to restart stalled enrichment */
  onRestartEnrichment?: () => void;
}

export function EnrichmentQueueSection({
  bomId,
  filename,
  organizationId,
  projectId,
  onComplete,
  onError,
  onProgress,
  onAnalysisUpdate,
  bomDetailUrl,
  onRestartEnrichment,
}: EnrichmentQueueSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const componentListRef = useRef<HTMLDivElement>(null);
  const enrichingItemRef = useRef<HTMLLIElement>(null);

  // Use polling-based progress
  const { state, isPolling, error, refresh } = useEnrichmentPolling({
    bomId,
    pollInterval: 2000,
    onProgress: (newState) => {
      console.debug('[EnrichmentQueueSection] Progress:', {
        percent: newState.percent_complete,
        enriched: newState.enriched_items,
        total: newState.total_items,
      });
      onProgress?.({
        percent: newState.percent_complete,
        enriched: newState.enriched_items,
        total: newState.total_items,
      });
    },
    onCompleted: (newState) => {
      console.log('[EnrichmentQueueSection] Completed:', newState);
      onComplete?.(newState);
    },
    onFailed: (newState) => {
      console.error('[EnrichmentQueueSection] Failed:', newState);
      onError?.(new Error('Enrichment failed'));
    },
  });

  // Use enrichment queue for component list
  const {
    components,
    metrics: queueMetrics,
    analysisMetrics,
    error: queueError,
  } = useEnrichmentQueue({
    bomId,
    pollInterval: 3000,
    enabled: !!bomId,
  });

  // Auto-scroll to section on mount
  useEffect(() => {
    if (sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      console.debug('[EnrichmentQueueSection] Auto-scrolled to section');
    }
  }, [bomId]);

  // Auto-scroll to enriching component in list
  const enrichingComponent = components.find(c => c.status === 'enriching');
  useEffect(() => {
    if (enrichingItemRef.current && componentListRef.current) {
      enrichingItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [enrichingComponent?.id]);

  // Log queue data for debugging - only on significant changes (not every poll)
  const prevStatusRef = React.useRef<string | null>(null);
  useEffect(() => {
    const currentStatus = state?.status || 'unknown';
    // Only log on status changes, not every poll
    if (currentStatus !== prevStatusRef.current) {
      prevStatusRef.current = currentStatus;
      console.log('[EnrichmentQueueSection] Status changed:', {
        status: currentStatus,
        total: state?.total_items,
        enriched: state?.enriched_items,
        pending: state?.pending_items,
      });
    }
  }, [state]);

  // Notify parent of analysis metrics updates
  useEffect(() => {
    if (onAnalysisUpdate) {
      onAnalysisUpdate(analysisMetrics);
    }
  }, [analysisMetrics, onAnalysisUpdate]);

  // Calculate metrics - use polling state as primary source (more reliable)
  // Fall back to queue metrics only if polling state is not available
  const metrics = state && state.total_items > 0 ? {
    pending: state.pending_items || 0,
    enriching: Math.max(0, state.total_items - state.enriched_items - (state.failed_items || 0) - (state.pending_items || 0)),
    completed: state.enriched_items || 0,
    failed: (state.failed_items || 0) + (state.not_found_items || 0),
    total: state.total_items,
  } : {
    pending: queueMetrics.pending,
    enriching: queueMetrics.enriching,
    completed: queueMetrics.enriched,
    failed: queueMetrics.failed + queueMetrics.notFound,
    total: queueMetrics.total,
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
  const isAnalysisComplete = analysisMetrics.status === 'completed' || analysisMetrics.status === 'failed';

  // Detect stalled enrichment: no progress after multiple polls with pending items
  const [isStalled, setIsStalled] = React.useState(false);
  const [isRestarting, setIsRestarting] = React.useState(false);
  const lastProgressRef = React.useRef<number>(0);
  const stallCountRef = React.useRef<number>(0);

  useEffect(() => {
    const currentProgress = metrics.completed + metrics.failed;
    if (currentProgress > lastProgressRef.current) {
      // Progress was made, reset stall counter
      lastProgressRef.current = currentProgress;
      stallCountRef.current = 0;
      setIsStalled(false);
    } else if (metrics.pending > 0 && !isComplete && !isFailed) {
      // No progress, increment stall counter
      stallCountRef.current++;
      // Consider stalled after 3 polls (about 6-9 seconds) with no progress
      if (stallCountRef.current >= 3) {
        setIsStalled(true);
      }
    }
  }, [metrics.completed, metrics.failed, metrics.pending, isComplete, isFailed]);

  // Handle restart enrichment
  const handleRestartEnrichment = async () => {
    if (onRestartEnrichment) {
      onRestartEnrichment();
      return;
    }

    // Default restart logic - call the API directly
    setIsRestarting(true);
    try {
      const { getCnsBaseUrl, getAuthHeaders } = await import('../../services/cnsApi');
      const headers = await getAuthHeaders();
      const response = await fetch(`${getCnsBaseUrl()}/api/boms/${bomId}/enrichment/start`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: organizationId || '',
          project_id: projectId,
          priority: 7,
        }),
      });

      if (response.ok || response.status === 409) {
        console.log('[EnrichmentQueueSection] Enrichment restarted');
        setIsStalled(false);
        stallCountRef.current = 0;
        refresh();
      } else {
        console.error('[EnrichmentQueueSection] Failed to restart:', response.status);
      }
    } catch (err) {
      console.error('[EnrichmentQueueSection] Error restarting enrichment:', err);
    } finally {
      setIsRestarting(false);
    }
  };

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

        {/* Progress Section - Matching Upload Queue Style */}
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
                    ? workflowStatusColors.failed
                    : workflowStatusColors.completed,
                },
              }}
            />
          </Box>

          {/* Metrics Grid - 4 Status Cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 1,
            }}
          >
            {/* Pending */}
            <StatusCard
              icon={<HourglassEmptyIcon />}
              value={metrics.pending}
              label="Pending"
              active={metrics.pending > 0}
              color="grey"
            />

            {/* Enriching */}
            <StatusCard
              icon={<AutorenewIcon />}
              value={metrics.enriching}
              label="Enriching"
              active={metrics.enriching > 0}
              color="primary"
              spinning={metrics.enriching > 0}
            />

            {/* Completed */}
            <StatusCard
              icon={<CheckCircleIcon />}
              value={metrics.completed}
              label="Completed"
              active={metrics.completed > 0}
              color="success"
            />

            {/* Failed */}
            <StatusCard
              icon={<ErrorIcon />}
              value={metrics.failed}
              label="Failed"
              active={metrics.failed > 0}
              color="error"
            />
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
          {bomDetailUrl && (
            <Button
              component={RouterLink}
              to={bomDetailUrl}
              size="small"
              variant="outlined"
              endIcon={<OpenInNewIcon />}
            >
              View Details
            </Button>
          )}
        </Box>

        {/* Component List */}
        {components.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Component Queue ({components.length})
            </Typography>
            <Box
              ref={componentListRef}
              sx={{
                maxHeight: 250,
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <List dense disablePadding>
                {components.slice(0, 20).map((comp, idx) => (
                  <ListItem
                    key={comp.id}
                    ref={comp.status === 'enriching' ? enrichingItemRef : undefined}
                    sx={{
                      borderBottom: idx < components.length - 1 ? '1px solid' : 'none',
                      borderColor: 'divider',
                      bgcolor: comp.status === 'enriching' ? 'primary.50' : 'transparent',
                    }}
                  >
                    <Box sx={{ mr: 1.5 }}>
                      {getStatusIcon(comp.status)}
                    </Box>
                    <ListItemText
                      primary={
                        <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 200 }}>
                          {comp.mpn}
                        </Typography>
                      }
                      secondary={comp.manufacturer}
                    />
                    <Chip
                      label={getStatusLabel(comp.status)}
                      size="small"
                      color={getStatusColor(comp.status)}
                      variant={comp.status === 'pending' ? 'outlined' : 'filled'}
                      sx={{ fontSize: '0.7rem', minWidth: 70 }}
                    />
                  </ListItem>
                ))}
              </List>
              {components.length > 20 && (
                <Box sx={{ p: 1, textAlign: 'center', bgcolor: 'background.paper' }}>
                  <Typography variant="caption" color="text.secondary">
                    +{components.length - 20} more components
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}

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
              Enrichment failed. Please try again or contact support.
            </Typography>
          </Alert>
        )}

        {/* Stalled Alert */}
        {isStalled && !isComplete && !isFailed && (
          <Alert
            severity="warning"
            sx={{ mt: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={handleRestartEnrichment}
                disabled={isRestarting}
              >
                {isRestarting ? 'Restarting...' : 'Restart Enrichment'}
              </Button>
            }
          >
            <Typography variant="body2">
              Enrichment appears stalled. The workflow may not be running.
            </Typography>
          </Alert>
        )}

        {/* Quick Links */}
        {isComplete && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              component={RouterLink}
              to={`/boms/${bomId}/show`}
              variant="contained"
              size="small"
              startIcon={<OpenInNewIcon />}
            >
              View BOM Details
            </Button>
            <Button
              component={RouterLink}
              to="/risk-dashboard"
              variant="outlined"
              size="small"
              startIcon={<AssessmentIcon />}
            >
              Risk Dashboard
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
  color: 'grey' | 'primary' | 'success' | 'error';
  spinning?: boolean;
}

function StatusCard({ icon, value, label, active, color, spinning = false }: StatusCardProps) {
  const colorMap = {
    grey: { bg: 'background.paper', border: active ? 'action.disabled' : 'divider', text: 'text.secondary', icon: 'action.disabled' },
    primary: { bg: active ? 'primary.50' : 'background.paper', border: active ? 'primary.main' : 'divider', text: 'primary.main', icon: 'action.disabled' },
    success: { bg: active ? 'success.50' : 'background.paper', border: active ? 'success.main' : 'divider', text: 'success.main', icon: 'action.disabled' },
    error: { bg: active ? 'error.50' : 'background.paper', border: active ? 'error.main' : 'divider', text: 'error.main', icon: 'action.disabled' },
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

// Helper functions
function getStatusIcon(status: string) {
  switch (status) {
    case 'pending':
      return <HourglassEmptyIcon sx={{ fontSize: 16, color: 'action.disabled' }} />;
    case 'enriching':
      return <CircularProgress size={16} thickness={4} sx={{ color: 'primary.main' }} />;
    case 'enriched':
      return <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />;
    case 'failed':
      return <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />;
    case 'not_found':
      return <SearchOffIcon sx={{ fontSize: 16, color: 'warning.main' }} />;
    default:
      return <HourglassEmptyIcon sx={{ fontSize: 16, color: 'action.disabled' }} />;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending': return 'Pending';
    case 'enriching': return 'Enriching';
    case 'enriched': return 'Done';
    case 'failed': return 'Failed';
    case 'not_found': return 'Not Found';
    default: return 'Unknown';
  }
}

function getStatusColor(status: string): 'default' | 'primary' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'enriching': return 'primary';
    case 'enriched': return 'success';
    case 'failed': return 'error';
    case 'not_found': return 'warning';
    default: return 'default';
  }
}

export default EnrichmentQueueSection;
