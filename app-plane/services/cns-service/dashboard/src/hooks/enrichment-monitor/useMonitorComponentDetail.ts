/**
 * useMonitorComponentDetail Hook
 *
 * Handles component detail fetching for enrichment monitor.
 * Part of the split useEnrichmentMonitor hook.
 *
 * @module hooks/enrichment-monitor/useMonitorComponentDetail
 */

import { useState, useCallback } from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import { CNS_API_URL, getAuthHeaders } from '../../config/api';
import type { ComponentDetail } from '../../components/shared';

// ============================================================
// Types
// ============================================================

export interface UseMonitorComponentDetailReturn {
  // State
  detailDialogOpen: boolean;
  componentDetail: ComponentDetail | null;
  detailLoading: boolean;

  // Actions
  openComponentDetail: (componentId: string) => void;
  closeComponentDetail: () => void;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useMonitorComponentDetail(): UseMonitorComponentDetailReturn {
  const { showError } = useNotification();

  // Component detail state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [componentDetail, setComponentDetail] = useState<ComponentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ============================================================
  // Fetch Component Detail
  // ============================================================

  const fetchComponentDetail = useCallback(
    async (componentId: string) => {
      setDetailLoading(true);
      try {
        const headers: Record<string, string> = {};
        const authHeaders = getAuthHeaders();
        if (authHeaders) Object.assign(headers, authHeaders as Record<string, string>);

        const res = await fetch(`${CNS_API_URL}/catalog/component/id/${componentId}`, { headers });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setComponentDetail(data);
      } catch (err) {
        console.error('[useMonitorComponentDetail] Failed to fetch component details:', err);
        showError('Failed to load component details');
        setComponentDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [showError]
  );

  // ============================================================
  // Actions
  // ============================================================

  const openComponentDetail = useCallback(
    (componentId: string) => {
      setDetailDialogOpen(true);
      void fetchComponentDetail(componentId);
    },
    [fetchComponentDetail]
  );

  const closeComponentDetail = useCallback(() => {
    setDetailDialogOpen(false);
    setComponentDetail(null);
  }, []);

  return {
    // State
    detailDialogOpen,
    componentDetail,
    detailLoading,

    // Actions
    openComponentDetail,
    closeComponentDetail,
  };
}

export default useMonitorComponentDetail;
