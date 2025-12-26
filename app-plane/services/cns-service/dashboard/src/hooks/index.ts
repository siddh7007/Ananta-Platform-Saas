/**
 * CNS Dashboard Hooks
 *
 * Barrel export for shared React hooks.
 */

// Debounce utilities
export { useDebouncedCallback, useDebouncedValue } from './useDebounce';

// Request deduplication
export { useDeduplicatedFetch, createDeduplicator } from './useDeduplicatedFetch';

// Enrichment progress - POLLING BASED (SSE is deprecated)
// NOTE: useEnrichmentProgress (SSE-based) is deprecated and no longer exported.
// Use useEnrichmentPolling instead for all enrichment progress monitoring.
export { useEnrichmentPolling } from './useEnrichmentPolling';
export type {
  EnrichmentState,
  UseEnrichmentPollingOptions,
  UseEnrichmentPollingReturn,
} from './useEnrichmentPolling';

// Session timeout management
export { useSessionTimeout } from './useSessionTimeout';
export type { UseSessionTimeoutOptions, UseSessionTimeoutReturn } from './useSessionTimeout';

// BOM Workflow state management (monolithic hook - backwards compatible)
export { useBOMWorkflow } from './useBOMWorkflow';
export type {
  WorkflowPhase,
  RiskMetrics,
  EnrichmentComponent,
  UseBOMWorkflowOptions,
  UseBOMWorkflowReturn,
} from './useBOMWorkflow';

// BOM Workflow split hooks (modular)
export {
  useFileQueue,
  useBOMUpload,
  useEnrichmentControl,
  useBOMWorkflowComposed,
} from './bom-workflow';
export type {
  UseFileQueueReturn,
  UseBOMUploadOptions,
  UseBOMUploadReturn,
  UseEnrichmentControlOptions,
  UseEnrichmentControlReturn,
  UseBOMWorkflowComposedReturn,
} from './bom-workflow';

// Enrichment Monitor state management (monolithic hook - backwards compatible)
export { useEnrichmentMonitor } from './useEnrichmentMonitor';
export type {
  SourceFilter,
  StatusFilter,
  Enrichment,
  EnrichmentStatsData,
  UseEnrichmentMonitorOptions,
  UseEnrichmentMonitorReturn,
} from './useEnrichmentMonitor';

// Enrichment Monitor split hooks (modular)
export {
  useEnrichmentData,
  useEnrichmentActions,
  useLineItems,
  useEnrichmentSelection,
  useMonitorComponentDetail,
  useEnrichmentMonitorComposed,
} from './enrichment-monitor';
export type {
  UseEnrichmentDataOptions,
  UseEnrichmentDataReturn,
  UseEnrichmentActionsOptions,
  UseEnrichmentActionsReturn,
  UseLineItemsOptions,
  UseLineItemsReturn,
  UseEnrichmentSelectionOptions,
  UseEnrichmentSelectionReturn,
  UseMonitorComponentDetailReturn,
  UseEnrichmentMonitorComposedReturn,
} from './enrichment-monitor';

// Quality Queue state management (monolithic hook - backwards compatible)
export { useQualityQueue } from './useQualityQueue';
export type {
  QueueFilter,
  UseQualityQueueOptions,
  UseQualityQueueReturn,
} from './useQualityQueue';

// Quality Queue split hooks (modular)
export {
  useQueueData,
  useQueueSelection,
  useQueueActions,
  useComponentDetail,
  useQualityQueueComposed,
} from './quality-queue';
export type {
  UseQueueDataOptions,
  UseQueueDataReturn,
  UseQueueSelectionOptions,
  UseQueueSelectionReturn,
  UseQueueActionsOptions,
  UseQueueActionsReturn,
  UseComponentDetailReturn,
  UseQualityQueueComposedReturn,
} from './quality-queue';

// Filter state with URL sync
export {
  useFilterState,
  useLocalFilterState,
  createStatusFilterConfig,
  createDateRangeFilterConfig,
  createNumericRangeFilterConfig,
} from './useFilterState';
export type {
  FilterValue,
  FilterFieldConfig,
  FilterConfig,
  SortDirection,
  SortState,
  PaginationState,
  UseFilterStateOptions,
  UseFilterStateReturn,
  DateRange,
  NumericRange,
} from './useFilterState';

// Workspace and project management
export { useWorkspaces } from './useWorkspaces';
export type { Workspace, UseWorkspacesReturn } from './useWorkspaces';

export { useProjects } from './useProjects';
export type { Project, UseProjectsReturn } from './useProjects';
