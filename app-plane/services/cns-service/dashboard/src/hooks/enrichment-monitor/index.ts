/**
 * Enrichment Monitor Hooks
 *
 * Split hooks for the Enrichment Monitor feature.
 * These hooks can be used individually or composed together.
 *
 * @module hooks/enrichment-monitor
 */

export { useEnrichmentData } from './useEnrichmentData';
export type {
  SourceFilter,
  StatusFilter,
  Enrichment,
  EnrichmentStatsData,
  UseEnrichmentDataOptions,
  UseEnrichmentDataReturn,
} from './useEnrichmentData';

export { useEnrichmentActions } from './useEnrichmentActions';
export type { UseEnrichmentActionsOptions, UseEnrichmentActionsReturn } from './useEnrichmentActions';

export { useLineItems } from './useLineItems';
export type { UseLineItemsOptions, UseLineItemsReturn } from './useLineItems';

export { useEnrichmentSelection } from './useEnrichmentSelection';
export type { UseEnrichmentSelectionOptions, UseEnrichmentSelectionReturn } from './useEnrichmentSelection';

export { useMonitorComponentDetail } from './useMonitorComponentDetail';
export type { UseMonitorComponentDetailReturn } from './useMonitorComponentDetail';

// Composed hook for backwards compatibility
export { useEnrichmentMonitorComposed } from './useEnrichmentMonitorComposed';
export type { UseEnrichmentMonitorComposedReturn } from './useEnrichmentMonitorComposed';
