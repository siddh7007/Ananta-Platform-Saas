# Control Plane Integration Guide

## Overview

The Dashboard service integrates with Arc-SaaS Control Plane (tenant-management-service) to provide admin functionality for managing tenants, subscriptions, users, and billing.

This integration uses a **Direct Proxy Pattern** where Dashboard Next.js API routes forward authenticated requests to Control Plane while preserving user identity through JWT forwarding.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────────┐
│                 │  HTTPS  │                  │  HTTP   │                     │
│  Admin User     │────────▶│  Dashboard       │────────▶│  Control Plane      │
│  (Browser)      │◀────────│  (Next.js)       │◀────────│  (LoopBack 4)       │
│                 │         │                  │         │                     │
└─────────────────┘         └──────────────────┘         └─────────────────────┘
                                    │
                                    │ JWT Forwarding
                                    ▼
                            - User identity preserved
                            - RBAC enforced on both layers
                            - Audit logs include real user
```

## Key Components

### 1. HTTP Client (`src/lib/controlPlaneClient.ts`)

Centralized HTTP client with:
- **Automatic Retry**: Exponential backoff for transient errors (500, 503, 429)
- **Request Correlation**: Unique correlation IDs for distributed tracing
- **Error Mapping**: LoopBack error responses mapped to user-friendly messages
- **Timeout Handling**: 30-second default timeout

**Usage:**
```typescript
import { controlPlaneClient } from '@/lib/controlPlaneClient';

const plans = await controlPlaneClient.get('/plans', {
  headers: { Authorization: `Bearer ${token}` },
  params: { filter: JSON.stringify({ limit: 20 }) },
});
```

### 2. Authentication Middleware (`src/lib/authMiddleware.ts`)

JWT-based authentication with:
- **Token Extraction**: From `Authorization: Bearer <token>` header
- **Payload Parsing**: Extracts user ID, email, tenant ID, roles
- **Role-Based Access**: `requireAuth`, `requireRole`, `requireMinimumRole` wrappers
- **Header Forwarding**: Creates Control Plane headers with user context

**Role Hierarchy:**
1. `analyst` (lowest)
2. `engineer`
3. `admin`
4. `owner`
5. `super_admin` (highest)

**Usage:**
```typescript
import { requireAuth, requireMinimumRole } from '@/lib/authMiddleware';

export default requireAuth(async (req, res, user) => {
  // user.userId, user.email, user.tenantId, user.roles available
});

export default requireMinimumRole('admin', async (req, res, user) => {
  // Only admin+ can access
});
```

### 3. API Proxy Routes (`src/pages/api/control-plane/`)

Next.js API routes that proxy to Control Plane:

#### `/api/control-plane/plans` (GET)
- Lists subscription plans
- Public read access
- Supports LoopBack filters

#### `/api/control-plane/subscriptions` (GET, POST, PATCH, DELETE)
- **GET**: List subscriptions (filters: tenantId, status)
- **GET /:id**: Fetch specific subscription
- **POST**: Create subscription (admin+)
- **PATCH /:id**: Update subscription (admin+)
- **DELETE /:id**: Delete subscription (owner+)

#### `/api/control-plane/user-invitations` (GET, POST, PATCH, DELETE)
- **GET**: List invitations (filters: status)
- **GET /:id**: Fetch specific invitation
- **POST**: Invite user (admin+, auto-sets tenantId)
- **PATCH /:id**: Update invitation (admin+)
- **DELETE /:id**: Cancel invitation (admin+)

#### `/api/control-plane/billing-analytics` (GET)
- **GET ?endpoint=usage**: Usage metrics (engineer+)
- **GET ?endpoint=revenue**: Revenue metrics (super_admin)
- **GET ?endpoint=mrr**: MRR metrics (super_admin)
- **GET ?endpoint=churn**: Churn metrics (super_admin)

## Request Flow

### Example: List Subscriptions

**1. Frontend Request:**
```typescript
const response = await fetch('/api/control-plane/subscriptions?tenantId=abc-123', {
  headers: {
    Authorization: `Bearer ${userToken}`,
  },
});
```

**2. Dashboard API Route:**
```typescript
// src/pages/api/control-plane/subscriptions.ts
export default requireAuth(async (req, res, user) => {
  const loopBackFilter = {
    where: { tenantId: req.query.tenantId },
    limit: 20,
  };

  const subscriptions = await controlPlaneClient.get('/subscriptions', {
    headers: createControlPlaneHeaders(user),
    params: { filter: JSON.stringify(loopBackFilter) },
  });

  res.json(subscriptions);
});
```

**3. Control Plane Request:**
```http
GET http://localhost:14000/subscriptions?filter={"where":{"tenantId":"abc-123"},"limit":20}
Authorization: Bearer <token>
X-User-Id: user-123
X-User-Email: admin@example.com
X-Tenant-Id: abc-123
X-Correlation-ID: cp-1234567890-abc123
```

**4. Control Plane Response:**
```json
[
  {
    "id": "sub-1",
    "tenantId": "abc-123",
    "planId": "plan-basic",
    "status": "active",
    "billingCycle": "monthly",
    "amount": 29.00
  }
]
```

## Error Handling

### Error Flow

```
Control Plane Error
      │
      ├─ LoopBack Error Format: { error: { statusCode, message, details } }
      │
      ▼
controlPlaneClient.extractErrorMessage()
      │
      ├─ Maps 401, 403, 404, 422, 500, etc.
      ├─ Extracts validation errors
      ├─ Preserves correlation ID
      │
      ▼
Next.js API Route
      │
      ├─ Returns { error, correlationId }
      │
      ▼
Frontend (errorMapping.ts)
      │
      ├─ Maps to user-friendly messages
      └─ Shows toast notification
```

### Common Error Codes

| Status | Message | Retry? |
|--------|---------|--------|
| 401 | Authentication required | No |
| 403 | Insufficient permissions | No |
| 404 | Resource not found | No |
| 409 | Conflict (duplicate) | No |
| 422 | Validation error | No |
| 429 | Rate limit exceeded | Yes (exponential backoff) |
| 500 | Internal server error | Yes (max 3 retries) |
| 503 | Service unavailable | Yes (max 3 retries) |

## Configuration

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:14000
# OR in production:
# NEXT_PUBLIC_PLATFORM_API_URL=https://api.example.com
```

### Docker Internal URLs

When running in Docker, use internal container names:
```bash
# docker-compose.yml environment
NEXT_PUBLIC_PLATFORM_API_URL=http://arc-saas-tenant-mgmt:14000
```

## Security Considerations

### 1. JWT Forwarding
- User token forwarded to Control Plane preserves identity
- Control Plane enforces its own RBAC (defense in depth)
- Tokens never stored on Dashboard backend

### 2. Role-Based Access Control
- Dashboard enforces minimum role requirements
- Control Plane re-validates permissions
- Prevents unauthorized API usage

### 3. Tenant Isolation
- `tenantId` automatically injected from JWT when missing
- Control Plane validates tenant ownership
- Prevents cross-tenant data access

### 4. Correlation IDs
- Every request includes correlation ID
- Enables distributed tracing
- Simplifies debugging across services

## Monitoring

### Request Logging

```
[CONTROL_PLANE_REQUEST] GET /subscriptions - Correlation: cp-1234567890-abc123
[CONTROL_PLANE_RESPONSE] 200 /subscriptions - Correlation: cp-1234567890-abc123
```

### Error Logging

```
[CONTROL_PLANE_ERROR] 422 /subscriptions - Correlation: cp-1234567890-abc123
  { error: { message: "Invalid tenantId format", details: [...] } }
```

### Retry Logging

```
[CONTROL_PLANE_RETRY] Attempt 1/3 failed, retrying in 1500ms...
[CONTROL_PLANE_RETRY] Attempt 2/3 failed, retrying in 3200ms...
[CONTROL_PLANE_RESPONSE] 200 /subscriptions - Correlation: cp-1234567890-abc123
```

## Testing

### Manual Testing

```bash
# 1. Start Control Plane
cd arc-saas/services/tenant-management-service
bun run start

# 2. Start Dashboard
cd app-plane/services/dashboard
bun run dev

# 3. Get JWT token from Keycloak/Auth0

# 4. Test proxy endpoint
curl http://localhost:3000/api/control-plane/plans \
  -H "Authorization: Bearer $TOKEN"
```

### Integration Tests (Future)

```typescript
// __tests__/api/control-plane/plans.test.ts
import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/control-plane/plans';

describe('/api/control-plane/plans', () => {
  it('returns plans when authenticated', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toHaveLength(3);
  });

  it('returns 401 when not authenticated', async () => {
    const { req, res } = createMocks({ method: 'GET' });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
  });
});
```

## Roadmap

### Phase 1: Foundation (✅ Complete)
- [x] HTTP client with retry logic
- [x] Authentication middleware
- [x] Basic proxy routes (plans, subscriptions, invitations, billing)

### Phase 2: Additional Endpoints (Pending)
- [ ] Tenants CRUD (`/tenants`)
- [ ] Users CRUD (`/users`)
- [ ] Roles management (`/roles`)
- [ ] Audit logs (`/audit-logs`)
- [ ] Workflow management (`/workflows`)

### Phase 3: Caching Layer (Pending)
- [ ] Redis cache integration
- [ ] Cache-aside pattern for read-heavy endpoints
- [ ] Cache invalidation on writes
- [ ] TTL-based expiration

### Phase 4: Monitoring (Pending)
- [ ] Prometheus metrics
- [ ] Grafana dashboard
- [ ] Request/error rate tracking
- [ ] Latency percentiles (p50, p95, p99)

### Phase 5: Testing (Pending)
- [ ] Unit tests for client/middleware
- [ ] Integration tests for all endpoints
- [ ] Load testing with Locust
- [ ] E2E tests with Playwright

## Troubleshooting

### Issue: 401 Unauthorized

**Symptom:** All requests return 401
**Cause:** Missing or invalid JWT token
**Solution:**
1. Check token in `Authorization` header
2. Verify token not expired (`exp` claim)
3. Ensure Keycloak/Auth0 issuing valid tokens

### Issue: 403 Forbidden

**Symptom:** User can't access endpoint
**Cause:** Insufficient role level
**Solution:**
1. Check user roles in JWT (`realm_access.roles`)
2. Verify role hierarchy (analyst < engineer < admin < owner < super_admin)
3. Update endpoint role requirements if needed

### Issue: 500 Internal Server Error

**Symptom:** Proxy returns 500
**Cause:** Control Plane down or unreachable
**Solution:**
1. Check Control Plane health: `curl http://localhost:14000/ping`
2. Verify `NEXT_PUBLIC_PLATFORM_API_URL` correct
3. Check Docker network if containerized
4. Review Control Plane logs

### Issue: Requests timing out

**Symptom:** Requests fail after 30 seconds
**Cause:** Control Plane slow or unresponsive
**Solution:**
1. Check Control Plane performance
2. Increase timeout in `controlPlaneClient.ts`
3. Review database query performance
4. Consider adding caching layer

## Additional Resources

- [Arc-SaaS API Documentation](../../arc-saas/docs/API-SPEC.md)
- [LoopBack 4 Documentation](https://loopback.io/doc/en/lb4/)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [JWT Authentication](https://jwt.io/introduction)
- [Error Handling Best Practices](./src/admin/lib/errorMapping.ts)
