# Local Kubernetes Environment - Terraform Deployment

This directory contains Terraform configuration for deploying the complete Ananta Platform
to a local Kubernetes cluster (Rancher Desktop, Docker Desktop, Kind, Minikube, etc.).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Local Kubernetes Cluster                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │    Vault    │  │  PostgreSQL │  │    Redis    │  │  Keycloak   │       │
│  │  (secrets)  │  │ (database)  │  │   (cache)   │  │   (auth)    │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                │                │                │               │
│         └────────────────┴────────────────┴────────────────┘               │
│                                   │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Temporal                                     │   │
│  │  ┌─────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │ Server  │  │   History   │  │   Matching  │  │    Worker   │    │   │
│  │  └─────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Control Plane                                  │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │   │
│  │  │ Tenant Mgmt API │  │   Orchestrator  │  │  Subscription   │     │   │
│  │  │   (port 14000)  │  │   (port 3001)   │  │   (port 3002)   │     │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘     │   │
│  │  ┌─────────────────┐  ┌─────────────────┐                          │   │
│  │  │ Temporal Worker │  │    Admin App    │                          │   │
│  │  │   (no HTTP)     │  │   (port 80)     │                          │   │
│  │  └─────────────────┘  └─────────────────┘                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Local Kubernetes cluster** (one of):
   - Rancher Desktop (recommended)
   - Docker Desktop with Kubernetes enabled
   - Kind
   - Minikube

2. **Tools installed**:
   ```bash
   # Terraform
   brew install terraform  # macOS
   choco install terraform # Windows

   # kubectl
   brew install kubectl    # macOS (usually included with Rancher/Docker Desktop)

   # Helm
   brew install helm       # macOS
   choco install kubernetes-helm # Windows
   ```

3. **Docker images built** (if using local images):
   ```bash
   cd arc-saas/services/tenant-management-service
   docker build -t ananta/tenant-management-service:latest .

   # Repeat for other services...
   ```

## Quick Start

### 1. Initialize Terraform

```bash
cd infrastructure/terraform/environments/local
terraform init
```

### 2. Review the plan

```bash
terraform plan -var-file="local.tfvars"
```

### 3. Apply the configuration

```bash
terraform apply -var-file="local.tfvars"
```

### 4. Access the services

```bash
# Port-forward to access services
kubectl port-forward svc/ananta-vault -n vault-system 8200:8200 &
kubectl port-forward svc/postgresql -n database-system 5432:5432 &
kubectl port-forward svc/keycloak -n auth-system 8180:8080 &
kubectl port-forward svc/temporal-ui -n temporal-system 27021:8080 &
kubectl port-forward svc/admin-app -n control-plane 27555:80 &
kubectl port-forward svc/tenant-management-service -n control-plane 14000:14000 &
```

## Configuration

### Variables

Create a `local.tfvars` file:

```hcl
# local.tfvars
environment         = "local"
kubeconfig_context  = "rancher-desktop"  # or "docker-desktop", "kind-kind", etc.
storage_class       = "local-path"       # or "hostpath" for Docker Desktop

# Use Vault for secrets (recommended)
use_vault = true

# Database sizing
db_instance_size = "small"
db_storage_gb    = 10

# Redis sizing
redis_instance_size = "small"

# Service images (use local images)
tenant_management_image = "ananta/tenant-management-service:latest"
orchestrator_image      = "ananta/orchestrator-service:latest"
subscription_image      = "ananta/subscription-service:latest"
temporal_worker_image   = "ananta/temporal-worker-service:latest"
admin_app_image         = "ananta/admin-app:latest"
```

## Vault Integration

Vault is deployed in dev mode for local development. Secrets are automatically
seeded for all services.

### Accessing Vault

```bash
# Port-forward
kubectl port-forward svc/ananta-vault -n vault-system 8200:8200

# Access UI
open http://localhost:8200
# Token: root (in dev mode)
```

### Secret Paths

| Path | Contents |
|------|----------|
| `secret/database/postgres` | PostgreSQL superuser credentials |
| `secret/database/keycloak` | Keycloak database credentials |
| `secret/database/temporal` | Temporal database credentials |
| `secret/database/ananta` | Application database credentials |
| `secret/cache/redis` | Redis password |
| `secret/auth/keycloak` | Keycloak admin credentials |
| `secret/control-plane/jwt` | JWT signing secret |

### Using Vault Agent Injection

Add annotations to your deployments:

```yaml
annotations:
  vault.hashicorp.com/agent-inject: "true"
  vault.hashicorp.com/role: "control-plane"
  vault.hashicorp.com/agent-inject-secret-database: "secret/data/database/ananta"
  vault.hashicorp.com/agent-inject-template-database: |
    {{- with secret "secret/data/database/ananta" -}}
    DATABASE_URL=postgresql://{{ .Data.data.username }}:{{ .Data.data.password }}@postgresql.database-system:5432/ananta
    {{- end -}}
```

## Database Migrations

Migrations are automatically run via Kubernetes Jobs when Terraform is applied.

### Migration Files

| File | Purpose |
|------|---------|
| `migrations/001-init-schemas.sql` | Create schemas, extensions, helper functions |
| `migrations/002-tenant-management.sql` | Tenant management tables |
| `migrations/003-seed-data.sql` | Default roles, plans, and demo data |

### Running Migrations Manually

```bash
kubectl exec -it deploy/postgresql -n database-system -- psql -U postgres -d ananta \
  -f /migrations/001-init-schemas.sql
```

## Keycloak Realm

The Keycloak realm is automatically imported from `database/keycloak/realm-ananta-saas.json` (single source of truth).

### Default Users

| Username | Email | Password | Role | Organization |
|----------|-------|----------|------|--------------|
| `superadmin` | superadmin@ananta.dev | `Test1234!` | `super_admin` | Ananta Platform |
| `cns-lead` | cns-lead@ananta.dev | `Test1234!` | `owner` | CNS Staff |
| `cns-engineer` | cns-engineer@ananta.dev | `Test1234!` | `engineer` | CNS Staff |
| `demo-owner` | demo-owner@example.com | `Test1234!` | `owner` | Demo Organization |
| `demo-engineer` | demo-engineer@example.com | `Test1234!` | `engineer` | Demo Organization |
| `cbpadmin` | cbpadmin@ananta.dev | `Test1234!` | `super_admin` | Ananta Platform |
| `cnsstaff` | cnsstaff@ananta.dev | `Test1234!` | `engineer` | CNS Staff |
| `backstage-admin` | backstage-admin@ananta.dev | `Test1234!` | `admin` | Ananta Platform |
| `demo-analyst` | demo-analyst@example.com | `Test1234!` | `analyst` | Demo Organization |

### Clients

| Client ID | Type | Purpose |
|-----------|------|---------|
| `arc-saas-admin` | Public | Admin portal SPA |
| `arc-saas-api` | Bearer-only | Backend API |
| `arc-saas-customer-portal` | Public | Customer portal |

## Troubleshooting

### Check pod status

```bash
kubectl get pods -A | grep -E "vault|database|cache|auth|temporal|control"
```

### View logs

```bash
# Vault
kubectl logs -n vault-system deploy/ananta-vault

# Database
kubectl logs -n database-system deploy/postgresql

# Keycloak
kubectl logs -n auth-system deploy/keycloak

# Control plane services
kubectl logs -n control-plane deploy/tenant-management-service
```

### Reset everything

```bash
# Destroy Terraform resources
terraform destroy -var-file="local.tfvars"

# Or delete namespaces manually
kubectl delete ns vault-system database-system cache-system auth-system temporal-system control-plane
```

## Comparison: Plain YAML vs Terraform

| Aspect | Plain YAML | Terraform |
|--------|------------|-----------|
| Secret Management | Hardcoded | Vault integration |
| Dependencies | Manual ordering | Automatic with `depends_on` |
| State Tracking | None | Terraform state |
| Migrations | Manual | Automated Jobs |
| Reproducibility | Copy/paste | `terraform apply` |
| Multi-environment | Duplicate files | Variables |
| Rollback | Manual | `terraform destroy` + reapply |

## Next Steps

1. **Production deployment**: Use `environments/staging/` or `environments/prod/`
2. **Remote state**: Configure S3/GCS backend for team collaboration
3. **CI/CD**: Integrate with GitHub Actions or GitLab CI
4. **ArgoCD**: Use GitOps for continuous deployment
