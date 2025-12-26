/**
 * useEnrichmentSelection Hook
 *
 * Handles BOM selection and progress dialog for enrichment monitor.
 * Part of the split useEnrichmentMonitor hook.
 *
 * @module hooks/enrichment-monitor/useEnrichmentSelection
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import type { Enrichment } from './useEnrichmentData';

// ============================================================
// Types
// ============================================================

export interface UseEnrichmentSelectionOptions {
  /** All enrichments for auto-open matching */
  allEnrichments: Enrichment[];
}

export interface UseEnrichmentSelectionReturn {
  // State
  selectedBomId: string | null;
  selectedBomMeta: Pick<Enrichment, 'bom_id' | 'bom_name' | 'bom_filename'> | null;
  showProgress: boolean;

  // Actions
  handleSelectBom: (enrichment: Enrichment) => void;
  closeProgress: () => void;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useEnrichmentSelection(options: UseEnrichmentSelectionOptions): UseEnrichmentSelectionReturn {
  const { allEnrichments } = options;

  const location = useLocation();

  // Initial BOM ID from navigation state
  const initialBomId = (location.state as { bomId?: string } | null)?.bomId;
  const autoOpenRef = useRef(false);

  // Selection state
  const [selectedBomId, setSelectedBomId] = useState<string | null>(null);
  const [selectedBomMeta, setSelectedBomMeta] = useState<Pick<
    Enrichment,
    'bom_id' | 'bom_name' | 'bom_filename'
  > | null>(null);
  const [showProgress, setShowProgress] = useState(false);

  // ============================================================
  // Auto-open from navigation state
  // ============================================================

  useEffect(() => {
    if (!autoOpenRef.current && initialBomId && allEnrichments.length > 0) {
      const matched = allEnrichments.find((e) => e.bom_id === initialBomId);
      if (matched) {
        setSelectedBomId(matched.bom_id);
        setSelectedBomMeta({
          bom_id: matched.bom_id,
          bom_name: matched.bom_name,
          bom_filename: matched.bom_filename,
        });
        setShowProgress(true);
        autoOpenRef.current = true;
      }
    }
  }, [initialBomId, allEnrichments]);

  // ============================================================
  // Selection Handlers
  // ============================================================

  const handleSelectBom = useCallback((enrichment: Enrichment) => {
    setSelectedBomId(enrichment.bom_id);
    setSelectedBomMeta({
      bom_id: enrichment.bom_id,
      bom_name: enrichment.bom_name,
      bom_filename: enrichment.bom_filename,
    });
    setShowProgress(true);
  }, []);

  const closeProgress = useCallback(() => {
    setShowProgress(false);
  }, []);

  return {
    // State
    selectedBomId,
    selectedBomMeta,
    showProgress,

    // Actions
    handleSelectBom,
    closeProgress,
  };
}

export default useEnrichmentSelection;
