/**
 * Quality Review Queue (Virtualized Version)
 *
 * Staff interface to review components that:
 * - Scored 70-94% (staging - require manual approval)
 * - Scored <70% (rejected - need re-enrichment or removal)
 *
 * Features:
 * - Batch operations (approve/reject multiple)
 * - Keyboard shortcuts
 * - Component detail drawer
 * - **Virtualized table rendering for 100+ items**
 *
 * Performance:
 * - Virtualizes when >= 50 items
 * - Renders only visible rows (~15-20 at once)
 * - Handles 1000+ items smoothly
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
 *
 * State and API logic is managed by useQualityQueue hook.
 * This component handles UI rendering only.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TablePagination,
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
  IconButton,
  Stack,
  CircularProgress,
} from '@mui/material';
import {
  Keyboard as KeyboardIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import {
  PageHeader,
  NoDataState,
  ErrorBoundary,
  VirtualizedTable,
  VirtualizedTableColumn,
  QualityChip,
  GradeBadge,
  SupplierChips,
} from '../components/shared';
import { ComponentDetailDialog } from '../components/shared';
import { WorkspaceLayout, Panel } from '../layout';
import { QualityQueueStats } from './QualityQueueStats';
import { QueueItem } from './QualityQueueRow';
import { BatchActionBar } from './BatchActionBar';
import { useQueueKeyboard } from './useQueueKeyboard';
import { useQualityQueue } from '../hooks';
import { mapCompleteness } from '../mappers';

export const QualityQueue: React.FC = () => {
  // Use the hook for all state and API logic
  const {
    // Data
    items,
    stats,
    loading,
    error,
    totalCount,

    // Filter
    filter,
    handleFilterChange,

    // Pagination
    page,
    rowsPerPage,
    handleChangePage,
    handleChangeRowsPerPage,

    // Selection
    selectedIds,
    focusedIndex,
    setFocusedIndex,
    handleSelect,
    handleSelectAll,
    handleClearSelection,
    handleToggleSelectAll,

    // Single item operations
    processingId,
    handleApprove,
    handleReject,

    // Batch operations
    batchProcessing,
    handleApproveSelected,
    handleRejectSelected,

    // Confirm dialogs
    confirmReject,
    setConfirmReject,
    confirmBatchReject,
    setConfirmBatchReject,

    // Component detail
    detailDialogOpen,
    componentDetail,
    detailLoading,
    handleViewDetails,
    closeComponentDetail,

    // Refresh
    handleRefresh,
    clearError,
  } = useQualityQueue();

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

  // Define table columns
  const columns: VirtualizedTableColumn<QueueItem>[] = [
    {
      id: 'checkbox',
      label: '',
      width: 48,
      padding: 'checkbox',
      render: (item) => (
        <Checkbox
          checked={selectedIds.has(item.id)}
          onChange={(e) => handleSelect(item.id, e.target.checked)}
          disabled={processingId === item.id}
        />
      ),
    },
    {
      id: 'mpn',
      label: 'MPN',
      width: 180,
      render: (item) => (
        <Typography variant="body2" fontWeight={600} fontFamily="monospace">
          {item.mpn}
        </Typography>
      ),
    },
    {
      id: 'manufacturer',
      label: 'Manufacturer',
      width: 150,
      render: (item) => item.manufacturer,
    },
    {
      id: 'category',
      label: 'Category',
      width: 150,
      render: (item) =>
        item.category ? (
          <Chip label={item.category} size="small" variant="outlined" />
        ) : (
          <Typography variant="caption" color="text.secondary">
            -
          </Typography>
        ),
    },
    {
      id: 'quality_score',
      label: 'Quality Score',
      width: 120,
      align: 'center',
      render: (item) => <QualityChip score={item.quality_score} />,
    },
    {
      id: 'completeness',
      label: 'Completeness',
      width: 120,
      align: 'center',
      render: (item) => (
        <Tooltip title={mapCompleteness(item.data_completeness).label}>
          <span>
            <GradeBadge value={item.data_completeness} size="small" showScore />
          </span>
        </Tooltip>
      ),
    },
    {
      id: 'flagged_reason',
      label: 'Flagged Reason',
      width: 200,
      render: (item) => (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 200 }} noWrap>
          {item.flagged_reason}
        </Typography>
      ),
    },
    {
      id: 'sources',
      label: 'Sources',
      width: 150,
      render: (item) =>
        item.sources_used.length > 0 ? (
          <SupplierChips suppliers={item.sources_used} size="small" max={2} />
        ) : (
          <Typography variant="caption" color="text.secondary">
            -
          </Typography>
        ),
    },
    {
      id: 'submitted',
      label: 'Submitted',
      width: 110,
      render: (item) => (
        <Typography variant="caption">
          {new Date(item.submitted_at).toLocaleDateString()}
        </Typography>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      width: 140,
      align: 'center',
      render: (item) => {
        const isProcessing = processingId === item.id;
        return (
          <Stack direction="row" spacing={0.5} justifyContent="center">
            <Tooltip title="Approve to Production (A)">
              <span>
                <IconButton
                  color="success"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApprove(item.id);
                  }}
                  disabled={isProcessing}
                >
                  {isProcessing ? <CircularProgress size={18} /> : <CheckIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Reject & Remove (R)">
              <span>
                <IconButton
                  color="error"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmReject({ id: item.id, mpn: item.mpn });
                  }}
                  disabled={isProcessing}
                >
                  <CancelIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="View Details (V)">
              <IconButton
                color="info"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewDetails(item.id);
                }}
              >
                <ViewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        );
      },
    },
  ];

  // Header with select all checkbox column
  const headerColumns: VirtualizedTableColumn<QueueItem>[] = [
    {
      id: 'checkbox',
      label: '',
      width: 48,
      padding: 'checkbox',
      render: () => (
        <Checkbox
          indeterminate={selectedIds.size > 0 && selectedIds.size < items.length}
          checked={selectedIds.size === items.length && items.length > 0}
          onChange={handleToggleSelectAll}
          inputProps={{ 'aria-label': 'Select all components' }}
        />
      ),
    },
    ...columns.slice(1), // Use remaining columns as-is
  ];

  // Header component with keyboard shortcuts tooltip
  const header = (
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
  );

  // Toolbar with stats and filter tabs
  const toolbar = (
    <>
      <QualityQueueStats stats={stats} loading={loading} />
      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      <Card sx={{ mt: 2 }}>
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
    </>
  );

  // Main content - virtualized queue table
  const mainContent = (
    <Card>
      <CardContent>
        {items.length > 0 && (
          <>
            <VirtualizedTable
              items={items}
              columns={headerColumns}
              getRowKey={(item) => item.id}
              selectedIds={selectedIds}
              loading={loading}
              emptyMessage="No items in queue"
              rowHeight={52}
              maxHeight={600}
              virtualizationThreshold={50}
              aria-label="Quality review queue"
            />
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
          </>
        )}
        {!loading && items.length === 0 && (
          <NoDataState
            title="No items in queue"
            description="All components have been reviewed or auto-approved"
          />
        )}
      </CardContent>
    </Card>
  );

  return (
    <ErrorBoundary>
      <WorkspaceLayout header={header} toolbar={toolbar}>
        <Panel>
          {mainContent}

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
        </Panel>
      </WorkspaceLayout>
    </ErrorBoundary>
  );
};

export default QualityQueue;
