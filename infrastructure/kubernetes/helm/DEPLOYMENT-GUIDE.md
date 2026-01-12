# Ananta Platform - Kubernetes Deployment Guide

## Overview

This guide covers deploying the Ananta Platform SaaS application to Kubernetes using Helm charts and ArgoCD GitOps.

## Directory Structure

```
infrastructure/kubernetes/helm/
├── README.md                           # Usage documentation
├── DEPLOYMENT-GUIDE.md                 # This file
├── validate-charts.sh                  # Validation script
├── generate-remaining-values.sh        # Values generation helper
│
├── Control Plane Services (5)
│   ├── tenant-management-service/      # Main backend API (port 14000)
│   ├── temporal-worker-service/        # Workflow workers
│   ├── subscription-service/           # Billing service (port 14001)
│   ├── orchestrator-service/           # Orchestration (port 14002)
│   └── admin-app/                      # React admin UI (port 80)
│
├── App Plane Services (7)
│   ├── cns-service/                    # Component enrichment (port 27200)
│   ├── cns-dashboard/                  # CNS admin UI (port 27250)
│   ├── customer-portal/                # Customer UI (port 27100)
│   ├── backstage-portal/               # Developer portal (port 7007)
│   ├── audit-logger/                   # Audit logs (port 27300)
│   ├── middleware-api/                 # API gateway (port 27350)
│   └── novu-consumer/                  # Notification consumer
│
└── Infrastructure Services (3)
    ├── temporal/                       # Workflow engine
    ├── novu/                           # Notifications
    └── supabase/                       # Database/APIs

Total: 15 Helm charts, 199 YAML files
```

## Prerequisites

### Required Tools
- Kubernetes cluster 1.25+
- kubectl 1.25+
- Helm 3.10+
- ArgoCD 2.8+ (for GitOps)

### Required Infrastructure
- Ingress Controller (nginx-ingress)
- Certificate Manager (cert-manager)
- Prometheus Operator (optional, for monitoring)
- External Secrets Operator (recommended, for secrets)

### External Dependencies
- PostgreSQL (for databases)
- Redis (for caching)
- RabbitMQ (for messaging)
- MinIO/S3 (for object storage)
- MongoDB (for Novu)

## Pre-Deployment Setup

### 1. Create Namespaces

```bash
# Create namespaces for each environment
kubectl create namespace ananta-dev
kubectl create namespace ananta-staging
kubectl create namespace ananta-prod

# Create supporting namespaces
kubectl create namespace database-system
kubectl create namespace cache-system
kubectl create namespace messaging-system
kubectl create namespace storage-system
kubectl create namespace observability-system
kubectl create namespace temporal-system
```

### 2. Configure Ingress Controller

```bash
# Install nginx-ingress-controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.metrics.enabled=true
```

### 3. Configure Certificate Manager

```bash
# Install cert-manager
helm repo add jetstack https://charts.jetstack.io
helm repo update

helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true

# Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@ananta.io
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### 4. Create Secrets

Create secrets for each service in each namespace.

#### Example: Tenant Management Service Secrets

```bash
kubectl create secret generic tenant-management-secrets \
  --namespace ananta-dev \
  --from-literal=db-user=postgres \
  --from-literal=db-password=YOUR_DB_PASSWORD \
  --from-literal=redis-password=YOUR_REDIS_PASSWORD \
  --from-literal=jwt-secret=YOUR_JWT_SECRET \
  --from-literal=keycloak-client-secret=YOUR_KEYCLOAK_SECRET \
  --from-literal=novu-api-key=YOUR_NOVU_KEY
```

#### All Required Secrets

For each environment (dev/staging/prod), create these secrets:

| Service | Secret Name | Keys |
|---------|-------------|------|
| tenant-management-service | tenant-management-secrets | db-user, db-password, redis-password, jwt-secret, keycloak-client-secret, novu-api-key |
| temporal-worker-service | temporal-worker-secrets | db-user, db-password, keycloak-admin-password |
| subscription-service | subscription-secrets | db-user, db-password, stripe-api-key, paddle-api-key |
| orchestrator-service | orchestrator-secrets | db-user, db-password, rabbitmq-password |
| cns-service | cns-service-secrets | supabase-db-user, supabase-db-password, components-db-user, components-db-password, redis-password, rabbitmq-password |
| backstage-portal | backstage-secrets | db-user, db-password, github-token |
| audit-logger | audit-logger-secrets | db-user, db-password |
| middleware-api | middleware-secrets | api-key |
| novu-consumer | novu-consumer-secrets | novu-api-key, rabbitmq-password |
| temporal | temporal-db-secrets | postgresql-user, postgresql-password |
| temporal | temporal-es-secrets | elasticsearch-password |
| supabase | supabase-db-secrets | postgres-password |
| supabase | supabase-jwt-secrets | jwt-secret, anon-key, service-key |
| novu | novu-secrets | jwt-secret, api-key |
| novu | novu-mongodb-secrets | mongodb-password |
| novu | novu-redis-secrets | redis-password |

#### Using External Secrets Operator (Recommended)

```bash
# Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

helm install external-secrets \
   external-secrets/external-secrets \
    -n external-secrets-system \
    --create-namespace

# Create SecretStore pointing to AWS Secrets Manager / Vault
cat <<EOF | kubectl apply -f -
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: ananta-dev
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
EOF

# Create ExternalSecret
cat <<EOF | kubectl apply -f -
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: tenant-management-secrets
  namespace: ananta-dev
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: tenant-management-secrets
  data:
  - secretKey: db-password
    remoteRef:
      key: ananta/dev/postgres
      property: password
  - secretKey: jwt-secret
    remoteRef:
      key: ananta/dev/jwt
      property: secret
EOF
```

## Deployment Methods

### Method 1: Direct Helm Installation

```bash
# Install single service
helm install tenant-management-service \
  ./tenant-management-service \
  --namespace ananta-dev \
  --values ./tenant-management-service/values-dev.yaml \
  --set image.tag=v1.0.0

# Install with custom overrides
helm install tenant-management-service \
  ./tenant-management-service \
  --namespace ananta-dev \
  --values ./tenant-management-service/values-dev.yaml \
  --set image.tag=v1.0.0 \
  --set replicaCount=3 \
  --set resources.limits.cpu=1000m

# Upgrade existing deployment
helm upgrade tenant-management-service \
  ./tenant-management-service \
  --namespace ananta-dev \
  --values ./tenant-management-service/values-dev.yaml \
  --set image.tag=v1.0.1

# Rollback
helm rollback tenant-management-service 1 --namespace ananta-dev
```

### Method 2: ArgoCD GitOps (Recommended)

The platform is designed for ArgoCD GitOps workflows.

#### Install ArgoCD

```bash
kubectl create namespace argocd

kubectl apply -n argocd -f \
  https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Access ArgoCD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

#### Apply ArgoCD Applications

ArgoCD Application manifests are in `infrastructure/gitops/argocd/applications/`.

```bash
# Apply all applications
kubectl apply -k infrastructure/gitops/argocd/applications/

# Or apply individually
kubectl apply -f infrastructure/gitops/argocd/applications/control-plane/tenant-management-service.yaml
kubectl apply -f infrastructure/gitops/argocd/applications/control-plane/admin-app.yaml
kubectl apply -f infrastructure/gitops/argocd/applications/app-plane/cns-service.yaml
```

ArgoCD will automatically:
- Sync Helm charts from Git
- Apply environment-specific values
- Handle rolling updates
- Auto-heal configuration drift
- Prune deleted resources

## Deployment Order

Deploy services in this order to satisfy dependencies:

### Phase 1: Infrastructure Services

```bash
# 1. Temporal (workflow engine)
helm install temporal ./temporal \
  --namespace temporal-system \
  --values ./temporal/values-dev.yaml

# 2. Supabase (if self-hosting)
helm install supabase ./supabase \
  --namespace database-system \
  --values ./supabase/values-dev.yaml

# 3. Novu (if self-hosting)
helm install novu ./novu \
  --namespace ananta-dev \
  --values ./novu/values-dev.yaml
```

### Phase 2: Control Plane Services

```bash
# 1. Tenant Management Service (core API)
helm install tenant-management-service ./tenant-management-service \
  --namespace ananta-dev \
  --values ./tenant-management-service/values-dev.yaml \
  --set image.tag=v1.0.0

# 2. Temporal Worker Service
helm install temporal-worker-service ./temporal-worker-service \
  --namespace ananta-dev \
  --values ./temporal-worker-service/values-dev.yaml \
  --set image.tag=v1.0.0

# 3. Subscription Service
helm install subscription-service ./subscription-service \
  --namespace ananta-dev \
  --values ./subscription-service/values-dev.yaml \
  --set image.tag=v1.0.0

# 4. Orchestrator Service
helm install orchestrator-service ./orchestrator-service \
  --namespace ananta-dev \
  --values ./orchestrator-service/values-dev.yaml \
  --set image.tag=v1.0.0

# 5. Admin App (frontend)
helm install admin-app ./admin-app \
  --namespace ananta-dev \
  --values ./admin-app/values-dev.yaml \
  --set image.tag=v1.0.0
```

### Phase 3: App Plane Services

```bash
# 1. CNS Service
helm install cns-service ./cns-service \
  --namespace ananta-dev \
  --values ./cns-service/values-dev.yaml \
  --set image.tag=v1.0.0

# 2. Customer Portal
helm install customer-portal ./customer-portal \
  --namespace ananta-dev \
  --values ./customer-portal/values-dev.yaml \
  --set image.tag=v1.0.0

# 3. CNS Dashboard
helm install cns-dashboard ./cns-dashboard \
  --namespace ananta-dev \
  --values ./cns-dashboard/values-dev.yaml \
  --set image.tag=v1.0.0

# 4. Backstage Portal
helm install backstage-portal ./backstage-portal \
  --namespace ananta-dev \
  --values ./backstage-portal/values-dev.yaml \
  --set image.tag=v1.0.0

# 5. Audit Logger
helm install audit-logger ./audit-logger \
  --namespace ananta-dev \
  --values ./audit-logger/values-dev.yaml \
  --set image.tag=v1.0.0

# 6. Middleware API
helm install middleware-api ./middleware-api \
  --namespace ananta-dev \
  --values ./middleware-api/values-dev.yaml \
  --set image.tag=v1.0.0

# 7. Novu Consumer
helm install novu-consumer ./novu-consumer \
  --namespace ananta-dev \
  --values ./novu-consumer/values-dev.yaml \
  --set image.tag=v1.0.0
```

## Verification

### Check Deployments

```bash
# List all deployments
kubectl get deployments -n ananta-dev

# Check pod status
kubectl get pods -n ananta-dev

# View service endpoints
kubectl get svc -n ananta-dev

# Check ingresses
kubectl get ingress -n ananta-dev
```

### Check Health

```bash
# Test health endpoints
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://tenant-management-service.ananta-dev.svc.cluster.local:14000/health

# Check logs
kubectl logs -n ananta-dev deployment/tenant-management-service --tail=100

# Check events
kubectl get events -n ananta-dev --sort-by='.lastTimestamp'
```

### Access Services

```bash
# Port-forward for local testing
kubectl port-forward -n ananta-dev svc/tenant-management-service 14000:14000
kubectl port-forward -n ananta-dev svc/admin-app 8080:80

# Test API
curl http://localhost:14000/health
curl http://localhost:14000/ping

# Access UI
open http://localhost:8080
```

## Monitoring

### Prometheus ServiceMonitors

All services expose Prometheus metrics via ServiceMonitor CRDs.

```bash
# Check ServiceMonitors
kubectl get servicemonitors -n ananta-dev

# View metrics endpoints
kubectl get endpoints -n ananta-dev | grep metrics
```

### Grafana Dashboards

Import pre-built dashboards:

- **Platform Overview**: `infrastructure/monitoring/grafana/dashboards/platform-overview.json`
- **Service Metrics**: `infrastructure/monitoring/grafana/dashboards/service-metrics.json`
- **Database Metrics**: `infrastructure/monitoring/grafana/dashboards/database-metrics.json`

## Troubleshooting

### Common Issues

#### Pods not starting

```bash
# Check pod status
kubectl describe pod -n ananta-dev <pod-name>

# Check logs
kubectl logs -n ananta-dev <pod-name> --previous

# Check events
kubectl get events -n ananta-dev --field-selector involvedObject.name=<pod-name>
```

#### ImagePullBackOff

```bash
# Check image pull secrets
kubectl get secrets -n ananta-dev

# Create image pull secret
kubectl create secret docker-registry ghcr-secret \
  --namespace ananta-dev \
  --docker-server=ghcr.io \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_TOKEN

# Add to values.yaml
imagePullSecrets:
  - name: ghcr-secret
```

#### CrashLoopBackOff

```bash
# Check container logs
kubectl logs -n ananta-dev <pod-name> --tail=100

# Check liveness probe
kubectl describe pod -n ananta-dev <pod-name> | grep -A 10 Liveness

# Temporarily disable probes for debugging
helm upgrade tenant-management-service ./tenant-management-service \
  --namespace ananta-dev \
  --values ./tenant-management-service/values-dev.yaml \
  --set livenessProbe.enabled=false \
  --set readinessProbe.enabled=false
```

#### Database connection issues

```bash
# Test database connectivity
kubectl run -it --rm psql --image=postgres:15 --restart=Never -- \
  psql -h postgres.database-system.svc.cluster.local -U postgres

# Check secrets
kubectl get secret tenant-management-secrets -n ananta-dev -o yaml

# Verify environment variables
kubectl exec -n ananta-dev deployment/tenant-management-service -- env | grep DB_
```

#### Ingress not working

```bash
# Check ingress status
kubectl describe ingress -n ananta-dev tenant-management-service

# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller --tail=100

# Verify DNS
nslookup api-dev.ananta.local

# Test without ingress
kubectl port-forward -n ananta-dev svc/tenant-management-service 14000:14000
curl http://localhost:14000/health
```

## Upgrades

### Rolling Updates

```bash
# Update image tag
helm upgrade tenant-management-service ./tenant-management-service \
  --namespace ananta-dev \
  --values ./tenant-management-service/values-dev.yaml \
  --set image.tag=v1.0.1 \
  --wait

# Watch rollout
kubectl rollout status deployment/tenant-management-service -n ananta-dev

# Rollback if needed
kubectl rollout undo deployment/tenant-management-service -n ananta-dev
```

### Blue-Green Deployments

```bash
# Deploy new version with different name
helm install tenant-management-service-v2 ./tenant-management-service \
  --namespace ananta-dev \
  --values ./tenant-management-service/values-dev.yaml \
  --set image.tag=v2.0.0 \
  --set fullnameOverride=tenant-management-service-v2

# Test new version
kubectl port-forward -n ananta-dev svc/tenant-management-service-v2 14001:14000

# Switch ingress to new version
kubectl patch ingress tenant-management-service -n ananta-dev \
  --type=json -p='[{"op": "replace", "path": "/spec/rules/0/http/paths/0/backend/service/name", "value": "tenant-management-service-v2"}]'

# Delete old version
helm uninstall tenant-management-service --namespace ananta-dev
```

## Backup and Restore

### Backup Helm Releases

```bash
# Export all values
helm get values tenant-management-service -n ananta-dev > backup-values.yaml

# Export all manifests
helm get manifest tenant-management-service -n ananta-dev > backup-manifest.yaml
```

### Backup Secrets

```bash
# Export all secrets
kubectl get secrets -n ananta-dev -o yaml > backup-secrets.yaml

# Encrypt secrets with Sealed Secrets
kubeseal --format=yaml < backup-secrets.yaml > sealed-secrets.yaml
```

## Security Best Practices

1. **Never commit secrets to Git** - Use External Secrets Operator
2. **Use RBAC** - Limit service account permissions
3. **Network Policies** - Restrict pod-to-pod communication
4. **Pod Security Standards** - Use restricted security context
5. **Image Scanning** - Scan all images before deployment
6. **TLS Everywhere** - Use cert-manager for automatic TLS
7. **Regular Updates** - Keep Kubernetes and dependencies updated

## Support

For issues or questions:
- GitHub Issues: https://github.com/your-org/ananta-platform-saas/issues
- Slack: #platform-support
- Documentation: https://docs.ananta-platform.io
