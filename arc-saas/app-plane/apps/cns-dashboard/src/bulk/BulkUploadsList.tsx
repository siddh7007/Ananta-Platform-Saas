/**
 * Bulk Uploads List - Enhanced to match Customer Portal
 *
 * Shows staff bulk uploads with workflow step visualization,
 * enrichment summary, and continue workflow functionality.
 *
 * Features:
 * - Workflow step progress (1/4, 2/4, etc.)
 * - Enrichment counts (enriched/failed/pending)
 * - Continue/View workflow buttons
 * - Link to unified BOM upload workflow
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Stack,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  PlayArrow as StartIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  CloudQueue as RedisIcon,
  OpenInNew as OpenInNewIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { API_CONFIG, getAdminAuthHeaders } from '../config/api';
import { useNotification } from '../contexts/NotificationContext';
import { useTenant } from '../contexts/TenantContext';
import { EnrichmentProgressMonitor } from '../enrichment/EnrichmentProgressMonitor';

interface BulkUpload {
  upload_id: string;
  bom_id?: string;
  filename: string;
  status: string;
  total_rows: number;
  enrichment_progress?: {
    total_items: number;
    enriched_items: number;
    failed_items: number;
    pending_items: number;
    percent_complete: number;
  };
  created_at: string;
  redis_expires_at?: string;
}

// ============================================================================
// Workflow Step Configuration (matching Customer Portal)
// ============================================================================

interface WorkflowStep {
  step: number;
  total: number;
  label: string;
  description: string;
  canContinue: boolean;
}

function getWorkflowStep(upload: BulkUpload): WorkflowStep {
  const status = upload.status?.toLowerCase() || 'uploaded';
  const progress = upload.enrichment_progress;
  const hasBomId = typeof upload.bom_id === 'string' && upload.bom_id.trim().length > 0;

  // Status flow: uploaded → enriching → completed/failed
  switch (status) {
    case 'uploaded':
    case 'pending':
      return {
        step: 1,
        total: 4,
        label: 'Ready',
        description: hasBomId ? 'Ready to enrich' : 'Pending BOM creation',
        canContinue: hasBomId,
      };
    case 'enriching':
    case 'processing':
      return {
        step: 2,
        total: 4,
        label: 'Enriching',
        description: `${progress?.enriched_items || 0}/${progress?.total_items || upload.total_rows} processed`,
        canContinue: true,
      };
    case 'paused':
      return {
        step: 2,
        total: 4,
        label: 'Paused',
        description: 'Enrichment paused',
        canContinue: true,
      };
    case 'completed':
      return {
        step: 4,
        total: 4,
        label: 'Complete',
        description: 'View results',
        canContinue: true,
      };
    case 'failed':
    case 'cancelled':
      return {
        step: 0,
        total: 4,
        label: 'Failed',
        description: 'Workflow failed',
        canContinue: true,
      };
    default:
      return {
        step: 1,
        total: 4,
        label: status,
        description: 'Unknown status',
        canContinue: false,
      };
  }
}

// ============================================================================
// Workflow Step Badge Component
// ============================================================================

const WorkflowStepBadge: React.FC<{ upload: BulkUpload }> = ({ upload }) => {
  const workflowStep = getWorkflowStep(upload);

  const stepColors: Record<string, { bg: string; fg: string }> = {
    'Ready': { bg: '#dbeafe', fg: '#1e40af' },
    'Enriching': { bg: '#e0f2fe', fg: '#0369a1' },
    'Paused': { bg: '#fef3c7', fg: '#92400e' },
    'Complete': { bg: '#dcfce7', fg: '#166534' },
    'Failed': { bg: '#fee2e2', fg: '#991b1b' },
  };

  const colors = stepColors[workflowStep.label] || { bg: '#f3f4f6', fg: '#6b7280' };

  return (
    <Tooltip title={workflowStep.description}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          label={`${workflowStep.step}/${workflowStep.total}`}
          size="small"
          sx={{
            bgcolor: colors.bg,
            color: colors.fg,
            fontWeight: 600,
            fontSize: 10,
            minWidth: 40,
          }}
        />
        <Typography variant="caption" sx={{ color: colors.fg, fontWeight: 500 }}>
          {workflowStep.label}
        </Typography>
      </Box>
    </Tooltip>
  );
};

// ============================================================================
// Enrichment Summary Component
// ============================================================================

const EnrichmentSummary: React.FC<{ upload: BulkUpload }> = ({ upload }) => {
  const progress = upload.enrichment_progress;

  if (!progress) {
    return (
      <Typography variant="caption" color="text.secondary">
        Not started
      </Typography>
    );
  }

  const { total_items, enriched_items, failed_items, pending_items, percent_complete } = progress;

  // Show progress bar if still processing
  if (pending_items > 0) {
    return (
      <Box sx={{ minWidth: 120 }}>
        <Typography variant="caption" sx={{ display: 'block' }}>
          {enriched_items}/{total_items} ({percent_complete.toFixed(0)}%)
        </Typography>
        <LinearProgress
          variant="determinate"
          value={percent_complete}
          sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
        />
      </Box>
    );
  }

  // Show final counts
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title={`${enriched_items} enriched`}>
        <Chip
          icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
          label={enriched_items}
          size="small"
          sx={{ bgcolor: '#dcfce7', color: '#166534', fontSize: 11 }}
        />
      </Tooltip>
      {failed_items > 0 && (
        <Tooltip title={`${failed_items} failed`}>
          <Chip
            icon={<ErrorIcon sx={{ fontSize: 14 }} />}
            label={failed_items}
            size="small"
            sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontSize: 11 }}
          />
        </Tooltip>
      )}
    </Stack>
  );
};

// ============================================================================
// Continue Workflow Button
// ============================================================================

const ContinueWorkflowButton: React.FC<{
  upload: BulkUpload;
  onMonitor: (bomId: string) => void;
  onNavigate: (path: string) => void;
}> = ({ upload, onMonitor, onNavigate }) => {
  const workflowStep = getWorkflowStep(upload);
  const hasBomId = typeof upload.bom_id === 'string' && upload.bom_id.trim().length > 0;

  if (!workflowStep.canContinue) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (workflowStep.label === 'Complete' && hasBomId) {
      // Navigate to unified workflow results
      onNavigate(`/bom-upload?resume=true&bomId=${upload.bom_id}&step=results`);
    } else if ((workflowStep.label === 'Enriching' || workflowStep.label === 'Paused') && hasBomId) {
      // Show enrichment monitor
      onMonitor(upload.bom_id!);
    } else if (hasBomId) {
      // Navigate to unified workflow enriching step
      onNavigate(`/bom-upload?resume=true&bomId=${upload.bom_id}&step=enriching`);
    }
  };

  const isComplete = workflowStep.label === 'Complete';
  const buttonLabel = isComplete ? 'View' : 'Continue';
  const buttonColor = isComplete ? 'success' : 'primary';

  return (
    <Tooltip title={workflowStep.description}>
      <Button
        size="small"
        variant={isComplete ? 'outlined' : 'contained'}
        color={buttonColor}
        onClick={handleClick}
        sx={{ fontSize: 11, py: 0.5, px: 1.5, minWidth: 'auto' }}
      >
        {buttonLabel}
      </Button>
    </Tooltip>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const BulkUploadsList = () => {
  const [uploads, setUploads] = useState<BulkUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; uploadId: string | null }>({
    open: false,
    uploadId: null,
  });
  const [selectedBomId, setSelectedBomId] = useState<string | null>(null);
  const [showBomMonitor, setShowBomMonitor] = useState(false);
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const { tenantId } = useTenant();

  const fetchUploads = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/bulk/uploads`, {
        headers: getAdminAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bulk uploads');
      }

      const data = await response.json();
      setUploads(data.uploads || []);
    } catch (err: any) {
      console.error('Failed to fetch bulk uploads:', err);
      setError(err.message || 'Failed to fetch bulk uploads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  const handleStartEnrichment = async (upload: BulkUpload) => {
    try {
      const hasBomId = typeof upload.bom_id === 'string' && upload.bom_id.trim().length > 0;
      const usesUnifiedEndpoint = hasBomId;
      const endpoint = usesUnifiedEndpoint
        ? `${API_CONFIG.BASE_URL}/boms/${upload.bom_id!.trim()}/enrichment/start`
        : `${API_CONFIG.BASE_URL}/bulk/enrichment/start`;

      const payload = usesUnifiedEndpoint
        ? { tenant_id: tenantId, priority: 7 }
        : { upload_id: upload.upload_id, tenant_id: tenantId, priority: 7 };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
        body: JSON.stringify(payload),
      });

      if (response.status === 409 && usesUnifiedEndpoint) {
        showSuccess('Enrichment already in progress. Opening progress monitor...');
        if (upload.bom_id) {
          setSelectedBomId(upload.bom_id.trim());
          setShowBomMonitor(true);
        }
        return;
      }

      if (response.status === 400 && usesUnifiedEndpoint) {
        const body = await response.json().catch(() => null);
        if (body?.code === 'NO_PENDING_ITEMS') {
          showSuccess('No pending line items. BOM may already be enriched.');
          return;
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || errorData?.message || 'Failed to start enrichment');
      }

      showSuccess('Enrichment started successfully!');
      fetchUploads();
    } catch (err: any) {
      showError(`Failed to start enrichment: ${err.message}`);
    }
  };

  const handlePause = async (uploadId: string) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/bulk/enrichment/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
        body: JSON.stringify({ upload_id: uploadId, reason: 'Staff paused from dashboard' }),
      });

      if (!response.ok) throw new Error('Failed to pause enrichment');

      showSuccess('Enrichment paused successfully!');
      fetchUploads();
    } catch (err: any) {
      showError(`Failed to pause enrichment: ${err.message}`);
    }
  };

  const handleResume = async (uploadId: string) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/bulk/enrichment/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
        body: JSON.stringify({ upload_id: uploadId }),
      });

      if (!response.ok) throw new Error('Failed to resume enrichment');

      showSuccess('Enrichment resumed successfully!');
      fetchUploads();
    } catch (err: any) {
      showError(`Failed to resume enrichment: ${err.message}`);
    }
  };

  const handleStop = async (uploadId: string) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/bulk/enrichment/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
        body: JSON.stringify({ upload_id: uploadId, reason: 'Staff stopped from dashboard' }),
      });

      if (!response.ok) throw new Error('Failed to stop enrichment');

      showSuccess('Enrichment stopped successfully!');
      fetchUploads();
    } catch (err: any) {
      showError(`Failed to stop enrichment: ${err.message}`);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.uploadId) return;

    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/bulk/enrichment/${deleteDialog.uploadId}`,
        { method: 'DELETE', headers: getAdminAuthHeaders() }
      );

      if (!response.ok) throw new Error('Failed to delete enrichment job');

      showSuccess('Enrichment job deleted successfully!');
      setDeleteDialog({ open: false, uploadId: null });
      fetchUploads();
    } catch (err: any) {
      showError(`Failed to delete enrichment job: ${err.message}`);
    }
  };

  const handleRowClick = (upload: BulkUpload) => {
    const hasBomId = typeof upload.bom_id === 'string' && upload.bom_id.trim().length > 0;
    if (hasBomId) {
      navigate(`/bom-jobs/${upload.bom_id}`);
    } else {
      navigate(`/bulk-uploads/${upload.upload_id}`);
    }
  };

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            BOM Uploads
          </Typography>
          <Box display="flex" alignItems="center" gap={1} mt={1}>
            <RedisIcon color="primary" fontSize="small" />
            <Typography variant="body2" color="textSecondary">
              Redis Storage • Temporary (24-48h TTL)
            </Typography>
          </Box>
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/bom-upload')}
          >
            Upload BOM
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchUploads}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent>
            <LinearProgress />
            <Typography variant="body2" color="textSecondary" sx={{ mt: 2, textAlign: 'center' }}>
              Loading uploads...
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && uploads.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <ScheduleIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="textSecondary">
              No uploads found
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Upload a BOM file to start enrichment
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/bom-upload')}
            >
              Upload BOM
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Uploads Table */}
      {!loading && uploads.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 600 }}>File Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Workflow</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Rows</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Enrichment</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Uploaded</TableCell>
                <TableCell sx={{ fontWeight: 600 }}></TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {uploads.map((upload) => {
                const isEnriching = upload.status === 'enriching';
                const isPaused = upload.status === 'paused';
                const hasBomId = typeof upload.bom_id === 'string' && upload.bom_id.trim().length > 0;

                return (
                  <TableRow
                    key={upload.upload_id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleRowClick(upload)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {upload.filename}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {upload.upload_id.substring(0, 8)}...
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <WorkflowStepBadge upload={upload} />
                    </TableCell>

                    <TableCell align="right">
                      <Typography variant="body2">{upload.total_rows}</Typography>
                    </TableCell>

                    <TableCell>
                      <EnrichmentSummary upload={upload} />
                    </TableCell>

                    <TableCell>
                      <Typography variant="caption" color="textSecondary">
                        {new Date(upload.created_at).toLocaleString()}
                      </Typography>
                    </TableCell>

                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ContinueWorkflowButton
                        upload={upload}
                        onMonitor={(bomId) => {
                          setSelectedBomId(bomId);
                          setShowBomMonitor(true);
                        }}
                        onNavigate={navigate}
                      />
                    </TableCell>

                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Box display="flex" gap={0.5} justifyContent="flex-end">
                        {hasBomId && (
                          <Tooltip title="View Progress">
                            <IconButton
                              size="small"
                              color="info"
                              onClick={() => {
                                setSelectedBomId(upload.bom_id!.trim());
                                setShowBomMonitor(true);
                              }}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                        )}

                        {hasBomId && (
                          <Tooltip title="Open BOM">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => navigate(`/bom-jobs/${upload.bom_id}`)}
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}

                        {!isEnriching && !isPaused && hasBomId && (
                          <Tooltip title="Start Enrichment">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleStartEnrichment(upload)}
                            >
                              <StartIcon />
                            </IconButton>
                          </Tooltip>
                        )}

                        {isEnriching && (
                          <Tooltip title="Pause">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => handlePause(upload.upload_id)}
                            >
                              <PauseIcon />
                            </IconButton>
                          </Tooltip>
                        )}

                        {isPaused && (
                          <Tooltip title="Resume">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleResume(upload.upload_id)}
                            >
                              <StartIcon />
                            </IconButton>
                          </Tooltip>
                        )}

                        {(isEnriching || isPaused) && (
                          <Tooltip title="Stop">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleStop(upload.upload_id)}
                            >
                              <StopIcon />
                            </IconButton>
                          </Tooltip>
                        )}

                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteDialog({ open: true, uploadId: upload.upload_id })}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, uploadId: null })}>
        <DialogTitle>Delete Enrichment Job?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will:
            <ul>
              <li>Cancel the running workflow (if any)</li>
              <li>Delete all Redis data (metadata, line items, progress)</li>
              <li>Raw file remains in MinIO for audit</li>
            </ul>
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, uploadId: null })}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* BOM Enrichment Progress Monitor Dialog */}
      <Dialog
        open={showBomMonitor}
        onClose={() => setShowBomMonitor(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          BOM Enrichment Progress
          {selectedBomId && (
            <Typography variant="caption" display="block" color="textSecondary">
              BOM ID: {selectedBomId}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {selectedBomId && (
            <EnrichmentProgressMonitor bomId={selectedBomId} showDetailedLog={true} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBomMonitor(false)}>Close</Button>
          {selectedBomId && (
            <Button
              variant="contained"
              onClick={() => {
                setShowBomMonitor(false);
                navigate(`/bom-upload?resume=true&bomId=${selectedBomId}&step=enriching`);
              }}
            >
              Open in Workflow
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};
