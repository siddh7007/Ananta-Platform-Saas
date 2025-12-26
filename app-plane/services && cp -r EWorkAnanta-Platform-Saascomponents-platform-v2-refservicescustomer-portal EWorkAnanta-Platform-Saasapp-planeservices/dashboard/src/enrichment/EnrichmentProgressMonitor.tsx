/**
 * Enrichment Progress Monitor Component (CNS Dashboard)
 *
 * Real-time BOM enrichment progress display using CNS SSE stream.
 * Shows live progress bar, stats, and component-level updates.
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
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Circle as CircleIcon,
} from '@mui/icons-material';
import { useEnrichmentProgress, EnrichmentEvent } from '../hooks/useEnrichmentProgress';

interface EnrichmentProgressMonitorProps {
  bomId: string;
  onComplete?: (event: EnrichmentEvent) => void;
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

  const handleCompleted = useCallback((event: EnrichmentEvent) => {
    console.log('[Monitor] Enrichment completed:', event);
    onComplete?.(event);
  }, [onComplete]);

  const handleErrorCb = useCallback((err: Error) => {
    console.error('[Monitor] Enrichment error:', err);
    onError?.(err);
  }, [onError]);

  const { state, componentEvents, isConnected, error } = useEnrichmentProgress({
    bomId,
    onCompleted: handleCompleted,
    onError: handleErrorCb,
  });

  // Connection status
  const getConnectionStatus = () => {
    if (error) return { label: 'Error', color: 'error' as const };
    if (!isConnected) return { label: 'Connecting...', color: 'warning' as const };
    return { label: 'Live', color: 'success' as const };
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
        <Stack direction="row" spacing={1}>
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
        <Alert severity="error" sx={{ mb: 2 }}>
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

      {/* Component Events Log */}
      {showDetailedLog && componentEvents.length > 0 && (
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
              Component Details ({componentEvents.length})
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
              }}
            >
              <List dense>
                {componentEvents
                  .slice()
                  .reverse()
                  .map((component, index) => (
                    <ListItem
                      key={`${component.line_item_id}-${index}`}
                      sx={{
                        py: 1,
                        borderBottom: index < componentEvents.length - 1 ? 1 : 0,
                        borderColor: 'divider',
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {component.success ? <CheckCircleIcon color="success" fontSize="small" /> : <ErrorIcon color="error" fontSize="small" />}
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              {component.mpn}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              • {component.manufacturer}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          component.success ? (
                            component.enrichment && (
                              <Typography variant="caption" color="text.secondary">
                                {component.enrichment.supplier && `Supplier: ${component.enrichment.supplier}`}
                                {component.enrichment.price && ` • Price: $${component.enrichment.price}`}
                                {component.enrichment.stock && ` • Stock: ${component.enrichment.stock}`}
                              </Typography>
                            )
                          ) : (
                            <Typography variant="caption" color="error">
                              {component.error || 'Enrichment failed'}
                            </Typography>
                          )
                        }
                      />
                    </ListItem>
                  ))}
              </List>
            </Paper>
          </Collapse>
        </Box>
      )}

      {/* Waiting State */}
      {!state && !error && isConnected && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Waiting for enrichment to start...
        </Alert>
      )}
    </Paper>
  );
};
