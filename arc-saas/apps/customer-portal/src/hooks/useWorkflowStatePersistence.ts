/**
 * S3-Based Workflow State Persistence Hook
 *
 * Persists BOM upload workflow state to S3/MinIO via the CNS API.
 * This allows users to resume their BOM uploads from any browser/device.
 *
 * Storage location: workflow-state/{organization_id}/{user_id}/bom-upload-state.json
 *
 * Features:
 * - Cross-browser/device persistence (unlike localStorage)
 * - Automatic save on state changes (debounced)
 * - Load state on mount
 * - Clear state when starting fresh
 * - Falls back to localStorage if S3 save fails
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { cnsApi } from '@/lib/axios';
import { useAuth } from '@/contexts/AuthContext';
import { createLogger } from '@/lib/utils';

const log = createLogger('WorkflowStatePersistence');

// Local storage fallback keys (same as in BomUploadUnified)
const LOCAL_WORKFLOW_KEY = 'cbp_unified_workflow_state';
const LOCAL_QUEUE_KEY = 'cbp_bom_upload_queue';

// =====================================================
// Types (matching backend Pydantic models)
// =====================================================

export interface BomQueueItem {
  bomId: string;
  bomName: string;
  fileName: string;
  totalComponents: number;
  projectId?: string;
  projectName?: string;
  addedAt: number; // Unix timestamp
  isActive: boolean;
}

export interface ActiveWorkflow {
  bomId: string;
  bomName: string;
  fileName: string;
  totalComponents: number;
  currentStepId: string;
  projectId?: string;
  projectName?: string;
}

export interface WorkflowState {
  version: number;
  userId: string;
  organizationId: string;
  lastUpdated: string; // ISO timestamp
  activeWorkflow: ActiveWorkflow | null;
  bomQueue: BomQueueItem[];
}

export interface SaveWorkflowStateRequest {
  activeWorkflow: ActiveWorkflow | null;
  bomQueue: BomQueueItem[];
}

interface WorkflowStateResponse {
  success: boolean;
  state: WorkflowState | null;
  message?: string;
}

// =====================================================
// Hook Implementation
// =====================================================

interface UseWorkflowStatePersistenceOptions {
  /** Enable auto-save on state changes (default: true) */
  autoSave?: boolean;
  /** Debounce delay in ms for auto-save (default: 2000) */
  debounceMs?: number;
  /** Enable localStorage fallback (default: true) */
  enableFallback?: boolean;
}

export function useWorkflowStatePersistence(options: UseWorkflowStatePersistenceOptions = {}) {
  const { autoSave = true, debounceMs = 2000, enableFallback = true } = options;

  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<WorkflowState | null>(null);

  // Refs for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStateRef = useRef<SaveWorkflowStateRequest | null>(null);

  /**
   * Load workflow state from S3
   * Falls back to localStorage if S3 fails
   */
  const loadState = useCallback(async (): Promise<WorkflowState | null> => {
    if (!isAuthenticated) {
      log.debug('Not authenticated, skipping S3 load');
      return loadFromLocalStorage();
    }

    setIsLoading(true);
    setError(null);

    try {
      log.debug('Loading workflow state from S3...');
      const response = await cnsApi.get<WorkflowStateResponse>('/workflow/state');

      if (response.data.success && response.data.state) {
        log.info('Loaded workflow state from S3', {
          hasActiveWorkflow: !!response.data.state.activeWorkflow,
          queueLength: response.data.state.bomQueue.length,
        });
        setState(response.data.state);
        return response.data.state;
      }

      log.debug('No workflow state found in S3');
      // Try localStorage fallback
      if (enableFallback) {
        return loadFromLocalStorage();
      }
      return null;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.warn('Failed to load from S3, trying localStorage fallback', { error: errMsg });
      setError(errMsg);

      // Fall back to localStorage
      if (enableFallback) {
        return loadFromLocalStorage();
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, enableFallback]);

  /**
   * Load from localStorage (fallback)
   */
  const loadFromLocalStorage = useCallback((): WorkflowState | null => {
    try {
      const workflowStr = localStorage.getItem(LOCAL_WORKFLOW_KEY);
      const queueStr = localStorage.getItem(LOCAL_QUEUE_KEY);

      const workflow = workflowStr ? JSON.parse(workflowStr) : null;
      const queue = queueStr ? JSON.parse(queueStr) : [];

      // Filter out stale queue items (older than 24 hours)
      const STALE_THRESHOLD = 24 * 60 * 60 * 1000;
      const validQueue = (queue as BomQueueItem[]).filter(
        (item) => Date.now() - item.addedAt < STALE_THRESHOLD
      );

      if (!workflow && validQueue.length === 0) {
        return null;
      }

      // Construct WorkflowState from localStorage data
      const localState: WorkflowState = {
        version: 1,
        userId: 'local',
        organizationId: 'local',
        lastUpdated: new Date().toISOString(),
        activeWorkflow: workflow
          ? {
              bomId: workflow.bomId,
              bomName: workflow.bomName,
              fileName: workflow.fileName,
              totalComponents: workflow.totalComponents || 0,
              currentStepId: workflow.currentStepId || 'select_files',
              projectId: workflow.projectId,
              projectName: workflow.projectName,
            }
          : null,
        bomQueue: validQueue,
      };

      log.info('Loaded workflow state from localStorage fallback', {
        hasActiveWorkflow: !!localState.activeWorkflow,
        queueLength: localState.bomQueue.length,
      });

      setState(localState);
      return localState;
    } catch (err) {
      log.error('Failed to load from localStorage', { error: err });
      return null;
    }
  }, []);

  /**
   * Save workflow state to S3
   * Also saves to localStorage as fallback
   */
  const saveState = useCallback(
    async (request: SaveWorkflowStateRequest): Promise<boolean> => {
      // Always save to localStorage first (immediate fallback)
      if (enableFallback) {
        saveToLocalStorage(request);
      }

      if (!isAuthenticated) {
        log.debug('Not authenticated, saved only to localStorage');
        return true;
      }

      try {
        log.debug('Saving workflow state to S3...', {
          hasActiveWorkflow: !!request.activeWorkflow,
          queueLength: request.bomQueue.length,
        });

        const response = await cnsApi.put<WorkflowStateResponse>('/workflow/state', request);

        if (response.data.success) {
          log.info('Saved workflow state to S3');
          if (response.data.state) {
            setState(response.data.state);
          }
          return true;
        }

        log.warn('S3 save failed', { message: response.data.message });
        return false;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.warn('Failed to save to S3, localStorage fallback used', { error: errMsg });
        setError(errMsg);
        return false;
      }
    },
    [isAuthenticated, enableFallback]
  );

  /**
   * Save to localStorage (fallback)
   */
  const saveToLocalStorage = useCallback((request: SaveWorkflowStateRequest): void => {
    try {
      if (request.activeWorkflow) {
        const workflow = {
          ...request.activeWorkflow,
          timestamp: Date.now(),
        };
        localStorage.setItem(LOCAL_WORKFLOW_KEY, JSON.stringify(workflow));
      } else {
        localStorage.removeItem(LOCAL_WORKFLOW_KEY);
      }

      localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(request.bomQueue));
      log.debug('Saved to localStorage fallback');
    } catch (err) {
      log.warn('Failed to save to localStorage', { error: err });
    }
  }, []);

  /**
   * Clear workflow state from S3 and localStorage
   */
  const clearState = useCallback(async (): Promise<boolean> => {
    // Clear localStorage immediately
    localStorage.removeItem(LOCAL_WORKFLOW_KEY);
    localStorage.removeItem(LOCAL_QUEUE_KEY);

    if (!isAuthenticated) {
      log.debug('Not authenticated, cleared only localStorage');
      setState(null);
      return true;
    }

    try {
      log.debug('Clearing workflow state from S3...');
      const response = await cnsApi.delete<WorkflowStateResponse>('/workflow/state');

      if (response.data.success) {
        log.info('Cleared workflow state from S3');
        setState(null);
        return true;
      }

      log.warn('S3 clear failed', { message: response.data.message });
      setState(null);
      return false;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.warn('Failed to clear S3 state', { error: errMsg });
      setError(errMsg);
      setState(null);
      return false;
    }
  }, [isAuthenticated]);

  /**
   * Schedule a debounced save
   */
  const scheduleSave = useCallback(
    (request: SaveWorkflowStateRequest): void => {
      pendingStateRef.current = request;

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Schedule new save
      saveTimeoutRef.current = setTimeout(() => {
        if (pendingStateRef.current) {
          saveState(pendingStateRef.current);
          pendingStateRef.current = null;
        }
      }, debounceMs);
    },
    [saveState, debounceMs]
  );

  /**
   * Flush any pending saves immediately
   */
  const flushPendingSave = useCallback(async (): Promise<void> => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    if (pendingStateRef.current) {
      await saveState(pendingStateRef.current);
      pendingStateRef.current = null;
    }
  }, [saveState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Flush pending save on unmount
      if (pendingStateRef.current) {
        saveState(pendingStateRef.current);
      }
    };
  }, [saveState]);

  return {
    /** Current workflow state */
    state,
    /** Loading state for async operations */
    isLoading,
    /** Last error message */
    error,
    /** Load state from S3 (or localStorage fallback) */
    loadState,
    /** Save state to S3 (also saves to localStorage) */
    saveState,
    /** Schedule a debounced save (useful for frequent updates) */
    scheduleSave,
    /** Clear state from S3 and localStorage */
    clearState,
    /** Flush any pending debounced saves immediately */
    flushPendingSave,
    /** Whether auto-save is enabled */
    autoSave,
  };
}

export default useWorkflowStatePersistence;
