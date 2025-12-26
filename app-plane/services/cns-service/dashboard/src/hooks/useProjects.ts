/**
 * useProjects Hook
 *
 * Fetches projects for a given workspace from CNS API.
 * Used by ProjectSelector to populate the dropdown.
 *
 * Usage:
 *   const { projects, loading, error } = useProjects(workspaceId);
 */

import { useState, useEffect } from 'react';
import { CNS_API_URL, getAuthHeaders } from '../config/api';

export interface Project {
  id: string;
  name: string;
  workspace_id: string;
  organization_id: string;
  created_at: string;
}

export interface UseProjectsReturn {
  projects: Project[];
  loading: boolean;
  error: string | null;
}

export function useProjects(workspaceId: string | null): UseProjectsReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setProjects([]);
      setLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;

    const fetchProjects = async () => {
      setLoading(true);
      setError(null);

      try {
        const headers = getAuthHeaders();
        const response = await fetch(
          `${CNS_API_URL}/projects?workspace_id=${workspaceId}`,
          { headers }
        );

        if (!isMounted) return;

        if (!response.ok) {
          throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        // Handle both array and { items: [...] } response formats
        let projectList: Project[];
        if (Array.isArray(data)) {
          projectList = data;
        } else if (data && typeof data === 'object') {
          projectList = Array.isArray(data.items) ? data.items : [];
        } else {
          projectList = [];
        }
        setProjects(projectList);
      } catch (err) {
        if (!isMounted) return;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('[useProjects] Error fetching projects:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchProjects();

    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

  return { projects, loading, error };
}
