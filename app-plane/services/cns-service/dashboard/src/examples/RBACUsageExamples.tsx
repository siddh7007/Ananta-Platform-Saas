/**
 * RBAC Usage Examples
 *
 * Demonstrates how to use the RBAC system in CNS Dashboard.
 * This file is for reference only - not imported into the app.
 */

import React from 'react';
import { ProtectedRoute, useHasRole } from '../components/ProtectedRoute';
import { useRole, useUserRole, useHasMinimumRole, useIsAdmin, useIsEngineer } from '../contexts/RoleContext';
import { useCanAccess } from '../lib/accessControlProvider';

// ============================================================================
// Example 1: Protect entire routes with ProtectedRoute component
// ============================================================================

export const AdminOnlyRoute: React.FC = () => {
  return (
    <ProtectedRoute minRole="admin">
      <div>
        <h1>Admin Panel</h1>
        <p>Only admins and above can see this.</p>
      </div>
    </ProtectedRoute>
  );
};

export const EngineerOnlyRoute: React.FC = () => {
  return (
    <ProtectedRoute minRole="engineer">
      <div>
        <h1>Engineering Tools</h1>
        <p>Engineers and above can access this.</p>
      </div>
    </ProtectedRoute>
  );
};

// ============================================================================
// Example 2: Custom fallback for access denied
// ============================================================================

const CustomAccessDenied: React.FC = () => (
  <div style={{ padding: '2rem', textAlign: 'center' }}>
    <h2>Insufficient Permissions</h2>
    <p>Please contact your administrator to request access.</p>
  </div>
);

export const ProtectedWithCustomFallback: React.FC = () => {
  return (
    <ProtectedRoute minRole="owner" fallback={<CustomAccessDenied />}>
      <div>Owner-only content</div>
    </ProtectedRoute>
  );
};

// ============================================================================
// Example 3: Conditional rendering based on role (using hooks)
// ============================================================================

export const ConditionalFeatures: React.FC = () => {
  const canEdit = useHasRole('engineer');
  const canDelete = useHasRole('admin');
  const canManageBilling = useHasRole('owner');

  return (
    <div>
      <h2>Available Features</h2>
      <ul>
        <li>View Content (all users)</li>
        {canEdit && <li>Edit Content (engineers+)</li>}
        {canDelete && <li>Delete Content (admins+)</li>}
        {canManageBilling && <li>Manage Billing (owners+)</li>}
      </ul>
    </div>
  );
};

// ============================================================================
// Example 4: Using RoleContext for comprehensive role information
// ============================================================================

export const UserRoleDisplay: React.FC = () => {
  const { role, roles, isAdmin, isEngineer, getRoleName, getLevel } = useRole();

  return (
    <div>
      <h3>Your Role Information</h3>
      <p>Primary Role: {getRoleName()}</p>
      <p>Level: {getLevel()}</p>
      <p>All Roles: {roles.join(', ')}</p>
      <p>Admin Access: {isAdmin ? 'Yes' : 'No'}</p>
      <p>Engineer Access: {isEngineer ? 'Yes' : 'No'}</p>
    </div>
  );
};

// ============================================================================
// Example 5: Check specific role requirements
// ============================================================================

export const RoleSpecificButton: React.FC = () => {
  const hasMinRole = useHasMinimumRole('engineer');

  if (!hasMinRole) {
    return null; // Don't show button for analysts
  }

  return <button>Upload BOM (Engineers only)</button>;
};

// ============================================================================
// Example 6: Multiple role checks
// ============================================================================

export const MultiRoleComponent: React.FC = () => {
  const userRole = useUserRole();
  const isAdmin = useIsAdmin();
  const isEngineer = useIsEngineer();

  return (
    <div>
      <h2>Dashboard (Role: {userRole})</h2>

      {/* All users see analytics */}
      <section>
        <h3>Analytics</h3>
        <p>BOM statistics available to all users</p>
      </section>

      {/* Engineers and above see quality queue */}
      {isEngineer && (
        <section>
          <h3>Quality Queue</h3>
          <p>Review and approve components</p>
        </section>
      )}

      {/* Admins only see settings */}
      {isAdmin && (
        <section>
          <h3>System Settings</h3>
          <p>Configure enrichment, rate limits, etc.</p>
        </section>
      )}
    </div>
  );
};

// ============================================================================
// Example 7: Resource-based access control
// ============================================================================

export const ResourceAccessExample: React.FC = () => {
  const canViewBOMs = useCanAccess('bom-list', 'list');
  const canUploadBOMs = useCanAccess('bom-upload', 'create');
  const canConfigureEnrichment = useCanAccess('enrichment-config', 'edit');

  return (
    <div>
      <h3>Resource Access</h3>
      {canViewBOMs && <button>View BOMs</button>}
      {canUploadBOMs && <button>Upload BOM</button>}
      {canConfigureEnrichment && <button>Configure Enrichment</button>}
    </div>
  );
};

// ============================================================================
// Example 8: Action-specific access control
// ============================================================================

export const BOMActionsExample: React.FC = () => {
  const canList = useCanAccess('bom-list', 'list'); // analyst+
  const canCreate = useCanAccess('bom-list', 'create'); // engineer+
  const canEdit = useCanAccess('bom-list', 'edit'); // engineer+
  const canDelete = useCanAccess('bom-list', 'delete'); // admin+

  return (
    <div>
      <h3>BOM Actions</h3>
      {canList && <button>View BOMs</button>}
      {canCreate && <button>Create BOM</button>}
      {canEdit && <button>Edit BOM</button>}
      {canDelete && <button>Delete BOM</button>}
    </div>
  );
};

// ============================================================================
// Example 9: Combining RoleContext with ProtectedRoute
// ============================================================================

export const CombinedExample: React.FC = () => {
  const { role, isLoading, error } = useRole();

  if (isLoading) {
    return <div>Loading role information...</div>;
  }

  if (error) {
    return <div>Error loading role: {error.message}</div>;
  }

  return (
    <div>
      <h2>Welcome, {role}</h2>

      <ProtectedRoute minRole="analyst">
        <section>All users see this</section>
      </ProtectedRoute>

      <ProtectedRoute minRole="engineer">
        <section>Engineers and above see this</section>
      </ProtectedRoute>

      <ProtectedRoute minRole="admin">
        <section>Admins and above see this</section>
      </ProtectedRoute>

      <ProtectedRoute minRole="super_admin">
        <section>Only super_admins see this</section>
      </ProtectedRoute>
    </div>
  );
};

// ============================================================================
// Example 10: Integration with React Admin resources
// ============================================================================

import { Resource } from 'react-admin';

export const ReactAdminResourceExample = () => {
  const isAdmin = useIsAdmin();
  const isEngineer = useIsEngineer();

  return (
    <>
      {/* All users can access BOMs */}
      <Resource name="boms" />

      {/* Engineers can access quality queue */}
      {isEngineer && <Resource name="quality-queue" />}

      {/* Admins can access settings */}
      {isAdmin && <Resource name="settings" />}
    </>
  );
};

// ============================================================================
// Example 11: Menu items based on role
// ============================================================================

export const MenuExample: React.FC = () => {
  const { hasMinRole } = useRole();

  const menuItems = [
    { label: 'Dashboard', path: '/', minRole: 'analyst' as const },
    { label: 'BOMs', path: '/boms', minRole: 'analyst' as const },
    { label: 'Upload', path: '/upload', minRole: 'engineer' as const },
    { label: 'Quality Queue', path: '/quality', minRole: 'engineer' as const },
    { label: 'Settings', path: '/settings', minRole: 'admin' as const },
    { label: 'Users', path: '/users', minRole: 'admin' as const },
    { label: 'Billing', path: '/billing', minRole: 'owner' as const },
  ];

  return (
    <nav>
      <ul>
        {menuItems.map(
          (item) =>
            hasMinRole(item.minRole) && (
              <li key={item.path}>
                <a href={item.path}>{item.label}</a>
              </li>
            )
        )}
      </ul>
    </nav>
  );
};

// ============================================================================
// Example 12: Programmatic access checks
// ============================================================================

export const ProgrammaticAccessExample: React.FC = () => {
  const { hasMinRole } = useRole();

  const handleAction = async () => {
    if (!hasMinRole('engineer')) {
      alert('You need engineer role to perform this action');
      return;
    }

    // Proceed with action
    console.log('Action performed');
  };

  return <button onClick={handleAction}>Perform Action</button>;
};
