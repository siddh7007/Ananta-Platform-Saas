/**
 * Admin BOM Manager - Bulk BOM Upload Management for CNS Admins
 *
 * Features:
 * - List all BOM jobs across all tenants
 * - View job details and status
 * - Delete BOM jobs
 * - Edit BOM metadata
 * - Submit BOMs for enrichment
 * - Pause/Resume Temporal workflows
 * - Real-time status updates
 * - RabbitMQ event integration
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  LinearProgress,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import { CNS_API_URL, getAuthHeaders } from '../config/api';

interface AdminBOMJob {
  job_id: string;
  filename: string;
  status: string;
  progress: number;
  total_items: number;
  items_processed: number;
  items_failed: number;
  tenant_id?: string;
  tenant_name?: string;
  project_id?: string;
  project_name?: string;
  user_email?: string;
  started_at?: string;
  completed_at?: string;
  processing_time_ms?: number;
  source: string;
}

interface AdminBOMJobListResponse {
  jobs: AdminBOMJob[];
  total: number;
  page: number;
  page_size: number;
}

export const AdminBOMManager: React.FC = () => {
  const [jobs, setJobs] = useState<AdminBOMJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<AdminBOMJob | null>(null);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFilename, setEditFilename] = useState('');

  // Action menu
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);

  // Admin email for audit trail
  const adminEmail = localStorage.getItem('admin_email') || 'admin@example.com';

  /**
   * Load BOM jobs from API
   */
  const loadJobs = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page + 1),
        page_size: String(rowsPerPage),
        ...(statusFilter && { status_filter: statusFilter }),
        ...(search && { search }),
      });

      const response = await fetch(`${CNS_API_URL}/api/admin/bom/jobs?${params}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to load jobs: ${response.statusText}`);
      }

      const data: AdminBOMJobListResponse = await response.json();

      setJobs(data.jobs);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete BOM job
   */
  const handleDeleteJob = async (jobId: string) => {
    if (!selectedJob) return;

    try {
      const response = await fetch(
        `${CNS_API_URL}/api/boms/${jobId}/enrichment`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: selectedJob.tenant_id,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete job');
      }

      alert('BOM job deleted successfully!');

      // Reload jobs
      await loadJobs();

      setDeleteDialogOpen(false);
      setSelectedJob(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete job');
    }
  };

  /**
   * Update BOM job metadata
   */
  const handleUpdateJob = async () => {
    if (!selectedJob) return;

    try {
      const response = await fetch(
        `${CNS_API_URL}/api/admin/bom/jobs/${selectedJob.job_id}?admin_email=${encodeURIComponent(adminEmail)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: editFilename }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update job');
      }

      // Reload jobs
      await loadJobs();

      setEditDialogOpen(false);
      setSelectedJob(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update job');
    }
  };

  /**
   * Submit job for enrichment (Start enrichment)
   */
  const handleSubmitJob = async (jobId: string) => {
    if (!selectedJob) return;

    try {
      const response = await fetch(
        `${CNS_API_URL}/api/boms/${jobId}/enrichment/start`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: selectedJob.tenant_id,
            project_id: selectedJob.project_id,
            priority: 5, // Default priority for staff uploads
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to start enrichment');
      }

      alert('BOM enrichment started successfully!');

      // Reload jobs
      await loadJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start enrichment');
    }
  };

  /**
   * Pause workflow
   */
  const handlePauseWorkflow = async (jobId: string) => {
    if (!selectedJob) return;

    try {
      const response = await fetch(
        `${CNS_API_URL}/api/boms/${jobId}/enrichment/pause`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: selectedJob.tenant_id,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to pause workflow');
      }

      alert('Workflow paused successfully!');

      // Reload jobs
      await loadJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to pause workflow');
    }
  };

  /**
   * Resume workflow
   */
  const handleResumeWorkflow = async (jobId: string) => {
    if (!selectedJob) return;

    try {
      const response = await fetch(
        `${CNS_API_URL}/api/boms/${jobId}/enrichment/resume`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: selectedJob.tenant_id,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to resume workflow');
      }

      alert('Workflow resumed successfully!');

      // Reload jobs
      await loadJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resume workflow');
    }
  };

  /**
   * Cancel workflow (Stop)
   */
  const handleCancelWorkflow = async (jobId: string) => {
    if (!selectedJob) return;

    try {
      const response = await fetch(
        `${CNS_API_URL}/api/boms/${jobId}/enrichment/stop`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: selectedJob.tenant_id,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to stop workflow');
      }

      alert('Workflow stopped successfully!');

      // Reload jobs
      await loadJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to stop workflow');
    }
  };

  // Load jobs on mount and when filters change
  useEffect(() => {
    loadJobs();
  }, [page, rowsPerPage, statusFilter, search]);

  // Auto-refresh for in-progress jobs
  useEffect(() => {
    const hasInProgress = jobs.some(job => job.status === 'processing');

    if (hasInProgress) {
      const interval = setInterval(() => {
        loadJobs();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [jobs]);

  /**
   * Get status chip color
   */
  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'primary';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'warning';
      case 'pending':
        return 'info';
      default:
        return 'default';
    }
  };

  /**
   * Open action menu
   */
  const handleOpenActionMenu = (event: React.MouseEvent<HTMLElement>, job: AdminBOMJob) => {
    setActionMenuAnchor(event.currentTarget);
    setSelectedJob(job);
  };

  /**
   * Close action menu
   */
  const handleCloseActionMenu = () => {
    setActionMenuAnchor(null);
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" component="h2">
            Admin BOM Manager
          </Typography>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={loadJobs}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Search and Filters */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <TextField
            label="Search filename or job ID"
            variant="outlined"
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1 }}
          />
          <TextField
            select
            label="Status Filter"
            variant="outlined"
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="processing">Processing</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </TextField>
        </Box>

        {/* Jobs Table */}
        {loading && <LinearProgress sx={{ mb: 2 }} />}

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Job ID</TableCell>
                <TableCell>Filename</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Tenant</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Started</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography color="text.secondary">
                      No BOM jobs found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow key={job.job_id}>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                        {job.job_id.substring(0, 8)}...
                      </Typography>
                    </TableCell>
                    <TableCell>{job.filename}</TableCell>
                    <TableCell>
                      <Chip
                        label={job.status}
                        size="small"
                        color={getStatusColor(job.status)}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={job.progress}
                          sx={{ flex: 1, height: 8, borderRadius: 4 }}
                        />
                        <Typography variant="caption">{job.progress}%</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {job.items_processed}/{job.total_items}
                      {job.items_failed > 0 && (
                        <Chip
                          label={`${job.items_failed} failed`}
                          size="small"
                          color="error"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {job.tenant_name || job.tenant_id?.substring(0, 8) || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{job.user_email || 'N/A'}</Typography>
                    </TableCell>
                    <TableCell>
                      {job.started_at ? new Date(job.started_at).toLocaleString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={(e) => handleOpenActionMenu(e, job)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[25, 50, 100, 200]}
        />

        {/* Action Menu */}
        <Menu
          anchorEl={actionMenuAnchor}
          open={Boolean(actionMenuAnchor)}
          onClose={handleCloseActionMenu}
        >
          <MenuItem
            onClick={() => {
              if (selectedJob) handleSubmitJob(selectedJob.job_id);
              handleCloseActionMenu();
            }}
          >
            <ListItemIcon>
              <UploadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Submit for Enrichment</ListItemText>
          </MenuItem>

          <MenuItem
            onClick={() => {
              if (selectedJob) handlePauseWorkflow(selectedJob.job_id);
              handleCloseActionMenu();
            }}
            disabled={selectedJob?.status !== 'processing'}
          >
            <ListItemIcon>
              <PauseIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Pause Workflow</ListItemText>
          </MenuItem>

          <MenuItem
            onClick={() => {
              if (selectedJob) handleResumeWorkflow(selectedJob.job_id);
              handleCloseActionMenu();
            }}
            disabled={selectedJob?.status !== 'paused'}
          >
            <ListItemIcon>
              <PlayIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Resume Workflow</ListItemText>
          </MenuItem>

          <MenuItem
            onClick={() => {
              if (selectedJob) handleCancelWorkflow(selectedJob.job_id);
              handleCloseActionMenu();
            }}
            disabled={selectedJob?.status === 'completed' || selectedJob?.status === 'failed'}
          >
            <ListItemIcon>
              <StopIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Cancel Workflow</ListItemText>
          </MenuItem>

          <MenuItem
            onClick={() => {
              if (selectedJob) {
                setEditFilename(selectedJob.filename);
                setEditDialogOpen(true);
              }
              handleCloseActionMenu();
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit Metadata</ListItemText>
          </MenuItem>

          <MenuItem
            onClick={() => {
              setDeleteDialogOpen(true);
              handleCloseActionMenu();
            }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>Delete Job</ListItemText>
          </MenuItem>
        </Menu>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete BOM job "{selectedJob?.filename}"?
              <br /><br />
              This will:
              <ul>
                <li>Delete all job data and line items</li>
                <li>Cancel any running Temporal workflow</li>
                <li>Remove enrichment results</li>
              </ul>
              This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => selectedJob && handleDeleteJob(selectedJob.job_id)}
              color="error"
              variant="contained"
            >
              Delete Job
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
          <DialogTitle>Edit BOM Metadata</DialogTitle>
          <DialogContent>
            <TextField
              label="Filename"
              fullWidth
              value={editFilename}
              onChange={(e) => setEditFilename(e.target.value)}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateJob} variant="contained">
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};
