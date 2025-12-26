# RBAC Implementation - CNS Dashboard

Complete Role-Based Access Control (RBAC) implementation for the CNS Dashboard, integrated with Keycloak authentication and platform-wide role hierarchy.

## Overview

This RBAC system provides:
- **5-level role hierarchy** aligned across all platform portals
- **Keycloak JWT token integration** with automatic role extraction
- **React Admin access control** for resources and actions
- **Protected route components** for role-gated UI
- **Context-based role hooks** for conditional rendering
- **Comprehensive role utilities** for programmatic access checks

## Role Hierarchy

| Level | Role | Description | Access Level |
|-------|------|-------------|--------------|
| 5 | `super_admin` | Platform staff (Ananta employees) | Platform-wide access |
| 4 | `owner` | Organization owner | Billing, delete org, all admin functions |
| 3 | `admin` | Organization admin | User management, org settings |
| 2 | `engineer` | Technical user | Manage BOMs, components, specs |
| 1 | `analyst` | Read-only user | View data, reports (lowest privilege) |

**Role Inheritance**: Higher roles have all privileges of lower roles.
- `super_admin` can do everything `owner`, `admin`, `engineer`, and `analyst` can do
- `admin` can do everything `engineer` and `analyst` can do
- And so on...

## Keycloak Role Mappings

Multiple Keycloak roles map to each app role for backwards compatibility:

### super_admin
- `platform:super_admin`
- `platform-super-admin`
- `super-admin`, `superadmin`, `super_admin`
- `realm-admin`
- `platform_admin`

### owner
- `owner`
- `org-owner`, `organization-owner`
- `billing_admin`

### admin
- `platform:admin`
- `tenant-admin`
- `admin`, `administrator`
- `org_admin`, `org-admin`

### engineer
- `platform:engineer`
- `platform:staff`
- `engineer`, `staff`
- `developer`, `support`, `operator`

### analyst
- `analyst`
- `user`, `customer`
- `viewer`, `member`

## Files Created

### Core RBAC Files

| File | Purpose |
|------|---------|
| `src/lib/role-parser.ts` | Role extraction from Keycloak tokens, hierarchy utilities |
| `src/lib/accessControlProvider.ts` | React Admin access control provider |
| `src/components/ProtectedRoute.tsx` | Route/component protection with role checks |
| `src/contexts/RoleContext.tsx` | React context for role information |

### Supporting Files

| File | Purpose |
|------|---------|
| `src/lib/index.ts` | Barrel export for all lib modules |
| `src/contexts/index.ts` | Barrel export for all contexts |
| `src/lib/role-parser.test.ts` | Unit tests for role parser |
| `src/examples/RBACUsageExamples.tsx` | Comprehensive usage examples |
| `RBAC-IMPLEMENTATION.md` | This documentation file |

## Usage

### 1. Setup - Add Providers to App

```tsx
import React from 'react';
import { Admin, Resource } from 'react-admin';
import { RoleProvider } from './contexts/RoleContext';
import { TenantProvider } from './contexts/TenantContext';
import { keycloakAuthProvider } from './lib/keycloak';
import { accessControlProvider } from './lib/accessControlProvider';
import dataProvider from './dataProvider';

function App() {
  return (
    <RoleProvider>
      <TenantProvider>
        <Admin
          authProvider={keycloakAuthProvider}
          dataProvider={dataProvider}
          accessControlProvider={accessControlProvider}
        >
          {/* Your resources */}
        </Admin>
      </TenantProvider>
    </RoleProvider>
  );
}
```

### 2. Protect Routes with ProtectedRoute Component

```tsx
import { ProtectedRoute } from './components/ProtectedRoute';

// Protect entire routes
function AdminPanel() {
  return (
    <ProtectedRoute minRole="admin">
      <div>
        <h1>Admin Panel</h1>
        <p>Only admins and above can see this.</p>
      </div>
    </ProtectedRoute>
  );
}

// With custom fallback
function OwnerSettings() {
  return (
    <ProtectedRoute
      minRole="owner"
      fallback={<div>Contact your organization owner for access</div>}
    >
      <BillingSettings />
    </ProtectedRoute>
  );
}
```

### 3. Conditional Rendering with Role Hooks

```tsx
import { useRole, useHasMinimumRole } from './contexts/RoleContext';

function Dashboard() {
  const { role, isAdmin, isEngineer } = useRole();
  const canUpload = useHasMinimumRole('engineer');

  return (
    <div>
      <h1>Welcome, {role}</h1>

      {/* All users see this */}
      <AnalyticsSection />

      {/* Engineers and above */}
      {canUpload && <UploadButton />}

      {/* Engineers and above */}
      {isEngineer && <QualityQueue />}

      {/* Admins and above */}
      {isAdmin && <SystemSettings />}
    </div>
  );
}
```

### 4. Resource-Based Access Control

```tsx
import { useCanAccess } from './lib/accessControlProvider';

function BOMActions() {
  const canView = useCanAccess('bom-list', 'list');      // analyst+
  const canCreate = useCanAccess('bom-list', 'create');  // engineer+
  const canEdit = useCanAccess('bom-list', 'edit');      // engineer+
  const canDelete = useCanAccess('bom-list', 'delete');  // admin+

  return (
    <div>
      {canView && <button>View BOMs</button>}
      {canCreate && <button>Create BOM</button>}
      {canEdit && <button>Edit BOM</button>}
      {canDelete && <button>Delete BOM</button>}
    </div>
  );
}
```

### 5. Programmatic Access Checks

```tsx
import { hasMinimumRole, parseRolesFromToken, getHighestRole } from './lib/role-parser';
import { getKeycloak } from './lib/keycloak/keycloakConfig';

function handleAction() {
  const keycloak = getKeycloak();
  const token = keycloak.tokenParsed;

  if (!token) {
    alert('Not authenticated');
    return;
  }

  const roles = parseRolesFromToken(token);
  const userRole = getHighestRole(roles);

  if (!hasMinimumRole(userRole, 'engineer')) {
    alert('You need engineer role to perform this action');
    return;
  }

  // Proceed with action
  performAction();
}
```

### 6. Menu Configuration with Roles

```tsx
import { useRole } from './contexts/RoleContext';

function NavigationMenu() {
  const { hasMinRole } = useRole();

  const menuItems = [
    { label: 'Dashboard', path: '/', minRole: 'analyst' },
    { label: 'BOMs', path: '/boms', minRole: 'analyst' },
    { label: 'Upload', path: '/upload', minRole: 'engineer' },
    { label: 'Quality Queue', path: '/quality', minRole: 'engineer' },
    { label: 'Settings', path: '/settings', minRole: 'admin' },
    { label: 'Users', path: '/users', minRole: 'admin' },
    { label: 'Billing', path: '/billing', minRole: 'owner' },
  ];

  return (
    <nav>
      {menuItems.map(item =>
        hasMinRole(item.minRole) && (
          <MenuItem key={item.path} {...item} />
        )
      )}
    </nav>
  );
}
```

## Resource Access Configuration

Configured in `src/lib/accessControlProvider.ts`:

### Resource-Level Access

| Resource | Minimum Role | Feature |
|----------|--------------|---------|
| `analytics` | `analyst` | View analytics dashboard |
| `dashboard` | `analyst` | Main dashboard |
| `bom-list` | `analyst` | View BOMs |
| `bom-upload` | `engineer` | Upload BOMs |
| `component-search` | `analyst` | Search components |
| `component-catalog` | `engineer` | Manage component catalog |
| `enrichment-monitor` | `engineer` | Monitor enrichment jobs |
| `enrichment-config` | `admin` | Configure enrichment settings |
| `quality-queue` | `engineer` | Quality review queue |
| `supplier-apis` | `admin` | Manage supplier API integrations |
| `rate-limiting` | `admin` | Configure rate limits |
| `system-health` | `admin` | System health monitoring |
| `audit-logs` | `admin` | Access audit logs |
| `settings` | `admin` | System settings |
| `users` | `admin` | User management |
| `roles` | `owner` | Role management |
| `organizations` | `owner` | Organization management |

### Action-Level Access

Some resources have action-specific overrides:

```typescript
'bom-list': {
  'list': 'analyst',   // View BOMs
  'show': 'analyst',   // View BOM details
  'create': 'engineer', // Create new BOM
  'edit': 'engineer',   // Edit BOM
  'delete': 'admin',    // Delete BOM
}
```

## API Reference

### Role Parser (`src/lib/role-parser.ts`)

```typescript
// Types
type AppRole = 'super_admin' | 'owner' | 'admin' | 'engineer' | 'analyst';

// Functions
parseRolesFromToken(token: any): AppRole[]
getHighestRole(roles: AppRole[]): AppRole
hasMinimumRole(userRole: AppRole, requiredRole: AppRole): boolean

// Role checks
isSuperAdmin(role: AppRole): boolean
isOwner(role: AppRole): boolean
isAdmin(role: AppRole): boolean
isEngineer(role: AppRole): boolean
isAnalyst(role: AppRole): boolean

// Utilities
getRoleDisplayName(role: AppRole): string
getRoleLevel(role: AppRole): number  // 1-5
getRolesAtOrBelow(role: AppRole): AppRole[]
```

### Access Control Provider (`src/lib/accessControlProvider.ts`)

```typescript
// React Admin provider
accessControlProvider: AccessControlProvider

// Hooks
useCanAccess(resource: string, action?: string): boolean
useUserRole(): AppRole
useHasMinimumRole(requiredRole: AppRole): boolean
```

### Protected Route Component (`src/components/ProtectedRoute.tsx`)

```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  minRole: AppRole;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

// Component
<ProtectedRoute minRole="admin">
  {/* content */}
</ProtectedRoute>

// Hooks
useHasRole(minRole: AppRole): boolean

// HOC
withRoleProtection(Component, minRole: AppRole): React.FC
```

### Role Context (`src/contexts/RoleContext.tsx`)

```typescript
interface RoleContextType {
  role: AppRole;                    // User's highest role
  roles: AppRole[];                 // All assigned roles
  isLoading: boolean;               // Loading state
  error: Error | null;              // Error state
  hasMinRole: (minRole: AppRole) => boolean;
  isSuperAdmin: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isEngineer: boolean;
  getRoleName: () => string;
  getLevel: () => number;
  refresh: () => void;              // Refresh roles from token
}

// Hooks
useRole(): RoleContextType
useUserRole(): AppRole
useHasMinimumRole(minRole: AppRole): boolean
useIsSuperAdmin(): boolean
useIsAdmin(): boolean
useIsEngineer(): boolean
```

## Testing

Run the role parser tests:

```bash
cd app-plane/services/cns-service/dashboard
npm test -- role-parser.test.ts
```

## Common Patterns

### Pattern 1: Feature Flags Based on Role

```tsx
function FeatureToggles() {
  const { hasMinRole } = useRole();

  return (
    <div>
      {hasMinRole('engineer') && <AdvancedFeature />}
      {hasMinRole('admin') && <AdminFeature />}
      {hasMinRole('owner') && <BillingFeature />}
    </div>
  );
}
```

### Pattern 2: Conditional Navigation

```tsx
function AppRoutes() {
  const isAdmin = useIsAdmin();

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/boms" element={<BOMList />} />

      {isAdmin && (
        <Route path="/admin" element={<AdminPanel />} />
      )}
    </Routes>
  );
}
```

### Pattern 3: Action Buttons with Role Checks

```tsx
function ActionButtons({ bomId }) {
  const canEdit = useHasRole('engineer');
  const canDelete = useHasRole('admin');

  return (
    <div>
      <ViewButton bomId={bomId} />
      {canEdit && <EditButton bomId={bomId} />}
      {canDelete && <DeleteButton bomId={bomId} />}
    </div>
  );
}
```

### Pattern 4: Role-Based Data Filtering

```tsx
function BOMList() {
  const { role } = useRole();
  const { tenantId } = useTenant();

  // Super admins see all organizations
  // Others see only their organization
  const filter = role === 'super_admin'
    ? {}
    : { organization_id: tenantId };

  return <DataGrid filter={filter} />;
}
```

## Integration with Existing Code

### Update Keycloak Auth Provider

The existing `keycloakAuthProvider.ts` already has basic role support. The new RBAC system enhances it with:
- More granular role hierarchy (5 levels vs 3)
- Comprehensive Keycloak role mappings
- React Admin access control integration
- Context-based role management

### Update App.tsx

```tsx
import { RoleProvider } from './contexts/RoleContext';
import { accessControlProvider } from './lib/accessControlProvider';

// Wrap app with RoleProvider
<RoleProvider>
  <Admin
    authProvider={keycloakAuthProvider}
    accessControlProvider={accessControlProvider}
    // ... other props
  >
    {/* resources */}
  </Admin>
</RoleProvider>
```

## Security Considerations

1. **Client-Side Only**: This RBAC implementation is for UI/UX only. Always enforce permissions on the backend.

2. **Token Validation**: Roles are extracted from Keycloak JWT tokens. Ensure tokens are properly validated server-side.

3. **Default to Lowest Privilege**: If role cannot be determined, system defaults to `analyst` (lowest privilege).

4. **No Role = Analyst**: Users without any recognized role are treated as `analyst`.

5. **Role Refresh**: Roles are automatically refreshed when Keycloak token is refreshed.

## Troubleshooting

### Roles Not Loading

```tsx
const { role, isLoading, error } = useRole();

if (isLoading) return <div>Loading...</div>;
if (error) return <div>Error: {error.message}</div>;
```

### Check Token Roles

```tsx
import { getKeycloak } from './lib/keycloak/keycloakConfig';
import { parseRolesFromToken } from './lib/role-parser';

const keycloak = getKeycloak();
console.log('Token:', keycloak.tokenParsed);
console.log('Roles:', parseRolesFromToken(keycloak.tokenParsed));
```

### Verify Access Control

```tsx
import { useCanAccess } from './lib/accessControlProvider';

const canAccess = useCanAccess('my-resource', 'create');
console.log('Can access:', canAccess);
```

## Migration Guide

### From Old Role System

If you have existing role checks like:

```tsx
// OLD
if (user.role === 'admin' || user.role === 'super-admin') {
  // show admin features
}

// NEW
import { useIsAdmin } from './contexts/RoleContext';

const isAdmin = useIsAdmin();
if (isAdmin) {
  // show admin features
}
```

### From Hard-Coded Roles

```tsx
// OLD
const canUpload = ['admin', 'staff'].includes(user.role);

// NEW
import { useHasMinimumRole } from './contexts/RoleContext';

const canUpload = useHasMinimumRole('engineer');
```

## Best Practices

1. **Use Context Hooks**: Prefer `useRole()`, `useIsAdmin()` over direct token parsing
2. **Resource-Based**: Use `useCanAccess()` for resource/action checks
3. **Component-Level**: Use `<ProtectedRoute>` for entire route/component protection
4. **Fail-Safe**: Always default to lowest privilege (analyst) on errors
5. **Backend Enforcement**: Always validate permissions server-side
6. **Consistent Naming**: Use the 5 standard role names across the platform
7. **Test Edge Cases**: Test with no roles, multiple roles, legacy roles

## Related Files

- Control Plane RBAC: `arc-saas/apps/admin-app/src/lib/role-parser.ts`
- Customer Portal: Uses same role mappings
- Backstage Portal: Uses same role mappings
- Platform Documentation: `arc-saas/docs/CLAUDE.md` (Role Hierarchy section)

## Support

For questions or issues:
1. Check examples in `src/examples/RBACUsageExamples.tsx`
2. Review tests in `src/lib/role-parser.test.ts`
3. Consult platform-wide RBAC documentation in `arc-saas/docs/CLAUDE.md`
