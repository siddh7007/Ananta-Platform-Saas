/**
 * BOMEnrichmentPanel Component
 *
 * Inline panel showing enrichment progress via polling.
 * Shows per-component queue with enrichment and analysis events.
 * More reliable than SSE, no CORS issues.
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  Collapse,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import QueueIcon from '@mui/icons-material/Queue';
import { useEnrichmentPolling, type EnrichmentState } from '../../hooks/useEnrichmentPolling';
import { useEnrichmentQueue } from '../../hooks/useEnrichmentQueue';
import { EnrichmentQueueMetrics } from './EnrichmentQueueMetrics';
import { EnrichmentQueueList } from './EnrichmentQueueItem';

interface BOMEnrichmentPanelProps {
  bomId: string;
  onComplete?: (state: EnrichmentState) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: { percent: number; enriched: number; total: number }) => void;
  onCancel?: () => void;
}

export function BOMEnrichmentPanel({ bomId, onComplete, onError, onProgress, onCancel }: BOMEnrichmentPanelProps) {
  const [showQueue, setShowQueue] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const completionRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to panel on mount
  useEffect(() => {
    console.log('[BOMEnrichmentPanel] Mounted with bomId:', bomId);
    // Scroll panel into view when it mounts
    if (panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      console.debug('[BOMEnrichmentPanel] Auto-scrolled to panel');
    }
    return () => {
      console.log('[BOMEnrichmentPanel] Unmounting');
    };
  }, [bomId]);

  // Use polling-based progress (more reliable than SSE)
  const { state, isPolling, error, refresh } = useEnrichmentPolling({
    bomId,
    pollInterval: 2000, // Poll every 2 seconds
    onProgress: (newState) => {
      console.debug('[BOMEnrichmentPanel] Progress update:', {
        percent: newState.percent_complete,
        enriched: newState.enriched_items,
        total: newState.total_items,
        status: newState.status,
      });
      // Report progress to parent for stepper update
      onProgress?.({
        percent: newState.percent_complete,
        enriched: newState.enriched_items,
        total: newState.total_items,
      });
    },
    onCompleted: (newState) => {
      console.log('[BOMEnrichmentPanel] Enrichment completed:', {
        enriched: newState.enriched_items,
        failed: newState.failed_items,
        total: newState.total_items,
      });
      onComplete?.(newState);
    },
    onFailed: (newState) => {
      console.error('[BOMEnrichmentPanel] Enrichment failed:', newState);
      onError?.(new Error('Enrichment failed'));
    },
  });

  // Use enrichment queue for per-component tracking
  const {
    components,
    metrics: queueMetrics,
    analysisMetrics,
    error: queueError,
  } = useEnrichmentQueue({
    bomId,
    pollInterval: 3000, // Slightly slower than main polling
    enabled: !!bomId,
  });

  // Log queue errors for debugging
  React.useEffect(() => {
    if (queueError) {
      console.warn('[BOMEnrichmentPanel] Queue error:', queueError.message);
    }
  }, [queueError]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!state) return null;

    // Calculate success rate (enriched out of completed items)
    const completedItems = state.enriched_items + (state.failed_items || 0);
    const successRate = completedItems > 0
      ? (state.enriched_items / completedItems) * 100
      : 100;

    // Calculate ETA based on processing rate
    // Assume ~2 seconds per component based on polling interval
    const remainingItems = Math.max(0, state.total_items - state.enriched_items - (state.failed_items || 0));
    const eta = remainingItems > 0 && state.enriched_items > 0
      ? Math.ceil(remainingItems * 2) // ~2 seconds per component estimate
      : null;

    console.debug('[BOMEnrichmentPanel] Stats calculated:', {
      successRate: successRate.toFixed(1),
      eta,
      remainingItems,
    });

    return { successRate, eta };
  }, [state]);

  // Auto-scroll to completion message when enrichment finishes
  const isComplete = state?.status === 'completed';
  const isFailed = state?.status === 'failed';

  useEffect(() => {
    if ((isComplete || isFailed) && completionRef.current) {
      // Small delay to let the completion UI render
      setTimeout(() => {
        completionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        console.debug('[BOMEnrichmentPanel] Auto-scrolled to completion');
      }, 100);
    }
  }, [isComplete, isFailed]);

  if (!state && isPolling && !error) {
    return (
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={24} />
            <Typography>Loading enrichment status...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert
        severity="warning"
        sx={{ mt: 2 }}
        action={
          <Button color="inherit" size="small" onClick={refresh} startIcon={<RefreshIcon />}>
            Retry
          </Button>
        }
      >
        <Typography variant="body2">
          Failed to load status. The enrichment may still be running in the background.
        </Typography>
      </Alert>
    );
  }

  return (
    <Card
      ref={panelRef}
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
            <AutoFixHighIcon color={isComplete ? 'success' : 'primary'} />
            <Typography variant="h6">
              {isComplete ? 'Enrichment Complete' : isFailed ? 'Enrichment Failed' : 'Enriching Components'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            {isPolling && !isComplete && !isFailed && (
              <Chip
                icon={<RefreshIcon sx={{ animation: 'spin 2s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />}
                label="Polling"
                color="info"
                size="small"
                variant="outlined"
              />
            )}
            <Chip
              label={state?.status || 'loading'}
              color={isComplete ? 'success' : isFailed ? 'error' : 'primary'}
              size="small"
            />
          </Stack>
        </Box>

        {/* Queue Metrics with Analysis */}
        {queueMetrics.total > 0 && (
          <Box sx={{ mb: 2 }}>
            <EnrichmentQueueMetrics
              metrics={queueMetrics}
              analysisMetrics={analysisMetrics}
              showAnalysis={true}
            />
          </Box>
        )}

        {/* Batch Info */}
        {state?.current_batch && state?.total_batches && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Processing batch {state.current_batch} of {state.total_batches}
            {stats?.eta && ` • ~${stats.eta}s remaining`}
          </Typography>
        )}

        {/* Component Queue Toggle */}
        {components.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Button
              variant="text"
              size="small"
              startIcon={<QueueIcon />}
              endIcon={showQueue ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setShowQueue(!showQueue)}
              sx={{ mb: 1 }}
            >
              {showQueue ? 'Hide' : 'Show'} Component Queue ({components.length})
            </Button>
            <Collapse in={showQueue}>
              <EnrichmentQueueList
                components={components}
                maxItems={15}
                showQualityScore={true}
                title="Component Enrichment Queue"
              />
            </Collapse>
          </Box>
        )}

        {/* Pending Items Info */}
        {state && state.pending_items > 0 && !isComplete && !isFailed && !showQueue && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {state.pending_items} components waiting to be enriched...
          </Typography>
        )}

        {/* Completion Message - with auto-scroll ref */}
        <Box ref={completionRef}>
          {isComplete && (
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Successfully enriched {state?.enriched_items} components.
                {state?.failed_items ? ` ${state.failed_items} components could not be enriched.` : ''}
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
        </Box>

        {/* Back Button - allows returning to upload view */}
        {onCancel && !isComplete && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-start' }}>
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={onCancel}
            >
              Back to Upload
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 2, alignSelf: 'center' }}>
              Enrichment continues in background
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default BOMEnrichmentPanel;
