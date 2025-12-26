/**
 * Real-Time BOM Job Progress Monitor
 *
 * Displays live progress updates for BOM enrichment jobs using WebSocket.
 * Shows progress bar, item counts, and detailed event log.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  Paper,
  Chip,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import {
  createBOMJobWebSocket,
  BOMJobWebSocketClient,
  ProgressData,
  ItemCompletedData,
  ItemFailedData,
  CompletedData,
  WebSocketMessage,
} from '../services/websocketClient';

interface BOMJobProgressMonitorProps {
  jobId: string;
  onComplete?: (data: CompletedData) => void;
  onError?: (error: string) => void;
  showDetailedLog?: boolean;
}

interface LogEntry {
  id: string;
  timestamp: string;
  event: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export const BOMJobProgressMonitor: React.FC<BOMJobProgressMonitorProps> = ({
  jobId,
  onComplete,
  onError,
  showDetailedLog = false,
}) => {
  const [connected, setConnected] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [enrichedCount, setEnrichedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [currentItem, setCurrentItem] = useState(0);
  const [status, setStatus] = useState<string>('connecting');
  const [message, setMessage] = useState<string>('Connecting to progress stream...');
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [wsClient, setWsClient] = useState<BOMJobWebSocketClient | null>(null);

  const addLogEntry = useCallback((event: string, message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString(),
      event,
      message,
      type,
    };
    setLogEntries(prev => [entry, ...prev].slice(0, 100)); // Keep last 100 entries
  }, []);

  useEffect(() => {
    // Create WebSocket client
    const client = createBOMJobWebSocket(jobId);
    setWsClient(client);

    // Register event handlers
    client.on('connected', (msg: WebSocketMessage) => {
      setConnected(true);
      setStatus('connected');
      setMessage('Connected to job progress stream');
      addLogEntry('connected', 'Connection established', 'success');
    });

    client.on('status_change', (msg: WebSocketMessage) => {
      const data = msg.data;
      setStatus(data.status);
      setMessage(data.message || `Status: ${data.status}`);
      if (data.total_items) {
        setTotalItems(data.total_items);
      }
      addLogEntry('status_change', data.message || `Status changed to ${data.status}`, 'info');
    });

    client.on('progress', (msg: WebSocketMessage) => {
      const data = msg.data as ProgressData;
      setProgress(data.progress);
      setTotalItems(data.total_items);
      setEnrichedCount(data.enriched_count);
      setFailedCount(data.failed_count);
      setCurrentItem(data.current_item);
      setMessage(data.message);
      addLogEntry('progress', `${data.progress}% - ${data.message}`, 'info');
    });

    client.on('item_completed', (msg: WebSocketMessage) => {
      const data = msg.data as ItemCompletedData;
      addLogEntry(
        'item_completed',
        `✅ ${data.mpn} (${data.manufacturer}) - Component: ${data.component_id}`,
        'success'
      );
    });

    client.on('item_failed', (msg: WebSocketMessage) => {
      const data = msg.data as ItemFailedData;
      addLogEntry(
        'item_failed',
        `❌ ${data.mpn} (${data.manufacturer}) - ${data.error}`,
        'error'
      );
    });

    client.on('completed', (msg: WebSocketMessage) => {
      const data = msg.data as CompletedData;
      setStatus(data.status);
      setProgress(100);
      setMessage(data.message);
      addLogEntry('completed', data.message, data.failed_count > 0 ? 'error' : 'success');

      if (onComplete) {
        onComplete(data);
      }
    });

    client.on('error', (msg: WebSocketMessage) => {
      const data = msg.data;
      setStatus('error');
      setMessage(data.message || 'An error occurred');
      addLogEntry('error', `${data.message}: ${data.error}`, 'error');

      if (onError) {
        onError(data.error);
      }
    });

    // Connect
    client.connect().catch((error) => {
      console.error('Failed to connect to WebSocket:', error);
      setConnected(false);
      setStatus('error');
      setMessage('Failed to connect to progress stream');
      addLogEntry('error', 'Connection failed', 'error');
    });

    // Cleanup on unmount
    return () => {
      client.disconnect();
      client.removeAllListeners();
    };
  }, [jobId, onComplete, onError, addLogEntry]);

  const getStatusColor = () => {
    switch (status) {
      case 'completed': return 'success';
      case 'completed_with_errors': return 'warning';
      case 'failed':
      case 'error': return 'error';
      case 'processing': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed': return <CheckCircleIcon color="success" />;
      case 'completed_with_errors': return <CheckCircleIcon color="warning" />;
      case 'failed':
      case 'error': return <ErrorIcon color="error" />;
      default: return null;
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="h3">
          BOM Enrichment Progress
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            label={connected ? 'Live' : 'Disconnected'}
            color={connected ? 'success' : 'error'}
            size="small"
            variant="outlined"
          />
          <Chip
            label={status}
            color={getStatusColor()}
            size="small"
            icon={getStatusIcon()}
          />
        </Box>
      </Box>

      {/* Progress Bar */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box sx={{ flex: 1, mr: 2 }}>
            <LinearProgress
              variant="determinate"
              value={progress}
              color={status === 'error' ? 'error' : 'primary'}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 50, textAlign: 'right' }}>
            {progress}%
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      </Box>

      {/* Stats */}
      {totalItems > 0 && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label={`Total: ${totalItems}`}
            variant="outlined"
            size="small"
          />
          <Chip
            label={`Processing: ${currentItem}/${totalItems}`}
            color="info"
            variant="outlined"
            size="small"
          />
          <Chip
            label={`Enriched: ${enrichedCount}`}
            color="success"
            variant="outlined"
            size="small"
          />
          {failedCount > 0 && (
            <Chip
              label={`Failed: ${failedCount}`}
              color="error"
              variant="outlined"
              size="small"
            />
          )}
        </Box>
      )}

      {/* Detailed Log */}
      {showDetailedLog && (
        <Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              mb: 1,
            }}
            onClick={() => setShowLog(!showLog)}
          >
            <Typography variant="subtitle2">
              Event Log ({logEntries.length})
            </Typography>
            <IconButton size="small">
              {showLog ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>

          <Collapse in={showLog}>
            <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto', p: 1 }}>
              {logEntries.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No events yet
                </Typography>
              ) : (
                <List dense>
                  {logEntries.map((entry) => (
                    <ListItem key={entry.id} sx={{ py: 0.5 }}>
                      <ListItemText
                        primary={
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              color: entry.type === 'error' ? 'error.main' :
                                     entry.type === 'success' ? 'success.main' :
                                     'text.primary'
                            }}
                          >
                            [{entry.timestamp}] {entry.event}: {entry.message}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Collapse>
        </Box>
      )}
    </Paper>
  );
};
