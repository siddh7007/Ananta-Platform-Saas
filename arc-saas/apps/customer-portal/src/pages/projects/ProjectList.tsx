/**
 * Projects List Page
 *
 * Display all projects in the current workspace.
 * Hierarchy: Organization → Workspace → Project → BOM
 * Each workspace can have multiple projects, each project can have multiple BOMs.
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Plus, Search, MoreVertical, RefreshCw, AlertCircle } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasMinimumRole } from '@/config/auth';
import { cn } from '@/lib/utils';
import { useProjects, type ProjectWithUploads } from '@/hooks/useProjects';
import { EmptyState, NoResultsState } from '@/components/shared';

export function ProjectListPage() {
  const navigate = useNavigate();
  const { currentTenant, isLoading: isTenantLoading } = useTenant();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const organizationId = currentTenant?.id;
  const canCreateProject = user?.role && hasMinimumRole(user.role, 'engineer');

  // Fetch projects from CNS admin API
  const {
    data: projectsData,
    isLoading: isProjectsLoading,
    isError: isProjectsError,
    refetch: refetchProjects,
  } = useProjects(
    searchQuery ? { search: searchQuery } : undefined,
    {
      enabled: !!organizationId && !isTenantLoading,
    }
  );

  const projects = useMemo<ProjectWithUploads[]>(() => {
    return projectsData?.data ?? [];
  }, [projectsData?.data]);

  const isLoading = isProjectsLoading || isTenantLoading;

  const handleRefresh = useCallback(() => {
    refetchProjects();
  }, [refetchProjects]);

  const handleCreateProject = () => {
    navigate('/projects/create');
  };

  const handleViewProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="mt-2 text-gray-600">
            Manage projects in your workspace
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </button>
          {canCreateProject && (
            <button
              onClick={handleCreateProject}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New Project
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {isProjectsError && (
        <div
          className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
          role="alert"
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Failed to load projects</p>
            <p className="text-sm">Unable to connect to the CNS service. Please try refreshing.</p>
          </div>
          <button
            onClick={handleRefresh}
            className="text-sm font-medium text-red-600 hover:text-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg border bg-card p-6 animate-pulse"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-1/3" />
                </div>
              </div>
              <div className="mt-4 h-4 bg-muted rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        searchQuery ? (
          <NoResultsState
            query={searchQuery}
            onClear={() => setSearchQuery('')}
          />
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="No Projects Yet"
            description="Projects organize your BOMs into logical groups. Create your first project to get started."
            size="lg"
            action={
              canCreateProject
                ? {
                    label: 'Create Project',
                    onClick: handleCreateProject,
                    variant: 'default',
                  }
                : undefined
            }
          />
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleViewProject(project.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FolderKanban className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{project.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {/* API returns total_boms or bomCount; frontend hook may add uploadsCount */}
                      {(project.bomCount ?? (project as unknown as {total_boms?: number}).total_boms ?? project.uploadsCount ?? 0).toLocaleString()} BOMs
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 hover:bg-muted rounded"
                  aria-label={`Options for ${project.name}`}
                >
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {project.description && (
                <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                  {project.description}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {project.updatedAt
                    ? `Updated ${new Date(project.updatedAt).toLocaleDateString()}`
                    : 'No recent updates'}
                </span>
                <span
                  className={cn(
                    'px-2 py-1 rounded-full',
                    project.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  )}
                >
                  {project.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectListPage;
