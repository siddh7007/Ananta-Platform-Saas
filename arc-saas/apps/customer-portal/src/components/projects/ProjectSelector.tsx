/**
 * ProjectSelector Component
 *
 * Persistent project selector for the AppBar.
 * Displays the currently selected project and allows switching between projects.
 *
 * Features:
 * - Shows current project name from localStorage
 * - Dropdown to switch between available projects
 * - Updates localStorage on change
 * - Shows "No project selected" state
 * - Quick "Create Project" action
 * - Project count badge
 *
 * Problem Solved:
 * Users were confused about which project they're working in because the
 * current project (stored in localStorage) had no visual indicator in the UI.
 * This caused BOM upload failures and workflow confusion.
 */

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, FolderKanban, Check, Plus, Search, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useProjects } from '@/hooks/useProjects';
import { AppRole, hasMinimumRole } from '@/config/auth';
import { useAuth } from '@/contexts/AuthContext';

const PROJECT_ID_KEY = 'current_project_id';
const PROJECT_NAME_KEY = 'current_project_name';

/**
 * ProjectSelector component for AppBar
 *
 * Displays current project and provides dropdown to switch projects.
 * Syncs selection with localStorage for persistence across page loads.
 */
export function ProjectSelector() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);

  const userRole = (user?.role || 'analyst') as AppRole;
  const canCreateProject = hasMinimumRole(userRole, 'engineer');

  // Fetch projects
  const { data: projectsData, isLoading, error } = useProjects();
  const projects = projectsData?.data || [];

  // Clear selection (defined before useEffect that uses it)
  const handleClearSelection = useCallback(() => {
    setSelectedProjectId(null);
    setSelectedProjectName(null);
    localStorage.removeItem(PROJECT_ID_KEY);
    localStorage.removeItem(PROJECT_NAME_KEY);
    setIsOpen(false);

    console.log('[ProjectSelector] Project selection cleared');
  }, []);

  // Initialize from localStorage
  useEffect(() => {
    const storedId = localStorage.getItem(PROJECT_ID_KEY);
    const storedName = localStorage.getItem(PROJECT_NAME_KEY);

    if (storedId && storedName) {
      setSelectedProjectId(storedId);
      setSelectedProjectName(storedName);
    }
  }, []);

  // Verify selected project still exists in the list
  // This must be called BEFORE any early returns to satisfy Rules of Hooks
  const currentProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId)
    : null;

  // If selected project doesn't exist anymore, clear selection
  useEffect(() => {
    if (selectedProjectId && !currentProject && projects.length > 0) {
      handleClearSelection();
    }
  }, [selectedProjectId, currentProject, projects.length, handleClearSelection]);

  // Update localStorage when selection changes
  const handleSelectProject = (projectId: string, projectName: string) => {
    setSelectedProjectId(projectId);
    setSelectedProjectName(projectName);
    localStorage.setItem(PROJECT_ID_KEY, projectId);
    localStorage.setItem(PROJECT_NAME_KEY, projectName);
    setIsOpen(false);
    setSearchQuery('');

    // Emit storage event for cross-tab sync
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: PROJECT_ID_KEY,
        newValue: projectId,
        url: window.location.href,
      })
    );

    console.log('[ProjectSelector] Project selected:', { projectId, projectName });
  };

  // Filter projects based on search
  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Loading state - render AFTER all hooks
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5">
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-sm text-destructive"
        title="Failed to load projects"
      >
        <AlertCircle className="h-4 w-4" />
        <span className="hidden md:inline">Project Error</span>
      </div>
    );
  }

  // No projects available
  if (projects.length === 0 && canCreateProject) {
    return (
      <button
        onClick={() => navigate('/projects/create')}
        className="flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        title="Create your first project"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden md:inline">Create Project</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors',
          'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          isOpen && 'bg-muted/50',
          !currentProject && 'border-dashed text-muted-foreground'
        )}
        aria-label={
          currentProject
            ? `Current project: ${currentProject.name}. Click to switch projects.`
            : 'No project selected. Click to select a project.'
        }
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <FolderKanban className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="max-w-[120px] truncate font-medium md:max-w-[150px]">
          {currentProject ? currentProject.name : 'Select Project'}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              setSearchQuery('');
            }}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border bg-card shadow-lg">
            {/* Header */}
            <div className="border-b px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  SELECT PROJECT
                </span>
                {projects.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {projects.length}
                  </span>
                )}
              </div>
            </div>

            {/* Search (show when many projects) */}
            {projects.length > 5 && (
              <div className="border-b p-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border bg-background py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Project list */}
            <div className="max-h-64 overflow-y-auto p-1">
              {/* Clear selection option */}
              {currentProject && (
                <button
                  onClick={handleClearSelection}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <div className="flex h-4 w-4 items-center justify-center">
                    <div className="h-2 w-2 rounded-full border-2 border-muted-foreground" />
                  </div>
                  <span>Clear Selection</span>
                </button>
              )}

              {/* Separator */}
              {currentProject && filteredProjects.length > 0 && (
                <div className="my-1 border-t border-border" />
              )}

              {/* Projects */}
              {filteredProjects.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {searchQuery ? 'No projects found' : 'No projects available'}
                </div>
              ) : (
                filteredProjects.map((project) => {
                  const isSelected = project.id === selectedProjectId;
                  const bomCount = project.uploadsCount || 0;

                  return (
                    <button
                      key={project.id}
                      onClick={() => handleSelectProject(project.id, project.name)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                        'hover:bg-muted',
                        isSelected && 'bg-primary/10 text-primary'
                      )}
                    >
                      <FolderKanban className="h-4 w-4 shrink-0" />
                      <div className="flex-1 truncate">
                        <div className="font-medium">{project.name}</div>
                        {project.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {project.description}
                          </div>
                        )}
                      </div>
                      {bomCount > 0 && (
                        <span className="shrink-0 rounded-full bg-primary/20 px-1.5 py-0.5 text-xs font-medium text-primary">
                          {bomCount}
                        </span>
                      )}
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* Create new project */}
            {canCreateProject && (
              <div className="border-t p-1">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/projects/create');
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Create New Project
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ProjectSelector;
