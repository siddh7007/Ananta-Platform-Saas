# Ananta Platform SaaS - API Specification

This document covers the Control Plane (ARC SaaS) REST API specification.

**Base URL**: `http://localhost:14000`

## Table of Contents
- [Authentication](#authentication)
- [Leads API](#leads-api)
- [Tenants API](#tenants-api)
- [Subscriptions API](#subscriptions-api)
- [Plans API](#plans-api)
- [Users API](#users-api)
- [Invitations API](#invitations-api)
- [Workflows API](#workflows-api)
- [Error Responses](#error-responses)
- [Validation Rules](#validation-rules)

---

## Authentication

### JWT Token Authentication
Most endpoints require a JWT Bearer token:
```
Authorization: Bearer {JWT_TOKEN}
```

### JWT Token Structure
```json
{
  "id": "user-uuid",
  "userTenantId": "tenant-uuid",
  "tenantId": "tenant-uuid",
  "permissions": ["10200", "10204", ...],
  "email": "user@example.com",
  "iat": 1765139384,
  "exp": 1865225784,
  "iss": "arc-saas"
}
```

### Lead Token Authentication
Used for lead-to-tenant conversion (from email verification):
```
X-Lead-Token: {verification_token}
```

---

## Leads API

### Create Lead
```http
POST /leads
Content-Type: application/json
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "companyName": "ACME Corp"
}
```

**Response (201):**
```json
{
  "key": "04194b655c60d4db9c7f2ddeda191c217cc6",
  "id": "ee7b2812-9ae6-8728-152e-375f6cf0b5be"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| firstName | string | Yes | 1-100 chars |
| lastName | string | Yes | 1-100 chars |
| email | string | Yes | Valid email, unique |
| companyName | string | Yes | 1-200 chars |

**Do NOT include:**
- `isValidated` - internal field only

### Verify Lead Email
```http
GET /leads/verify?token={verification_token}
```

**Response (200):**
```json
{
  "valid": true,
  "leadId": "ee7b2812-9ae6-8728-152e-375f6cf0b5be"
}
```

### Get Lead by ID
```http
GET /leads/{leadId}
Authorization: Bearer {JWT_TOKEN}
```

### List Leads
```http
GET /leads
Authorization: Bearer {JWT_TOKEN}
```

Query parameters:
- `filter[where][email]=test@example.com`
- `filter[limit]=20`
- `filter[offset]=0`

### Create Tenant from Lead
```http
POST /leads/{leadId}/tenants
Content-Type: application/json
X-Lead-Token: {verification_token}
```

**Important:** This endpoint requires Lead Token authentication, NOT JWT.

**Request Body:**
```json
{
  "name": "ACME Corporation",
  "key": "acmecorp",
  "planId": "plan-basic"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | Yes | 1-200 chars |
| key | string | Yes | **max 10 chars**, alphanumeric, unique |
| planId | string | Yes | `plan-basic`, `plan-standard`, `plan-premium` |

**Response (201):**
```json
{
  "id": "tenant-uuid",
  "name": "ACME Corporation",
  "key": "acmecorp",
  "status": "pending"
}
```

---

## Tenants API

### List Tenants
```http
GET /tenants
Authorization: Bearer {JWT_TOKEN}
```

### Get Tenant by ID
```http
GET /tenants/{tenantId}
Authorization: Bearer {JWT_TOKEN}
```

### Get Tenant by Key
```http
GET /tenants/by-key/{tenantKey}
Authorization: Bearer {JWT_TOKEN}
```

### Create Tenant
```http
POST /tenants
Content-Type: application/json
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "name": "Company Name",
  "key": "compkey",
  "leadId": "lead-uuid"
}
```

### Update Tenant
```http
PATCH /tenants/{tenantId}
Content-Type: application/json
Authorization: Bearer {JWT_TOKEN}
```

### Provision Tenant
```http
POST /tenants/{tenantId}/provision
Authorization: Bearer {JWT_TOKEN}
```

**Required Permission:** `10216` (Tenant Provision)

**No request body required.** Uses existing tenant data to trigger provisioning workflow.

**Response (202):**
```json
{
  "message": "Provisioning started",
  "workflowId": "provision-tenant-{tenantId}"
}
```

### Tenant Count
```http
GET /tenants/count
Authorization: Bearer {JWT_TOKEN}
```

---

## Subscriptions API

### List Subscriptions
```http
GET /subscriptions
Authorization: Bearer {JWT_TOKEN}
```

### Get Subscription
```http
GET /subscriptions/{subscriptionId}
Authorization: Bearer {JWT_TOKEN}
```

### Create Subscription
```http
POST /subscriptions
Content-Type: application/json
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "tenantId": "tenant-uuid",
  "planId": "plan-standard",
  "status": "active",
  "startDate": "2024-01-01T00:00:00Z"
}
```

### Subscription Status Values
```
active, trialing, past_due, cancelled, paused, expired, pending, inactive
```

---

## Plans API

### List Plans
```http
GET /plans
Authorization: Bearer {JWT_TOKEN}
```

### Get Plan
```http
GET /plans/{planId}
Authorization: Bearer {JWT_TOKEN}
```

### Available Plans

| Plan ID | Price | Users | Components | Storage |
|---------|-------|-------|------------|---------|
| `plan-basic` | $29/mo | 5 | 10K | 10GB |
| `plan-standard` | $79/mo | 25 | 100K | 100GB |
| `plan-premium` | $199/mo | Unlimited | Unlimited | Unlimited |

---

## Users API

### List Users
```http
GET /users
Authorization: Bearer {JWT_TOKEN}
```

### Get User
```http
GET /users/{userId}
Authorization: Bearer {JWT_TOKEN}
```

### List Tenant Users
```http
GET /tenant-users
Authorization: Bearer {JWT_TOKEN}
```

### Tenant Users Count
```http
GET /tenant-users/count
Authorization: Bearer {JWT_TOKEN}
```

---

## Invitations API

### List Invitations
```http
GET /user-invitations
Authorization: Bearer {JWT_TOKEN}
```

### Create Invitation
```http
POST /user-invitations
Content-Type: application/json
Authorization: Bearer {JWT_TOKEN}
```

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "roleId": "role-uuid",
  "tenantId": "tenant-uuid"
}
```

### Get Invitation by Token (Public)
```http
GET /user-invitations/by-token/{invitationToken}
```

No authentication required - used for invitation acceptance.

---

## Workflows API

### List Workflows
```http
GET /workflows
Authorization: Bearer {JWT_TOKEN}
```

### Get Workflow Status
```http
GET /workflows/{workflowId}
Authorization: Bearer {JWT_TOKEN}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": {
    "statusCode": 400,
    "name": "BadRequestError",
    "message": "Invalid request"
  }
}
```

### 401 Unauthorized
```json
{
  "error": {
    "statusCode": 401,
    "name": "UnauthorizedError",
    "message": "Unauthorized"
  }
}
```

**Common causes:**
- Missing or expired JWT token
- Using JWT token when Lead Token is required
- Invalid token signature

### 403 Forbidden
```json
{
  "error": {
    "statusCode": 403,
    "name": "ForbiddenError",
    "message": "Forbidden"
  }
}
```

### 404 Not Found
```json
{
  "error": {
    "statusCode": 404,
    "name": "NotFoundError",
    "message": "Entity not found: Tenant with id {id}"
  }
}
```

### 422 Validation Error
```json
{
  "error": {
    "statusCode": 422,
    "name": "UnprocessableEntityError",
    "message": "The request body is invalid. See error object `details` property for more info.",
    "code": "VALIDATION_FAILED",
    "details": [
      {
        "path": "/key",
        "code": "maxLength",
        "message": "must NOT have more than 10 characters",
        "info": {"limit": 10}
      }
    ]
  }
}
```

**Common validation errors:**

| Error Code | Field | Message |
|------------|-------|---------|
| `maxLength` | key | must NOT have more than 10 characters |
| `additionalProperties` | (root) | must NOT have additional properties |
| `format` | email | must match format "email" |
| `required` | various | must have required property |

---

## Validation Rules

### Tenant Key
- **Max length:** 10 characters
- **Pattern:** alphanumeric only (a-z, A-Z, 0-9)
- **Must be unique**
- **Used for:** PostgreSQL schema name (`tenant_{key}`)

### Email
- Must be valid email format
- Must be unique per entity type

### Plan IDs
Must be one of:
- `plan-basic`
- `plan-standard`
- `plan-premium`

### UUIDs
All IDs must be valid UUID v4 format:
```
^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
```

### Subscription Status
Must be one of:
```
active | trialing | past_due | cancelled | paused | expired | pending | inactive
```

---

## Database Prerequisites

### Required PostgreSQL Functions
Before running provisioning workflows, ensure these functions exist in `arc_saas` database:

```sql
-- In schema: tenant_management
CREATE FUNCTION tenant_management.create_tenant_schema(tenant_key VARCHAR(50)) RETURNS VOID
CREATE FUNCTION tenant_management.drop_tenant_schema(tenant_key VARCHAR(50)) RETURNS VOID
```

**Apply via:**
```bash
docker exec -i arc-saas-postgres psql -U postgres -d arc_saas < arc-saas/docker/init-db/01-init-schemas.sql
```

---

## Temporal Workflow Integration

### Provisioning Workflow
Triggered by `POST /tenants/{tenantId}/provision`

**Workflow ID:** `provision-tenant-{tenantId}`
**Namespace:** `arc-saas`
**Task Queue:** `tenant-provisioning`
**Temporal UI:** http://localhost:27021

### Activities Executed
1. `updateTenantStatus` - Set status to "provisioning"
2. `provisionTenantSchema` - Create PostgreSQL schema via `create_tenant_schema()`
3. `createKeycloakRealm` - Set up IdP (if enabled)
4. `notifyTenantProvisioned` - Send webhook to App Plane
5. `updateTenantStatus` - Set status to "active"

---

## Quick Test Commands

### Health Check
```bash
curl http://localhost:14000/ping
```

### Create Lead
```bash
curl -X POST "http://localhost:14000/leads" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@example.com","companyName":"TestCorp"}'
```

### Trigger Provisioning
```bash
curl -X POST "http://localhost:14000/tenants/{tenantId}/provision" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Check Workflow Status
```bash
temporal workflow describe \
  --namespace arc-saas \
  --workflow-id "provision-tenant-{tenantId}" \
  --address localhost:27020
```
