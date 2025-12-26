/**
 * useComponentDetail Hook
 *
 * Handles component detail fetching and dialog state.
 * Part of the split useQualityQueue hook.
 *
 * @module hooks/quality-queue/useComponentDetail
 */

import { useState, useCallback } from 'react';
import { getAuthHeaders, CNS_API_BASE_URL } from '../../config/api';
import { useNotification } from '../../contexts/NotificationContext';
import type { ComponentDetail } from '../../components/shared';

// ============================================================
// Types
// ============================================================

export interface UseComponentDetailReturn {
  // State
  detailDialogOpen: boolean;
  componentDetail: ComponentDetail | null;
  detailLoading: boolean;

  // Actions
  handleViewDetails: (itemId: string) => void;
  closeComponentDetail: () => void;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useComponentDetail(): UseComponentDetailReturn {
  const { showError } = useNotification();

  // Component detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [componentDetail, setComponentDetail] = useState<ComponentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ============================================================
  // Component Detail
  // ============================================================

  const fetchComponentDetail = useCallback(
    async (itemId: string) => {
      setDetailLoading(true);
      try {
        const response = await fetch(
          `${CNS_API_BASE_URL}/quality-queue/${encodeURIComponent(itemId)}`,
          {
            headers: getAuthHeaders(),
          }
        );

        if (!response.ok) throw new Error('Failed to fetch component details');

        const data = await response.json();
        const enrichmentData = data.enrichment_data || {};

        setComponentDetail({
          id: data.id,
          mpn: data.mpn,
          manufacturer: data.manufacturer,
          category: enrichmentData.category,
          description: enrichmentData.description,
          datasheet_url: enrichmentData.datasheet_url,
          image_url: enrichmentData.image_url,
          lifecycle: enrichmentData.lifecycle_status,
          rohs: enrichmentData.rohs_compliant ? 'Compliant' : undefined,
          reach: enrichmentData.reach_compliant ? 'Compliant' : undefined,
          parameters: enrichmentData.parameters,
          pricing: enrichmentData.price_breaks,
          quality_score: data.quality_score,
          enrichment_source: data.enrichment_source || data.api_source,
          last_enriched_at: data.stored_at,
          stock_quantity: enrichmentData.stock_quantity,
          lead_time_days: enrichmentData.lead_time_days,
          moq: enrichmentData.minimum_order_quantity,
          aec_qualified: enrichmentData.aec_qualified,
          halogen_free: enrichmentData.halogen_free,
        });
      } catch (err) {
        console.error('Failed to fetch component details:', err);
        showError('Failed to load component details');
        setComponentDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [showError]
  );

  const handleViewDetails = useCallback(
    (itemId: string) => {
      setDetailDialogOpen(true);
      void fetchComponentDetail(itemId);
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
    handleViewDetails,
    closeComponentDetail,
  };
}

export default useComponentDetail;
