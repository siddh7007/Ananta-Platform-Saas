# Ananta Platform Helm Charts

Production-ready Helm charts for deploying the Ananta Platform SaaS application on Kubernetes.

## Directory Structure

```
helm/
├── README.md                           # This file
├── tenant-management-service/          # Control Plane - Main API
├── temporal-worker-service/            # Control Plane - Temporal workers
├── subscription-service/               # Control Plane - Billing
├── orchestrator-service/               # Control Plane - Orchestration
├── admin-app/                          # Control Plane - Admin UI
├── cns-service/                        # App Plane - Component enrichment
├── cns-dashboard/                      # App Plane - CNS admin UI
├── customer-portal/                    # App Plane - Customer UI
├── backstage-portal/                   # App Plane - Developer portal
├── audit-logger/                       # App Plane - Audit logs
├── middleware-api/                     # App Plane - API gateway
├── novu-consumer/                      # App Plane - Notifications
├── temporal/                           # Infrastructure - Workflow engine
├── novu/                               # Infrastructure - Notifications
└── supabase/                           # Infrastructure - Database

Each chart contains:
├── Chart.yaml                          # Chart metadata
├── values.yaml                         # Default configuration
├── values-dev.yaml                     # Development overrides
├── values-staging.yaml                 # Staging overrides
├── values-prod.yaml                    # Production overrides
└── templates/
    ├── _helpers.tpl                    # Template helpers
    ├── deployment.yaml                 # Kubernetes Deployment
    ├── service.yaml                    # Kubernetes Service
    ├── ingress.yaml                    # Ingress resource
    ├── configmap.yaml                  # ConfigMap for env vars
    ├── secret.yaml                     # Secret (optional)
    ├── hpa.yaml                        # HorizontalPodAutoscaler
    ├── servicemonitor.yaml             # Prometheus ServiceMonitor
    ├── serviceaccount.yaml             # ServiceAccount
    └── poddisruptionbudget.yaml        # PodDisruptionBudget
```

## Service Ports

### Control Plane
| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| tenant-management-service | 14000 | HTTP | Main backend API |
| temporal-worker-service | 8080 | HTTP | Metrics only (no API) |
| subscription-service | 14001 | HTTP | Billing API |
| orchestrator-service | 14002 | HTTP | Orchestration API |
| admin-app | 80 | HTTP | Admin portal (nginx) |

### App Plane
| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| cns-service | 27200 | HTTP | Component enrichment API |
| cns-dashboard | 27250 | HTTP | CNS admin UI (nginx) |
| customer-portal | 27100 | HTTP | Customer portal (nginx) |
| backstage-portal | 7007 | HTTP | Developer portal |
| audit-logger | 27300 | HTTP | Audit logging API |
| middleware-api | 27350 | HTTP | API gateway |
| novu-consumer | - | - | Consumer only (no HTTP) |

### Infrastructure
| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| temporal | 7233 | gRPC | Workflow engine |
| temporal-ui | 8080 | HTTP | Web UI |
| novu | 3000 | HTTP | Notification API |
| supabase | 54321 | HTTP | Studio UI |
| supabase-api | 3000 | HTTP | PostgREST API |

## Installation

### Prerequisites

1. Kubernetes cluster (1.25+)
2. Helm 3.10+
3. kubectl configured
4. Cert-manager for TLS certificates
5. Nginx Ingress Controller
6. Prometheus Operator (optional, for metrics)

### Quick Start

```bash
# Add namespace
kubectl create namespace ananta-dev

# Install a service
helm install tenant-management-service ./tenant-management-service \
  --namespace ananta-dev \
  --values ./tenant-management-service/values-dev.yaml

# Install with custom values
helm install tenant-management-service ./tenant-management-service \
  --namespace ananta-dev \
  --values ./tenant-management-service/values-dev.yaml \
  --set image.tag=v1.2.3 \
  --set replicaCount=3
```

### Environment-Specific Deployments

#### Development
```bash
helm install <service-name> ./<service-name> \
  --namespace ananta-dev \
  --values ./<service-name>/values-dev.yaml
```

#### Staging
```bash
helm install <service-name> ./<service-name> \
  --namespace ananta-staging \
  --values ./<service-name>/values-staging.yaml
```

#### Production
```bash
helm install <service-name> ./<service-name> \
  --namespace ananta-prod \
  --values ./<service-name>/values-prod.yaml \
  --set image.tag=v1.2.3  # Always specify version in prod
```

## Configuration

### Common Values

All charts support these common values:

```yaml
# Replicas (overridden per environment)
replicaCount: 2

# Image configuration
image:
  repository: ghcr.io/ananta-platform/<service-name>
  pullPolicy: IfNotPresent
  tag: ""  # Defaults to Chart.appVersion

# Resources
resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 256Mi

# Autoscaling
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

# Security
podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000

securityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop:
    - ALL
  readOnlyRootFilesystem: true

# High Availability
podDisruptionBudget:
  enabled: true
  minAvailable: 1

# Monitoring
serviceMonitor:
  enabled: true
  interval: 30s
```

### Secrets Management

Charts expect secrets to be pre-created. Use `existingSecret` pattern:

```yaml
secrets:
  existingSecret: "tenant-management-secrets"
```

Create secrets separately:

```bash
kubectl create secret generic tenant-management-secrets \
  --namespace ananta-dev \
  --from-literal=db-user=postgres \
  --from-literal=db-password=changeme \
  --from-literal=jwt-secret=super-secret-key \
  --from-literal=keycloak-client-secret=client-secret \
  --from-literal=novu-api-key=novu-key \
  --from-literal=redis-password=redis-pass
```

Or use Sealed Secrets / External Secrets Operator for GitOps:

```bash
# With Sealed Secrets
kubeseal --format=yaml < secrets.yaml > sealed-secrets.yaml

# With External Secrets Operator
kubectl apply -f external-secret.yaml
```

### Database Configuration

Backend services connect to PostgreSQL:

```yaml
database:
  host: postgres.database-system.svc.cluster.local
  port: 5432
  database: arc_saas
  # Credentials from secrets
```

### Redis Configuration

Services using Redis for caching:

```yaml
redis:
  host: redis.cache-system.svc.cluster.local
  port: 6379
  # Password from secrets
```

### Temporal Configuration

Services using Temporal workflows:

```yaml
temporal:
  address: temporal.temporal-system.svc.cluster.local:7233
  namespace: arc-saas
  taskQueue: tenant-provisioning
```

### Keycloak Configuration

Authentication via Keycloak:

```yaml
keycloak:
  url: https://auth.ananta.io
  realm: ananta
  clientId: tenant-management-service
  # clientSecret from secrets
```

## Ingress Configuration

Charts use Nginx Ingress Controller with cert-manager:

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
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

## Health Checks

All services have liveness, readiness, and startup probes:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 14000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: 14000
  initialDelaySeconds: 10
  periodSeconds: 5

startupProbe:
  httpGet:
    path: /health
    port: 14000
  initialDelaySeconds: 0
  periodSeconds: 10
  failureThreshold: 30
```

## Monitoring

Prometheus ServiceMonitor resources are included:

```yaml
serviceMonitor:
  enabled: true
  interval: 30s
  scrapeTimeout: 10s
  labels:
    prometheus: kube-prometheus
```

Metrics endpoints:
- Backend services: `/metrics` on service port
- Frontend apps: Nginx exporter sidecar (optional)

## Upgrades

```bash
# Upgrade with new values
helm upgrade tenant-management-service ./tenant-management-service \
  --namespace ananta-dev \
  --values ./tenant-management-service/values-dev.yaml \
  --set image.tag=v1.2.4

# Rollback
helm rollback tenant-management-service 1 --namespace ananta-dev

# View history
helm history tenant-management-service --namespace ananta-dev
```

## Uninstallation

```bash
helm uninstall tenant-management-service --namespace ananta-dev
```

## ArgoCD Integration

These charts are designed for ArgoCD GitOps workflows. See `infrastructure/gitops/argocd/applications/` for Application manifests.

Example ArgoCD Application:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tenant-management-service
  namespace: argocd
spec:
  project: ananta-platform
  source:
    repoURL: https://github.com/your-org/ananta-platform-saas.git
    targetRevision: HEAD
    path: infrastructure/kubernetes/helm/tenant-management-service
    helm:
      valueFiles:
        - values.yaml
        - values-dev.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: ananta-dev
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

## Troubleshooting

### Pods not starting

```bash
# Check pod status
kubectl get pods -n ananta-dev

# View pod logs
kubectl logs -n ananta-dev <pod-name>

# Describe pod for events
kubectl describe pod -n ananta-dev <pod-name>
```

### Ingress issues

```bash
# Check ingress
kubectl get ingress -n ananta-dev

# View ingress controller logs
kubectl logs -n ingress-nginx <ingress-controller-pod>
```

### Database connection issues

```bash
# Test database connectivity
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql -h postgres.database-system.svc.cluster.local -U postgres

# Check secrets
kubectl get secret tenant-management-secrets -n ananta-dev -o yaml
```

### HPA not scaling

```bash
# Check HPA status
kubectl get hpa -n ananta-dev

# View HPA details
kubectl describe hpa tenant-management-service -n ananta-dev

# Check metrics server
kubectl top pods -n ananta-dev
```

## Security Considerations

1. **Use existingSecret** - Never commit secrets to values files
2. **Read-only filesystem** - All containers use readOnlyRootFilesystem: true
3. **Non-root user** - All containers run as non-root
4. **Drop capabilities** - All containers drop ALL capabilities
5. **Network policies** - Implement network policies per namespace
6. **Pod Security Standards** - Use restricted pod security standards
7. **Image scanning** - Scan all images before deployment
8. **TLS everywhere** - Use cert-manager for automatic TLS

## Best Practices

1. **Always specify image tags in production** - Never use `latest`
2. **Use PodDisruptionBudgets** - Maintain availability during updates
3. **Set resource limits** - Prevent resource exhaustion
4. **Enable autoscaling** - Handle variable load
5. **Monitor everything** - Enable ServiceMonitors
6. **Test rollbacks** - Verify rollback procedures
7. **Use GitOps** - Deploy via ArgoCD, not `helm install`
8. **Separate configs per environment** - Use values-{env}.yaml files

## Support

For issues or questions:
- GitHub Issues: https://github.com/your-org/ananta-platform-saas/issues
- Slack: #platform-support
- Documentation: https://docs.ananta-platform.io

## License

Copyright (c) 2026 Ananta Platform
