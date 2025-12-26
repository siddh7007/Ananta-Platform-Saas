/**
 * useBOMWorkflowComposed Hook
 *
 * Composed hook that combines all BOM workflow sub-hooks.
 * Provides backwards compatibility with the original useBOMWorkflow.
 *
 * @module hooks/bom-workflow/useBOMWorkflowComposed
 */

import { useCallback } from 'react';
import { CNS_STAFF_ORGANIZATION_ID } from '../../config/api';
import { useFileQueue } from './useFileQueue';
import { useBOMUpload } from './useBOMUpload';
import { useEnrichmentControl, type WorkflowPhase, type RiskMetrics, type EnrichmentComponent } from './useEnrichmentControl';
import type { QueueItem, QueueItemStatus, QueueMetrics } from '../../bom/workflow';
import type { useEnrichmentPolling } from '../useEnrichmentPolling';

// ============================================================
// Types
// ============================================================

export interface UseBOMWorkflowComposedOptions {
  /** Resume from existing BOM ID */
  resumeBomId?: string | null;
  /** Organization ID for staff operations */
  organizationId?: string;
}

export interface UseBOMWorkflowComposedReturn {
  // State
  phase: WorkflowPhase;
  queue: QueueItem[];
  queueMetrics: QueueMetrics;
  enrichingBomId: string | null;
  enrichmentState: ReturnType<typeof useEnrichmentPolling>['state'];
  enrichmentMetrics: QueueMetrics;
  components: EnrichmentComponent[];
  riskMetrics: RiskMetrics | null;
  riskLoading: boolean;
  isStartingEnrichment: boolean;
  dragActive: boolean;

  // File Operations
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  addFileToQueue: (file: File) => void;

  // Queue Operations
  updateMapping: (itemId: string, source: string, target: string) => void;
  toggleExpand: (itemId: string) => void;
  deleteItem: (itemId: string) => void;
  downloadFile: (item: QueueItem) => void;
  confirmAndEnrich: (itemId: string) => Promise<void>;

  // Enrichment Operations
  startEnrichmentManually: () => Promise<void>;
  runRiskAnalysis: () => Promise<void>;

  // Workflow Control
  handleReset: () => void;
  setPhase: (phase: WorkflowPhase) => void;

  // Computed
  currentQueueStatus: QueueItemStatus | null;
  activeStep: number;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useBOMWorkflowComposed(
  options: UseBOMWorkflowComposedOptions = {}
): UseBOMWorkflowComposedReturn {
  const { resumeBomId = null, organizationId = CNS_STAFF_ORGANIZATION_ID } = options;

  // File queue management
  const {
    queue,
    queueMetrics,
    dragActive,
    currentQueueStatus,
    handleDrag,
    handleDrop,
    handleFileSelect,
    addFileToQueue: addFileToQueueBase,
    updateQueueItem,
    updateMapping,
    toggleExpand,
    deleteItem,
    downloadFile,
    getQueueItem,
    resetQueue,
  } = useFileQueue();

  // Enrichment control
  const {
    phase,
    enrichingBomId,
    enrichmentState,
    enrichmentMetrics,
    components,
    riskMetrics,
    riskLoading,
    isStartingEnrichment,
    setPhase,
    setEnrichingBomId,
    setComponents,
    startEnrichmentManually,
    runRiskAnalysis,
    resetEnrichment,
    activeStep,
  } = useEnrichmentControl({
    resumeBomId,
    organizationId,
  });

  // BOM upload - with callback to transition to enrichment
  const handleBomCreated = useCallback(
    (bomId: string, lineItems?: unknown[]) => {
      setEnrichingBomId(bomId);
      setPhase('enriching');

      // Initialize components list from line items
      if (lineItems && Array.isArray(lineItems)) {
        setComponents(
          lineItems.map((li: { id: string; mpn: string; manufacturer?: string }) => ({
            id: li.id,
            mpn: li.mpn,
            manufacturer: li.manufacturer,
            status: 'pending' as const,
          }))
        );
      }
    },
    [setEnrichingBomId, setPhase, setComponents]
  );

  const { parseFile, confirmAndEnrich: confirmAndEnrichBase } = useBOMUpload({
    organizationId,
    onUpdateItem: updateQueueItem,
    onBomCreated: handleBomCreated,
  });

  // Wrap addFileToQueue to auto-start parsing
  const addFileToQueue = useCallback(
    (file: File) => {
      addFileToQueueBase(file, (newItem) => {
        void parseFile(newItem.id, newItem.file);
      });
    },
    [addFileToQueueBase, parseFile]
  );

  // Wrap confirmAndEnrich to work with item ID
  const confirmAndEnrich = useCallback(
    async (itemId: string) => {
      const item = getQueueItem(itemId);
      if (item) {
        await confirmAndEnrichBase(item);
      }
    },
    [getQueueItem, confirmAndEnrichBase]
  );

  // Combined reset
  const handleReset = useCallback(() => {
    resetQueue();
    resetEnrichment();
  }, [resetQueue, resetEnrichment]);

  return {
    // State
    phase,
    queue,
    queueMetrics,
    enrichingBomId,
    enrichmentState,
    enrichmentMetrics,
    components,
    riskMetrics,
    riskLoading,
    isStartingEnrichment,
    dragActive,

    // File Operations
    handleDrag,
    handleDrop,
    handleFileSelect,
    addFileToQueue,

    // Queue Operations
    updateMapping,
    toggleExpand,
    deleteItem,
    downloadFile,
    confirmAndEnrich,

    // Enrichment Operations
    startEnrichmentManually,
    runRiskAnalysis,

    // Workflow Control
    handleReset,
    setPhase,

    // Computed
    currentQueueStatus,
    activeStep,
  };
}

export default useBOMWorkflowComposed;
