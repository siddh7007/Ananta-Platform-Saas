import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useOrganizationId } from './TenantContext';
import { cnsApi } from '@/lib/axios';
import { apiLogger } from '@/lib/logger';

/**
 * Workspace from CNS API
 * Represents a subdivision within an organization for organizing projects and BOMs
 */
export interface Workspace {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description?: string;
  is_default: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  role?: string; // Current user's role in this workspace
}

interface WorkspaceListResponse {
  items: Workspace[];
  total: number;
}

interface WorkspaceContextType {
  /** All workspaces the user has access to in the current organization */
  workspaces: Workspace[];
  /** Currently selected workspace */
  currentWorkspace: Workspace | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Select a workspace by ID */
  selectWorkspace: (workspaceId: string) => void;
  /** Refresh workspaces from API */
  refreshWorkspaces: () => Promise<void>;
  /** Whether the user has multiple workspaces */
  hasMultipleWorkspaces: boolean;
  /** Clear error state */
  clearError: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

// Storage key prefix - stores workspace per organization to remember selection
const WORKSPACE_STORAGE_KEY_PREFIX = 'cbp_workspace_';

/**
 * Validate UUID format
 */
function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Safe localStorage getter with error handling
 */
function safeGetItem(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    // Validate that it's a proper UUID if present
    if (value && !isValidUUID(value)) {
      console.warn('[WorkspaceContext] Invalid workspace ID in localStorage, removing:', value);
      localStorage.removeItem(key);
      return null;
    }
    return value;
  } catch (err) {
    console.warn('[WorkspaceContext] localStorage access failed:', err);
    return null;
  }
}

/**
 * Safe localStorage setter with error handling
 */
function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn('[WorkspaceContext] localStorage write failed:', err);
  }
}

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const organizationId = useOrganizationId();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track current org to detect changes
  const prevOrgIdRef = useRef<string | null>(null);
  // AbortController ref for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get storage key for current organization
  const getStorageKey = useCallback((orgId: string) => {
    return `${WORKSPACE_STORAGE_KEY_PREFIX}${orgId}`;
  }, []);

  // Single effect to handle organization changes and fetch workspaces
  // Fixes race condition by combining clear + fetch logic
  useEffect(() => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // No organization - clear everything
    if (!organizationId) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setIsLoading(false);
      setError(null);
      prevOrgIdRef.current = null;
      return;
    }

    // Organization changed - clear previous workspace immediately to prevent stale state
    if (prevOrgIdRef.current !== organizationId) {
      setCurrentWorkspace(null);
      prevOrgIdRef.current = organizationId;
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const fetchWorkspaces = async () => {
      try {
        setIsLoading(true);
        setError(null);

        apiLogger.debug('Fetching workspaces for organization:', organizationId);

        // CNS API: GET /api/workspaces?organization_id=...
        const response = await cnsApi.get<WorkspaceListResponse>(
          `/workspaces?organization_id=${organizationId}`,
          { signal: abortController.signal }
        );

        // Check if request was aborted (component unmounted or org changed)
        if (abortController.signal.aborted) {
          return;
        }

        const workspaceList = response.data.items || [];
        apiLogger.debug('Workspaces fetched:', workspaceList.length);

        setWorkspaces(workspaceList);

        // Restore workspace selection for THIS organization
        const storageKey = getStorageKey(organizationId);
        const savedWorkspaceId = safeGetItem(storageKey);
        let selectedWorkspace: Workspace | null = null;

        // Try to restore saved workspace for this org
        if (savedWorkspaceId) {
          selectedWorkspace = workspaceList.find((w) => w.id === savedWorkspaceId) || null;
        }

        // If no saved workspace or it's not available, use default or first
        if (!selectedWorkspace && workspaceList.length > 0) {
          selectedWorkspace = workspaceList.find((w) => w.is_default) || workspaceList[0];
        }

        // Only update if not aborted
        if (!abortController.signal.aborted) {
          if (selectedWorkspace) {
            setCurrentWorkspace(selectedWorkspace);
            safeSetItem(storageKey, selectedWorkspace.id);
          } else {
            setCurrentWorkspace(null);
          }
        }
      } catch (err) {
        // Ignore abort errors - they're expected when switching orgs
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        // Only set error if not aborted
        if (!abortController.signal.aborted) {
          console.error('[WorkspaceContext] Failed to fetch workspaces:', err);
          setError(err instanceof Error ? err.message : 'Failed to load workspaces');
        }
      } finally {
        // Only update loading if not aborted
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchWorkspaces();

    // Cleanup: abort request on unmount or when org changes
    return () => {
      abortController.abort();
    };
  }, [organizationId, getStorageKey]);

  const selectWorkspace = useCallback(
    (workspaceId: string) => {
      const workspace = workspaces.find((w) => w.id === workspaceId);
      if (!workspace) {
        console.error('[WorkspaceContext] Workspace not found:', workspaceId);
        return;
      }

      setCurrentWorkspace(workspace);

      // Save selection for this organization
      if (organizationId) {
        safeSetItem(getStorageKey(organizationId), workspaceId);
      }

      apiLogger.debug('Workspace selected:', workspace.name);
    },
    [workspaces, organizationId, getStorageKey]
  );

  const refreshWorkspaces = useCallback(async () => {
    if (!organizationId) return;

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setIsLoading(true);
      setError(null);

      const response = await cnsApi.get<WorkspaceListResponse>(
        `/workspaces?organization_id=${organizationId}`,
        { signal: abortController.signal }
      );

      if (!abortController.signal.aborted) {
        const workspaceList = response.data.items || [];
        setWorkspaces(workspaceList);

        // Update current workspace if it still exists
        if (currentWorkspace) {
          const updatedWorkspace = workspaceList.find((w) => w.id === currentWorkspace.id);
          if (updatedWorkspace) {
            setCurrentWorkspace(updatedWorkspace);
          } else if (workspaceList.length > 0) {
            // Current workspace was deleted, select default or first
            const newWorkspace = workspaceList.find((w) => w.is_default) || workspaceList[0];
            setCurrentWorkspace(newWorkspace);
            safeSetItem(getStorageKey(organizationId), newWorkspace.id);
          } else {
            setCurrentWorkspace(null);
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (!abortController.signal.aborted) {
        console.error('[WorkspaceContext] Failed to refresh workspaces:', err);
        setError(err instanceof Error ? err.message : 'Failed to refresh workspaces');
      }
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [organizationId, currentWorkspace, getStorageKey]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        isLoading,
        error,
        selectWorkspace,
        refreshWorkspaces,
        hasMultipleWorkspaces: workspaces.length > 1,
        clearError,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Hook to access workspace context
 */
export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspaceContext must be used within a WorkspaceProvider');
  }
  return context;
}

/**
 * Hook to get the current workspace ID for API requests
 * Use this when calling CNS APIs that require workspace_id
 */
export function useWorkspaceId(): string | null {
  const { currentWorkspace } = useWorkspaceContext();
  return currentWorkspace?.id ?? null;
}

/**
 * Hook to get the current workspace
 */
export function useCurrentWorkspace(): Workspace | null {
  const { currentWorkspace } = useWorkspaceContext();
  return currentWorkspace;
}
