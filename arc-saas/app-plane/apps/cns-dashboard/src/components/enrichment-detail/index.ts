/**
 * Enrichment Detail Components - Export Index
 *
 * Modular exports for easy replacement and extension
 */

// Main component
export { ComponentEnrichmentDetail } from './ComponentEnrichmentDetail';

// Pipeline steps (modular)
export { PipelineStep, PipelineStepContent } from './pipeline/PipelineStep';
export { SupplierAPIStepComponent } from './pipeline/SupplierAPIStep';
export { AIEnhancementStepComponent } from './pipeline/AIEnhancementStep';

// Data visualization
export { DataComparisonTable } from './DataComparisonTable';

// Types
export * from './types';
