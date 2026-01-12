# Development Scripts

This directory contains automation scripts to improve the development workflow and avoid common issues like stale port-forwards, Docker cache problems, and service worker conflicts.

## Quick Reference

| Task | Command |
|------|---------|
| **Deploy frontend with fresh build** | `.\deploy-frontend.ps1 -Service customer-portal` |
| **Deploy CNS service (backend)** | `.\deploy-cns-service.ps1` |
| **Restart all port-forwards** | `.\manage-port-forwards.ps1 restart` |
| **Check port-forward status** | `.\manage-port-forwards.ps1 status` |
| **Stop all port-forwards** | `.\manage-port-forwards.ps1 stop` |

---

## Scripts Overview

### 1. `deploy-frontend.ps1` - Integrated Deployment

**Purpose**: Complete frontend deployment pipeline - Build → Docker → Kubernetes → Port-Forward

**Usage**:
```powershell
# Full deployment (recommended)
.\deploy-frontend.ps1 -Service customer-portal

# Skip build (use existing dist/)
.\deploy-frontend.ps1 -Service customer-portal -SkipBuild

# Force Docker rebuild without cache (fixes stale chunk issues)
.\deploy-frontend.ps1 -Service customer-portal -NoBuildCache

# Deploy without restarting port-forward
.\deploy-frontend.ps1 -Service customer-portal -SkipPortForward
```

**Supported Services**:
- `customer-portal` - Arc-SaaS customer portal (port 27100)
- `admin-app` - Arc-SaaS admin app (port 27555)
- `cns-dashboard` - CNS dashboard (port 27250)

**What it does**:
1. **Build** - Runs `bun run build` in service directory
2. **Docker** - Builds Docker image with tag `:local`
3. **Deploy** - Restarts Kubernetes deployment
4. **Port-Forward** - Kills old port-forward, starts fresh one

**Benefits**:
- ✅ Prevents Docker build cache from serving old dist/ files
- ✅ Automatically restarts stale port-forwards
- ✅ Verifies deployment success before continuing
- ✅ Single command instead of 5+ manual steps

---

### 2. `deploy-cns-service.ps1` - CNS Backend Deployment

**Purpose**: Automated deployment pipeline for CNS service (Python FastAPI backend) - Docker → Kubernetes

**Usage**:
```powershell
# Full deployment with fresh Docker build
.\deploy-cns-service.ps1

# Skip Docker build (use existing ananta/cns-service:local image)
.\deploy-cns-service.ps1 -SkipBuild

# Force Docker rebuild without cache
.\deploy-cns-service.ps1 -NoBuildCache
```

**What it does**:
1. **Build** - Builds Docker image `ananta/cns-service:local` (unless `-SkipBuild`)
2. **Deploy** - Annotates and restarts Kubernetes deployment
3. **Verify** - Confirms pod is running and shows recent logs

**Benefits**:
- ✅ End-to-end deployment automation for backend services
- ✅ Verifies deployment success before continuing
- ✅ Shows logs immediately for quick debugging
- ✅ Future-proof GitOps-ready workflow

**When to use**:
- After modifying CNS service Python code ([rate_limit.py](file:///e:/Work/Ananta-Platform-Saas/app-plane/services/cns-service/app/middleware/rate_limit.py), API endpoints, etc.)
- After updating CNS dependencies (requirements.txt)
- After configuration changes (environment variables)

---

### 3. `reset-port-forwards.ps1` - Port-Forward Reset (RECOMMENDED)

**Purpose**: Complete reset of all port-forwards - kills ALL kubectl processes and starts fresh

**Usage**:
```powershell
# Reset all port-forwards (best for fixing timeouts/stale connections)
.\\reset-port-forwards.ps1
```

**What it does**:
1. **Kill** - Forcefully terminates ALL kubectl processes
2. **Verify** - Ensures all ports are released
3. **Start** - Launches fresh port-forwards as Windows background processes
4. **Verify** - Confirms all port-forwards are listening

**Benefits**:
- ✅ Eliminates all stale kubectl processes causing timeouts
- ✅ Ensures ports are fully released before restarting
- ✅ Uses Windows `Start-Process` for stable background execution
- ✅ Verifies each port-forward is actually listening

**When to use**:
- After any deployment (automatically clears stale connections)
- When experiencing "connection reset" errors
- When port-forwards show timeout errors
- Daily when starting development work

---

### 3. `manage-port-forwards.ps1` - Port-Forward Manager

**Purpose**: Centralized management of all Kubernetes port-forwards

**Usage**:
```powershell
# Start all configured port-forwards
.\manage-port-forwards.ps1 start

# Stop all port-forwards
.\manage-port-forwards.ps1 stop

# Restart all port-forwards
.\manage-port-forwards.ps1 restart

# Check status
.\manage-port-forwards.ps1 status
```

**Port-Forwards Managed**:
| Service | Namespace | Port | Remote |
|---------|-----------|------|--------|
| customer-portal | app-plane | 27100 | 27100 |
| cns-service | app-plane | 27200 | 27200 |
| tenant-management | control-plane | 14000 | 14000 |
| keycloak | auth-system | 8180 | 8080 |

**Benefits**:
- ✅ Single source of truth for all port configurations
- ✅ Prevents port conflicts - checks before starting
- ✅ Tracks PIDs for proper cleanup
- ✅ Shows clear status of each port-forward

---

### 4. `manage-port-forwards.sh` - Bash Equivalent

**Purpose**: Same as PowerShell version, for Git Bash/WSL users

**Usage**:
```bash
./manage-port-forwards.sh start
./manage-port-forwards.sh stop
./manage-port-forwards.sh restart
./manage-port-forwards.sh status
```

---

## Common Workflows

### Deploying Frontend Changes

**Scenario**: Made changes to customer-portal, need to test in Kubernetes

**Old Way** (error-prone):
```bash
cd arc-saas/apps/customer-portal
bun run build
docker build -t ananta/customer-portal:local .  # Might use cached dist/
kubectl rollout restart deployment/customer-portal -n app-plane
kubectl rollout status deployment/customer-portal -n app-plane
# ... port-forward might still be pointing to old pod
# ... browser might load old chunks from service worker
```

**New Way**:
```powershell
.\scripts\deploy-frontend.ps1 -Service customer-portal
```

Then in browser:
1. F12 → Application → Service Workers → Unregister
2. Application → Storage → Clear site data
3. Ctrl+Shift+R (hard refresh)

---

### Fixing Stale Port-Forwards

**Scenario**: Port-forwards are stuck, pointing to old pods, or conflicting

**Old Way**:
```bash
taskkill /F /IM kubectl.exe
# Wait...
# Manually restart each port-forward
kubectl port-forward -n app-plane svc/customer-portal 27100:27100 &
kubectl port-forward -n app-plane svc/cns-service 27200:27200 &
# ... repeat for each service
```

**New Way**:
```powershell
.\scripts\manage-port-forwards.ps1 restart
```

---

### Checking What's Running

**Scenario**: Want to see which port-forwards are active

**Old Way**:
```bash
netstat -ano | findstr ":27100 :27200 :14000 :8180"
tasklist | findstr kubectl
# ... manually correlate PIDs
```

**New Way**:
```powershell
.\scripts\manage-port-forwards.ps1 status
```

Output:
```
=== Port-Forward Status ===

  [RUNNING] customer-portal - localhost:27100
  [RUNNING] cns-service - localhost:27200
  [STOPPED] tenant-management - localhost:14000
  [RUNNING] keycloak - localhost:8180

=== Background Jobs ===
Name              State     HasMoreData
----              -----     -----------
pf-customer-portal Running   True
pf-cns-service    Running   True
pf-keycloak       Running   True
```

---

## Root Cause Solutions

### Problem 1: Stale Port-Forwards After Deployment

**Root Cause**:
- `kubectl rollout restart` creates new pods with new names
- Old port-forward processes remain connected to terminated pods
- New `kubectl port-forward` commands fail because port is still bound

**Solution**:
- `deploy-frontend.ps1` automatically kills old port-forward before starting new one
- Uses Windows `Get-NetTCPConnection` to find exact process holding the port
- Waits for port to be released before creating new connection

---

### Problem 2: Docker Build Cache Serving Old dist/

**Root Cause**:
- Docker caches layers by detecting file/metadata changes
- `dist/` folder timestamp might not change even though contents did
- `COPY dist/` layer gets cached with OLD files

**Solution**:
- Use `-NoBuildCache` flag to force Docker to rebuild without cache:
  ```powershell
  .\deploy-frontend.ps1 -Service customer-portal -NoBuildCache
  ```
- Script explicitly checks for `dist/` folder existence after build

---

### Problem 3: Service Worker Caching Old Chunks

**Root Cause**:
- VitePWA registers service worker that caches JavaScript chunks
- Vite generates content-based hash filenames (`index-Jp52w-iT.js`)
- Service worker serves old cached chunks even after deployment

**Solution**:
- Disable PWA in vite.config.ts (already done):
  ```typescript
  disable: process.env.VITE_DISABLE_PWA !== 'false'  // Disabled by default
  ```
- Always unregister service worker after deployment:
  1. F12 → Application → Service Workers → Unregister
  2. Clear site data
  3. Hard refresh

---

### Problem 4: Multiple kubectl Processes

**Root Cause**:
- Running ad-hoc `kubectl port-forward` commands leaves orphaned processes
- Multiple processes compete for same port
- Hard to track which process is which

**Solution**:
- Use `manage-port-forwards.ps1` for ALL port-forward management
- Script tracks PIDs in `/tmp/pf-{name}.pid` files
- `restart` command properly cleans up ALL old processes before starting new ones

---

## Best Practices

### 1. Always Use Scripts for Deployments

❌ **Don't**:
```bash
bun run build && docker build -t ananta/customer-portal:local . && kubectl rollout restart deployment/customer-portal -n app-plane
```

✅ **Do**:
```powershell
.\scripts\deploy-frontend.ps1 -Service customer-portal
```

### 2. Define Port-Forwards Once

❌ **Don't**: Hard-code port-forward commands in multiple places

✅ **Do**: Add new services to `manage-port-forwards.ps1` config:
```powershell
$portForwards = @(
    @{
        Name = "my-new-service"
        Namespace = "app-plane"
        Service = "my-new-service"
        LocalPort = 27300
        RemotePort = 80
    }
)
```

### 3. Check Status Before Debugging

Before investigating why a service isn't accessible:
```powershell
.\scripts\manage-port-forwards.ps1 status
```

This shows:
- Which ports are actually listening
- Whether kubectl is the process (vs. something else)
- Whether port-forwards are running or stopped

### 4. Restart Port-Forwards After Deployment

After ANY Kubernetes deployment restart:
```powershell
.\scripts\manage-port-forwards.ps1 restart
```

Or use the integrated script:
```powershell
.\scripts\deploy-frontend.ps1 -Service customer-portal  # Handles it automatically
```

---

## Troubleshooting

### Script Execution Policy Error

```
.\deploy-frontend.ps1 : File cannot be loaded because running scripts is disabled
```

**Fix**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Port Still in Use After Stopping

**Symptoms**: `manage-port-forwards.ps1 start` says port is in use even after `stop`

**Fix**:
```powershell
# Check what's using the port
Get-NetTCPConnection -LocalPort 27100 | ForEach-Object {
    Get-Process -Id $_.OwningProcess
}

# Kill manually if needed
Stop-Process -Id <PID> -Force
```

### Docker Build Fails

**Symptoms**: `deploy-frontend.ps1` fails during Docker build

**Common Causes**:
1. `dist/` folder doesn't exist - run `bun run build` manually first
2. Docker daemon not running - start Docker Desktop
3. Insufficient disk space - clean up Docker images: `docker system prune`

**Fix**:
```powershell
# Check dist/ exists
Test-Path .\arc-saas\apps\customer-portal\dist

# Check Docker is running
docker version

# Clean up space
docker system prune -a
```

### Kubernetes Rollout Timeout

**Symptoms**: `kubectl rollout status` times out

**Fix**:
```bash
# Check pod status
kubectl get pods -n app-plane -l app=customer-portal

# Check logs
kubectl logs -n app-plane deployment/customer-portal --tail=50

# Describe pod for errors
kubectl describe pod -n app-plane <pod-name>
```

---

## Future Improvements

### 1. Add Health Checks

Add automatic health check verification after deployment:
```powershell
# In deploy-frontend.ps1, after port-forward starts
$health = Invoke-RestMethod "http://localhost:$localPort/health"
if ($health.status -ne "healthy") {
    throw "Service health check failed"
}
```

### 2. Add Rollback Support

If deployment fails, automatically rollback:
```powershell
.\deploy-frontend.ps1 -Service customer-portal -Rollback
```

### 3. Add Multi-Service Deployment

Deploy all services at once:
```powershell
.\deploy-all-frontends.ps1
```

### 4. Integration with Terraform

Auto-restart port-forwards after Terraform apply:
```powershell
terraform apply && .\scripts\manage-port-forwards.ps1 restart
```

---

## Contributing

When adding new services:

1. **Add to `manage-port-forwards.ps1`**:
   ```powershell
   $portForwards = @(
       # ... existing services
       @{
           Name = "new-service"
           Namespace = "namespace"
           Service = "service-name"
           LocalPort = 12345
           RemotePort = 80
       }
   )
   ```

2. **Add to `deploy-frontend.ps1`** (if it's a frontend):
   ```powershell
   $config = @{
       "new-service" = @{
           Path = "path/to/service"
           ImageName = "ananta/new-service"
           ImageTag = "local"
           Namespace = "namespace"
           Deployment = "deployment-name"
           LocalPort = 12345
           RemotePort = 80
       }
   }
   ```

3. **Update this README** with the new service details

---

## See Also

- [../arc-saas/apps/customer-portal/README.md](../arc-saas/apps/customer-portal/README.md) - Customer Portal setup
- [../infrastructure/terraform/README.md](../infrastructure/terraform/README.md) - Terraform infrastructure
- [../.claude/CLAUDE.md](../.claude/CLAUDE.md) - Complete platform documentation
