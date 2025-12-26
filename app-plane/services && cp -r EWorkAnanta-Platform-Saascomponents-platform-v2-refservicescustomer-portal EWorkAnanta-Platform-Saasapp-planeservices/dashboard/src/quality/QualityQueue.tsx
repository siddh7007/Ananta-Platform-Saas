/**
 * Quality Review Queue
 *
 * Staff interface to review components that:
 * - Scored 70-94% (staging - require manual approval)
 * - Scored <70% (rejected - need re-enrichment or removal)
 *
 * Features:
 * - Batch operations (approve/reject multiple)
 * - Keyboard shortcuts
 * - Component detail drawer
 *
 * Keyboard Shortcuts:
 * - A: Approve focused item
 * - R: Reject focused item
 * - V: View details
 * - Shift+A: Approve all selected
 * - Shift+R: Reject all selected
 * - Ctrl+A: Select all
 * - Space: Toggle selection
 * - Esc: Clear selection
 * - Arrow Up/Down: Navigate
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Alert,
  Tabs,
  Tab,
  Chip,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Tooltip,
} from '@mui/material';
import { Keyboard as KeyboardIcon } from '@mui/icons-material';
import { getAdminAuthHeaders, CNS_API_BASE_URL } from '../config/api';
import { useNotification } from '../contexts/NotificationContext';
import { PageHeader, NoDataState, ErrorBoundary, QueueRowSkeleton } from '../components/shared';
import { ComponentDetailDialog, ComponentDetail } from '../components/shared';
import { QualityQueueStats, QueueStats } from './QualityQueueStats';
import { QualityQueueRow, QueueItem } from './QualityQueueRow';
import { BatchActionBar } from './BatchActionBar';
import { useQueueKeyboard } from './useQueueKeyboard';
import { useDebouncedCallback, useDeduplicatedFetch } from '../hooks';

type QueueFilter = 'staging' | 'rejected' | 'all';

export const QualityQueue: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [filter, setFilter] = useState<QueueFilter>('staging');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Confirm dialogs
  const [confirmReject, setConfirmReject] = useState<{ id: string; mpn: string } | null>(null);
  const [confirmBatchReject, setConfirmBatchReject] = useState(false);

  // Component detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [componentDetail, setComponentDetail] = useState<ComponentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Request deduplication
  const { execute: dedupeExecute, isPending } = useDeduplicatedFetch();

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${CNS_API_BASE_URL}/quality-queue/stats/summary`, {
        headers: getAdminAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  const fetchQueueItems = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        status: filter,
        page: String(page + 1), // API uses 1-based pagination
        page_size: String(rowsPerPage),
      });

      const response = await fetch(`${CNS_API_BASE_URL}/quality-queue?${params.toString()}`, {
        headers: getAdminAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to load quality queue');
      }

      const data = await response.json();
      setItems(data.items || []);
      setTotalCount(data.total || data.items?.length || 0);
      setSelectedIds(new Set()); // Clear selection on page/filter change
      setFocusedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [filter, page, rowsPerPage]);

  useEffect(() => {
    void fetchQueueItems();
    void fetchStats();
  }, [fetchQueueItems, fetchStats]);

  // Debounced refresh to prevent rapid-fire clicks
  const handleRefresh = useDebouncedCallback(() => {
    // Skip if already loading
    if (isPending('qualityQueue')) {
      return;
    }

    void dedupeExecute(
      { key: 'qualityQueue', minInterval: 1000 },
      async () => {
        await Promise.all([fetchQueueItems(), fetchStats()]);
      }
    );
  }, 300);

  // Reset page when filter changes
  const handleFilterChange = (_: React.SyntheticEvent, newValue: QueueFilter) => {
    setPage(0);
    setFilter(newValue);
  };

  // Pagination handlers
  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Single item approve
  const handleApprove = async (itemId: string) => {
    setProcessingId(itemId);
    try {
      const response = await fetch(
        `${CNS_API_BASE_URL}/quality-queue/${encodeURIComponent(itemId)}/approve`,
        {
          method: 'POST',
          headers: {
            ...getAdminAuthHeaders(),
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to approve component');
      }

      const result = await response.json();
      showSuccess(
        `Component approved${result.component_id ? ` (ID: ${result.component_id.slice(0, 8)}...)` : ''}`
      );

      setItems((prev) => prev.filter((item) => item.id !== itemId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      void fetchStats();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setProcessingId(null);
    }
  };

  // Single item reject
  const handleReject = async () => {
    if (!confirmReject) return;

    const itemId = confirmReject.id;
    setConfirmReject(null);
    setProcessingId(itemId);

    try {
      const response = await fetch(
        `${CNS_API_BASE_URL}/quality-queue/${encodeURIComponent(itemId)}/reject`,
        {
          method: 'POST',
          headers: {
            ...getAdminAuthHeaders(),
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to reject component');
      }

      showSuccess('Component rejected and removed from queue');

      setItems((prev) => prev.filter((item) => item.id !== itemId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      void fetchStats();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setProcessingId(null);
    }
  };

  // Batch approve
  const handleApproveSelected = async () => {
    if (selectedIds.size === 0) return;

    setBatchProcessing(true);
    const ids = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        const response = await fetch(
          `${CNS_API_BASE_URL}/quality-queue/${encodeURIComponent(id)}/approve`,
          {
            method: 'POST',
            headers: {
              ...getAdminAuthHeaders(),
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          successCount++;
          setItems((prev) => prev.filter((item) => item.id !== id));
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setBatchProcessing(false);
    setSelectedIds(new Set());

    if (successCount > 0) {
      showSuccess(`Approved ${successCount} component${successCount > 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      showError(`Failed to approve ${failCount} component${failCount > 1 ? 's' : ''}`);
    }
    void fetchStats();
  };

  // Batch reject
  const handleRejectSelected = async () => {
    setConfirmBatchReject(false);
    if (selectedIds.size === 0) return;

    setBatchProcessing(true);
    const ids = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        const response = await fetch(
          `${CNS_API_BASE_URL}/quality-queue/${encodeURIComponent(id)}/reject`,
          {
            method: 'POST',
            headers: {
              ...getAdminAuthHeaders(),
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          successCount++;
          setItems((prev) => prev.filter((item) => item.id !== id));
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setBatchProcessing(false);
    setSelectedIds(new Set());

    if (successCount > 0) {
      showSuccess(`Rejected ${successCount} component${successCount > 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      showError(`Failed to reject ${failCount} component${failCount > 1 ? 's' : ''}`);
    }
    void fetchStats();
  };

  // Selection handlers
  const handleSelect = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleToggleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      handleSelectAll();
    } else {
      handleClearSelection();
    }
  };

  // Component detail
  const fetchComponentDetail = async (itemId: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(
        `${CNS_API_BASE_URL}/quality-queue/${encodeURIComponent(itemId)}`,
        {
          headers: getAdminAuthHeaders(),
        }
      );

      if (!response.ok) throw new Error('Failed to fetch component details');

      const data = await response.json();
      const enrichmentData = data.enrichment_data || {};

      setComponentDetail({
        id: data.id,
        mpn: data.mpn,
        manufacturer: data.manufacturer,
        category: enrichmentData.category,
        description: enrichmentData.description,
        datasheet_url: enrichmentData.datasheet_url,
        image_url: enrichmentData.image_url,
        lifecycle: enrichmentData.lifecycle_status,
        rohs: enrichmentData.rohs_compliant ? 'Compliant' : undefined,
        reach: enrichmentData.reach_compliant ? 'Compliant' : undefined,
        parameters: enrichmentData.parameters,
        pricing: enrichmentData.price_breaks,
        quality_score: data.quality_score,
        enrichment_source: data.enrichment_source || data.api_source,
        last_enriched_at: data.stored_at,
        stock_quantity: enrichmentData.stock_quantity,
        lead_time_days: enrichmentData.lead_time_days,
        moq: enrichmentData.minimum_order_quantity,
        aec_qualified: enrichmentData.aec_qualified,
        halogen_free: enrichmentData.halogen_free,
      });
    } catch (err) {
      console.error('Failed to fetch component details:', err);
      showError('Failed to load component details');
      setComponentDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleViewDetails = (itemId: string) => {
    setDetailDialogOpen(true);
    void fetchComponentDetail(itemId);
  };

  const closeComponentDetail = () => {
    setDetailDialogOpen(false);
    setComponentDetail(null);
  };

  // Keyboard shortcuts
  const { shortcuts } = useQueueKeyboard({
    items,
    selectedIds,
    focusedIndex,
    onFocusChange: setFocusedIndex,
    onSelect: handleSelect,
    onSelectAll: handleSelectAll,
    onClearSelection: handleClearSelection,
    onApprove: handleApprove,
    onReject: (id, mpn) => setConfirmReject({ id, mpn }),
    onApproveSelected: handleApproveSelected,
    onRejectSelected: () => setConfirmBatchReject(true),
    onViewDetails: handleViewDetails,
    disabled: loading || batchProcessing,
  });

  return (
    <ErrorBoundary>
      <Box p={3}>
        {/* Header */}
        <PageHeader
          title="Quality Review Queue"
          description="Review components requiring manual approval (70-94%) or flagged for rejection"
          onRefresh={handleRefresh}
          refreshing={loading}
          actions={
          <Tooltip
            title={
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Keyboard Shortcuts
                </Typography>
                {shortcuts.map((s) => (
                  <Typography key={s.key} variant="caption" display="block">
                    <strong>{s.key}</strong>: {s.description}
                  </Typography>
                ))}
              </Box>
            }
          >
            <Chip
              icon={<KeyboardIcon />}
              label="Shortcuts"
              size="small"
              variant="outlined"
            />
          </Tooltip>
        }
      />

      {/* Stats */}
      <Box mb={3}>
        <QualityQueueStats stats={stats} loading={loading} />
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filter Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={filter}
          onChange={handleFilterChange}
          variant="fullWidth"
          aria-label="Quality queue filter tabs"
        >
          <Tab
            label="Staging (70-94%)"
            value="staging"
            icon={<Chip label={stats?.staging_count ?? '?'} size="small" color="warning" />}
            iconPosition="end"
            aria-label={`Staging components (70-94% quality), ${stats?.staging_count ?? 0} items`}
          />
          <Tab
            label="Rejected (<70%)"
            value="rejected"
            icon={<Chip label={stats?.rejected_count ?? '?'} size="small" color="error" />}
            iconPosition="end"
            aria-label={`Rejected components (under 70% quality), ${stats?.rejected_count ?? 0} items`}
          />
          <Tab
            label="All Pending"
            value="all"
            icon={<Chip label={stats?.total ?? '?'} size="small" />}
            iconPosition="end"
            aria-label={`All pending components, ${stats?.total ?? 0} items`}
          />
        </Tabs>
      </Card>

      {/* Queue Table */}
      <Card>
        <CardContent>
          {loading ? (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell padding="checkbox" />
                    <TableCell><strong>MPN</strong></TableCell>
                    <TableCell><strong>Manufacturer</strong></TableCell>
                    <TableCell><strong>Category</strong></TableCell>
                    <TableCell align="center"><strong>Quality Score</strong></TableCell>
                    <TableCell align="center"><strong>Completeness</strong></TableCell>
                    <TableCell><strong>Flagged Reason</strong></TableCell>
                    <TableCell><strong>Sources</strong></TableCell>
                    <TableCell><strong>Submitted</strong></TableCell>
                    <TableCell align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <QueueRowSkeleton rows={rowsPerPage > 10 ? 10 : rowsPerPage} />
                </TableBody>
              </Table>
            </TableContainer>
          ) : items.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table aria-label="Quality review queue">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedIds.size > 0 && selectedIds.size < items.length}
                        checked={selectedIds.size === items.length && items.length > 0}
                        onChange={handleToggleSelectAll}
                        inputProps={{ 'aria-label': 'Select all components' }}
                      />
                    </TableCell>
                    <TableCell>
                      <strong>MPN</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Manufacturer</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Category</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Quality Score</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Completeness</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Flagged Reason</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Sources</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Submitted</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Actions</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => (
                    <QualityQueueRow
                      key={item.id}
                      item={item}
                      isSelected={selectedIds.has(item.id)}
                      isProcessing={processingId === item.id}
                      onSelect={handleSelect}
                      onApprove={handleApprove}
                      onReject={(id, mpn) => setConfirmReject({ id, mpn })}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={totalCount}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[10, 25, 50, 100]}
                labelRowsPerPage="Items per page:"
                showFirstButton
                showLastButton
              />
            </TableContainer>
          ) : (
            <NoDataState
              title="No items in queue"
              description="All components have been reviewed or auto-approved"
            />
          )}
        </CardContent>
      </Card>

      {/* Batch Action Bar */}
      <BatchActionBar
        selectedCount={selectedIds.size}
        totalCount={items.length}
        processing={batchProcessing}
        onApproveSelected={handleApproveSelected}
        onRejectSelected={() => setConfirmBatchReject(true)}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
      />

      {/* Single Reject Confirm Dialog */}
      <Dialog open={confirmReject !== null} onClose={() => setConfirmReject(null)}>
        <DialogTitle>Confirm Rejection</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to reject <strong>{confirmReject?.mpn}</strong>?
            <br />
            <br />
            This will permanently remove the component from the quality queue.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmReject(null)}>Cancel</Button>
          <Button onClick={handleReject} color="error" variant="contained">
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Batch Reject Confirm Dialog */}
      <Dialog open={confirmBatchReject} onClose={() => setConfirmBatchReject(false)}>
        <DialogTitle>Confirm Batch Rejection</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone.
          </Alert>
          <DialogContentText>
            Are you sure you want to reject <strong>{selectedIds.size}</strong> component
            {selectedIds.size > 1 ? 's' : ''}?
            <br />
            <br />
            All selected components will be permanently removed from the queue.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmBatchReject(false)}>Cancel</Button>
          <Button onClick={handleRejectSelected} color="error" variant="contained">
            Reject {selectedIds.size} Component{selectedIds.size > 1 ? 's' : ''}
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

export default QualityQueue;
