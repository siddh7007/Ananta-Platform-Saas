/**
 * UnifiedQueueCards Component
 *
 * Stacked queue cards that appear progressively during BOM upload workflow:
 * - Upload Queue card (files pending, uploading, completed)
 * - Enrichment Queue card (enrichment progress with component list)
 * - Analysis Queue card (risk analysis progress)
 * - Complete Summary card (final stats with 3-column layout)
 *
 * Reuses existing ProcessingQueueView component for consistency
 */

import { useMemo, useEffect, useRef } from 'react';
import {
  ProcessingQueueView,
  type StageInfo,
  type ProcessingStage,
  type ComponentQueueItem,
  type RiskAnalysisData,
  type ComponentStatusBreakdown,
  type AlertsQueueData,
  type EnrichmentSummaryData,
} from '@/components/bom/ProcessingQueueView';
import { createLogger } from '@/lib/utils';

// Create logger for this component
const log = createLogger('UnifiedQueueCards');

export interface UnifiedQueueCardsProps {
  /** BOM ID for tracking */
  bomId: string;
  /** File name being processed */
  fileName: string;
  /** Current workflow stage */
  currentStage: ProcessingStage;
  /** Total components in BOM */
  totalComponents: number;
  /** Enriched components count */
  enrichedCount: number;
  /** Failed enrichment count */
  failedCount: number;
  /** Component queue items */
  componentQueue?: ComponentQueueItem[];
  /** Risk analysis data */
  riskAnalysis?: RiskAnalysisData | null;
  /** Component status breakdown */
  componentStatus?: ComponentStatusBreakdown | null;
  /** Alerts data (rich stats) */
  alertsData?: AlertsQueueData | null;
  /** Alerts count (legacy, simple) */
  alertsCount?: number;
  /** Enrichment summary data */
  enrichmentSummary?: EnrichmentSummaryData | null;
  /** Whether processing is paused */
  isPaused?: boolean;
  /** Pause handler */
  onPause?: () => void;
  /** Resume handler */
  onResume?: () => void;
  /** View BOM details */
  onViewBomDetails?: () => void;
  /** View risk dashboard */
  onViewRiskDashboard?: () => void;
  /** View alerts */
  onViewAlerts?: () => void;
  /** Upload another BOM */
  onUploadAnother?: () => void;
  /** Cancel processing */
  onCancel?: () => void;
  /** Download raw file */
  onDownloadRawFile?: () => void;
  /** View alert preferences */
  onViewAlertPreferences?: () => void;
  /** Mark all alerts as read */
  onMarkAllAlertsRead?: () => void;
  /** View critical alerts */
  onViewCriticalAlerts?: () => void;
  /** Export results */
  onExportResults?: () => void;
  /** Whether the complete summary card should default to expanded (default: true) */
  defaultExpandedComplete?: boolean;
  className?: string;
}

/**
 * Unified queue cards showing progressive workflow
 * Leverages existing ProcessingQueueView for consistent UI
 */
export function UnifiedQueueCards({
  bomId,
  fileName,
  currentStage,
  totalComponents,
  enrichedCount,
  failedCount,
  componentQueue = [],
  riskAnalysis,
  componentStatus,
  alertsData,
  alertsCount = 0,
  enrichmentSummary,
  isPaused = false,
  onPause,
  onResume,
  onViewBomDetails,
  onViewRiskDashboard,
  onViewAlerts,
  onUploadAnother,
  onCancel,
  onDownloadRawFile,
  onViewAlertPreferences,
  onMarkAllAlertsRead,
  onViewCriticalAlerts,
  onExportResults,
  defaultExpandedComplete = true,
  className,
}: UnifiedQueueCardsProps) {
  // Track previous stage for logging transitions
  const prevStageRef = useRef<ProcessingStage | null>(null);
  const prevRiskStatusRef = useRef<string | null>(null);

  // Log stage transitions
  useEffect(() => {
    if (prevStageRef.current !== currentStage) {
      log.info('Stage transition', {
        bomId,
        from: prevStageRef.current || 'initial',
        to: currentStage,
        enrichedCount,
        failedCount,
        totalComponents,
      });
      prevStageRef.current = currentStage;
    }
  }, [currentStage, bomId, enrichedCount, failedCount, totalComponents]);

  // Log risk analysis status changes
  useEffect(() => {
    const riskStatus = riskAnalysis?.status || null;
    if (prevRiskStatusRef.current !== riskStatus && riskStatus) {
      log.info('Risk analysis status change', {
        bomId,
        from: prevRiskStatusRef.current || 'none',
        to: riskStatus,
        grade: riskAnalysis?.grade,
        itemsAnalyzed: riskAnalysis?.itemsAnalyzed,
        totalItems: riskAnalysis?.totalItems,
      });
      prevRiskStatusRef.current = riskStatus;
    }
  }, [riskAnalysis?.status, riskAnalysis?.grade, riskAnalysis?.itemsAnalyzed, riskAnalysis?.totalItems, bomId]);

  // Log when processing completes
  useEffect(() => {
    if (currentStage === 'complete' || riskAnalysis?.status === 'complete') {
      log.info('Processing workflow complete', {
        bomId,
        totalComponents,
        enrichedCount,
        failedCount,
        successRate: totalComponents > 0 ? Math.round((enrichedCount / totalComponents) * 100) : 0,
        grade: riskAnalysis?.grade,
        alertsCount,
      });
    }
  }, [currentStage, riskAnalysis?.status, bomId, totalComponents, enrichedCount, failedCount, riskAnalysis?.grade, alertsCount]);

  // Pre-compute derived state to avoid race conditions in stage status calculations
  const derivedState = useMemo(() => {
    const enrichmentDone = totalComponents > 0 && (enrichedCount + failedCount) >= totalComponents;
    const enrichmentProgress = totalComponents > 0
      ? Math.round(((enrichedCount + failedCount) / totalComponents) * 100)
      : 0;

    // Determine effective risk analysis status
    // Priority: actual riskAnalysis.status > currentStage inference
    const effectiveRiskStatus = riskAnalysis?.status ||
      (currentStage === 'risk_analysis' ? 'analyzing' :
       currentStage === 'complete' ? 'complete' : 'pending');

    // Determine if workflow is fully complete
    // This needs to consider both the stage prop AND the actual riskAnalysis status
    const isWorkflowComplete =
      currentStage === 'complete' ||
      riskAnalysis?.status === 'complete';

    return {
      enrichmentDone,
      enrichmentProgress,
      effectiveRiskStatus,
      isWorkflowComplete,
    };
  }, [totalComponents, enrichedCount, failedCount, riskAnalysis?.status, currentStage]);

  // Build stages array for ProcessingQueueView
  const stages = useMemo((): StageInfo[] => {
    const { enrichmentDone, enrichmentProgress, effectiveRiskStatus, isWorkflowComplete } = derivedState;

    const getStageStatus = (stage: ProcessingStage): StageInfo['status'] => {
      // Use derived state to reduce race conditions

      // Special handling for risk_analysis based on actual riskAnalysis data
      if (stage === 'risk_analysis') {
        if (effectiveRiskStatus === 'complete') return 'completed';
        if (effectiveRiskStatus === 'analyzing') return isPaused ? 'pending' : 'in_progress';
        // If enrichment is done but we haven't started analysis yet
        if (enrichmentDone && effectiveRiskStatus === 'pending') return 'pending';
        if (currentStage === 'risk_analysis') return isPaused ? 'pending' : 'in_progress';
      }

      // Special handling for 'complete' stage
      if (stage === 'complete') {
        if (isWorkflowComplete) return 'completed';
        // If enrichment is done and analysis is in progress, complete is pending
        if (enrichmentDone && effectiveRiskStatus === 'analyzing') {
          return 'pending';
        }
        // If we're past enrichment stage, complete is pending
        if (currentStage === 'risk_analysis') return 'pending';
      }

      if (stage === currentStage) return isPaused ? 'pending' : 'in_progress';

      const stageOrder: ProcessingStage[] = [
        'raw_upload',
        'parsing',
        'enrichment',
        'risk_analysis',
        'complete',
      ];

      const currentIndex = stageOrder.indexOf(currentStage);
      const stageIndex = stageOrder.indexOf(stage);

      // Handle case where currentStage might not be in stageOrder
      if (currentIndex === -1) {
        log.warn('Unknown currentStage in stageOrder', { currentStage });
        return 'pending';
      }

      if (stageIndex < currentIndex) return 'completed';
      if (stageIndex > currentIndex) return 'pending';

      return 'in_progress';
    };

    return [
      {
        stage: 'raw_upload',
        status: getStageStatus('raw_upload'),
        progress: getStageStatus('raw_upload') === 'completed' ? 100 : 0,
        message: 'File uploaded to storage',
        totalItems: 1,
        itemsProcessed: getStageStatus('raw_upload') === 'completed' ? 1 : 0,
      },
      {
        stage: 'parsing',
        status: getStageStatus('parsing'),
        progress: getStageStatus('parsing') === 'completed' ? 100 : 0,
        message: 'File parsed and validated',
        totalItems: totalComponents,
        itemsProcessed: getStageStatus('parsing') === 'completed' ? totalComponents : 0,
      },
      {
        stage: 'enrichment',
        status: getStageStatus('enrichment'),
        // Use pre-computed enrichmentProgress from derivedState
        progress: enrichmentProgress,
        message: 'Enriching components',
        totalItems: totalComponents,
        itemsProcessed: enrichedCount + failedCount,
      },
      {
        stage: 'risk_analysis',
        status: getStageStatus('risk_analysis'),
        // Calculate progress based on items analyzed vs total
        progress: riskAnalysis?.status === 'complete'
          ? 100
          : riskAnalysis?.totalItems && riskAnalysis.totalItems > 0
            ? Math.round((riskAnalysis.itemsAnalyzed / riskAnalysis.totalItems) * 100)
            : 0,
        message: riskAnalysis?.status === 'complete'
          ? `Analysis complete - Grade: ${riskAnalysis?.grade || 'N/A'}`
          : riskAnalysis?.status === 'analyzing'
            ? `Analyzing ${riskAnalysis?.itemsAnalyzed || 0} of ${riskAnalysis?.totalItems || totalComponents} items`
            : 'Analyzing component risks',
        totalItems: riskAnalysis?.totalItems || totalComponents,
        itemsProcessed: riskAnalysis?.itemsAnalyzed || 0,
      },
      {
        stage: 'complete',
        status: getStageStatus('complete'),
        progress: getStageStatus('complete') === 'completed' ? 100 : 0,
        message: 'Processing complete',
      },
    ];
  }, [derivedState, currentStage, totalComponents, enrichedCount, failedCount, riskAnalysis, isPaused]);

  // Use existing ProcessingQueueView for consistent UI
  return (
    <ProcessingQueueView
      bomId={bomId}
      fileName={fileName}
      stages={stages}
      currentStage={currentStage}
      componentQueue={componentQueue}
      riskAnalysis={riskAnalysis}
      componentStatus={componentStatus}
      alertsData={alertsData}
      alertsCount={alertsCount}
      enrichmentSummary={enrichmentSummary}
      isPaused={isPaused}
      onPause={onPause}
      onResume={onResume}
      onViewBomDetails={onViewBomDetails}
      onViewRiskDashboard={onViewRiskDashboard}
      onViewAlerts={onViewAlerts}
      onUploadAnother={onUploadAnother}
      onCancel={onCancel}
      onDownloadRawFile={onDownloadRawFile}
      onViewAlertPreferences={onViewAlertPreferences}
      onMarkAllAlertsRead={onMarkAllAlertsRead}
      onViewCriticalAlerts={onViewCriticalAlerts}
      onExportResults={onExportResults}
      defaultExpandedComplete={defaultExpandedComplete}
      className={className}
    />
  );
}

export default UnifiedQueueCards;
