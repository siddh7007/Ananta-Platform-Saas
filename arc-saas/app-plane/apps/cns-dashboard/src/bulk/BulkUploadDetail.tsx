/**
 * Bulk Upload Detail - Individual Upload View
 *
 * Shows detailed information about a specific bulk upload from Redis
 * Real-time progress monitoring for enrichment
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  Alert,
  LinearProgress,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Divider,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  PlayArrow as StartIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CloudQueue as RedisIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { API_CONFIG, getAdminAuthHeaders } from '../config/api';
import { useNotification } from '../contexts/NotificationContext';
import { useTenant } from '../contexts/TenantContext';

interface BulkUploadDetail {
  upload_id: string;
  filename: string;
  workflow_id?: string;
  status: string;
  progress: {
    total_items: number;
    enriched_items: number;
    failed_items: number;
    pending_items: number;
    percent_complete: number;
    last_updated?: string;
  };
  workflow_status?: string;
  storage: string;
  created_at: string;
  enrichment_started_at?: string;
  redis_expires_at?: string;
}

export const BulkUploadDetail = () => {
  const { uploadId } = useParams<{ uploadId: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const { tenantId } = useTenant();

  const [upload, setUpload] = useState<BulkUploadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchUploadStatus = async () => {
    if (!uploadId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/bulk/enrichment/${uploadId}/status`, {
        headers: getAdminAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Upload not found in Redis (may have expired)');
        }
        throw new Error('Failed to fetch upload status');
      }

      const data = await response.json();
      setUpload(data);
    } catch (err: any) {
      console.error('Failed to fetch upload status:', err);
      setError(err.message || 'Failed to fetch upload status');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchUploadStatus();
  }, [uploadId]);

  // Auto-refresh every 5 seconds when enriching
  useEffect(() => {
    if (upload?.status === 'enriching' || autoRefresh) {
      const interval = setInterval(fetchUploadStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [upload?.status, autoRefresh]);

  const handleStartEnrichment = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/bulk/enrichment/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          upload_id: uploadId,
          tenant_id: tenantId,
          priority: 7,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start enrichment');
      }

      showSuccess('Enrichment started successfully!');
      setAutoRefresh(true);
      fetchUploadStatus();
    } catch (err: any) {
      showError(`Failed to start enrichment: ${err.message}`);
    }
  };

  const handlePause = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/bulk/enrichment/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          upload_id: uploadId,
          reason: 'Staff paused from dashboard',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to pause enrichment');
      }

      showSuccess('Enrichment paused successfully!');
      fetchUploadStatus();
    } catch (err: any) {
      showError(`Failed to pause enrichment: ${err.message}`);
    }
  };

  const handleResume = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/bulk/enrichment/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          upload_id: uploadId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resume enrichment');
      }

      showSuccess('Enrichment resumed successfully!');
      setAutoRefresh(true);
      fetchUploadStatus();
    } catch (err: any) {
      showError(`Failed to resume enrichment: ${err.message}`);
    }
  };

  const handleStop = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/bulk/enrichment/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          upload_id: uploadId,
          reason: 'Staff stopped from dashboard',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to stop enrichment');
      }

      showSuccess('Enrichment stopped successfully!');
      setAutoRefresh(false);
      fetchUploadStatus();
    } catch (err: any) {
      showError(`Failed to stop enrichment: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete enrichment job? This will cancel the workflow and remove all Redis data.')) {
      return;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/bulk/enrichment/${uploadId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete enrichment job');
      }

      showSuccess('Enrichment job deleted successfully!');
      navigate('/bulk-uploads');
    } catch (err: any) {
      showError(`Failed to delete enrichment job: ${err.message}`);
    }
  };

  const getStatusChip = (status: string) => {
    const statusConfig: Record<
      string,
      { color: 'success' | 'warning' | 'error' | 'info' | 'default'; label: string }
    > = {
      completed: { color: 'success', label: 'Completed' },
      enriching: { color: 'info', label: 'Enriching' },
      paused: { color: 'warning', label: 'Paused' },
      cancelled: { color: 'error', label: 'Cancelled' },
      failed: { color: 'error', label: 'Failed' },
    };

    const config = statusConfig[status] || { color: 'default', label: status };
    return <Chip label={config.label} color={config.color} />;
  };

  if (error) {
    return (
      <Box p={3}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/bulk-uploads')} sx={{ mb: 2 }}>
          Back to Bulk Uploads
        </Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (loading && !upload) {
    return (
      <Box p={3}>
        <LinearProgress />
        <Typography variant="body2" color="textSecondary" sx={{ mt: 2, textAlign: 'center' }}>
          Loading upload details...
        </Typography>
      </Box>
    );
  }

  if (!upload) {
    return null;
  }

  const { progress } = upload;
  const isEnriching = upload.status === 'enriching';
  const isPaused = upload.status === 'paused';
  const successRate =
    progress.total_items > 0
      ? ((progress.enriched_items / (progress.enriched_items + progress.failed_items)) * 100).toFixed(1)
      : '0';

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/bulk-uploads')} sx={{ mb: 1 }}>
            Back to Bulk Uploads
          </Button>
          <Typography variant="h4" gutterBottom>
            {upload.filename}
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <RedisIcon color="primary" fontSize="small" />
            <Typography variant="body2" color="textSecondary">
              Redis Storage • Upload ID: {upload.upload_id.substring(0, 8)}
            </Typography>
          </Box>
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchUploadStatus}
            disabled={loading}
          >
            Refresh
          </Button>
          {autoRefresh && isEnriching && (
            <Chip
              label="Auto-refreshing (5s)"
              color="info"
              size="small"
              icon={<SpeedIcon />}
              sx={{ ml: 1 }}
            />
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Status Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Status
              </Typography>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                {getStatusChip(upload.status)}
                {upload.workflow_status && (
                  <Chip label={`Workflow: ${upload.workflow_status}`} size="small" variant="outlined" />
                )}
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Uploaded</TableCell>
                      <TableCell>{new Date(upload.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                    {upload.enrichment_started_at && (
                      <TableRow>
                        <TableCell>Enrichment Started</TableCell>
                        <TableCell>{new Date(upload.enrichment_started_at).toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell>Storage</TableCell>
                      <TableCell>
                        <Chip label="Redis (Temporary)" size="small" color="primary" />
                      </TableCell>
                    </TableRow>
                    {upload.workflow_id && (
                      <TableRow>
                        <TableCell>Workflow ID</TableCell>
                        <TableCell>
                          <Typography variant="caption">{upload.workflow_id}</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Progress Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Enrichment Progress
              </Typography>

              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Overall Progress</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {progress.percent_complete.toFixed(1)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={progress.percent_complete}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box textAlign="center" p={1} bgcolor="grey.100" borderRadius={1}>
                    <Typography variant="h5" color="success.main">
                      {progress.enriched_items}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Enriched
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center" p={1} bgcolor="grey.100" borderRadius={1}>
                    <Typography variant="h5" color="error.main">
                      {progress.failed_items}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Failed
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center" p={1} bgcolor="grey.100" borderRadius={1}>
                    <Typography variant="h5" color="warning.main">
                      {progress.pending_items}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Pending
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center" p={1} bgcolor="grey.100" borderRadius={1}>
                    <Typography variant="h5">{progress.total_items}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Total Items
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {progress.failed_items > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    Success Rate: <strong>{successRate}%</strong>
                  </Typography>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Control Panel */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Enrichment Controls
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Box display="flex" gap={2}>
                {!isEnriching && !isPaused && (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<StartIcon />}
                    onClick={handleStartEnrichment}
                    size="large"
                  >
                    Start Enrichment
                  </Button>
                )}

                {isEnriching && (
                  <Button
                    variant="contained"
                    color="warning"
                    startIcon={<PauseIcon />}
                    onClick={handlePause}
                    size="large"
                  >
                    Pause
                  </Button>
                )}

                {isPaused && (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<StartIcon />}
                    onClick={handleResume}
                    size="large"
                  >
                    Resume
                  </Button>
                )}

                {(isEnriching || isPaused) && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<StopIcon />}
                    onClick={handleStop}
                    size="large"
                  >
                    Stop
                  </Button>
                )}

                <Box flex={1} />

                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDelete}
                  size="large"
                >
                  Delete Job
                </Button>
              </Box>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Controls:</strong> Start triggers Temporal workflow. Pause/Resume send signals to
                  workflow. Stop cancels workflow. Delete removes all Redis data.
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
