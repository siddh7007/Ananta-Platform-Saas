import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import TableChartIcon from '@mui/icons-material/TableChart';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { useNavigate } from 'react-router-dom';

interface BOMJob {
  job_id: string;
  filename: string;
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
}

/**
 * BOM Job List Component
 *
 * Features:
 * - List all BOM upload jobs
 * - Real-time status updates
 * - Progress indicators
 * - Click to view job details
 * - Auto-refresh for in-progress jobs
 */
export const BOMJobList: React.FC = () => {
  const navigate = useNavigate();
  const [jobs] = useState<BOMJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh] = useState(true);

  // Load jobs
  const loadJobs = async () => {
    setLoading(true);
    setError(null);

    try {
      // In a real implementation, there would be a /bom/jobs endpoint
      // For now, we'll show a message that this needs backend implementation
      setError('Job list endpoint not yet implemented. Use /bom/status/{job_id} to check individual jobs.');
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
      setLoading(false);
    }
  };

  // Auto-refresh for in-progress jobs
  useEffect(() => {
    loadJobs();

    if (autoRefresh) {
      const interval = setInterval(() => {
        const hasInProgress = jobs.some(job => job.status === 'processing');
        if (hasInProgress) {
          loadJobs();
        }
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Get status color
  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'info' | 'default' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'info';
      case 'failed':
        return 'error';
      case 'queued':
        return 'warning';
      default:
        return 'default';
    }
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

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            BOM Upload Jobs
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Track the status of your BOM enrichment jobs
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadJobs}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            onClick={() => navigate('/bom-upload')}
          >
            Upload New BOM
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body1" fontWeight={600}>
            Job List Not Available
          </Typography>
          <Typography variant="body2" mt={1}>
            The BOM job list endpoint needs to be implemented in the backend. For now, you can:
          </Typography>
          <ul style={{ marginTop: 8, marginBottom: 0 }}>
            <li>Upload a BOM file to get a job_id</li>
            <li>Use the job_id to check status: <code>GET /api/bom/status/&#123;job_id&#125;</code></li>
            <li>View job details by navigating directly to: <code>/bom-jobs/&#123;job_id&#125;</code></li>
          </ul>
          <Box mt={2}>
            <Typography variant="caption" color="textSecondary">
              <strong>Backend TODO:</strong> Implement <code>GET /api/bom/jobs</code> endpoint to list all jobs
            </Typography>
          </Box>
        </Alert>
      )}

      {/* Mock Job List (for UI demonstration) */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Jobs
          </Typography>

          {loading && jobs.length === 0 ? (
            <Box textAlign="center" py={4}>
              <LinearProgress sx={{ mb: 2 }} />
              <Typography variant="body2" color="textSecondary">
                Loading jobs...
              </Typography>
            </Box>
          ) : jobs.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" color="textSecondary" gutterBottom>
                No BOM jobs found
              </Typography>
              <Typography variant="body2" color="textSecondary" mb={2}>
                Upload your first BOM to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<UploadFileIcon />}
                onClick={() => navigate('/bom-upload')}
              >
                Upload BOM
              </Button>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Job ID</TableCell>
                    <TableCell>Filename</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Progress</TableCell>
                    <TableCell align="right">Items</TableCell>
                    <TableCell align="right">Auto-Approved</TableCell>
                    <TableCell align="right">Staging</TableCell>
                    <TableCell align="right">Rejected</TableCell>
                    <TableCell>Started</TableCell>
                    <TableCell>Completed</TableCell>
                    <TableCell align="right">Time</TableCell>
                    <TableCell align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow
                      key={job.job_id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/bom-jobs/${job.job_id}`)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {job.job_id.substring(0, 8)}...
                        </Typography>
                      </TableCell>
                      <TableCell>{job.filename}</TableCell>
                      <TableCell>
                        <Chip
                          label={job.status}
                          color={getStatusColor(job.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Box display="flex" alignItems="center" gap={1}>
                          <LinearProgress
                            variant="determinate"
                            value={job.progress}
                            sx={{ width: 60 }}
                          />
                          <Typography variant="caption">{job.progress}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {job.items_processed} / {job.total_items}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={job.items_auto_approved}
                          color="success"
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={job.items_in_staging}
                          color="warning"
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={job.items_rejected}
                          color="error"
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {formatTimestamp(job.started_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {formatTimestamp(job.completed_at)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">
                          {formatProcessingTime(job.processing_time_ms)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              color="info"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/bom-jobs/${job.job_id}`);
                              }}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="View Line Items">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/bom-jobs/${job.job_id}`);
                              }}
                            >
                              <TableChartIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="View Audit Trail">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/audit-stream?bomId=${job.job_id}`);
                              }}
                            >
                              <AssessmentIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            💡 How to Use
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            To check the status of a specific BOM job:
          </Typography>
          <Box
            component="code"
            sx={{
              display: 'block',
              p: 2,
              bgcolor: 'grey.100',
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.875rem',
            }}
          >
            # Get job status
            <br />
            curl http://localhost:27800/api/bom/status/&#123;job_id&#125;
            <br />
            <br />
            # Get job results (when completed)
            <br />
            curl http://localhost:27800/api/bom/results/&#123;job_id&#125;
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
