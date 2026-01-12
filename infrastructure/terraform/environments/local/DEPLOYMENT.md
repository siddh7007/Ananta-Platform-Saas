# Ananta Platform - Local Kubernetes Deployment

This document describes the Terraform-based deployment of Ananta Platform to a local Kubernetes cluster (Rancher Desktop/k3s).

## Platform Architecture

The platform consists of multiple namespaces:

| Namespace | Purpose | Services |
|-----------|---------|----------|
| `control-plane` | Multi-tenant SaaS control plane | tenant-management-service, orchestrator, subscription, temporal-worker, admin-app |
| `app-plane` | Application plane services | CNS service, Customer Portal, Supabase, Components DB, Redis, RabbitMQ, MinIO |
| `auth-system` | Authentication | Keycloak |
| `temporal-system` | Workflow orchestration | Temporal server, Temporal UI |
| `cache-system` | Shared cache | Redis |
| `database-system` | Shared database | CloudNative-PG (optional) |
| `vault-system` | Secrets management | HashiCorp Vault |

## Prerequisites

1. **Kubernetes Cluster**: Rancher Desktop with k3s or equivalent
2. **Terraform**: v1.5+ installed
3. **kubectl**: Configured to access the cluster
4. **Docker Images**: Pre-built images for CNS service and Customer Portal

## Building Docker Images

**CRITICAL**: There are TWO customer-portal applications. Use the **arc-saas** one:

| Portal | Path | Use Case |
|--------|------|----------|
| Arc-SaaS Customer Portal | `arc-saas/apps/customer-portal/` | Control Plane CBP (Refine.dev) - **USE THIS** |
| App Plane Customer Portal | `app-plane/services/customer-portal/` | CNS frontend (React Admin) - **DO NOT USE** |

### Build Customer Portal (Arc-SaaS)
```bash
cd arc-saas/apps/customer-portal
bun run build
docker build -t ananta/customer-portal:local .
```

### Build CNS Service
```bash
cd app-plane/services/cns-service
docker build -t ananta/cns-service:local .
```

Since Rancher Desktop uses Docker runtime, locally built images are **automatically available** to the cluster. No need for `kind load` or `nerdctl import`.

## Quick Start

```bash
# 1. Navigate to local environment
cd infrastructure/terraform/environments/local

# 2. Initialize Terraform
terraform init

# 3. Deploy the full platform
terraform apply -auto-approve \
  -var="deploy_app_plane=true" \
  -var="deploy_cns_service=true" \
  -var="deploy_customer_portal=true" \
  -var="cns_service_image=ananta/cns-service:local" \
  -var="customer_portal_image=ananta/customer-portal:local"
```

## Service Ports

### Control Plane
| Service | Cluster Port | Description |
|---------|--------------|-------------|
| tenant-management-service | 14000 | Main backend API |
| orchestrator-service | 3001 | Workflow orchestration |
| subscription-service | 3002 | Subscription management |
| admin-app | 80 | Admin portal UI |

### App Plane
| Service | Cluster Port | Description |
|---------|--------------|-------------|
| cns-service | 27200 | Component Normalization Service API |
| customer-portal | 27100 | Customer-facing React app |
| supabase-db | 5432 | Supabase PostgreSQL |
| supabase-api | 3000 | PostgREST API |
| components-db | 5432 | Components-V2 PostgreSQL |
| redis | 6379 | Cache |
| rabbitmq | 5672/15672 | Message broker |
| minio | 9000/9001 | S3-compatible storage |

### Infrastructure
| Service | Namespace | Cluster Port | Description |
|---------|-----------|--------------|-------------|
| keycloak | auth-system | 8080 | Identity provider |
| temporal | temporal-system | 7233 | Workflow engine |
| temporal-ui | temporal-system | 8080 | Temporal dashboard |

## Port Forwarding

To access services locally:

```bash
# Control Plane API
kubectl port-forward -n control-plane svc/tenant-management-service 14000:14000

# Admin App
kubectl port-forward -n control-plane svc/admin-app 27555:80

# CNS Service API
kubectl port-forward -n app-plane svc/cns-service 27200:27200

# Customer Portal
kubectl port-forward -n app-plane svc/customer-portal 27100:27100

# Keycloak
kubectl port-forward -n auth-system svc/keycloak 8180:8080

# Temporal UI
kubectl port-forward -n temporal-system svc/temporal-ui 27021:8080

# RabbitMQ Management
kubectl port-forward -n app-plane svc/rabbitmq 15672:15672

# MinIO Console
kubectl port-forward -n app-plane svc/minio 9001:9001
```

## Database Migrations

The deployment includes automatic database migrations when `run_migrations=true`:

1. **Supabase DB**: Creates roles (supabase_admin, authenticator, anon, authenticated, service_role) and runs master migration
2. **Components-V2 DB**: Creates component catalog tables

### Manual Migration (if needed)

```bash
# Create Supabase roles manually
kubectl exec -n app-plane supabase-db-0 -- psql -U postgres -c "
  CREATE ROLE supabase_admin WITH LOGIN SUPERUSER PASSWORD 'postgres';
  CREATE ROLE authenticator WITH LOGIN NOINHERIT PASSWORD 'postgres';
  CREATE ROLE anon NOLOGIN NOINHERIT;
  CREATE ROLE authenticated NOLOGIN NOINHERIT;
  CREATE ROLE service_role WITH LOGIN BYPASSRLS PASSWORD 'postgres';
  GRANT anon TO authenticator;
  GRANT authenticated TO authenticator;
  GRANT service_role TO authenticator;
"

# Run Supabase migration
kubectl exec -n app-plane supabase-db-0 -- psql -U postgres -f /path/to/001_SUPABASE_MASTER.sql

# Run Components-V2 migration
kubectl exec -n app-plane components-db-0 -- psql -U postgres -d components_v2 -f /path/to/002_COMPONENTS_V2_MASTER.sql
```

## Vendor API Keys

CNS Service vendor API keys are stored in Kubernetes Secret `ananta-cns-service-secrets`:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET_KEY` | CNS authentication secret |
| `MOUSER_API_KEY` | Mouser Electronics API key |
| `DIGIKEY_CLIENT_ID` | DigiKey OAuth client ID |
| `DIGIKEY_CLIENT_SECRET` | DigiKey OAuth client secret |
| `ELEMENT14_API_KEY` | Element14/Farnell API key |
| `ARROW_API_KEY` | Arrow Electronics API key |

Configure these in `variables.tf` or via `-var` flags:

```bash
terraform apply \
  -var="mouser_api_key=your-key" \
  -var="digikey_client_id=your-client-id" \
  -var="digikey_client_secret=your-secret" \
  -var="element14_api_key=your-key"
```

## Verification

Check deployment status:

```bash
# All pods should be Running
kubectl get pods --all-namespaces -l "app.kubernetes.io/part-of in (ananta-app-plane,ananta-platform)"

# Check services
kubectl get svc -n app-plane
kubectl get svc -n control-plane

# Check CNS health
curl http://localhost:27200/health

# Check Customer Portal
curl http://localhost:27100/
```

## Troubleshooting

### RabbitMQ CrashLoopBackOff
RabbitMQ may fail startup probes if the cluster is resource-constrained. The deployment includes:
- Startup probe: 10s initial delay, 10s period, 15 failures allowed (2.5 min total)
- Readiness probe: 5s initial delay, 10s period, 10s timeout
- Liveness probe: 10s initial delay, 30s period, 10s timeout

If still failing, delete and recreate:
```bash
kubectl delete deployment rabbitmq -n app-plane
kubectl apply -f infrastructure/kubernetes/rabbitmq-deployment.yaml
```

### Supabase Migration Fails
If migration fails with "role does not exist", create roles first (see Manual Migration above).

### Terraform Provider Bug
The Kubernetes provider may show "Unexpected Identity Change" errors. Workaround:
```bash
terraform state rm <resource_address>
terraform apply
```

## Files Modified

- `modules/app-plane/kubernetes/main.tf` - Added CNS secrets, Supabase role creation in migration job
- `modules/app-plane/kubernetes/variables.tf` - Added vendor API key variables
- `environments/local/variables.tf` - Added vendor API key defaults
- `environments/local/main.tf` - Passes vendor API keys to app_plane module

## Additional Optional Services

### Deploying CNS Dashboard

```bash
# Build CNS Dashboard image first
cd app-plane/services/cns-service/dashboard
bun install && bun run build
cd ../../../../
docker build -t ananta/cns-dashboard:local -f app-plane/services/cns-service/dashboard/Dockerfile app-plane

# Deploy with CNS Dashboard
terraform apply -auto-approve \
  -var="deploy_app_plane=true" \
  -var="deploy_cns_service=true" \
  -var="deploy_cns_dashboard=true" \
  -var="cns_service_image=ananta/cns-service:local" \
  -var="cns_dashboard_image=ananta/cns-dashboard:local"
```

### Deploying Supabase Studio (Database Admin UI)

```bash
# Supabase Studio is enabled by default
terraform apply -auto-approve \
  -var="deploy_app_plane=true" \
  -var="deploy_supabase_studio=true"

# Access Supabase Studio
kubectl port-forward -n app-plane svc/supabase-studio 27800:27800
# Open http://localhost:27800
```

### Deploying Novu (Notification Services)

Novu provides a full-featured notification infrastructure:
- **novu-api** (port 13100): Main API
- **novu-ws** (port 13102): WebSocket server
- **novu-worker**: Background job processor
- **novu-web** (port 13200): Dashboard UI
- **novu-mongodb**: Dedicated MongoDB instance
- **novu-redis**: Dedicated Redis instance

```bash
terraform apply -auto-approve \
  -var="deploy_app_plane=true" \
  -var="deploy_novu=true"

# Access Novu Dashboard
kubectl port-forward -n app-plane svc/novu-web 13200:13200
# Open http://localhost:13200
```

### Deploying Observability Stack (Jaeger, Prometheus, Grafana)

```bash
terraform apply -auto-approve \
  -var="deploy_app_plane=true" \
  -var="deploy_observability=true"

# Access services:
# Jaeger UI
kubectl port-forward -n app-plane svc/jaeger 16686:16686
# Open http://localhost:16686

# Prometheus
kubectl port-forward -n app-plane svc/prometheus 9090:9090
# Open http://localhost:9090

# Grafana (admin/admin123)
kubectl port-forward -n app-plane svc/grafana 3000:3000
# Open http://localhost:3000
```

### Full Platform Deployment (All Services)

```bash
terraform apply -auto-approve \
  -var="deploy_app_plane=true" \
  -var="deploy_cns_service=true" \
  -var="deploy_customer_portal=true" \
  -var="deploy_cns_dashboard=true" \
  -var="deploy_supabase_studio=true" \
  -var="deploy_novu=true" \
  -var="deploy_observability=true" \
  -var="cns_service_image=ananta/cns-service:local" \
  -var="cns_dashboard_image=ananta/cns-dashboard:local" \
  -var="customer_portal_image=ananta/customer-portal:local"
```

## Service Port Reference

### App Plane Services (Extended)
| Service | Cluster Port | Description |
|---------|--------------|-------------|
| cns-dashboard | 27250 | CNS Admin Dashboard |
| supabase-studio | 27800 | Database Admin UI |
| novu-api | 13100 | Notification API |
| novu-ws | 13102 | Notification WebSocket |
| novu-web | 13200 | Notification Dashboard |
| jaeger | 16686 | Distributed Tracing UI |
| prometheus | 9090 | Metrics Collection |
| grafana | 3000 | Metrics Dashboards |

## Current Status (2026-01-08)

All services running:
- Control Plane: 5/5 pods running
- App Plane: 8/8 pods running
- Auth System: 1/1 pods running
- Temporal System: 2/2 pods running
- Cache System: 1/1 pods running
