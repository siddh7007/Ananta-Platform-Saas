# Tenant Onboarding Flow

This document describes the complete tenant onboarding flow from lead registration to fully provisioned tenant.

> **IMPLEMENTATION STATUS**: Fully implemented including App Plane sync.
> Organization sync uses dual approach in `provision-tenant.workflow.ts`:
> - Direct Supabase insertion via `supabase-app-plane.activities.ts`
> - Webhook notification to App Plane services

## Overview

The tenant onboarding process consists of four main phases:
1. **Lead Registration** - Prospect submits interest form
2. **Email Verification** - Lead verifies email address
3. **Tenant Creation** - Lead completes registration and creates tenant
4. **Tenant Provisioning** - Automated infrastructure provisioning via Temporal workflow (includes App Plane sync)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Lead Portal   │────▶│  Control Plane  │────▶│ Temporal Worker │
│   (Frontend)    │     │      API        │     │    Service      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                        │
                               ▼                        ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │   PostgreSQL    │     │    Keycloak     │
                        │   (arc_saas)    │     │      IdP        │
                        └─────────────────┘     └─────────────────┘
```

### Service Ports

| Service | Port | URL |
|---------|------|-----|
| Control Plane API | 14000 | http://localhost:14000 |
| Admin App (Frontend) | 27555 | http://localhost:27555 |
| Temporal UI | 27021 | http://localhost:27021 |
| PostgreSQL | 5432 | localhost:5432 |

### Keycloak Port Configuration

| Environment | URL | Port | When to Use |
|-------------|-----|------|-------------|
| Local dev (Bun/Node) | http://localhost:8180 | 8180 | Running services directly on host |
| Docker Compose | http://localhost:8180 | 8180 | Browser accessing Keycloak through Docker |
| Docker internal | http://keycloak:8080 | 8080 | Services inside Docker network |

**Note:** All local development (both direct and Docker) uses port 8180. Backend services inside Docker use the internal hostname `keycloak:8080`.

## Phase 1: Lead Registration

### Endpoint
```
POST /leads
```

### Request Body
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@company.com",
  "companyName": "Acme Corp"
}
```

### Process Flow
1. Validate input (email format, required fields)
2. Check for duplicate email (rate limit: 5 requests/minute)
3. Create lead record with status `new`
4. Generate secure verification token (36 chars, stored in Redis)
5. Send verification email via Novu

### Key Files
- Controller: `src/controllers/lead.controller.ts`
- Service: `src/services/onboarding.service.ts`
- Model: `src/models/lead.model.ts`

### Security Features
- Rate limiting on public endpoint (`@ratelimit()` decorator)
- Token stored in Redis with 24-hour expiry
- Email validation with regex pattern

---

## Phase 2: Email Verification

### Endpoint
```
GET /leads/verify?token={verificationToken}
```

### Process Flow
1. Validate token exists and hasn't expired
2. Look up lead by token in Redis
3. Update lead status from `new` to `verified`
4. Invalidate token (one-time use)
5. Return JWT-like lead token for tenant creation

### Response
```json
{
  "leadId": "uuid",
  "leadToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Email verified successfully"
}
```

### Security Features
- One-time token invalidation
- Token expiry (24 hours)
- Lead token for authenticated tenant creation

---

## Phase 3: Tenant Creation

### Endpoint
```
POST /leads/{leadId}/tenants
```

### Authentication
```
X-Lead-Token: {leadToken}
```
**Note:** This endpoint uses Lead Token authentication, NOT JWT Bearer token.

### Request Body
```json
{
  "name": "Acme Corporation",
  "key": "acmecorp",
  "planId": "plan-basic",
  "address": {
    "address": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94102",
    "country": "USA"
  }
}
```

### Validation Rules
| Field | Constraint |
|-------|-----------|
| `key` | Max 10 chars, alphanumeric only, unique |
| `name` | Required, max 100 chars |
| `planId` | Must be: `plan-basic`, `plan-standard`, or `plan-premium` |

### Process Flow
1. Validate lead token
2. Validate tenant data (key uniqueness, format)
3. Create tenant record with status `pending`
4. Create subscription record
5. Create admin user record (linked to lead)
6. Trigger provisioning workflow
7. Return tenant details

### Response
```json
{
  "id": "tenant-uuid",
  "name": "Acme Corporation",
  "key": "acmecorp",
  "status": "pending",
  "planId": "plan-basic"
}
```

---

## Phase 4: Tenant Provisioning (Temporal Workflow)

### Workflow ID Pattern
```
provision-tenant-{tenantId}
```

### Workflow: `provisionTenantWorkflow`

Located in: `temporal-worker-service/src/workflows/provision-tenant.workflow.ts`

### Workflow Steps

```
┌─────────────────────────────────────────────────────────────────┐
│                    Provision Tenant Workflow                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. ┌─────────────────────┐                                     │
│     │ Validate Tenant     │ Verify tenant exists, status=pending │
│     └──────────┬──────────┘                                     │
│                ▼                                                 │
│  2. ┌─────────────────────┐                                     │
│     │ Create IdP Org      │ Keycloak realm + admin user          │
│     └──────────┬──────────┘                                     │
│                ▼                                                 │
│  3. ┌─────────────────────┐                                     │
│     │ Create DB Schema    │ PostgreSQL schema for tenant         │
│     └──────────┬──────────┘                                     │
│                ▼                                                 │
│  4. ┌─────────────────────┐                                     │
│     │ Provision App Plane │ Create Supabase tenant database      │
│     └──────────┬──────────┘                                     │
│                ▼                                                 │
│  5. ┌─────────────────────┐                                     │
│     │ Update Status       │ Set tenant status = 'active'         │
│     └──────────┬──────────┘                                     │
│                ▼                                                 │
│  6. ┌─────────────────────┐                                     │
│     │ Send Welcome Email  │ Novu notification with login URL     │
│     └─────────────────────┘                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Activities

| Activity | Description | Retry Policy |
|----------|-------------|--------------|
| `createIdPOrganization` | Creates Keycloak realm and admin user | 5 attempts, exponential backoff |
| `createTenantSchema` | Creates PostgreSQL schema | 3 attempts |
| `provisionAppPlane` | Sets up Supabase tenant database | 5 attempts |
| `updateTenantStatus` | Updates Control Plane tenant status | 3 attempts |
| `sendWelcomeEmail` | Sends welcome notification | 2 attempts |

### Workflow Queries
```typescript
// Get provisioning status
const status = await handle.query(getProvisioningStatusQuery);
// Returns: { step: 'creating_idp', progress: 40, message: '...' }
```

### Error Handling
- Non-retryable errors: `ValidationError`, `TenantNotFoundError`
- Failed workflows trigger `sendProvisioningFailedEmail`
- Tenant status set to `failed` on unrecoverable errors

---

## Status Flow

```
Lead Status:
  new → verified → converted

Tenant Status:
  pending → provisioning → active
                        ↘ failed
```

## API Response Codes

| Code | Scenario |
|------|----------|
| 200 | Success |
| 201 | Created (lead, tenant) |
| 400 | Validation error |
| 401 | Invalid/missing authentication |
| 404 | Lead/tenant not found |
| 409 | Duplicate email/key |
| 422 | Validation failed (e.g., key > 10 chars) |
| 429 | Rate limit exceeded |

## Monitoring

### Temporal UI
- URL: http://localhost:27021
- Namespace: `arc-saas`
- View workflow history, status, and errors

### Workflow Commands
```bash
# List workflows
temporal workflow list --namespace arc-saas

# Show workflow history
temporal workflow show --namespace arc-saas --workflow-id "provision-tenant-{id}"

# Terminate stuck workflow
temporal workflow terminate --namespace arc-saas --workflow-id "provision-tenant-{id}"
```

## Plan Pricing Reference

| Plan ID | Monthly Price | Features |
|---------|--------------|----------|
| `plan-basic` | $29/month | Basic features |
| `plan-standard` | $79/month | Standard features |
| `plan-premium` | $199/month | All features |
