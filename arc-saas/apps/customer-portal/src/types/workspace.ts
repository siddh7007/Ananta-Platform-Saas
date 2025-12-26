/**
 * Workspace and Project types for organizing BOMs
 *
 * Hierarchy:
 * - Organization (tenant) has many Workspaces
 * - Workspace has many Projects
 * - Project has many BOMs
 *
 * Example use cases:
 * - Workspace: "Product Line A", "R&D", "Legacy Products"
 * - Project: "Widget v2.0", "Sensor Module", "Power Supply Rev B"
 */

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  color?: string; // Hex color for visual identification
  icon?: string; // Lucide icon name
  organizationId: string;

  // Statistics (computed from projects)
  projectCount: number;
  bomCount: number;
  memberCount: number;

  // Settings
  isDefault?: boolean; // Default workspace for new BOMs
  isArchived?: boolean;

  // Audit
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  workspaceId: string;
  organizationId: string;

  // Project metadata
  status: ProjectStatus;
  dueDate?: string;
  tags?: string[];

  // Statistics
  bomCount: number;
  totalLineItems: number;
  enrichedLineItems: number;

  // Audit
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';

export const PROJECT_STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; color: string }
> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  on_hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700' },
  archived: { label: 'Archived', color: 'bg-gray-100 text-gray-500' },
};

// Preset colors for workspaces/projects
export const WORKSPACE_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Red', value: '#EF4444' },
];

// Preset icons for workspaces/projects
export const WORKSPACE_ICONS = [
  'folder',
  'briefcase',
  'archive',
  'box',
  'cpu',
  'zap',
  'star',
  'flag',
  'target',
  'layers',
];

export interface CreateWorkspacePayload {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateWorkspacePayload {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isArchived?: boolean;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  workspaceId: string;
  color?: string;
  icon?: string;
  dueDate?: string;
  tags?: string[];
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  status?: ProjectStatus;
  dueDate?: string;
  tags?: string[];
}

// Move BOM to a different project
export interface MoveBomPayload {
  bomId: string;
  targetProjectId: string;
}

// Workspace summary stats
export interface WorkspaceSummary {
  totalWorkspaces: number;
  totalProjects: number;
  totalBoms: number;
  recentWorkspaces: Workspace[];
  recentProjects: Project[];
}
