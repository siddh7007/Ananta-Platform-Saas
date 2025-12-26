# Tenant Onboarding & User Invitation Flows

## Overview

This document provides comprehensive documentation of the end-to-end flows for:
1. **Tenant Onboarding** - From lead registration to fully provisioned tenant
2. **User Invitation** - From invitation creation to user access with roles

Both flows leverage **Temporal.io** for workflow orchestration with SAGA compensation patterns for automatic rollback on failures.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tenant Onboarding Flow](#tenant-onboarding-flow)
  - [Step 1: Lead Registration](#step-1-lead-registration)
  - [Step 2: Email Verification](#step-2-email-verification)
  - [Step 3: Tenant Creation](#step-3-tenant-creation)
  - [Step 4: Tenant Provisioning Workflow](#step-4-tenant-provisioning-workflow)
- [User Invitation Flow](#user-invitation-flow)
  - [Step 1: Create Invitation](#step-1-create-invitation)
  - [Step 2: Send Invitation Email](#step-2-send-invitation-email)
  - [Step 3: Accept Invitation](#step-3-accept-invitation)
  - [Step 4: Sync User Role Workflow](#step-4-sync-user-role-workflow)
- [Identified Bugs & Gaps](#identified-bugs--gaps)
- [Recommended Improvements](#recommended-improvements)
- [API Reference](#api-reference)
- [Sequence Diagrams](#sequence-diagrams)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CONTROL PLANE (arc-saas)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────────────┐  │
│  │ tenant-mgmt-svc  │    │ temporal-worker  │    │    Admin App      │  │
│  │   (LoopBack 4)   │◄──►│    (Temporal)    │    │   (React/Refine)  │  │
│  │    Port: 14000   │    │   Port: 27020    │    │   Port: 27555     │  │
│  └────────┬─────────┘    └────────┬─────────┘    └───────────────────┘  │
│           │                       │                                      │
│           ▼                       ▼                                      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                         PostgreSQL (arc_saas)                     │   │
│  │  - leads, tenants, subscriptions, users, invitations, resources   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │  Keycloak   │ │    Novu     │ │  Supabase   │
            │    (IdP)    │ │  (Emails)   │ │ (App Plane) │
            │ Port: 8180  │ │   API       │ │   API       │
            └─────────────┘ └─────────────┘ └─────────────┘
```

### Key Services

| Service | Purpose | Port |
|---------|---------|------|
| `tenant-management-service` | Core REST API for all operations | 14000 |
| `temporal-worker-service` | Workflow execution engine | Connects to 27020 |
| `admin-app` | Admin portal (React/Refine) | 27555 |
| Keycloak | Identity provider for SSO | 8180 |
| Novu | Email notifications | External |
| Supabase | App Plane user management | External |
| PostgreSQL | Primary database | 5432 |
| Redis | Token caching | 6379 |

---

## Tenant Onboarding Flow

### Step 1: Lead Registration

**Endpoint:** `POST /leads`

**Flow:**
```
User submits registration form
        │
        ▼
┌───────────────────────────────────────┐
│ LeadController.create()               │
│ - Validate email format               │
│ - Check for duplicate email           │
│ - Create Lead record                  │
│ - Create Address record               │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ LeadAuthenticator.triggerValidationMail()
│ - Generate JWT token with permissions │
│ - Generate random key (randomKey)     │
│ - Store {randomKey -> JWT} in Redis   │
│ - Send email via Novu                 │
└───────────────────────────────────────┘
        │
        ▼
User receives email with verification link
```

**Code Locations:**
- Controller: [lead.controller.ts](../arc-saas/services/tenant-management-service/src/controllers/lead.controller.ts)
- Service: [lead-authenticator.service.ts](../arc-saas/services/tenant-management-service/src/services/lead-authenticator.service.ts)
- Model: [lead.model.ts](../arc-saas/services/tenant-management-service/src/models/lead.model.ts)

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@company.com",
  "companyName": "Acme Corp",
  "country": "US"
}
```

**Response:**
```json
{
  "id": "uuid-of-lead",
  "email": "john@company.com",
  "isValidated": false,
  "validationToken": "abc123..." // Token for verification link
}
```

### Step 2: Email Verification

**Endpoint:** `GET /leads/verify?token={validationToken}`

**Flow:**
```
User clicks verification link
        │
        ▼
┌───────────────────────────────────────┐
│ LeadController.verifyEmail()          │
│ - Lookup token in Redis/memory        │
│ - Validate token not expired          │
│ - Extract JWT from token store        │
│ - Decode JWT to get leadId            │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ Update Lead.isValidated = true        │
│ - Return JWT for tenant creation      │
│ - Invalidate one-time token           │
└───────────────────────────────────────┘
        │
        ▼
User redirected to onboarding page with JWT
```

**Code Location:** [lead.controller.ts:128-180](../arc-saas/services/tenant-management-service/src/controllers/lead.controller.ts)

### Step 3: Tenant Creation

**Endpoint:** `POST /leads/{id}/tenants`

**Authentication:** `X-Lead-Token: {jwt}` (NOT Bearer JWT)

**Flow:**
```
User submits tenant details + plan selection
        │
        ▼
┌───────────────────────────────────────┐
│ LeadController.createTenantFromLead() │
│ - Authenticate via X-Lead-Token       │
│ - Validate lead is verified           │
│ - Validate planId exists              │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ OnboardingService.onboard()           │
│ - Create Tenant record                │
│ - Create Contact from Lead            │
│ - Create Subscription                 │
│ - Set tenant.status = PENDING         │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ ProvisioningService.provisionTenant() │
│ - Update status to PROVISIONING       │
│ - Generate HMAC webhook secret        │
│ - Publish TENANT_PROVISIONING event   │
│ - Store webhook context in Redis      │
└───────────────────────────────────────┘
        │
        ▼
Temporal Workflow triggered
```

**Code Locations:**
- Controller: [lead.controller.ts:194-280](../arc-saas/services/tenant-management-service/src/controllers/lead.controller.ts)
- Service: [onboarding.service.ts](../arc-saas/services/tenant-management-service/src/services/onboarding.service.ts)
- Provisioning: [provisioning.service.ts](../arc-saas/services/tenant-management-service/src/services/provisioning.service.ts)

**Request Body:**
```json
{
  "name": "Acme Corp",
  "key": "acmecorp",  // MAX 10 CHARACTERS
  "planId": "plan-basic",
  "domains": ["acme.example.com"]
}
```

### Step 4: Tenant Provisioning Workflow

**Workflow:** `provisionTenantWorkflow`

**Temporal Workflow ID:** `provision-tenant-{tenantId}`

**11-Step Provisioning Process with SAGA Compensation:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TENANT PROVISIONING WORKFLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Step 1: UPDATE STATUS TO PROVISIONING                                   │
│  ├─ Activity: updateTenantStatus('PROVISIONING')                        │
│  └─ Compensation: updateTenantStatus('PROVISION_FAILED')                │
│                                                                          │
│  Step 2: CREATE IDP ORGANIZATION (Keycloak Realm)                        │
│  ├─ Activity: createIdPOrganization()                                   │
│  │   - Create Keycloak realm: tenant-{key} OR use shared cbp-users      │
│  │   - Create application client                                        │
│  │   - Create admin user with temp password                             │
│  │   - Assign admin role                                                │
│  └─ Compensation: deleteIdPOrganization()                               │
│                                                                          │
│  Step 3: CREATE ADMIN USER IN IDP                                        │
│  ├─ Activity: (included in createIdPOrganization)                       │
│  └─ User receives password reset email from Keycloak                    │
│                                                                          │
│  Step 4: PROVISION DATABASE SCHEMA                                       │
│  ├─ Activity: provisionTenantSchema()                                   │
│  │   - Call: main.create_tenant_schema(tenant_key)                      │
│  │   - Creates: tenant_{key} schema with tables                         │
│  │   - Update tenant.schema_name                                        │
│  └─ Compensation: deprovisionTenantSchema()                             │
│                                                                          │
│  Step 5: PROVISION STORAGE (S3/MinIO)                                    │
│  ├─ Activity: provisionStorage()                                        │
│  │   - Create bucket: tenant-{key}-{env}                                │
│  │   - Configure CORS, versioning, encryption                           │
│  └─ Compensation: deleteStorage()                                       │
│                                                                          │
│  Step 6: PROVISION INFRASTRUCTURE (Silo/Bridge modes only)               │
│  ├─ Activity: provisionInfrastructure()                                 │
│  │   - Execute Terraform modules for isolated resources                 │
│  └─ Compensation: destroyInfrastructure()                               │
│                                                                          │
│  Step 7: DEPLOY APPLICATION                                              │
│  ├─ Activity: deployApplication()                                       │
│  │   - Deploy containerized app                                         │
│  │   - Configure environment variables                                  │
│  └─ Compensation: undeployApplication()                                 │
│                                                                          │
│  Step 8: CONFIGURE DNS                                                   │
│  ├─ Activity: configureDns()                                            │
│  │   - Create Route53/DNS records for tenant domains                    │
│  └─ Compensation: removeDnsRecords()                                    │
│                                                                          │
│  Step 9: CREATE RESOURCE RECORDS                                         │
│  ├─ Activity: createResources()                                         │
│  │   - Store IdP, storage, infra references in resources table          │
│  └─ Compensation: deleteResources()                                     │
│                                                                          │
│  Step 10: CREATE BILLING CUSTOMER (Stripe)                               │
│  ├─ Activity: createBillingCustomer()                                   │
│  │   - Create Stripe customer                                           │
│  │   - Link to subscription                                             │
│  └─ Compensation: deleteBillingCustomer()                               │
│                                                                          │
│  Step 11: PROVISION APP PLANE ORGANIZATION (Supabase)                    │
│  ├─ Activity: provisionAppPlaneOrganization()                           │
│  │   - Create organization in Supabase                                  │
│  │   - Sync admin user to App Plane                                     │
│  └─ Compensation: deleteAppPlaneOrganization()                          │
│                                                                          │
│  FINAL: UPDATE STATUS TO ACTIVE                                          │
│  └─ Activity: updateTenantStatus('ACTIVE')                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Code Location:** [provision-tenant.workflow.ts](../arc-saas/services/temporal-worker-service/src/workflows/provision-tenant.workflow.ts)

**SAGA Compensation Pattern:**
```typescript
// On failure, compensations run in REVERSE order
compensations: [
  { activity: 'deleteAppPlaneOrganization', input: {...} },
  { activity: 'deleteBillingCustomer', input: {...} },
  { activity: 'deleteResources', input: {...} },
  { activity: 'removeDnsRecords', input: {...} },
  { activity: 'undeployApplication', input: {...} },
  { activity: 'destroyInfrastructure', input: {...} },
  { activity: 'deleteStorage', input: {...} },
  { activity: 'deprovisionTenantSchema', input: {...} },
  { activity: 'deleteIdPOrganization', input: {...} },
]
```

---

## User Invitation Flow

### Step 1: Create Invitation

**Endpoint:** `POST /user-invitations`

**Authentication:** `Bearer {jwt}` (Admin/Owner with invite permissions)

**Flow:**
```
Admin creates invitation via API/UI
        │
        ▼
┌───────────────────────────────────────┐
│ UserInvitationsController.create()    │
│ - Validate caller has permission      │
│ - Validate email format               │
│ - Check for existing invitation       │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ InvitationService.createInvitation()  │
│ - Validate tenant exists              │
│ - Validate IdP config exists          │
│ - Generate secure token (32 bytes)    │
│ - Create UserInvitation record        │
│ - Set expiresAt (7 days default)      │
└───────────────────────────────────────┘
        │
        ▼
Temporal Workflow triggered: userInvitationWorkflow
```

**Code Locations:**
- Controller: [user-invitations.controller.ts](../arc-saas/services/tenant-management-service/src/controllers/user-invitations.controller.ts)
- Service: [invitation.service.ts](../arc-saas/services/tenant-management-service/src/services/invitation.service.ts)
- Model: [user-invitation.model.ts](../arc-saas/services/tenant-management-service/src/models/user-invitation.model.ts)

**Request Body:**
```json
{
  "email": "newuser@company.com",
  "roleId": "admin",
  "firstName": "Jane",
  "lastName": "Smith",
  "expiresAt": "2024-01-15T00:00:00Z"
}
```

### Step 2: Send Invitation Email

**Workflow:** `userInvitationWorkflow`

**Temporal Workflow ID:** `user-invitation-{invitationId}`

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    USER INVITATION WORKFLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Step 1: VALIDATE TENANT AND IDP CONFIG                                  │
│  ├─ Activity: validateTenantAndIdPConfig()                              │
│  │   - Verify tenant exists and is ACTIVE                               │
│  │   - Verify IdP organization exists                                   │
│  │   - Get tenant details for email template                            │
│  └─ On failure: Workflow fails with validation error                    │
│                                                                          │
│  Step 2: CREATE INVITATION RECORD                                        │
│  ├─ Activity: createInvitationRecord()                                  │
│  │   - Generate secure token                                            │
│  │   - Create invitation in database                                    │
│  │   - Set status = 'pending'                                           │
│  └─ Compensation: deleteInvitationRecord()                              │
│                                                                          │
│  Step 3: SEND INVITATION EMAIL                                           │
│  ├─ Activity: sendInvitationEmail()                                     │
│  │   - Call Novu API with 'user-invitation' template                    │
│  │   - Include: inviteLink, tenantName, roleName, inviterName           │
│  │   - Update invitation.status = 'sent'                                │
│  └─ Compensation: Mark invitation as failed                             │
│                                                                          │
│  Step 4: SYNC USER TO APP PLANE (Optional)                               │
│  ├─ Activity: syncUserToAppPlane()                                      │
│  │   - Pre-create user in Supabase (pending state)                      │
│  │   - This speeds up acceptance flow                                   │
│  └─ On failure: Log warning, continue (best effort)                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Code Location:** [user-invitation.workflow.ts](../arc-saas/services/temporal-worker-service/src/workflows/user-invitation.workflow.ts)

### Step 3: Accept Invitation

**Endpoint:** `POST /user-invitations/{token}/accept`

**Authentication:** Public endpoint (token is the auth)

**Flow:**
```
User clicks invitation link and submits acceptance
        │
        ▼
┌───────────────────────────────────────┐
│ UserInvitationsController.accept()    │
│ - Lookup invitation by token          │
│ - Validate token not expired          │
│ - Validate status is 'pending'/'sent' │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ InvitationService.acceptInvitation()  │
│ - Create user in Keycloak             │
│ - Assign role in Keycloak             │
│ - Create User record in database      │
│ - Create UserRole record              │
│ - Update invitation.status='accepted' │
│ - Invalidate token                    │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ Trigger syncUserRoleWorkflow          │
│ - Sync to App Plane (Supabase)        │
└───────────────────────────────────────┘
        │
        ▼
Send welcome email via Novu
```

**Code Location:** [invitation.service.ts:acceptInvitation()](../arc-saas/services/tenant-management-service/src/services/invitation.service.ts)

**Request Body:**
```json
{
  "password": "SecurePassword123!"
}
```

### Step 4: Sync User Role Workflow

**Workflow:** `syncUserRoleWorkflow`

**Temporal Workflow ID:** `sync-user-role-{userId}-{roleId}-{operation}`

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SYNC USER ROLE WORKFLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Operations: 'assign' | 'update' | 'revoke'                             │
│                                                                          │
│  For ASSIGN operation:                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Step 1: Validate user and role exist in Control Plane          │    │
│  │ Step 2: Get tenant's App Plane config from resources           │    │
│  │ Step 3: Call Supabase to create/update user                    │    │
│  │ Step 4: Assign role in Supabase (org-level or project-level)   │    │
│  │ Step 5: Update Control Plane sync status                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  For UPDATE operation:                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Step 1: Validate new role exists                                │    │
│  │ Step 2: Update role in Supabase                                 │    │
│  │ Step 3: Update Control Plane records                            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  For REVOKE operation:                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Step 1: Remove role from Supabase                               │    │
│  │ Step 2: Optionally deactivate user if no roles remain           │    │
│  │ Step 3: Update Control Plane records                            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Code Location:** [sync-user-role.workflow.ts](../arc-saas/services/temporal-worker-service/src/workflows/sync-user-role.workflow.ts)

---

## Identified Bugs & Gaps

### Critical Issues

| ID | Issue | Location | Severity | Status |
|----|-------|----------|----------|--------|
| BUG-001 | **Token not invalidated after use** - Lead tokens may be reused | `lead-authenticator.service.ts` | High | Fixed |
| BUG-002 | **Missing tenant isolation in some queries** - Potential data leak | Various controllers | High | Needs Review |
| BUG-003 | **Role not sent in user creation payload** - Role from form ignored | `users/create.tsx:72-83` | Medium | Open |

### Bug Details

#### BUG-003: Role Not Sent in Create User Payload

**Location:** [apps/admin-app/src/pages/users/create.tsx:72-83](../arc-saas/apps/admin-app/src/pages/users/create.tsx)

**Problem:** The `role` field from the form is collected but not included in the API request:

```typescript
// Current code - role is NOT sent
createUser({
  resource: "users",
  values: {
    email: formData.email,
    firstName: formData.firstName,
    lastName: formData.lastName,
    username: formData.username || formData.email.split("@")[0],
    tenantId: formData.tenantId,
    status: 1, // Active
    // Missing: role: formData.role
  },
});
```

**Fix Required:** Include role in the payload and ensure backend creates UserRole record.

---

### Gaps in Implementation

| ID | Gap | Description | Priority |
|----|-----|-------------|----------|
| GAP-001 | **No invitation expiry cleanup job** | Expired invitations remain in DB | Medium |
| GAP-002 | **Missing rate limiting on public endpoints** | DoS vulnerability on `/leads`, `/leads/verify` | High |
| GAP-003 | **No webhook signature validation** | Webhook callbacks not verified | High |
| GAP-004 | **Incomplete audit logging** | Not all operations logged | Medium |
| GAP-005 | **Missing email bounce handling** | No retry for failed emails | Low |
| GAP-006 | **No invitation resend cooldown** | Users can spam resend | Low |
| GAP-007 | **Tenant key validation too permissive** | Allows special chars that break schemas | Medium |
| GAP-008 | **Missing IdP user deactivation on role revoke** | User remains in Keycloak | Medium |

### Gap Details

#### GAP-001: No Invitation Expiry Cleanup

**Problem:** Expired invitations remain in the database indefinitely.

**Recommendation:** Add a scheduled job (cron or Temporal scheduled workflow) to:
1. Mark expired invitations as `status = 'expired'`
2. Optionally delete invitations older than 30 days

#### GAP-002: Missing Rate Limiting

**Problem:** Public endpoints vulnerable to abuse:
- `POST /leads` - Can create unlimited leads
- `GET /leads/verify` - Can enumerate tokens
- `POST /user-invitations/{token}/accept` - Can brute-force tokens

**Recommendation:** Add rate limiting middleware:
```typescript
// Example: 5 requests per minute per IP
@rateLimit({ windowMs: 60000, max: 5 })
@post('/leads')
async create() { ... }
```

#### GAP-007: Tenant Key Validation

**Problem:** Current validation allows characters that break PostgreSQL schema names.

**Current:** Accepts alphanumeric + some special chars
**Issue:** Schema names like `tenant_acme-corp` fail

**Recommendation:** Strict validation:
```typescript
const TENANT_KEY_REGEX = /^[a-z][a-z0-9]{2,9}$/;  // lowercase, start with letter, 3-10 chars
```

---

## Recommended Improvements

### High Priority

#### 1. Add Comprehensive Retry Configuration

**Current State:** Basic retry with exponential backoff

**Improvement:**
```typescript
// Enhanced retry with circuit breaker
const retryPolicy = {
  initialInterval: '1s',
  backoffCoefficient: 2,
  maximumInterval: '30s',
  maximumAttempts: 5,
  nonRetryableErrorTypes: [
    'InvalidConfigurationError',
    'ResourceNotFoundError',
    'InvalidCredentialsError',
  ],
};
```

#### 2. Add Workflow Visibility/Status API

**Current State:** Must check Temporal UI or logs

**Improvement:** Add endpoint to get provisioning status:
```
GET /tenants/{id}/provisioning-status
Response: {
  "status": "provisioning",
  "currentStep": "Creating database schema",
  "stepsCompleted": 4,
  "totalSteps": 11,
  "workflowId": "provision-tenant-xxx"
}
```

#### 3. Add Idempotency Keys

**Current State:** Duplicate requests create duplicate records

**Improvement:** Add idempotency key support:
```typescript
@post('/leads')
async create(
  @requestBody() dto: CreateLeadDto,
  @param.header('X-Idempotency-Key') idempotencyKey?: string,
) {
  if (idempotencyKey) {
    const existing = await this.idempotencyCache.get(idempotencyKey);
    if (existing) return existing;
  }
  // ... create logic
  await this.idempotencyCache.set(idempotencyKey, result, '24h');
}
```

### Medium Priority

#### 4. Improve Error Messages

**Current State:** Generic error messages

**Improvement:** Structured error responses:
```json
{
  "error": {
    "code": "TENANT_KEY_INVALID",
    "message": "Tenant key must be 3-10 lowercase alphanumeric characters",
    "field": "key",
    "details": {
      "provided": "ACME-Corp",
      "pattern": "^[a-z][a-z0-9]{2,9}$"
    }
  }
}
```

#### 5. Add Webhook Signature Validation

**Current State:** Webhooks not validated

**Improvement:**
```typescript
function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expected}`)
  );
}
```

#### 6. Add Bulk Invitation Support

**Current State:** One invitation at a time

**Improvement:** Add batch endpoint:
```
POST /user-invitations/batch
{
  "invitations": [
    { "email": "user1@example.com", "roleId": "member" },
    { "email": "user2@example.com", "roleId": "admin" }
  ]
}
```

### Low Priority

#### 7. Add Invitation Templates

Allow customization of invitation email content per tenant.

#### 8. Add Self-Service Password Reset

Currently relies on Keycloak's built-in flow.

#### 9. Add User Import from CSV

Bulk user creation from file upload.

---

## API Reference

### Lead Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/leads` | Public | Create new lead |
| `GET` | `/leads` | JWT | List all leads |
| `GET` | `/leads/{id}` | JWT | Get lead by ID |
| `GET` | `/leads/verify` | Public | Verify email with token |
| `POST` | `/leads/{id}/tenants` | Lead Token | Create tenant from lead |

### Tenant Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/tenants` | JWT | List tenants |
| `GET` | `/tenants/{id}` | JWT | Get tenant by ID |
| `GET` | `/tenants/by-key/{key}` | JWT | Get tenant by key |
| `POST` | `/tenants/{id}/provision` | JWT | Trigger provisioning |

### User Invitation Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/user-invitations` | JWT | Create invitation |
| `GET` | `/user-invitations` | JWT | List invitations |
| `GET` | `/user-invitations/by-token/{token}` | Public | Get invitation by token |
| `POST` | `/user-invitations/{token}/accept` | Public | Accept invitation |
| `POST` | `/user-invitations/{id}/resend` | JWT | Resend invitation email |
| `DELETE` | `/user-invitations/{id}` | JWT | Revoke invitation |

### User Management Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/users` | JWT | List users |
| `GET` | `/users/{id}` | JWT | Get user by ID |
| `POST` | `/users` | JWT | Create user directly |
| `PUT` | `/users/{id}` | JWT | Update user |
| `DELETE` | `/users/{id}` | JWT | Delete user |

### Role Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/roles` | JWT | List roles |
| `POST` | `/roles/assign` | JWT | Assign role to user |
| `DELETE` | `/roles/revoke` | JWT | Revoke role from user |

---

## Sequence Diagrams

### Tenant Onboarding Sequence

```
┌─────┐     ┌─────────┐     ┌─────────────┐     ┌────────┐     ┌─────────┐
│User │     │Admin App│     │Tenant Mgmt  │     │Temporal│     │Keycloak │
└──┬──┘     └────┬────┘     └──────┬──────┘     └───┬────┘     └────┬────┘
   │             │                 │                │               │
   │ Register    │                 │                │               │
   │────────────>│                 │                │               │
   │             │ POST /leads     │                │               │
   │             │────────────────>│                │               │
   │             │                 │──┐             │               │
   │             │                 │  │ Create Lead │               │
   │             │                 │<─┘             │               │
   │             │                 │ Send Email    │               │
   │             │                 │──────────────────────────────>│
   │             │ Lead ID + Token │                │               │
   │<────────────│<────────────────│                │               │
   │             │                 │                │               │
   │ Click Link  │                 │                │               │
   │────────────>│                 │                │               │
   │             │GET /leads/verify│                │               │
   │             │────────────────>│                │               │
   │             │     JWT Token   │                │               │
   │<────────────│<────────────────│                │               │
   │             │                 │                │               │
   │Submit Tenant│                 │                │               │
   │────────────>│                 │                │               │
   │             │POST /leads/{id}/tenants         │               │
   │             │────────────────>│                │               │
   │             │                 │ Start Workflow │               │
   │             │                 │───────────────>│               │
   │             │                 │                │ Create Realm  │
   │             │                 │                │──────────────>│
   │             │                 │                │    Created    │
   │             │                 │                │<──────────────│
   │             │                 │                │               │
   │             │                 │                │ [11 more steps]
   │             │                 │                │               │
   │             │ Tenant Created  │ Completed     │               │
   │<────────────│<────────────────│<──────────────│               │
   │             │                 │                │               │
```

### User Invitation Sequence

```
┌─────┐     ┌─────────┐     ┌─────────────┐     ┌────────┐     ┌────┐
│Admin│     │Admin App│     │Tenant Mgmt  │     │Temporal│     │Novu│
└──┬──┘     └────┬────┘     └──────┬──────┘     └───┬────┘     └─┬──┘
   │             │                 │                │            │
   │ Invite User │                 │                │            │
   │────────────>│                 │                │            │
   │             │POST /invitations│                │            │
   │             │────────────────>│                │            │
   │             │                 │──┐             │            │
   │             │                 │  │Create Record│            │
   │             │                 │<─┘             │            │
   │             │                 │ Start Workflow │            │
   │             │                 │───────────────>│            │
   │             │                 │                │ Send Email │
   │             │                 │                │───────────>│
   │             │                 │                │   Sent     │
   │             │                 │                │<───────────│
   │             │ Invitation ID   │ Completed     │            │
   │<────────────│<────────────────│<──────────────│            │
   │             │                 │                │            │

┌────────┐     ┌─────────┐     ┌─────────────┐     ┌────────┐
│New User│     │Invite UI│     │Tenant Mgmt  │     │Keycloak│
└───┬────┘     └────┬────┘     └──────┬──────┘     └───┬────┘
    │              │                 │                │
    │ Click Link   │                 │                │
    │─────────────>│                 │                │
    │              │GET /invitations/by-token/{token}│
    │              │────────────────>│                │
    │              │ Invitation Data │                │
    │<─────────────│<────────────────│                │
    │              │                 │                │
    │Set Password  │                 │                │
    │─────────────>│                 │                │
    │              │POST /invitations/{token}/accept │
    │              │────────────────>│                │
    │              │                 │ Create User   │
    │              │                 │───────────────>│
    │              │                 │    Created    │
    │              │                 │<───────────────│
    │              │                 │──┐            │
    │              │                 │  │Sync to App │
    │              │                 │<─┘ Plane      │
    │              │    Success     │                │
    │<─────────────│<────────────────│                │
    │              │                 │                │
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Database
TENANT_MGMT_SERVICE_DB_HOST=localhost
TENANT_MGMT_SERVICE_DB_PORT=5432
TENANT_MGMT_SERVICE_DB_DATABASE=arc_saas
TENANT_MGMT_SERVICE_DB_USER=postgres
TENANT_MGMT_SERVICE_DB_PASSWORD=postgres

# Temporal
TEMPORAL_ADDRESS=localhost:27020
TEMPORAL_NAMESPACE=arc-saas
TEMPORAL_TASK_QUEUE=tenant-provisioning

# Keycloak
KEYCLOAK_ENABLED=true
KEYCLOAK_URL=http://localhost:8180
KEYCLOAK_REALM=master
KEYCLOAK_ADMIN_USERNAME=admin
KEYCLOAK_ADMIN_PASSWORD=admin
USE_CBP_USERS_REALM=true  # Use shared realm for CBP

# Novu (Notifications)
NOVU_API_KEY=your-novu-api-key
NOVU_APP_ID=your-novu-app-id

# Lead Tokens
LEAD_KEY_LENGTH=36
VALIDATION_TOKEN_EXPIRY=3600000  # 1 hour in ms
WEBHOOK_SECRET_EXPIRY=86400000   # 24 hours in ms

# JWT
JWT_SECRET=your-jwt-secret
JWT_ISSUER=arc-saas
```

---

## Monitoring & Debugging

### Temporal UI

Access Temporal UI at http://localhost:27021

**Useful queries:**
- List all provisioning workflows: Filter by `provision-tenant-*`
- List failed workflows: Filter by status = `Failed`
- List running workflows: Filter by status = `Running`

### CLI Commands

```bash
# List workflows
temporal workflow list --namespace arc-saas --address localhost:27020

# Describe workflow
temporal workflow describe \
  --namespace arc-saas \
  --workflow-id "provision-tenant-xxx" \
  --address localhost:27020

# Terminate stuck workflow
temporal workflow terminate \
  --namespace arc-saas \
  --workflow-id "provision-tenant-xxx" \
  --reason "Manual termination" \
  --address localhost:27020
```

### Log Locations

| Service | Log Location |
|---------|-------------|
| tenant-management-service | stdout/stderr |
| temporal-worker-service | stdout/stderr + OTel traces |
| Keycloak | Docker logs |
| PostgreSQL | Docker logs |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01-XX | Initial documentation |

---

## Authors

- Platform Team

## References

- [SourceFuse ARC-SaaS Documentation](https://sourcefuse.github.io/arc-docs/)
- [Temporal.io Documentation](https://docs.temporal.io/)
- [LoopBack 4 Documentation](https://loopback.io/doc/en/lb4/)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
