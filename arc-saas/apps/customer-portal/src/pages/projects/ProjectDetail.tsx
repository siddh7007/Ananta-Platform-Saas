/**
 * Project Detail Page
 *
 * Displays project information from CNS and lists associated BOMs.
 */

import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useList } from '@refinedev/core';
import {
  FolderKanban,
  FileText,
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  MoreVertical,
  AlertCircle,
  Settings,
} from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasMinimumRole } from '@/config/auth';
import { cn } from '@/lib/utils';
import { useProject } from '@/hooks/useProjects';
import { ProjectComponentList } from '@/components/projects';
import type { Bom } from '@/types/bom';

export function ProjectDetailPage() {
  const params = useParams<{ id?: string; projectId?: string }>();
  const projectId = params.projectId || params.id;
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  const canEdit = user?.role && hasMinimumRole(user.role, 'engineer');
  const canDelete = user?.role && hasMinimumRole(user.role, 'admin');

  const {
    data: project,
    isLoading: projectLoading,
    isError: projectError,
  } = useProject(projectId ?? '', {
    enabled: !!projectId,
  });

  // Note: Use only meta.queryParams for project_id filtering
  // The filters array is redundant with queryParams and can cause duplicate filtering
  const {
    data: projectBoms,
    isLoading: bomsLoading,
    isError: bomsError,
  } = useList<Bom>({
    resource: 'boms',
    pagination: { current: 1, pageSize: 50 },
    meta: {
      dataProviderName: 'cns',
      queryParams: {
        project_id: projectId,
      },
    },
    queryOptions: {
      enabled: !!projectId,
    },
  });

  const boms = useMemo(() => projectBoms?.data ?? [], [projectBoms?.data]);
  const isLoading = projectLoading || bomsLoading;

  const handleBack = () => navigate('/projects');
  const handleEditProject = () => navigate(`/projects/${projectId}/settings`);
  const handleCreateBOM = () => navigate(`/projects/${projectId}/bom/upload`);
  const handleViewBOM = (bomId: string) => navigate(`/projects/${projectId}/boms/${bomId}`);

  if (!projectId) {
    return (
      <div className="space-y-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>
        <div className="rounded-lg border bg-card p-12 text-center">
          <FolderKanban className="mx-auto h-16 w-16 text-muted-foreground opacity-50" />
          <h3 className="mt-4 text-lg font-semibold">Project not specified</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Select a project from the list to view its details.
          </p>
        </div>
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="space-y-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>
        <div className="rounded-lg border bg-destructive/10 p-6 text-destructive">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 mt-1" />
            <div>
              <h3 className="font-semibold mb-1">Failed to load project</h3>
              <p>
                We couldn&rsquo;t load the project from the CNS service for tenant{' '}
                {currentTenant?.name || 'Unknown'}. Please try again later.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project || isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-10 w-32 rounded bg-muted animate-pulse" />
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="h-6 w-1/3 rounded bg-muted animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
              <FolderKanban className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <p className="mt-1 text-gray-600">
                {project.description || 'No description provided for this project.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={handleEditProject}
                className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
            )}
            {canDelete && (
              <button className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Project Metadata */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Status</p>
          <p
            className={cn(
              'mt-1 text-lg font-semibold capitalize',
              project.status === 'active' ? 'text-green-600' : 'text-gray-600'
            )}
          >
            {project.status}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Created</p>
          <p className="mt-1 text-lg font-semibold">
            {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'Unknown'}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Last Updated</p>
          <p className="mt-1 text-lg font-semibold">
            {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : 'Unknown'}
          </p>
        </div>
      </div>

      {/* Project Components - Collapsible List */}
      <ProjectComponentList projectId={projectId} />

      {/* BOMs Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">BOMs in this Project</h2>
          {canEdit && (
            <button
              onClick={handleCreateBOM}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Upload BOM
            </button>
          )}
        </div>

        {bomsError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <span>Failed to load BOMs for this project. Please try again later.</span>
          </div>
        )}

        {boms.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <FileText className="mx-auto h-16 w-16 text-muted-foreground opacity-50" />
            <h3 className="mt-4 text-lg font-semibold">No BOMs Yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Upload your first BOM to this project to get started with component analysis.
            </p>
            {canEdit && (
              <button
                onClick={handleCreateBOM}
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Upload BOM
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {boms.map((bom) => (
              <div
                key={bom.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleViewBOM(bom.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{bom.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {bom.lineCount?.toLocaleString() ?? 0} components • Status {bom.status}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Updated</p>
                    <p className="text-base font-semibold">
                      {new Date(bom.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectDetailPage;
