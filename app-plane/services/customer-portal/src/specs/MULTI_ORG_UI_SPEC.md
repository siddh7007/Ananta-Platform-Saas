# Multi-Org UI Implementation Specification

## Overview

This document specifies the frontend components needed to support multi-organization functionality in the Customer Portal, aligned with PROMPT_CLAUDE.md Step 8 (Organization Admin & Governance).

---

## 1. organizationsApi.ts - API Client

### Purpose
Type-safe API client for `/api/organizations/*` endpoints.

### Location
`src/services/organizationsApi.ts`

### Types

```typescript
// Response types matching backend Pydantic models
interface Organization {
  id: string;
  name: string;
  slug: string | null;
  plan_type: 'free' | 'professional' | 'enterprise';
  role: 'owner' | 'admin' | 'engineer' | 'analyst' | 'viewer';
  joined_at: string | null;
  is_owner: boolean;
}

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string | null;
  plan_type: string;
  member_count: number;
  created_at: string;
  your_role: string;
}

interface Member {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  joined_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  invite_url: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// Request types
interface CreateOrganizationRequest {
  name: string;
  slug?: string;
}

interface InviteMemberRequest {
  email: string;
  role: 'admin' | 'engineer' | 'analyst' | 'viewer';
}

interface TransferOwnershipRequest {
  new_owner_user_id: string;
}
```

### Methods

| Method | Endpoint | Description |
|--------|----------|-------------|
| `getMyOrganizations(limit?, offset?)` | GET /api/organizations/me | Get user's orgs (paginated) |
| `createOrganization(data)` | POST /api/organizations | Create new org |
| `getOrganization(orgId)` | GET /api/organizations/{org_id} | Get org details |
| `updateOrganization(orgId, data)` | PATCH /api/organizations/{org_id} | Update org |
| `deleteOrganization(orgId)` | DELETE /api/organizations/{org_id} | Soft-delete org |
| `getMembers(orgId, limit?, offset?)` | GET /api/organizations/{org_id}/members | List members |
| `inviteMember(orgId, data)` | POST /api/organizations/{org_id}/invitations | Send invite |
| `removeMember(orgId, userId)` | DELETE /api/organizations/{org_id}/members/{user_id} | Remove member |
| `leaveOrganization(orgId)` | POST /api/organizations/{org_id}/leave | Leave org |
| `transferOwnership(orgId, data)` | POST /api/organizations/{org_id}/transfer-ownership | Transfer owner |
| `acceptInvitation(token)` | POST /api/organizations/invitations/{token}/accept | Accept invite |

---

## 2. OrganizationContext.tsx - React Context

### Purpose
Global state for current organization selection, with persistence to localStorage and user_preferences table.

### Location
`src/contexts/OrganizationContext.tsx`

### State Shape

```typescript
interface OrganizationContextState {
  // Current selection
  currentOrg: Organization | null;

  // All user's organizations
  organizations: Organization[];
  totalOrgs: number;

  // Loading states
  isLoading: boolean;
  isLoadingOrgs: boolean;

  // User's role in current org
  currentRole: string | null;

  // Permissions derived from role
  permissions: {
    canInvite: boolean;      // admin, owner
    canRemoveMembers: boolean; // admin, owner
    canEditOrg: boolean;     // admin, owner
    canDeleteOrg: boolean;   // owner only
    canTransferOwnership: boolean; // owner only
    canUploadBOM: boolean;   // engineer+
    canViewRisk: boolean;    // analyst+
  };
}

interface OrganizationContextActions {
  // Switch to a different org
  switchOrganization: (orgId: string) => Promise<void>;

  // Refresh organizations list
  refreshOrganizations: () => Promise<void>;

  // Create new org and switch to it
  createAndSwitch: (name: string, slug?: string) => Promise<Organization>;

  // Leave current org
  leaveCurrentOrg: () => Promise<void>;
}
```

### Persistence

1. **localStorage**: `current_organization_id` - immediate persistence
2. **user_preferences table**: `last_organization_id` - server-side persistence via API

### Initialization Flow

```
1. Check localStorage for current_organization_id
2. Fetch /api/organizations/me
3. If saved org exists in list → use it
4. Else if list.length > 0 → use first org
5. Else → currentOrg = null (prompt to create)
```

---

## 3. OrganizationSwitcher.tsx - Modal Component

### Purpose
Searchable modal for switching between organizations (Step 8 requirement: "searchable modal showing metrics per org").

### Location
`src/components/OrganizationSwitcher.tsx`

### UI Specification

```
┌─────────────────────────────────────────────────────┐
│  Switch Organization                            [X] │
├─────────────────────────────────────────────────────┤
│  [🔍 Search organizations...]                       │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐│
│  │ ★ Acme Corp                        Professional ││
│  │   owner • 12 members • 45 BOMs                  ││
│  ├─────────────────────────────────────────────────┤│
│  │   Beta Industries                         Free  ││
│  │   engineer • 3 members • 8 BOMs                 ││
│  ├─────────────────────────────────────────────────┤│
│  │   Gamma LLC                       Professional  ││
│  │   viewer • 25 members • 120 BOMs                ││
│  └─────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────┤
│  [+ Create New Organization]                        │
└─────────────────────────────────────────────────────┘
```

### Props

```typescript
interface OrganizationSwitcherProps {
  open: boolean;
  onClose: () => void;
  onSwitch?: (org: Organization) => void;
}
```

### Features

1. **Search**: Filter by org name (client-side for <100 orgs)
2. **Current org indicator**: Star icon on selected org
3. **Metrics per org**: Plan type, role, member count
4. **Create new**: Button to open CreateOrganizationDialog
5. **Keyboard navigation**: Arrow keys + Enter to select

---

## 4. Integration Points

### 4.1 cnsApi.ts Update

Current:
```typescript
const organizationId = localStorage.getItem('organization_id');
```

New:
```typescript
// Import from context or use a singleton
import { getCurrentOrganizationId } from '../contexts/OrganizationContext';

const organizationId = getCurrentOrganizationId();
```

### 4.2 App.tsx Integration

```tsx
// Wrap Admin in OrganizationProvider
<OrganizationProvider>
  <Admin ...>
    {/* existing resources */}
  </Admin>
</OrganizationProvider>
```

### 4.3 AppBar Integration

Add org switcher button to CustomAppBar:
```tsx
<IconButton onClick={() => setOrgSwitcherOpen(true)}>
  <BusinessIcon />
  <Typography>{currentOrg?.name || 'Select Org'}</Typography>
  <ExpandMoreIcon />
</IconButton>
```

---

## 5. Admin Console Page (Step 8)

### Location
`src/pages/AdminConsole.tsx`

### Route
`/admin/console`

### Sections

1. **Organization Overview**
   - Name, plan type, member count
   - Usage metrics (BOMs, alerts, API calls)
   - Plan limits with progress bars

2. **Pending Invitations**
   - List of pending invites
   - Resend/Revoke actions

3. **Recent Activity**
   - Audit log entries (last 50)
   - Filter by action type

4. **Billing Summary**
   - Current plan
   - Next billing date
   - Link to full billing page

---

## 6. OrganizationSettings Refactor

### Current
Single page for profile/security/API settings

### New Structure

```
/admin/organization-settings
├── Tab: Profile (existing)
├── Tab: Members (NEW)
│   ├── Member list with role badges
│   ├── Invite button → InviteMemberDialog
│   ├── Remove member action
│   └── Transfer ownership action (owner only)
├── Tab: Invitations (NEW)
│   ├── Pending invitations list
│   ├── Resend/Revoke actions
│   └── Invitation link copy
├── Tab: Security (existing)
└── Tab: API (existing)
```

---

## 7. Role-Based UI Visibility

| UI Element | owner | admin | engineer | analyst | viewer |
|------------|-------|-------|----------|---------|--------|
| Invite members | ✓ | ✓ | - | - | - |
| Remove members | ✓ | ✓ | - | - | - |
| Edit org profile | ✓ | ✓ | - | - | - |
| Delete organization | ✓ | - | - | - | - |
| Transfer ownership | ✓ | - | - | - | - |
| View members | ✓ | ✓ | ✓ | ✓ | ✓ |
| Upload BOM | ✓ | ✓ | ✓ | - | - |
| View risk dashboard | ✓ | ✓ | ✓ | ✓ | - |
| View alerts | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 8. Implementation Order

1. **organizationsApi.ts** - Foundation for all API calls
2. **OrganizationContext.tsx** - Global state management
3. **OrganizationSwitcher.tsx** - User-facing org selection
4. **Update cnsApi.ts** - Wire existing calls to context
5. **Update App.tsx** - Add provider and switcher to AppBar
6. **OrganizationSettings tabs** - Members and invitations
7. **AdminConsole.tsx** - Step 8 complete

---

## 9. Testing Plan

### Unit Tests
- `organizationsApi.test.ts` - API client methods
- `OrganizationContext.test.tsx` - Context state changes
- `OrganizationSwitcher.test.tsx` - Search, selection, keyboard nav

### Integration Tests
- Switch org → verify X-Organization-ID header changes
- Create org → verify appears in list
- Invite member → verify appears in pending

### E2E Tests (Playwright)
- Full flow: Login → Switch org → Upload BOM → Verify org-scoped
- Invite flow: Invite → Accept (different user) → Verify membership
