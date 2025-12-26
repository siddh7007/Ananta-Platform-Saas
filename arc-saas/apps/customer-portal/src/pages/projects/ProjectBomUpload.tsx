/**
 * Project BOM Upload Page
 *
 * BOM upload page with project context pre-selected.
 * Sets the project context in localStorage and renders the unified BomUpload component.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowLeft, FolderKanban } from 'lucide-react';
import { useProject } from '@/hooks/useProjects';
import { useToast } from '@/hooks/useToast';
import { BomUploadUnified } from '@/components/bom/unified/BomUploadUnified';

export function ProjectBomUploadPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contextReady, setContextReady] = useState(false);

  // Fetch project details to validate access and get name
  const { data: project, isLoading, error } = useProject(projectId || '');

  // Set project context in localStorage when project is loaded
  useEffect(() => {
    if (project && projectId) {
      // Set project context for the BOM upload component
      localStorage.setItem('current_project_id', projectId);
      localStorage.setItem('current_project_name', project.name);
      setContextReady(true);
    }
  }, [project, projectId]);

  // Handle project not found or access denied
  useEffect(() => {
    if (error) {
      toast({
        title: 'Project Not Found',
        description: 'Unable to load project. Please select a valid project.',
        variant: 'destructive',
      });
      navigate('/projects');
    }
  }, [error, navigate, toast]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading project context...</span>
      </div>
    );
  }

  // Error state
  if (!projectId || error) {
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
          <AlertCircle className="mx-auto h-16 w-16 text-destructive opacity-50" />
          <h3 className="mt-4 text-lg font-semibold">Project Not Found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            The project you're looking for doesn't exist or you don't have access.
          </p>
          <button
            onClick={() => navigate('/projects')}
            className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Browse Projects
          </button>
        </div>
      </div>
    );
  }

  // Waiting for context to be set
  if (!contextReady) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Preparing upload...</span>
      </div>
    );
  }

  // Project context is set, render the unified BOM upload page
  // Pass projectId and projectName directly to the unified component
  // NOTE: Do NOT navigate on complete - keep user on the same page
  // to see the full queue progression and allow viewing completed state
  return (
    <BomUploadUnified
      projectId={projectId}
      projectName={project?.name}
      onComplete={(bomId) => {
        // Stay on the same page - don't navigate
        // User can use action buttons to navigate when ready
        console.log('[ProjectBomUpload] Upload complete, staying on page:', bomId);
      }}
    />
  );
}

export default ProjectBomUploadPage;
