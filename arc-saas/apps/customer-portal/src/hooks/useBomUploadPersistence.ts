/**
 * BOM Upload State Persistence Hook
 *
 * Persists BOM upload wizard state to sessionStorage to survive page refreshes.
 * Automatically restores state on component mount and saves changes.
 *
 * Features:
 * - Saves step, mapping, name, description, enrichment settings
 * - File preview data stored separately (can be large)
 * - Auto-clears on successful upload completion
 * - Session-scoped (cleared when browser closes)
 */

import { useCallback, useEffect, useRef } from 'react';
import type { BomUploadStep, BomColumnMapping, BomFilePreview } from '@/types/bom';

// Storage keys
const STORAGE_KEY = 'cbp_bom_upload_state';
const PREVIEW_KEY = 'cbp_bom_upload_preview';

/**
 * Persistable BOM upload state (excludes File object which can't be serialized)
 */
export interface PersistedBomUploadState {
  currentStep: BomUploadStep;
  mapping: BomColumnMapping;
  bomName: string;
  bomDescription: string;
  projectId: string | undefined;
  autoEnrich: boolean;
  enrichmentLevel: 'basic' | 'standard' | 'comprehensive';
  // File info for display (not the actual file)
  fileName: string | null;
  fileSize: number | null;
  timestamp: number;
}

/**
 * Default state for fresh upload
 */
const defaultState: PersistedBomUploadState = {
  currentStep: 'select_file',
  mapping: { mpn: '' },
  bomName: '',
  bomDescription: '',
  projectId: undefined,
  autoEnrich: true,
  enrichmentLevel: 'standard',
  fileName: null,
  fileSize: null,
  timestamp: Date.now(),
};

/**
 * Hook to persist BOM upload state across page refreshes
 */
export function useBomUploadPersistence() {
  const isRestoring = useRef(false);

  /**
   * Load persisted state from sessionStorage
   */
  const loadState = useCallback((): PersistedBomUploadState | null => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const parsed = JSON.parse(stored) as PersistedBomUploadState;

      // Check if state is stale (older than 30 minutes)
      const thirtyMinutes = 30 * 60 * 1000;
      if (Date.now() - parsed.timestamp > thirtyMinutes) {
        clearState();
        return null;
      }

      return parsed;
    } catch {
      // If parsing fails, clear corrupted state
      clearState();
      return null;
    }
  }, []);

  /**
   * Load persisted preview data
   */
  const loadPreview = useCallback((): BomFilePreview | null => {
    try {
      const stored = sessionStorage.getItem(PREVIEW_KEY);
      if (!stored) return null;
      return JSON.parse(stored) as BomFilePreview;
    } catch {
      sessionStorage.removeItem(PREVIEW_KEY);
      return null;
    }
  }, []);

  /**
   * Save state to sessionStorage
   */
  const saveState = useCallback((state: Partial<PersistedBomUploadState>) => {
    if (isRestoring.current) return; // Don't save while restoring

    try {
      const current = loadState() || defaultState;
      const updated: PersistedBomUploadState = {
        ...current,
        ...state,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.warn('[BomUploadPersistence] Failed to save state:', error);
    }
  }, [loadState]);

  /**
   * Save preview data separately (can be large)
   */
  const savePreview = useCallback((preview: BomFilePreview | null) => {
    if (isRestoring.current) return;

    try {
      if (preview) {
        // Limit preview rows to save space
        const limitedPreview = {
          ...preview,
          rows: preview.rows.slice(0, 100), // Keep only first 100 rows
        };
        sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(limitedPreview));
      } else {
        sessionStorage.removeItem(PREVIEW_KEY);
      }
    } catch (error) {
      console.warn('[BomUploadPersistence] Failed to save preview:', error);
      // If storage is full, just skip preview
    }
  }, []);

  /**
   * Clear all persisted state
   */
  const clearState = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(PREVIEW_KEY);
  }, []);

  /**
   * Check if there's a resumable upload session
   */
  const hasResumableSession = useCallback((): boolean => {
    const state = loadState();
    if (!state) return false;

    // Only consider resumable if we're past the file selection step
    // and have file info
    return state.currentStep !== 'select_file' && !!state.fileName;
  }, [loadState]);

  /**
   * Start restoring (to prevent save loops)
   */
  const startRestore = useCallback(() => {
    isRestoring.current = true;
  }, []);

  /**
   * End restoring
   */
  const endRestore = useCallback(() => {
    isRestoring.current = false;
  }, []);

  return {
    loadState,
    loadPreview,
    saveState,
    savePreview,
    clearState,
    hasResumableSession,
    startRestore,
    endRestore,
  };
}

/**
 * Hook for auto-saving BOM upload state on changes
 */
export function useAutoSaveBomUpload(
  state: {
    currentStep: BomUploadStep;
    mapping: BomColumnMapping;
    bomName: string;
    bomDescription: string;
    projectId: string | undefined;
    autoEnrich: boolean;
    enrichmentLevel: 'basic' | 'standard' | 'comprehensive';
    file: File | null;
    preview: BomFilePreview | null;
  },
  onRestore: (state: PersistedBomUploadState, preview: BomFilePreview | null) => void
) {
  const { saveState, savePreview, loadState, loadPreview, clearState, hasResumableSession, startRestore, endRestore } = useBomUploadPersistence();
  const hasRestored = useRef(false);

  // Try to restore on mount
  useEffect(() => {
    if (hasRestored.current) return;

    if (hasResumableSession()) {
      const savedState = loadState();
      const savedPreview = loadPreview();

      if (savedState) {
        startRestore();
        onRestore(savedState, savedPreview);
        hasRestored.current = true;
        // Use setTimeout to ensure state is applied before we start saving again
        setTimeout(() => {
          endRestore();
        }, 100);
      }
    }
    hasRestored.current = true;
  }, [hasResumableSession, loadState, loadPreview, onRestore, startRestore, endRestore]);

  // Auto-save on state changes (debounced)
  useEffect(() => {
    if (!hasRestored.current) return;

    const timeout = setTimeout(() => {
      // Don't save if we're at the complete step
      if (state.currentStep === 'complete') {
        clearState();
        return;
      }

      saveState({
        currentStep: state.currentStep,
        mapping: state.mapping,
        bomName: state.bomName,
        bomDescription: state.bomDescription,
        projectId: state.projectId,
        autoEnrich: state.autoEnrich,
        enrichmentLevel: state.enrichmentLevel,
        fileName: state.file?.name || null,
        fileSize: state.file?.size || null,
      });

      savePreview(state.preview);
    }, 500); // Debounce 500ms

    return () => clearTimeout(timeout);
  }, [
    state.currentStep,
    state.mapping,
    state.bomName,
    state.bomDescription,
    state.projectId,
    state.autoEnrich,
    state.enrichmentLevel,
    state.file,
    state.preview,
    saveState,
    savePreview,
    clearState,
  ]);

  return { clearState };
}

export default useBomUploadPersistence;
