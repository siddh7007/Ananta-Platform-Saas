/**
 * ProjectsSection Component
 *
 * Dynamic collapsible project navigation for sidebar.
 * Fetches projects from CNS API and displays them with child menus.
 *
 * Features:
 * - Dynamically loads projects from API
 * - Collapsible section and individual project menus
 * - RBAC-based visibility (New Project for engineer+)
 * - Active state highlighting
 * - Child menus: BOM Upload, BOMs, Settings
 */

import { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  FolderKanban,
  Plus,
  ChevronDown,
  ChevronRight,
  List,
  Upload,
  FileSpreadsheet,
  Package,
  Settings,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppRole, hasMinimumRole } from '@/config/auth';
import { useProjects, type ProjectWithUploads } from '@/hooks/useProjects';

interface ProjectsSectionProps {
  userRole: AppRole;
  onNavClick?: () => void; // Called when nav item clicked (for mobile sidebar close)
}

/**
 * Projects section for sidebar - dynamic navigation
 *
 * Structure:
 * - Projects (collapsible)
 *   - New Project (engineer+ only)
 *   - All Projects
 *   - [Dynamic projects list with child menus]
 *     - BOM Upload
 *     - BOMs
 *     - Settings (admin+ only)
 */
export function ProjectsSection({ userRole, onNavClick }: ProjectsSectionProps) {
  const [sectionExpanded, setSectionExpanded] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const params = useParams();

  const canCreateProject = hasMinimumRole(userRole, 'engineer');
  const canAccessProjectSettings = hasMinimumRole(userRole, 'admin');

  // Fetch projects
  const { data: projectsData, isLoading, error } = useProjects();
  const projects = projectsData?.data || [];

  // Auto-expand the active project
  useEffect(() => {
    const projectId = params.projectId;
    if (projectId && !expandedProjects[projectId]) {
      setExpandedProjects((prev) => ({ ...prev, [projectId]: true }));
    }
  }, [params.projectId]);

  // Check if section is active
  const isProjectsActive = location.pathname.startsWith('/projects');

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const renderProjectItem = (project: ProjectWithUploads) => {
    const isActive = location.pathname.startsWith(`/projects/${project.id}`);
    const isExpanded = expandedProjects[project.id] || isActive;
    // Handle both uploadsCount (frontend) and total_boms (API) field names
    const bomCount = project.uploadsCount || (project as unknown as { total_boms?: number }).total_boms || 0;

    return (
      <div key={project.id} className="space-y-0.5">
        {/* Project header */}
        <button
          onClick={() => toggleProject(project.id)}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
            isActive
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 flex-shrink-0" />
          )}
          <FolderKanban className="h-4 w-4 flex-shrink-0" />
          <span className="truncate flex-1 text-left">{project.name}</span>
          {bomCount > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/20 px-1.5 text-xs font-medium text-primary">
              {bomCount}
            </span>
          )}
        </button>

        {/* Project child menus */}
        {isExpanded && (
          <div className="ml-5 space-y-0.5 border-l border-border pl-3">
            {/* BOM Upload */}
            {canCreateProject && (
              <Link
                to={`/projects/${project.id}/bom/upload`}
                onClick={onNavClick}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                  location.pathname === `/projects/${project.id}/bom/upload`
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload BOM
              </Link>
            )}

            {/* BOMs List */}
            <Link
              to={`/projects/${project.id}/boms`}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                location.pathname === `/projects/${project.id}/boms` ||
                  location.pathname.startsWith(`/projects/${project.id}/boms/`)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              BOMs
              {bomCount > 0 && (
                <span className="ml-auto text-xs opacity-70">
                  {bomCount}
                </span>
              )}
            </Link>

            {/* Components List */}
            <Link
              to={`/projects/${project.id}/components`}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                location.pathname === `/projects/${project.id}/components`
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Package className="h-3.5 w-3.5" />
              Components
            </Link>

            {/* Project Settings - admin+ only */}
            {canAccessProjectSettings && (
              <Link
                to={`/projects/${project.id}/settings`}
                onClick={onNavClick}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                  location.pathname === `/projects/${project.id}/settings`
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </Link>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {/* Section header with collapse toggle + New Project button */}
      <div className="flex items-center justify-between px-1 py-1">
        <button
          onClick={() => setSectionExpanded(!sectionExpanded)}
          className={cn(
            'flex items-center gap-2 text-sm font-medium transition-colors',
            isProjectsActive
              ? 'text-primary'
              : 'text-foreground hover:text-primary'
          )}
        >
          {sectionExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <FolderKanban className="h-4 w-4" />
          <span>Projects</span>
          {projects.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({projects.length})
            </span>
          )}
        </button>

        {/* New Project button - engineer+ only */}
        {canCreateProject && (
          <Link
            to="/projects/create"
            onClick={onNavClick}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="New Project"
          >
            <Plus className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Navigation items */}
      {sectionExpanded && (
        <div className="ml-2 space-y-0.5 border-l border-border pl-3">
          {/* New Project - engineer+ only */}
          {canCreateProject && (
            <Link
              to="/projects/create"
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                location.pathname === '/projects/create'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Plus className="h-4 w-4" />
              New Project
            </Link>
          )}

          {/* All Projects - all users */}
          <Link
            to="/projects"
            onClick={onNavClick}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
              location.pathname === '/projects'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <List className="h-4 w-4" />
            All Projects
          </Link>

          {/* Separator */}
          {projects.length > 0 && (
            <div className="my-2 border-t border-border" />
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              Failed to load
            </div>
          )}

          {/* Dynamic project list */}
          {!isLoading && !error && projects.map(renderProjectItem)}

          {/* Empty state */}
          {!isLoading && !error && projects.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No projects yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProjectsSection;
