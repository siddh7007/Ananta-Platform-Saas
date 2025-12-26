/**
 * Workspaces Page
 *
 * Lists all workspaces and their projects for organizing BOMs.
 * Features:
 * - Workspace cards with project counts
 * - Expandable projects list with keyboard navigation
 * - Create/edit workspace modals
 * - Quick actions (archive, delete) with confirmation
 * - Accessible with ARIA labels and keyboard support
 */

import React, { useState, useMemo, useCallback, KeyboardEvent, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useList, useCreate, useUpdate, useDelete } from '@refinedev/core';
import {
  FolderOpen,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Archive,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  Layers,
  Calendar,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizationId } from '@/contexts/TenantContext';
import { hasMinimumRole, AppRole } from '@/config/auth';
import { Button } from '@/components/ui/button';
import type {
  Workspace,
  Project,
  ProjectStatus,
} from '@/types/workspace';

// Inline status config to avoid import issues
const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  on_hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700' },
  archived: { label: 'Archived', color: 'bg-gray-100 text-gray-500' },
};

export function WorkspaceListPage() {
  const navigate = useNavigate();
  const { id: workspaceIdParam } = useParams<{ id?: string }>();
  const { user } = useAuth();
  // IMPORTANT: In App Plane, tenant ID = organization ID
  // Use this hook for CNS/App Plane API calls that require organization_id
  const organizationId = useOrganizationId();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(
    // Auto-expand if navigated to specific workspace
    workspaceIdParam ? new Set([workspaceIdParam]) : new Set()
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Track selected workspace for projects query
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

  const canCreate = hasMinimumRole((user?.role as AppRole) || 'analyst', 'engineer');
  const canDelete = hasMinimumRole((user?.role as AppRole) || 'analyst', 'admin');

  // Fetch workspaces from CNS service
  // CNS API requires organization_id as a direct query parameter
  const { data: workspacesData, isLoading, isError, refetch } = useList<Workspace>({
    resource: 'workspaces',
    filters: searchQuery
      ? [{ field: 'name', operator: 'contains', value: searchQuery }]
      : [],
    sorters: [{ field: 'name', order: 'asc' }],
    meta: {
      dataProviderName: 'cns',
      // Pass organization_id as direct query param for FastAPI backend
      queryParams: {
        organization_id: organizationId,
      },
    },
    queryOptions: {
      // Only fetch when we have an organization_id
      enabled: !!organizationId,
    },
  });

  // Fetch projects for selected workspace from CNS service
  // CNS API requires workspace_id as a direct query parameter
  const { data: projectsData, isLoading: projectsLoading } = useList<Project>({
    resource: 'projects',
    pagination: { current: 1, pageSize: 100 },
    meta: {
      dataProviderName: 'cns',
      // Pass workspace_id as direct query param for FastAPI backend
      queryParams: {
        workspace_id: selectedWorkspaceId,
      },
    },
    queryOptions: {
      // Only fetch when we have a selected workspace
      enabled: !!selectedWorkspaceId,
    },
  });

  // Delete mutation
  const { mutateAsync: deleteWorkspaceAsync, isLoading: isDeleting } = useDelete();
  const { mutateAsync: updateWorkspaceAsync, isLoading: isArchiving } = useUpdate();

  const workspaces = workspacesData?.data || [];
  const projects = projectsData?.data || [];

  // Group projects by workspace
  const projectsByWorkspace = useMemo(() => {
    const grouped: Record<string, Project[]> = {};
    projects.forEach((project) => {
      if (!grouped[project.workspaceId]) {
        grouped[project.workspaceId] = [];
      }
      grouped[project.workspaceId].push(project);
    });
    return grouped;
  }, [projects]);

  const toggleWorkspace = useCallback((workspaceId: string) => {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(workspaceId)) {
        next.delete(workspaceId);
        // Clear selected workspace if collapsing
        setSelectedWorkspaceId(null);
      } else {
        next.add(workspaceId);
        // Set selected workspace to fetch projects
        setSelectedWorkspaceId(workspaceId);
      }
      return next;
    });
  }, []);

  // Keyboard handler for workspace expand/collapse
  const handleWorkspaceKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, workspaceId: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleWorkspace(workspaceId);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setExpandedWorkspaces((prev) => new Set([...prev, workspaceId]));
        setSelectedWorkspaceId(workspaceId);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setExpandedWorkspaces((prev) => {
          const next = new Set(prev);
          next.delete(workspaceId);
          return next;
        });
        setSelectedWorkspaceId(null);
      }
    },
    [toggleWorkspace]
  );

  // Archive workspace handler
  const handleArchive = useCallback(
    async (workspace: Workspace) => {
      setActionError(null);
      try {
        await updateWorkspaceAsync({
          resource: 'workspaces',
          id: workspace.id,
          values: { isArchived: true },
          meta: { dataProviderName: 'cns' },
        });
        await refetch();
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : 'Failed to archive workspace'
        );
      }
    },
    [updateWorkspaceAsync, refetch]
  );

  // Delete workspace handler
  const handleDelete = useCallback(
    async (workspace: Workspace) => {
      if (!window.confirm(`Delete "${workspace.name}"? This action cannot be undone.`)) {
        return;
      }

      setActionError(null);
      try {
        await deleteWorkspaceAsync({
          resource: 'workspaces',
          id: workspace.id,
          meta: { dataProviderName: 'cns' },
        });
        await refetch();
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : 'Failed to delete workspace'
        );
      }
    },
    [deleteWorkspaceAsync, refetch]
  );

  // Calculate stats
  const totalProjects = projects.length;
  const totalBoms = workspaces.reduce((sum, ws) => sum + (ws.bomCount || 0), 0);

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-semibold">Failed to load workspaces</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          There was an error loading your workspaces. Please try again.
        </p>
        <Button onClick={() => refetch()} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-sm text-muted-foreground">
            Organize your BOMs into workspaces and projects
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Workspace
          </Button>
        )}
      </div>

      {/* Error Alert */}
      {actionError && (
        <div
          className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
          role="alert"
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Error</p>
            <p className="text-sm">{actionError}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActionError(null)}
            className="text-red-600 hover:bg-red-100"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <FolderOpen className="h-5 w-5 text-blue-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold">{workspaces.length}</p>
              <p className="text-sm text-muted-foreground">Workspaces</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2">
              <Layers className="h-5 w-5 text-green-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalProjects}</p>
              <p className="text-sm text-muted-foreground">Projects</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-100 p-2">
              <FileText className="h-5 w-5 text-purple-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalBoms}</p>
              <p className="text-sm text-muted-foreground">Total BOMs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Search workspaces by name"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Refresh list">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Workspace List */}
      <div className="space-y-4" role="list" aria-label="Workspaces">
        {isLoading || projectsLoading ? (
          <div
            className="flex items-center justify-center py-12"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Loading workspaces...</span>
          </div>
        ) : workspaces.length === 0 ? (
          <div
            className="rounded-lg border bg-card p-12 text-center"
            role="status"
            aria-live="polite"
          >
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/50" aria-hidden="true" />
            <h3 className="mt-4 text-lg font-medium">No workspaces yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchQuery
                ? 'No workspaces match your search. Try a different query.'
                : 'Create your first workspace to organize BOMs'}
            </p>
            {canCreate && !searchQuery && (
              <Button onClick={() => setShowCreateModal(true)} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create Workspace
              </Button>
            )}
          </div>
        ) : (
          workspaces.map((workspace) => {
            const isExpanded = expandedWorkspaces.has(workspace.id);
            const workspaceProjects = projectsByWorkspace[workspace.id] || [];

            return (
              <div
                key={workspace.id}
                role="listitem"
                className="rounded-lg border bg-card overflow-hidden"
              >
                {/* Workspace Header */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-controls={`workspace-projects-${workspace.id}`}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                  onClick={() => toggleWorkspace(workspace.id)}
                  onKeyDown={(e) => handleWorkspaceKeyDown(e, workspace.id)}
                >
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </span>
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: workspace.color || '#3B82F6' }}
                      aria-hidden="true"
                    />
                    <div>
                      <h3 className="font-semibold">{workspace.name}</h3>
                      {workspace.description && (
                        <p className="text-sm text-muted-foreground">
                          {workspace.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Layers className="h-4 w-4" aria-hidden="true" />
                        <span aria-label={`${workspaceProjects.length} projects`}>
                          {workspaceProjects.length} projects
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        <span aria-label={`${workspace.bomCount || 0} BOMs`}>
                          {workspace.bomCount || 0} BOMs
                        </span>
                      </span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <WorkspaceMenu
                        workspace={workspace}
                        canEdit={canCreate}
                        canDelete={canDelete}
                        isDeleting={isDeleting}
                        isArchiving={isArchiving}
                        onEdit={() => setEditingWorkspace(workspace)}
                        onArchive={() => handleArchive(workspace)}
                        onDelete={() => handleDelete(workspace)}
                      />
                    </div>
                  </div>
                </div>

                {/* Projects List (Expanded) */}
                {isExpanded && (
                  <div
                    id={`workspace-projects-${workspace.id}`}
                    className="border-t"
                    role="region"
                    aria-label={`Projects in ${workspace.name}`}
                  >
                    {workspaceProjects.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground">
                        <p className="text-sm">No projects in this workspace</p>
                        {canCreate && (
                          <button
                            onClick={() => navigate(`/workspaces/${workspace.id}/projects/new`)}
                            className="mt-2 text-sm text-primary hover:underline"
                          >
                            + Create first project
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="divide-y" role="list">
                        {workspaceProjects.map((project) => (
                          <ProjectRow
                            key={project.id}
                            project={project}
                            onClick={() => navigate(`/boms?projectId=${project.id}`)}
                          />
                        ))}
                        {canCreate && (
                          <button
                            onClick={() => navigate(`/workspaces/${workspace.id}/projects/new`)}
                            className="w-full p-3 text-sm text-muted-foreground hover:bg-muted/50 flex items-center justify-center gap-2"
                          >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Add Project
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateWorkspaceModal
          organizationId={organizationId ?? undefined}
          onClose={() => setShowCreateModal(false)}
          onSuccess={refetch}
        />
      )}

      {/* Edit Modal */}
      {editingWorkspace && (
        <CreateWorkspaceModal
          workspace={editingWorkspace}
          organizationId={organizationId ?? undefined}
          onClose={() => setEditingWorkspace(null)}
          onSuccess={refetch}
        />
      )}
    </div>
  );
}

// Project Row Component
function ProjectRow({
  project,
  onClick,
}: {
  project: Project;
  onClick: () => void;
}) {
  const statusConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG.active;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="listitem"
      tabIndex={0}
      className="flex items-center justify-between p-4 pl-12 hover:bg-muted/30 cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: project.color || '#22C55E' }}
          aria-hidden="true"
        />
        <div>
          <h4 className="font-medium">{project.name}</h4>
          {project.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {project.description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span
          className={cn(
            'px-2 py-0.5 rounded-full text-xs font-medium',
            statusConfig.color
          )}
        >
          {statusConfig.label}
        </span>
        <span className="text-muted-foreground">
          {project.bomCount || 0} BOMs
        </span>
        {project.dueDate && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            {new Date(project.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

// Workspace Menu Component with full keyboard navigation
function WorkspaceMenu({
  workspace,
  canEdit,
  canDelete,
  isDeleting,
  isArchiving,
  onEdit,
  onArchive,
  onDelete,
}: {
  workspace: Workspace;
  canEdit: boolean;
  canDelete: boolean;
  isDeleting: boolean;
  isArchiving: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (!canEdit && !canDelete) return null;

  // Build list of available menu items
  const menuItems: Array<{ id: string; action: () => void; disabled?: boolean }> = [];
  if (canEdit) {
    menuItems.push({ id: 'edit', action: onEdit });
    menuItems.push({ id: 'archive', action: onArchive, disabled: isArchiving });
  }
  if (canDelete) {
    menuItems.push({ id: 'delete', action: onDelete, disabled: isDeleting });
  }

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      if (!open) {
        e.preventDefault();
        setOpen(true);
        setActiveIndex(0);
      }
    }
  };

  const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
        triggerRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % menuItems.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(menuItems.length - 1);
        break;
      case 'Tab':
        // Close menu on tab out (focus trap release)
        setOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  const handleItemKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const item = menuItems[index];
      if (!item.disabled) {
        setOpen(false);
        setActiveIndex(-1);
        item.action();
      }
    }
  };

  // Focus management: focus active item when activeIndex changes
  useEffect(() => {
    if (open && activeIndex >= 0 && menuRef.current) {
      const items = menuRef.current.querySelectorAll('[role="menuitem"]');
      const targetItem = items[activeIndex] as HTMLElement;
      targetItem?.focus();
    }
  }, [open, activeIndex]);

  // Close menu when clicking outside and restore focus
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
        // Restore focus to trigger for keyboard users
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => {
          setOpen(!open);
          if (!open) setActiveIndex(0);
        }}
        onKeyDown={handleTriggerKeyDown}
        className="p-1.5 rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`workspace-menu-${workspace.id}`}
        aria-label={`Actions for ${workspace.name}`}
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setOpen(false);
              setActiveIndex(-1);
            }}
            aria-hidden="true"
          />
          <div
            ref={menuRef}
            id={`workspace-menu-${workspace.id}`}
            className="absolute right-0 top-full mt-1 z-20 w-40 rounded-md border bg-popover shadow-lg py-1"
            role="menu"
            aria-label={`Actions for ${workspace.name}`}
            aria-activedescendant={activeIndex >= 0 ? `menu-item-${workspace.id}-${menuItems[activeIndex]?.id}` : undefined}
            onKeyDown={handleMenuKeyDown}
          >
            {canEdit && (
              <button
                id={`menu-item-${workspace.id}-edit`}
                role="menuitem"
                tabIndex={activeIndex === 0 ? 0 : -1}
                onClick={() => {
                  setOpen(false);
                  setActiveIndex(-1);
                  triggerRef.current?.focus();
                  onEdit();
                }}
                onKeyDown={(e) => handleItemKeyDown(e, 0)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted text-left focus:outline-none focus:bg-muted"
              >
                <Edit className="h-4 w-4" aria-hidden="true" />
                Edit
              </button>
            )}
            {canEdit && (
              <button
                id={`menu-item-${workspace.id}-archive`}
                role="menuitem"
                tabIndex={activeIndex === 1 ? 0 : -1}
                onClick={() => {
                  setOpen(false);
                  setActiveIndex(-1);
                  triggerRef.current?.focus();
                  onArchive();
                }}
                onKeyDown={(e) => handleItemKeyDown(e, 1)}
                disabled={isArchiving}
                aria-disabled={isArchiving}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted text-left focus:outline-none focus:bg-muted disabled:opacity-50"
              >
                {isArchiving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Archive className="h-4 w-4" aria-hidden="true" />
                )}
                Archive
              </button>
            )}
            {canDelete && (
              <button
                id={`menu-item-${workspace.id}-delete`}
                role="menuitem"
                tabIndex={activeIndex === (canEdit ? 2 : 0) ? 0 : -1}
                onClick={() => {
                  setOpen(false);
                  setActiveIndex(-1);
                  triggerRef.current?.focus();
                  onDelete();
                }}
                onKeyDown={(e) => handleItemKeyDown(e, canEdit ? 2 : 0)}
                disabled={isDeleting}
                aria-disabled={isDeleting}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted text-left text-red-600 focus:outline-none focus:bg-muted disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Create/Edit Workspace Modal
function CreateWorkspaceModal({
  workspace,
  organizationId,
  onClose,
  onSuccess,
}: {
  workspace?: Workspace;
  organizationId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [name, setName] = useState(workspace?.name || '');
  const [description, setDescription] = useState(workspace?.description || '');
  const [color, setColor] = useState(workspace?.color || '#3B82F6');
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync: createWorkspace, isLoading: isCreating } = useCreate();
  const { mutateAsync: updateWorkspace, isLoading: isUpdating } = useUpdate();

  const isSubmitting = isCreating || isUpdating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);

    try {
      if (workspace) {
        await updateWorkspace({
          resource: 'workspaces',
          id: workspace.id,
          values: { name: name.trim(), description: description.trim(), color },
          meta: { dataProviderName: 'cns' },
        });
      } else {
        // CNS API requires organization_id when creating a workspace
        await createWorkspace({
          resource: 'workspaces',
          values: {
            organization_id: organizationId,
            name: name.trim(),
            description: description.trim(),
            color,
          },
          meta: { dataProviderName: 'cns' },
        });
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workspace');
    }
  };

  const presetColors = [
    { value: '#3B82F6', name: 'Blue' },
    { value: '#22C55E', name: 'Green' },
    { value: '#8B5CF6', name: 'Purple' },
    { value: '#F97316', name: 'Orange' },
    { value: '#EC4899', name: 'Pink' },
    { value: '#14B8A6', name: 'Teal' },
    { value: '#6366F1', name: 'Indigo' },
    { value: '#EF4444', name: 'Red' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-background rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="workspace-modal-title" className="text-lg font-semibold">
            {workspace ? 'Edit Workspace' : 'Create Workspace'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div
              className="flex items-center gap-2 p-3 rounded-md bg-red-50 text-red-700 text-sm"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <div>
            <label htmlFor="workspace-name" className="block text-sm font-medium mb-1">
              Name
            </label>
            <input
              id="workspace-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Product Line A"
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              required
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="workspace-description" className="block text-sm font-medium mb-1">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="workspace-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this workspace"
              rows={2}
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <fieldset>
            <legend className="block text-sm font-medium mb-2">Color</legend>
            <div className="flex gap-2" role="radiogroup" aria-label="Select workspace color">
              {presetColors.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={color === c.value}
                  aria-label={c.name}
                  onClick={() => setColor(c.value)}
                  className={cn(
                    'w-8 h-8 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary',
                    color === c.value && 'ring-2 ring-offset-2 ring-ring'
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : workspace ? (
                'Save Changes'
              ) : (
                'Create'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default WorkspaceListPage;
