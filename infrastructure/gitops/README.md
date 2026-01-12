# GitOps Infrastructure

This directory contains GitOps configurations for the Ananta Platform SaaS infrastructure deployment.

## Overview

The GitOps setup uses ArgoCD for continuous deployment with the following structure:

```
infrastructure/gitops/
├── argocd/
│   ├── applications/          # Individual ArgoCD Application manifests
│   │   ├── control-plane/     # Control plane services
│   │   ├── app-plane/         # App plane services
│   │   └── infrastructure/    # Shared infrastructure
│   ├── applicationsets/       # ApplicationSets for multi-env deployment
│   └── projects/              # ArgoCD Project definitions
└── README.md                  # This file
```

## Services

### Control Plane Services
| Service | Port | Description |
|---------|------|-------------|
| tenant-management-service | 14000 | Core backend API |
| temporal-worker-service | - | Workflow workers |
| subscription-service | 3000 | Billing management |
| orchestrator-service | 3000 | Workflow orchestration |
| admin-app | 80 | Admin portal (React) |

### App Plane Services
| Service | Port | Description |
|---------|------|-------------|
| cns-service | 27200 | Component normalization |
| cns-dashboard | 80 | CNS admin UI |
| customer-portal | 80 | Customer-facing portal |
| backstage-portal | 7007 | Developer portal |
| audit-logger | 3000 | Audit logging |
| middleware-api | 3000 | API gateway |
| novu-consumer | - | Notification worker |

### Infrastructure Services
| Service | Namespace | Description |
|---------|-----------|-------------|
| Keycloak | keycloak-system | Identity management |
| Temporal | temporal-system | Workflow engine |
| RabbitMQ | rabbitmq-system | Message broker |
| Redis | cache-system | Cache/sessions |
| Supabase | database-system | Database platform |
| Novu | novu-system | Notifications |

## Environments

| Environment | Domain | Branch | Auto-Sync |
|-------------|--------|--------|-----------|
| dev | dev.ananta-platform.io | develop | Yes |
| staging | staging.ananta-platform.io | staging | Yes |
| prod | ananta-platform.io | main | No (manual) |

## Quick Start

### Prerequisites
- Kubernetes cluster (1.27+)
- ArgoCD installed (2.9+)
- kubectl configured
- Helm 3.x

### Installation

1. **Install ArgoCD**
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

2. **Apply Project**
```bash
kubectl apply -f infrastructure/gitops/argocd/projects/ananta-platform.yaml
```

3. **Apply ApplicationSets**
```bash
# Infrastructure first
kubectl apply -f infrastructure/gitops/argocd/applicationsets/infrastructure-apps.yaml

# Then control plane
kubectl apply -f infrastructure/gitops/argocd/applicationsets/control-plane-apps.yaml

# Finally app plane
kubectl apply -f infrastructure/gitops/argocd/applicationsets/app-plane-apps.yaml
```

4. **Access ArgoCD UI**
```bash
# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Port forward
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

## ApplicationSet Strategy

The deployment uses a rolling strategy across environments:

```
dev → staging → prod
```

- **dev**: 100% parallel updates, auto-sync enabled
- **staging**: 50% rolling updates, auto-sync enabled
- **prod**: 25% rolling updates, manual sync required

## Sync Waves

Services are deployed in order using sync waves:

| Wave | Services |
|------|----------|
| 0 | Infrastructure (Keycloak, Temporal, Redis, RabbitMQ) |
| 5 | Core services (audit-logger, middleware-api) |
| 10 | Backend APIs (tenant-management, cns-service, subscription) |
| 15 | Workers (temporal-worker, novu-consumer) |
| 20 | Frontends (admin-app, customer-portal, cns-dashboard) |

## Secrets Management

Secrets are managed externally and referenced via `existingSecret`:

```yaml
secrets:
  existingSecret: service-name-secrets
```

Create secrets before deploying:

```bash
kubectl create secret generic tenant-management-secrets \
  --from-literal=DB_PASSWORD=xxx \
  --from-literal=JWT_SECRET=xxx \
  -n ananta-dev
```

## Helm Values

Each service uses layered values files:
- `values.yaml` - Base configuration
- `values-dev.yaml` - Development overrides
- `values-staging.yaml` - Staging overrides
- `values-prod.yaml` - Production overrides

## Monitoring

All services expose Prometheus metrics via ServiceMonitor:

```yaml
serviceMonitor:
  enabled: true
  interval: 30s
```

Access Grafana dashboards at `grafana.{domain}`.

## Troubleshooting

### Check application status
```bash
argocd app list
argocd app get tenant-management-service-dev
```

### Force sync
```bash
argocd app sync tenant-management-service-dev --force
```

### View logs
```bash
argocd app logs tenant-management-service-dev
```

### Rollback
```bash
argocd app rollback tenant-management-service-dev
```

## Production Deployment

Production deployments require manual approval:

1. Create PR to `main` branch
2. Wait for CI checks to pass
3. Merge PR
4. Manually sync in ArgoCD UI or CLI:
```bash
argocd app sync tenant-management-service-prod
```

## Maintenance Windows

Production sync windows are configured in the project:
- **Allowed**: Saturdays 02:00-06:00 UTC
- **Denied**: Weekdays 09:00-17:00 UTC

Override for emergencies:
```bash
argocd app sync tenant-management-service-prod --sync-option Force=true
```

## Related Documentation

- [Terraform Modules](../terraform/README.md)
- [Kubernetes Helm Charts](../kubernetes/README.md)
- [Infracost Configuration](../infracost/README.md)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
