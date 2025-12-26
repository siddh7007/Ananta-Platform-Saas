/**
 * EnrichmentMonitorPanel Component
 *
 * Complete enrichment monitoring panel using SSE for real-time updates.
 * Combines progress bar, stage indicator, stats, and component feed.
 * Can be used standalone or embedded in workflows.
 *
 * Usage:
 * ```tsx
 * <EnrichmentMonitorPanel
 *   bomId={bomId}
 *   onComplete={(state) => console.log('Done!', state)}
 * />
 * ```
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Button,
  Stack,
  Collapse,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Divider,
  Paper,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Refresh,
  WifiOff,
  Wifi,
  Poll,
  Stream,
  CheckCircle,
  Error as ErrorIcon,
  HourglassEmpty,
} from '@mui/icons-material';
import { useEnrichmentStream } from '../../../hooks/useEnrichmentStream';
import type { EnrichmentState } from '../../../hooks/useEnrichmentStream';
import { EnrichmentProgressBar } from './EnrichmentProgressBar';
import { EnrichmentStageIndicator } from './EnrichmentStageIndicator';
import { EnrichmentStats } from './EnrichmentStats';

interface EnrichmentMonitorPanelProps {
  bomId: string;
  filename?: string;
  enabled?: boolean;
  showStats?: boolean;
  showComponentFeed?: boolean;
  showStage?: boolean;
  onComplete?: (state: EnrichmentState) => void;
  onError?: (error: Error) => void;
}

export const EnrichmentMonitorPanel: React.FC<EnrichmentMonitorPanelProps> = ({
  bomId,
  filename,
  enabled = true,
  showStats = true,
  showComponentFeed = true,
  showStage = true,
  onComplete,
  onError,
}) => {
  const [showComponentLog, setShowComponentLog] = useState(false);
  const [showStatsDetail, setShowStatsDetail] = useState(false);

  const {
    state,
    components,
    isConnected,
    isPolling,
    error,
    reconnect,
    retryCount,
  } = useEnrichmentStream({
    bomId,
    enabled,
    onComplete,
    onError,
  });

  // Connection status indicator
  const getConnectionStatus = () => {
    if (error) {
      return {
        label: 'Connection Error',
        color: 'error' as const,
        icon: <WifiOff fontSize="small" />,
      };
    }
    if (isPolling) {
      return {
        label: 'Polling Mode',
        color: 'warning' as const,
        icon: <Poll fontSize="small" />,
      };
    }
    if (isConnected) {
      return {
        label: 'Live Stream',
        color: 'success' as const,
        icon: <Stream fontSize="small" />,
      };
    }
    return {
      label: 'Connecting...',
      color: 'default' as const,
      icon: <CircularProgress size={16} />,
    };
  };

  const connectionStatus = getConnectionStatus();

  // Enrichment status
  const enrichmentStatus = state?.status || 'idle';
  const isComplete = enrichmentStatus === 'completed';
  const isFailed = enrichmentStatus === 'failed';
  const isEnriching = enrichmentStatus === 'enriching';

  return (
    <Card
      variant="outlined"
      sx={{
        border: '2px solid',
        borderColor: isComplete ? 'success.main' : isFailed ? 'error.main' : isEnriching ? 'primary.main' : 'divider',
      }}
    >
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6">
              Enrichment Progress
            </Typography>
            {filename && (
              <Typography variant="caption" color="text.secondary">
                {filename}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {/* Connection status */}
            <Chip
              icon={connectionStatus.icon}
              label={connectionStatus.label}
              size="small"
              color={connectionStatus.color}
              variant="outlined"
            />

            {/* Reconnect button */}
            {(error || retryCount > 0) && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Refresh />}
                onClick={reconnect}
              >
                Reconnect
              </Button>
            )}
          </Stack>
        </Box>

        {/* Error alert */}
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={reconnect}>
                Retry
              </Button>
            }
          >
            {error.message}
            {isPolling && ' - Using polling fallback for updates.'}
          </Alert>
        )}

        {/* Fallback mode info */}
        {isPolling && !error && (
          <Alert severity="info" sx={{ mb: 2 }} icon={<Poll />}>
            Real-time updates unavailable. Using polling mode (updates every 3 seconds).
          </Alert>
        )}

        {/* Progress bar */}
        <Box sx={{ mb: 2 }}>
          <EnrichmentProgressBar state={state} showStats={true} animated={true} />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Stage indicator */}
        {showStage && state && (
          <Box sx={{ mb: 2 }}>
            <EnrichmentStageIndicator
              state={state}
              showBatchProgress={true}
              compact={false}
            />
          </Box>
        )}

        {/* Stats section */}
        {showStats && state && (
          <Box sx={{ mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                p: 1,
                borderRadius: 1,
                '&:hover': { bgcolor: 'action.hover' },
              }}
              onClick={() => setShowStatsDetail(!showStatsDetail)}
            >
              <Typography variant="subtitle2">
                Detailed Statistics
              </Typography>
              <IconButton size="small">
                {showStatsDetail ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
            <Collapse in={showStatsDetail}>
              <Box sx={{ mt: 1 }}>
                <EnrichmentStats
                  state={state}
                  showTiming={true}
                  showQuality={true}
                  variant="detailed"
                />
              </Box>
            </Collapse>
          </Box>
        )}

        {/* Component feed */}
        {showComponentFeed && components.length > 0 && (
          <Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                p: 1,
                borderRadius: 1,
                '&:hover': { bgcolor: 'action.hover' },
              }}
              onClick={() => setShowComponentLog(!showComponentLog)}
            >
              <Typography variant="subtitle2">
                Recent Components ({components.length})
              </Typography>
              <IconButton size="small">
                {showComponentLog ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>

            <Collapse in={showComponentLog}>
              <Paper
                variant="outlined"
                sx={{
                  mt: 1,
                  maxHeight: 300,
                  overflow: 'auto',
                }}
              >
                <List dense disablePadding>
                  {components.slice().reverse().map((component, idx) => (
                    <ListItem
                      key={`${component.line_item_id}-${idx}`}
                      sx={{
                        borderBottom: idx < components.length - 1 ? 1 : 0,
                        borderColor: 'divider',
                        bgcolor: component.status === 'enriched' ? 'success.50' : component.status === 'failed' ? 'error.50' : 'transparent',
                      }}
                    >
                      <Box sx={{ mr: 1.5 }}>
                        {getComponentStatusIcon(component.status)}
                      </Box>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight={500} noWrap>
                              {component.mpn}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {component.manufacturer}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          component.status === 'enriched' && component.enrichment_data ? (
                            <Typography variant="caption" color="text.secondary">
                              {component.enrichment_data.supplier}
                              {component.enrichment_data.price && ` • $${component.enrichment_data.price}`}
                              {component.enrichment_data.stock !== undefined && ` • Stock: ${component.enrichment_data.stock}`}
                            </Typography>
                          ) : component.status === 'failed' && component.error_message ? (
                            <Typography variant="caption" color="error">
                              {component.error_message}
                            </Typography>
                          ) : null
                        }
                      />
                      <Chip
                        label={component.status}
                        size="small"
                        color={getComponentStatusColor(component.status)}
                        variant="filled"
                        sx={{ fontSize: '0.7rem', minWidth: 70 }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Collapse>
          </Box>
        )}

        {/* Completion message */}
        {isComplete && state && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Successfully enriched {state.enriched_items} of {state.total_items} components
            {state.failed_items > 0 && ` (${state.failed_items} failed)`}.
          </Alert>
        )}

        {/* Failure message */}
        {isFailed && state && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Enrichment failed: {state.error_message || 'Unknown error'}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

function getComponentStatusIcon(status: string) {
  switch (status) {
    case 'enriched':
      return <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />;
    case 'failed':
    case 'not_found':
      return <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />;
    case 'enriching':
      return <CircularProgress size={16} thickness={4} />;
    default:
      return <HourglassEmpty sx={{ fontSize: 16, color: 'action.disabled' }} />;
  }
}

function getComponentStatusColor(status: string): 'default' | 'primary' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'enriched':
      return 'success';
    case 'failed':
      return 'error';
    case 'not_found':
      return 'warning';
    case 'enriching':
      return 'primary';
    default:
      return 'default';
  }
}
