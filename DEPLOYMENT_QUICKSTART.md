# ARC SaaS Platform - Deployment Quick Start

## TL;DR - Get Everything Running

```powershell
# 1. Navigate to platform root
cd e:\Work\Ananta-Platform-Saas

# 2. Start everything (clean)
./start-platform.ps1 -Clean

# 3. Monitor status
./monitor-platform.ps1

# 4. Stop everything
./stop-platform.ps1
```

---

## Common Operations

### Start Platform

```powershell
# Full clean start (recommended for first time)
./start-platform.ps1 -Clean

# Normal start (faster, uses existing containers)
./start-platform.ps1

# Start only Control Plane (admin tools, tenant management)
./start-platform.ps1 -ControlPlaneOnly

# Start only App Plane (BOM processing, CNS, customer portal)
./start-platform.ps1 -AppPlaneOnly

# Skip Temporal (if already running)
./start-platform.ps1 -SkipTemporal
```

### Stop Platform

```powershell
# Stop all services (keeps data)
./stop-platform.ps1

# Stop and REMOVE ALL DATA (WARNING!)
./stop-platform.ps1 -RemoveVolumes

# Stop only Control Plane
./stop-platform.ps1 -ControlPlaneOnly

# Stop only App Plane
./stop-platform.ps1 -AppPlaneOnly
```

### Monitor Platform

```powershell
# Real-time dashboard (refreshes every 10s)
./monitor-platform.ps1

# Faster refresh (every 5s)
./monitor-platform.ps1 -Interval 5
```

### Collect Logs

```powershell
# Collect all logs (last 500 lines each)
./collect-logs.ps1

# Collect more lines
./collect-logs.ps1 -Lines 1000

# Collect only CNS service logs
./collect-logs.ps1 -Services cns

# Collect only Control Plane logs
./collect-logs.ps1 -Services control-plane

# Collect only App Plane logs
./collect-logs.ps1 -Services app-plane
```

---

## Service URLs

### Control Plane (Admin & Platform)

| Service | URL | Credentials |
|---------|-----|-------------|
| Tenant Management API | http://localhost:14000 | JWT Token |
| Admin App | http://localhost:27555 | Keycloak SSO |
| Keycloak | http://localhost:8180 | admin/admin |
| Temporal UI | http://localhost:27021 | - |
| MinIO Console | http://localhost:9001 | minioadmin/minioadmin123 |
| Novu Dashboard | http://localhost:14200 | - |
| Jaeger Tracing | http://localhost:16686 | - |

### App Plane (Customer-Facing)

| Service | URL | Credentials |
|---------|-----|-------------|
| Customer Portal (CBP) | http://localhost:27100 | Keycloak SSO |
| CNS Service API | http://localhost:27200 | JWT Token |
| CNS Dashboard | http://localhost:27250 | Admin Token |
| Django Backend | http://localhost:27000 | - |
| Supabase Studio | http://localhost:27800 | - |
| Supabase API | http://localhost:27810 | Service Key |
| MinIO Console | http://localhost:27041 | minioadmin/minioadmin |
| RabbitMQ Mgmt | http://localhost:27673 | admin/admin123 |
| Directus CMS | http://localhost:27060 | admin@example.com |

---

## Troubleshooting

### Issue: Temporal worker fails with DNS error

**Symptoms:**
```
RuntimeError: Failed client connect: dns error
"shared-temporal" not found
```

**Solution:**
```powershell
# Start Temporal infrastructure first
cd app-plane/temporal
docker-compose up -d

# Verify it's running
docker logs shared-temporal --tail 50

# Restart workers
docker restart arc-saas-temporal-worker
docker restart app-plane-cns-worker
```

### Issue: Service won't start (port conflict)

**Symptoms:**
```
Error: bind: address already in use
```

**Solution:**
```powershell
# Check what's using the port (e.g., 14000)
netstat -ano | findstr :14000

# Kill the process
taskkill /F /PID <process_id>

# Or kill all node/bun processes
taskkill /F /IM node.exe
taskkill /F /IM bun.exe

# Restart service
./start-platform.ps1
```

### Issue: Database connection refused

**Symptoms:**
```
ECONNREFUSED ::1:5432
Connection to database failed
```

**Solution:**
```powershell
# Check if PostgreSQL is healthy
docker ps --filter name=postgres

# Check logs
docker logs arc-saas-postgres --tail 50
docker logs app-plane-supabase-db --tail 50

# Restart database
docker restart arc-saas-postgres
```

### Issue: Keycloak not ready

**Symptoms:**
```
Failed to fetch realm configuration
503 Service Unavailable
```

**Solution:**
```powershell
# Keycloak takes 60-90 seconds to become fully ready
# Check logs
docker logs arc-saas-keycloak --tail 50

# Wait for "Started" message, then restart dependent services
docker restart arc-saas-tenant-mgmt
docker restart arc-saas-admin-app
```

### Issue: CNS worker crash loop

**Symptoms:**
```
Restarting (1) 30 seconds ago
```

**Solution:**
```powershell
# Check worker logs
docker logs app-plane-cns-worker --tail 100

# Common causes:
# 1. Temporal not running → Start Temporal
# 2. Database schema missing → Apply migrations
# 3. Environment variable issue → Check .env

# If Temporal is the issue:
cd app-plane/temporal
docker-compose up -d

# Restart worker
docker restart app-plane-cns-worker
```

### Issue: Frontend shows 502 Bad Gateway

**Symptoms:**
- Admin app loads but shows "API not available"
- Customer portal shows blank page

**Solution:**
```powershell
# Check backend service
docker logs arc-saas-tenant-mgmt --tail 50  # For admin app
docker logs app-plane-django-backend --tail 50  # For customer portal

# Verify service is running and healthy
docker ps | findstr tenant-mgmt
docker ps | findstr django-backend

# Check health endpoints
curl http://localhost:14000/health
curl http://localhost:27000/health
```

---

## Quick Checks

### All services running?

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}" | findstr "(temporal|postgres|redis|keycloak|tenant|cns|django)"
```

### All services healthy?

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}" | findstr "healthy"
```

### Check specific service health:

```powershell
docker inspect --format='{{.State.Health.Status}}' shared-temporal
docker inspect --format='{{.State.Health.Status}}' arc-saas-tenant-mgmt
docker inspect --format='{{.State.Health.Status}}' app-plane-cns-service
```

### View recent logs:

```powershell
docker logs shared-temporal --tail 50
docker logs arc-saas-tenant-mgmt --tail 50
docker logs app-plane-cns-service --tail 50
```

### Test network connectivity:

```powershell
# Temporal connectivity from Control Plane
docker exec arc-saas-temporal-worker ping -c 3 shared-temporal

# Temporal connectivity from App Plane
docker exec app-plane-cns-worker ping -c 3 shared-temporal

# Keycloak connectivity from App Plane
docker exec app-plane-cns-service curl -f http://arc-saas-keycloak:8080
```

---

## Development Workflow

### Working on Control Plane services:

```powershell
# Start everything except the service you're developing
./start-platform.ps1

# Stop the containerized service
docker stop arc-saas-tenant-mgmt

# Run service locally with Bun
cd arc-saas/services/tenant-management-service
bun install
bun run start:dev

# Service now runs on host at localhost:14000
```

### Working on App Plane services:

```powershell
# Start everything except the service you're developing
./start-platform.ps1

# Stop the containerized service
docker stop app-plane-cns-service

# Run service locally
cd app-plane/services/cns-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 27200

# Service now runs on host at localhost:27200
```

### Restart single service:

```powershell
docker restart <service-name>
docker logs <service-name> --tail 50
```

### Rebuild single service:

```powershell
cd arc-saas  # or app-plane
docker-compose build <service-name>
docker-compose up -d <service-name>
```

---

## Database Access

### Control Plane PostgreSQL:

```powershell
# Connect to database
docker exec -it arc-saas-postgres psql -U postgres -d arc_saas

# Useful queries:
\dt main.*          # List tables in main schema
\d main.tenants     # Describe tenants table
SELECT * FROM main.tenants;
```

### Supabase PostgreSQL (App Plane):

```powershell
# Connect to database
docker exec -it app-plane-supabase-db psql -U postgres -d postgres

# Useful queries:
\dt public.*                # List tables
SELECT * FROM organizations;
SELECT * FROM boms;
```

### Components-V2 PostgreSQL:

```powershell
# Connect to database
docker exec -it app-plane-components-v2-postgres psql -U postgres -d components_v2

# Useful queries:
SELECT COUNT(*) FROM component_catalog;
SELECT * FROM manufacturers;
```

---

## Temporal Operations

### View workflows in Temporal UI:

```
http://localhost:27021
```

### CLI operations:

```powershell
# List workflows in arc-saas namespace
docker exec shared-temporal tctl --namespace arc-saas workflow list

# Show workflow history
docker exec shared-temporal tctl --namespace arc-saas workflow show --workflow-id "provision-tenant-XXX"

# Terminate stuck workflow
docker exec shared-temporal tctl --namespace arc-saas workflow terminate --workflow-id "provision-tenant-XXX"

# List namespaces
docker exec shared-temporal tctl namespace list
```

---

## Reset Everything (Nuclear Option)

**WARNING:** This deletes ALL data!

```powershell
# Stop everything and remove volumes
./stop-platform.ps1 -RemoveVolumes

# Remove ALL Docker containers (platform-wide)
docker rm -f $(docker ps -aq)

# Remove ALL Docker volumes (platform-wide)
docker volume rm $(docker volume ls -q)

# Remove networks
docker network rm shared-temporal-network arc-saas app-plane 2>$null

# Clean start
./start-platform.ps1 -Clean
```

---

## Performance Tips

### Reduce startup time:

1. **Don't use -Clean unless necessary**
   ```powershell
   # Slower (rebuilds everything)
   ./start-platform.ps1 -Clean

   # Faster (reuses containers)
   ./start-platform.ps1
   ```

2. **Start only what you need**
   ```powershell
   # Only Control Plane
   ./start-platform.ps1 -ControlPlaneOnly

   # Only App Plane (assumes Temporal running)
   ./start-platform.ps1 -AppPlaneOnly
   ```

3. **Increase Docker resources**
   - Open Docker Desktop > Settings > Resources
   - Increase CPUs to 4+
   - Increase Memory to 8GB+
   - Increase Disk image size to 64GB+

### Speed up builds:

```powershell
# Use BuildKit (faster Docker builds)
$env:DOCKER_BUILDKIT=1

# Rebuild with caching
docker-compose build --parallel
```

---

## Health Check Summary

| Container | Health Check | Interval |
|-----------|--------------|----------|
| shared-temporal | `temporal workflow list` | 10s |
| arc-saas-postgres | `pg_isready -U postgres` | 5s |
| arc-saas-redis | `redis-cli ping` | 5s |
| arc-saas-keycloak | HTTP /health/ready | 30s |
| app-plane-cns-service | HTTP /health | 30s |
| app-plane-supabase-db | `pg_isready -U postgres` | 10s |
| app-plane-rabbitmq | `rabbitmq-diagnostics ping` | 10s |

---

## Getting Help

### View logs for specific service:

```powershell
./collect-logs.ps1 -Services <service-name>
cat logs_*/SUMMARY.txt
```

### Full platform status:

```powershell
./monitor-platform.ps1
```

### Network debugging:

```powershell
# List all networks
docker network ls

# Inspect shared-temporal-network
docker network inspect shared-temporal-network

# Check which containers are on the network
docker network inspect shared-temporal-network | jq '.[0].Containers'
```

---

## Next Steps

1. **Apply Docker Compose enhancements:**
   ```powershell
   # Read the guide
   cat DOCKER_COMPOSE_ENHANCEMENTS.md

   # Apply changes manually to docker-compose files
   ```

2. **Set up monitoring:**
   - Access Jaeger: http://localhost:16686
   - Access Temporal UI: http://localhost:27021
   - Set up alerts in RabbitMQ management

3. **Configure backups:**
   - Set up automated database backups
   - Configure MinIO bucket replication
   - Export Keycloak realm configuration

4. **Production deployment:**
   - Review DEPLOYMENT_STRATEGY.md
   - Implement HA for critical services
   - Set up external Temporal Cloud
   - Use managed PostgreSQL (RDS/Cloud SQL)

---

## Reference

- **Full deployment guide:** `DEPLOYMENT_STRATEGY.md`
- **Docker enhancements:** `DOCKER_COMPOSE_ENHANCEMENTS.md`
- **Project documentation:** `CLAUDE.md`
- **Architecture diagrams:** `ARCHITECTURE-DIAGRAMS.md`
