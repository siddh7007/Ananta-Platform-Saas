/**
 * Permission Guard Component
 *
 * Role-based UI rendering component for the CBP customer portal.
 * Conditionally renders children based on user permissions or role level.
 *
 * Supports two modes:
 * 1. Permission-based: Check if user has specific permission (e.g., 'bom:create')
 * 2. Role-based: Check if user meets minimum role requirement (e.g., 'admin')
 *
 * @example
 * ```tsx
 * // Permission-based guard
 * <PermissionGuard permission="bom:create">
 *   <CreateBOMButton />
 * </PermissionGuard>
 *
 * // Role-based guard
 * <PermissionGuard minRole="admin">
 *   <AdminPanel />
 * </PermissionGuard>
 *
 * // With fallback content
 * <PermissionGuard permission="billing:manage" fallback={<UpgradePrompt />}>
 *   <BillingDashboard />
 * </PermissionGuard>
 *
 * // Show "no permission" message
 * <PermissionGuard permission="bom:delete" showDenied>
 *   <DeleteButton />
 * </PermissionGuard>
 * ```
 */

import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { AppRole, Permission } from '@/lib/permissions';

/**
 * Props for PermissionGuard component
 */
export interface PermissionGuardProps {
  /**
   * Required permission - user must have this permission to view content
   * Mutually exclusive with minRole
   */
  permission?: Permission;

  /**
   * Minimum role required - user must have at least this role level
   * Mutually exclusive with permission
   */
  minRole?: AppRole;

  /**
   * Content to render if user has permission
   */
  children: ReactNode;

  /**
   * Content to render if user lacks permission
   * @default null (hide content)
   */
  fallback?: ReactNode;

  /**
   * Show "no permission" message instead of hiding content
   * Only applies if no fallback is provided
   * @default false
   */
  showDenied?: boolean;

  /**
   * Custom "no permission" message
   * Only used if showDenied is true
   */
  deniedMessage?: string;
}

/**
 * Permission Guard Component
 *
 * Conditionally renders children based on user permissions or role level.
 * Must provide either `permission` OR `minRole`, not both.
 *
 * @param props - PermissionGuard props
 * @returns Rendered content if authorized, fallback/null if not
 */
export function PermissionGuard({
  permission,
  minRole,
  children,
  fallback = null,
  showDenied = false,
  deniedMessage,
}: PermissionGuardProps) {
  const { can, isAtLeast } = usePermissions();

  // Validation: must provide either permission OR minRole, not both
  if (permission && minRole) {
    console.warn(
      '[PermissionGuard] Both permission and minRole provided. Use only one. Defaulting to permission check.'
    );
  }

  if (!permission && !minRole) {
    console.warn('[PermissionGuard] Neither permission nor minRole provided. Content will be hidden.');
    return <>{fallback}</>;
  }

  // Check authorization
  const isAuthorized = permission ? can(permission) : isAtLeast(minRole!);

  // Render authorized content
  if (isAuthorized) {
    return <>{children}</>;
  }

  // Render fallback if provided
  if (fallback !== null) {
    return <>{fallback}</>;
  }

  // Show denied message if requested
  if (showDenied) {
    const defaultMessage = permission
      ? `You don't have permission to perform this action (required: ${permission})`
      : `You don't have sufficient access (required role: ${minRole})`;

    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <svg
            className="h-5 w-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h3 className="font-medium">Access Restricted</h3>
            <p className="mt-1 text-sm">{deniedMessage || defaultMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  // Default: hide content
  return null;
}

/**
 * Convenience Components
 * Pre-configured permission guards for common use cases
 */

/**
 * Admin-only content guard
 * Requires admin, owner, or super_admin role
 */
export function AdminOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard minRole="admin" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

/**
 * Owner-only content guard
 * Requires owner or super_admin role
 */
export function OwnerOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard minRole="owner" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

/**
 * Engineer-only content guard
 * Requires engineer, admin, owner, or super_admin role
 */
export function EngineerOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard minRole="engineer" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

/**
 * Super admin-only content guard
 * Requires exact super_admin role (platform staff only)
 */
export function SuperAdminOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard minRole="super_admin" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

/**
 * Permission-specific convenience guards
 * For common permission checks
 */

/**
 * Guard for BOM editing permissions
 * Requires 'bom:update' permission (engineer or higher)
 */
export function CanEditBOM({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard permission="bom:update" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

/**
 * Guard for BOM creation permissions
 * Requires 'bom:create' permission (engineer or higher)
 */
export function CanCreateBOM({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard permission="bom:create" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

/**
 * Guard for BOM deletion permissions
 * Requires 'bom:delete' permission (admin or higher)
 */
export function CanDeleteBOM({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard permission="bom:delete" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

/**
 * Guard for team management permissions
 * Requires 'team:manage' permission (admin or higher)
 */
export function CanManageTeam({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard permission="team:manage" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

/**
 * Guard for billing access permissions
 * Requires 'billing:view' permission (owner or higher)
 */
export function CanAccessBilling({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard permission="billing:view" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

/**
 * Guard for settings management permissions
 * Requires 'settings:manage' permission (admin or higher)
 */
export function CanManageSettings({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard permission="settings:manage" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

/**
 * Higher-Order Component for Permission Guarding
 *
 * Wraps a component with permission checking logic.
 * Use this for route-level protection or entire page components.
 *
 * @param Component - Component to wrap
 * @param options - Permission or role requirements
 * @returns Wrapped component with permission checking
 *
 * @example
 * ```tsx
 * const ProtectedAdminPage = withPermission(AdminPage, { minRole: 'admin' });
 * const ProtectedBOMEditor = withPermission(BOMEditor, { permission: 'bom:update' });
 * ```
 */
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  options: { permission?: Permission; minRole?: AppRole; fallback?: ReactNode }
): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <PermissionGuard
        permission={options.permission}
        minRole={options.minRole}
        fallback={options.fallback}
      >
        <Component {...props} />
      </PermissionGuard>
    );
  };

  // Set display name for debugging
  WrappedComponent.displayName = `withPermission(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}
