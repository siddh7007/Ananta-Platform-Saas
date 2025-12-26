/**
 * PermissionGuard Quick Demo
 *
 * Drop this component into your app to see the permission system in action.
 * Shows how permissions change based on the current user's role.
 */

import { usePermissions } from '@/hooks/usePermissions';
import {
  PermissionGuard,
  AdminOnly,
  OwnerOnly,
  EngineerOnly,
  CanCreateBOM,
  CanEditBOM,
  CanDeleteBOM,
  CanAccessBilling,
} from './PermissionGuard';

export function PermissionDemo() {
  const { role, roleLabel, roleDescription, permissions, can, isAtLeast } = usePermissions();

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      {/* Current User Info */}
      <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-gray-800">
        <h2 className="text-2xl font-bold">Permission System Demo</h2>
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">Current Role:</span>
            <span className="rounded bg-blue-100 px-2 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {roleLabel}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{roleDescription}</p>
        </div>
      </div>

      {/* BOM Actions Demo */}
      <section className="rounded-lg border bg-white p-6 shadow-sm dark:bg-gray-800">
        <h3 className="text-lg font-semibold">BOM Actions (Permission-Based Guards)</h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          These buttons use permission-specific guards like CanCreateBOM
        </p>
        <div className="flex flex-wrap gap-2">
          <CanCreateBOM>
            <button className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">
              Create BOM
            </button>
          </CanCreateBOM>
          <CanEditBOM>
            <button className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              Edit BOM
            </button>
          </CanEditBOM>
          <CanDeleteBOM>
            <button className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700">
              Delete BOM
            </button>
          </CanDeleteBOM>

          {/* Always visible to all users */}
          <button className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700">
            Export BOM
          </button>
        </div>
      </section>

      {/* Role-Based Navigation Demo */}
      <section className="rounded-lg border bg-white p-6 shadow-sm dark:bg-gray-800">
        <h3 className="text-lg font-semibold">Navigation (Role-Based Guards)</h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          These menu items use role-based guards like AdminOnly, OwnerOnly
        </p>
        <nav className="space-y-2">
          {/* Always visible */}
          <div className="rounded bg-gray-100 p-3 dark:bg-gray-700">
            My BOMs (All Users)
          </div>
          <div className="rounded bg-gray-100 p-3 dark:bg-gray-700">
            Component Search (All Users)
          </div>

          {/* Engineer and above */}
          <EngineerOnly>
            <div className="rounded bg-purple-100 p-3 dark:bg-purple-900">
              Bulk Import (Engineer+)
            </div>
          </EngineerOnly>

          {/* Admin and above */}
          <AdminOnly>
            <div className="rounded bg-blue-100 p-3 dark:bg-blue-900">
              Team Management (Admin+)
            </div>
          </AdminOnly>

          {/* Owner and above */}
          <OwnerOnly>
            <div className="rounded bg-green-100 p-3 dark:bg-green-900">
              Billing (Owner+)
            </div>
          </OwnerOnly>
        </nav>
      </section>

      {/* Programmatic Checks Demo */}
      <section className="rounded-lg border bg-white p-6 shadow-sm dark:bg-gray-800">
        <h3 className="text-lg font-semibold">Programmatic Permission Checks</h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Using the usePermissions hook directly in code
        </p>
        <div className="space-y-2">
          {can('bom:create') && (
            <div className="rounded bg-green-50 p-3 text-green-800 dark:bg-green-900 dark:text-green-200">
              You can create BOMs
            </div>
          )}
          {can('bom:delete') && (
            <div className="rounded bg-red-50 p-3 text-red-800 dark:bg-red-900 dark:text-red-200">
              You can delete BOMs
            </div>
          )}
          {can('team:manage') && (
            <div className="rounded bg-blue-50 p-3 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              You can manage team members
            </div>
          )}
          {can('billing:view') && (
            <div className="rounded bg-purple-50 p-3 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              You can access billing
            </div>
          )}
          {isAtLeast('admin') && (
            <div className="rounded bg-amber-50 p-3 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              You have admin-level access
            </div>
          )}
        </div>
      </section>

      {/* Fallback Demo */}
      <section className="rounded-lg border bg-white p-6 shadow-sm dark:bg-gray-800">
        <h3 className="text-lg font-semibold">Fallback Content Demo</h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Shows custom content when user lacks permission
        </p>
        <CanAccessBilling
          fallback={
            <div className="rounded border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <h4 className="font-medium text-amber-800 dark:text-amber-200">
                Upgrade Required
              </h4>
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                Billing access is restricted to organization owners. Contact your admin to
                upgrade your role.
              </p>
            </div>
          }
        >
          <div className="rounded bg-green-50 p-4 dark:bg-green-900">
            <h4 className="font-medium text-green-800 dark:text-green-200">
              Billing Dashboard
            </h4>
            <p className="mt-2 text-sm text-green-700 dark:text-green-300">
              You have access to the billing dashboard!
            </p>
          </div>
        </CanAccessBilling>
      </section>

      {/* Show Denied Demo */}
      <section className="rounded-lg border bg-white p-6 shadow-sm dark:bg-gray-800">
        <h3 className="text-lg font-semibold">Access Denied Message Demo</h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Shows an access denied message instead of hiding content
        </p>
        <PermissionGuard
          permission="admin:platform_settings"
          showDenied
          deniedMessage="Only platform super admins can access platform settings."
        >
          <div className="rounded bg-gray-100 p-4 dark:bg-gray-700">
            Platform Settings (Super Admin Only)
          </div>
        </PermissionGuard>
      </section>

      {/* All Available Permissions */}
      <section className="rounded-lg border bg-white p-6 shadow-sm dark:bg-gray-800">
        <h3 className="text-lg font-semibold">Your Available Permissions</h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Complete list of permissions granted to your role
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {permissions.map((permission) => (
            <div
              key={permission}
              className="rounded bg-gray-100 px-3 py-2 text-sm dark:bg-gray-700"
            >
              {permission}
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Total: {permissions.length} permissions
        </p>
      </section>

      {/* Role Comparison */}
      <section className="rounded-lg border bg-white p-6 shadow-sm dark:bg-gray-800">
        <h3 className="text-lg font-semibold">Role Hierarchy</h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Your position in the role hierarchy
        </p>
        <div className="space-y-2">
          {['super_admin', 'owner', 'admin', 'engineer', 'analyst'].map((checkRole) => (
            <div
              key={checkRole}
              className={`rounded p-3 ${
                role === checkRole
                  ? 'bg-blue-100 font-medium dark:bg-blue-900'
                  : 'bg-gray-50 dark:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="capitalize">{checkRole.replace('_', ' ')}</span>
                {role === checkRole && (
                  <span className="rounded bg-blue-600 px-2 py-1 text-xs text-white">
                    Your Role
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Usage Tips */}
      <section className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-950">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100">Usage Tips</h3>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-blue-800 dark:text-blue-200">
          <li>Use permission-based guards for specific actions (e.g., CanEditBOM)</li>
          <li>Use role-based guards for sections/pages (e.g., AdminOnly)</li>
          <li>Provide fallback content to improve UX for unauthorized users</li>
          <li>Use programmatic checks (can, isAtLeast) for complex logic</li>
          <li>Higher roles inherit all permissions of lower roles</li>
        </ul>
      </section>
    </div>
  );
}

export default PermissionDemo;
