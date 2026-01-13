# CI/CD Pipeline Documentation

## Overview

This document describes the CI/CD pipeline for the Ananta Platform SaaS, using **GitHub Actions** for CI and **ArgoCD** for CD (GitOps).

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Git Push  │────▶│   GitHub    │────▶│   GHCR      │────▶│   ArgoCD    │
│             │     │   Actions   │     │   Registry  │     │   Sync      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                          │                                        │
                    Build & Test                             GitOps Pull
                    Push Images                            Deploy to K8s
```

## Services

### Control Plane (TypeScript/LoopBack 4)

| Service | Port | Path |
|---------|------|------|
| tenant-management-service | 14000 | `arc-saas/services/tenant-management-service` |
| orchestrator-service | 14001 | `arc-saas/services/orchestrator-service` |
| subscription-service | 14002 | `arc-saas/services/subscription-service` |
| temporal-worker-service | 14003 | `arc-saas/services/temporal-worker-service` |

### App Plane (Python/FastAPI)

| Service | Port | Path |
|---------|------|------|
| cns-service | 27200 | `app-plane/services/cns-service` |
| audit-logger | 27201 | `app-plane/services/audit-logger` |
| middleware-api | 27202 | `app-plane/services/middleware-api` |
| novu-consumer | 27203 | `app-plane/services/novu-consumer` |

### Frontend Apps (React/Vite)

| Service | Port | Path |
|---------|------|------|
| admin-app | 27555 | `arc-saas/apps/admin-app` |
| customer-portal | 27100 | `arc-saas/apps/customer-portal` |
| backstage-portal | 27300 | `app-plane/services/backstage-portal` |
| cns-dashboard | 27250 | `app-plane/services/cns-dashboard` |

## Pipeline Triggers

| Trigger | Behavior |
|---------|----------|
| Push to `main` | Build & deploy to production |
| Push to `develop` | Build & deploy to dev |
| Push to `staging` | Build & deploy to staging |
| Pull Request | Build & test only (no deploy) |
| Manual dispatch | Select services & environment |

## Pipeline Stages

### 1. Detect Changes

Uses `dorny/paths-filter` to detect which services changed:

```yaml
- 'arc-saas/services/tenant-management-service/**'
- 'infrastructure/kubernetes/helm/tenant-management-service/**'
```

Only changed services are built, saving CI time.

### 2. Build & Test

**Control Plane (TypeScript):**
```bash
bun install --frozen-lockfile
bun run tsc --noEmit
bun test
bun run build
```

**App Plane (Python):**
```bash
pip install -r requirements.txt
ruff check .
pytest
```

**Frontend (React):**
```bash
bun install
bun run tsc --noEmit
bun run build
```

### 3. Docker Build & Push

```bash
docker build -t ghcr.io/siddh7007/ananta/<service>:<tag>
docker push ghcr.io/siddh7007/ananta/<service>:<tag>
```

Tags:
- `latest` - main branch
- `develop` - develop branch
- `<sha>` - commit SHA
- `pr-<number>` - pull request

### 4. Update Manifests

Updates Helm values with new image tags:

```yaml
# infrastructure/kubernetes/helm/<service>/values.yaml
image:
  tag: "<new-sha>"
```

### 5. ArgoCD Sync

ArgoCD automatically detects manifest changes and syncs to Kubernetes.

## Environments

| Environment | Branch | Auto-Sync | Domain |
|-------------|--------|-----------|--------|
| dev | develop | ✅ Yes | dev.ananta.io |
| staging | staging | ✅ Yes | staging.ananta.io |
| prod | main | ❌ No | ananta.io |

## Configuration

### GitHub Secrets

| Secret | Description |
|--------|-------------|
| `GITHUB_TOKEN` | Auto-provided for GHCR |
| `ARGOCD_TOKEN` | ArgoCD API token (optional) |

### GitHub Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KEYCLOAK_URL` | Keycloak auth URL | https://auth.ananta.io |
| `KEYCLOAK_REALM` | Keycloak realm | ananta-saas |
| `CNS_SERVICE_URL` | CNS API URL | https://cns.ananta.io |

## Manual Deployment

### Trigger via GitHub UI

1. Go to Actions → CI/CD Pipeline
2. Click "Run workflow"
3. Select services (comma-separated or "all")
4. Select environment
5. Click "Run workflow"

### Trigger via CLI

```bash
gh workflow run ci-cd.yaml \
  -f services=backstage-portal,cns-service \
  -f environment=staging
```

## ArgoCD Setup

### Install ArgoCD

```bash
# Create namespace
kubectl create namespace argocd

# Install via Helm
helm repo add argo https://argoproj.github.io/argo-helm
helm install argocd argo/argo-cd -n argocd

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d

# Port forward to access UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

### Apply ApplicationSet

```bash
# Apply the master ApplicationSet
kubectl apply -f infrastructure/gitops/argocd/applicationsets/all-services.yaml
```

This creates applications for ALL services across ALL environments automatically.

### View Applications

```bash
# List all applications
kubectl get applications -n argocd

# Check sync status
kubectl get applications -n argocd -o wide

# View specific application
argocd app get backstage-portal-dev
```

## Helm Chart Structure

```
infrastructure/kubernetes/helm/<service>/
├── Chart.yaml              # Chart metadata
├── values.yaml             # Default values
├── values-dev.yaml         # Dev overrides
├── values-staging.yaml     # Staging overrides
├── values-prod.yaml        # Prod overrides
└── templates/
    ├── _helpers.tpl        # Template helpers
    ├── deployment.yaml     # Deployment manifest
    ├── service.yaml        # Service manifest
    ├── ingress.yaml        # Ingress manifest
    ├── serviceaccount.yaml # ServiceAccount
    └── hpa.yaml            # HorizontalPodAutoscaler
```

## Adding a New Service

1. **Create Dockerfile** in service directory
2. **Create Helm chart**:
   ```bash
   cp -r infrastructure/kubernetes/helm/backstage-portal \
         infrastructure/kubernetes/helm/my-new-service
   ```
3. **Update Chart.yaml** and values files
4. **Add to CI workflow** in `.github/workflows/ci-cd.yaml`:
   ```yaml
   my-new-service:
     - 'path/to/my-new-service/**'
   ```
5. **Add to ApplicationSet** in `applicationsets/all-services.yaml`:
   ```yaml
   - name: my-new-service
     path: infrastructure/kubernetes/helm/my-new-service
     namespace: app-plane
     plane: app
     port: "27999"
     syncWave: "15"
   ```
6. **Push to develop** branch to trigger build

## Troubleshooting

### Build Failures

```bash
# Check GitHub Actions logs
gh run view <run-id> --log

# Re-run failed jobs
gh run rerun <run-id> --failed
```

### ArgoCD Sync Issues

```bash
# Check application status
argocd app get <app-name>

# View sync details
argocd app sync <app-name> --dry-run

# Force sync
argocd app sync <app-name> --force

# Check ArgoCD logs
kubectl logs -n argocd deployment/argocd-repo-server
```

### Image Pull Errors

```bash
# Check image exists
docker pull ghcr.io/siddh7007/ananta/<service>:<tag>

# Check pull secret
kubectl get secret ghcr-credentials -n <namespace>
```

## Best Practices

1. **Always use specific tags** - Never use `latest` in production
2. **Test locally first** - Run `bun run build` before pushing
3. **Small, focused PRs** - Easier to review and rollback
4. **Monitor after deploy** - Check ArgoCD and pod logs
5. **Use sync waves** - Control deployment order (infra → backend → frontend)

## Related Documentation

- [ArgoCD User Guide](https://argo-cd.readthedocs.io/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Helm Documentation](https://helm.sh/docs/)
- [Platform Architecture](./PLATFORM_INTEGRATION_PLAN.md)
