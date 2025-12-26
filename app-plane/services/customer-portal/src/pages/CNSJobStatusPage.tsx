import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  Stack,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  RestartAlt as RestartAltIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { cnsApi } from '../services/cnsApi';

interface ComponentResult {
  mpn: string;
  manufacturer: string;
  quality_score?: number;
  routing_score?: number;
  status: 'passed' | 'failed' | 'processing' | 'pending';
  issues?: string[];
  enriched_data?: any;
}

interface JobStatus {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    processed: number;
    passed: number;
    failed: number;
  };
  results: ComponentResult[];
  current_component?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

export const CNSJobStatusPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Poll job status every 3 seconds
  useEffect(() => {
    if (!jobId) return;

    const fetchJobStatus = async () => {
      try {
        const status = await cnsApi.getJobStatus(jobId);
        setJobStatus(status);
        setLoading(false);

        // Stop auto-refresh if job is in terminal state
        if (['completed', 'failed', 'cancelled'].includes(status.status)) {
          setAutoRefresh(false);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch job status');
        setLoading(false);
        setAutoRefresh(false);
      }
    };

    // Initial fetch
    fetchJobStatus();

    // Set up polling
    let intervalId: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      intervalId = setInterval(fetchJobStatus, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, autoRefresh]);

  const handleStopJob = async () => {
    if (!jobId) return;
    try {
      await cnsApi.cancelJob(jobId);
      setAutoRefresh(false);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel job');
    }
  };

  const handleRetryJob = async () => {
    if (!jobId) return;
    try {
      const newJob = await cnsApi.retryJob(jobId);
      navigate(`/cns-jobs/${newJob.job_id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to retry job');
    }
  };

  const handleRetryFailedOnly = async () => {
    if (!jobId) return;
    try {
      const newJob = await cnsApi.retryFailedItems(jobId);
      navigate(`/cns-jobs/${newJob.job_id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to retry failed items');
    }
  };

  const exportToCSV = () => {
    if (!jobStatus || !jobStatus.results.length) return;

    const headers = ['MPN', 'Manufacturer', 'Quality Score', 'Routing Score', 'Status', 'Issues'];
    const rows = jobStatus.results.map(result => [
      result.mpn,
      result.manufacturer,
      result.quality_score?.toString() || 'N/A',
      result.routing_score?.toString() || 'N/A',
      result.status,
      result.issues?.join('; ') || 'None',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `bom-job-${jobId}-results.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Loading Job Status...
            </Typography>
            <LinearProgress />
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (error || !jobStatus) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {error || 'Job not found'}
        </Alert>
        <Button
          variant="contained"
          onClick={() => navigate('/boms')}
          sx={{ mt: 2 }}
        >
          Back to BOMs
        </Button>
      </Box>
    );
  }

  const progress = jobStatus.progress;
  const progressPercentage = progress.total > 0
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'success';
      case 'failed': return 'error';
      case 'processing': return 'primary';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'cancelled': return 'warning';
      case 'processing': return 'info';
      default: return 'default';
    }
  };

  const isJobRunning = jobStatus.status === 'processing' || jobStatus.status === 'pending';
  const hasFailedItems = progress.failed > 0;

  return (
    <Box sx={{ p: 3 }}>
      {/* Job Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5">
              BOM Enrichment Job: {jobId}
            </Typography>
            <Chip
              label={jobStatus.status.toUpperCase()}
              color={getJobStatusColor(jobStatus.status)}
              size="medium"
            />
          </Stack>

          {/* Progress Bar */}
          <Box mb={3}>
            <Stack direction="row" justifyContent="space-between" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Processing Components: {progress.processed} / {progress.total}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {progressPercentage}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={progressPercentage}
              sx={{ height: 8, borderRadius: 1 }}
            />
            {jobStatus.current_component && isJobRunning && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Currently processing: {jobStatus.current_component}
              </Typography>
            )}
          </Box>

          {/* Summary Badges */}
          <Stack direction="row" spacing={2} mb={2}>
            <Badge
              badgeContent={progress.passed}
              color="success"
              max={9999}
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '1rem',
                  height: '28px',
                  minWidth: '28px',
                  borderRadius: '14px',
                },
              }}
            >
              <Chip
                icon={<CheckCircleIcon />}
                label="Passed"
                color="success"
                variant="outlined"
                sx={{ minWidth: 100 }}
              />
            </Badge>

            <Badge
              badgeContent={progress.failed}
              color="error"
              max={9999}
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '1rem',
                  height: '28px',
                  minWidth: '28px',
                  borderRadius: '14px',
                },
              }}
            >
              <Chip
                icon={<ErrorIcon />}
                label="Failed"
                color="error"
                variant="outlined"
                sx={{ minWidth: 100 }}
              />
            </Badge>

            <Chip
              label={`Total: ${progress.total}`}
              variant="outlined"
              sx={{ minWidth: 100 }}
            />
          </Stack>

          {/* Action Buttons */}
          <Stack direction="row" spacing={2}>
            {isJobRunning && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<StopIcon />}
                onClick={handleStopJob}
              >
                Stop Job
              </Button>
            )}

            {!isJobRunning && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<RestartAltIcon />}
                  onClick={handleRetryJob}
                >
                  Retry All
                </Button>

                {hasFailedItems && (
                  <Button
                    variant="contained"
                    color="warning"
                    startIcon={<RefreshIcon />}
                    onClick={handleRetryFailedOnly}
                  >
                    Retry Failed Only ({progress.failed})
                  </Button>
                )}

                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={exportToCSV}
                >
                  Export CSV
                </Button>
              </>
            )}
          </Stack>

          {/* Error Alert */}
          {jobStatus.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {jobStatus.error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Execution Report
          </Typography>

          {jobStatus.results.length === 0 ? (
            <Alert severity="info">
              No results available yet. Processing will begin shortly.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>MPN</strong></TableCell>
                    <TableCell><strong>Manufacturer</strong></TableCell>
                    <TableCell align="center"><strong>Quality</strong></TableCell>
                    <TableCell align="center"><strong>Routing</strong></TableCell>
                    <TableCell align="center"><strong>Status</strong></TableCell>
                    <TableCell><strong>Issues</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {jobStatus.results.map((result, index) => (
                    <TableRow
                      key={index}
                      sx={{
                        '&:nth-of-type(odd)': { backgroundColor: 'action.hover' },
                        opacity: result.status === 'pending' ? 0.6 : 1,
                      }}
                    >
                      <TableCell>{result.mpn}</TableCell>
                      <TableCell>{result.manufacturer}</TableCell>
                      <TableCell align="center">
                        {result.quality_score !== undefined ? (
                          <Chip
                            label={result.quality_score.toFixed(1)}
                            size="small"
                            color={result.quality_score >= 0.8 ? 'success' : result.quality_score >= 0.5 ? 'warning' : 'error'}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {result.routing_score !== undefined ? (
                          <Chip
                            label={result.routing_score.toFixed(1)}
                            size="small"
                            color={result.routing_score >= 0.8 ? 'success' : result.routing_score >= 0.5 ? 'warning' : 'error'}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={result.status}
                          size="small"
                          color={getStatusColor(result.status)}
                          icon={result.status === 'passed' ? <CheckCircleIcon /> : result.status === 'failed' ? <ErrorIcon /> : undefined}
                        />
                      </TableCell>
                      <TableCell>
                        {result.issues && result.issues.length > 0 ? (
                          <Tooltip title={result.issues.join(', ')} arrow>
                            <Typography
                              variant="body2"
                              color="error"
                              sx={{
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                maxWidth: 300,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {result.issues[0]}
                              {result.issues.length > 1 && ` (+${result.issues.length - 1} more)`}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            None
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Auto-refreshing every 3 seconds...
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default CNSJobStatusPage;
