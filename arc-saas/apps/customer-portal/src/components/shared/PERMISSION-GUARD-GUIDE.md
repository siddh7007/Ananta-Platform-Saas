# PermissionGuard System Guide

Complete guide for the role-based access control (RBAC) system in the CBP customer portal.

## Table of Contents

- [Overview](#overview)
- [Role Hierarchy](#role-hierarchy)
- [Permission Types](#permission-types)
- [Components](#components)
- [Hooks](#hooks)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Testing](#testing)

## Overview

The PermissionGuard system provides role-based and permission-based access control for UI rendering in the CBP customer portal. It consists of:

1. **Permission definitions** (`src/lib/permissions.ts`) - Role hierarchy and permission mappings
2. **usePermissions hook** (`src/hooks/usePermissions.ts`) - React hook for permission checks
3. **PermissionGuard component** (`src/components/shared/PermissionGuard.tsx`) - Declarative UI guards
4. **Convenience components** - Pre-configured guards for common use cases

## Role Hierarchy

The system implements a 5-level role hierarchy aligned with the control plane and admin app:

| Level | Role | Keycloak Roles | Description |
|-------|------|----------------|-------------|
| 5 | `super_admin` | `super_admin`, `platform:super_admin`, `realm-admin` | Platform staff with cross-org access |
| 4 | `owner` | `owner`, `org-owner`, `billing_admin` | Organization owner - billing, subscription |
| 3 | `admin` | `admin`, `tenant-admin`, `org_admin` | Organization admin - user management |
| 2 | `engineer` | `engineer`, `staff`, `developer` | Technical user - BOM/component management |
| 1 | `analyst` | `analyst`, `user`, `viewer`, `member` | Read-only access (lowest level) |

**Role Inheritance**: Higher roles inherit all permissions of lower roles.
Example: An `admin` can perform all `engineer` and `analyst` actions.

## Permission Types

Permissions follow the format `resource:action`. The system defines permissions for:

### BOM Operations
- `bom:create` - Create new BOMs (engineer+)
- `bom:read` - View BOMs (analyst+)
- `bom:update` - Edit BOMs (engineer+)
- `bom:delete` - Delete BOMs (admin+)
- `bom:export` - Export BOMs (analyst+)
- `bom:import` - Import BOMs (engineer+)
- `bom:share` - Share BOMs (engineer+)

### Component Operations
- `component:search` - Search components (analyst+)
- `component:compare` - Compare components (analyst+)
- `component:export` - Export component data (analyst+)
- `component:view_pricing` - View pricing data (analyst+)

### Team Management
- `team:view` - View team members (analyst+)
- `team:invite` - Invite team members (admin+)
- `team:manage` - Manage team members (admin+)
- `team:remove` - Remove team members (admin+)

### Billing & Subscription
- `billing:view` - View billing information (owner+)
- `billing:manage` - Manage billing (owner+)
- `subscription:view` - View subscription (owner+)
- `subscription:manage` - Manage subscription (owner+)

### Settings
- `settings:view` - View settings (engineer+)
- `settings:manage` - Manage settings (admin+)
- `settings:api_keys` - Manage API keys (admin+)
- `settings:integrations` - Manage integrations (admin+)

### Admin Operations
- `admin:access` - Access admin features (super_admin only)
- `admin:audit_logs` - View audit logs (super_admin only)
- `admin:platform_settings` - Manage platform settings (super_admin only)

## Components

### PermissionGuard

Main component for conditional rendering based on permissions or roles.

**Props:**
- `permission?: Permission` - Required permission (e.g., 'bom:create')
- `minRole?: AppRole` - Minimum role required (e.g., 'admin')
- `children: ReactNode` - Content to render if authorized
- `fallback?: ReactNode` - Content to render if not authorized (default: null)
- `showDenied?: boolean` - Show "no permission" message (default: false)
- `deniedMessage?: string` - Custom denied message

**Usage:**
```tsx
// Permission-based
<PermissionGuard permission="bom:create">
  <CreateBOMButton />
</PermissionGuard>

// Role-based
<PermissionGuard minRole="admin">
  <AdminPanel />
</PermissionGuard>

// With fallback
<PermissionGuard permission="billing:manage" fallback={<UpgradePrompt />}>
  <BillingDashboard />
</PermissionGuard>

// Show denied message
<PermissionGuard permission="bom:delete" showDenied>
  <DeleteButton />
</PermissionGuard>
```

### Role-Based Convenience Components

Pre-configured guards for common role checks:

```tsx
// Admin and above
<AdminOnly>
  <TeamManagement />
</AdminOnly>

// Owner and above
<OwnerOnly>
  <BillingSection />
</OwnerOnly>

// Engineer and above
<EngineerOnly>
  <BulkImport />
</EngineerOnly>

// Super admin only (exact match)
<SuperAdminOnly>
  <PlatformSettings />
</SuperAdminOnly>
```

### Permission-Based Convenience Components

Pre-configured guards for common permissions:

```tsx
// BOM operations
<CanCreateBOM>
  <button>Create BOM</button>
</CanCreateBOM>

<CanEditBOM>
  <button>Edit BOM</button>
</CanEditBOM>

<CanDeleteBOM>
  <button>Delete BOM</button>
</CanDeleteBOM>

// Team management
<CanManageTeam>
  <InviteButton />
</CanManageTeam>

// Billing
<CanAccessBilling>
  <BillingDashboard />
</CanAccessBilling>

// Settings
<CanManageSettings>
  <AdvancedSettings />
</CanManageSettings>
```

### withPermission HOC

Higher-order component for wrapping entire page components:

```tsx
const AdminPage = () => <div>Admin Content</div>;

const ProtectedAdminPage = withPermission(AdminPage, {
  minRole: 'admin',
  fallback: <AccessDeniedPage />
});

// Use in routes
<Route path="/admin" element={<ProtectedAdminPage />} />
```

## Hooks

### usePermissions

React hook for programmatic permission checks.

**Returns:**
```typescript
{
  role: AppRole;                           // Current user's role
  roleLabel: string;                       // Human-readable label
  roleDescription: string;                 // Role description
  hasPermission: (permission) => boolean;  // Check permission
  hasMinimumRole: (role) => boolean;       // Check minimum role
  can: (permission) => boolean;            // Alias for hasPermission
  is: (role) => boolean;                   // Exact role match
  isAtLeast: (role) => boolean;            // Alias for hasMinimumRole
  permissions: Permission[];               // All available permissions
  isAuthenticated: boolean;                // Auth status
}
```

**Usage:**
```tsx
function MyComponent() {
  const { can, isAtLeast, role, roleLabel } = usePermissions();

  // Check specific permission
  if (!can('bom:create')) {
    return <div>No permission to create BOMs</div>;
  }

  // Check minimum role
  const showAdminFeatures = isAtLeast('admin');

  // Check exact role
  const isOwner = role === 'owner';

  return (
    <div>
      <span className="badge">{roleLabel}</span>
      {showAdminFeatures && <AdminPanel />}
      {isOwner && <BillingSection />}
    </div>
  );
}
```

## Usage Examples

### Example 1: Navigation Menu

```tsx
function NavigationMenu() {
  const { isAtLeast } = usePermissions();

  return (
    <nav>
      {/* All users */}
      <NavLink to="/boms">My BOMs</NavLink>
      <NavLink to="/components">Components</NavLink>

      {/* Engineers and above */}
      {isAtLeast('engineer') && (
        <>
          <NavLink to="/bulk-import">Bulk Import</NavLink>
          <NavLink to="/advanced-search">Advanced Search</NavLink>
        </>
      )}

      {/* Admins and above */}
      <AdminOnly>
        <NavLink to="/team">Team</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </AdminOnly>

      {/* Owners only */}
      <OwnerOnly>
        <NavLink to="/billing">Billing</NavLink>
      </OwnerOnly>
    </nav>
  );
}
```

### Example 2: BOM Actions

```tsx
function BOMActions({ bom }: { bom: BOM }) {
  const { can } = usePermissions();

  return (
    <div className="flex gap-2">
      {/* All users can view/export */}
      <button onClick={() => viewBOM(bom)}>View</button>
      <button onClick={() => exportBOM(bom)}>Export</button>

      {/* Engineers can edit */}
      {can('bom:update') && (
        <button onClick={() => editBOM(bom)}>Edit</button>
      )}

      {/* Admins can delete */}
      {can('bom:delete') && (
        <button onClick={() => deleteBOM(bom)}>Delete</button>
      )}
    </div>
  );
}
```

### Example 3: Settings Page

```tsx
function SettingsPage() {
  const { can } = usePermissions();

  return (
    <div>
      {/* Engineers can view */}
      <PermissionGuard
        permission="settings:view"
        fallback={<AccessDenied />}
      >
        <GeneralSettings />

        {/* Admins can manage */}
        {can('settings:manage') && (
          <>
            <AdvancedSettings />
            <ApiKeyManagement />
            <IntegrationSettings />
          </>
        )}
      </PermissionGuard>
    </div>
  );
}
```

### Example 4: Conditional UI

```tsx
function Dashboard() {
  const { role, permissions, can } = usePermissions();

  return (
    <div>
      <header>
        <h1>Dashboard</h1>
        <span className="role-badge">{role}</span>
      </header>

      {/* Show different dashboards by role */}
      {role === 'analyst' && <AnalystDashboard />}
      {role === 'engineer' && <EngineerDashboard />}
      {role === 'admin' && <AdminDashboard />}
      {role === 'owner' && <OwnerDashboard />}

      {/* Conditional features */}
      {can('bom:create') && <QuickCreateBOM />}
      {can('billing:view') && <BillingWidget />}

      {/* Debug in development */}
      {import.meta.env.DEV && (
        <details>
          <summary>Available Permissions</summary>
          <ul>
            {permissions.map(p => <li key={p}>{p}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
```

## Best Practices

### 1. Use Declarative Guards When Possible

**Prefer:**
```tsx
<CanEditBOM>
  <EditButton />
</CanEditBOM>
```

**Over:**
```tsx
const { can } = usePermissions();
{can('bom:update') && <EditButton />}
```

### 2. Provide Meaningful Fallbacks

```tsx
// Good - explains why access is denied
<CanAccessBilling fallback={
  <div className="upgrade-prompt">
    <h3>Upgrade to Owner</h3>
    <p>Contact your organization owner for billing access</p>
  </div>
}>
  <BillingDashboard />
</CanAccessBilling>

// Bad - no context for user
<CanAccessBilling>
  <BillingDashboard />
</CanAccessBilling>
```

### 3. Use Permission-Based Guards for Actions

```tsx
// Good - checks specific permission
<PermissionGuard permission="bom:delete">
  <DeleteButton />
</PermissionGuard>

// Less specific - checks role level
<AdminOnly>
  <DeleteButton />
</AdminOnly>
```

### 4. Use Role-Based Guards for Sections

```tsx
// Good - sections are role-based
<AdminOnly>
  <div className="admin-section">
    <PermissionGuard permission="team:invite">
      <InviteButton />
    </PermissionGuard>
    <PermissionGuard permission="settings:manage">
      <SettingsLink />
    </PermissionGuard>
  </div>
</AdminOnly>
```

### 5. Handle Unauthenticated Users

```tsx
function ProtectedPage() {
  const { isAuthenticated, isAtLeast } = usePermissions();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (!isAtLeast('admin')) {
    return <AccessDenied />;
  }

  return <AdminContent />;
}
```

### 6. Don't Mix Permission and Role Props

```tsx
// Bad - confusing which check applies
<PermissionGuard permission="bom:create" minRole="admin">
  <Button />
</PermissionGuard>

// Good - use one or the other
<PermissionGuard permission="bom:create">
  <Button />
</PermissionGuard>
```

### 7. Log Permission Denials in Development

```tsx
const { can } = usePermissions();

const handleCreate = () => {
  if (!can('bom:create')) {
    if (import.meta.env.DEV) {
      console.warn('[Permission] User lacks bom:create permission');
    }
    toast.error('You do not have permission to create BOMs');
    return;
  }

  createBOM();
};
```

## Testing

### Unit Tests

Test the permission logic independently:

```typescript
import { hasMinimumRole, hasPermission } from '@/lib/permissions';

describe('Permission checks', () => {
  it('should allow engineers to create BOMs', () => {
    expect(hasPermission('engineer', 'bom:create')).toBe(true);
  });

  it('should not allow analysts to delete BOMs', () => {
    expect(hasPermission('analyst', 'bom:delete')).toBe(false);
  });
});
```

### Component Tests

Test permission guards with mocked auth context:

```tsx
import { render, screen } from '@testing-library/react';
import { AuthContext } from '@/contexts/AuthContext';
import { PermissionGuard } from '@/components/shared/PermissionGuard';

const mockAuthContext = (role: AppRole) => ({
  user: { id: '1', email: 'test@example.com', name: 'Test', role },
  isAuthenticated: true,
  // ... other required context values
});

test('shows content for authorized users', () => {
  render(
    <AuthContext.Provider value={mockAuthContext('admin')}>
      <PermissionGuard permission="bom:delete">
        <button>Delete</button>
      </PermissionGuard>
    </AuthContext.Provider>
  );

  expect(screen.getByText('Delete')).toBeInTheDocument();
});

test('hides content for unauthorized users', () => {
  render(
    <AuthContext.Provider value={mockAuthContext('analyst')}>
      <PermissionGuard permission="bom:delete">
        <button>Delete</button>
      </PermissionGuard>
    </AuthContext.Provider>
  );

  expect(screen.queryByText('Delete')).not.toBeInTheDocument();
});
```

### Integration Tests

Test permission flows end-to-end:

```tsx
test('analyst can view but not edit BOMs', async () => {
  // Login as analyst
  await loginAs('analyst');

  // Navigate to BOM page
  await navigateTo('/boms/123');

  // Should see view button
  expect(screen.getByText('View')).toBeInTheDocument();

  // Should not see edit button
  expect(screen.queryByText('Edit')).not.toBeInTheDocument();
});
```

## Troubleshooting

### User has role but permission check fails

**Cause**: Role not properly extracted from JWT token.

**Fix**: Check Keycloak role mappings in `src/config/auth.ts` and ensure the user's Keycloak role is mapped to the correct app role.

### Permission guard always hides content

**Cause**: User not authenticated or role defaults to 'analyst'.

**Fix**: Verify AuthContext is properly set up and JWT token contains role claims.

### TypeScript errors on permission names

**Cause**: Using a permission that doesn't exist in the Permission type.

**Fix**: Add the new permission to the Permission type in `src/lib/permissions.ts` and map it to a role in `PERMISSION_ROLES`.

---

## Related Files

- **Permissions logic**: `src/lib/permissions.ts`
- **Permission hook**: `src/hooks/usePermissions.ts`
- **Guard component**: `src/components/shared/PermissionGuard.tsx`
- **Auth config**: `src/config/auth.ts`
- **Auth context**: `src/contexts/AuthContext.tsx`
- **Examples**: `src/components/shared/PermissionGuard.example.tsx`
- **Tests**: `src/lib/permissions.test.ts`

## Support

For questions or issues with the permission system, contact the frontend development team or refer to the control plane RBAC documentation in `arc-saas/CLAUDE.md`.
