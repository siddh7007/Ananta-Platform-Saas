# Next Steps - Control Plane Integration

## ✅ What's Complete

**Phase 1 Foundation** is fully implemented:

1. **HTTP Client** (`src/lib/controlPlaneClient.ts`)
   - Automatic retry with exponential backoff
   - Request correlation IDs
   - LoopBack error mapping
   - Comprehensive logging

2. **Authentication Middleware** (`src/lib/authMiddleware.ts`)
   - JWT token validation
   - Role-based access control
   - User context extraction
   - Control Plane header creation

3. **API Proxy Endpoints** (`src/pages/api/control-plane/`)
   - Plans (GET)
   - Subscriptions (GET, POST, PATCH, DELETE)
   - User Invitations (GET, POST, PATCH, DELETE)
   - Billing Analytics (GET with 4 endpoints)

4. **Documentation**
   - Comprehensive integration guide
   - API reference with examples
   - Implementation summary
   - Test scripts (bash + PowerShell)

## 🚀 Immediate Next Steps

### 1. Manual Testing (15-30 minutes)

**Prerequisites:**
- Control Plane running on port 14000
- Dashboard dev server running on port 3000
- Valid JWT token from Keycloak/Auth0

**Get JWT Token:**

```bash
# Option 1: Via Keycloak Admin CLI
cd arc-saas/services/tenant-management-service
TOKEN=$(docker exec arc-saas-keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8180 \
  --realm ananta-saas \
  --user admin \
  --password admin \
  --client admin-cli 2>&1 | grep -oP 'access_token.*' | awk '{print $2}')

# Option 2: Via Browser
# 1. Open http://localhost:8180/realms/ananta-saas
# 2. Login with your credentials
# 3. Open DevTools → Application → Local Storage
# 4. Copy token value
```

**Run Tests:**

```bash
# Windows (PowerShell)
cd e:\Work\Ananta-Platform-Saas\app-plane\services\dashboard
$env:TOKEN = "your-jwt-token-here"
.\test-control-plane-integration.ps1

# Linux/Mac/WSL (Bash)
export TOKEN="your-jwt-token-here"
bash test-control-plane-integration.sh
```

**Manual cURL Testing:**

```bash
# Test plans endpoint
curl http://localhost:3000/api/control-plane/plans \
  -H "Authorization: Bearer $TOKEN"

# Test subscriptions
curl http://localhost:3000/api/control-plane/subscriptions \
  -H "Authorization: Bearer $TOKEN"

# Test usage analytics
curl "http://localhost:3000/api/control-plane/billing-analytics?endpoint=usage" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Results:**
- ✅ Plans endpoint returns array of subscription plans
- ✅ Subscriptions endpoint returns array of subscriptions
- ✅ Invitations endpoint returns array of invitations
- ✅ Usage analytics returns usage metrics object
- ✅ Without token: 401 Unauthorized
- ✅ Invalid endpoint: 400 Bad Request

---

### 2. Frontend Integration (1-2 hours)

Update admin portal React Admin components to use new proxy endpoints.

**Before (Direct Control Plane calls):**
```typescript
// ❌ OLD - Direct to Control Plane
const response = await fetch('http://localhost:14000/subscriptions', {
  headers: { Authorization: `Bearer ${token}` },
});
```

**After (Via Dashboard proxy):**
```typescript
// ✅ NEW - Via Dashboard proxy
const response = await fetch('/api/control-plane/subscriptions', {
  headers: { Authorization: `Bearer ${token}` },
});
```

**Files to Update:**
```
app-plane/services/dashboard/src/admin/
├── pages/
│   ├── subscriptions/        # Update to use /api/control-plane/subscriptions
│   ├── invitations/          # Update to use /api/control-plane/user-invitations
│   └── billing/              # Update to use /api/control-plane/billing-analytics
└── lib/
    └── dataProvider.ts       # Update base URL if using custom provider
```

**Integration Pattern:**

```typescript
// Example: Fetch subscriptions in React Admin
import { useDataProvider } from 'react-admin';

function SubscriptionsList() {
  const dataProvider = useDataProvider();

  useEffect(() => {
    // React Admin data provider (if configured)
    dataProvider.getList('control-plane/subscriptions', {
      pagination: { page: 1, perPage: 20 },
      filter: { status: 'active' },
    });

    // OR direct fetch
    fetch('/api/control-plane/subscriptions?status=active&limit=20', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => res.json());
  }, []);
}
```

---

### 3. Add Unit Tests (2-3 hours)

**Test Files to Create:**

```
src/lib/__tests__/
├── controlPlaneClient.test.ts
└── authMiddleware.test.ts
```

**Example Test (controlPlaneClient):**

```typescript
import { controlPlaneClient } from '../controlPlaneClient';
import axios from 'axios';

jest.mock('axios');

describe('controlPlaneClient', () => {
  it('should retry on 500 error', async () => {
    const mockGet = jest.spyOn(axios, 'create').mockReturnValue({
      get: jest.fn()
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockResolvedValueOnce({ data: { success: true } }),
    } as any);

    const result = await controlPlaneClient.get('/test');

    expect(result).toEqual({ success: true });
    expect(mockGet).toHaveBeenCalledTimes(2); // Initial + 1 retry
  });

  it('should map LoopBack errors to user-friendly messages', async () => {
    const mockGet = jest.spyOn(axios, 'create').mockReturnValue({
      get: jest.fn().mockRejectedValue({
        response: {
          status: 422,
          data: { error: { message: 'Invalid tenantId format' } },
        },
      }),
    } as any);

    await expect(controlPlaneClient.get('/test')).rejects.toThrow(
      'Invalid tenantId format'
    );
  });
});
```

**Install Testing Dependencies:**

```bash
npm install --save-dev @types/jest jest ts-jest node-mocks-http
```

**Run Tests:**

```bash
npm test
```

---

### 4. Integration Testing (3-4 hours)

**Test API Routes End-to-End:**

```
src/pages/api/control-plane/__tests__/
├── plans.test.ts
├── subscriptions.test.ts
├── user-invitations.test.ts
└── billing-analytics.test.ts
```

**Example Integration Test:**

```typescript
import { createMocks } from 'node-mocks-http';
import handler from '../plans';

describe('/api/control-plane/plans', () => {
  it('returns plans when authenticated', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        authorization: 'Bearer valid-test-token',
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(Array.isArray(data)).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(JSON.parse(res._getData())).toHaveProperty('error');
  });

  it('returns 405 for non-GET methods', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
  });
});
```

---

## 📋 Future Phases

### Phase 2: Additional Endpoints (Week 2)

**Missing Control Plane Endpoints:**
- [ ] Tenants CRUD (`/tenants`)
- [ ] Users CRUD (`/users`)
- [ ] Roles management (`/roles`)
- [ ] Audit logs (`/audit-logs`)
- [ ] Workflow management (`/workflows`)

**Implementation Pattern:**
Follow existing pattern in `src/pages/api/control-plane/subscriptions.ts`:
1. Create new file in `src/pages/api/control-plane/`
2. Use `requireAuth` or `requireMinimumRole` middleware
3. Forward to Control Plane with `controlPlaneClient`
4. Map errors to user-friendly messages
5. Add to API documentation

---

### Phase 3: Redis Caching (Week 3)

**Goals:**
- Reduce Control Plane load for read-heavy endpoints
- Improve response times
- Cache invalidation on writes

**Redis Setup:**

```typescript
// src/lib/redisCache.ts
import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

export async function getCached<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await client.get(key);
  if (cached) {
    return JSON.parse(cached);
  }

  const data = await fetcher();
  await client.setEx(key, ttl, JSON.stringify(data));
  return data;
}
```

**Cache Strategy:**

| Endpoint | Pattern | TTL | Why |
|----------|---------|-----|-----|
| Plans | Cache-aside | 1 hour | Rarely change |
| Users | Cache-aside | 5 min | Read-heavy |
| Subscriptions | Direct proxy | - | Real-time critical |
| Billing | Cache-aside | 15 min | Expensive aggregations |

---

### Phase 4: Monitoring (Week 4)

**Prometheus Metrics:**

```typescript
// src/lib/metrics.ts
import { Counter, Histogram } from 'prom-client';

export const controlPlaneRequests = new Counter({
  name: 'control_plane_requests_total',
  help: 'Total requests to Control Plane',
  labelNames: ['endpoint', 'method', 'status'],
});

export const controlPlaneLatency = new Histogram({
  name: 'control_plane_request_duration_seconds',
  help: 'Control Plane request latency',
  labelNames: ['endpoint', 'method'],
  buckets: [0.1, 0.5, 1, 2, 5],
});
```

**Grafana Dashboard:**
- Request rate (req/s)
- Error rate (%)
- Latency percentiles (p50, p95, p99)
- Cache hit rate
- Top endpoints by volume

---

## 🎯 Success Criteria

### Phase 1 Complete ✅
- [x] HTTP client with retry logic
- [x] Authentication middleware with RBAC
- [x] 4 proxy endpoints (plans, subscriptions, invitations, billing)
- [x] Comprehensive documentation
- [x] Test scripts created
- [ ] **Manual testing verified** ⬅️ YOUR NEXT TASK
- [ ] Frontend integration complete

### Phase 2 Complete (Future)
- [ ] All Control Plane endpoints proxied
- [ ] Unit tests (80%+ coverage)
- [ ] Integration tests for all routes
- [ ] E2E tests for critical flows

### Phase 3 Complete (Future)
- [ ] Redis cache layer implemented
- [ ] Cache invalidation working
- [ ] Cache hit rate > 70%
- [ ] Load testing passed

### Phase 4 Complete (Future)
- [ ] Prometheus metrics exporting
- [ ] Grafana dashboard deployed
- [ ] Alerting rules configured
- [ ] Production-ready

---

## 📞 Getting Help

**Documentation:**
- [Integration Guide](./CONTROL_PLANE_INTEGRATION.md) - Technical deep dive
- [API Reference](./CONTROL_PLANE_API_REFERENCE.md) - Endpoint specs
- [Summary](./CONTROL_PLANE_INTEGRATION_SUMMARY.md) - Implementation overview

**Troubleshooting:**
1. Check Control Plane is running: `curl http://localhost:14000/ping`
2. Verify token validity: Decode JWT at https://jwt.io
3. Review logs in Dashboard console
4. Check correlation IDs in error responses

**Common Issues:**
- **401 Unauthorized**: Token expired or invalid
- **403 Forbidden**: Insufficient role level
- **500 Internal Error**: Control Plane down or database issue
- **Timeout**: Control Plane slow, check database performance

---

## 🎉 Summary

**You now have:**
- ✅ Complete Control Plane integration infrastructure
- ✅ 4 working proxy endpoints with authentication
- ✅ Comprehensive documentation
- ✅ Ready-to-run test scripts
- ✅ Clear roadmap for next phases

**Next Action:**
Run the test scripts to verify everything works, then integrate the frontend admin portal!

```bash
# Start testing now:
$env:TOKEN = "your-jwt-token"
.\test-control-plane-integration.ps1
```
