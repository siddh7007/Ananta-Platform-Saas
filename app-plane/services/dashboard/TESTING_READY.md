# Control Plane Integration - Ready for Testing ✅

**Date**: 2025-12-19
**Status**: All documentation updated for production mode
**Port**: 27400 (Production Dashboard via Docker)

---

## What's Been Updated

### ✅ All Test Scripts Corrected
| File | Old Port | New Port | Status |
|------|----------|----------|--------|
| `test-endpoints.sh` | 3000 (dev) | 27400 (prod) | ✅ Updated |
| `test-control-plane.ps1` | 3000 (dev) | 27400 (prod) | ✅ Updated |
| `MANUAL_TESTING_GUIDE.md` | 3000 (dev) | 27400 (prod) | ✅ Updated |

### ✅ Documentation Corrected
- Service table shows Dashboard on port 27400
- Quick Start uses production build workflow
- All curl examples use port 27400
- Build-first workflow emphasized

---

## How to Test (Production Mode)

### Option 1: PowerShell Script (Recommended for Windows)

```powershell
# 1. Get JWT token
$Token = (Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8180/realms/ananta-saas/protocol/openid-connect/token" `
  -Body @{
    client_id = "admin-cli"
    username = "admin"
    password = "admin"
    grant_type = "password"
  }).access_token

# 2. Set environment variable
$env:TOKEN = $Token

# 3. Run tests
.\test-control-plane.ps1
```

### Option 2: Bash Script (Linux/Mac/WSL)

```bash
# 1. Get JWT token
TOKEN=$(curl -s -X POST "http://localhost:8180/realms/ananta-saas/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=admin-cli" \
  -d "username=admin" \
  -d "password=admin" \
  -d "grant_type=password" | grep -oP '"access_token"\s*:\s*"\K[^"]+')

# 2. Export token
export TOKEN

# 3. Run tests
bash test-endpoints.sh
```

### Option 3: Manual cURL

```bash
# Set your token
TOKEN="your-jwt-token-here"

# Test authenticated endpoint
curl -s http://localhost:27400/api/control-plane/plans \
  -H "Authorization: Bearer $TOKEN"

# Test without auth (should return 401)
curl -s http://localhost:27400/api/control-plane/plans
```

---

## Prerequisites Checklist

Before testing, ensure these are running:

- [ ] **Keycloak** (`arc-saas-keycloak`) - Port 8180
  ```bash
  docker start arc-saas-keycloak
  # Wait 30 seconds, then verify:
  curl http://localhost:8180/health/ready
  ```

- [ ] **PostgreSQL** (`arc-saas-postgres`) - Port 5432
  ```bash
  docker start arc-saas-postgres
  # Verify:
  docker exec arc-saas-postgres pg_isready -U postgres
  ```

- [ ] **Control Plane API** (tenant-management-service) - Port 14000
  ```bash
  cd arc-saas/services/tenant-management-service
  bun run start
  # In another terminal, verify:
  curl http://localhost:14000/ping
  ```

- [ ] **Dashboard (Production)** (`app-plane-dashboard`) - Port 27400
  ```bash
  # Build frontend first
  cd app-plane/services/dashboard
  bun run build

  # Rebuild container
  cd ../..
  docker-compose build --no-cache dashboard

  # Restart
  docker restart app-plane-dashboard

  # Verify:
  curl http://localhost:27400/api/health
  ```

---

## Expected Test Results

### Test 1: Plans (with auth)
- **Status**: HTTP 200
- **Response**: JSON array of subscription plans
```json
[
  {
    "id": "plan-basic",
    "name": "Basic",
    "price": 29,
    "tier": "basic"
  }
]
```

### Test 2: Subscriptions (with auth)
- **Status**: HTTP 200
- **Response**: JSON array of subscriptions

### Test 3: User Invitations (with auth)
- **Status**: HTTP 200
- **Response**: JSON array of invitations

### Test 4-7: Billing Analytics (with auth)
- **Status**: HTTP 200
- **Response**: JSON objects with metrics

### Test 8: Plans (no auth)
- **Status**: HTTP 401
- **Response**: Error message about missing/invalid token

---

## Troubleshooting

### Error: "Connection refused on port 27400"

**Cause**: Dashboard container not running or not built with latest code

**Solution**:
```bash
cd app-plane/services/dashboard
bun run build
cd ../..
docker-compose build --no-cache dashboard
docker restart app-plane-dashboard
```

### Error: "401 Unauthorized" (even with token)

**Cause**: Token expired or invalid

**Solution**: Get fresh token (tokens expire after 60 minutes by default)

### Error: "404 Not Found"

**Cause**: Dashboard doesn't have the Control Plane proxy endpoints

**Solution**: Verify you're testing the correct code:
```bash
# Check if proxy files exist
ls app-plane/services/dashboard/src/pages/api/control-plane/
# Should show: plans.ts, subscriptions.ts, user-invitations.ts, billing-analytics.ts
```

### Error: "500 Internal Server Error"

**Cause**: Control Plane API not running or database issue

**Solution**:
```bash
# Check Control Plane
curl http://localhost:14000/ping

# Check logs
cd arc-saas/services/tenant-management-service
# Check terminal output

# Check database
docker exec arc-saas-postgres pg_isready -U postgres
```

---

## Next Steps After Successful Testing

Once all tests pass:

1. ✅ **Document Results** - Save test output
2. 🔄 **Frontend Integration** - Update React Admin components
3. 🧪 **Unit Tests** - Create automated tests
4. 🧪 **Integration Tests** - Create API route tests
5. 🚀 **Deploy to Staging** - Test in staging environment

---

## Files Available for Testing

| File | Purpose |
|------|---------|
| [test-control-plane.ps1](./test-control-plane.ps1) | PowerShell test script (Windows) |
| [test-endpoints.sh](./test-endpoints.sh) | Bash test script (Linux/Mac/WSL) |
| [MANUAL_TESTING_GUIDE.md](./MANUAL_TESTING_GUIDE.md) | Comprehensive testing guide |
| [CONTROL_PLANE_INTEGRATION.md](./CONTROL_PLANE_INTEGRATION.md) | Technical integration guide |
| [CONTROL_PLANE_API_REFERENCE.md](./CONTROL_PLANE_API_REFERENCE.md) | API endpoint reference |

---

## Quick Commands Reference

```bash
# Start all services
docker start arc-saas-keycloak arc-saas-postgres
cd arc-saas/services/tenant-management-service && bun run start &

# Build and deploy Dashboard
cd app-plane/services/dashboard && bun run build
cd ../.. && docker-compose build --no-cache dashboard
docker restart app-plane-dashboard

# Get token and test (bash)
TOKEN=$(curl -s -X POST "http://localhost:8180/realms/ananta-saas/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=admin-cli" -d "username=admin" -d "password=admin" -d "grant_type=password" | \
  grep -oP '"access_token"\s*:\s*"\K[^"]+')
export TOKEN
bash test-endpoints.sh

# Get token and test (PowerShell)
$Token = (Invoke-RestMethod -Method Post -Uri "http://localhost:8180/realms/ananta-saas/protocol/openid-connect/token" \
  -Body @{client_id="admin-cli";username="admin";password="admin";grant_type="password"}).access_token
$env:TOKEN = $Token
.\test-control-plane.ps1
```

---

**Ready to test!** Start with the prerequisites checklist, then run the test script for your platform.
