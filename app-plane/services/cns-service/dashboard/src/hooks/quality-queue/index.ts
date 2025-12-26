/**
 * Quality Queue Hooks
 *
 * Split hooks for the Quality Review Queue feature.
 * These hooks can be used individually or composed together.
 *
 * @module hooks/quality-queue
 */

export { useQueueData } from './useQueueData';
export type { QueueFilter, UseQueueDataOptions, UseQueueDataReturn } from './useQueueData';

export { useQueueSelection } from './useQueueSelection';
export type { UseQueueSelectionOptions, UseQueueSelectionReturn } from './useQueueSelection';

export { useQueueActions } from './useQueueActions';
export type { UseQueueActionsOptions, UseQueueActionsReturn } from './useQueueActions';

export { useComponentDetail } from './useComponentDetail';
export type { UseComponentDetailReturn } from './useComponentDetail';

// Composed hook for backwards compatibility
export { useQualityQueueComposed } from './useQualityQueueComposed';
export type { UseQualityQueueComposedReturn } from './useQualityQueueComposed';
