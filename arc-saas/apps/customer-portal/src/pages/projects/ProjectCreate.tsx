/**
 * Project Create Page
 *
 * Form to create a new project in the current workspace.
 * Only engineers and above can create projects.
 *
 * Architecture:
 * - Organization (tenant) has many Workspaces
 * - Workspace has many Projects
 * - Project has many BOMs
 *
 * The workspace is auto-populated from:
 * 1. Currently selected workspace in the sidebar (WorkspaceContext)
 * 2. Falls back to default workspace if none selected
 */

import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderKanban, Save, Loader2, Building2, AlertCircle } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { hasMinimumRole } from '@/config/auth';
import { useCreateProject } from '@/hooks/useProjects';

export function ProjectCreatePage() {
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const createProjectMutation = useCreateProject();

  // Get currently selected workspace from sidebar context
  const {
    currentWorkspace,
    workspaces,
    isLoading: workspacesLoading,
    error: workspacesError,
  } = useWorkspaceContext();

  // Use the currently selected workspace from sidebar (NOT default workspace)
  const selectedWorkspace = currentWorkspace;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const canCreate = user?.role && hasMinimumRole(user.role, 'engineer');

  if (!canCreate) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h3 className="text-lg font-semibold text-red-900">Access Denied</h3>
          <p className="mt-2 text-sm text-red-700">
            You need engineer or higher permissions to create projects.
          </p>
          <button
            onClick={() => navigate('/projects')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const handleBack = () => {
    navigate('/projects');
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Project name must be at least 3 characters';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Project name must not exceed 100 characters';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must not exceed 500 characters';
    }

    if (!currentTenant?.id) {
      newErrors.submit = 'No organization selected. Please select an organization first.';
    }

    if (!selectedWorkspace?.id) {
      newErrors.submit = 'No workspace available. Please contact your administrator.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!selectedWorkspace?.id) {
      setErrors({ submit: 'No workspace selected' });
      return;
    }

    try {
      await createProjectMutation.mutateAsync({
        workspace_id: selectedWorkspace.id,
        name: formData.name,
        description: formData.description || undefined,
      });

      // Navigate to projects list on success
      navigate('/projects');
    } catch (error: unknown) {
      console.error('Failed to create project:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create project';
      setErrors({ submit: errorMessage });
    }
  };

  // Show loading state while fetching workspaces
  if (workspacesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading workspace...</span>
      </div>
    );
  }

  // Show error if workspaces failed to load
  if (workspacesError) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <h3 className="text-lg font-semibold text-red-900">Failed to Load Workspaces</h3>
          <p className="mt-2 text-sm text-red-700">
            {workspacesError || 'Unknown error'}
          </p>
          <button
            onClick={() => navigate('/projects')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  // Show error if no workspaces available
  if (!workspaces || workspaces.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
          <h3 className="text-lg font-semibold text-yellow-900">No Workspace Available</h3>
          <p className="mt-2 text-sm text-yellow-700">
            You need to be a member of a workspace to create projects.
            Please contact your organization administrator.
          </p>
          <button
            onClick={() => navigate('/projects')}
            className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>

        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
            <FolderKanban className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create New Project</h1>
            <p className="mt-1 text-gray-600">
              Organize your BOMs into a logical project structure
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Alert */}
        {errors.submit && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{errors.submit}</p>
          </div>
        )}

        {/* Workspace Context (read-only display) */}
        {selectedWorkspace && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Creating project in workspace
                </p>
                <p className="text-sm font-medium">{selectedWorkspace.name}</p>
                {selectedWorkspace.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedWorkspace.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Project Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Project Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={`w-full px-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.name ? 'border-red-500' : ''
            }`}
            placeholder="e.g., SmartHome Hub v2.0"
            maxLength={100}
            disabled={createProjectMutation.isPending}
          />
          {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {formData.name.length}/100 characters
          </p>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className={`w-full px-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px] ${
              errors.description ? 'border-red-500' : ''
            }`}
            placeholder="Describe the purpose and scope of this project..."
            maxLength={500}
            disabled={createProjectMutation.isPending}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-500">{errors.description}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {formData.description.length}/500 characters
          </p>
        </div>

        {/* Info Box */}
        <div className="rounded-lg border bg-blue-50 p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">
            Project Structure
          </h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>Projects organize your BOMs into logical groups</li>
            <li>Each project can contain multiple BOMs</li>
            <li>Projects are scoped to your current workspace: <strong>{selectedWorkspace?.name}</strong></li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 border rounded-md hover:bg-muted"
            disabled={createProjectMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            disabled={createProjectMutation.isPending || !selectedWorkspace}
          >
            {createProjectMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Create Project
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ProjectCreatePage;
