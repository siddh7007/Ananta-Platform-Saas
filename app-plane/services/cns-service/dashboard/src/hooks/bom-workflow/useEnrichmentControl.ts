/**
 * useEnrichmentControl Hook
 *
 * Handles enrichment start/stop and risk analysis for BOM workflow.
 * Part of the split useBOMWorkflow hook.
 *
 * @module hooks/bom-workflow/useEnrichmentControl
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { CNS_API_URL, getAuthHeaders } from '../../config/api';
import { useEnrichmentPolling } from '../useEnrichmentPolling';
import type { QueueMetrics } from '../../bom/workflow';

// ============================================================
// Types
// ============================================================

export type WorkflowPhase = 'upload' | 'enriching' | 'analyzing' | 'complete';

export interface RiskMetrics {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
  lifecycleRisk: number;
  supplyChainRisk: number;
  complianceRisk: number;
  highRiskCount: number;
  alertCount: number;
}

export interface EnrichmentComponent {
  id: string;
  mpn: string;
  manufacturer?: string;
  status: 'pending' | 'enriching' | 'enriched' | 'failed' | 'not_found';
  qualityScore?: number;
  riskScore?: number;
  supplier?: string;
  error?: string;
}

export interface UseEnrichmentControlOptions {
  /** Resume from existing BOM ID */
  resumeBomId?: string | null;
  /** Organization ID for enrichment */
  organizationId: string;
}

export interface UseEnrichmentControlReturn {
  // State
  phase: WorkflowPhase;
  enrichingBomId: string | null;
  enrichmentState: ReturnType<typeof useEnrichmentPolling>['state'];
  enrichmentMetrics: QueueMetrics;
  components: EnrichmentComponent[];
  riskMetrics: RiskMetrics | null;
  riskLoading: boolean;
  isStartingEnrichment: boolean;

  // Actions
  setPhase: (phase: WorkflowPhase) => void;
  setEnrichingBomId: (bomId: string | null) => void;
  setComponents: React.Dispatch<React.SetStateAction<EnrichmentComponent[]>>;
  startEnrichmentManually: () => Promise<void>;
  runRiskAnalysis: () => Promise<void>;

  // Reset
  resetEnrichment: () => void;

  // Computed
  activeStep: number;
}

// ============================================================
// Helper Functions
// ============================================================

function getActiveStep(phase: WorkflowPhase, queueStatus: string | null): number {
  if (phase === 'complete') return 6;
  if (phase === 'analyzing') return 5;
  if (phase === 'enriching') return 4;

  switch (queueStatus) {
    case 'pending':
      return 0;
    case 'parsing':
    case 'uploading':
      return 1;
    case 'mapping':
      return 2;
    case 'confirming':
    case 'saving':
      return 3;
    case 'completed':
      return 4;
    case 'error':
      return -1;
    default:
      return 0;
  }
}

// ============================================================
// Hook Implementation
// ============================================================

export function useEnrichmentControl(options: UseEnrichmentControlOptions): UseEnrichmentControlReturn {
  const { resumeBomId = null, organizationId } = options;

  // State
  const [phase, setPhase] = useState<WorkflowPhase>('upload');
  const [enrichingBomId, setEnrichingBomId] = useState<string | null>(null);
  const [components, setComponents] = useState<EnrichmentComponent[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [isStartingEnrichment, setIsStartingEnrichment] = useState(false);

  // Resume from URL params
  useEffect(() => {
    if (resumeBomId) {
      setEnrichingBomId(resumeBomId);
      setPhase('enriching');
    }
  }, [resumeBomId]);

  // Enrichment polling
  const { state: enrichmentState } = useEnrichmentPolling({
    bomId: enrichingBomId || '',
    enabled: !!enrichingBomId && (phase === 'enriching' || phase === 'analyzing' || phase === 'complete'),
    pollInterval: 2000,
  });

  // Enrichment metrics
  const enrichmentMetrics = useMemo(
    () => ({
      pending: enrichmentState?.pending_items || 0,
      processing: 1, // Current enriching
      completed: enrichmentState?.enriched_items || 0,
      failed: (enrichmentState?.failed_items || 0) + (enrichmentState?.not_found_items || 0),
    }),
    [enrichmentState]
  );

  // Active step based on phase
  const activeStep = getActiveStep(phase, null);

  // ============================================================
  // Risk Analysis
  // ============================================================

  const runRiskAnalysis = useCallback(async () => {
    if (!enrichingBomId) return;

    setRiskLoading(true);

    try {
      const response = await fetch(`${CNS_API_URL}/risk/boms/${enrichingBomId}`, {
        headers: { ...(getAuthHeaders() || {}), 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setRiskMetrics({
          grade: data.risk_grade || 'C',
          score: data.risk_score || 50,
          lifecycleRisk: data.lifecycle_risk || 30,
          supplyChainRisk: data.supply_chain_risk || 40,
          complianceRisk: data.compliance_risk || 20,
          highRiskCount: data.high_risk_count || 0,
          alertCount: data.alert_count || 0,
        });
      }
    } catch (err) {
      console.error('Risk analysis failed:', err);
    } finally {
      setRiskLoading(false);
      setPhase('complete');
    }
  }, [enrichingBomId]);

  // Auto-advance phases based on enrichment state
  useEffect(() => {
    if (enrichmentState?.status === 'completed' && phase === 'enriching') {
      setPhase('analyzing');
      void runRiskAnalysis();
    }
  }, [enrichmentState?.status, phase, runRiskAnalysis]);

  // ============================================================
  // Manual Enrichment Start
  // ============================================================

  const startEnrichmentManually = useCallback(async () => {
    if (!enrichingBomId) return;

    setIsStartingEnrichment(true);
    try {
      // First, get the BOM's organization_id from the status endpoint
      const statusResponse = await fetch(`${CNS_API_URL}/boms/${enrichingBomId}/enrichment/status`, {
        headers: getAuthHeaders(),
      });

      // Extract organization_id from BOM - fallback to configured org if not found
      let orgId = organizationId;
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.organization_id) {
          orgId = statusData.organization_id;
        }
      }

      console.log(`[useEnrichmentControl] Starting enrichment for BOM ${enrichingBomId} with org ${orgId}`);

      const response = await fetch(`${CNS_API_URL}/boms/${enrichingBomId}/enrichment/start`, {
        method: 'POST',
        headers: {
          ...(getAuthHeaders() || {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: orgId,
          priority: 7,
        }),
      });

      if (response.status === 409) {
        console.log('[useEnrichmentControl] Enrichment already in progress');
      } else if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to start enrichment');
      } else {
        console.log('[useEnrichmentControl] Enrichment started successfully');
      }
    } catch (err) {
      console.error('[useEnrichmentControl] Error starting enrichment:', err);
    } finally {
      setIsStartingEnrichment(false);
    }
  }, [enrichingBomId, organizationId]);

  // ============================================================
  // Reset
  // ============================================================

  const resetEnrichment = useCallback(() => {
    setPhase('upload');
    setEnrichingBomId(null);
    setComponents([]);
    setRiskMetrics(null);
  }, []);

  return {
    // State
    phase,
    enrichingBomId,
    enrichmentState,
    enrichmentMetrics,
    components,
    riskMetrics,
    riskLoading,
    isStartingEnrichment,

    // Actions
    setPhase,
    setEnrichingBomId,
    setComponents,
    startEnrichmentManually,
    runRiskAnalysis,

    // Reset
    resetEnrichment,

    // Computed
    activeStep,
  };
}

export default useEnrichmentControl;
