/**
 * BOM Workflow Hooks
 *
 * Split hooks for the BOM Upload Workflow feature.
 * These hooks can be used individually or composed together.
 *
 * @module hooks/bom-workflow
 */

export { useFileQueue } from './useFileQueue';
export type { UseFileQueueReturn } from './useFileQueue';

export { useBOMUpload } from './useBOMUpload';
export type { UseBOMUploadOptions, UseBOMUploadReturn } from './useBOMUpload';

export { useEnrichmentControl } from './useEnrichmentControl';
export type {
  WorkflowPhase,
  RiskMetrics,
  EnrichmentComponent,
  UseEnrichmentControlOptions,
  UseEnrichmentControlReturn,
} from './useEnrichmentControl';

// Composed hook for backwards compatibility
export { useBOMWorkflowComposed } from './useBOMWorkflowComposed';
export type { UseBOMWorkflowComposedReturn } from './useBOMWorkflowComposed';
