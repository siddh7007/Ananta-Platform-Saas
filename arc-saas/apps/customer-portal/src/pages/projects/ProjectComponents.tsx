/**
 * Project Components Page
 *
 * Displays all components from a project's BOMs.
 * Aggregates and deduplicates components from all BOMs in the project.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderKanban, AlertCircle, Package } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useProject } from '@/hooks/useProjects';
import { ProjectComponentList } from '@/components/projects';

export function ProjectComponentsPage() {
  const params = useParams<{ id?: string; projectId?: string }>();
  const projectId = params.projectId || params.id;
  const navigate = useNavigate();
  const { currentTenant } = useTenant();

  const {
    data: project,
    isLoading: projectLoading,
    isError: projectError,
  } = useProject(projectId ?? '', {
    enabled: !!projectId,
  });

  const handleBack = () => navigate(`/projects/${projectId}`);

  if (!projectId) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>
        <div className="rounded-lg border bg-card p-12 text-center">
          <FolderKanban className="mx-auto h-16 w-16 text-muted-foreground opacity-50" />
          <h3 className="mt-4 text-lg font-semibold">Project not specified</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Select a project from the list to view its components.
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
          Back to Project
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

  if (projectLoading || !project) {
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
          Back to {project.name}
        </button>

        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Project Components</h1>
            <p className="mt-1 text-gray-600">
              All components from BOMs in {project.name}
            </p>
          </div>
        </div>
      </div>

      {/* Component List - Default Open */}
      <ProjectComponentList projectId={projectId} defaultOpen={true} />
    </div>
  );
}

export default ProjectComponentsPage;
