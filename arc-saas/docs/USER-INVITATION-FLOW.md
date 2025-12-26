# User Invitation Flow

This document describes the complete user invitation flow for inviting users to a tenant and the role synchronization process.

> **IMPLEMENTATION STATUS**: Fully implemented with rate limiting enforced in `invitation.service.ts`:
> - 5-minute cooldown between resend attempts
> - Maximum 5 resends per invitation
> - Database tracking of all resend attempts

## Overview

The user invitation process enables tenant administrators to invite new users to their organization. It consists of three main phases:
1. **Create Invitation** - Admin creates invitation with role assignment
2. **Accept Invitation** - User accepts and creates account
3. **Role Synchronization** - Temporal workflow syncs role to App Plane

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Admin Portal  │────▶│  Control Plane  │────▶│ Temporal Worker │
│   (Frontend)    │     │      API        │     │    Service      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       ▼                       ▼
        │               ┌─────────────────┐     ┌─────────────────┐
        │               │   PostgreSQL    │     │    Keycloak     │
        │               │   (arc_saas)    │     │      IdP        │
        │               └─────────────────┘     └─────────────────┘
        │                                               │
        │                                               ▼
        │                                       ┌─────────────────┐
        └──────────────────────────────────────▶│  App Plane DB   │
                                                │   (Supabase)    │
                                                └─────────────────┘
```

## Phase 1: Create Invitation

### Endpoint
```
POST /user-invitations
Authorization: Bearer {JWT}
```

### Required Permissions
- `10320` (CreateUserInvitation)

### Request Body
```json
{
  "email": "newuser@company.com",
  "roleKey": "staff",
  "firstName": "Jane",
  "lastName": "Smith",
  "customMessage": "Welcome to our team!"
}
```

### Process Flow
1. Validate JWT and permissions
2. Check if email already has pending invitation (prevents duplicates)
3. Check if user already exists in tenant
4. Generate secure invitation token (36 chars)
5. Create invitation record with 7-day expiry
6. Send invitation email via Novu
7. Initialize tracking fields (`lastEmailSentAt`, `resendCount`)

### Response
```json
{
  "id": "invitation-uuid",
  "email": "newuser@company.com",
  "roleKey": "staff",
  "status": 0,
  "expiresAt": "2025-01-17T00:00:00.000Z",
  "token": "abc123..."
}
```

### Key Files
- Controller: `src/controllers/user-invitations.controller.ts`
- Service: `src/services/invitation.service.ts`
- Model: `src/models/user-invitation.model.ts`

### Invitation Status Codes
| Code | Status | Description |
|------|--------|-------------|
| 0 | Pending | Awaiting user acceptance |
| 1 | Accepted | User has created account |
| 2 | Expired | Past expiration date |
| 3 | Revoked | Cancelled by admin |

---

## Phase 2: Resend Invitation

### Endpoint
```
POST /user-invitations/{id}/resend
Authorization: Bearer {JWT}
```

### Rate Limiting (GAP-006)
- **Cooldown:** 5 minutes between resends
- **Max Resends:** 5 total resends per invitation

### Process Flow
1. Validate invitation exists and is pending
2. Check cooldown (5 minutes since last email)
3. Check resend limit (max 5)
4. Generate new token (optional)
5. Update `lastEmailSentAt` and increment `resendCount`
6. Send invitation email

### Error Responses
```json
// Cooldown active
{
  "error": "TooManyRequests",
  "message": "Please wait 3 minutes before resending"
}

// Max resends exceeded
{
  "error": "ResendLimitExceeded",
  "message": "Maximum resend limit (5) reached"
}
```

---

## Phase 3: Accept Invitation (Public Endpoint)

### Endpoint
```
GET /user-invitations/by-token/{token}
```
**Note:** This is a public endpoint - no authentication required.

### Process Flow
1. Validate token exists
2. Check invitation hasn't expired
3. Return invitation details for UI

### Endpoint
```
POST /user-invitations/{id}/accept
```

### Request Body
```json
{
  "password": "SecureP@ssw0rd!",
  "firstName": "Jane",
  "lastName": "Smith"
}
```

### Process Flow
1. Validate invitation is pending and not expired
2. Create user in Keycloak (IdP)
3. Create user record in Control Plane
4. Create user-role assignment
5. Update invitation status to `accepted`
6. Trigger `syncUserRoleWorkflow` to sync to App Plane
7. Return user details with login URL

### Response
```json
{
  "userId": "user-uuid",
  "email": "newuser@company.com",
  "tenantId": "tenant-uuid",
  "loginUrl": "https://app.example.com/login"
}
```

---

## Phase 4: Role Synchronization (Temporal Workflow)

### Workflow ID Pattern
```
sync-user-role-{tenantId}-{userId}-{timestamp}
```

### Workflow: `syncUserRoleWorkflow`

Located in: `temporal-worker-service/src/workflows/sync-user-role.workflow.ts`

### Supported Operations

| Operation | Description |
|-----------|-------------|
| `assign` | New role assignment (invitation accepted) |
| `update` | Role change (promotion/demotion) |
| `revoke` | Role removal (user deactivation) |

### Workflow Input
```typescript
interface SyncUserRoleInput {
  operation: 'assign' | 'update' | 'revoke';
  tenantId: string;
  tenantKey: string;
  userId: string;
  userEmail: string;
  firstName?: string;
  lastName?: string;
  keycloakUserId?: string;
  roleKey: string;
  previousRoleKey?: string;  // For updates
  performedBy: string;
  idpProvider?: 'keycloak' | 'auth0';  // For revoke operations
}
```

### Workflow Steps

#### Assign Operation
```
┌─────────────────────────────────────────────────────────────────┐
│                   Assign Role Workflow                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. ┌─────────────────────┐                                     │
│     │ Validate Input      │ Check required fields                │
│     └──────────┬──────────┘                                     │
│                ▼                                                 │
│  2. ┌─────────────────────┐                                     │
│     │ Create App Plane    │ Create/update user in Supabase       │
│     │      User           │ with role assignment                 │
│     └──────────┬──────────┘                                     │
│                ▼                                                 │
│  3. ┌─────────────────────┐                                     │
│     │ Complete            │ Return success with App Plane ID     │
│     └─────────────────────┘                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Revoke Operation (GAP-008)
```
┌─────────────────────────────────────────────────────────────────┐
│                   Revoke Role Workflow                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. ┌─────────────────────┐                                     │
│     │ Validate Input      │ Check required fields                │
│     └──────────┬──────────┘                                     │
│                ▼                                                 │
│  2. ┌─────────────────────┐                                     │
│     │ Revoke App Plane    │ Deactivate user in Supabase          │
│     │      Role           │                                      │
│     └──────────┬──────────┘                                     │
│                ▼                                                 │
│  3. ┌─────────────────────┐                                     │
│     │ Deactivate IdP User │ Disable user in Keycloak/Auth0       │
│     │   (if configured)   │ Prevents continued login             │
│     └──────────┬──────────┘                                     │
│                ▼                                                 │
│  4. ┌─────────────────────┐                                     │
│     │ Complete            │ Return success                       │
│     └─────────────────────┘                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Activities

| Activity | Description | Retry Policy |
|----------|-------------|--------------|
| `createAppPlaneUser` | Creates user in Supabase with role | 5 attempts |
| `updateAppPlaneUserRole` | Updates existing user's role | 5 attempts |
| `revokeAppPlaneUserRole` | Deactivates user membership | 5 attempts |
| `deactivateIdPUser` | Disables user in Keycloak/Auth0 | 2 attempts |

### Workflow Queries
```typescript
// Get sync status
const status = await handle.query(getRoleSyncStatusQuery);
// Returns: { step: 'syncing_user', progress: 50, operation: 'assign' }
```

---

## Invitation Cleanup (GAP-001)

### Scheduled Cleanup
The system periodically cleans up expired invitations:

```typescript
// Called by cron job or scheduled task
await invitationService.cleanupExpiredInvitations();
```

### Cleanup Process
1. Find all invitations where `expiresAt < NOW()` and `status = 0`
2. Update status to `2` (expired)
3. Log cleanup count

---

## Role Management Endpoints

### List User Roles
```
GET /roles
Authorization: Bearer {JWT}
```

### Assign Role
```
POST /roles
Authorization: Bearer {JWT}
```

### Update Role
```
PATCH /roles/{id}
Authorization: Bearer {JWT}
```

### Revoke Role
```
DELETE /roles/{id}
Authorization: Bearer {JWT}
```

All role changes trigger the `syncUserRoleWorkflow` to maintain consistency between Control Plane and App Plane.

---

## Security Features

### Token Security
- 36-character cryptographically secure tokens
- Minimum token length enforced in database (CHECK constraint)
- One-time use for acceptance

### Rate Limiting
- Resend cooldown: 5 minutes
- Max resends: 5 per invitation
- Rate limiting on public endpoints

### IdP Deactivation (GAP-008)
When revoking roles, users are also deactivated in the IdP:
- **Keycloak:** Sets `enabled: false`
- **Auth0:** Sets `blocked: true`

This prevents continued access via cached sessions.

---

## Database Schema

### user_invitations Table
```sql
CREATE TABLE main.user_invitations (
    id uuid PRIMARY KEY,
    email varchar(255) NOT NULL,
    token varchar(255) NOT NULL UNIQUE,
    role_key varchar(50) NOT NULL,
    invited_by uuid NOT NULL,
    tenant_id uuid NOT NULL,
    expires_at timestamptz NOT NULL,
    status smallint DEFAULT 0 NOT NULL,
    accepted_at timestamptz,
    accepted_by uuid,
    first_name varchar(100),
    last_name varchar(100),
    custom_message text,
    last_email_sent_at timestamptz,  -- GAP-006
    resend_count integer DEFAULT 0,   -- GAP-006
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP,
    modified_on timestamptz DEFAULT CURRENT_TIMESTAMP,
    deleted boolean DEFAULT FALSE
);
```

### Indexes
- `idx_user_invitations_email` - Fast email lookup
- `idx_user_invitations_token` - Token validation
- `idx_user_invitations_tenant_id` - Tenant filtering
- `idx_user_invitations_status` - Status + expiry queries
- `idx_user_invitations_last_email_sent` - Cooldown enforcement

---

## API Response Codes

| Code | Scenario |
|------|----------|
| 200 | Success |
| 201 | Invitation created |
| 400 | Validation error |
| 401 | Unauthorized |
| 403 | Insufficient permissions |
| 404 | Invitation not found |
| 409 | Email already invited/exists |
| 410 | Invitation expired |
| 429 | Rate limit / cooldown active |

---

## Monitoring

### Temporal UI
- URL: http://localhost:27021
- Namespace: `arc-saas`
- Filter by workflow type: `syncUserRoleWorkflow`

### Workflow Commands
```bash
# List role sync workflows
temporal workflow list --namespace arc-saas --query "WorkflowType='syncUserRoleWorkflow'"

# Show specific workflow
temporal workflow show --namespace arc-saas --workflow-id "sync-user-role-..."
```

---

## Role Keys Reference

| Role Key | Description | Permissions |
|----------|-------------|-------------|
| `super-admin` | Full system access | All permissions |
| `admin` | Tenant administration | Most permissions |
| `staff` | Standard user | Limited permissions |
| `viewer` | Read-only access | View only |
