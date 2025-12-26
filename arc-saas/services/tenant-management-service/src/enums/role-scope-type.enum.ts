/**
 * Role scope type enumeration.
 * Defines the hierarchical scope at which a role applies.
 */
export enum RoleScopeType {
  /**
   * Tenant-level role (organization-wide).
   * Permissions apply across all workspaces and projects.
   */
  Tenant = 'tenant',

  /**
   * Workspace-level role.
   * Permissions limited to specific workspace and its projects.
   */
  Workspace = 'workspace',

  /**
   * Project-level role.
   * Permissions limited to specific project only.
   */
  Project = 'project',
}
