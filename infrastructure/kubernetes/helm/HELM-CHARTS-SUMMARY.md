# Ananta Platform - Helm Charts Summary

## Overview

Complete production-ready Helm charts for deploying the Ananta Platform SaaS application on Kubernetes.

**Status**: COMPLETE
**Charts**: 15
**YAML Files**: 199
**Date**: 2026-01-04

## What Was Created

### Directory Structure

```
infrastructure/kubernetes/helm/
├── README.md                       # Main documentation
├── DEPLOYMENT-GUIDE.md             # Detailed deployment guide
├── HELM-CHARTS-SUMMARY.md          # This file
├── validate-charts.sh              # Chart validation script
├── quick-install.sh                # Quick installation script
├── generate-remaining-values.sh    # Helper script for values generation
│
├── Control Plane (5 charts)
│   ├── tenant-management-service/  # Main backend API (LoopBack 4)
│   ├── temporal-worker-service/    # Temporal workflow workers
│   ├── subscription-service/       # Billing and subscriptions
│   ├── orchestrator-service/       # Cross-service orchestration
│   └── admin-app/                  # React admin portal (Vite)
│
├── App Plane (7 charts)
│   ├── cns-service/                # Component Normalization Service (FastAPI)
│   ├── cns-dashboard/              # CNS admin UI (React)
│   ├── customer-portal/            # Customer-facing portal (React)
│   ├── backstage-portal/           # Developer portal (Backstage)
│   ├── audit-logger/               # Audit logging service
│   ├── middleware-api/             # API gateway/middleware
│   └── novu-consumer/              # Notification event consumer
│
└── Infrastructure (3 charts)
    ├── temporal/                   # Temporal workflow engine
    ├── novu/                       # Novu notification platform
    └── supabase/                   # Supabase backend services
```

### Each Chart Contains

```
<service-name>/
├── Chart.yaml                      # Chart metadata (name, version, description)
├── values.yaml                     # Default configuration values
├── values-dev.yaml                 # Development environment overrides
├── values-staging.yaml             # Staging environment overrides
├── values-prod.yaml                # Production environment overrides
└── templates/
    ├── _helpers.tpl                # Helm template helpers
    ├── deployment.yaml             # Kubernetes Deployment
    ├── service.yaml                # Kubernetes Service
    ├── ingress.yaml                # Ingress resource (nginx)
    ├── configmap.yaml              # ConfigMap for environment variables
    ├── secret.yaml                 # Secret placeholder (use existingSecret)
    ├── hpa.yaml                    # HorizontalPodAutoscaler
    ├── servicemonitor.yaml         # Prometheus ServiceMonitor
    ├── serviceaccount.yaml         # Kubernetes ServiceAccount
    └── poddisruptionbudget.yaml    # PodDisruptionBudget for HA
```

## Service Configuration

### Control Plane Services

| Service | Port | Type | Description | Image |
|---------|------|------|-------------|-------|
| tenant-management-service | 14000 | Backend | Main API for tenant/subscription management | Node.js 20 (LoopBack 4) |
| temporal-worker-service | 8080 | Worker | Temporal workflow worker (metrics only) | Node.js 20 |
| subscription-service | 14001 | Backend | Billing and subscription management | Node.js 20 (LoopBack 4) |
| orchestrator-service | 14002 | Backend | Cross-service workflow orchestration | Node.js 20 (LoopBack 4) |
| admin-app | 80 | Frontend | React admin portal (Vite + Refine) | Nginx (serves static build) |

### App Plane Services

| Service | Port | Type | Description | Image |
|---------|------|------|-------------|-------|
| cns-service | 27200 | Backend | Component enrichment API (FastAPI) | Python 3.11 |
| cns-dashboard | 27250 | Frontend | CNS admin dashboard | Nginx (React) |
| customer-portal | 27100 | Frontend | Customer-facing web portal | Nginx (React) |
| backstage-portal | 7007 | Frontend | Developer portal (Backstage) | Node.js 18 |
| audit-logger | 27300 | Backend | Audit logging service | Node.js 20 |
| middleware-api | 27350 | Backend | API gateway middleware | Node.js 20 |
| novu-consumer | 9090 | Worker | Notification event consumer | Node.js 20 |

### Infrastructure Services

| Service | Port | Type | Description | Notes |
|---------|------|------|-------------|-------|
| temporal | 7233 | Infrastructure | Temporal workflow engine | Multi-component (frontend, history, matching, worker, web) |
| novu | 3000 | Infrastructure | Novu notification platform | Multi-component (api, web, worker, ws) |
| supabase | Multiple | Infrastructure | Supabase backend services | Multi-component (db, api, auth, storage, studio, kong) |

## Key Features

### Security Hardening

All charts implement CIS Kubernetes Benchmark security controls:

```yaml
podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000
  seccompProfile:
    type: RuntimeDefault

securityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop:
    - ALL
  readOnlyRootFilesystem: true
```

### Health Checks

All services include proper health probes:

- **Liveness Probe**: Restarts unhealthy containers
- **Readiness Probe**: Controls traffic routing
- **Startup Probe**: Handles slow-starting applications

### Resource Management

All services have resource limits and requests:

```yaml
resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 256Mi
```

### Autoscaling

HorizontalPodAutoscaler configured for all stateless services:

```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

### High Availability

- **PodDisruptionBudgets**: Maintain minimum availability during updates
- **Pod Anti-Affinity**: Spread pods across nodes
- **Multiple Replicas**: 2+ replicas in staging/prod

### Observability

- **Prometheus ServiceMonitors**: All services expose `/metrics`
- **Structured Logging**: JSON logs with correlation IDs
- **Distributed Tracing**: OpenTelemetry support

### Secrets Management

All charts use `existingSecret` pattern:

```yaml
secrets:
  existingSecret: "tenant-management-secrets"
```

Compatible with:
- Kubernetes Secrets
- Sealed Secrets
- External Secrets Operator
- Vault
- AWS Secrets Manager

## Environment Configurations

### Development (values-dev.yaml)

- Single replica
- Autoscaling disabled
- Lower resource limits
- Debug logging enabled
- Local domain: `*.ananta.local`

### Staging (values-staging.yaml)

- 2 replicas
- Autoscaling enabled
- Production-like resources
- Info logging
- Staging domain: `*-staging.ananta.io`

### Production (values-prod.yaml)

- 3+ replicas
- Autoscaling with higher limits
- High resource allocation
- Warn logging
- Production domain: `*.ananta.io`
- Required pod anti-affinity
- PodDisruptionBudget with minAvailable: 2

## Installation Methods

### 1. Direct Helm (Manual)

```bash
helm install tenant-management-service ./tenant-management-service \
  --namespace ananta-dev \
  --values ./tenant-management-service/values-dev.yaml \
  --set image.tag=v1.0.0
```

### 2. Quick Install Script

```bash
# Install all services
./quick-install.sh dev

# Install specific services
./quick-install.sh dev tenant-management-service admin-app

# Install service groups
./quick-install.sh dev control-plane
./quick-install.sh staging infrastructure
```

### 3. ArgoCD GitOps (Recommended)

Application manifests in `infrastructure/gitops/argocd/applications/`:

```bash
kubectl apply -k infrastructure/gitops/argocd/applications/
```

ArgoCD provides:
- Automated sync from Git
- Configuration drift detection
- Auto-healing
- Rollback support
- Visual deployment UI

## Validation

Run the validation script:

```bash
cd infrastructure/kubernetes/helm
./validate-charts.sh
```

Checks:
- All required files exist
- Helm lint passes
- Template rendering works
- Proper structure

## Dependencies

### External Services

All charts expect these external services to be available:

| Service | Namespace | Purpose |
|---------|-----------|---------|
| PostgreSQL | database-system | Primary database |
| Redis | cache-system | Caching and sessions |
| RabbitMQ | messaging-system | Message queuing |
| MinIO/S3 | storage-system | Object storage |
| MongoDB | database-system | Novu data store |
| Elasticsearch | observability-system | Temporal visibility |

### Kubernetes Operators

Required operators:

- **nginx-ingress-controller**: Ingress routing
- **cert-manager**: Automatic TLS certificates
- **prometheus-operator**: ServiceMonitor support
- **external-secrets-operator**: Secret management (recommended)

### Optional Operators

- **sealed-secrets**: Encrypted secrets in Git
- **argocd**: GitOps deployments
- **istio/linkerd**: Service mesh

## Secrets Required

For each service, create secrets with these keys:

### tenant-management-service
- db-user, db-password
- redis-password
- jwt-secret
- keycloak-client-secret
- novu-api-key

### cns-service
- supabase-db-user, supabase-db-password
- components-db-user, components-db-password
- redis-password
- rabbitmq-password

### temporal
- postgresql-user, postgresql-password
- elasticsearch-password (optional)

### supabase
- postgres-password
- jwt-secret, anon-key, service-key

### novu
- jwt-secret, api-key
- mongodb-password
- redis-password

## Ingress Configuration

All services use nginx-ingress with cert-manager for TLS:

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: api.ananta.io
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: tenant-management-tls
      hosts:
        - api.ananta.io
```

## Monitoring Endpoints

All services expose Prometheus metrics:

| Service | Metrics Path | Port |
|---------|--------------|------|
| tenant-management-service | /metrics | 14000 |
| subscription-service | /metrics | 14001 |
| orchestrator-service | /metrics | 14002 |
| temporal-worker-service | /metrics | 8080 |
| cns-service | /metrics | 27200 |
| audit-logger | /metrics | 27300 |
| middleware-api | /metrics | 27350 |
| novu-consumer | /metrics | 9090 |

## Upgrade Strategy

All deployments use RollingUpdate strategy:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

Ensures:
- Zero-downtime deployments
- Gradual rollout
- Automatic rollback on failure

## Testing

After deployment, test each service:

```bash
# Health checks
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://tenant-management-service.ananta-dev.svc.cluster.local:14000/health

# Port-forward for local testing
kubectl port-forward -n ananta-dev svc/tenant-management-service 14000:14000
curl http://localhost:14000/ping

# Check logs
kubectl logs -n ananta-dev deployment/tenant-management-service --tail=100

# Watch pods
kubectl get pods -n ananta-dev -w
```

## Performance Tuning

### CPU/Memory Optimization

Adjust resources based on load testing:

```yaml
# Example for high-traffic services
resources:
  limits:
    cpu: 2000m
    memory: 4Gi
  requests:
    cpu: 500m
    memory: 1Gi
```

### Autoscaling Tuning

Adjust HPA targets:

```yaml
autoscaling:
  enabled: true
  minReplicas: 5
  maxReplicas: 50
  targetCPUUtilizationPercentage: 60  # Scale earlier
  targetMemoryUtilizationPercentage: 70
```

### Connection Pool Sizing

For database-heavy services, tune connection pools:

```yaml
configMap:
  DB_POOL_MIN: "5"
  DB_POOL_MAX: "20"
  DB_IDLE_TIMEOUT: "10000"
```

## Troubleshooting

Common issues and solutions documented in `DEPLOYMENT-GUIDE.md`:

- Pods not starting
- ImagePullBackOff
- CrashLoopBackOff
- Database connection issues
- Ingress not working
- HPA not scaling

## Next Steps

1. **Create Secrets**: Use External Secrets Operator or create manually
2. **Deploy Infrastructure**: Start with temporal, supabase, novu
3. **Deploy Control Plane**: tenant-management-service, workers, admin-app
4. **Deploy App Plane**: cns-service, customer-portal, etc.
5. **Configure Monitoring**: Set up Grafana dashboards
6. **Set up Alerts**: Configure Prometheus AlertManager
7. **CI/CD Integration**: Connect to ArgoCD for GitOps

## Support & Documentation

- **Main README**: `infrastructure/kubernetes/helm/README.md`
- **Deployment Guide**: `infrastructure/kubernetes/helm/DEPLOYMENT-GUIDE.md`
- **Validation Script**: `./validate-charts.sh`
- **Quick Install**: `./quick-install.sh`
- **ArgoCD Apps**: `infrastructure/gitops/argocd/applications/`

## License

Copyright (c) 2026 Ananta Platform
