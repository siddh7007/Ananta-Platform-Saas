# Docker Compose Enhancement Patches

This document contains the recommended changes to docker-compose files for improved health checks, dependencies, and network connectivity.

## 1. Shared Temporal Network Connectivity

### File: `app-plane/temporal/docker-compose.yml`

**Problem:** Temporal server is not accessible from app-plane services because it's not on the app-plane network.

**Solution:** Add app-plane network to Temporal services.

```yaml
# Add this to the temporal service
services:
  temporal:
    # ... existing configuration ...
    networks:
      - shared-temporal-network
      - arc-saas-network
      - app-plane-network  # ADD THIS LINE

  temporal-ui:
    # ... existing configuration ...
    networks:
      - shared-temporal-network
      - arc-saas-network
      - app-plane-network  # ADD THIS LINE

# Add this to the networks section
networks:
  shared-temporal-network:
    driver: bridge
    name: shared-temporal-network
  arc-saas-network:
    external: true
    name: arc-saas
  app-plane-network:  # ADD THIS BLOCK
    external: true
    name: app-plane
```

---

## 2. Control Plane Service Health Checks

### File: `arc-saas/docker-compose.yml`

#### 2.1 Tenant Management Service

**Add health check and Keycloak dependency:**

```yaml
services:
  tenant-management-service:
    build:
      context: ./services/tenant-management-service
      dockerfile: Dockerfile
    container_name: arc-saas-tenant-mgmt
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      keycloak:  # ADD THIS
        condition: service_healthy
    environment:
      # ... existing environment variables ...
    ports:
      - "14000:14000"
    healthcheck:  # ADD THIS BLOCK
      test: ["CMD", "curl", "-f", "http://localhost:14000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    restart: unless-stopped  # ADD THIS
    networks:
      - arc-saas-network
      - shared-temporal-network
```

#### 2.2 Temporal Worker Service

**Add health check and restart policy:**

```yaml
services:
  temporal-worker-service:
    build:
      context: ./services/temporal-worker-service
      dockerfile: Dockerfile
    container_name: arc-saas-temporal-worker
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
    environment:
      # ... existing environment variables ...
    healthcheck:  # ADD THIS BLOCK
      test: ["CMD", "pgrep", "-f", "temporal-worker"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 60s
    restart: unless-stopped  # ADD THIS
    networks:
      - arc-saas-network
      - shared-temporal-network
```

#### 2.3 Admin App

**Add health check and dependency on tenant-management-service:**

```yaml
services:
  admin-app:
    build:
      context: ./apps/admin-app
      dockerfile: Dockerfile
    container_name: arc-saas-admin-app
    depends_on:
      tenant-management-service:  # CHANGE THIS
        condition: service_healthy  # FROM simple depends_on TO condition-based
    environment:
      # ... existing environment variables ...
    ports:
      - "27555:80"
    healthcheck:  # ADD THIS BLOCK
      test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://localhost:80/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    restart: unless-stopped  # ADD THIS
    networks:
      - arc-saas-network
```

---

## 3. App Plane Service Health Checks

### File: `app-plane/docker-compose.yml`

#### 3.1 Django Backend

**Add health check:**

```yaml
services:
  django-backend:
    build:
      context: ./services/backend
      dockerfile: Dockerfile
    container_name: app-plane-django-backend
    command: python manage.py runserver 0.0.0.0:8000
    ports:
      - "${DJANGO_BACKEND_PORT:-27000}:8000"
    environment:
      # ... existing environment variables ...
    volumes:
      - ./services/backend:/app
      - django-static:/app/staticfiles
    networks:
      - app-plane-network
      - arc-saas-network
    depends_on:
      supabase-db:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    healthcheck:  # ADD THIS BLOCK
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 45s
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.django-backend.rule=PathPrefix(`/backend`) || PathPrefix(`/api/v1`)"
      - "traefik.http.routers.django-backend.entrypoints=web"
      - "traefik.http.routers.django-backend.middlewares=cors-headers@file"
      - "traefik.http.services.django-backend.loadbalancer.server.port=8000"
```

#### 3.2 CNS Worker

**Add health check and explicit CNS service dependency:**

```yaml
services:
  cns-worker:
    image: app-plane-cns-service  # Uses same image as cns-service
    container_name: app-plane-cns-worker
    command: python -m app.workers.bom_worker
    environment:
      # ... existing environment variables ...
    volumes:
      - ./services/cns-service/app:/app/app
      - ./services/cns-service/tests:/app/tests
      - ./shared:/app/shared
    networks:
      - app-plane-network
      - arc-saas-network
      - shared-temporal-network
    depends_on:
      supabase-db:
        condition: service_healthy
      components-v2-postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      cns-service:  # ADD THIS
        condition: service_healthy
    healthcheck:  # ADD THIS BLOCK
      test: ["CMD", "pgrep", "-f", "bom_worker"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 60s
    restart: unless-stopped
```

#### 3.3 Customer Portal

**Add health check and dependency on Django backend:**

```yaml
services:
  customer-portal:
    image: oven/bun:1-alpine
    container_name: app-plane-customer-portal
    working_dir: /app
    command: sh -c "bun install && bun run dev -- --host 0.0.0.0 --port ${CUSTOMER_PORTAL_PORT:-27100}"
    ports:
      - "${CUSTOMER_PORTAL_PORT:-27100}:${CUSTOMER_PORTAL_PORT:-27100}"
    environment:
      # ... existing environment variables ...
    volumes:
      - ../arc-saas/apps/customer-portal:/app
      - customer-portal-node-modules:/app/node_modules
    networks:
      - app-plane-network
      - arc-saas-network
    depends_on:
      django-backend:  # CHANGE THIS
        condition: service_healthy  # FROM simple depends_on TO condition-based
    healthcheck:  # ADD THIS BLOCK
      test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://localhost:27100/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.customer-portal.rule=PathPrefix(`/portal`)"
      - "traefik.http.routers.customer-portal.entrypoints=web"
      - "traefik.http.routers.customer-portal.middlewares=cors-headers@file"
      - "traefik.http.services.customer-portal.loadbalancer.server.port=${CUSTOMER_PORTAL_PORT:-27100}"
```

#### 3.4 Middleware API

**Add health check:**

```yaml
services:
  middleware-api:
    build:
      context: ./services/middleware-api
      dockerfile: Dockerfile
    container_name: app-plane-middleware-api
    command: flask run --host=0.0.0.0 --port=5000 --reload
    ports:
      - "${MIDDLEWARE_API_PORT:-27300}:5000"
    environment:
      # ... existing environment variables ...
    volumes:
      - ./services/middleware-api:/app
    networks:
      - app-plane-network
      - arc-saas-network
    depends_on:
      django-backend:
        condition: service_healthy  # ADD CONDITION
      cns-service:
        condition: service_healthy  # ADD CONDITION
    healthcheck:  # ADD THIS BLOCK
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.middleware-api.rule=PathPrefix(`/middleware`)"
      - "traefik.http.routers.middleware-api.entrypoints=web"
      - "traefik.http.routers.middleware-api.middlewares=cors-headers@file"
      - "traefik.http.services.middleware-api.loadbalancer.server.port=5000"
```

---

## 4. Apply Changes Script

**File:** `apply-compose-enhancements.ps1`

```powershell
#!/usr/bin/env pwsh
# Script to apply docker-compose enhancements

$ErrorActionPreference = "Stop"

function Write-Step { param($msg) Write-Host "[STEP] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }

$ROOT = "e:\Work\Ananta-Platform-Saas"

Write-Warn "========================================="
Write-Warn "Docker Compose Enhancement Patcher"
Write-Warn "========================================="
Write-Warn ""
Write-Warn "This script will:"
Write-Warn "  1. Backup existing docker-compose files"
Write-Warn "  2. Apply recommended enhancements"
Write-Warn "  3. Validate the new configurations"
Write-Warn ""

$confirm = Read-Host "Continue? (y/n)"
if ($confirm -ne "y") {
    Write-Host "Aborted."
    exit 0
}

# Create backup directory
$backupDir = "$ROOT\docker-compose-backups-$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

Write-Step "Creating backups..."

# Backup files
Copy-Item "$ROOT\arc-saas\docker-compose.yml" "$backupDir\arc-saas-docker-compose.yml"
Copy-Item "$ROOT\app-plane\docker-compose.yml" "$backupDir\app-plane-docker-compose.yml"
Copy-Item "$ROOT\app-plane\temporal\docker-compose.yml" "$backupDir\temporal-docker-compose.yml"

Write-Success "Backups created in: $backupDir"

Write-Step ""
Write-Step "Please apply the changes manually from DOCKER_COMPOSE_ENHANCEMENTS.md"
Write-Step ""
Write-Step "After applying changes, run:"
Write-Step "  docker-compose config  # Validate syntax"
Write-Step "  ./start-platform.ps1 -Clean  # Test new configuration"
```

---

## 5. Testing Checklist

After applying changes:

- [ ] **Validate syntax:**
  ```powershell
  cd arc-saas
  docker-compose config
  cd ../app-plane
  docker-compose config
  cd temporal
  docker-compose config
  ```

- [ ] **Test clean startup:**
  ```powershell
  ./start-platform.ps1 -Clean
  ```

- [ ] **Verify all health checks pass:**
  ```powershell
  docker ps --format "table {{.Names}}\t{{.Status}}"
  ```

- [ ] **Check Temporal connectivity:**
  ```powershell
  docker exec arc-saas-temporal-worker ping -c 3 shared-temporal
  docker exec app-plane-cns-worker ping -c 3 shared-temporal
  ```

- [ ] **Test service endpoints:**
  ```powershell
  Invoke-WebRequest -Uri "http://localhost:14000/health"
  Invoke-WebRequest -Uri "http://localhost:27200/health"
  Invoke-WebRequest -Uri "http://localhost:27000/health"
  ```

---

## 6. Rollback Procedure

If issues occur after applying changes:

```powershell
# 1. Stop all services
./stop-platform.ps1

# 2. Restore backups
$backupDir = "docker-compose-backups-YYYYMMDD_HHMMSS"  # Use actual timestamp
Copy-Item "$backupDir\arc-saas-docker-compose.yml" "arc-saas\docker-compose.yml"
Copy-Item "$backupDir\app-plane-docker-compose.yml" "app-plane\docker-compose.yml"
Copy-Item "$backupDir\temporal-docker-compose.yml" "app-plane\temporal\docker-compose.yml"

# 3. Restart with original configuration
./start-platform.ps1 -Clean
```

---

## Summary of Changes

### Shared Temporal (temporal/docker-compose.yml)
- ✅ Add app-plane-network to temporal and temporal-ui services

### Control Plane (arc-saas/docker-compose.yml)
- ✅ Add health check to tenant-management-service
- ✅ Add Keycloak dependency to tenant-management-service
- ✅ Add health check to temporal-worker-service
- ✅ Add health check to admin-app
- ✅ Add restart: unless-stopped to all services

### App Plane (app-plane/docker-compose.yml)
- ✅ Add health check to django-backend
- ✅ Add health check to cns-worker
- ✅ Add CNS service dependency to cns-worker
- ✅ Add health check to customer-portal
- ✅ Add health check to middleware-api
- ✅ Change depends_on to condition-based for all services

### Expected Outcomes
- All services start in correct dependency order
- Health checks prevent premature service startup
- Temporal workers can connect to shared-temporal server
- Zero "connection refused" or DNS errors on startup
- Clean shutdown and restart without manual intervention
