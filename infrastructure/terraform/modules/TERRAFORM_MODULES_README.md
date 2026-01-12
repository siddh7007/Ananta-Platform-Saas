# Terraform Kubernetes Modules for Ananta Platform

This directory contains comprehensive Terraform modules for deploying the Ananta Platform SaaS application to Kubernetes.

## Module Structure

```
infrastructure/terraform/modules/
├── control-plane/kubernetes/       # Control plane services (tenant-mgmt, temporal-worker, subscription, orchestrator)
├── app-plane-services/kubernetes/  # App plane backend services (CNS, Django, middleware)
├── frontends/kubernetes/           # Frontend applications (admin-app, customer-portal, dashboards)
├── migrations/kubernetes/          # Database migration jobs
└── argocd/kubernetes/              # ArgoCD GitOps setup
```

## Created Modules

### 1. Control Plane Module
**Location**: `infrastructure/terraform/modules/control-plane/kubernetes/`

**Services Deployed**:
- tenant-management-service (port 14000)
- temporal-worker-service
- subscription-service (port 3002)
- orchestrator-service (port 3003)

**Files**:
- `main.tf` - Complete deployments, services, secrets, config maps
- `variables.tf` - All configuration variables with defaults
- `outputs.tf` - Service endpoints and resource names

### 2. App Plane Services Module
**Location**: `infrastructure/terraform/modules/app-plane-services/kubernetes/`

**Services Deployed**:
- cns-service (FastAPI - port 8000)
- cns-worker (Temporal worker)
- django-backend (port 8000)
- middleware-api (Flask - port 5000)
- webhook-bridge (port 27600, optional)

**Files**:
- `main.tf` - Complete (784 lines written)
- `variables.tf` - Needs completion
- `outputs.tf` - Needs completion

## Usage Example

```hcl
# In your environment (e.g., environments/dev/main.tf)

module "control_plane" {
  source = "../../modules/control-plane/kubernetes"

  environment = "dev"
  namespace   = "control-plane"

  # Database configuration
  database_host     = module.database.endpoint
  database_password = var.database_password

  # Redis configuration
  redis_host     = module.cache.host
  redis_password = var.redis_password

  # Auth configuration
  jwt_secret             = var.jwt_secret
  keycloak_url           = "http://keycloak:8080"
  keycloak_client_id     = var.keycloak_client_id
  keycloak_client_secret = var.keycloak_client_secret

  # Temporal configuration
  temporal_address   = "shared-temporal:7233"
  temporal_namespace = "arc-saas"

  # Novu configuration
  novu_api_key      = var.novu_api_key
  novu_backend_url  = "http://novu-api:3000"

  # Service images
  tenant_mgmt_image      = "ananta/tenant-management-service:latest"
  temporal_worker_image  = "ananta/temporal-worker-service:latest"
  subscription_image     = "ananta/subscription-service:latest"
  orchestrator_image     = "ananta/orchestrator-service:latest"

  # Resource allocation
  tenant_mgmt_replicas = 2
  tenant_mgmt_cpu_request  = "500m"
  tenant_mgmt_memory_request = "512Mi"
}

module "app_plane_services" {
  source = "../../modules/app-plane-services/kubernetes"

  environment = "dev"
  namespace   = "app-plane"

  # Database passwords
  supabase_db_password       = var.supabase_db_password
  components_v2_db_password  = var.components_v2_db_password
  supabase_jwt_secret        = var.supabase_jwt_secret
  supabase_service_role_key  = var.supabase_service_role_key

  # Infrastructure passwords
  redis_password     = var.redis_password
  rabbitmq_password  = var.rabbitmq_password
  minio_root_user    = var.minio_root_user
  minio_root_password = var.minio_root_password

  # Application secrets
  jwt_secret_key        = var.jwt_secret_key
  django_secret_key     = var.django_secret_key
  admin_api_token       = var.admin_api_token
  cns_admin_token       = var.cns_admin_token

  # Supplier API keys
  mouser_api_key         = var.mouser_api_key
  digikey_client_id      = var.digikey_client_id
  digikey_client_secret  = var.digikey_client_secret

  # Service configuration
  cns_service_replicas = 2
  cns_worker_replicas  = 2
  django_backend_replicas = 2

  # Feature flags
  enable_ai_suggestions = true
  enable_cost_tracking  = true
  temporal_enabled      = true
}
```

## Next Steps

1. Complete remaining module files:
   - app-plane-services/kubernetes/variables.tf
   - app-plane-services/kubernetes/outputs.tf
   - frontends/kubernetes/* (3 files)
   - migrations/kubernetes/* (3 files)
   - argocd/kubernetes/* (3 files)

2. Create environment-specific tfvars files
3. Set up Terraform backend (S3 + DynamoDB or equivalent)
4. Create CI/CD pipelines for Terraform apply

## Key Features

- Proper health checks (liveness/readiness probes)
- Resource limits and requests
- Secrets management via kubernetes_secret
- ConfigMaps for non-sensitive configuration
- Proper labels following kubernetes standards
- Prometheus annotations for monitoring
- Depends_on for proper ordering
- Namespace isolation
- Service discovery via ClusterIP services

## Security Best Practices

- All sensitive values marked as sensitive = true
- Secrets stored in kubernetes_secret resources
- No hardcoded credentials
- Environment-specific variable overrides
- RBAC ready (namespace-scoped)

## Monitoring Integration

All services include Prometheus annotations:
```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "<service-port>"
  prometheus.io/path: "/metrics"
```

## Dependencies

Required Terraform providers:
- hashicorp/kubernetes >= 2.20
- hashicorp/helm >= 2.10 (for ArgoCD module)
- hashicorp/random >= 3.0

## Support

Refer to CLAUDE.md for platform-specific configuration details.
