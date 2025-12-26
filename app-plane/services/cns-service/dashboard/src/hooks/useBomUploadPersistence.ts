/**
 * BOM Upload State Persistence Hook for CNS Dashboard
 *
 * Persists BOM upload wizard state to sessionStorage to survive page refreshes.
 * Adapted from CBP implementation for CNS staff workflow.
 *
 * Features:
 * - Saves step, mapping, name, description, enrichment settings
 * - File preview data stored separately (can be large)
 * - Auto-clears on successful upload completion
 * - Session-scoped (cleared when browser closes)
 * - 30-minute expiry for stale sessions
 */

import { useCallback, useEffect, useRef } from 'react';
import type { BomColumnMapping, BomFilePreview } from '../utils/bomParser';

// Storage keys
const STORAGE_KEY = 'cns_bom_upload_state';
const PREVIEW_KEY = 'cns_bom_upload_preview';

// Upload step types
export type BomUploadStep =
  | 'select_file'
  | 'preview_data'
  | 'map_columns'
  | 'review_summary'
  | 'uploading'
  | 'processing'
  | 'enriching'
  | 'results';

// Upload step definitions for stepper
export const UPLOAD_STEPS: { key: BomUploadStep; label: string; icon?: string }[] = [
  { key: 'select_file', label: 'Select File', icon: 'upload' },
  { key: 'preview_data', label: 'Preview', icon: 'table' },
  { key: 'map_columns', label: 'Map Columns', icon: 'settings' },
  { key: 'review_summary', label: 'Review', icon: 'check' },
  { key: 'uploading', label: 'Upload', icon: 'cloud_upload' },
  { key: 'processing', label: 'Process', icon: 'sync' },
  { key: 'enriching', label: 'Enrich', icon: 'auto_awesome' },
  { key: 'results', label: 'Results', icon: 'done_all' },
];

/**
 * Persistable BOM upload state (excludes File object which can't be serialized)
 */
export interface PersistedBomUploadState {
  currentStep: BomUploadStep;
  mapping: BomColumnMapping;
  bomName: string;
  bomDescription: string;
  autoEnrich: boolean;
  priority: 'low' | 'normal' | 'high';
  // File info for display (not the actual file)
  fileName: string | null;
  fileSize: number | null;
  timestamp: number;
  // Upload result for resume
  bomId?: string;
  uploadResult?: {
    bomId: string;
    name: string;
    lineCount: number;
    status: string;
  };
}

/**
 * Default state for fresh upload
 */
const defaultState: PersistedBomUploadState = {
  currentStep: 'select_file',
  mapping: { mpn: '' },
  bomName: '',
  bomDescription: '',
  autoEnrich: true,
  priority: 'normal',
  fileName: null,
  fileSize: null,
  timestamp: Date.now(),
};

/**
 * Clear all persisted state
 */
function clearState() {
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(PREVIEW_KEY);
}

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
   * Clear all persisted state (exported version)
   */
  const clearPersistedState = useCallback(() => {
    clearState();
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
    clearState: clearPersistedState,
    hasResumableSession,
    startRestore,
    endRestore,
  };
}

/**
 * Full BOM upload state (including non-persistable File object)
 */
export interface BomUploadState {
  currentStep: BomUploadStep;
  file: File | null;
  preview: BomFilePreview | null;
  mapping: BomColumnMapping;
  bomName: string;
  bomDescription: string;
  autoEnrich: boolean;
  priority: 'low' | 'normal' | 'high';
  uploadProgress: number;
  uploadResult: {
    bomId: string;
    name: string;
    lineCount: number;
    status: string;
  } | null;
  error: string | null;
  validationErrors: { message: string; severity: 'error' | 'warning' }[];
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
    autoEnrich: boolean;
    priority: 'low' | 'normal' | 'high';
    file: File | null;
    preview: BomFilePreview | null;
    uploadResult?: {
      bomId: string;
      name: string;
      lineCount: number;
      status: string;
    } | null;
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
      // Don't save if we're at the results step
      if (state.currentStep === 'results') {
        clearState();
        return;
      }

      saveState({
        currentStep: state.currentStep,
        mapping: state.mapping,
        bomName: state.bomName,
        bomDescription: state.bomDescription,
        autoEnrich: state.autoEnrich,
        priority: state.priority,
        fileName: state.file?.name || null,
        fileSize: state.file?.size || null,
        uploadResult: state.uploadResult || undefined,
        bomId: state.uploadResult?.bomId,
      });

      savePreview(state.preview);
    }, 500); // Debounce 500ms

    return () => clearTimeout(timeout);
  }, [
    state.currentStep,
    state.mapping,
    state.bomName,
    state.bomDescription,
    state.autoEnrich,
    state.priority,
    state.file,
    state.preview,
    state.uploadResult,
    saveState,
    savePreview,
    clearState,
  ]);

  return { clearState };
}

export default useBomUploadPersistence;
