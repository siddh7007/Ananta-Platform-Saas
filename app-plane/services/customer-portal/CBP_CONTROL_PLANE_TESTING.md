# Customer Portal (CBP) - Control Plane Integration Testing

**Date**: 2025-12-19
**Architecture**: CBP Frontend (port 27100) → Control Plane API (port 14000)
**Auth**: Supabase JWT tokens

---

## Current Architecture

The Customer Portal (CBP) makes **direct API calls** from the frontend to the Control Plane:

```
CBP Frontend (React/Vite)          Control Plane API
Port 27100                         Port 14000
    |                                   |
    |  platformApi.get('/api/users')   |
    |---------------------------------->|
    |  platformApi.get('/subscriptions')|
    |---------------------------------->|
    |                                   |
    +-- Axios client with interceptors -+
        - Supabase JWT token
        - X-Organization-Id header
        - X-Workspace-Id header
```

**Key File**: `src/lib/axios.ts`
- `platformApi` client configured for port 14000
- Auto-injects Supabase session tokens
- Auto-includes organization/workspace context headers

---

## Current Control Plane Endpoints Used by CBP

Based on code analysis:

| Endpoint | Method | File | Purpose |
|----------|--------|------|---------|
| `/api/users` | GET | portfolio.service.ts:271 | Fetch team members |
| `/api/subscriptions/current` | GET | portfolio.service.ts:274 | Current subscription status |
| `/api/admin/organizations/{id}` | POST | portfolio.service.ts:501 | Create organization (admin) |
| `/api/admin/users` | POST | portfolio.service.ts:522 | Create user (admin) |

---

## Prerequisites

### 1. Start Control Plane Services

```bash
# Start Keycloak and PostgreSQL
docker start arc-saas-keycloak arc-saas-postgres

# Wait 30 seconds for initialization
timeout 30

# Verify Keycloak
curl http://localhost:8180/health/ready

# Verify PostgreSQL
docker exec arc-saas-postgres pg_isready -U postgres
```

### 2. Start Control Plane API (tenant-management-service)

```bash
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/tenant-management-service

# Using Bun (recommended)
bun run start

# Verify it's running
curl http://localhost:14000/ping
# Expected: {"greeting":"Hello from tenant-management-service"}
```

### 3. Build and Start CBP (Production Mode)

```bash
# Navigate to customer-portal
cd e:/Work/Ananta-Platform-Saas/app-plane/services/customer-portal

# Build production bundle
bun run build
# OR: npm run build

# Rebuild Docker container
cd e:/Work/Ananta-Platform-Saas/app-plane
docker-compose build --no-cache customer-portal

# Restart container
docker restart app-plane-customer-portal

# Verify CBP is running (port 27100)
curl http://localhost:27100
# Expected: HTML response
```

**IMPORTANT**: CBP serves pre-built code via Docker. Always:
1. Build frontend FIRST (`bun run build`)
2. Rebuild Docker container (`docker-compose build customer-portal`)
3. Restart container (`docker restart app-plane-customer-portal`)

---

## Testing Strategy

### Option A: Browser-Based Testing (Recommended)

Since CBP uses **Supabase authentication**, the easiest way to test is through the browser:

#### Step 1: Login to CBP

1. Open: http://localhost:27100
2. Login with Supabase credentials
3. Open DevTools → Network tab
4. Filter: "14000" (to see Control Plane calls)

#### Step 2: Trigger Control Plane Calls

Navigate through CBP features that call Control Plane:

- **Team Page** → Triggers `/api/users` call
- **Subscription Page** → Triggers `/api/subscriptions/current` call
- **Settings Page** → May trigger organization/user endpoints

#### Step 3: Verify in Network Tab

Check that:
- ✅ Requests go to `http://localhost:14000`
- ✅ Status codes are 200 (or expected errors)
- ✅ Request headers include:
  - `Authorization: Bearer <supabase-jwt>`
  - `X-Organization-Id: <org-id>`
  - `X-Workspace-Id: <workspace-id>` (if available)
- ✅ Response data is valid JSON

---

### Option B: Direct API Testing (Advanced)

For testing without the UI, you need a **Supabase JWT token**.

#### Get Supabase JWT Token

**Method 1: From Browser**
1. Login to CBP: http://localhost:27100
2. Open DevTools → Application → Local Storage
3. Find Supabase session key (usually `sb-<project>-auth-token`)
4. Copy the `access_token` value

**Method 2: Via Supabase API**
```bash
# Get JWT from Supabase
curl -X POST "http://localhost:27810/auth/v1/token?grant_type=password" \
  -H "apikey: <your-supabase-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cbp.local",
    "password": "your-password"
  }'
```

#### Test Control Plane Endpoints

```bash
# Set your Supabase token
SUPABASE_TOKEN="your-supabase-jwt-token"
ORG_ID="your-organization-id"
WORKSPACE_ID="your-workspace-id"

# Test 1: GET Users
curl -s -w "\nHTTP %{http_code}\n" \
  http://localhost:14000/api/users \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "X-Organization-Id: $ORG_ID"

# Test 2: GET Current Subscription
curl -s -w "\nHTTP %{http_code}\n" \
  http://localhost:14000/api/subscriptions/current \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "X-Organization-Id: $ORG_ID"

# Test 3: POST Create Organization (admin only)
curl -s -w "\nHTTP %{http_code}\n" \
  -X POST http://localhost:14000/api/admin/organizations \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Org",
    "domain": "testorg.com"
  }'
```

---

## Expected Behavior

### Successful Requests

**Status**: HTTP 200
**Response**: JSON data

Example `/api/users` response:
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "admin"
  }
]
```

Example `/api/subscriptions/current` response:
```json
{
  "id": "sub_123",
  "status": "active",
  "plan": "premium",
  "currentPeriodEnd": "2025-01-19T00:00:00Z"
}
```

### Failed Authentication

**Status**: HTTP 401
**Response**:
```json
{
  "error": {
    "message": "Unauthorized",
    "statusCode": 401
  }
}
```

**Causes**:
- Missing or invalid Supabase JWT token
- Token expired (Supabase tokens expire after 1 hour by default)
- Token not valid for Control Plane realm

### Missing Context Headers

**Status**: HTTP 400 or 403
**Response**:
```json
{
  "error": {
    "message": "Organization ID required",
    "statusCode": 400
  }
}
```

**Causes**:
- Missing `X-Organization-Id` header
- Invalid organization ID
- User doesn't have access to organization

---

## Troubleshooting

### Issue: CORS Errors in Browser

**Symptom**: Console shows "CORS policy blocked the request"

**Cause**: Control Plane not configured to allow CBP origin

**Solution**: Check Control Plane CORS configuration
```typescript
// In tenant-management-service
// Ensure CORS allows http://localhost:27100
```

### Issue: 401 Unauthorized

**Symptom**: All Control Plane calls return 401

**Cause**: Supabase JWT not recognized by Control Plane

**Solution**:
1. Verify Control Plane accepts Supabase JWTs
2. Check JWT signature validation settings
3. Ensure Supabase public key configured in Control Plane

### Issue: "Connection refused" on port 14000

**Symptom**: Network error, cannot connect

**Cause**: Control Plane API not running

**Solution**:
```bash
cd arc-saas/services/tenant-management-service
bun run start
```

### Issue: "Organization ID required"

**Symptom**: 400 error about missing organization

**Cause**: `X-Organization-Id` header not sent

**Solution**: Check that:
1. Organization is selected in CBP UI
2. `getCurrentOrganizationId()` returns valid ID
3. Axios interceptor adds header correctly

---

## Testing Checklist

- [ ] Control Plane API running on port 14000
- [ ] CBP built and running on port 27100
- [ ] Can login to CBP via Supabase
- [ ] Network tab shows requests to port 14000
- [ ] Requests include `Authorization: Bearer <token>` header
- [ ] Requests include `X-Organization-Id` header
- [ ] Responses return HTTP 200 with valid JSON
- [ ] No CORS errors in console
- [ ] No authentication errors (401)

---

## Integration Test Script (Optional)

Create a test file to verify Control Plane integration:

```typescript
// src/test/controlPlane.integration.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { platformApi } from '../lib/axios';

describe('Control Plane Integration', () => {
  beforeAll(async () => {
    // Setup: Login to get Supabase token
    // This assumes test user exists
  });

  it('should fetch users from Control Plane', async () => {
    const response = await platformApi.get('/api/users');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
  });

  it('should fetch current subscription', async () => {
    const response = await platformApi.get('/api/subscriptions/current');
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('status');
  });

  it('should include auth headers automatically', async () => {
    // Axios interceptor test
    const config = platformApi.defaults;
    expect(config.baseURL).toBe('http://localhost:14000');
  });
});
```

---

## Next Steps

After verifying Control Plane integration works:

1. **Add Error Handling** - Better user feedback for failed Control Plane calls
2. **Add Loading States** - Show spinners while fetching from Control Plane
3. **Add Retry Logic** - Auto-retry failed Control Plane requests
4. **Add Caching** - Cache Control Plane responses to reduce load
5. **Add Monitoring** - Track Control Plane API latency and errors

---

## Related Documentation

- [CBP Architecture](../README.md)
- [Control Plane API Reference](../../dashboard/CONTROL_PLANE_API_REFERENCE.md)
- [Supabase Authentication](https://supabase.com/docs/guides/auth)

---

**Summary**: The Customer Portal (CBP) on port 27100 calls Control Plane on port 14000 directly using Supabase JWT authentication. Test by logging into CBP and checking the browser Network tab for requests to port 14000.
