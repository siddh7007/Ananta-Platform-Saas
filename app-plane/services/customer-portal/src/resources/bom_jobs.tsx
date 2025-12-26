import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  NumberField,
  DateField,
  DatagridConfigurable,
  Show,
  SimpleShowLayout,
  useRecordContext,
  useRefresh,
  useNotify,
} from 'react-admin';
import { useEffect, useState } from 'react';
import {
  Box,
  Chip,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { getCnsBaseUrl, getAuthHeaders } from '../services/cnsApi';

// Status badge colors
const STATUS_COLORS: Record<string, { bg: string; fg: string; label?: string }> = {
  pending: { bg: '#9ca3af', fg: '#ffffff', label: 'Pending' },
  queued: { bg: '#9ca3af', fg: '#ffffff', label: 'Queued' },
  parsing: { bg: '#60a5fa', fg: '#ffffff', label: 'Parsing' },
  processing: { bg: '#3b82f6', fg: '#ffffff', label: 'Processing' },
  enriching: { bg: '#3b82f6', fg: '#ffffff', label: 'Enriching' },
  paused: { bg: '#f59e0b', fg: '#ffffff', label: 'Paused' },
  validating: { bg: '#f59e0b', fg: '#ffffff', label: 'Validating' },
  completing: { bg: '#6b7280', fg: '#ffffff', label: 'Completing' },
  completed: { bg: '#22c55e', fg: '#ffffff', label: 'Completed' },
  failed: { bg: '#ef4444', fg: '#ffffff', label: 'Failed' },
  cancelled: { bg: '#ef4444', fg: '#ffffff', label: 'Cancelled' },
};

const StatusBadge: React.FC<{ source?: string }> = ({ source = 'status' }) => (
  <TextField
    source={source}
    label="Status"
    render={(record: any) => {
      if (!record) return null;
      const status = String(record[source] || 'pending').toLowerCase();
      const cfg = STATUS_COLORS[status] || STATUS_COLORS.pending;
      return (
        <Chip
          size="small"
          label={cfg.label || status}
          sx={{ backgroundColor: cfg.bg, color: cfg.fg, fontWeight: 600 }}
        />
      );
    }}
  />
);

// Enrichment Control Actions
const EnrichmentActions: React.FC = () => {
  const record = useRecordContext<any>();
  const refresh = useRefresh();
  const notify = useNotify();
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const CNS_API_URL = getCnsBaseUrl();

  if (!record) return null;

  const bomId = record.id || record.bom_id;
  const status = String(record.status || 'pending').toLowerCase();

  const handleStartEnrichment = async () => {
    setLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${CNS_API_URL}/api/boms/${bomId}/enrichment/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          organization_id: record.organization_id,
          project_id: record.project_id,
          priority: 7,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to start enrichment');
      }

      notify('Enrichment started successfully', { type: 'success' });
      refresh();
    } catch (error: any) {
      notify(`Error: ${error.message}`, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePauseEnrichment = async () => {
    setLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${CNS_API_URL}/api/boms/${bomId}/enrichment/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ organization_id: record.organization_id }),
      });

      if (!response.ok) throw new Error('Failed to pause enrichment');

      notify('Enrichment paused successfully', { type: 'success' });
      refresh();
    } catch (error: any) {
      notify(`Error: ${error.message}`, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResumeEnrichment = async () => {
    setLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${CNS_API_URL}/api/boms/${bomId}/enrichment/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ organization_id: record.organization_id }),
      });

      if (!response.ok) throw new Error('Failed to resume enrichment');

      notify('Enrichment resumed successfully', { type: 'success' });
      refresh();
    } catch (error: any) {
      notify(`Error: ${error.message}`, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleStopEnrichment = async () => {
    setLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${CNS_API_URL}/api/boms/${bomId}/enrichment/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ organization_id: record.organization_id }),
      });

      if (!response.ok) throw new Error('Failed to stop enrichment');

      notify('Enrichment stopped successfully', { type: 'success' });
      refresh();
    } catch (error: any) {
      notify(`Error: ${error.message}`, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async () => {
    setLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${CNS_API_URL}/api/boms/${bomId}/enrichment`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ organization_id: record.organization_id }),
      });

      if (!response.ok) throw new Error('Failed to delete job');

      notify('Job deleted successfully', { type: 'success' });
      setDeleteDialogOpen(false);
      refresh();
    } catch (error: any) {
      notify(`Error: ${error.message}`, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {loading && <CircularProgress size={20} />}

      {/* Start button - show when completed */}
      {status === 'completed' && (
        <Tooltip title="Start Enrichment">
          <IconButton
            size="small"
            color="primary"
            onClick={handleStartEnrichment}
            disabled={loading}
          >
            <PlayIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* Pause button - show when enriching */}
      {status === 'enriching' && (
        <Tooltip title="Pause Enrichment">
          <IconButton
            size="small"
            color="warning"
            onClick={handlePauseEnrichment}
            disabled={loading}
          >
            <PauseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* Resume button - show when paused */}
      {status === 'paused' && (
        <Tooltip title="Resume Enrichment">
          <IconButton
            size="small"
            color="primary"
            onClick={handleResumeEnrichment}
            disabled={loading}
          >
            <PlayIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* Stop button - show when enriching or paused */}
      {(status === 'enriching' || status === 'paused') && (
        <Tooltip title="Stop Enrichment">
          <IconButton
            size="small"
            color="error"
            onClick={handleStopEnrichment}
            disabled={loading}
          >
            <StopIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* Delete button - always available */}
      <Tooltip title="Delete Job">
        <IconButton
          size="small"
          color="error"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={loading}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this BOM job?
            <br /><br />
            <strong>This will:</strong>
            <ul>
              <li>Delete all job data and line items</li>
              <li>Cancel any running workflow</li>
              <li>Remove enrichment results</li>
            </ul>
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteJob}
            color="error"
            variant="contained"
            disabled={loading}
          >
            Delete Job
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export const BOMJobList: React.FC = () => (
  <List
    sort={{ field: 'started_at', order: 'DESC' }}
    perPage={25}
    resource="bom_jobs"
  >
    <DatagridConfigurable rowClick="show" bulkActionButtons={false}>
      <TextField source="job_id" label="Job ID" />
      <TextField source="filename" label="File" />
      <NumberField source="total_items" label="Items" options={{ maximumFractionDigits: 0 }} />
      <NumberField source="items_processed" label="Processed" options={{ maximumFractionDigits: 0 }} />
      <NumberField source="progress" label="%" options={{ maximumFractionDigits: 0 }} />
      <StatusBadge source="status" />
      <DateField source="started_at" label="Started" showTime />
      <DateField source="completed_at" label="Completed" showTime />
      <TextField source="error_message" label="Error" emptyText="-" />
      <EnrichmentActions />
    </DatagridConfigurable>
  </List>
);

export const BOMJobShow: React.FC = () => {
  const record = useRecordContext<any>();
  const [status, setStatus] = useState<any | null>(null);

  useEffect(() => {
    if (!record?.job_id) return;
    let active = true;
    const CNS_API_URL = `${getCnsBaseUrl()}/api`;

    const fetchStatus = async () => {
      try {
        const resp = await fetch(`${CNS_API_URL}/bom/status/${record.job_id}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (active) setStatus(data);
      } catch {}
    };

    fetchStatus();
    const t = setInterval(fetchStatus, 2000);
    return () => { active = false; clearInterval(t); };
  }, [record?.job_id]);

  return (
    <Show>
      <SimpleShowLayout>
        <TextField source="job_id" label="Job ID" />
        <TextField source="filename" label="File" />
        <NumberField source="total_items" label="Items" />
        <StatusBadge source="status" />
        <NumberField source="progress" label="Progress %" />
        <NumberField source="items_processed" label="Processed" />
        <NumberField source="items_auto_approved" label="Auto Approved" />
        <NumberField source="items_in_staging" label="In Staging" />
        <NumberField source="items_rejected" label="Rejected" />
        <NumberField source="items_failed" label="Failed" />
        <DateField source="started_at" label="Started" showTime />
        <DateField source="completed_at" label="Completed" showTime />
        <TextField source="error_message" label="Error" />

        {/* Enrichment Controls */}
        <Box sx={{ mt: 2, mb: 2 }}>
          <EnrichmentActions />
        </Box>

        {status && (
          <Box sx={{ mt: 2 }}>
            <strong>Live Status:</strong> {status.status} • {status.progress}%
          </Box>
        )}
      </SimpleShowLayout>
    </Show>
  );
};
