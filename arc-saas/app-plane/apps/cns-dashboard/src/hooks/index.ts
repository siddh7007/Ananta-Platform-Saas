/**
 * CNS Dashboard Hooks
 *
 * Barrel export for shared React hooks.
 */

// Debounce utilities
export { useDebouncedCallback, useDebouncedValue } from './useDebounce';

// Request deduplication
export { useDeduplicatedFetch, createDeduplicator } from './useDeduplicatedFetch';

// Enrichment progress hooks
export { useEnrichmentProgress } from './useEnrichmentProgress';
export type {
  EnrichmentState,
  EnrichmentEvent,
  ComponentEvent,
  UseEnrichmentProgressOptions,
  UseEnrichmentProgressReturn,
} from './useEnrichmentProgress';

export { useEnrichmentPolling } from './useEnrichmentPolling';
export type {
  UseEnrichmentPollingOptions,
  UseEnrichmentPollingReturn,
} from './useEnrichmentPolling';
