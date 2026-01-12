# Ananta Control Plane - Rancher/Kubernetes Deployment

This folder contains all the files needed to deploy the Ananta Control Plane to a Rancher-managed Kubernetes cluster (or any k8s/k3s cluster).

## Prerequisites

1. **Kubernetes Cluster** - Rancher Desktop (k3s), Docker Desktop (Kubernetes), or Kind
2. **kubectl** - Configured to point to your cluster
3. **Docker** - For building images

## Directory Structure

```
infrastructure/rancher/
├── manifests/              # Kubernetes YAML manifests
│   ├── postgresql.yaml     # PostgreSQL database
│   ├── redis.yaml          # Redis cache
│   ├── keycloak.yaml       # Keycloak auth (auth-system namespace)
│   ├── temporal.yaml       # Temporal workflow engine
│   ├── control-plane.yaml  # Control plane namespace + tenant-management-service
│   ├── admin-app.yaml      # Admin portal frontend
│   ├── subscription-service.yaml
│   ├── orchestrator-service.yaml
│   └── temporal-worker-service.yaml
├── migrations/             # Database migrations
│   └── combined-migration.sql
├── scripts/                # Deployment scripts
│   ├── build-images.ps1    # Build all Docker images
│   ├── deploy-all.ps1      # Full deployment
│   ├── port-forward.ps1    # Start port forwarding
│   └── cleanup.ps1         # Remove all resources
└── README.md
```

## Quick Start

### 1. Build Docker Images

```powershell
cd infrastructure/rancher/scripts
.\build-images.ps1
```

This builds:
- `ananta/tenant-management-service:local`
- `ananta/subscription-service:local`
- `ananta/orchestrator-service:local`
- `ananta/temporal-worker-service:local`
- `ananta/admin-app:local`

### 2. Deploy to Kubernetes

```powershell
.\deploy-all.ps1
```

This will:
1. Create namespaces (database-system, cache-system, auth-system, temporal-system, control-plane)
2. Deploy PostgreSQL and Redis
3. Run database migrations
4. Deploy Keycloak and Temporal
5. Deploy all control plane services

### 3. Start Port Forwarding

```powershell
.\port-forward.ps1
```

## Service Endpoints

| Service | Local URL | Port |
|---------|-----------|------|
| Admin App | http://localhost:3000 | 3000 |
| Tenant Management API | http://localhost:14000 | 14000 |
| Subscription Service | http://localhost:3002 | 3002 |
| Orchestrator Service | http://localhost:3001 | 3001 |
| Keycloak | http://localhost:8180 | 8180 |
| Temporal UI | http://localhost:27021 | 27021 |
| PostgreSQL | localhost:5432 | 5432 |
| Redis | localhost:6379 | 6379 |

## Namespaces

| Namespace | Purpose |
|-----------|---------|
| control-plane | Main application services |
| auth-system | Keycloak authentication |
| temporal-system | Temporal workflow engine |
| database-system | PostgreSQL |
| cache-system | Redis |

## Database

- **Database Name**: `ananta`
- **Schema**: `main`
- **Credentials**: postgres / localdev123

### Tables Created

The migration creates 22 tables including:
- addresses, leads, tenants, contacts
- users, user_roles, user_invitations, user_activities
- subscriptions, invoices, plans
- settings, audit_logs
- payment_methods, payment_intents
- usage_events, tenant_quotas, usage_summaries
- notification_history

## Keycloak Setup

Default admin credentials:
- Username: `admin`
- Password: `admin123`

After deployment, create the `ananta` realm and configure:
1. Create realm `ananta`
2. Create client `admin-app` (public, SPA)
3. Configure redirect URIs for http://localhost:3000/*

## Cleanup

To remove all resources:

```powershell
.\cleanup.ps1
```

## Manual Deployment

If you prefer to deploy step by step:

```bash
# Create namespaces and infrastructure
kubectl apply -f manifests/postgresql.yaml
kubectl apply -f manifests/redis.yaml
kubectl apply -f manifests/keycloak.yaml
kubectl apply -f manifests/temporal.yaml

# Wait for PostgreSQL
kubectl wait --for=condition=available --timeout=120s deployment/postgresql -n database-system

# Run migrations (PowerShell)
Get-Content migrations/combined-migration.sql | kubectl exec -i -n database-system deployment/postgresql -- psql -U postgres -d ananta

# Deploy services
kubectl apply -f manifests/control-plane.yaml
kubectl apply -f manifests/admin-app.yaml
kubectl apply -f manifests/subscription-service.yaml
kubectl apply -f manifests/orchestrator-service.yaml
kubectl apply -f manifests/temporal-worker-service.yaml
```

## Troubleshooting

### Image Pull Errors

If you see `ImagePullBackOff`, ensure:
1. Images are built locally with `.\build-images.ps1`
2. `imagePullPolicy: Never` is set in manifests

### Connection Refused

Ensure port forwarding is running:
```powershell
.\port-forward.ps1
```

### Database Connection

Check PostgreSQL is running:
```bash
kubectl get pods -n database-system
kubectl logs -n database-system deployment/postgresql
```

### View Logs

```bash
# Tenant management service
kubectl logs -n control-plane deployment/tenant-management-service -f

# Admin app
kubectl logs -n control-plane deployment/admin-app -f

# Temporal worker
kubectl logs -n control-plane deployment/temporal-worker-service -f
```
