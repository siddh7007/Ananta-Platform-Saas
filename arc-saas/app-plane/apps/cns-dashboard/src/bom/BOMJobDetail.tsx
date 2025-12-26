import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  LinearProgress,
  Chip,
  Alert,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  CircularProgress,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import { CNS_API_URL, getAdminAuthHeaders } from '../config/api';

interface BOMJobStatus {
  job_id: string;
  status: string;
  progress: number;
  total_items: number;
  items_processed: number;
  items_auto_approved: number;
  items_in_staging: number;
  items_rejected: number;
  items_failed: number;
  started_at: string | null;
  completed_at: string | null;
  processing_time_ms: number | null;
  error_message: string | null;
}

interface BOMItem {
  mpn: string;
  manufacturer: string | null;
  quality_score: number;
  routing: string;
  issues: string[];
  catalog_id: number | null;
}

interface BOMResults {
  job_id: string;
  status: string;
  total_items: number;
  results: BOMItem[];
}

/**
 * BOM Job Detail Component
 *
 * Features:
 * - Real-time job status updates
 * - Progress tracking with visual indicators
 * - Detailed results breakdown
 * - Item-by-item routing display
 * - Quality score visualization
 * - Auto-refresh for in-progress jobs
 */
export const BOMJobDetail: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const [status, setStatus] = useState<BOMJobStatus | null>(null);
  const [results, setResults] = useState<BOMResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh] = useState(true);

  // Load job status
  const loadStatus = async () => {
    if (!jobId) return;

    try {
      const headers = getAdminAuthHeaders();
      const response = await fetch(`${CNS_API_URL}/bom/status/${jobId}`, {
        headers: headers ? new Headers(headers) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to load job status');
      }

      const data: BOMJobStatus = await response.json();
      setStatus(data);

      // If job is completed, load results
      if (data.status === 'completed') {
        loadResults();
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job status');
    } finally {
      setLoading(false);
    }
  };

  // Load job results (only for completed jobs)
  const loadResults = async () => {
    if (!jobId) return;

    try {
      const headers = getAdminAuthHeaders();
      const response = await fetch(`${CNS_API_URL}/bom/results/${jobId}`, {
        headers: headers ? new Headers(headers) : undefined,
      });

      if (!response.ok) {
        // Results not ready yet
        return;
      }

      const data: BOMResults = await response.json();
      setResults(data);
    } catch (err) {
      console.error('Failed to load results:', err);
    }
  };

  // Auto-refresh for in-progress jobs
  useEffect(() => {
    loadStatus();

    if (autoRefresh && status?.status === 'processing') {
      const interval = setInterval(loadStatus, 3000); // Refresh every 3 seconds
      return () => clearInterval(interval);
    }
  }, [jobId, autoRefresh, status?.status]);

  // Get status color
  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'info' | 'default' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'info';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  // Get routing color
  const getRoutingColor = (routing: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (routing) {
      case 'production':
        return 'success';
      case 'staging':
        return 'warning';
      case 'rejected':
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  // Get quality color
  const getQualityColor = (score: number): string => {
    if (score >= 95) return '#22c55e'; // Green
    if (score >= 70) return '#facc15'; // Yellow
    return '#ef4444'; // Red
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string | null): string => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Format processing time
  const formatProcessingTime = (timeMs: number | null): string => {
    if (!timeMs) return 'N/A';
    if (timeMs < 1000) return `${timeMs}ms`;
    if (timeMs < 60000) return `${(timeMs / 1000).toFixed(1)}s`;
    return `${(timeMs / 60000).toFixed(1)}m`;
  };

  // Download audit file from MinIO
  const downloadAuditFile = async (filename: string) => {
    if (!jobId) return;

    try {
      const response = await fetch(
        `${CNS_API_URL}/audit/download/${jobId}/${filename}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to download ${filename}`);
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${jobId}_${filename}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading audit file:', err);
      alert(`Failed to download ${filename}. The file may not exist yet.`);
    }
  };

  if (loading) {
    return (
      <Box p={3} display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !status) {
    return (
      <Box p={3}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Job not found'}
        </Alert>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/bom-jobs')}>
          Back to Job List
        </Button>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/bom-jobs')}
            sx={{ mb: 1 }}
          >
            Back to Jobs
          </Button>
          <Typography variant="h4" gutterBottom>
            BOM Job Detail
          </Typography>
          <Typography variant="body2" color="textSecondary" fontFamily="monospace">
            Job ID: {jobId}
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadStatus}
            disabled={loading}
          >
            Refresh
          </Button>
          {status.status === 'completed' && (
            <Button variant="contained" startIcon={<DownloadIcon />}>
              Export Results
            </Button>
          )}
        </Box>
      </Box>

      {/* Status Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Job Status</Typography>
            <Chip label={status.status} color={getStatusColor(status.status)} />
          </Box>

          {/* Progress Bar */}
          <Box mb={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2">Progress</Typography>
              <Typography variant="body2" fontWeight={600}>
                {status.progress}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={status.progress}
              sx={{ height: 10, borderRadius: 5 }}
            />
            <Typography variant="caption" color="textSecondary" mt={1}>
              {status.items_processed} / {status.total_items} items processed
            </Typography>
          </Box>

          {/* Statistics Grid */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h5" fontWeight={600}>
                  {status.items_auto_approved}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Auto-Approved
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <WarningIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h5" fontWeight={600}>
                  {status.items_in_staging}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Staging (Review)
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <ErrorIcon sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
                <Typography variant="h5" fontWeight={600}>
                  {status.items_rejected}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Rejected
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <ErrorIcon sx={{ fontSize: 40, color: 'grey.500', mb: 1 }} />
                <Typography variant="h5" fontWeight={600}>
                  {status.items_failed}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Failed
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Timing Information */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="textSecondary">
                Started At
              </Typography>
              <Typography variant="body2">{formatTimestamp(status.started_at)}</Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="textSecondary">
                Completed At
              </Typography>
              <Typography variant="body2">{formatTimestamp(status.completed_at)}</Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="textSecondary">
                Processing Time
              </Typography>
              <Typography variant="body2">
                {formatProcessingTime(status.processing_time_ms)}
              </Typography>
            </Grid>
          </Grid>

          {/* Error Message */}
          {status.error_message && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="body2">{status.error_message}</Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results Table (only for completed jobs) */}
      {status.status === 'completed' && results && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Enrichment Results
            </Typography>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>MPN</TableCell>
                    <TableCell>Manufacturer</TableCell>
                    <TableCell align="center">Quality Score</TableCell>
                    <TableCell align="center">Routing</TableCell>
                    <TableCell>Issues</TableCell>
                    <TableCell align="center">Catalog ID</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.results.map((item, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {item.mpn}
                        </Typography>
                      </TableCell>
                      <TableCell>{item.manufacturer || 'N/A'}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${item.quality_score.toFixed(1)}%`}
                          size="small"
                          sx={{
                            bgcolor: getQualityColor(item.quality_score),
                            color: 'white',
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={item.routing}
                          size="small"
                          color={getRoutingColor(item.routing)}
                        />
                      </TableCell>
                      <TableCell>
                        {item.issues.length > 0 ? (
                          <Box>
                            {item.issues.map((issue, i) => (
                              <Typography key={i} variant="caption" display="block" color="textSecondary">
                                • {issue}
                              </Typography>
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="caption" color="success.main">
                            No issues
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {item.catalog_id ? (
                          <Typography variant="caption" fontFamily="monospace">
                            #{item.catalog_id}
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="textSecondary">
                            N/A
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Audit Trail Downloads (for completed jobs) */}
      {status.status === 'completed' && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Enrichment Audit Trail
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Download CSV files for debugging and quality validation. Compare vendor responses, normalized data, and quality scores.
            </Typography>

            <Grid container spacing={2}>
              {/* BOM Original */}
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  fullWidth
                  onClick={() => downloadAuditFile('bom_original.csv')}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      BOM Original
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Original upload data
                    </Typography>
                  </Box>
                </Button>
              </Grid>

              {/* Vendor Responses */}
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  fullWidth
                  onClick={() => downloadAuditFile('vendor_responses.csv')}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Vendor Responses
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Raw API responses
                    </Typography>
                  </Box>
                </Button>
              </Grid>

              {/* Normalized Data */}
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  fullWidth
                  onClick={() => downloadAuditFile('normalized_data.csv')}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Normalized Data
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      After normalization
                    </Typography>
                  </Box>
                </Button>
              </Grid>

              {/* Comparison Summary */}
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  fullWidth
                  onClick={() => downloadAuditFile('comparison_summary.csv')}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Quality Summary
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Scores & routing
                    </Typography>
                  </Box>
                </Button>
              </Grid>
            </Grid>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="caption">
                📊 Audit files are stored in MinIO for 30 days. Use these files to analyze enrichment quality, debug normalization issues, and compare vendor data sources.
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Processing Message */}
      {status.status === 'processing' && (
        <Alert severity="info" icon={<CircularProgress size={20} />}>
          <Typography variant="body2">
            Job is currently processing. This page will automatically refresh every 3 seconds.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};
