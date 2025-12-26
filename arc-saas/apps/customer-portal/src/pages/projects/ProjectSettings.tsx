/**
 * Project Settings Page
 *
 * Settings page for a specific project.
 * Admin+ role required for access.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Settings,
  ArrowLeft,
  FolderKanban,
  Save,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle,
  Archive,
  RotateCcw,
  Users,
  Shield,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { hasMinimumRole, AppRole } from '@/config/auth';
import { useProject, useUpdateProject, useDeleteProject } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

interface ProjectFormData {
  name: string;
  description: string;
  status: 'active' | 'archived' | 'on_hold' | 'completed';
}

export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const canEdit = hasMinimumRole((user?.role as AppRole) || 'analyst', 'admin');
  const canDelete = hasMinimumRole((user?.role as AppRole) || 'analyst', 'owner');

  // Fetch project details
  const { data: project, isLoading, error } = useProject(projectId || '');

  // Mutations
  const updateProject = useUpdateProject(projectId || '');
  const deleteProject = useDeleteProject();

  // Form state
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    status: 'active',
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'access' | 'notifications' | 'danger'>('general');

  // Initialize form when project loads
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description || '',
        status: (project.status as ProjectFormData['status']) || 'active',
      });
    }
  }, [project]);

  // Track changes
  useEffect(() => {
    if (project) {
      const changed =
        formData.name !== project.name ||
        formData.description !== (project.description || '') ||
        formData.status !== (project.status || 'active');
      setHasChanges(changed);
    }
  }, [formData, project]);

  const handleInputChange = (field: keyof ProjectFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!projectId || !canEdit) return;

    setIsSaving(true);
    try {
      await updateProject.mutateAsync({
        name: formData.name,
        description: formData.description,
        status: formData.status,
      });
      toast({
        title: 'Settings saved',
        description: 'Project settings have been updated successfully.',
      });
      setHasChanges(false);
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!projectId || !canEdit) return;

    const newStatus = formData.status === 'archived' ? 'active' : 'archived';
    const action = newStatus === 'archived' ? 'archive' : 'restore';

    if (!window.confirm(`Are you sure you want to ${action} this project?`)) {
      return;
    }

    try {
      await updateProject.mutateAsync({ status: newStatus });
      toast({
        title: `Project ${action}d`,
        description: `The project has been ${action}d successfully.`,
      });
      setFormData(prev => ({ ...prev, status: newStatus }));
    } catch (err) {
      toast({
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} failed`,
        description: err instanceof Error ? err.message : `Failed to ${action} project`,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!projectId || !canDelete) return;

    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteProject.mutateAsync(projectId);
      toast({
        title: 'Project deleted',
        description: 'The project has been permanently deleted.',
      });
      navigate('/projects');
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Failed to delete project',
        variant: 'destructive',
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading project settings...</span>
      </div>
    );
  }

  // Error or not found
  if (error || !project) {
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
          <Button onClick={() => navigate('/projects')} className="mt-6">
            Browse Projects
          </Button>
        </div>
      </div>
    );
  }

  // Access denied
  if (!canEdit) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/projects" className="text-muted-foreground hover:text-foreground">
            Projects
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link to={`/projects/${projectId}`} className="text-muted-foreground hover:text-foreground">
            {project.name}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">Settings</span>
        </div>

        <div className="rounded-lg border bg-card p-12 text-center">
          <Shield className="mx-auto h-16 w-16 text-muted-foreground opacity-50" />
          <h3 className="mt-4 text-lg font-semibold">Access Denied</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            You need admin or higher permissions to access project settings.
          </p>
          <Button onClick={() => navigate(`/projects/${projectId}`)} className="mt-6">
            View Project
          </Button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'access', label: 'Access', icon: Users },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'danger', label: 'Danger Zone', icon: AlertCircle },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link to="/projects" className="text-muted-foreground hover:text-foreground">
          Projects
        </Link>
        <span className="text-muted-foreground">/</span>
        <Link to={`/projects/${projectId}`} className="text-muted-foreground hover:text-foreground">
          {project.name}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">Settings</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <FolderKanban className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Project Settings</h1>
            <p className="text-sm text-muted-foreground">{project.name}</p>
          </div>
        </div>
        {hasChanges && (
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4" aria-label="Settings tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="max-w-2xl">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">General Information</h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Enter project name"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Describe this project"
                  />
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium mb-1">
                    Status
                  </label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

              </div>
            </div>
          </div>
        )}

        {activeTab === 'access' && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Access Control</h2>
            <p className="text-sm text-muted-foreground">
              Manage who can view and edit this project. Coming soon.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
              <Users className="h-4 w-4" />
              Project access management will be available in a future update.
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Notification Settings</h2>
            <p className="text-sm text-muted-foreground">
              Configure notifications for this project. Coming soon.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
              <Bell className="h-4 w-4" />
              Notification settings will be available in a future update.
            </div>
          </div>
        )}

        {activeTab === 'danger' && (
          <div className="space-y-4">
            {/* Archive/Restore */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-amber-800">
                    {formData.status === 'archived' ? 'Restore Project' : 'Archive Project'}
                  </h3>
                  <p className="mt-1 text-sm text-amber-700">
                    {formData.status === 'archived'
                      ? 'Restore this project to make it active again.'
                      : 'Archive this project to hide it from the main view. You can restore it later.'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={handleArchive}
                >
                  {formData.status === 'archived' ? (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Delete */}
            {canDelete && (
              <div className="rounded-lg border border-red-200 bg-red-50/50 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-red-800">Delete Project</h3>
                    <p className="mt-1 text-sm text-red-700">
                      Permanently delete this project and all its BOMs. This action cannot be undone.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteProject.isPending}
                  >
                    {deleteProject.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectSettingsPage;
