/**
 * Enrichment Progress Monitor Component (CNS Dashboard)
 *
 * BOM enrichment progress display using polling-based updates.
 * Shows live progress bar, stats, and component-level updates.
 *
 * NOTE: Converted from SSE to polling since Supabase Realtime is no longer used.
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  Paper,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Collapse,
  Stack,
  Button,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Circle as CircleIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useEnrichmentPolling, EnrichmentState } from '../hooks';

interface EnrichmentProgressMonitorProps {
  bomId: string;
  onComplete?: (state: EnrichmentState) => void;
  onError?: (error: Error) => void;
  showDetailedLog?: boolean;
}

export const EnrichmentProgressMonitor: React.FC<EnrichmentProgressMonitorProps> = ({
  bomId,
  onComplete,
  onError,
  showDetailedLog = true,
}) => {
  const [showComponentLog, setShowComponentLog] = useState(false);

  const handleCompleted = useCallback((state: EnrichmentState) => {
    console.log('[Monitor] Enrichment completed:', state);
    onComplete?.(state);
  }, [onComplete]);

  const handleFailed = useCallback((state: EnrichmentState) => {
    console.error('[Monitor] Enrichment failed:', state);
    onError?.(new Error('Enrichment failed'));
  }, [onError]);

  const { state, isPolling, error, refresh } = useEnrichmentPolling({
    bomId,
    pollInterval: 2000,
    enabled: true,
    onCompleted: handleCompleted,
    onFailed: handleFailed,
  });

  // Connection status (polling-based)
  const getConnectionStatus = () => {
    if (error) return { label: 'Error', color: 'error' as const };
    if (!isPolling) return { label: 'Stopped', color: 'warning' as const };
    return { label: 'Polling', color: 'success' as const };
  };

  // Enrichment status
  const getEnrichmentStatus = () => {
    if (!state) return { label: 'Waiting...', color: 'default' as const, icon: null };

    switch (state.status) {
      case 'completed':
        return {
          label: 'Completed',
          color: 'success' as const,
          icon: <CheckCircleIcon color="success" />,
        };
      case 'enriching':
        return {
          label: 'Enriching',
          color: 'info' as const,
          icon: <CircleIcon color="info" sx={{ animation: 'pulse 2s infinite' }} />,
        };
      case 'failed':
        return {
          label: 'Failed',
          color: 'error' as const,
          icon: <ErrorIcon color="error" />,
        };
      case 'paused':
        return {
          label: 'Paused',
          color: 'warning' as const,
          icon: null,
        };
      default:
        return {
          label: state.status,
          color: 'default' as const,
          icon: null,
        };
    }
  };

  const connectionStatus = getConnectionStatus();
  const enrichmentStatus = getEnrichmentStatus();
  const progress = state?.percent_complete || 0;

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="h3">
          BOM Enrichment Progress
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={refresh}
          >
            Refresh
          </Button>
          <Chip label={connectionStatus.label} color={connectionStatus.color} size="small" variant="outlined" />
          <Chip
            label={enrichmentStatus.label}
            color={enrichmentStatus.color}
            size="small"
            {...(enrichmentStatus.icon && { icon: enrichmentStatus.icon })}
          />
        </Stack>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={refresh}>
              Retry
            </Button>
          }
        >
          {error.message}
        </Alert>
      )}

      {/* Progress Bar */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box sx={{ flex: 1, mr: 2 }}>
            <LinearProgress variant="determinate" value={progress} color={enrichmentStatus.color === 'error' ? 'error' : 'primary'} sx={{ height: 10, borderRadius: 5 }} />
          </Box>
          <Typography variant="body1" fontWeight="bold" color="text.secondary" sx={{ minWidth: 60, textAlign: 'right' }}>
            {progress.toFixed(1)}%
          </Typography>
        </Box>

        {state && (
          <Typography variant="body2" color="text.secondary">
            {state.enriched_items} of {state.total_items} components enriched
            {state.failed_items > 0 && ` • ${state.failed_items} failed`}
          </Typography>
        )}
      </Box>

      {/* Stats Chips */}
      {state && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip label={`Total: ${state.total_items}`} variant="outlined" size="small" />
          <Chip label={`Enriched: ${state.enriched_items}`} color="success" variant="outlined" size="small" />
          <Chip label={`Pending: ${state.pending_items}`} color="info" variant="outlined" size="small" />
          {state.failed_items > 0 && <Chip label={`Failed: ${state.failed_items}`} color="error" variant="outlined" size="small" />}
          {state.not_found_items && state.not_found_items > 0 && <Chip label={`Not Found: ${state.not_found_items}`} color="warning" variant="outlined" size="small" />}
        </Box>
      )}

      {/* Component Events Log - Placeholder for detailed log (removed SSE component events) */}
      {showDetailedLog && state && (state.enriched_items > 0 || state.failed_items > 0) && (
        <Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              mb: 1,
              '&:hover': { bgcolor: 'action.hover' },
              p: 0.5,
              borderRadius: 1,
            }}
            onClick={() => setShowComponentLog(!showComponentLog)}
          >
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              Enrichment Summary
            </Typography>
            <IconButton size="small">{showComponentLog ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
          </Box>

          <Collapse in={showComponentLog}>
            <Paper
              variant="outlined"
              sx={{
                maxHeight: 300,
                overflow: 'auto',
                bgcolor: 'grey.50',
                p: 2,
              }}
            >
              <List dense>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleIcon color="success" fontSize="small" />
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          Successfully Enriched
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {state.enriched_items} components enriched successfully
                      </Typography>
                    }
                  />
                </ListItem>
                {state.failed_items > 0 && (
                  <ListItem>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ErrorIcon color="error" fontSize="small" />
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            Failed Components
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="error">
                          {state.failed_items} components could not be enriched
                        </Typography>
                      }
                    />
                  </ListItem>
                )}
                {state.not_found_items && state.not_found_items > 0 && (
                  <ListItem>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ErrorIcon color="warning" fontSize="small" />
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            Not Found
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {state.not_found_items} components not found in supplier databases
                        </Typography>
                      }
                    />
                  </ListItem>
                )}
                {state.pending_items > 0 && (
                  <ListItem>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CircleIcon color="info" fontSize="small" />
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            Pending
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {state.pending_items} components waiting to be enriched
                        </Typography>
                      }
                    />
                  </ListItem>
                )}
              </List>
            </Paper>
          </Collapse>
        </Box>
      )}

      {/* Waiting State */}
      {!state && !error && isPolling && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Waiting for enrichment to start...
        </Alert>
      )}
    </Paper>
  );
};
