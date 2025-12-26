/**
 * useWorkspaces Hook
 *
 * Fetches workspaces for a given organization from CNS API.
 * Used by WorkspaceSelector to populate the dropdown.
 *
 * Usage:
 *   const { workspaces, loading, error } = useWorkspaces(organizationId);
 */

import { useState, useEffect } from 'react';
import { CNS_API_URL, getAuthHeaders } from '../config/api';

export interface Workspace {
  id: string;
  name: string;
  organization_id: string;
  is_default: boolean;
  created_at: string;
}

export interface UseWorkspacesReturn {
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;
}

export function useWorkspaces(organizationId: string | undefined): UseWorkspacesReturn {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setWorkspaces([]);
      setLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;

    const fetchWorkspaces = async () => {
      setLoading(true);
      setError(null);

      try {
        const headers = getAuthHeaders();
        const response = await fetch(
          `${CNS_API_URL}/workspaces?organization_id=${organizationId}`,
          { headers }
        );

        if (!isMounted) return;

        if (!response.ok) {
          throw new Error(`Failed to fetch workspaces: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        setWorkspaces(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!isMounted) return;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('[useWorkspaces] Error fetching workspaces:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchWorkspaces();

    return () => {
      isMounted = false;
    };
  }, [organizationId]);

  return { workspaces, loading, error };
}
