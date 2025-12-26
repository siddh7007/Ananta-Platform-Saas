import { useEffect, useMemo, useState } from 'react';
import { Box, Card, CardContent, Typography, TextField, Grid, Button, Table, TableHead, TableRow, TableCell, TableBody, Chip, LinearProgress, IconButton, Tooltip, Stack, Dialog, DialogTitle, DialogContent, DialogActions, Alert } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TableChartIcon from '@mui/icons-material/TableChart';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import { useTenant } from '../contexts/TenantContext';
import { CNS_API_URL, getAuthHeaders } from '../config/api';

interface UploadRow {
  id: string;
  filename: string;
  file_size?: number;
  tenant_id: string;
  project_id?: string;
  upload_source?: string;
  status?: string;
  total_rows?: number;
  created_at?: string;
}

export default function CustomerUploadsList() {
  const { tenantId, adminModeAllTenants } = useTenant();
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [nameFilter, setNameFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; row: UploadRow | null }>({ open: false, row: null });
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  const load = async () => {
    setLoading(true);
    try {
      // Build query params for CNS API
      const params = new URLSearchParams();

      if (!adminModeAllTenants && tenantId) {
        params.append('tenant_id', tenantId);
      } else if (tenantFilter) {
        params.append('tenant_id', tenantFilter);
      }

      if (projectFilter) {
        params.append('project_id', projectFilter);
      }

      if (nameFilter) {
        params.append('filename', nameFilter);
      }

      params.append('limit', '200');

      const url = `${CNS_API_URL}/customer/uploads?${params.toString()}`;
      const headers = getAuthHeaders() || {};

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch uploads: ${response.status}`);
      }

      const data = await response.json();
      setRows(data.uploads || []);
    } catch (e) {
      console.error('CustomerUploadsList load error', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [adminModeAllTenants, tenantId]);

  const filtered = useMemo(() => rows, [rows]);

  const handleDelete = async () => {
    if (!deleteDialog.row) return;
    setDeleting(true);
    try {
      const url = `${CNS_API_URL}/customer/upload/${deleteDialog.row.id}`;
      const headers = getAuthHeaders() || {};

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          reason: 'Deleted via CNS Dashboard',
          actor_id: localStorage.getItem('user_id') || undefined,
          actor_name: localStorage.getItem('user_name') || undefined,
          actor_email: localStorage.getItem('user_email') || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to delete: ${response.status}`);
      }

      showSuccess('Upload deleted successfully');
      setDeleteDialog({ open: false, row: null });
      load();
    } catch (err: any) {
      showError(`Failed to delete: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Customer Uploads</Typography>
        <Button onClick={load} startIcon={<RefreshIcon />} disabled={loading} variant="outlined">Refresh</Button>
      </Box>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Filename contains" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Tenant ID" value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)} placeholder={adminModeAllTenants ? 'filter (optional)' : tenantId} disabled={!adminModeAllTenants} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Project ID" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        {loading && <LinearProgress />}
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Filename</TableCell>
                <TableCell>Tenant</TableCell>
                <TableCell>Project</TableCell>
                <TableCell align="right">Rows</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Uploaded</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.filename}</TableCell>
                  <TableCell>{r.tenant_id}</TableCell>
                  <TableCell>{r.project_id || '-'}</TableCell>
                  <TableCell align="right">{r.total_rows || 0}</TableCell>
                  <TableCell>{r.status ? <Chip label={r.status} size="small" color={r.status === 'completed' ? 'success' : r.status === 'failed' ? 'error' : 'default'} /> : '-'}</TableCell>
                  <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      <Tooltip title="Delete Upload">
                        <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleteDialog({ open: true, row: r }); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View Details">
                        <IconButton size="small" color="info" onClick={(e) => { e.stopPropagation(); navigate(`/bom-jobs/${r.id}`); }}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View Line Items">
                        <IconButton size="small" color="success" onClick={(e) => { e.stopPropagation(); navigate(`/bom-jobs/${r.id}`); }}>
                          <TableChartIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {r.status !== 'completed' && r.status !== 'enriching' && (
                        <Tooltip title="Start Enrichment">
                          <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); navigate(`/bom-jobs/${r.id}`); }}>
                            <PlayArrowIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center">No uploads found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, row: null })} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Upload?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will permanently delete this upload record. This action cannot be undone.
          </Alert>
          <Typography>
            Are you sure you want to delete "{deleteDialog.row?.filename}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, row: null })} disabled={deleting}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
