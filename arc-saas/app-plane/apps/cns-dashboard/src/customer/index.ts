/**
 * CNS Dashboard Customer Module
 *
 * Barrel export for customer data components.
 */

// Main Views
export { default as CustomerBOMs } from './CustomerBOMs';
export { default as CustomerCatalog } from './CustomerCatalog';
export { default as CustomerEnrichment } from './CustomerEnrichment';
export { default as CustomerUploadsList } from './CustomerUploadsList';

// Shared Components
export { CustomerDataStats } from './CustomerDataStats';
export type { CustomerDataStatsData, CustomerDataStatsProps } from './CustomerDataStats';

export { BOMStatusChip } from './BOMStatusChip';
export type { BOMStatus, BOMStatusChipProps } from './BOMStatusChip';
