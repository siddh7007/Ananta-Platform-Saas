# Manual Testing Guide - Control Plane Integration

**Date**: 2025-12-19
**Status**: Ready for Execution
**Prerequisites**: Docker, Node.js/Bun, curl

---

## Current Service Status

Based on Docker inspection:

| Service | Container | Status | Port | Required For |
|---------|-----------|--------|------|--------------|
| Keycloak | `arc-saas-keycloak` | ❌ Stopped | 8180 | JWT tokens |
| PostgreSQL | `arc-saas-postgres` | ❌ Stopped | 5432 | Control Plane DB |
| Control Plane API | (not containerized) | ❌ Not running | 14000 | Backend API |
| Dashboard (Production) | `app-plane-dashboard` | ✅ Running | 27400 | Proxy endpoints |
| Temporal | `shared-temporal` | ✅ Running | 27020/27021 | Workflows |

---

## Step-by-Step Testing Procedure

### Phase 1: Start Required Services (10 minutes)

#### 1.1 Start Control Plane Infrastructure

```bash
# Navigate to arc-saas root
cd e:/Work/Ananta-Platform-Saas/arc-saas

# Start Keycloak and PostgreSQL
docker start arc-saas-keycloak arc-saas-postgres

# Wait 30 seconds for services to initialize
timeout 30

# Verify Keycloak is ready
curl -s http://localhost:8180/health/ready
# Expected: {"status":"UP","checks":[...]}

# Verify PostgreSQL is ready
docker exec arc-saas-postgres pg_isready -U postgres
# Expected: /var/run/postgresql:5432 - accepting connections
```

#### 1.2 Start Control Plane API (tenant-management-service)

```bash
# Navigate to tenant-management-service
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/tenant-management-service

# Option A: Using Bun (recommended)
bun run start

# Option B: Using npm
npm run start

# Verify it's running (in new terminal)
curl http://localhost:14000/ping
# Expected: {"greeting":"Hello from tenant-management-service"}
```

#### 1.3 Build and Start Dashboard (Production Mode)

```bash
# Navigate to dashboard
cd e:/Work/Ananta-Platform-Saas/app-plane/services/dashboard

# Build production bundle
bun run build
# OR: npm run build

# Rebuild Docker container with fresh build
cd e:/Work/Ananta-Platform-Saas/app-plane
docker-compose build --no-cache dashboard

# Restart container
docker restart app-plane-dashboard

# Verify it's running (port 27400)
curl http://localhost:27400/api/health
# Expected: {"status":"ok"}
```

**IMPORTANT**: Docker serves pre-built code. Always:
1. Build frontend FIRST (`bun run build`)
2. Rebuild Docker container (`docker-compose build dashboard`)
3. Restart container (`docker restart app-plane-dashboard`)

---

### Phase 2: Get JWT Token (5 minutes)

#### Option A: Via Keycloak Admin CLI (Recommended)

```bash
# Get admin token
TOKEN=$(docker exec arc-saas-keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8180 \
  --realm ananta-saas \
  --user admin \
  --password admin \
  --client admin-cli 2>&1 | grep -oP 'Logging into.*' && \
  docker exec arc-saas-keycloak cat /opt/keycloak/data/tmp/kcadm.config | \
  grep -oP '"access_token"\s*:\s*"\K[^"]+')

echo "Token: $TOKEN"

# Export for test script
export TOKEN
```

#### Option B: Via Direct Token Request

```bash
TOKEN=$(curl -s -X POST "http://localhost:8180/realms/ananta-saas/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=admin-cli" \
  -d "username=admin" \
  -d "password=admin" \
  -d "grant_type=password" | \
  grep -oP '"access_token"\s*:\s*"\K[^"]+')

echo "Token: $TOKEN"
export TOKEN
```

#### Option C: Via Browser (Manual)

1. Open: http://localhost:8180/realms/ananta-saas/account
2. Login with `admin` / `admin`
3. Open DevTools → Application → Local Storage
4. Find and copy the `access_token` value
5. Export: `export TOKEN="paste-token-here"`

#### Verify Token

```bash
# Decode token to check claims (requires jq)
echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .

# Check expiration
echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.exp' | \
  xargs -I {} date -d @{} '+%Y-%m-%d %H:%M:%S'
```

---

### Phase 3: Run Test Script (10 minutes)

#### 3.1 Update Test Script with Fresh Token

```bash
# Navigate to dashboard
cd e:/Work/Ananta-Platform-Saas/app-plane/services/dashboard

# Update test-endpoints.sh with your token
# Edit line 3: TOKEN="your-token-here"

# Make executable
chmod +x test-endpoints.sh

# Run tests
bash test-endpoints.sh
```

#### 3.2 Manual cURL Testing

```bash
# Test 1: GET Plans (no auth - should fail with 401)
curl -s -w "\nHTTP %{http_code}\n" http://localhost:27400/api/control-plane/plans

# Test 2: GET Plans (with auth - should succeed)
curl -s -w "\nHTTP %{http_code}\n" \
  http://localhost:27400/api/control-plane/plans \
  -H "Authorization: Bearer $TOKEN"

# Test 3: GET Subscriptions
curl -s -w "\nHTTP %{http_code}\n" \
  http://localhost:27400/api/control-plane/subscriptions \
  -H "Authorization: Bearer $TOKEN"

# Test 4: GET User Invitations
curl -s -w "\nHTTP %{http_code}\n" \
  http://localhost:27400/api/control-plane/user-invitations \
  -H "Authorization: Bearer $TOKEN"

# Test 5: GET Billing Analytics - Usage
curl -s -w "\nHTTP %{http_code}\n" \
  "http://localhost:27400/api/control-plane/billing-analytics?endpoint=usage" \
  -H "Authorization: Bearer $TOKEN"

# Test 6: GET Billing Analytics - Revenue
curl -s -w "\nHTTP %{http_code}\n" \
  "http://localhost:27400/api/control-plane/billing-analytics?endpoint=revenue" \
  -H "Authorization: Bearer $TOKEN"

# Test 7: GET Billing Analytics - MRR
curl -s -w "\nHTTP %{http_code}\n" \
  "http://localhost:27400/api/control-plane/billing-analytics?endpoint=mrr" \
  -H "Authorization: Bearer $TOKEN"

# Test 8: GET Billing Analytics - Churn
curl -s -w "\nHTTP %{http_code}\n" \
  "http://localhost:27400/api/control-plane/billing-analytics?endpoint=churn" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Phase 4: Verify Results (5 minutes)

#### Expected Results Checklist

- [ ] **Test 1** (no auth): HTTP 401, error message about missing/invalid token
- [ ] **Test 2** (plans): HTTP 200, JSON array of subscription plans
  ```json
  [
    {
      "id": "plan-basic",
      "name": "Basic",
      "price": 29,
      "currency": "USD",
      "tier": "basic"
    },
    // ...
  ]
  ```
- [ ] **Test 3** (subscriptions): HTTP 200, JSON array of subscriptions
- [ ] **Test 4** (invitations): HTTP 200, JSON array of user invitations
- [ ] **Test 5-8** (billing analytics): HTTP 200, JSON objects with metrics

#### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| `Connection refused` | Service not running | Start the service (see Phase 1) |
| `401 Unauthorized` | Token expired/invalid | Get fresh token (see Phase 2) |
| `403 Forbidden` | Insufficient permissions | Use admin token with correct realm |
| `404 Not Found` | Wrong endpoint path | Verify URL spelling |
| `500 Internal Error` | Control Plane issue | Check Control Plane logs |
| `ECONNREFUSED` | Dashboard not running | Start Dashboard dev server |

#### Debugging Commands

```bash
# Check Control Plane logs
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/tenant-management-service
# Check terminal where service is running

# Check Dashboard dev server logs
cd e:/Work/Ananta-Platform-Saas/app-plane/services/dashboard
# Check terminal where dev server is running

# Check Keycloak logs
docker logs arc-saas-keycloak --tail 50

# Check PostgreSQL logs
docker logs arc-saas-postgres --tail 50

# Test Control Plane directly (bypass Dashboard proxy)
curl http://localhost:14000/plans \
  -H "Authorization: Bearer $TOKEN"
```

---

## Success Criteria

### ✅ Phase 1 Complete When:
- Keycloak responds to health check
- PostgreSQL accepts connections
- Control Plane `/ping` returns greeting
- Dashboard dev server responds

### ✅ Phase 2 Complete When:
- JWT token obtained successfully
- Token decodes with valid claims (sub, exp, roles)
- Token not expired

### ✅ Phase 3 Complete When:
- All 8 test cases execute
- Results captured in terminal output

### ✅ Phase 4 Complete When:
- Test 1 (no auth) returns 401
- Tests 2-8 (with auth) return 200
- Response bodies contain expected data structures
- No 500 errors

---

## Next Steps After Testing

Once manual testing passes:

1. **Document Results** - Save test output to `TEST_RESULTS.md`
2. **Frontend Integration** - Update React Admin components to use proxy endpoints
3. **Unit Tests** - Create automated tests for `controlPlaneClient` and `authMiddleware`
4. **Integration Tests** - Create API route tests for all endpoints
5. **E2E Tests** - Test complete user flows through Dashboard UI

---

## Reference Documentation

- [Control Plane Integration Guide](./CONTROL_PLANE_INTEGRATION.md)
- [API Reference](./CONTROL_PLANE_API_REFERENCE.md)
- [Implementation Summary](./CONTROL_PLANE_INTEGRATION_SUMMARY.md)
- [Next Steps](./NEXT_STEPS.md)

---

## Quick Start (TL;DR)

```bash
# 1. Start services
docker start arc-saas-keycloak arc-saas-postgres
cd arc-saas/services/tenant-management-service && bun run start &

# 2. Build and deploy Dashboard (production mode)
cd app-plane/services/dashboard && bun run build
cd ../.. && docker-compose build --no-cache dashboard
docker restart app-plane-dashboard

# 3. Get token
TOKEN=$(curl -s -X POST "http://localhost:8180/realms/ananta-saas/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=admin-cli" \
  -d "username=admin" \
  -d "password=admin" \
  -d "grant_type=password" | grep -oP '"access_token"\s*:\s*"\K[^"]+')

# 4. Test
export TOKEN
cd app-plane/services/dashboard
bash test-endpoints.sh

# 5. Verify
# All tests should return HTTP 200 (except test 5 which expects 401)
```

---

**Ready to begin?** Start with Phase 1 and work through each phase sequentially.