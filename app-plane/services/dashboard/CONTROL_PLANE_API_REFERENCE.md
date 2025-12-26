# Control Plane API Reference

Quick reference for all Control Plane proxy endpoints available in Dashboard.

## Base URL

```
Local: http://localhost:3000/api/control-plane
Production: https://dashboard.example.com/api/control-plane
```

## Authentication

All endpoints require JWT authentication:

```http
Authorization: Bearer <keycloak-or-auth0-token>
```

## Endpoints

### Plans

#### List Plans
```http
GET /api/control-plane/plans
```

**Query Parameters:**
- `skip` (optional): Pagination offset (default: 0)
- `limit` (optional): Results per page (default: 20, max: 100)

**Response:**
```json
[
  {
    "id": "plan-basic",
    "name": "Basic",
    "tier": "basic",
    "price": 29.00,
    "currency": "USD",
    "billingCycle": "monthly",
    "features": {
      "boms": 50,
      "components": 5000,
      "users": 5
    }
  }
]
```

---

### Subscriptions

#### List Subscriptions
```http
GET /api/control-plane/subscriptions
```

**Query Parameters:**
- `skip` (optional): Pagination offset
- `limit` (optional): Results per page
- `tenantId` (optional): Filter by tenant
- `status` (optional): Filter by status (active, cancelled, etc.)

**Response:**
```json
[
  {
    "id": "sub-123",
    "tenantId": "tenant-abc",
    "planId": "plan-basic",
    "status": "active",
    "billingCycle": "monthly",
    "amount": 29.00,
    "startDate": "2025-01-01T00:00:00Z",
    "nextBillingDate": "2025-02-01T00:00:00Z"
  }
]
```

#### Get Subscription
```http
GET /api/control-plane/subscriptions/:id
```

**Response:** Single subscription object

#### Create Subscription
```http
POST /api/control-plane/subscriptions
```

**Required Role:** `admin` or higher

**Request Body:**
```json
{
  "tenantId": "tenant-abc",
  "planId": "plan-basic",
  "billingCycle": "monthly"
}
```

**Response:** Created subscription object (201)

#### Update Subscription
```http
PATCH /api/control-plane/subscriptions/:id
```

**Required Role:** `admin` or higher

**Request Body:**
```json
{
  "status": "cancelled",
  "cancelReason": "User requested cancellation"
}
```

**Response:** 204 No Content

#### Delete Subscription
```http
DELETE /api/control-plane/subscriptions/:id
```

**Required Role:** `owner` or higher

**Response:** 204 No Content

---

### User Invitations

#### List Invitations
```http
GET /api/control-plane/user-invitations
```

**Query Parameters:**
- `skip` (optional): Pagination offset
- `limit` (optional): Results per page
- `status` (optional): Filter by status (pending, accepted, expired)

**Response:**
```json
[
  {
    "id": "inv-123",
    "email": "newuser@example.com",
    "roleKey": "engineer",
    "status": "pending",
    "tenantId": "tenant-abc",
    "invitedBy": "user-xyz",
    "createdAt": "2025-01-15T10:00:00Z",
    "expiresAt": "2025-01-22T10:00:00Z"
  }
]
```

#### Get Invitation
```http
GET /api/control-plane/user-invitations/:id
```

**Response:** Single invitation object

#### Create Invitation
```http
POST /api/control-plane/user-invitations
```

**Required Role:** `admin` or higher

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "roleKey": "engineer",
  "tenantId": "tenant-abc",
  "message": "Welcome to the team!"
}
```

**Note:** `tenantId` is auto-populated from JWT if not provided

**Response:** Created invitation object (201)

#### Update Invitation
```http
PATCH /api/control-plane/user-invitations/:id
```

**Required Role:** `admin` or higher

**Request Body:**
```json
{
  "status": "cancelled"
}
```

**Response:** 204 No Content

#### Delete Invitation
```http
DELETE /api/control-plane/user-invitations/:id
```

**Required Role:** `admin` or higher

**Response:** 204 No Content

---

### Billing Analytics

#### Usage Metrics
```http
GET /api/control-plane/billing-analytics?endpoint=usage
```

**Required Role:** `engineer` or higher

**Query Parameters:**
- `tenantId` (optional): Specific tenant (defaults to user's tenant)

**Response:**
```json
{
  "tenantId": "tenant-abc",
  "period": "2025-01",
  "usage": {
    "boms": { "current": 12, "limit": 50, "percentage": 24 },
    "components": { "current": 1200, "limit": 5000, "percentage": 24 },
    "users": { "current": 3, "limit": 5, "percentage": 60 },
    "apiCalls": { "current": 8500, "limit": 25000, "percentage": 34 }
  }
}
```

#### Revenue Metrics
```http
GET /api/control-plane/billing-analytics?endpoint=revenue
```

**Required Role:** `super_admin`

**Query Parameters:**
- `startDate` (optional): Start date (YYYY-MM-DD)
- `endDate` (optional): End date (YYYY-MM-DD)

**Response:**
```json
{
  "totalRevenue": 125000.00,
  "period": "2025-01",
  "breakdown": [
    { "planTier": "basic", "revenue": 15000.00, "count": 517 },
    { "planTier": "standard", "revenue": 45000.00, "count": 569 },
    { "planTier": "premium", "revenue": 65000.00, "count": 327 }
  ]
}
```

#### MRR Metrics
```http
GET /api/control-plane/billing-analytics?endpoint=mrr
```

**Required Role:** `super_admin`

**Response:**
```json
{
  "currentMRR": 125000.00,
  "previousMRR": 118000.00,
  "growth": 5.93,
  "newMRR": 12000.00,
  "expansionMRR": 3500.00,
  "contractionMRR": 2000.00,
  "churnedMRR": 6500.00
}
```

#### Churn Metrics
```http
GET /api/control-plane/billing-analytics?endpoint=churn
```

**Required Role:** `super_admin`

**Query Parameters:**
- `period` (optional): Time period (default: "30d")

**Response:**
```json
{
  "period": "30d",
  "customerChurnRate": 3.2,
  "revenueChurnRate": 2.8,
  "churnedCustomers": 45,
  "totalCustomers": 1413,
  "churnedRevenue": 3500.00,
  "totalRevenue": 125000.00
}
```

---

## Error Responses

All endpoints use consistent error format:

```json
{
  "error": "Human-readable error message",
  "correlationId": "cp-1234567890-abc123"
}
```

**Common Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (success, no response body) |
| 400 | Bad Request (invalid parameters) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 422 | Validation Error |
| 429 | Rate Limit Exceeded |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

## Role Requirements

| Endpoint | Method | Minimum Role |
|----------|--------|--------------|
| `/plans` | GET | (any authenticated) |
| `/subscriptions` | GET | (any authenticated) |
| `/subscriptions` | POST, PATCH | `admin` |
| `/subscriptions` | DELETE | `owner` |
| `/user-invitations` | GET | (any authenticated) |
| `/user-invitations` | POST, PATCH, DELETE | `admin` |
| `/billing-analytics?endpoint=usage` | GET | `engineer` |
| `/billing-analytics?endpoint=revenue` | GET | `super_admin` |
| `/billing-analytics?endpoint=mrr` | GET | `super_admin` |
| `/billing-analytics?endpoint=churn` | GET | `super_admin` |

**Role Hierarchy:**
1. `analyst` (lowest)
2. `engineer`
3. `admin`
4. `owner`
5. `super_admin` (highest)

---

## Examples

### JavaScript/TypeScript

```typescript
// Fetch plans
const plans = await fetch('/api/control-plane/plans', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
}).then(res => res.json());

// Create subscription
const subscription = await fetch('/api/control-plane/subscriptions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    tenantId: 'tenant-abc',
    planId: 'plan-basic',
    billingCycle: 'monthly',
  }),
}).then(res => res.json());

// Invite user
const invitation = await fetch('/api/control-plane/user-invitations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'newuser@example.com',
    roleKey: 'engineer',
  }),
}).then(res => res.json());

// Get usage metrics
const usage = await fetch('/api/control-plane/billing-analytics?endpoint=usage', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
}).then(res => res.json());
```

### cURL

```bash
# List plans
curl http://localhost:3000/api/control-plane/plans \
  -H "Authorization: Bearer $TOKEN"

# Create subscription
curl -X POST http://localhost:3000/api/control-plane/subscriptions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-abc",
    "planId": "plan-basic",
    "billingCycle": "monthly"
  }'

# List subscriptions for tenant
curl "http://localhost:3000/api/control-plane/subscriptions?tenantId=tenant-abc" \
  -H "Authorization: Bearer $TOKEN"

# Get usage metrics
curl "http://localhost:3000/api/control-plane/billing-analytics?endpoint=usage" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Rate Limiting

Currently no rate limiting enforced, but Control Plane may return `429` if overloaded.

When receiving `429`:
- Wait and retry with exponential backoff (automatic in `controlPlaneClient`)
- Maximum 3 retries with delays: 1s, 2s, 4s

---

## Notes

- All timestamps in ISO 8601 format (UTC)
- All monetary amounts in USD unless specified
- Pagination uses `skip`/`limit` (not page numbers)
- LoopBack filter syntax for advanced queries
- Correlation IDs included in all responses for debugging
