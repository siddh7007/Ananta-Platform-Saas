# Tenant Onboarding & Role System Audit Report

## Executive Summary

This document provides a comprehensive audit of the tenant onboarding flow, role system, and Keycloak integration across the Ananta Platform SaaS.

**Audit Date**: December 2024
**Status**: Role Unification Complete, Critical Issues Identified

---

## 1. Role System - UNIFIED (Complete)

### 5-Level Role Hierarchy

| Level | Role | Description | Access |
|-------|------|-------------|--------|
| 5 | `super_admin` | Platform staff (Ananta employees) | Platform-wide access |
| 4 | `owner` | Organization owner | Billing, delete org, all admin |
| 3 | `admin` | Organization admin | User management, org settings |
| 2 | `engineer` | Technical user | Manage BOMs, components, specs |
| 1 | `analyst` | Read-only user | View data, reports |

### Database Constraints - UNIFIED

All tables now use the same CHECK constraint:
```sql
CHECK (role IN ('super_admin', 'owner', 'admin', 'engineer', 'analyst'))
```

**Migration Applied**: `app-plane/database/migrations/014_unify_role_constraints.sql`

**Tables Updated**:
- `user_profiles.role`
- `users.role`
- `organization_memberships.role`
- `workspace_members.role`

### Keycloak Role Mapping

| Keycloak Role | App Role |
|---------------|----------|
| `platform:super_admin`, `super-admin`, `realm-admin` | `super_admin` |
| `owner`, `org-owner`, `billing_admin` | `owner` |
| `admin`, `tenant-admin`, `org_admin` | `admin` |
| `engineer`, `staff`, `developer` | `engineer` |
| `analyst`, `user`, `viewer`, `member` | `analyst` |

---

## 2. Test Credentials - VERIFIED

### Keycloak Test Users (ananta-saas realm)

| Username | Password | Role | Login Status |
|----------|----------|------|--------------|
| superadmin | Test123! | super_admin | OK |
| orgowner | Test123! | owner | OK |
| orgadmin | Test123! | admin | OK |
| engineer1 | Test123! | engineer | OK |
| analyst1 | Test123! | analyst | OK |
| cbpadmin | Test123! | super_admin (+ owner, admin) | OK |

### Token Verification

All users receive correct roles in JWT `realm_access.roles` claim.

---

## 3. Tenant Onboarding Flow

### Phase 1: Lead Creation
```
POST /leads (PUBLIC)
├── Input: firstName, lastName, email, companyName
├── Create Lead entity (isValidated: false)
├── Generate validation token (JWT + random key)
├── Store token in Redis with TTL
├── Send verification email via Novu
└── Return: {key, id}
```

### Phase 2: Email Verification
```
GET /leads/verify?token=xyz
├── Lookup token in Redis
├── Verify JWT signature
├── Update Lead: isValidated = true
├── Delete token (one-time use)
└── Return: {id, email, token}
```

### Phase 3: Tenant Creation
```
POST /leads/{id}/tenants (Auth: Lead Token)
├── Verify lead is validated
├── Create Contact (admin) from lead data
├── Create Tenant (status: PENDING_PROVISION)
├── Create default subscription (plan-basic)
├── Trigger Temporal provisioning workflow
└── Return: Tenant with relations
```

### Phase 4: Temporal Provisioning Workflow
```
Workflow: provisionTenantWorkflow
Task Queue: tenant-provisioning
Namespace: arc-saas

Activities (in order):
1. Update tenant status → PROVISIONING
2. Create IdP organization (Keycloak realm/user)
3. Create admin user in Keycloak
4. Provision database schema
5. Provision storage (MinIO)
6. Provision infrastructure (if silo tier)
7. Deploy application
8. Create resources in Control Plane
9. Update tenant status → ACTIVE
10. Create billing customer (Stripe)
11. Create subscription
12. Send welcome email
13. Sync to App Plane (Supabase)
```

---

## 4. Keycloak Integration

### Realm Strategy

**Two Options Available**:

| Option | Realm Name | Use Case |
|--------|------------|----------|
| Per-Tenant | `tenant-{key}` | Isolated tenants |
| Shared CBP | `cbp-users` or `ananta-saas` | Single sign-on |

**Current Config**: `USE_CBP_USERS_REALM=true` uses shared realm

### Client Configuration

| Client | Type | Purpose |
|--------|------|---------|
| admin-app | Confidential | Admin Portal |
| cbp-frontend | Public | Customer Portal |
| admin-cli | Public | Testing/CLI |

### Admin User Creation During Provisioning

```typescript
{
  username: contact.email,
  email: contact.email,
  enabled: true,
  credentials: [{
    type: 'password',
    value: tempPassword,
    temporary: true  // Forces reset on first login
  }],
  attributes: {
    tenantId: [tenantId],
    tenantKey: [tenantKey],
    role: ['owner']  // For CBP realm
  }
}
```

---

## 5. CRITICAL ISSUES IDENTIFIED

### Issue #1: Missing User/UserRole in Control Plane Database
**Severity**: CRITICAL
**File**: `onboarding.service.ts`
**Impact**: Lead cannot log into Control Plane after signup

**Problem**: When tenant is created from lead:
- Contact is created
- Keycloak user is created
- BUT no User or UserRole record in database

**Fix Required**:
```typescript
// After tenant creation, add:
const user = await this.userRepository.create({
  email: contact.email,
  firstName: contact.firstName,
  lastName: contact.lastName,
  tenantId: tenant.id
});

await this.userRoleRepository.create({
  userId: user.id,
  roleKey: 'owner',
  tenantId: tenant.id
});
```

### Issue #2: Missing 'owner' Role Fallback in CBP Realm
**Severity**: CRITICAL
**File**: `idp.activities.ts:377`
**Impact**: Admin has no permissions if 'owner' role missing

**Problem**:
```typescript
if (ownerRole) {
  await kc.users.addRealmRoleMappings({...});
} else {
  logger.warn('Owner role not found, skipping');  // Silent failure!
}
```

**Fix Required**: Create role if missing, or fail loudly

### Issue #3: No Plan Validation Before Provisioning
**Severity**: HIGH
**File**: `onboarding.service.ts:292`
**Impact**: Workflow fails with invalid plan

**Problem**:
```typescript
planId: dto.planId || 'plan-basic'  // No validation!
```

### Issue #4: Lead Token Excessive Permissions
**Severity**: HIGH
**File**: `lead-authenticator.service.ts:100-123`
**Impact**: Security risk - lead has billing permissions

**Problem**: Lead token grants 20+ permissions including:
- CreateBillingCustomer
- DeleteBillingInvoice
- Platform-level operations

### Issue #5: Tenant Status Race Condition
**Severity**: MEDIUM
**File**: `temporal-provisioning.service.ts`
**Impact**: Stuck in PROVISIONING state on failure

---

## 6. App Plane Synchronization

### Unified ID Strategy
**CRITICAL**: `organizations.id = Control Plane tenantId`

This ensures JWT claims with `tenant_id` work directly in Supabase RLS.

### Tables Created in App Plane (Supabase)

| Table | Key Fields |
|-------|------------|
| `organizations` | id (= tenantId), key, name, plan_id |
| `users` | email, organization_id, keycloak_user_id |
| `organization_memberships` | user_id, organization_id, role |

### Sync Methods

1. **Webhook Method**: Workflow sends POST to webhook bridge
2. **Direct Supabase Method**: Workflow inserts directly via Supabase client

---

## 7. Current Test Results

### Authentication Test Results

| User | Login | Roles in Token | Expected | Match |
|------|-------|----------------|----------|-------|
| superadmin | OK | super_admin | super_admin | OK |
| orgowner | OK | owner | owner | OK |
| orgadmin | OK | admin | admin | OK |
| engineer1 | OK | engineer | engineer | OK |
| analyst1 | OK | analyst | analyst | OK |
| cbpadmin | OK | owner,super_admin,admin | super_admin | OK |

### API Access Test Results

| User | /workspaces | /projects | /admin/boms |
|------|-------------|-----------|-------------|
| cbpadmin | 200 | 422* | 403 |
| Others | 500** | 500** | 403 |

*422 = Missing workspace_id parameter
**500 = Missing organization_id for new users (not seeded in DB)

---

## 8. Recommended Fixes

### Priority 1: Create User/UserRole During Onboarding

**File**: `arc-saas/services/tenant-management-service/src/services/onboarding.service.ts`

Add after line 260 (after tenant creation):
```typescript
// Create User record for admin contact
const adminUser = await this.userRepository.create({
  email: adminContact.email,
  firstName: adminContact.firstName,
  lastName: adminContact.lastName,
  tenantId: tenant.id,
  defaultTenantId: tenant.id
});

// Assign owner role
await this.userRoleRepository.create({
  userId: adminUser.id,
  roleKey: 'owner',
  tenantId: tenant.id
});
```

### Priority 2: Ensure CBP Roles Exist

**File**: `arc-saas/services/temporal-worker-service/src/activities/idp.activities.ts`

Add role creation before assignment:
```typescript
const requiredRoles = ['super_admin', 'owner', 'admin', 'engineer', 'analyst'];
for (const roleName of requiredRoles) {
  const exists = availableRealmRoles.find(r => r.name === roleName);
  if (!exists) {
    await kc.roles.create({ realm: realmName, name: roleName });
  }
}
```

### Priority 3: Validate Plan Before Provisioning

**File**: `arc-saas/services/tenant-management-service/src/services/onboarding.service.ts`

Add before line 292:
```typescript
const planId = dto.planId || 'plan-basic';
const plan = await this.planRepository.findById(planId);
if (!plan) {
  throw new HttpErrors.BadRequest(`Invalid plan: ${planId}`);
}
```

---

## 9. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CONTROL PLANE (Port 14000)                       │
├─────────────────────────────────────────────────────────────────────────┤
│  tenant-management-service                                              │
│  ├── Lead Controller (POST /leads, GET /leads/verify)                   │
│  ├── Tenant Controller (POST /tenants, POST /leads/{id}/tenants)        │
│  ├── Onboarding Service (lead validation, tenant creation)              │
│  └── Temporal Provisioning Service (workflow orchestration)             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     TEMPORAL (Port 27020/27021)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Namespace: arc-saas                                                    │
│  Task Queue: tenant-provisioning                                        │
│  Workflow: provisionTenantWorkflow                                      │
│  ├── IdP Activities (Keycloak realm/user creation)                      │
│  ├── Tenant Activities (DB schema, status updates)                      │
│  ├── Storage Activities (MinIO bucket)                                  │
│  ├── Billing Activities (Stripe customer/subscription)                  │
│  └── App Plane Activities (Supabase sync)                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│  KEYCLOAK (8180)     │ │  APP PLANE (27xxx)   │ │  STRIPE/BILLING      │
├──────────────────────┤ ├──────────────────────┤ ├──────────────────────┤
│  Realm: ananta-saas  │ │  Supabase DB: 27432  │ │  Customer creation   │
│  Clients:            │ │  CNS Service: 27200  │ │  Subscription mgmt   │
│  - admin-app         │ │  Customer Portal:    │ │                      │
│  - cbp-frontend      │ │    27100             │ │                      │
│  - admin-cli         │ │                      │ │                      │
│  Roles: 5-level      │ │  Tables:             │ │                      │
│  hierarchy           │ │  - organizations     │ │                      │
│                      │ │  - users             │ │                      │
│                      │ │  - workspaces        │ │                      │
│                      │ │  - projects          │ │                      │
│                      │ │  - boms              │ │                      │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘
```

---

## 10. Files Reference

### Key Configuration Files

| File | Purpose |
|------|---------|
| `keycloak_setup.py` | Keycloak realm setup with unified roles |
| `keycloak_fix_roles_in_token.py` | Fix roles appearing in JWT |
| `seed_and_verify.py` | Database seeding script |
| `test_role_auth.py` | Authentication test script |
| `014_unify_role_constraints.sql` | Database role migration |

### Service Files

| File | Purpose |
|------|---------|
| `onboarding.service.ts` | Lead-to-tenant conversion |
| `idp.activities.ts` | Keycloak provisioning activities |
| `provision-tenant.workflow.ts` | Main provisioning workflow |
| `role-parser.ts` | Frontend role extraction |

---

## 11. Next Steps

1. [ ] Apply Priority 1 fix (User/UserRole creation)
2. [ ] Apply Priority 2 fix (CBP role creation)
3. [ ] Apply Priority 3 fix (Plan validation)
4. [ ] End-to-end test full onboarding flow
5. [ ] Update TEST_CREDENTIALS.md with simplified documentation
6. [ ] Document password reset flow for new tenants

---

**Document Version**: 1.0
**Last Updated**: December 2024
