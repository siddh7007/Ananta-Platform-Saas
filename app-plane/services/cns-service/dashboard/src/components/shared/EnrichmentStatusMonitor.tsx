/**
 * EnrichmentStatusMonitor - Component that uses useEnrichmentPolling with user notifications
 *
 * Demonstrates best practices for using the polling hook with:
 * - Connection status badge
 * - Error notifications
 * - Loading states
 *
 * Usage:
 *   <EnrichmentStatusMonitor bomId="123" onCompleted={() => console.log('Done!')} />
 */
import React, { useEffect } from 'react';
import { Box, Alert, LinearProgress, Typography } from '@mui/material';
import { useEnrichmentPolling, UseEnrichmentPollingOptions } from '../../hooks/useEnrichmentPolling';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';

export interface EnrichmentStatusMonitorProps extends Omit<UseEnrichmentPollingOptions, 'bomId'> {
  bomId: string;
  /** Show connection status badge */
  showConnectionStatus?: boolean;
  /** Show progress bar */
  showProgress?: boolean;
  /** Custom error message handler */
  onError?: (error: Error, failureCount: number) => void;
}

export const EnrichmentStatusMonitor: React.FC<EnrichmentStatusMonitorProps> = ({
  bomId,
  showConnectionStatus = true,
  showProgress = true,
  onError,
  ...pollingOptions
}) => {
  const {
    state,
    isPolling,
    error,
    failureCount,
    lastUpdate,
    isConnected,
  } = useEnrichmentPolling({
    bomId,
    ...pollingOptions,
  });

  // Show error notification when connection is lost
  useEffect(() => {
    if (!isConnected && failureCount >= 3) {
      if (onError && error) {
        onError(error, failureCount);
      }
    }
  }, [isConnected, failureCount, error, onError]);

  if (!state) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="textSecondary">
          Loading enrichment status...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Connection Status Badge */}
      {showConnectionStatus && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <ConnectionStatusBadge
            isConnected={isConnected}
            failureCount={failureCount}
            lastUpdate={lastUpdate}
            isPolling={isPolling}
          />
          {!isConnected && (
            <Typography variant="caption" color="error">
              Unable to fetch enrichment status. Please check your connection or refresh the page.
            </Typography>
          )}
        </Box>
      )}

      {/* Error Alert */}
      {error && !isConnected && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <strong>Connection Error:</strong> {error.message}
          <br />
          <Typography variant="caption">
            Failed {failureCount} consecutive attempts. Please refresh the page or contact support.
          </Typography>
        </Alert>
      )}

      {/* Progress Bar */}
      {showProgress && state.status !== 'completed' && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">
              Enriching components...
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {state.percent_complete}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={state.percent_complete}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <Typography variant="caption" color="textSecondary">
              {state.enriched_items} / {state.total_items} enriched
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {state.pending_items} pending
            </Typography>
          </Box>
        </Box>
      )}

      {/* Status Info */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="textSecondary">
          Status: <strong>{state.status}</strong>
        </Typography>
        {state.failed_items > 0 && (
          <Typography variant="caption" color="error">
            Failed: <strong>{state.failed_items}</strong>
          </Typography>
        )}
        {state.not_found_items !== undefined && state.not_found_items > 0 && (
          <Typography variant="caption" color="warning.main">
            Not Found: <strong>{state.not_found_items}</strong>
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default EnrichmentStatusMonitor;
