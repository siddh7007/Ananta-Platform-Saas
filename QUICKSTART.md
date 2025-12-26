# Ananta Platform SaaS - Quick Start Guide

## Immediate Fix for Current Issues

The platform is experiencing cascading failures due to Temporal infrastructure misconfiguration. Follow these steps to fix it:

### Step 1: Fix Temporal Infrastructure (5 minutes)

```powershell
# Run the fix script
.\fix-temporal-infrastructure.ps1
```

This script will:
1. Start Components V2 Temporal (`components-v2-temporal`)
2. Create network alias `shared-temporal` → `components-v2-temporal`
3. Restart failing services (`arc-saas-tenant-mgmt`, `arc-saas-temporal-worker`, `app-plane-cns-worker`)
4. Verify Temporal connectivity

### Step 2: Verify Everything is Working

```powershell
# Check all services status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | findstr "temporal\|tenant-mgmt\|cns-worker"

# Check Temporal UI (should show arc-saas and enrichment namespaces)
# Open: http://localhost:27021

# Check Control Plane API
curl http://localhost:14000/ping

# Check CNS Service
curl http://localhost:27200/health

# Check Customer Portal (should no longer show 502)
# Open: http://localhost:27100/platform/tenants/my-tenants
```

### Step 3: Check Temporal Workers Are Registered

```powershell
# Check Control Plane worker
docker exec components-v2-temporal tctl --namespace arc-saas task-queue describe --task-queue tenant-provisioning

# Check App Plane worker
docker exec components-v2-temporal tctl --namespace enrichment task-queue describe --task-queue cns-enrichment
```

You should see active pollers listed for both task queues.

---

## Full Platform Startup (From Scratch)

If you need to start everything from scratch:

### Option 1: Use Existing Script (Recommended)

```powershell
# Start everything with proper dependency order
.\start-platform.ps1
```

### Option 2: Manual Startup (Step-by-Step)

#### Phase 1: Temporal Infrastructure

```powershell
cd e:\Work\Ananta-Platform-Saas\components-platform-v2-ref
docker-compose up -d temporal-postgres temporal temporal-ui

# Wait for health (2-3 minutes)
docker ps --filter "name=temporal"

# Create network alias
docker network create shared-temporal-network
docker network connect --alias shared-temporal shared-temporal-network components-v2-temporal
```

#### Phase 2: Control Plane - Infrastructure

```powershell
cd e:\Work\Ananta-Platform-Saas\arc-saas
docker-compose up -d postgres redis keycloak minio

# Wait for keycloak (takes 60-90 seconds)
docker logs arc-saas-keycloak -f
# Wait until you see "Keycloak 23.0 (WildFly Core ...) started"
```

#### Phase 3: Control Plane - Core Services

```powershell
cd e:\Work\Ananta-Platform-Saas\arc-saas
docker-compose up -d tenant-management-service temporal-worker-service

# Check logs for Temporal connection
docker logs arc-saas-tenant-mgmt --tail 50
# Should see "Temporal connection established" or similar
```

#### Phase 4: App Plane - Databases

```powershell
cd e:\Work\Ananta-Platform-Saas\app-plane
docker-compose up -d supabase-db components-v2-postgres redis rabbitmq minio

# Wait for databases (1-2 minutes)
docker ps --filter "name=app-plane-.*-db\|app-plane-.*-postgres"
```

#### Phase 5: App Plane - Backend

```powershell
cd e:\Work\Ananta-Platform-Saas\app-plane
docker-compose up -d supabase-api supabase-meta supabase-studio
docker-compose up -d cns-service cns-worker

# Check CNS worker logs
docker logs app-plane-cns-worker --tail 50
# Should NOT be restarting continuously
```

#### Phase 6: Frontend Applications

```powershell
# App Plane frontends
cd e:\Work\Ananta-Platform-Saas\app-plane
docker-compose up -d customer-portal dashboard cns-dashboard

# Control Plane frontends
cd e:\Work\Ananta-Platform-Saas\arc-saas
docker-compose up -d admin-app customer-portal
```

---

## Service URLs

### Control Plane
- **Tenant Management API**: http://localhost:14000
- **Admin Portal**: http://localhost:27555
- **Keycloak**: http://localhost:8180 (admin/admin)
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin123)
- **Novu Dashboard**: http://localhost:14200

### App Plane
- **Customer Portal (CBP)**: http://localhost:27100
- **CNS Service API**: http://localhost:27200
- **CNS Dashboard**: http://localhost:27250
- **Django Backend**: http://localhost:27000
- **Supabase Studio**: http://localhost:27800
- **Dashboard**: http://localhost:27400
- **MinIO Console**: http://localhost:27041

### Temporal
- **Temporal UI**: http://localhost:27021
- **Temporal gRPC**: localhost:27020

---

## Common Issues

### Issue: "shared-temporal" DNS lookup fails

**Symptoms**:
```
dns error: failed to lookup address information: Name or service not known
```

**Fix**:
```powershell
# Run the fix script
.\fix-temporal-infrastructure.ps1
```

### Issue: Keycloak takes forever to start

**Solution**: Keycloak startup takes 60-90 seconds on first start. Wait for:
```
Keycloak 23.0 (WildFly Core ...) started in XXXXms
```

### Issue: CNS worker keeps restarting

**Cause**: Cannot connect to Temporal

**Fix**:
```powershell
# Check Temporal is running
docker ps --filter "name=temporal"

# Check network connectivity
docker exec app-plane-cns-worker ping -c 1 shared-temporal

# If fails, run fix script
.\fix-temporal-infrastructure.ps1
```

### Issue: Customer Portal shows 502 on /platform/tenants/my-tenants

**Cause**: `tenant-management-service` is down

**Fix**:
```powershell
# Check service logs
docker logs arc-saas-tenant-mgmt --tail 50

# Most likely Temporal connection issue
# Run fix script
.\fix-temporal-infrastructure.ps1

# Then restart tenant-mgmt
docker restart arc-saas-tenant-mgmt
```

---

## Health Check Commands

```powershell
# Check all Temporal containers
docker ps --filter "name=temporal" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check all Control Plane services
docker ps --filter "name=arc-saas" --format "table {{.Names}}\t{{.Status}}"

# Check all App Plane services
docker ps --filter "name=app-plane" --format "table {{.Names}}\t{{.Status}}"

# Check specific service logs
docker logs <container-name> --tail 50

# Check which networks a container is on
docker inspect <container-name> --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'

# Check if a service can reach Temporal
docker exec <container-name> curl -f http://shared-temporal:7233 || echo "FAILED"
```

---

## Stopping Services

```powershell
# Stop everything
cd e:\Work\Ananta-Platform-Saas\arc-saas
docker-compose down

cd e:\Work\Ananta-Platform-Saas\app-plane
docker-compose down

cd e:\Work\Ananta-Platform-Saas\components-platform-v2-ref
docker-compose down

# Or use docker directly
docker stop $(docker ps -aq)
```

---

## Clean Start (Remove All Data)

**WARNING**: This will delete all data including databases, Redis cache, etc.

```powershell
# Stop and remove all containers, networks, volumes
cd e:\Work\Ananta-Platform-Saas\arc-saas
docker-compose down -v

cd e:\Work\Ananta-Platform-Saas\app-plane
docker-compose down -v

cd e:\Work\Ananta-Platform-Saas\components-platform-v2-ref
docker-compose down -v

# Start fresh
.\start-platform.ps1
```

---

## Documentation

- **Full Dependency Map**: `DOCKER_DEPENDENCY_MAP.md`
- **Platform Overview**: `CLAUDE.md`
- **API Specs**: `arc-saas/docs/API-SPEC.md`
- **Deployment Strategy**: `DEPLOYMENT_STRATEGY.md`

---

**Last Updated**: 2025-12-17
