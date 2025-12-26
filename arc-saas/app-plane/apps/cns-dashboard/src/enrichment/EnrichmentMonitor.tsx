/**
 * CNS Dashboard - Enrichment Monitor (Admin View)
 *
 * Shows ALL enrichment activities across the platform:
 * - Customer Portal BOMs (source='customer')
 * - CNS Bulk Uploads (source='staff')
 *
 * Features:
 * - Real-time monitoring of multiple enrichments
 * - Filter by source, status, date
 * - View detailed progress for any BOM
 * - System-wide enrichment metrics
 *
 * Refactored to use modular subcomponents for better maintainability.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { EnrichmentProgressMonitor } from './EnrichmentProgressMonitor';
import { EnrichmentStats, EnrichmentStatsData } from './EnrichmentStats';
import { EnrichmentFilters, SourceFilter, StatusFilter } from './EnrichmentFilters';
import { EnrichmentJobRow, Enrichment } from './EnrichmentJobRow';
import { ComponentDetailDialog, ComponentDetail } from '../components/shared';
import { LineItem } from './EnrichmentLineItems';
import { PageHeader, NoDataState, ErrorBoundary, EnrichmentRowSkeleton } from '../components/shared';
import { useTenant } from '../contexts/TenantContext';
import { CNS_API_URL, getAdminAuthHeaders } from '../config/api';
import { useNotification } from '../contexts/NotificationContext';
import { useDebouncedCallback, useDeduplicatedFetch } from '../hooks';

const REFRESH_INTERVAL_MS = 30_000;

export const EnrichmentMonitor: React.FC = () => {
  const [allEnrichments, setAllEnrichments] = useState<Enrichment[]>([]);
  const [enrichments, setEnrichments] = useState<Enrichment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBomId, setSelectedBomId] = useState<string | null>(null);
  const [selectedBomMeta, setSelectedBomMeta] = useState<Pick<Enrichment, 'bom_id' | 'bom_name' | 'bom_filename'> | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { tenantId, adminModeAllTenants } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  const initialBomId = (location.state as any)?.bomId as string | undefined;
  const autoOpenRef = useRef(false);
  const { showError, showSuccess } = useNotification();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stoppingEnrichment, setStoppingEnrichment] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletingBom, setDeletingBom] = useState<string | null>(null);

  // Line items state for expandable rows
  const [expandedBomId, setExpandedBomId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<Record<string, LineItem[]>>({});
  const [lineItemsLoading, setLineItemsLoading] = useState<Record<string, boolean>>({});

  // Component detail dialog state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [componentDetail, setComponentDetail] = useState<ComponentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Request deduplication
  const { execute: dedupeExecute, isPending } = useDeduplicatedFetch();

  // Apply filters to enrichments
  const applyFilters = useCallback((items: Enrichment[]): Enrichment[] => {
    let filtered = items;
    if (sourceFilter !== 'all') {
      filtered = filtered.filter((e) => e.source === sourceFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((e) => e.status === statusFilter);
    }
    return filtered;
  }, [sourceFilter, statusFilter]);

  // Map API response to Enrichment type
  const mapApiResponse = useCallback((records: any[]): Enrichment[] => {
    if (!records) return [];

    return records.map((item) => {
      const rawTotal = item.total_items ?? item.component_count ?? 0;
      const totalItems = typeof rawTotal === 'number' ? rawTotal : parseInt(rawTotal, 10) || 0;
      const percentCompleteRaw = typeof item.percent_complete === 'number' ? item.percent_complete : parseFloat(item.percent_complete || '0');
      const percentComplete = Number.isFinite(percentCompleteRaw) ? percentCompleteRaw : 0;
      const rawEnriched = item.enriched_items;
      const enrichedItems = typeof rawEnriched === 'number' ? rawEnriched : rawEnriched != null ? parseInt(rawEnriched, 10) || 0 : Math.round(totalItems * (percentComplete / 100));
      const rawFailed = item.failed_items;
      const failedItems = typeof rawFailed === 'number' ? rawFailed : rawFailed != null ? parseInt(rawFailed, 10) || 0 : 0;
      const completedAt = item.completed_at ?? (percentComplete >= 100 ? item.started_at : undefined);

      return {
        bom_id: item.bom_id,
        bom_name: item.bom_name,
        bom_filename: item.bom_filename,
        source: item.source === 'customer' || item.source === 'staff' ? item.source : 'unknown',
        tenant_id: item.tenant_id,
        project_id: item.project_id,
        status: item.status ?? 'unknown',
        total_items: totalItems,
        enriched_items: enrichedItems,
        failed_items: failedItems,
        percent_complete: percentComplete || 0,
        started_at: item.started_at,
        completed_at: completedAt,
        workflow_id: item.workflow_id,
      } as Enrichment;
    });
  }, []);

  // Load enrichments from API
  const loadFromApi = useCallback(async (): Promise<Enrichment[] | null> => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (!adminModeAllTenants && tenantId) {
        params.set('tenant_id', tenantId);
      }

      const headers: Record<string, string> = { Accept: 'application/json' };
      const authHeaders = getAdminAuthHeaders();
      if (authHeaders) {
        if (authHeaders instanceof Headers) {
          authHeaders.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(authHeaders)) {
          authHeaders.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          Object.assign(headers, authHeaders as Record<string, string>);
        }
      }

      const response = await fetch(`${CNS_API_URL}/admin/enrichment?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Admin enrichment request failed (${response.status})`);
      }

      const payload = await response.json();
      return mapApiResponse(payload);
    } catch (error: any) {
      console.error('[EnrichmentMonitor] Fallback admin load failed:', error);
      setLoadError('Failed to load enrichment data from CNS API.');
      showError('Failed to load enrichment data from CNS API.');
      return null;
    }
  }, [adminModeAllTenants, tenantId, mapApiResponse, showError]);

  // Handle BOM selection for progress view
  const handleSelectBom = useCallback((enrichment: Enrichment) => {
    setSelectedBomId(enrichment.bom_id);
    setSelectedBomMeta({ bom_id: enrichment.bom_id, bom_name: enrichment.bom_name, bom_filename: enrichment.bom_filename });
    setShowProgress(true);
  }, []);

  // Navigate to BOM detail page
  const handleOpenBomDetail = useCallback((bomId: string) => {
    if (!bomId) {
      showError('BOM ID missing; cannot open components view.');
      return;
    }
    navigate(`/bom-jobs/${bomId}`);
  }, [navigate, showError]);

  // Navigate to audit events
  const handleNavigateAudit = useCallback((bomId: string) => {
    navigate(`/audit-stream?bomId=${bomId}`);
  }, [navigate]);

  // Stop/Cancel enrichment workflow
  const handleStopEnrichment = useCallback(async (bomId: string) => {
    try {
      setStoppingEnrichment(bomId);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      const authHeaders = getAdminAuthHeaders();
      if (authHeaders) {
        Object.assign(headers, authHeaders as Record<string, string>);
      }

      const response = await fetch(`${CNS_API_URL}/boms/${bomId}/enrichment/stop`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          bom_id: bomId,
          reason: 'Admin stopped from CNS Dashboard',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Failed to stop enrichment');
      }

      showSuccess('Enrichment stopped successfully');
      setTimeout(() => loadEnrichments({ showSpinner: false }), 1000);
    } catch (error: any) {
      console.error('Error stopping enrichment:', error);
      showError(`Failed to stop enrichment: ${error.message}`);
    } finally {
      setStoppingEnrichment(null);
    }
  }, [showSuccess, showError]);

  // Delete BOM enrichment
  const handleDeleteBom = useCallback(async (bomId: string) => {
    try {
      setDeletingBom(bomId);

      const headers: Record<string, string> = { Accept: 'application/json' };
      const authHeaders = getAdminAuthHeaders();
      if (authHeaders) {
        Object.assign(headers, authHeaders as Record<string, string>);
      }

      const response = await fetch(`${CNS_API_URL}/boms/${bomId}/enrichment`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Failed to delete enrichment');
      }

      showSuccess('Enrichment deleted successfully');
      setConfirmDelete(null);
      loadEnrichments({ showSpinner: false });
    } catch (error: any) {
      console.error('Error deleting enrichment:', error);
      showError(`Failed to delete enrichment: ${error.message}`);
    } finally {
      setDeletingBom(null);
    }
  }, [showSuccess, showError]);

  // Load enrichments
  const loadEnrichments = useCallback(
    async (options: { showSpinner?: boolean } = {}) => {
      const { showSpinner = true } = options;
      if (showSpinner) {
        setLoading(true);
      }

      const applyAndSet = (list: Enrichment[]) => {
        setAllEnrichments(list);
        const filtered = applyFilters(list);
        setEnrichments(filtered);

        if (!autoOpenRef.current && initialBomId) {
          const matched = list.find((e) => e.bom_id === initialBomId);
          if (matched) {
            handleSelectBom(matched);
            autoOpenRef.current = true;
          }
        }
      };

      try {
        const apiList = await loadFromApi();
        if (apiList) {
          setLoadError(null);
          applyAndSet(apiList);
        } else {
          setAllEnrichments([]);
          setEnrichments([]);
        }
      } catch (error: any) {
        const message = error instanceof Error ? error.message : 'Failed to load enrichment data.';
        console.error('[EnrichmentMonitor] Error loading enrichments:', error);
        setLoadError(message);
        showError(message);
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    [loadFromApi, applyFilters, initialBomId, showError, handleSelectBom]
  );

  // Initial load
  useEffect(() => {
    void loadEnrichments();
  }, [loadEnrichments]);

  // Re-apply filters when they change
  useEffect(() => {
    setEnrichments(applyFilters(allEnrichments));
  }, [allEnrichments, applyFilters]);

  // Auto-refresh interval
  useEffect(() => {
    const interval = setInterval(() => {
      loadEnrichments({ showSpinner: false }).catch((error) => {
        console.error('[EnrichmentMonitor] Background refresh failed:', error);
      });
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loadEnrichments]);

  // Calculate stats
  const stats: EnrichmentStatsData = {
    total: allEnrichments.length,
    enriching: allEnrichments.filter((e) => e.status === 'enriching').length,
    completed: allEnrichments.filter((e) => e.status === 'completed').length,
    failed: allEnrichments.filter((e) => e.status === 'failed').length,
    customer: allEnrichments.filter((e) => e.source === 'customer').length,
    staff: allEnrichments.filter((e) => e.source === 'staff').length,
  };

  // Fetch line items for a BOM
  const fetchLineItems = async (bomId: string, forceRefresh = false) => {
    if (lineItems[bomId] && !forceRefresh) return;

    setLineItemsLoading((prev) => ({ ...prev, [bomId]: true }));
    try {
      const headers: Record<string, string> = {};
      const authHeaders = getAdminAuthHeaders();
      if (authHeaders) Object.assign(headers, authHeaders as Record<string, string>);

      const res = await fetch(`${CNS_API_URL}/boms/${bomId}/line_items?page=1&page_size=500`, { headers });
      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      const items: LineItem[] = (data.items || []).map((item: any) => ({
        id: item.id,
        bom_id: item.bom_id,
        line_number: item.line_number,
        manufacturer_part_number: item.manufacturer_part_number,
        manufacturer: item.manufacturer,
        quantity: item.quantity || 1,
        reference_designator: item.reference_designator,
        description: item.description,
        enrichment_status: item.enrichment_status || 'pending',
        component_id: item.component_id,
        enrichment_error: item.enrichment_error,
      }));

      setLineItems((prev) => ({ ...prev, [bomId]: items }));
    } catch (err) {
      console.error('[EnrichmentMonitor] Failed to fetch line items:', err);
      showError('Failed to load line items');
    } finally {
      setLineItemsLoading((prev) => ({ ...prev, [bomId]: false }));
    }
  };

  // Toggle row expansion
  const toggleExpandRow = (bomId: string) => {
    if (expandedBomId === bomId) {
      setExpandedBomId(null);
    } else {
      setExpandedBomId(bomId);
      void fetchLineItems(bomId);
    }
  };

  // Refresh line items for a BOM
  const refreshLineItems = (bomId: string) => {
    void fetchLineItems(bomId, true);
  };

  // Invalidate line items cache for active enrichments on main refresh
  const invalidateActiveEnrichmentsCache = () => {
    const activeStatuses = ['enriching'];
    setLineItems((prev) => {
      const newCache: Record<string, LineItem[]> = {};
      Object.entries(prev).forEach(([bomId, items]) => {
        const bomRow = enrichments.find((e) => e.bom_id === bomId);
        if (bomRow && !activeStatuses.includes(bomRow.status)) {
          newCache[bomId] = items;
        }
      });
      return newCache;
    });
  };

  // Fetch component details
  const fetchComponentDetail = async (componentId: string) => {
    setDetailLoading(true);
    try {
      const headers: Record<string, string> = {};
      const authHeaders = getAdminAuthHeaders();
      if (authHeaders) Object.assign(headers, authHeaders as Record<string, string>);

      const res = await fetch(`${CNS_API_URL}/catalog/component/id/${componentId}`, { headers });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setComponentDetail(data);
    } catch (err) {
      console.error('[EnrichmentMonitor] Failed to fetch component details:', err);
      showError('Failed to load component details');
      setComponentDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const openComponentDetail = (componentId: string) => {
    setDetailDialogOpen(true);
    void fetchComponentDetail(componentId);
  };

  const closeComponentDetail = () => {
    setDetailDialogOpen(false);
    setComponentDetail(null);
  };

  // Debounced refresh to prevent rapid-fire clicks
  const handleRefresh = useDebouncedCallback(() => {
    // Skip if already loading
    if (isPending('enrichments')) {
      return;
    }

    void dedupeExecute(
      { key: 'enrichments', minInterval: 1000 },
      async () => {
        invalidateActiveEnrichmentsCache();
        await loadEnrichments();
      }
    );
  }, 300);

  return (
    <ErrorBoundary>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <PageHeader
          title="Enrichment Monitor"
          description="Real-time monitoring of BOM enrichment activities"
          onRefresh={handleRefresh}
          refreshing={loading}
        />

      {/* Stats Cards */}
      <Box mb={3}>
        <EnrichmentStats stats={stats} loading={loading} />
      </Box>

      {/* Filters */}
      <Box mb={3}>
        <EnrichmentFilters
          sourceFilter={sourceFilter}
          statusFilter={statusFilter}
          onSourceChange={setSourceFilter}
          onStatusChange={setStatusFilter}
        />
      </Box>

      {/* Enrichments Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Enrichments
          </Typography>

          {loadError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {loadError}
            </Alert>
          )}

          {loading ? (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell padding="checkbox" />
                    <TableCell><strong>BOM</strong></TableCell>
                    <TableCell><strong>Source</strong></TableCell>
                    <TableCell align="center"><strong>Status</strong></TableCell>
                    <TableCell align="center" sx={{ minWidth: 120 }}><strong>Progress</strong></TableCell>
                    <TableCell align="center"><strong>Items</strong></TableCell>
                    <TableCell align="center"><strong>Enriched</strong></TableCell>
                    <TableCell align="center"><strong>Failed</strong></TableCell>
                    <TableCell><strong>Started</strong></TableCell>
                    <TableCell align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <EnrichmentRowSkeleton rows={5} />
                </TableBody>
              </Table>
            </TableContainer>
          ) : enrichments.length === 0 ? (
            <NoDataState
              title="No enrichments found"
              description="Upload a BOM and start enrichment to see activity here."
            />
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell padding="checkbox" />
                    <TableCell><strong>BOM</strong></TableCell>
                    <TableCell><strong>Source</strong></TableCell>
                    <TableCell align="center"><strong>Status</strong></TableCell>
                    <TableCell align="center" sx={{ minWidth: 120 }}><strong>Progress</strong></TableCell>
                    <TableCell align="center"><strong>Items</strong></TableCell>
                    <TableCell align="center"><strong>Enriched</strong></TableCell>
                    <TableCell align="center"><strong>Failed</strong></TableCell>
                    <TableCell><strong>Started</strong></TableCell>
                    <TableCell align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {enrichments.map((enrichment) => (
                    <EnrichmentJobRow
                      key={enrichment.bom_id}
                      enrichment={enrichment}
                      isExpanded={expandedBomId === enrichment.bom_id}
                      lineItems={lineItems[enrichment.bom_id] || []}
                      lineItemsLoading={lineItemsLoading[enrichment.bom_id] || false}
                      stoppingId={stoppingEnrichment}
                      deletingId={deletingBom}
                      onToggleExpand={toggleExpandRow}
                      onRefreshLineItems={refreshLineItems}
                      onViewProgress={handleSelectBom}
                      onOpenBomDetail={handleOpenBomDetail}
                      onNavigateAudit={handleNavigateAudit}
                      onStop={handleStopEnrichment}
                      onDelete={(bomId) => setConfirmDelete(bomId)}
                      onViewComponent={openComponentDetail}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Progress Monitor Dialog */}
      <Dialog open={showProgress} onClose={() => setShowProgress(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Enrichment Progress
          {selectedBomMeta && (
            <>
              <Typography variant="subtitle2" color="text.secondary">
                {selectedBomMeta.bom_name || selectedBomMeta.bom_filename || 'Untitled BOM'}
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary" fontFamily="monospace">
                {selectedBomMeta.bom_id}
              </Typography>
            </>
          )}
        </DialogTitle>
        <DialogContent>
          {selectedBomId && <EnrichmentProgressMonitor bomId={selectedBomId} showDetailedLog={true} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProgress(false)}>Close</Button>
        </DialogActions>
      </Dialog>

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
            This will permanently delete the enrichment data for this BOM. This action cannot be undone.
          </Alert>
          <DialogContentText>
            Are you sure you want to delete the enrichment data for this BOM?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)} disabled={deletingBom !== null}>
            Cancel
          </Button>
          <Button
            onClick={() => confirmDelete && handleDeleteBom(confirmDelete)}
            color="error"
            variant="contained"
            disabled={deletingBom !== null}
            startIcon={deletingBom !== null ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deletingBom !== null ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Component Detail Dialog */}
      <ComponentDetailDialog
        open={detailDialogOpen}
        onClose={closeComponentDetail}
        component={componentDetail}
        loading={detailLoading}
      />
      </Box>
    </ErrorBoundary>
  );
};

export default EnrichmentMonitor;
