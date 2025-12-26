/**
 * useEnrichmentMonitorComposed Hook
 *
 * Composed hook that combines all enrichment monitor sub-hooks.
 * Provides backwards compatibility with the original useEnrichmentMonitor.
 *
 * @module hooks/enrichment-monitor/useEnrichmentMonitorComposed
 */

import { useCallback } from 'react';
import { useEnrichmentData, type Enrichment, type EnrichmentStatsData, type SourceFilter, type StatusFilter } from './useEnrichmentData';
import { useEnrichmentActions } from './useEnrichmentActions';
import { useLineItems } from './useLineItems';
import { useEnrichmentSelection } from './useEnrichmentSelection';
import { useMonitorComponentDetail } from './useMonitorComponentDetail';
import type { LineItem } from '../../enrichment/EnrichmentLineItems';
import type { ComponentDetail } from '../../components/shared';

// ============================================================
// Types
// ============================================================

export interface UseEnrichmentMonitorComposedOptions {
  refreshIntervalMs?: number;
}

export interface UseEnrichmentMonitorComposedReturn {
  // Data
  enrichments: Enrichment[];
  allEnrichments: Enrichment[];
  stats: EnrichmentStatsData;
  loading: boolean;
  loadError: string | null;

  // Filters
  sourceFilter: SourceFilter;
  statusFilter: StatusFilter;
  setSourceFilter: (filter: SourceFilter) => void;
  setStatusFilter: (filter: StatusFilter) => void;

  // Selection/Progress Dialog
  selectedBomId: string | null;
  selectedBomMeta: Pick<Enrichment, 'bom_id' | 'bom_name' | 'bom_filename'> | null;
  showProgress: boolean;
  handleSelectBom: (enrichment: Enrichment) => void;
  closeProgress: () => void;

  // Line items expansion
  expandedBomId: string | null;
  lineItems: Record<string, LineItem[]>;
  lineItemsLoading: Record<string, boolean>;
  toggleExpandRow: (bomId: string) => void;
  refreshLineItems: (bomId: string) => void;

  // Component detail dialog
  detailDialogOpen: boolean;
  componentDetail: ComponentDetail | null;
  detailLoading: boolean;
  openComponentDetail: (componentId: string) => void;
  closeComponentDetail: () => void;

  // Actions
  stoppingEnrichment: string | null;
  deletingBom: string | null;
  confirmDelete: string | null;
  setConfirmDelete: (bomId: string | null) => void;
  handleStopEnrichment: (bomId: string) => Promise<void>;
  handleDeleteBom: (bomId: string) => Promise<void>;
  handleOpenBomDetail: (bomId: string) => void;
  handleNavigateAudit: (bomId: string) => void;
  handleRefresh: () => void;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useEnrichmentMonitorComposed(
  options: UseEnrichmentMonitorComposedOptions = {}
): UseEnrichmentMonitorComposedReturn {
  // Data hook
  const {
    enrichments,
    allEnrichments,
    stats,
    loading,
    loadError,
    sourceFilter,
    statusFilter,
    setSourceFilter,
    setStatusFilter,
    handleRefresh,
    loadEnrichments,
  } = useEnrichmentData({
    refreshIntervalMs: options.refreshIntervalMs,
  });

  // Selection hook
  const { selectedBomId, selectedBomMeta, showProgress, handleSelectBom, closeProgress } = useEnrichmentSelection({
    allEnrichments,
  });

  // Line items hook
  const { expandedBomId, lineItems, lineItemsLoading, toggleExpandRow, refreshLineItems, invalidateActiveEnrichmentsCache } =
    useLineItems({
      enrichments,
    });

  // Component detail hook
  const { detailDialogOpen, componentDetail, detailLoading, openComponentDetail, closeComponentDetail } =
    useMonitorComponentDetail();

  // Actions hook - wrap refresh to invalidate cache
  const wrappedRefresh = useCallback(() => {
    invalidateActiveEnrichmentsCache();
    void loadEnrichments({ showSpinner: false });
  }, [invalidateActiveEnrichmentsCache, loadEnrichments]);

  const {
    stoppingEnrichment,
    deletingBom,
    confirmDelete,
    setConfirmDelete,
    handleStopEnrichment,
    handleDeleteBom,
    handleOpenBomDetail,
    handleNavigateAudit,
  } = useEnrichmentActions({
    onRefresh: wrappedRefresh,
  });

  return {
    // Data
    enrichments,
    allEnrichments,
    stats,
    loading,
    loadError,

    // Filters
    sourceFilter,
    statusFilter,
    setSourceFilter,
    setStatusFilter,

    // Selection/Progress
    selectedBomId,
    selectedBomMeta,
    showProgress,
    handleSelectBom,
    closeProgress,

    // Line items
    expandedBomId,
    lineItems,
    lineItemsLoading,
    toggleExpandRow,
    refreshLineItems,

    // Component detail
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
  };
}

export default useEnrichmentMonitorComposed;
