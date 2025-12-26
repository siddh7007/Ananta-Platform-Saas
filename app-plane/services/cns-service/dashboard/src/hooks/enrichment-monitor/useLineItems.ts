/**
 * useLineItems Hook
 *
 * Handles line item expansion and caching for enrichment monitor.
 * Part of the split useEnrichmentMonitor hook.
 *
 * @module hooks/enrichment-monitor/useLineItems
 */

import { useState, useCallback } from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import { CNS_API_URL, getAuthHeaders } from '../../config/api';
import type { LineItem } from '../../enrichment/EnrichmentLineItems';
import type { Enrichment } from './useEnrichmentData';

// ============================================================
// Types
// ============================================================

export interface UseLineItemsOptions {
  /** Current enrichments list for cache invalidation */
  enrichments: Enrichment[];
}

export interface UseLineItemsReturn {
  // State
  expandedBomId: string | null;
  lineItems: Record<string, LineItem[]>;
  lineItemsLoading: Record<string, boolean>;

  // Actions
  toggleExpandRow: (bomId: string) => void;
  refreshLineItems: (bomId: string) => void;
  invalidateActiveEnrichmentsCache: () => void;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useLineItems(options: UseLineItemsOptions): UseLineItemsReturn {
  const { enrichments } = options;
  const { showError } = useNotification();

  // Line items state
  const [expandedBomId, setExpandedBomId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<Record<string, LineItem[]>>({});
  const [lineItemsLoading, setLineItemsLoading] = useState<Record<string, boolean>>({});

  // ============================================================
  // Fetch Line Items
  // ============================================================

  const fetchLineItems = useCallback(
    async (bomId: string, forceRefresh = false) => {
      if (lineItems[bomId] && !forceRefresh) return;

      setLineItemsLoading((prev) => ({ ...prev, [bomId]: true }));
      try {
        const headers: Record<string, string> = {};
        const authHeaders = getAuthHeaders();
        if (authHeaders) Object.assign(headers, authHeaders as Record<string, string>);

        const res = await fetch(`${CNS_API_URL}/boms/${bomId}/line_items?page=1&page_size=500`, { headers });
        if (!res.ok) throw new Error(await res.text());

        const data = await res.json();
        const items: LineItem[] = (data.items || []).map((item: Record<string, unknown>) => ({
          id: item.id as string,
          bom_id: item.bom_id as string,
          line_number: item.line_number as number,
          manufacturer_part_number: item.manufacturer_part_number as string,
          manufacturer: item.manufacturer as string | undefined,
          quantity: (item.quantity as number) || 1,
          reference_designator: item.reference_designator as string | undefined,
          description: item.description as string | undefined,
          enrichment_status: (item.enrichment_status as string) || 'pending',
          component_id: item.component_id as string | undefined,
          enrichment_error: item.enrichment_error as string | undefined,
        }));

        setLineItems((prev) => ({ ...prev, [bomId]: items }));
      } catch (err) {
        console.error('[useLineItems] Failed to fetch line items:', err);
        showError('Failed to load line items');
      } finally {
        setLineItemsLoading((prev) => ({ ...prev, [bomId]: false }));
      }
    },
    [lineItems, showError]
  );

  // ============================================================
  // Toggle Expand
  // ============================================================

  const toggleExpandRow = useCallback(
    (bomId: string) => {
      if (expandedBomId === bomId) {
        setExpandedBomId(null);
      } else {
        setExpandedBomId(bomId);
        void fetchLineItems(bomId);
      }
    },
    [expandedBomId, fetchLineItems]
  );

  // ============================================================
  // Refresh
  // ============================================================

  const refreshLineItems = useCallback(
    (bomId: string) => {
      void fetchLineItems(bomId, true);
    },
    [fetchLineItems]
  );

  const invalidateActiveEnrichmentsCache = useCallback(() => {
    const activeStatuses = ['enriching'];
    setLineItems((prev) => {
      const newCache: Record<string, LineItem[]> = {};
      Object.entries(prev).forEach(([bomId, items]) => {
        const bomRow = enrichments.find((e) => e.bom_id === bomId);
        if (bomRow && !activeStatuses.includes(bomRow.status)) {
          newCache[bomId] = items;
        }
      });
      return newCache;
    });
  }, [enrichments]);

  return {
    // State
    expandedBomId,
    lineItems,
    lineItemsLoading,

    // Actions
    toggleExpandRow,
    refreshLineItems,
    invalidateActiveEnrichmentsCache,
  };
}

export default useLineItems;
