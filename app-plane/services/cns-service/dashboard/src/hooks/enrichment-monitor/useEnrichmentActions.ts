/**
 * useEnrichmentActions Hook
 *
 * Handles stop/delete operations for enrichment monitor.
 * Part of the split useEnrichmentMonitor hook.
 *
 * @module hooks/enrichment-monitor/useEnrichmentActions
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../contexts/NotificationContext';
import { CNS_API_URL, getAuthHeaders } from '../../config/api';

// ============================================================
// Types
// ============================================================

export interface UseEnrichmentActionsOptions {
  /** Callback to refresh enrichments after action */
  onRefresh: () => void;
}

export interface UseEnrichmentActionsReturn {
  // State
  stoppingEnrichment: string | null;
  deletingBom: string | null;
  confirmDelete: string | null;

  // Actions
  setConfirmDelete: (bomId: string | null) => void;
  handleStopEnrichment: (bomId: string) => Promise<void>;
  handleDeleteBom: (bomId: string) => Promise<void>;
  handleOpenBomDetail: (bomId: string) => void;
  handleNavigateAudit: (bomId: string) => void;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useEnrichmentActions(options: UseEnrichmentActionsOptions): UseEnrichmentActionsReturn {
  const { onRefresh } = options;

  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  // Action state
  const [stoppingEnrichment, setStoppingEnrichment] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletingBom, setDeletingBom] = useState<string | null>(null);

  // ============================================================
  // Stop/Delete Actions
  // ============================================================

  const handleStopEnrichment = useCallback(
    async (bomId: string) => {
      try {
        setStoppingEnrichment(bomId);

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        };
        const authHeaders = getAuthHeaders();
        if (authHeaders) {
          Object.assign(headers, authHeaders as Record<string, string>);
        }

        const response = await fetch(`${CNS_API_URL}/boms/${bomId}/enrichment/stop`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            bom_id: bomId,
            reason: 'Admin stopped from CNS Dashboard',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || errorData.message || 'Failed to stop enrichment');
        }

        showSuccess('Enrichment stopped successfully');
        // Reload after short delay
        setTimeout(() => onRefresh(), 1000);
      } catch (error) {
        console.error('Error stopping enrichment:', error);
        showError(`Failed to stop enrichment: ${(error as Error).message}`);
      } finally {
        setStoppingEnrichment(null);
      }
    },
    [showSuccess, showError, onRefresh]
  );

  const handleDeleteBom = useCallback(
    async (bomId: string) => {
      try {
        setDeletingBom(bomId);

        const headers: Record<string, string> = { Accept: 'application/json' };
        const authHeaders = getAuthHeaders();
        if (authHeaders) {
          Object.assign(headers, authHeaders as Record<string, string>);
        }

        const response = await fetch(`${CNS_API_URL}/boms/${bomId}/enrichment`, {
          method: 'DELETE',
          headers,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || errorData.message || 'Failed to delete enrichment');
        }

        showSuccess('Enrichment deleted successfully');
        setConfirmDelete(null);
        onRefresh();
      } catch (error) {
        console.error('Error deleting enrichment:', error);
        showError(`Failed to delete enrichment: ${(error as Error).message}`);
      } finally {
        setDeletingBom(null);
      }
    },
    [showSuccess, showError, onRefresh]
  );

  // ============================================================
  // Navigation
  // ============================================================

  const handleOpenBomDetail = useCallback(
    (bomId: string) => {
      if (!bomId) {
        showError('BOM ID missing; cannot open components view.');
        return;
      }
      navigate(`/bom-jobs/${bomId}`);
    },
    [navigate, showError]
  );

  const handleNavigateAudit = useCallback(
    (bomId: string) => {
      navigate(`/audit-stream?bomId=${bomId}`);
    },
    [navigate]
  );

  return {
    // State
    stoppingEnrichment,
    deletingBom,
    confirmDelete,

    // Actions
    setConfirmDelete,
    handleStopEnrichment,
    handleDeleteBom,
    handleOpenBomDetail,
    handleNavigateAudit,
  };
}

export default useEnrichmentActions;
