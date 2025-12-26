/**
 * PermissionGuard Usage Examples
 *
 * This file demonstrates various usage patterns for the PermissionGuard
 * component system and usePermissions hook.
 *
 * NOT FOR PRODUCTION - Reference only
 */

import {
  PermissionGuard,
  AdminOnly,
  OwnerOnly,
  EngineerOnly,
  CanEditBOM,
  CanCreateBOM,
  CanDeleteBOM,
  CanManageTeam,
  CanAccessBilling,
  withPermission,
} from './PermissionGuard';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Example 1: Basic Permission-Based Guard
 */
function BOMActionsExample() {
  return (
    <div className="flex gap-2">
      {/* Only show create button to engineers and above */}
      <CanCreateBOM>
        <button className="btn-primary">Create BOM</button>
      </CanCreateBOM>

      {/* Only show edit button to engineers and above */}
      <CanEditBOM>
        <button className="btn-secondary">Edit BOM</button>
      </CanEditBOM>

      {/* Only show delete button to admins and above */}
      <CanDeleteBOM>
        <button className="btn-danger">Delete BOM</button>
      </CanDeleteBOM>
    </div>
  );
}

/**
 * Example 2: Role-Based Guards
 */
function NavigationExample() {
  return (
    <nav>
      {/* Available to all authenticated users */}
      <a href="/boms">My BOMs</a>
      <a href="/components">Component Search</a>

      {/* Only engineers and above */}
      <EngineerOnly>
        <a href="/advanced-search">Advanced Search</a>
        <a href="/bulk-import">Bulk Import</a>
      </EngineerOnly>

      {/* Only admins and above */}
      <AdminOnly>
        <a href="/team">Team Management</a>
        <a href="/settings">Settings</a>
      </AdminOnly>

      {/* Only owners and above */}
      <OwnerOnly>
        <a href="/billing">Billing</a>
        <a href="/subscription">Subscription</a>
      </OwnerOnly>
    </nav>
  );
}

/**
 * Example 3: Using Fallback Content
 */
function BillingPageExample() {
  return (
    <div>
      <h1>Billing Dashboard</h1>

      <CanAccessBilling
        fallback={
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
            <h2 className="text-lg font-semibold">Upgrade Required</h2>
            <p className="mt-2 text-gray-600">
              Billing access is restricted to organization owners.
            </p>
            <button className="btn-primary mt-4">Contact Admin</button>
          </div>
        }
      >
        <BillingDashboard />
      </CanAccessBilling>
    </div>
  );
}

/**
 * Example 4: Show Denied Message
 */
function TeamManagementExample() {
  return (
    <div>
      <h1>Team Management</h1>

      <PermissionGuard
        permission="team:manage"
        showDenied
        deniedMessage="Only organization admins can manage team members."
      >
        <div className="space-y-4">
          <button className="btn-primary">Invite Team Member</button>
          <TeamMembersList />
        </div>
      </PermissionGuard>
    </div>
  );
}

/**
 * Example 5: Using usePermissions Hook Directly
 */
function BOMEditorExample() {
  const { can, isAtLeast, role, roleLabel } = usePermissions();

  // Programmatic permission checks
  const canEdit = can('bom:update');
  const canDelete = can('bom:delete');
  const isEngineer = isAtLeast('engineer');

  return (
    <div>
      <div className="mb-4">
        <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
          {roleLabel}
        </span>
      </div>

      <div className="space-y-4">
        {/* Conditional rendering based on permissions */}
        {canEdit && (
          <button onClick={handleEdit} className="btn-primary">
            Edit BOM
          </button>
        )}

        {canDelete && (
          <button onClick={handleDelete} className="btn-danger">
            Delete BOM
          </button>
        )}

        {isEngineer && (
          <button onClick={handleAdvancedOptions} className="btn-secondary">
            Advanced Options
          </button>
        )}

        {/* Always show export (available to all users) */}
        <button onClick={handleExport} className="btn-secondary">
          Export BOM
        </button>
      </div>
    </div>
  );
}

/**
 * Example 6: Checking Multiple Permissions
 */
function SettingsPageExample() {
  const { can, permissions, isAuthenticated } = usePermissions();

  if (!isAuthenticated) {
    return <div>Please log in to access settings</div>;
  }

  const canViewSettings = can('settings:view');
  const canManageSettings = can('settings:manage');
  const canManageApiKeys = can('settings:api_keys');
  const canManageIntegrations = can('settings:integrations');

  return (
    <div>
      <h1>Settings</h1>

      {canViewSettings ? (
        <div className="space-y-6">
          {/* General Settings - All users can view */}
          <section>
            <h2>General Settings</h2>
            <div>...</div>
          </section>

          {/* Advanced Settings - Admin only */}
          {canManageSettings && (
            <section>
              <h2>Advanced Settings</h2>
              <div>...</div>
            </section>
          )}

          {/* API Keys - Admin only */}
          {canManageApiKeys && (
            <section>
              <h2>API Keys</h2>
              <div>...</div>
            </section>
          )}

          {/* Integrations - Admin only */}
          {canManageIntegrations && (
            <section>
              <h2>Integrations</h2>
              <div>...</div>
            </section>
          )}

          {/* Debug: Show all available permissions in dev mode */}
          {import.meta.env.DEV && (
            <details className="mt-6">
              <summary className="cursor-pointer text-sm text-gray-500">
                Debug: Available Permissions
              </summary>
              <ul className="mt-2 text-xs text-gray-600">
                {permissions.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          You don't have permission to view settings. Contact your administrator.
        </div>
      )}
    </div>
  );
}

/**
 * Example 7: Higher-Order Component Pattern
 */
const AdminDashboard = () => {
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>This content is only visible to admins and above.</p>
    </div>
  );
};

// Wrap component with permission guard
const ProtectedAdminDashboard = withPermission(AdminDashboard, {
  minRole: 'admin',
  fallback: (
    <div className="text-center">
      <h1>Access Denied</h1>
      <p>You need admin privileges to view this page.</p>
    </div>
  ),
});

/**
 * Example 8: Using with Custom Permission
 */
function CustomPermissionExample() {
  return (
    <div>
      <h1>Component Comparison</h1>

      <PermissionGuard
        permission="component:compare"
        fallback={
          <div className="rounded-lg border p-4">
            <p>Component comparison is available to all users.</p>
          </div>
        }
      >
        <ComponentComparisonTool />
      </PermissionGuard>
    </div>
  );
}

/**
 * Example 9: Nested Permission Guards
 */
function TeamPageExample() {
  return (
    <div>
      <h1>Team</h1>

      {/* All authenticated users can view team */}
      <TeamMembersList />

      {/* Only admins can manage team */}
      <AdminOnly>
        <div className="mt-6 space-y-4">
          <h2>Team Management</h2>

          {/* Can invite team members */}
          <PermissionGuard permission="team:invite">
            <button className="btn-primary">Invite Member</button>
          </PermissionGuard>

          {/* Can remove team members */}
          <PermissionGuard permission="team:remove">
            <button className="btn-danger">Remove Members</button>
          </PermissionGuard>
        </div>
      </AdminOnly>
    </div>
  );
}

/**
 * Example 10: Conditional UI Based on Role
 */
function DashboardExample() {
  const { role, is, isAtLeast } = usePermissions();

  return (
    <div>
      <h1>Dashboard</h1>

      {/* Show different content based on role */}
      {is('analyst') && <AnalystDashboard />}
      {is('engineer') && <EngineerDashboard />}
      {isAtLeast('admin') && <AdminDashboard />}

      {/* Or use role value directly */}
      {role === 'owner' && <OwnerDashboard />}
      {role === 'super_admin' && <SuperAdminDashboard />}
    </div>
  );
}

/**
 * Placeholder Components (for example completeness)
 */
function BillingDashboard() {
  return <div>Billing Dashboard Content</div>;
}
function TeamMembersList() {
  return <div>Team Members List</div>;
}
function ComponentComparisonTool() {
  return <div>Component Comparison Tool</div>;
}
function AnalystDashboard() {
  return <div>Analyst Dashboard</div>;
}
function EngineerDashboard() {
  return <div>Engineer Dashboard</div>;
}
function OwnerDashboard() {
  return <div>Owner Dashboard</div>;
}
function SuperAdminDashboard() {
  return <div>Super Admin Dashboard</div>;
}
function handleEdit() {
  console.log('Edit BOM');
}
function handleDelete() {
  console.log('Delete BOM');
}
function handleExport() {
  console.log('Export BOM');
}
function handleAdvancedOptions() {
  console.log('Advanced Options');
}

export {
  BOMActionsExample,
  NavigationExample,
  BillingPageExample,
  TeamManagementExample,
  BOMEditorExample,
  SettingsPageExample,
  ProtectedAdminDashboard,
  CustomPermissionExample,
  TeamPageExample,
  DashboardExample,
};
