/**
 * Workspace Context
 *
 * Global state management for workspace support within organizations:
 * - Current workspace selection with persistence
 * - Workspaces list with refresh capability
 * - Role-based permissions at workspace level
 * - Workspace switching with automatic header updates
 *
 * Usage:
 *   const { currentWorkspace, switchWorkspace, permissions } = useWorkspace();
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import {
  workspaceService,
  Workspace,
  WorkspaceRole,
  WorkspacePermissions,
  getWorkspacePermissions,
  getCurrentWorkspaceId as getWsIdFromStorage,
  setCurrentWorkspaceId,
  clearWorkspaceId,
  WORKSPACE_NAME_STORAGE_KEY,
} from '../services/workspaceService';
import { useOrganization } from './OrganizationContext';

// =====================================================
// Types
// =====================================================

interface WorkspaceContextState {
  // Current workspace
  currentWorkspace: Workspace | null;

  // All workspaces in current organization
  workspaces: Workspace[];
  totalWorkspaces: number;

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Current role in selected workspace
  currentRole: WorkspaceRole | null;

  // Permissions derived from role
  permissions: WorkspacePermissions;
}

interface WorkspaceContextActions {
  // Switch to a different workspace
  switchWorkspace: (workspaceId: string) => Promise<void>;

  // Refresh workspaces list (returns updated list)
  refreshWorkspaces: () => Promise<Workspace[]>;

  // Create new workspace and optionally switch to it
  createWorkspace: (name: string, description?: string, switchTo?: boolean) => Promise<Workspace>;

  // Clear current workspace (for org switch or logout)
  clearWorkspace: () => void;
}

type WorkspaceContextValue = WorkspaceContextState & WorkspaceContextActions;

// Default permissions (no access)
const defaultPermissions: WorkspacePermissions = {
  canManageWorkspace: false,
  canInviteMembers: false,
  canRemoveMembers: false,
  canCreateProject: false,
  canEditProject: false,
  canUploadBOM: false,
  canViewBOM: false,
  canViewProject: false,
};

// =====================================================
// Context
// =====================================================

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

// =====================================================
// Provider
// =====================================================

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  // Get current organization from context
  const { currentOrg, isInitialized: isOrgInitialized } = useOrganization();

  // State
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [totalWorkspaces, setTotalWorkspaces] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived state
  const currentRole = currentWorkspace?.role ?? null;
  const permissions = useMemo(
    () => (currentRole ? getWorkspacePermissions(currentRole) : defaultPermissions),
    [currentRole]
  );

  // =====================================================
  // Persistence Helpers
  // =====================================================

  const persistWorkspaceSelection = useCallback((workspace: Workspace | null) => {
    if (workspace) {
      setCurrentWorkspaceId(workspace.id);
      localStorage.setItem(WORKSPACE_NAME_STORAGE_KEY, workspace.name);
      console.log(`[WorkspaceContext] Persisted workspace: ${workspace.name} (${workspace.id})`);
    } else {
      clearWorkspaceId();
      console.log('[WorkspaceContext] Cleared workspace selection');
    }
  }, []);

  const getPersistedWorkspaceId = useCallback((): string | null => {
    return getWsIdFromStorage();
  }, []);

  // =====================================================
  // Core Actions
  // =====================================================

  const refreshWorkspaces = useCallback(async () => {
    if (!currentOrg) {
      console.log('[WorkspaceContext] No org selected, skipping workspace refresh');
      return [];
    }

    console.log(`[WorkspaceContext] Refreshing workspaces for org: ${currentOrg.id}`);
    try {
      const response = await workspaceService.listWorkspaces(currentOrg.id, 100, 0);
      setWorkspaces(response.items);
      setTotalWorkspaces(response.total);
      setError(null);
      console.log(`[WorkspaceContext] Loaded ${response.items.length} workspaces`);
      return response.items;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load workspaces';
      console.error('[WorkspaceContext] Failed to refresh workspaces:', message);
      setError(message);
      throw err;
    }
  }, [currentOrg]);

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    console.log(`[WorkspaceContext] Switching to workspace: ${workspaceId}`);

    // Find workspace in current list
    let workspace = workspaces.find((w) => w.id === workspaceId);

    // If not found in list, refresh and try again
    if (!workspace) {
      console.log('[WorkspaceContext] Workspace not in cache, refreshing...');
      const freshWorkspaces = await refreshWorkspaces();
      workspace = freshWorkspaces.find((w) => w.id === workspaceId);
    }

    if (!workspace) {
      const error = `Workspace ${workspaceId} not found or you don't have access`;
      console.error(`[WorkspaceContext] ${error}`);
      throw new Error(error);
    }

    setCurrentWorkspace(workspace);
    persistWorkspaceSelection(workspace);

    // Dispatch custom event so other components can react
    window.dispatchEvent(
      new CustomEvent('workspace-changed', {
        detail: {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          organizationId: workspace.organization_id,
        },
      })
    );
  }, [workspaces, refreshWorkspaces, persistWorkspaceSelection]);

  const createWorkspace = useCallback(async (
    name: string,
    description?: string,
    switchTo: boolean = true
  ): Promise<Workspace> => {
    if (!currentOrg) {
      throw new Error('No organization selected');
    }

    console.log(`[WorkspaceContext] Creating workspace: ${name}`);

    const newWorkspace = await workspaceService.createWorkspace({
      organization_id: currentOrg.id,
      name,
      description,
    });
    console.log(`[WorkspaceContext] Created workspace: ${newWorkspace.id}`);

    // Refresh list to include new workspace
    await refreshWorkspaces();

    // Optionally switch to new workspace
    if (switchTo) {
      setCurrentWorkspace(newWorkspace);
      persistWorkspaceSelection(newWorkspace);
    }

    return newWorkspace;
  }, [currentOrg, refreshWorkspaces, persistWorkspaceSelection]);

  const clearWorkspace = useCallback(() => {
    setCurrentWorkspace(null);
    setWorkspaces([]);
    setTotalWorkspaces(0);
    persistWorkspaceSelection(null);
    setIsInitialized(false);
  }, [persistWorkspaceSelection]);

  // =====================================================
  // Initialization - Re-init when organization changes
  // =====================================================

  useEffect(() => {
    // Use AbortController to cancel pending requests on org change
    const abortController = new AbortController();

    const initialize = async () => {
      // Wait for org context to be ready
      if (!isOrgInitialized) {
        console.log('[WorkspaceContext] Waiting for org context...');
        return;
      }

      // If no org selected, clear workspaces
      if (!currentOrg) {
        console.log('[WorkspaceContext] No org selected, clearing workspaces');
        setWorkspaces([]);
        setTotalWorkspaces(0);
        setCurrentWorkspace(null);
        persistWorkspaceSelection(null);
        setIsLoading(false);
        setIsInitialized(true);
        return;
      }

      console.log(`[WorkspaceContext] Initializing for org: ${currentOrg.id}`);
      setIsLoading(true);

      try {
        // Fetch workspaces for current org (pass abort signal)
        const response = await workspaceService.listWorkspaces(
          currentOrg.id,
          100,
          0,
          abortController.signal
        );

        // Check if request was aborted (org changed)
        if (abortController.signal.aborted) return;

        setWorkspaces(response.items);
        setTotalWorkspaces(response.total);

        // Determine initial workspace selection
        const persistedWsId = getPersistedWorkspaceId();
        let selectedWorkspace: Workspace | null = null;

        if (persistedWsId) {
          // Try to restore persisted selection (must be in same org)
          selectedWorkspace = response.items.find((w) => w.id === persistedWsId) || null;
          if (!selectedWorkspace) {
            console.log(`[WorkspaceContext] Persisted workspace ${persistedWsId} not found in current org`);
          }
        }

        if (!selectedWorkspace && response.items.length > 0) {
          // Default to default workspace, or first workspace
          selectedWorkspace = response.items.find((w) => w.is_default) || response.items[0];
          console.log(`[WorkspaceContext] Defaulting to workspace: ${selectedWorkspace.name}`);
        }

        if (selectedWorkspace) {
          setCurrentWorkspace(selectedWorkspace);
          persistWorkspaceSelection(selectedWorkspace);
        }

        setError(null);
        console.log(`[WorkspaceContext] Initialized with ${response.items.length} workspaces, current: ${selectedWorkspace?.name || 'none'}`);
      } catch (err) {
        // Ignore aborted requests
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('[WorkspaceContext] Request aborted (org changed)');
          return;
        }

        if (abortController.signal.aborted) return;

        const message = err instanceof Error ? err.message : 'Failed to initialize workspaces';
        console.error('[WorkspaceContext] Initialization failed:', message);
        setError(message);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initialize();

    return () => {
      abortController.abort();
    };
  }, [currentOrg?.id, isOrgInitialized, getPersistedWorkspaceId, persistWorkspaceSelection]);

  // =====================================================
  // Context Value
  // =====================================================

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      // State
      currentWorkspace,
      workspaces,
      totalWorkspaces,
      isLoading,
      isInitialized,
      error,
      currentRole,
      permissions,
      // Actions
      switchWorkspace,
      refreshWorkspaces,
      createWorkspace,
      clearWorkspace,
    }),
    [
      currentWorkspace,
      workspaces,
      totalWorkspaces,
      isLoading,
      isInitialized,
      error,
      currentRole,
      permissions,
      switchWorkspace,
      refreshWorkspaces,
      createWorkspace,
      clearWorkspace,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// =====================================================
// Hook
// =====================================================

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }

  return context;
}

// =====================================================
// Utility: Get current workspace outside of React
// =====================================================

export { getCurrentWorkspaceId } from '../services/workspaceService';

/**
 * Get the current workspace name from localStorage.
 */
export function getCurrentWorkspaceName(): string | null {
  return localStorage.getItem(WORKSPACE_NAME_STORAGE_KEY);
}

// =====================================================
// Export
// =====================================================

export default WorkspaceContext;
