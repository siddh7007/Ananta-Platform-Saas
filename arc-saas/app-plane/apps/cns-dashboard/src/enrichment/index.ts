/**
 * CNS Dashboard Enrichment Module
 *
 * Barrel export for all enrichment components.
 */

// Main Monitor
export { EnrichmentMonitor } from './EnrichmentMonitor';

// Progress Monitor
export { EnrichmentProgressMonitor } from './EnrichmentProgressMonitor';

// Subcomponents
export { EnrichmentStats } from './EnrichmentStats';
export type { EnrichmentStatsData, EnrichmentStatsProps } from './EnrichmentStats';

export { EnrichmentFilters } from './EnrichmentFilters';
export type { SourceFilter, StatusFilter, EnrichmentFiltersProps } from './EnrichmentFilters';

export { BatchProgressBar } from './BatchProgressBar';
export type { BatchProgressBarProps } from './BatchProgressBar';

export { EnrichmentLineItems } from './EnrichmentLineItems';
export type { LineItem, LineItemStats, EnrichmentLineItemsProps } from './EnrichmentLineItems';

export { EnrichmentJobRow } from './EnrichmentJobRow';
export type { Enrichment, EnrichmentJobRowProps } from './EnrichmentJobRow';

// Re-export from shared for backwards compatibility
export { ComponentDetailDialog } from '../components/shared';
export type { ComponentDetail, ComponentDetailDialogProps } from '../components/shared';
