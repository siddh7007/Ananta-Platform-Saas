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
 * State and API logic is managed by useEnrichmentMonitor hook.
 * This component handles UI rendering only.
 */

import React from 'react';
import {
  Box,
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
import { EnrichmentProgressMonitor } from './EnrichmentProgressMonitor';
import { EnrichmentStats } from './EnrichmentStats';
import { EnrichmentFilters } from './EnrichmentFilters';
import { EnrichmentJobRow } from './EnrichmentJobRow';
import { ComponentDetailDialog } from '../components/shared';
import { PageHeader, NoDataState, ErrorBoundary, EnrichmentRowSkeleton } from '../components/shared';
import { useEnrichmentMonitor } from '../hooks';
import { WorkspaceLayout, Panel } from '../layout';

export const EnrichmentMonitor: React.FC = () => {
  // Use the hook for all state and API logic
  const {
    // Data
    enrichments,
    stats,
    loading,
    loadError,

    // Filters
    sourceFilter,
    statusFilter,
    setSourceFilter,
    setStatusFilter,

    // Selection/Progress Dialog
    selectedBomId,
    selectedBomMeta,
    showProgress,
    handleSelectBom,
    closeProgress,

    // Line items expansion
    expandedBomId,
    lineItems,
    lineItemsLoading,
    toggleExpandRow,
    refreshLineItems,

    // Component detail dialog
    detailDialogOpen,
    componentDetail,
    detailLoading,
    openComponentDetail,
    closeComponentDetail,

    // Actions
    stoppingEnrichment,
    deletingBom,
    confirmDelete,
    setConfirmDelete,
    handleStopEnrichment,
    handleDeleteBom,
    handleOpenBomDetail,
    handleNavigateAudit,
    handleRefresh,
  } = useEnrichmentMonitor();

  const header = (
    <PageHeader
      title="Enrichment Monitor"
      description="Real-time monitoring of BOM enrichment activities"
      onRefresh={handleRefresh}
      refreshing={loading}
    />
  );

  const toolbar = (
    <Box>
      <Box mb={2}>
        <EnrichmentStats stats={stats} loading={loading} />
      </Box>
      <EnrichmentFilters
        sourceFilter={sourceFilter}
        statusFilter={statusFilter}
        onSourceChange={setSourceFilter}
        onStatusChange={setStatusFilter}
      />
    </Box>
  );

  return (
    <ErrorBoundary>
      <WorkspaceLayout header={header} toolbar={toolbar}>
        <Panel>
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
        </Panel>

      {/* Progress Monitor Dialog */}
      <Dialog open={showProgress} onClose={closeProgress} maxWidth="md" fullWidth>
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
          <Button onClick={closeProgress}>Close</Button>
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
      </WorkspaceLayout>
    </ErrorBoundary>
  );
};

export default EnrichmentMonitor;
