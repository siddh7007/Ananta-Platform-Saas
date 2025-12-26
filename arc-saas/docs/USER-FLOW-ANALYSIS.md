# User Flow Analysis: ARC-SaaS Control Plane + CBP Customer Portal

## Overview

This document analyzes the user journeys across both portals and identifies alignment gaps.

---

## Current User Journeys

### Journey 1: New Organization Registration (Admin Portal → CBP)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NEW ORGANIZATION REGISTRATION                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CBP Landing Page (/landing)                                                │
│       │                                                                     │
│       ▼                                                                     │
│  "Get Started" Button                                                       │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              ADMIN PORTAL (Control Plane)                            │   │
│  │                                                                      │   │
│  │  Step 1: Lead Registration (/register)                              │   │
│  │    - First Name, Last Name, Email, Company Name                     │   │
│  │    - Optional: Address                                              │   │
│  │    - API: POST /leads (Public, No Auth)                             │   │
│  │                                                                      │   │
│  │       │                                                              │   │
│  │       ▼                                                              │   │
│  │  Step 2: Email Verification (/register/verify)                      │   │
│  │    - User clicks email link with token                              │   │
│  │    - API: GET /leads/verify?token={token}                           │   │
│  │    - Lead marked as validated                                       │   │
│  │                                                                      │   │
│  │       │                                                              │   │
│  │       ▼                                                              │   │
│  │  Step 3: Tenant Onboarding (/register/onboard)                      │   │
│  │    - Organization Name, Tenant Key, Email Domains                   │   │
│  │    - API: POST /leads/{id}/tenants (Lead Token Auth)                │   │
│  │    - Tenant created with status: PENDINGPROVISION                   │   │
│  │                                                                      │   │
│  │       │                                                              │   │
│  │       ▼                                                              │   │
│  │  Step 4: Tenant Provisioning (Background)                           │   │
│  │    - API: POST /tenants/{id}/provision (Manual trigger)             │   │
│  │    - Temporal Workflow: provision-tenant                            │   │
│  │      ├─ Create Keycloak Realm                                       │   │
│  │      ├─ Create Admin User in Keycloak                               │   │
│  │      ├─ Provision Infrastructure                                    │   │
│  │      ├─ Send Welcome Email                                          │   │
│  │      └─ Create Subscription                                         │   │
│  │    - Tenant status: PENDINGPROVISION → PROVISIONING → ACTIVE        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼                                                                     │
│  Welcome Email Received                                                     │
│       │                                                                     │
│       ▼                                                                     │
│  User Clicks "Access Portal" Link                                          │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              CBP CUSTOMER PORTAL                                     │   │
│  │                                                                      │   │
│  │  Keycloak Login (cbp-users realm)                                   │   │
│  │       │                                                              │   │
│  │       ▼                                                              │   │
│  │  Organization Context Loads                                         │   │
│  │    - GET /api/organizations/me                                      │   │
│  │    - Fetch workspaces                                               │   │
│  │       │                                                              │   │
│  │       ▼                                                              │   │
│  │  Dashboard (Authenticated)                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Journey 2: Existing User Login

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXISTING USER LOGIN                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Option A: From CBP Landing Page                                            │
│  ─────────────────────────────────                                         │
│  CBP Landing Page (/landing)                                                │
│       │                                                                     │
│       ▼                                                                     │
│  "Sign In" Button                                                          │
│       │                                                                     │
│       ▼                                                                     │
│  Keycloak Login (CBP realm: cbp-users)                                     │
│       │                                                                     │
│       ▼                                                                     │
│  OIDC Callback (/authentication/callback)                                  │
│       │                                                                     │
│       ▼                                                                     │
│  Organization Context Loads                                                │
│       │                                                                     │
│       ▼                                                                     │
│  Dashboard                                                                  │
│                                                                             │
│  ───────────────────────────────────────────────────────────────────────── │
│                                                                             │
│  Option B: Direct CBP URL (Authenticated Users)                            │
│  ──────────────────────────────────────────────                            │
│  CBP URL (/)                                                               │
│       │                                                                     │
│       ▼                                                                     │
│  Auth Check (Valid Token?)                                                 │
│       │                                                                     │
│       ├─ Yes → Dashboard                                                   │
│       │                                                                     │
│       └─ No  → Redirect to /landing                                        │
│                                                                             │
│  ───────────────────────────────────────────────────────────────────────── │
│                                                                             │
│  Option C: Admin Portal Login                                              │
│  ────────────────────────────                                              │
│  Admin Portal URL (http://localhost:27555)                                 │
│       │                                                                     │
│       ▼                                                                     │
│  Landing Page → Sign In                                                    │
│       │                                                                     │
│       ▼                                                                     │
│  Keycloak Login (Admin realm: master or tenant-specific)                   │
│       │                                                                     │
│       ▼                                                                     │
│  Admin Dashboard (Tenant Management, Billing, etc.)                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Journey 3: User Invitation (Adding Team Members)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER INVITATION FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ADMIN/OWNER in CBP                                                         │
│       │                                                                     │
│       ▼                                                                     │
│  Team Page (/team)                                                         │
│       │                                                                     │
│       ▼                                                                     │
│  "Invite Member" Button                                                    │
│       │                                                                     │
│       ▼                                                                     │
│  Invite Modal                                                              │
│    - Email Address                                                         │
│    - Role: analyst | engineer | admin | owner                              │
│    - Optional: Welcome Message                                             │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              CONTROL PLANE (Backend)                                 │   │
│  │                                                                      │   │
│  │  API: POST /user-invitations                                        │   │
│  │    - Creates invitation with token                                  │   │
│  │    - Sets 7-day expiration                                          │   │
│  │    - Triggers email via Novu                                        │   │
│  │                                                                      │   │
│  │  Temporal Workflow: user-invitation                                 │   │
│  │    - Validate tenant is active                                      │   │
│  │    - Create user in Keycloak                                        │   │
│  │    - Assign role                                                    │   │
│  │    - Sync to App Plane (Supabase)                                   │   │
│  │    - Send welcome email                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼                                                                     │
│  INVITED USER receives email                                               │
│       │                                                                     │
│       ▼                                                                     │
│  Clicks Invitation Link                                                    │
│       │                                                                     │
│       ▼                                                                     │
│  CBP Invitation Accept Page (/invitations/{token})                         │
│    - If new user: Create Keycloak account                                  │
│    - If existing: Link to organization                                     │
│       │                                                                     │
│       ▼                                                                     │
│  API: POST /user-invitations/{token}/accept                                │
│       │                                                                     │
│       ▼                                                                     │
│  User logged in with assigned role                                         │
│       │                                                                     │
│       ▼                                                                     │
│  Dashboard (Organization context established)                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Alignment Gaps & Issues

### GAP 1: Keycloak Realm Mismatch

| Portal | Keycloak Realm | Issue |
|--------|---------------|-------|
| Admin Portal | `master` or tenant-specific | Uses admin realm for platform staff |
| CBP | `cbp-users` | Separate realm for customer users |

**Problem:**
- Admin portal users cannot access CBP without separate account
- Tenant provisioning creates users in tenant realm, not cbp-users
- No SSO across portals

**Recommendation:**
- Use single realm (`arc-saas`) for all users
- Differentiate access via client roles (admin-app, customer-portal)
- Or use realm federation for SSO

---

### GAP 2: Signup Flow Discontinuity

**Current Flow:**
1. User clicks "Get Started" on CBP Landing
2. Redirected to Admin Portal `/register`
3. Completes registration in Admin Portal context
4. Receives welcome email
5. Clicks link → Goes to... where?

**Problem:**
- No clear return path from Admin Portal to CBP after registration
- Welcome email link destination unclear
- User context lost between portals

**Recommendation:**
- Add `return_url` parameter to registration flow
- Welcome email should include CBP-specific link
- Post-registration redirect should go to CBP if initiated from CBP

---

### GAP 3: Tenant Provisioning Not Automatic

**Current Flow:**
1. Lead creates tenant via POST /leads/{id}/tenants
2. Tenant status = PENDINGPROVISION
3. **Manual trigger required:** POST /tenants/{id}/provision
4. Only then does Temporal workflow run

**Problem:**
- User waits indefinitely if provisioning not triggered
- No UI feedback that provisioning is pending
- Admin must manually provision (or automation missing)

**Recommendation:**
- Auto-trigger provisioning after tenant creation
- Or provide clear UI showing "Awaiting Setup" status
- Add webhook/callback when provisioning completes

---

### GAP 4: Organization Context Sync

**CBP expects:**
- `GET /api/organizations/me` returns user's organizations
- Each org has: id, name, slug, plan_type, role

**Control Plane provides:**
- Tenant created with minimal info
- User created in Keycloak
- No explicit organization record in App Plane DB

**Problem:**
- CBP's OrganizationContext calls App Plane (CNS/Supabase) API
- Control Plane creates tenants in its own database
- No sync between control plane tenants and app plane organizations

**Recommendation:**
- Temporal workflow should create organization in App Plane (Supabase)
- Sync tenant details: id, name, key, plan, owner
- Use same IDs across both planes for correlation

---

### GAP 5: Role Hierarchy Mismatch

**Admin Portal Roles:**
```
super_admin (5) → owner (4) → admin (3) → engineer (2) → analyst (1)
```

**CBP Roles (from organizationsApi):**
```
owner | admin | engineer | analyst | viewer | super_admin | billing_admin | member
```

**Problem:**
- `viewer` and `member` exist in CBP but not in admin portal
- `billing_admin` exists in CBP but not in admin portal
- Role mapping during invitation inconsistent

**Recommendation:**
- Standardize on 5-level hierarchy + special roles
- Map CBP roles to control plane roles consistently
- Remove redundant roles or document differences

---

### GAP 6: Invitation Flow Split

**Control Plane (Admin Portal):**
- `POST /user-invitations` - Creates invitation
- Stores in tenant-management-service database
- Triggers Temporal workflow

**App Plane (CBP via CNS):**
- `POST /api/organizations/{org_id}/invitations`
- Stores in Supabase
- No Temporal workflow connection

**Problem:**
- Two separate invitation systems
- Invitations in control plane don't sync to app plane
- CBP team page may not show invitations from control plane

**Recommendation:**
- Single source of truth for invitations
- Control plane creates, syncs to app plane
- Or CBP calls control plane API for invitations

---

### GAP 7: Missing Invitation Accept Page in CBP

**Required but missing:**
- `/invitations/{token}` page in CBP
- Logic to validate token, create/link user
- Redirect to dashboard after acceptance

**Current CBP pages:**
- No invitation accept page found
- Team page shows members but no accept flow

**Recommendation:**
- Create `src/pages/auth/AcceptInvitation.tsx`
- Add route `/invitations/:token`
- Implement token validation and user linking

---

## Recommended User Journey (Aligned)

### New Organization Registration

```
1. User visits CBP Landing Page (http://localhost:27100/landing)

2. Clicks "Get Started"
   → Redirects to Admin Portal with return_url=cbp

3. Admin Portal Registration (3-step)
   - Lead creation
   - Email verification
   - Tenant onboarding

4. Tenant Created + Auto-Provisioned
   - Temporal workflow triggers automatically
   - Creates Keycloak realm/user
   - Creates Organization in App Plane (Supabase)
   - Sends welcome email with CBP link

5. User clicks welcome email link
   → CBP login page

6. Keycloak SSO (single realm)
   → Authenticates user
   → Returns JWT with tenant/role claims

7. CBP Dashboard loads
   - OrganizationContext finds user's orgs
   - Default workspace created
   - User sees BOM management UI
```

### Invite Team Member

```
1. Admin/Owner in CBP Team Page

2. Clicks "Invite Member"
   - Enters email + role

3. CBP calls Control Plane API
   - POST /user-invitations
   - Control plane creates invitation
   - Triggers Temporal workflow

4. Temporal Workflow
   - Creates user in Keycloak (same realm)
   - Syncs user to App Plane (Supabase organization_members)
   - Sends invitation email

5. Invited user clicks email link
   → CBP /invitations/{token}

6. CBP validates token via Control Plane
   - POST /user-invitations/{token}/accept

7. User authenticates via Keycloak
   → Dashboard with organization context
```

---

## Implementation Checklist

### Immediate Fixes

- [x] **Add return_url to signup flow** (DONE)
  - CBP landing "Get Started" passes full URL including path
  - Admin Portal stores in both sessionStorage AND localStorage (cross-tab resilience)
  - Onboard page checks: URL param > sessionStorage > localStorage
  - Redirect after success intelligently handles paths vs origins
  - Storage cleaned up after successful redirect

- [ ] **Auto-trigger tenant provisioning**
  - In `onboard()` service method, call provision after tenant create
  - Or add flag `autoProvision: true` to request

- [x] **Create invitation accept page in CBP** (DONE)
  - New page: `src/pages/auth/AcceptInvitation.tsx`
  - Route: `/invitations/:token`
  - Validates token, handles expired/revoked states
  - Stores pending invitation in both sessionStorage AND localStorage
  - Supports both authenticated and unauthenticated acceptance flows

- [ ] **Sync organizations to App Plane**
  - Temporal activity: `createAppPlaneOrganization`
  - Creates record in Supabase `organizations` table
  - Maps control plane tenant ID to app plane org ID

### Storage Resilience Pattern (Applied)

Both flows now use **dual storage** for cross-tab/cross-session resilience:

```typescript
// Store in both for resilience
sessionStorage.setItem("key", value);  // Fast, same-tab
localStorage.setItem("key", value);    // Survives new tab

// Read with fallback
const value = sessionStorage.getItem("key")
  || localStorage.getItem("key");

// Clean up both on success
sessionStorage.removeItem("key");
localStorage.removeItem("key");
```

**Keys used:**
| Key | Storage | Purpose |
|-----|---------|---------|
| `returnUrl` | sessionStorage | Return URL for same-tab flow |
| `arc_saas_return_url` | localStorage | Return URL backup for new-tab |
| `cbp_signup_return_url` | localStorage | CBP-specific return URL |
| `pendingInvitationToken` | sessionStorage | Invitation token for same-tab |
| `cbp_pending_invitation` | localStorage | Invitation token backup |

### Medium-Term Alignment

- [ ] **Unify Keycloak realms**
  - Single `arc-saas` realm for all users
  - Client roles differentiate access (admin-app, cbp)
  - Realm-level roles for hierarchy (super_admin, owner, etc.)

- [ ] **Standardize role names**
  - Remove redundant: `viewer`, `member` → `analyst`
  - Keep special: `billing_admin` as separate permission set
  - Document role hierarchy in shared config

- [ ] **Unify invitation API**
  - CBP team page calls control plane `/user-invitations`
  - Control plane handles both storage and provisioning
  - App plane syncs via Temporal activities

---

## Configuration Alignment

### Environment Variables

| Variable | Admin Portal | CBP | Should Match? |
|----------|--------------|-----|---------------|
| `KEYCLOAK_URL` | http://localhost:8180 | http://localhost:8180 | Yes |
| `KEYCLOAK_REALM` | master | cbp-users | **NO - should unify** |
| `KEYCLOAK_CLIENT_ID` | admin-cli | cbp-client | Different clients OK |
| `API_URL` | http://localhost:14000 | Platform: 14000, CNS: varies | Separate backends OK |

### Database Tables Mapping

| Control Plane (PostgreSQL) | App Plane (Supabase) | Sync Required |
|---------------------------|----------------------|---------------|
| `tenants` | `organizations` | Yes |
| `users` | `organization_members` | Yes |
| `user_invitations` | (none) | Add sync |
| `subscriptions` | `organization_subscriptions` | Yes |

---

## Summary

The current implementation has **two parallel systems** (Control Plane + App Plane) that need better integration:

1. **Signup works** but user ends up in Admin Portal, not CBP
2. **Login works** independently in each portal (no SSO)
3. **Invitations work** but are split between two systems
4. **Organizations/Tenants** exist in both planes without sync

**Priority fixes:**
1. Return URL in signup flow
2. Auto-provisioning trigger
3. Organization sync to App Plane
4. Invitation accept page in CBP
