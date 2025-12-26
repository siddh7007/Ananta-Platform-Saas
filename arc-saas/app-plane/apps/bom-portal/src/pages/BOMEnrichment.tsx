/**
 * BOM Enrichment Management Page
 *
 * Separate page for managing BOM enrichment:
 * - List uploaded BOMs
 * - Trigger enrichment manually
 * - Monitor real-time enrichment progress
 * - View enrichment history and results
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Replay as RetryIcon,
  ListAlt as ListIcon,
  TableChart as ComponentsIcon,
  Stop as StopIcon,
  Pause as PauseIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useNotify, usePermissions } from 'react-admin';
import { supabase } from '../providers/dataProvider';
import { useOrganization } from '../contexts/OrganizationContext';
import { EnrichmentProgressMonitor } from '../components/EnrichmentProgressMonitor';
import { BOMDetailView } from '../components/BOMDetailView';
import { ComponentDetailDialog } from '../components/ComponentDetailDialog';
import { getCnsBaseUrl, getAuthHeaders } from '../services/cnsApi';

interface BOM {
  id: string; // BOM ID (from boms table)
  upload_id?: string; // Upload ID (from bom_uploads table)
  name: string;
  status: string;
  created_at: string;
  total_rows: number;
  enrichment_status?: 'not_started' | 'enriching' | 'completed' | 'failed';
  enriched_count?: number;
  failed_count?: number;
}

export const BOMEnrichmentPage: React.FC = () => {
  const notify = useNotify();
  const { permissions } = usePermissions();
  const { currentOrg } = useOrganization();
  const isAdmin = permissions === 'owner' || permissions === 'admin' || permissions === 'super_admin';
  const [showDebugIds, setShowDebugIds] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cbp_show_debug_ids') === 'true';
    } catch {
      return false;
    }
  });
  // Use organization context to determine tenant scope
  const tenantId = currentOrg?.id || null;
  const currentProjectId = localStorage.getItem('current_project_id');

  const [boms, setBoms] = useState<BOM[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBomId, setSelectedBomId] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [startingEnrichment, setStartingEnrichment] = useState<string | null>(null);
  const [resettingFailed, setResettingFailed] = useState<string | null>(null);
  const [stoppingEnrichment, setStoppingEnrichment] = useState<string | null>(null);
  const [deletingBom, setDeletingBom] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Phase 1: Component Detail View
  const [showDetailView, setShowDetailView] = useState(false);
  const [detailViewBomId, setDetailViewBomId] = useState<string | null>(null);
  const [detailViewBomName, setDetailViewBomName] = useState<string>('');

  // Phase 2: Component Parameters from Vault
  const [showComponentDetail, setShowComponentDetail] = useState(false);
  const [selectedComponentId, setSelectedComponentId] = useState<number | null>(null);

  // Auto-open enrichment monitor if URL params indicate it
  useEffect(() => {
    const hash = window.location.hash || '';
    const queryString = hash.includes('?')
      ? hash.substring(hash.indexOf('?') + 1)
      : (window.location.search ? window.location.search.substring(1) : '');
    const params = new URLSearchParams(queryString);
    const bomIdParam = params.get('bomId');
    const autoOpenParam = params.get('autoOpen');

    if (bomIdParam && autoOpenParam === 'true') {
      console.log('[BOM Enrichment] Auto-opening monitor for BOM:', bomIdParam);

      // Validate BOM exists before opening monitor
      const validateAndOpen = async () => {
        try {
          const { data: bom, error } = await supabase
            .from('boms')
            .select('id, name, status')
            .eq('id', bomIdParam)
            .single();

          if (error || !bom) {
            console.error('[BOM Enrichment] Invalid BOM ID in URL parameters:', bomIdParam, error);
            notify('Invalid BOM ID in URL. Please select a BOM from the list.', { type: 'warning' });
            // Clean up invalid URL params
            window.history.replaceState({}, '', '/customer-portal/#/bom/enrichment');
            return;
          }

          console.log('[BOM Enrichment] ✅ Validated BOM exists:', bom.name, bom.status);
          setSelectedBomId(bomIdParam);
          setShowProgress(true);

          // Clean up URL params after opening
          window.history.replaceState({}, '', '/customer-portal/#/bom/enrichment');
        } catch (err) {
          console.error('[BOM Enrichment] Error validating BOM ID:', err);
          notify('Error validating BOM. Please try again.', { type: 'error' });
          window.history.replaceState({}, '', '/customer-portal/#/bom/enrichment');
        }
      };

      validateAndOpen();
    }
  }, []);

  // Load BOMs from Supabase (BOM-centric)
  const loadBOMs = async () => {
      try {
        if (!tenantId) {
          throw new Error('No organization selected');
        }
        setLoading(true);

      // Get BOMs from boms table for this tenant/project
      let query = supabase
        .from('boms')
        .select('id, name, status, created_at, component_count, metadata')
        .eq('organization_id', tenantId);

      if (currentProjectId) {
        query = query.eq('project_id', currentProjectId);
      }

      const { data: bomsData, error } = await query
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get latest enrichment status for each BOM
      const bomsWithStatus = await Promise.all(
        (bomsData || []).map(async (bom) => {
          // Get latest enrichment event (don't use .single() as it throws if no rows)
          const { data: events, error } = await supabase
            .from('enrichment_events')
            .select('*')
            .eq('bom_id', bom.id)
            .order('created_at', { ascending: false })
            .limit(1);

          const latestEvent = events && events.length > 0 ? events[0] : null;

          if (error && error.code !== 'PGRST116') {
            // Log error unless it's just "no rows found"
            console.error(`[BOMEnrichment] Error fetching events for ${bom.id}:`, error);
          }

          return {
            id: bom.id,
            upload_id: bom.metadata?.bom_upload_id || bom.metadata?.upload_id, // optional legacy context
            name: bom.name || 'Untitled BOM',
            status: bom.status,
            created_at: bom.created_at,
            // Prefer component_count; fall back to metadata.total_rows if present
            total_rows: bom.component_count ?? bom.metadata?.total_rows ?? 0,
            enrichment_status: latestEvent?.state?.status || 'not_started',
            enriched_count: latestEvent?.state?.enriched_items || 0,
            failed_count: latestEvent?.state?.failed_items || 0,
          };
        })
      );

      setBoms(bomsWithStatus);
    } catch (error: any) {
      console.error('Error loading BOMs:', error);
      notify(`Failed to load BOMs: ${error.message}`, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Stable callbacks for SSE handler to avoid re-creating EventSource
  const handleComplete = useCallback((event) => {
    console.log('[Page] Enrichment completed:', event);
    notify('Enrichment completed!', { type: 'success' });
    loadBOMs();
  }, [notify, loadBOMs]);

  const handleError = useCallback((error) => {
    console.error('[Page] Enrichment error:', error);
    notify(`Enrichment error: ${error.message}`, { type: 'error' });
  }, [notify]);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    loadBOMs();
  }, [currentProjectId, tenantId]);

  // Start enrichment for a BOM
  const startEnrichment = async (bomId: string) => {
    try {
      setStartingEnrichment(bomId);

      // Open progress monitor BEFORE starting enrichment
      // This ensures SSE connection is established before events start flowing
      setSelectedBomId(bomId);
      setShowProgress(true);

      const cnsBaseUrl = getCnsBaseUrl();
      const authHeaders = await getAuthHeaders();
      
      // Validate required fields
      if (!tenantId) {
        throw new Error("Organization ID is missing. Please refresh the page.");
      }
      
      // Call CNS API to start enrichment
      const response = await fetch(`${cnsBaseUrl}/api/boms/${bomId}/enrichment/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        ...authHeaders,
        },
        body: JSON.stringify({
          organization_id: tenantId,
          project_id: currentProjectId || undefined,
        }),
      });

      if (response.status === 409) {
        // Workflow already running – treat as success and keep monitor open
        const errorData = await response.json().catch(() => ({}));
        console.log('[Enrichment] Workflow already running for BOM:', bomId, errorData);
        notify('Enrichment already in progress. Attached to existing run.', { type: 'info' });
      } else if (response.status === 400) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData?.detail ?? errorData;
        console.error('[Enrichment] Failed to start (400):', detail);
        if (detail && typeof detail === 'object' && detail.code === 'NO_PENDING_ITEMS') {
          // Close monitor – nothing to stream
          setShowProgress(false);
          setSelectedBomId(null);
          notify('No pending line items. BOM may already be enriched.', { type: 'info' });
          return;
        }
        // Close monitor on unexpected 400
        setShowProgress(false);
        setSelectedBomId(null);
        throw new Error(detail?.message || errorData.message || 'Failed to start enrichment');
      } else if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData?.detail ?? errorData;
        setShowProgress(false);
        setSelectedBomId(null);
        throw new Error(detail?.message || errorData.message || 'Failed to start enrichment');
      } else {
        const data = await response.json().catch(() => ({}));
        console.log('[Enrichment] Started:', data);
        notify('Enrichment started successfully!', { type: 'success' });
      }

      // Reload BOMs after a delay
      setTimeout(loadBOMs, 2000);
    } catch (error: any) {
      console.error('Error starting enrichment:', error);
      notify(`Failed to start enrichment: ${error.message}`, { type: 'error' });
    } finally {
      setStartingEnrichment(null);
    }
  };

  // Bulk reset failed items and restart enrichment
  const retryFailedItems = async (bomId: string) => {
    try {
      setResettingFailed(bomId);

      // Open progress monitor BEFORE starting retry
      // This ensures SSE connection is established before events start flowing
      setSelectedBomId(bomId);
      setShowProgress(true);

      const cnsBaseUrl = getCnsBaseUrl();
      const authHeaders = await getAuthHeaders();
      
      // Validate required fields
      if (!tenantId) {
        throw new Error("Organization ID is missing. Please refresh the page.");
      }
      
      // Step 1: Bulk reset failed items to pending
      const resetResponse = await fetch(`${cnsBaseUrl}/api/boms/${bomId}/line_items/bulk-reset-failed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        ...authHeaders,
        },
      });

      if (!resetResponse.ok) {
        const errorData = await resetResponse.json().catch(() => ({}));
        // Close progress monitor on error
        setShowProgress(false);
        setSelectedBomId(null);
        throw new Error(errorData.detail || 'Failed to reset failed items');
      }

      const resetData = await resetResponse.json();
      console.log('[Bulk Reset] Result:', resetData);

      notify(`Reset ${resetData.items_reset} failed items to pending`, { type: 'success' });

      // Step 2: Start enrichment immediately after reset
      const enrichResponse = await fetch(`${cnsBaseUrl}/api/boms/${bomId}/enrichment/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        ...authHeaders,
        },
        body: JSON.stringify({
          organization_id: tenantId,
          project_id: currentProjectId || undefined,
        }),
      });

      if (enrichResponse.status === 409) {
        const errorData = await enrichResponse.json().catch(() => ({}));
        console.log('[Enrichment] Workflow already running after reset:', errorData);
        notify('Enrichment already in progress. Attached to existing run.', { type: 'info' });
      } else if (enrichResponse.status === 400) {
        const errorData = await enrichResponse.json().catch(() => ({}));
        console.error('[Enrichment] Failed to start after reset (400):', errorData);
        if (errorData && typeof errorData === 'object' && errorData.code === 'NO_PENDING_ITEMS') {
          setShowProgress(false);
          setSelectedBomId(null);
          notify('No pending line items after reset. BOM may already be enriched.', { type: 'info' });
          return;
        }
        setShowProgress(false);
        setSelectedBomId(null);
        throw new Error(errorData.detail || errorData.message || 'Failed to start enrichment');
      } else if (!enrichResponse.ok) {
        const errorData = await enrichResponse.json().catch(() => ({}));
        // Close progress monitor on error
        setShowProgress(false);
        setSelectedBomId(null);
        throw new Error(errorData.detail || errorData.message || 'Failed to start enrichment');
      } else {
        const enrichData = await enrichResponse.json().catch(() => ({}));
        console.log('[Enrichment] Started after reset:', enrichData);
        notify('Enrichment restarted successfully!', { type: 'success' });
      }

      // Reload BOMs after a delay
      setTimeout(loadBOMs, 2000);
    } catch (error: any) {
      console.error('Error retrying failed items:', error);
      notify(`Failed to retry: ${error.message}`, { type: 'error' });
    } finally {
      setResettingFailed(null);
    }
  };

  // Stop/Cancel enrichment workflow
  const stopEnrichment = async (bomId: string) => {
    try {
      setStoppingEnrichment(bomId);
      const cnsBaseUrl = getCnsBaseUrl();
      const authHeaders = await getAuthHeaders();

      const response = await fetch(`${cnsBaseUrl}/api/boms/${bomId}/enrichment/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        ...authHeaders,
        },
        body: JSON.stringify({
          bom_id: bomId,
          reason: 'User stopped enrichment from Customer Portal',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Failed to stop enrichment');
      }

      notify('Enrichment stopped successfully', { type: 'success' });

      // Close progress monitor if open
      if (selectedBomId === bomId) {
        setShowProgress(false);
        setSelectedBomId(null);
      }

      // Reload BOMs
      setTimeout(loadBOMs, 1000);
    } catch (error: any) {
      console.error('Error stopping enrichment:', error);
      notify(`Failed to stop enrichment: ${error.message}`, { type: 'error' });
    } finally {
      setStoppingEnrichment(null);
    }
  };

  // Delete BOM and all its line items
  const deleteBom = async (bomId: string) => {
    try {
      setDeletingBom(bomId);

      // Delete from Supabase
      const { error } = await supabase
        .from('boms')
        .delete()
        .eq('id', bomId);

      if (error) {
        throw new Error(error.message);
      }

      notify('BOM deleted successfully', { type: 'success' });
      setConfirmDelete(null);

      // Reload BOMs
      loadBOMs();
    } catch (error: any) {
      console.error('Error deleting BOM:', error);
      notify(`Failed to delete BOM: ${error.message}`, { type: 'error' });
    } finally {
      setDeletingBom(null);
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'enriching':
        return 'info';
      case 'failed':
        return 'error';
      case 'not_started':
        return 'default';
      default:
        return 'default';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckIcon fontSize="small" />;
      case 'enriching':
        return <CircularProgress size={16} />;
      case 'failed':
        return <ErrorIcon fontSize="small" />;
      case 'not_started':
        return <PendingIcon fontSize="small" />;
      default:
        return null;
    }
  };

  if (!tenantId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Select an organization to manage BOM enrichment.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1">
            BOM Enrichment
          </Typography>
          {isAdmin && (
            <Typography variant="caption" color="textSecondary">
              Admin setting: internal IDs are currently {showDebugIds ? 'visible' : 'hidden'}.
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          {isAdmin && (
            <Button
              size="small"
              variant={showDebugIds ? 'contained' : 'outlined'}
              onClick={() => {
                const next = !showDebugIds;
                setShowDebugIds(next);
                try {
                  localStorage.setItem('cbp_show_debug_ids', String(next));
                } catch {
                  // ignore
                }
              }}
            >
              {showDebugIds ? 'Hide Technical IDs' : 'Show Technical IDs'}
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadBOMs}
            disabled={loading}
          >
            Refresh
          </Button>
        </Stack>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>BOM Enrichment</strong> fetches component data (pricing, availability, datasheets) from suppliers like Mouser, DigiKey, and Element14.
          Start enrichment for uploaded BOMs to get real-time data.
        </Typography>
      </Alert>

      {/* BOMs Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Uploaded BOMs
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : boms.length === 0 ? (
            <Alert severity="info">
              No BOMs uploaded yet. Upload a BOM first from the Upload page.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'background.paper' }}>
                    <TableCell><strong>BOM Name</strong></TableCell>
                    <TableCell><strong>Uploaded</strong></TableCell>
                    <TableCell align="center"><strong>Total Items</strong></TableCell>
                    <TableCell align="center"><strong>Enrichment Status</strong></TableCell>
                    <TableCell align="center"><strong>Enriched</strong></TableCell>
                    <TableCell align="center"><strong>Failed</strong></TableCell>
                    <TableCell align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {boms.map((bom) => (
                    <TableRow key={bom.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {bom.name}
                        </Typography>
                        {isAdmin && showDebugIds && (
                          <Typography variant="caption" color="text.secondary">
                            #{bom.id.substring(0, 8)}...
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(bom.created_at).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={bom.total_rows}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={getStatusIcon(bom.enrichment_status || 'not_started')}
                          label={bom.enrichment_status || 'not_started'}
                          color={getStatusColor(bom.enrichment_status || 'not_started')}
                          size="small"
                          sx={(theme) => bom.enrichment_status === 'completed' ? ({
                            bgcolor: '#22c55e !important',
                            color: theme.palette.mode === 'dark' ? '#ffffff' : '#000000',
                            '& .MuiChip-icon': { color: theme.palette.mode === 'dark' ? '#ffffff' : '#000000' }
                          }) : undefined}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {bom.enriched_count > 0 ? (
                          <Chip
                            label={bom.enriched_count}
                            color="success"
                            size="small"
                            variant="outlined"
                            sx={(theme) => ({
                              borderColor: '#22c55e',
                              color: theme.palette.mode === 'dark' ? '#ffffff' : '#22c55e',
                            })}
                          />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {bom.failed_count > 0 ? (
                          <Chip
                            label={bom.failed_count}
                            color="error"
                            size="small"
                            variant="outlined"
                          />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Tooltip title="Start Enrichment">
                            <span>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => startEnrichment(bom.id)}
                                disabled={
                                  startingEnrichment === bom.id ||
                                  bom.enrichment_status === 'enriching'
                                }
                              >
                                {startingEnrichment === bom.id ? (
                                  <CircularProgress size={20} />
                                ) : (
                                  <StartIcon />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>

                          {/* Stop/Pause Button - Show when enrichment is running */}
                          {bom.enrichment_status === 'enriching' && (
                            <Tooltip title="Stop Enrichment">
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => stopEnrichment(bom.id)}
                                  disabled={stoppingEnrichment === bom.id}
                                >
                                  {stoppingEnrichment === bom.id ? (
                                    <CircularProgress size={20} />
                                  ) : (
                                    <StopIcon />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}

                          {/* Delete Button with Confirmation - Always visible */}
                          <Tooltip title={bom.enrichment_status === 'enriching' ? "Stop enrichment first to delete" : "Delete BOM"}>
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setConfirmDelete(bom.id)}
                                disabled={deletingBom === bom.id}
                              >
                                {deletingBom === bom.id ? (
                                  <CircularProgress size={20} />
                                ) : (
                                  <DeleteIcon />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>

                          {bom.failed_count > 0 && (
                            <Tooltip title={`Retry ${bom.failed_count} Failed Items`}>
                              <span>
                                <IconButton
                                  size="small"
                                  color="warning"
                                  onClick={() => retryFailedItems(bom.id)}
                                  disabled={
                                    resettingFailed === bom.id ||
                                    bom.enrichment_status === 'enriching'
                                  }
                                >
                                  {resettingFailed === bom.id ? (
                                    <CircularProgress size={20} />
                                  ) : (
                                    <RetryIcon />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          <Tooltip title="View Progress">
                            <IconButton
                              size="small"
                              color="info"
                              onClick={() => {
                                setSelectedBomId(bom.id);
                                setShowProgress(true);
                              }}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="View Components">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => {
                                setDetailViewBomId(bom.id);
                                setDetailViewBomName(bom.name);
                                setShowDetailView(true);
                              }}
                            >
                              <ComponentsIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="View BOM Audit Events">
                            <IconButton
                              size="small"
                              onClick={() => {
                                window.location.hash = `/bom/audit?bomId=${bom.id}`;
                              }}
                            >
                              <ListIcon fontSize="small" />
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

      {/* Progress Monitor Dialog */}
      <Dialog
        open={showProgress}
        onClose={() => setShowProgress(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Enrichment Progress
          {selectedBomId && (
            <Typography variant="caption" display="block" color="text.secondary">
              BOM ID: {selectedBomId}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {selectedBomId && (
            <EnrichmentProgressMonitor
              bomId={selectedBomId}
              onComplete={handleComplete}
              onError={handleError}
              showDetailedLog={true}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProgress(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Component Detail View Dialog - Phase 1 */}
      {showDetailView && detailViewBomId && (
        <BOMDetailView
          bomId={detailViewBomId}
          bomName={detailViewBomName}
          tenantId={tenantId}
          projectId={currentProjectId}
          onClose={() => {
            setShowDetailView(false);
            setDetailViewBomId(null);
            setDetailViewBomName('');
          }}
          onComponentClick={(component) => {
            // Phase 2: Open component detail dialog with full parameters from vault
            console.log('[BOM Enrichment] Opening component detail:', component);

            // Get component vault ID from enrichment_data or component_id field
            const componentId = component.enrichment_data?.component_id ||
                              (component as any).component_id;

            console.log('[BOM Enrichment] Extracted component_id:', componentId);
            console.log('[BOM Enrichment] enrichment_data:', component.enrichment_data);
            console.log('[BOM Enrichment] component.component_id:', (component as any).component_id);

            if (componentId) {
              console.log('[BOM Enrichment] ✅ Opening detail dialog for component_id:', componentId);
              setSelectedComponentId(componentId);
              setShowComponentDetail(true);
            } else {
              console.log('[BOM Enrichment] ❌ No component_id found, showing notification');
              notify('Component not yet enriched or no vault ID available', { type: 'info' });
            }
          }}
        />
      )}

      {/* Component Detail Dialog - Phase 2 */}
      <ComponentDetailDialog
        componentId={selectedComponentId}
        open={showComponentDetail}
        onClose={() => {
          setShowComponentDetail(false);
          setSelectedComponentId(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will permanently delete this BOM and all its line items. This action cannot be undone.
          </Alert>
          <Typography>
            Are you sure you want to delete this BOM?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDelete(null)}
            disabled={deletingBom !== null}
          >
            Cancel
          </Button>
          <Button
            onClick={() => confirmDelete && deleteBom(confirmDelete)}
            color="error"
            variant="contained"
            disabled={deletingBom !== null}
            startIcon={deletingBom !== null ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deletingBom !== null ? 'Deleting...' : 'Delete BOM'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
