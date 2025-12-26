# RBAC Integration Guide - Step by Step

Complete step-by-step guide to integrate RBAC into the CNS Dashboard.

## Prerequisites

- [x] RBAC files created (see RBAC-FILES-SUMMARY.md)
- [ ] Keycloak authentication working
- [ ] React Admin app structure in place
- [ ] User authentication flow tested

## Integration Steps

### Step 1: Update App.tsx

Add RoleProvider and accessControlProvider to your main App component.

**File:** `src/App.tsx`

```tsx
import React from 'react';
import { Admin, Resource } from 'react-admin';
import { BrowserRouter } from 'react-router-dom';

// Import RBAC providers
import { RoleProvider } from './contexts/RoleContext';
import { TenantProvider } from './contexts/TenantContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeContextProvider } from './contexts/ThemeContext';

// Import auth and access control
import { keycloakAuthProvider } from './lib/keycloak';
import { accessControlProvider } from './lib/accessControlProvider';
import dataProvider from './dataProvider';

// Import your resources
import { BOMList, BOMEdit, BOMCreate, BOMShow } from './bom';
import { QualityQueue } from './quality';
import { AnalyticsDashboard } from './analytics';
import { SettingsPanel } from './settings';

function App() {
  return (
    <BrowserRouter>
      {/* STEP 1: Add RoleProvider - wraps entire app */}
      <RoleProvider>
        {/* Other providers */}
        <TenantProvider>
          <NotificationProvider>
            <ThemeContextProvider>
              {/* STEP 2: Add accessControlProvider to Admin */}
              <Admin
                authProvider={keycloakAuthProvider}
                dataProvider={dataProvider}
                accessControlProvider={accessControlProvider}
                title="CNS Dashboard"
              >
                {/* Your resources - access will be controlled automatically */}
                <Resource
                  name="boms"
                  list={BOMList}
                  edit={BOMEdit}
                  create={BOMCreate}
                  show={BOMShow}
                />
                <Resource
                  name="quality-queue"
                  list={QualityQueue}
                />
                <Resource
                  name="analytics"
                  list={AnalyticsDashboard}
                />
                <Resource
                  name="settings"
                  list={SettingsPanel}
                />
              </Admin>
            </ThemeContextProvider>
          </NotificationProvider>
        </TenantProvider>
      </RoleProvider>
    </BrowserRouter>
  );
}

export default App;
```

**Verification:**
```bash
# Check for console errors
# Should see: [RoleContext] Extracted roles: [...] highest: admin
```

---

### Step 2: Protect Sensitive Routes

Add ProtectedRoute wrappers to components that require specific roles.

**File:** `src/settings/SettingsPanel.tsx`

```tsx
import React from 'react';
import { ProtectedRoute } from '../components/ProtectedRoute';

export const SettingsPanel: React.FC = () => {
  return (
    <ProtectedRoute minRole="admin">
      <div>
        <h1>System Settings</h1>
        <p>Configure enrichment, rate limits, and system behavior.</p>
        {/* Settings content */}
      </div>
    </ProtectedRoute>
  );
};
```

**File:** `src/quality/QualityQueue.tsx`

```tsx
import React from 'react';
import { ProtectedRoute } from '../components/ProtectedRoute';

export const QualityQueue: React.FC = () => {
  return (
    <ProtectedRoute minRole="engineer">
      <div>
        <h1>Quality Review Queue</h1>
        <p>Review and approve component enrichment.</p>
        {/* Queue content */}
      </div>
    </ProtectedRoute>
  );
};
```

**Verification:**
- Login as `analyst` → should not see settings or quality queue
- Login as `engineer` → should see quality queue, not settings
- Login as `admin` → should see both

---

### Step 3: Update Navigation Menu

Make menu items role-aware.

**File:** `src/layout/Menu.tsx`

```tsx
import React from 'react';
import { Menu as RAMenu } from 'react-admin';
import { useRole } from '../contexts/RoleContext';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BOMIcon from '@mui/icons-material/Description';
import UploadIcon from '@mui/icons-material/Upload';
import QualityIcon from '@mui/icons-material/VerifiedUser';
import SettingsIcon from '@mui/icons-material/Settings';

export const Menu: React.FC = () => {
  const { hasMinRole } = useRole();

  return (
    <RAMenu>
      {/* All users */}
      <RAMenu.Item to="/" primaryText="Dashboard" leftIcon={<DashboardIcon />} />
      <RAMenu.Item to="/boms" primaryText="BOMs" leftIcon={<BOMIcon />} />

      {/* Engineers and above */}
      {hasMinRole('engineer') && (
        <>
          <RAMenu.Item to="/upload" primaryText="Upload BOM" leftIcon={<UploadIcon />} />
          <RAMenu.Item to="/quality-queue" primaryText="Quality Queue" leftIcon={<QualityIcon />} />
        </>
      )}

      {/* Admins and above */}
      {hasMinRole('admin') && (
        <RAMenu.Item to="/settings" primaryText="Settings" leftIcon={<SettingsIcon />} />
      )}
    </RAMenu>
  );
};
```

**Verification:**
- Menu items should show/hide based on logged-in user role
- Check developer console for role: `useRole().role`

---

### Step 4: Add Conditional Features

Use role hooks for feature toggles within components.

**File:** `src/bom/BOMList.tsx`

```tsx
import React from 'react';
import { List, Datagrid, TextField, DateField } from 'react-admin';
import { useHasRole } from '../components/ProtectedRoute';
import { CreateButton, EditButton, DeleteButton } from 'react-admin';

export const BOMList: React.FC = () => {
  const canCreate = useHasRole('engineer');
  const canEdit = useHasRole('engineer');
  const canDelete = useHasRole('admin');

  return (
    <List
      actions={
        <div>
          {canCreate && <CreateButton />}
        </div>
      }
    >
      <Datagrid>
        <TextField source="name" label="BOM Name" />
        <TextField source="status" label="Status" />
        <DateField source="created_at" label="Created" />

        {/* Edit button - engineers only */}
        {canEdit && <EditButton />}

        {/* Delete button - admins only */}
        {canDelete && <DeleteButton />}
      </Datagrid>
    </List>
  );
};
```

**Verification:**
- Analyst: sees list, no buttons
- Engineer: sees list, create/edit buttons
- Admin: sees list, all buttons

---

### Step 5: Update Header/User Menu

Show user role in header.

**File:** `src/layout/AppBar.tsx`

```tsx
import React from 'react';
import { AppBar as RAAppBar, UserMenu } from 'react-admin';
import { Typography } from '@mui/material';
import { useRole } from '../contexts/RoleContext';

const UserRoleBadge: React.FC = () => {
  const { getRoleName, role } = useRole();

  return (
    <Typography
      variant="body2"
      sx={{
        backgroundColor: getRoleColor(role),
        color: 'white',
        padding: '4px 12px',
        borderRadius: '12px',
        marginRight: 2,
      }}
    >
      {getRoleName()}
    </Typography>
  );
};

function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    super_admin: '#9c27b0', // purple
    owner: '#f44336',       // red
    admin: '#ff9800',       // orange
    engineer: '#2196f3',    // blue
    analyst: '#4caf50',     // green
  };
  return colors[role] || '#757575';
}

export const AppBar: React.FC = () => {
  return (
    <RAAppBar>
      <Typography variant="h6" sx={{ flex: 1 }}>
        CNS Dashboard
      </Typography>
      <UserRoleBadge />
      <UserMenu />
    </RAAppBar>
  );
};
```

**Verification:**
- User role badge appears in header
- Color matches role (purple for super_admin, etc.)

---

### Step 6: Resource-Based Access Control

Use `useCanAccess` for fine-grained access control.

**File:** `src/bom/BOMActions.tsx`

```tsx
import React from 'react';
import { useCanAccess } from '../lib/accessControlProvider';
import { Button } from '@mui/material';

interface BOMActionsProps {
  bomId: string;
}

export const BOMActions: React.FC<BOMActionsProps> = ({ bomId }) => {
  const canView = useCanAccess('bom-list', 'show');
  const canEdit = useCanAccess('bom-list', 'edit');
  const canDelete = useCanAccess('bom-list', 'delete');
  const canEnrich = useCanAccess('enrichment-monitor', 'create');

  return (
    <div>
      {canView && <Button>View Details</Button>}
      {canEdit && <Button>Edit</Button>}
      {canEnrich && <Button>Trigger Enrichment</Button>}
      {canDelete && <Button color="error">Delete</Button>}
    </div>
  );
};
```

**Verification:**
- Analyst: only "View Details"
- Engineer: "View Details", "Edit", "Trigger Enrichment"
- Admin: all buttons including "Delete"

---

### Step 7: Configure Resource Access

Update resource access rules in `accessControlProvider.ts` to match your needs.

**File:** `src/lib/accessControlProvider.ts`

```typescript
// Add/modify resource access rules
const RESOURCE_ACCESS: Record<string, AppRole> = {
  // Existing resources
  'analytics': 'analyst',
  'bom-list': 'analyst',
  'bom-upload': 'engineer',

  // Add your custom resources
  'supplier-management': 'admin',
  'api-keys': 'owner',
  'workflows': 'engineer',
  'reports': 'analyst',

  // ... etc
};

// Add action-specific overrides
const ACTION_ACCESS: Record<string, Partial<Record<string, AppRole>>> = {
  'workflows': {
    'list': 'analyst',    // View workflows
    'show': 'analyst',
    'create': 'engineer', // Create workflows
    'edit': 'engineer',
    'delete': 'admin',    // Delete workflows
  },
  // ... etc
};
```

**Verification:**
- Test each resource with different roles
- Check React Admin's `canAccess` calls in network tab

---

### Step 8: Add Role Info to Dashboard

Show role-specific welcome message.

**File:** `src/dashboard/Dashboard.tsx`

```tsx
import React from 'react';
import { useRole } from '../contexts/RoleContext';
import { Typography, Card, CardContent } from '@mui/material';

export const Dashboard: React.FC = () => {
  const { role, getRoleName, isAdmin, isEngineer } = useRole();

  return (
    <div>
      <Typography variant="h4" gutterBottom>
        Welcome, {getRoleName()}!
      </Typography>

      {/* All users */}
      <Card>
        <CardContent>
          <Typography variant="h6">Analytics</Typography>
          <p>View BOM statistics and enrichment metrics</p>
        </CardContent>
      </Card>

      {/* Engineers and above */}
      {isEngineer && (
        <Card>
          <CardContent>
            <Typography variant="h6">Engineering Tools</Typography>
            <p>Upload BOMs, manage components, review quality</p>
          </CardContent>
        </Card>
      )}

      {/* Admins and above */}
      {isAdmin && (
        <Card>
          <CardContent>
            <Typography variant="h6">Administration</Typography>
            <p>Manage settings, users, and system configuration</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
```

**Verification:**
- Dashboard shows different content based on role
- Welcome message includes role name

---

### Step 9: Error Handling

Add error handling for role loading failures.

**File:** `src/layout/Layout.tsx`

```tsx
import React from 'react';
import { Layout as RALayout } from 'react-admin';
import { useRole } from '../contexts/RoleContext';
import { CircularProgress, Alert } from '@mui/material';

export const Layout: React.FC = (props) => {
  const { isLoading, error } = useRole();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        <CircularProgress />
        <p>Loading user permissions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load user permissions: {error.message}
      </Alert>
    );
  }

  return <RALayout {...props} />;
};
```

**Verification:**
- App shows loading state while fetching roles
- Shows error if role extraction fails

---

### Step 10: Testing

Create a test user for each role in Keycloak.

#### Keycloak Setup

1. **Create Test Users**
   ```
   test-analyst@example.com    → role: analyst
   test-engineer@example.com   → role: engineer
   test-admin@example.com      → role: admin
   test-owner@example.com      → role: owner
   test-superadmin@example.com → role: super_admin
   ```

2. **Assign Roles**
   - Realm roles OR client roles (`cns-dashboard`)
   - Use any of the mapped role names (e.g., `staff` → `engineer`)

3. **Test Access**
   - Login as each user
   - Verify menu items show/hide
   - Verify protected routes redirect
   - Verify action buttons appear/disappear

#### Manual Test Checklist

| Role | Can View BOMs | Can Upload | Can Edit | Can Delete | Can Access Settings |
|------|---------------|------------|----------|------------|---------------------|
| analyst | ✅ | ❌ | ❌ | ❌ | ❌ |
| engineer | ✅ | ✅ | ✅ | ❌ | ❌ |
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| owner | ✅ | ✅ | ✅ | ✅ | ✅ |
| super_admin | ✅ | ✅ | ✅ | ✅ | ✅ |

#### Automated Testing

```bash
cd app-plane/services/cns-service/dashboard
npm test -- role-parser.test.ts
```

---

## Troubleshooting

### Issue: Roles not loading

**Check:**
1. Is Keycloak token valid? `console.log(getKeycloak().tokenParsed)`
2. Are roles in token? `console.log(parseRolesFromToken(token))`
3. Is RoleProvider wrapping app?

**Solution:**
```tsx
import { getKeycloak } from './lib/keycloak/keycloakConfig';
import { parseRolesFromToken, getHighestRole } from './lib/role-parser';

const token = getKeycloak().tokenParsed;
console.log('Token:', token);
console.log('Roles:', parseRolesFromToken(token));
console.log('Highest:', getHighestRole(parseRolesFromToken(token)));
```

### Issue: Access denied even with correct role

**Check:**
1. Is role mapped correctly? Check `KEYCLOAK_ROLE_MAPPINGS` in `role-parser.ts`
2. Is resource access configured? Check `RESOURCE_ACCESS` in `accessControlProvider.ts`
3. Is action access configured? Check `ACTION_ACCESS`

**Solution:**
Add console logging in `accessControlProvider.ts`:
```typescript
function checkAccess(resource: string, action?: string): boolean {
  const userRole = getCurrentUserRole();
  console.log('[AccessControl] Checking:', { resource, action, userRole });
  // ... rest of function
}
```

### Issue: Menu items not hiding

**Check:**
1. Is `useRole()` hook being used?
2. Is `hasMinRole()` function correct?

**Solution:**
```tsx
const { hasMinRole, role } = useRole();
console.log('Current role:', role);
console.log('Has engineer:', hasMinRole('engineer'));
```

### Issue: Protected routes showing "Access Denied" incorrectly

**Check:**
1. Is user authenticated? `getKeycloak().authenticated`
2. Is token valid? `getKeycloak().isTokenExpired()`
3. Is ProtectedRoute minRole correct?

**Solution:**
```tsx
<ProtectedRoute
  minRole="engineer"
  fallback={
    <div>
      <p>Your role: {useUserRole()}</p>
      <p>Required: engineer</p>
    </div>
  }
>
  {/* content */}
</ProtectedRoute>
```

---

## Verification Checklist

- [ ] RoleProvider wraps entire app
- [ ] accessControlProvider added to React Admin
- [ ] Protected routes have ProtectedRoute wrapper
- [ ] Menu items use `hasMinRole()` checks
- [ ] Action buttons use `useCanAccess()` or `useHasRole()`
- [ ] Dashboard shows role-specific content
- [ ] User role displayed in header
- [ ] Error handling for role loading failures
- [ ] Test users created in Keycloak
- [ ] Manual testing completed for each role
- [ ] Automated tests passing

---

## Next Steps

1. **Customize Resource Access**
   - Update `RESOURCE_ACCESS` in `accessControlProvider.ts`
   - Add action-specific overrides in `ACTION_ACCESS`
   - Test with different roles

2. **Add Backend Validation**
   - Ensure backend validates roles from JWT
   - Match frontend role names with backend
   - Add server-side permission checks

3. **Document User Roles**
   - Create user guide for each role
   - Document what each role can access
   - Add role descriptions to settings

4. **Monitor Access Patterns**
   - Add analytics for denied access attempts
   - Track which roles access which features
   - Optimize role configuration based on usage

---

## Additional Resources

- Full Documentation: `RBAC-IMPLEMENTATION.md`
- Usage Examples: `src/examples/RBACUsageExamples.tsx`
- Unit Tests: `src/lib/role-parser.test.ts`
- File Summary: `RBAC-FILES-SUMMARY.md`
- Platform Guide: `arc-saas/docs/CLAUDE.md`

## Support

If you encounter issues:
1. Check examples in `src/examples/RBACUsageExamples.tsx`
2. Review tests in `src/lib/role-parser.test.ts`
3. Consult platform-wide RBAC documentation
4. Check Keycloak role configuration
