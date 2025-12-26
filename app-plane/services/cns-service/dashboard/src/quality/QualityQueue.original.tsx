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
import { PageHeader, NoDataState, ErrorBoundary, QueueRowSkeleton } from '../components/shared';
import { ComponentDetailDialog } from '../components/shared';
import { WorkspaceLayout, Panel } from '../layout';
import { QualityQueueStats } from './QualityQueueStats';
import { QualityQueueRow } from './QualityQueueRow';
import { BatchActionBar } from './BatchActionBar';
import { useQueueKeyboard } from './useQueueKeyboard';
import { useQualityQueue } from '../hooks';

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

  // Main content - queue table
  const mainContent = (
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
