# Docker Infrastructure Dependency Map & Startup Sequence

## Executive Summary

The platform uses **THREE separate Docker infrastructure setups**:

1. **Shared Temporal Infrastructure** (components-platform-v2-ref) - Port 27020
2. **Control Plane** (arc-saas) - Ports 14000, 8180, etc.
3. **App Plane** (app-plane) - Ports 27xxx range

**CRITICAL ISSUE IDENTIFIED**: The services are configured to use `shared-temporal:7233` but:
- No container named `shared-temporal` exists
- The actual Temporal server is in `components-platform-v2-ref` named `components-v2-temporal`
- Services cannot resolve DNS name `shared-temporal` leading to cascading failures

---

## Current Infrastructure Analysis

### 1. Shared Temporal Infrastructure (Components Platform V2 Reference)

**Location**: `e:\Work\Ananta-Platform-Saas\components-platform-v2-ref\docker-compose.yml`

**Network**: `components-v2-network`

**Key Services**:
```
components-v2-temporal-postgres  → Port 27030 (Temporal's dedicated database)
components-v2-temporal           → Port 27020:7233 (Temporal server)
components-v2-temporal-ui        → Port 27021 (Temporal UI)
components-v2-postgres           → Port 27010 (Component catalog SSOT)
components-v2-rabbitmq           → Port 27250 (AMQP), 27252 (Mgmt)
components-v2-redis              → Port 27012
```

**Status**: Container `components-v2-temporal` exists but is **NOT running**

**Configuration**:
- Image: `temporalio/auto-setup:1.22.0`
- Database: Dedicated PostgreSQL on `temporal-postgres:5432`
- Namespaces: `default`, `enrichment`, `arc-saas` (created via init script)

---

### 2. Control Plane (ARC-SaaS)

**Location**: `e:\Work\Ananta-Platform-Saas\arc-saas\docker-compose.yml`

**Networks**:
- `arc-saas-network` (internal, bridge)
- `shared-temporal-network` (external - expects shared Temporal)
- `components-v2-network` (external - disabled/commented)

**Key Services**:

#### Infrastructure Layer (Priority 1)
```
arc-saas-postgres         → Port 5432 (Control plane database)
arc-saas-redis            → Port 6379 (Lead tokens, caching)
arc-saas-keycloak         → Port 8180 (IAM - shared with App Plane)
arc-saas-minio            → Port 9000 (S3 API), 9001 (Console)
arc-saas-novu-mongo       → Port 27017 (Novu database)
arc-saas-novu-redis       → Port 6380 (Novu cache)
```

#### Application Layer (Priority 2)
```
arc-saas-tenant-mgmt      → Port 14000 (Main Control Plane API)
  Dependencies: postgres, redis, keycloak
  Temporal: TEMPORAL_ADDRESS=shared-temporal:7233 ❌ BROKEN DNS
  Namespace: arc-saas
  Task Queue: tenant-provisioning

arc-saas-temporal-worker  → No HTTP port (Background worker)
  Dependencies: postgres, minio
  Temporal: TEMPORAL_ADDRESS=shared-temporal:7233 ❌ BROKEN DNS
  Namespace: arc-saas
  Task Queue: tenant-provisioning

arc-saas-admin-app        → Port 27555 (Admin portal)
arc-saas-customer-portal  → Port 27100 (Customer portal)
```

#### Notification Services (Priority 3)
```
arc-saas-novu-api         → Port 13100
arc-saas-novu-ws          → Port 13101
arc-saas-novu-worker      → Background
arc-saas-novu-web         → Port 14200
```

**Temporal Configuration Files**:
- `arc-saas/docker-compose.temporal.yml` - Standalone Temporal (DEPRECATED, not used)
- Comments indicate: "Temporal is now provided by Components Platform V2"

---

### 3. App Plane

**Location**: `e:\Work\Ananta-Platform-Saas\app-plane\docker-compose.yml`

**Networks**:
- `app-plane-network` (internal, bridge, name: `app-plane`)
- `arc-saas-network` (external - connects to Control Plane)
- `shared-temporal-network` (external - expects shared Temporal)

**Key Services**:

#### Database Layer (Priority 1)
```
app-plane-supabase-db             → Port 27432 (Tenant business data)
app-plane-components-v2-postgres  → Port 27010 (Component catalog SSOT)
app-plane-redis                   → Port 27012 (Cache)
app-plane-rabbitmq                → Port 27672 (AMQP), 27673 (Mgmt)
app-plane-minio                   → Port 27040 (S3), 27041 (Console)
```

#### Backend Services (Priority 2)
```
app-plane-cns-service     → Port 27200 (Component Normalization Service)
  Dependencies: supabase-db, components-v2-postgres, redis, rabbitmq, minio
  Temporal: TEMPORAL_HOST=shared-temporal:7233 ❌ BROKEN DNS
  Namespace: enrichment
  Task Queue: cns-enrichment

app-plane-cns-worker      → Background worker
  Dependencies: supabase-db, components-v2-postgres, redis
  Temporal: TEMPORAL_HOST=shared-temporal:7233 ❌ BROKEN DNS
  Status: Restarting continuously due to DNS failure

app-plane-django-backend  → Port 27000
app-plane-middleware-api  → Port 27300 (Flask orchestration)
app-plane-webhook-bridge  → Port 27600
app-plane-audit-logger    → Background
```

#### Frontend Services (Priority 3)
```
app-plane-customer-portal    → Port 27100 (Bun dev server)
app-plane-dashboard          → Port 27400 (Next.js)
app-plane-backstage-portal   → Port 27150
app-plane-cns-dashboard      → Port 27250
```

#### Supabase Services (Priority 2)
```
app-plane-supabase-api       → Port 27810 (PostgREST)
app-plane-supabase-studio    → Port 27800 (DB admin)
app-plane-supabase-meta      → Internal (Metadata API)
```

---

## Root Cause Analysis

### DNS Resolution Failure

All services are configured to connect to `shared-temporal:7233`, but:

1. **No container named `shared-temporal` exists**
2. Actual container is `components-v2-temporal` on network `components-v2-network`
3. Services are on `shared-temporal-network` but container is NOT attached to it
4. Only `app-plane-cns-service` is currently attached to `shared-temporal-network`

### Network Isolation Issues

```
Arc-SaaS Services:
  arc-saas-network (bridge)
    ├─ postgres, redis, keycloak, minio
    ├─ tenant-mgmt (also on shared-temporal-network) ❌
    └─ temporal-worker (also on shared-temporal-network) ❌

App-Plane Services:
  app-plane-network (bridge)
    ├─ supabase-db, components-v2-postgres, redis, rabbitmq
    ├─ cns-service (also on arc-saas, shared-temporal-network) ✓
    └─ cns-worker (also on arc-saas, shared-temporal-network) ❌

Shared Temporal:
  components-v2-network (bridge)
    ├─ components-v2-temporal ✓
    ├─ components-v2-temporal-postgres ✓
    └─ (NOT on shared-temporal-network) ❌
```

### Container Status

```bash
# Temporal containers - ALL DOWN
temporal                   Exited (137) 7 minutes ago
temporal-postgresql        Exited (0) 7 minutes ago
arc-saas-temporal          Exited (1) 3 days ago
components-v2-temporal     NOT RUNNING

# Control Plane - ALL DOWN
arc-saas-tenant-mgmt       Exited (1) 15 minutes ago
arc-saas-temporal-worker   Exited (1) 15 minutes ago

# App Plane - RESTART LOOP
app-plane-cns-worker       Restarting (1) every ~60s
```

**Error Messages**:
- `arc-saas-tenant-mgmt`: "Cannot start the application. Error: Failed to connect before the deadline"
- `app-plane-cns-worker`: "dns error: failed to lookup address information: Name or service not known"

---

## Solution: Proper Infrastructure Setup

### Option A: Use Components-V2 Temporal (RECOMMENDED)

**Requires**:
1. Start `components-v2-temporal` from `components-platform-v2-ref`
2. Create network alias `shared-temporal` → `components-v2-temporal`
3. Connect both arc-saas and app-plane services to `components-v2-network`

**Implementation**:

```bash
# 1. Start Components V2 infrastructure (includes Temporal)
cd e:\Work\Ananta-Platform-Saas\components-platform-v2-ref
docker-compose up -d temporal-postgres temporal temporal-ui

# 2. Create network alias for backwards compatibility
docker network connect --alias shared-temporal shared-temporal-network components-v2-temporal

# 3. Verify Temporal is accessible
docker exec arc-saas-tenant-mgmt curl -f http://components-v2-temporal:7233/health
```

### Option B: Create Dedicated Shared Temporal Container

**Create**: `e:\Work\Ananta-Platform-Saas\shared-temporal\docker-compose.yml`

```yaml
version: "3.8"

networks:
  shared-temporal-network:
    name: shared-temporal-network
    driver: bridge

volumes:
  temporal-postgres-data:

services:
  temporal-postgres:
    image: postgres:15-alpine
    container_name: shared-temporal-postgres
    environment:
      POSTGRES_USER: temporal
      POSTGRES_PASSWORD: temporal_secure_2025
      POSTGRES_DB: temporal
    ports:
      - "27030:5432"
    volumes:
      - temporal-postgres-data:/var/lib/postgresql/data
    networks:
      - shared-temporal-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U temporal"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  shared-temporal:
    image: temporalio/auto-setup:1.24.2
    container_name: shared-temporal
    depends_on:
      temporal-postgres:
        condition: service_healthy
    environment:
      - DB=postgres12
      - DB_PORT=5432
      - POSTGRES_USER=temporal
      - POSTGRES_PWD=temporal_secure_2025
      - POSTGRES_SEEDS=temporal-postgres
      - DYNAMIC_CONFIG_FILE_PATH=config/dynamicconfig/development-sql.yaml
      - ENABLE_ES=false
    ports:
      - "27020:7233"
    networks:
      - shared-temporal-network
    healthcheck:
      test: ["CMD", "tctl", "cluster", "health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s
    restart: unless-stopped

  shared-temporal-ui:
    image: temporalio/ui:2.26.2
    container_name: shared-temporal-ui
    depends_on:
      - shared-temporal
    environment:
      - TEMPORAL_ADDRESS=shared-temporal:7233
      - TEMPORAL_CORS_ORIGINS=http://localhost:3000,http://localhost:8080
      - TEMPORAL_UI_PORT=8080
    ports:
      - "27021:8080"
    networks:
      - shared-temporal-network
    restart: unless-stopped
```

**Startup**:
```bash
cd e:\Work\Ananta-Platform-Saas\shared-temporal
docker-compose up -d
```

---

## Correct Startup Sequence

### Phase 1: Shared Infrastructure (5-10 minutes)

```bash
# Option A: Components V2 Temporal
cd e:\Work\Ananta-Platform-Saas\components-platform-v2-ref
docker-compose up -d temporal-postgres temporal temporal-ui

# OR Option B: Dedicated Shared Temporal
cd e:\Work\Ananta-Platform-Saas\shared-temporal
docker-compose up -d

# Wait for health checks
docker ps --filter "name=temporal" --format "{{.Names}}: {{.Status}}"
```

**Wait for**:
- `temporal-postgres` → healthy (30-60 seconds)
- `temporal` → healthy (60-120 seconds)
- Namespaces created: `default`, `arc-saas`, `enrichment`

### Phase 2: Control Plane - Infrastructure (2-3 minutes)

```bash
cd e:\Work\Ananta-Platform-Saas\arc-saas
docker-compose up -d postgres redis keycloak minio novu-mongodb novu-redis
```

**Wait for**:
- `arc-saas-postgres` → healthy (30 seconds)
- `arc-saas-redis` → healthy (10 seconds)
- `arc-saas-keycloak` → healthy (60-90 seconds)
- `arc-saas-minio` → healthy (20 seconds)

### Phase 3: Control Plane - Core Services (1-2 minutes)

```bash
cd e:\Work\Ananta-Platform-Saas\arc-saas
docker-compose up -d tenant-management-service temporal-worker-service

# Check logs for Temporal connection
docker logs arc-saas-tenant-mgmt --tail 50 | grep -i "temporal\|connected"
docker logs arc-saas-temporal-worker --tail 50 | grep -i "temporal\|worker"
```

**Wait for**:
- `tenant-management-service` → Port 14000 responding
- Temporal connection established
- Worker registered on `tenant-provisioning` task queue

### Phase 4: Control Plane - Notifications (Optional, 1 minute)

```bash
cd e:\Work\Ananta-Platform-Saas\arc-saas
docker-compose up -d novu-api novu-ws novu-worker novu-web
```

### Phase 5: App Plane - Databases (2-3 minutes)

```bash
cd e:\Work\Ananta-Platform-Saas\app-plane
docker-compose up -d supabase-db components-v2-postgres redis rabbitmq minio
```

**Wait for**:
- `app-plane-supabase-db` → healthy (30 seconds)
- `app-plane-components-v2-postgres` → healthy (30 seconds)
- `app-plane-redis` → healthy (10 seconds)
- `app-plane-rabbitmq` → healthy (40 seconds)

### Phase 6: App Plane - Backend Services (1-2 minutes)

```bash
cd e:\Work\Ananta-Platform-Saas\app-plane
docker-compose up -d supabase-api supabase-meta supabase-studio
docker-compose up -d cns-service cns-worker
docker-compose up -d django-backend middleware-api webhook-bridge audit-logger
```

**Wait for**:
- `cns-service` → Port 27200 responding
- `cns-worker` → Connected to Temporal (no restart loop)
- Verify CNS worker registered on `cns-enrichment` task queue

### Phase 7: App Plane - Frontend (1 minute)

```bash
cd e:\Work\Ananta-Platform-Saas\app-plane
docker-compose up -d customer-portal dashboard backstage-portal cns-dashboard
```

### Phase 8: Control Plane - Frontend (1 minute)

```bash
cd e:\Work\Ananta-Platform-Saas\arc-saas
docker-compose up -d admin-app customer-portal
```

---

## Verification Commands

### Check All Container Status

```bash
# Temporal infrastructure
docker ps --filter "name=temporal" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Control Plane
docker ps --filter "name=arc-saas" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# App Plane
docker ps --filter "name=app-plane" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Check Network Connectivity

```bash
# Verify tenant-mgmt can reach Temporal
docker exec arc-saas-tenant-mgmt curl -f http://shared-temporal:7233 || echo "FAILED"

# Verify CNS worker can reach Temporal
docker exec app-plane-cns-worker curl -f http://shared-temporal:7233 || echo "FAILED"

# Check which networks a container is on
docker inspect arc-saas-tenant-mgmt --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
```

### Check Temporal Namespaces

```bash
# List namespaces
docker exec shared-temporal tctl --namespace arc-saas namespace describe
docker exec shared-temporal tctl --namespace enrichment namespace describe

# List workers
docker exec shared-temporal tctl --namespace arc-saas task-queue describe --task-queue tenant-provisioning
docker exec shared-temporal tctl --namespace enrichment task-queue describe --task-queue cns-enrichment
```

### Health Check Endpoints

```bash
# Control Plane API
curl http://localhost:14000/ping
curl http://localhost:14000/health

# CNS Service
curl http://localhost:27200/health

# Temporal UI
curl http://localhost:27021

# Keycloak
curl http://localhost:8180/health/ready
```

---

## Common Issues & Troubleshooting

### Issue 1: "shared-temporal" DNS resolution fails

**Symptoms**:
```
RuntimeError: Failed client connect: dns error: failed to lookup address information
```

**Cause**: Container name mismatch

**Fix**:
```bash
# Check if shared-temporal exists
docker ps -a --filter "name=shared-temporal"

# If not, either:
# A) Start dedicated shared-temporal container
# B) Create alias: docker network connect --alias shared-temporal shared-temporal-network components-v2-temporal
```

### Issue 2: Tenant-mgmt cannot connect to Temporal

**Symptoms**:
```
Error: Failed to connect before the deadline
```

**Cause**: Temporal not running or network issue

**Fix**:
```bash
# Check Temporal status
docker ps --filter "name=temporal"

# Check network attachment
docker network inspect shared-temporal-network

# Restart tenant-mgmt after Temporal is up
docker-compose restart tenant-management-service
```

### Issue 3: CNS worker restart loop

**Symptoms**:
```
Restarting (1) every 60 seconds
```

**Cause**: Cannot connect to Temporal

**Fix**:
```bash
# Check logs
docker logs app-plane-cns-worker --tail 50

# Verify Temporal connection from within container
docker exec app-plane-cns-service curl -f http://shared-temporal:7233

# If fails, check network
docker network connect shared-temporal-network app-plane-cns-worker
docker-compose restart cns-worker
```

### Issue 4: Customer Portal 502 on /platform/tenants/my-tenants

**Symptoms**:
```
502 Bad Gateway
```

**Cause**: `tenant-management-service` (port 14000) is down

**Dependency Chain**:
```
Customer Portal → tenant-management-service → Temporal → temporal-postgres
```

**Fix**: Follow startup sequence Phases 1-3 in order

### Issue 5: Services cannot find each other across planes

**Symptoms**:
```
connection refused to tenant-management-service:14000
```

**Cause**: Network isolation - services not on same network

**Fix**:
```bash
# Connect app-plane service to arc-saas network
docker network connect arc-saas app-plane-cns-service

# Or edit docker-compose.yml to include both networks
```

---

## Network Topology Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   SHARED TEMPORAL INFRASTRUCTURE                 │
│                  (shared-temporal-network)                       │
│  ┌──────────────────┐      ┌──────────────────┐                │
│  │ temporal-postgres│─────▶│  shared-temporal │                │
│  │  (27030:5432)    │      │   (27020:7233)   │                │
│  └──────────────────┘      └──────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
               │                        │
               │                        │
               ▼                        ▼
┌──────────────────────────┐  ┌───────────────────────────────┐
│   CONTROL PLANE          │  │      APP PLANE                 │
│   (arc-saas-network)     │  │   (app-plane-network)         │
│                          │  │                                │
│  ┌────────────────┐      │  │  ┌──────────────────────┐    │
│  │ tenant-mgmt    │      │  │  │ cns-service          │    │
│  │ (14000)        │◀─────┼──┼─▶│ (27200)              │    │
│  └────────────────┘      │  │  └──────────────────────┘    │
│         │                │  │            │                   │
│  ┌────────────────┐      │  │  ┌──────────────────────┐    │
│  │ temporal-worker│      │  │  │ cns-worker           │    │
│  └────────────────┘      │  │  └──────────────────────┘    │
│         │                │  │            │                   │
│  ┌────────────────┐      │  │  ┌──────────────────────┐    │
│  │ postgres:5432  │      │  │  │ supabase-db:27432    │    │
│  │ redis:6379     │      │  │  │ components-v2:27010  │    │
│  │ keycloak:8180  │◀─────┼──┼─▶│ redis:27012          │    │
│  │ minio:9000     │      │  │  │ rabbitmq:27672       │    │
│  └────────────────┘      │  │  └──────────────────────┘    │
└──────────────────────────┘  └───────────────────────────────┘
```

---

## Port Reference (Complete)

### Shared Temporal
```
27020  Temporal gRPC
27021  Temporal UI
27030  Temporal PostgreSQL
```

### Control Plane (arc-saas)
```
5432   PostgreSQL (arc_saas database)
6379   Redis (lead tokens)
6380   Novu Redis
8180   Keycloak (shared with App Plane)
9000   MinIO S3 API
9001   MinIO Console
13100  Novu API
13101  Novu WebSocket
14000  Tenant Management Service (main API)
14088  Temporal UI (legacy, not used)
14200  Novu Web Dashboard
27017  Novu MongoDB
27100  Customer Portal (CBP)
27555  Admin Portal
```

### App Plane
```
27000  Django Backend
27010  Components V2 PostgreSQL (catalog SSOT)
27012  Redis
27040  MinIO S3 API
27041  MinIO Console
27100  Customer Portal (duplicate port with arc-saas)
27150  Backstage Portal
27200  CNS Service API
27250  CNS Dashboard
27300  Middleware API
27400  Dashboard (Next.js)
27432  Supabase PostgreSQL
27600  Webhook Bridge
27672  RabbitMQ AMQP
27673  RabbitMQ Management
27800  Supabase Studio
27810  Supabase API (PostgREST)
```

---

## Environment Variable Alignment

### Services Expecting `shared-temporal:7233`

| Service | Env Var | Current Value | Network |
|---------|---------|---------------|---------|
| tenant-management-service | `TEMPORAL_ADDRESS` | `shared-temporal:7233` | shared-temporal-network ✓ |
| temporal-worker-service | `TEMPORAL_ADDRESS` | `shared-temporal:7233` | shared-temporal-network ✓ |
| cns-service | `TEMPORAL_HOST` | `shared-temporal:7233` | shared-temporal-network ✓ |
| cns-worker | `TEMPORAL_HOST` | `shared-temporal:7233` | shared-temporal-network ✓ |
| audit-logger | `TEMPORAL_HOST` | `shared-temporal:7233` | shared-temporal-network ❌ |

### Alternative: Change to `components-v2-temporal:7233`

If using Components V2 Temporal directly without alias:

```bash
# arc-saas/.env
TEMPORAL_ADDRESS=components-v2-temporal:7233

# app-plane/.env
TEMPORAL_HOST=components-v2-temporal:7233
TEMPORAL_URL=components-v2-temporal:7233
```

Then connect services to `components-v2-network` instead of `shared-temporal-network`.

---

## Recommended Actions

1. **Immediate Fix**:
   ```bash
   # Start Components V2 Temporal
   cd e:\Work\Ananta-Platform-Saas\components-platform-v2-ref
   docker-compose up -d temporal-postgres temporal temporal-ui

   # Create network alias
   docker network connect --alias shared-temporal shared-temporal-network components-v2-temporal

   # Restart failing services
   docker restart arc-saas-tenant-mgmt arc-saas-temporal-worker app-plane-cns-worker
   ```

2. **Long-term Solution**:
   - Create dedicated `shared-temporal/docker-compose.yml`
   - Document it in CLAUDE.md
   - Add to startup scripts
   - Add health checks to all dependent services

3. **Monitoring**:
   - Add Temporal health checks to CI/CD
   - Set up alerts for worker disconnections
   - Monitor namespace/task queue registrations

---

## Summary of Failures

| Service | Issue | Root Cause | Impact |
|---------|-------|------------|--------|
| `arc-saas-tenant-mgmt` | Cannot start | Temporal DNS lookup fails | 502 on Customer Portal `/platform/tenants/my-tenants` |
| `arc-saas-temporal-worker` | Cannot connect | Temporal DNS lookup fails | Tenant provisioning workflows broken |
| `app-plane-cns-worker` | Restart loop | Temporal DNS lookup fails | BOM enrichment workflows broken |
| Customer Portal | 502 errors | Upstream `tenant-mgmt` down | Users cannot access tenant data |

**Cascading Failure Chain**:
```
Temporal not running
  → DNS resolution fails for shared-temporal:7233
    → tenant-management-service crashes
      → Customer Portal returns 502
    → cns-worker restart loop
      → BOM enrichment workflows fail
```

---

## Files Referenced

- `e:\Work\Ananta-Platform-Saas\arc-saas\docker-compose.yml`
- `e:\Work\Ananta-Platform-Saas\arc-saas\docker-compose.temporal.yml` (deprecated)
- `e:\Work\Ananta-Platform-Saas\arc-saas\docker-compose.dev.yml`
- `e:\Work\Ananta-Platform-Saas\app-plane\docker-compose.yml`
- `e:\Work\Ananta-Platform-Saas\components-platform-v2-ref\docker-compose.yml`
- `e:\Work\Ananta-Platform-Saas\arc-saas\services\tenant-management-service\.env`
- `e:\Work\Ananta-Platform-Saas\arc-saas\services\temporal-worker-service\.env`
- `e:\Work\Ananta-Platform-Saas\app-plane\.env`

---

**Generated**: 2025-12-17
**Status**: CRITICAL - Infrastructure misconfiguration causing platform-wide failures
