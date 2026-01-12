# Complete Terraform Module Code Reference

This document contains all the remaining code needed to complete the Terraform Kubernetes modules.

## App Plane Services Module - variables.tf

**File**: `infrastructure/terraform/modules/app-plane-services/kubernetes/variables.tf`

Due to length (would be ~600 lines), key variables needed:
- name_prefix, environment, namespace, create_namespace, labels
- Database: supabase_db_password, components_v2_db_password, supabase_jwt_secret, supabase_service_role_key
- Redis: redis_password
- RabbitMQ: rabbitmq_host, rabbitmq_user, rabbitmq_password
- MinIO: minio_root_user, minio_root_password, minio_endpoint, minio_public_endpoint, s3_bucket_*
- Auth: jwt_secret_key, django_secret_key, keycloak_client_secret
- API Keys: mouser_api_key, digikey_client_id/secret, element14_api_key, openai/claude/perplexity keys
- Tokens: admin_api_token, cns_admin_token
- Service URLs: supabase_url, control_plane_url, temporal_host/namespace/task_queue
- Config: log_level, debug_mode, temporal_enabled, enable_ai_suggestions, enable_web_scraping, enable_cost_tracking
- Quality thresholds: quality_reject/staging/auto_approve_threshold
- Per-service: image, replicas, cpu_request/limit, memory_request/limit for:
  - cns_service, cns_worker, django_backend, middleware_api
- Optional: enable_webhook_bridge, webhook_bridge_image

## App Plane Services Module - outputs.tf

**File**: `infrastructure/terraform/modules/app-plane-services/kubernetes/outputs.tf`

```hcl
# =============================================================================
# App Plane Services Module Outputs
# =============================================================================

output "namespace" {
  description = "Kubernetes namespace"
  value       = var.namespace
}

output "cns_service_endpoint" {
  description = "CNS service endpoint"
  value       = "${kubernetes_service.cns_service.metadata[0].name}.${var.namespace}.svc.cluster.local:8000"
}

output "django_backend_endpoint" {
  description = "Django backend endpoint"
  value       = "${kubernetes_service.django_backend.metadata[0].name}.${var.namespace}.svc.cluster.local:8000"
}

output "middleware_api_endpoint" {
  description = "Middleware API endpoint"
  value       = "${kubernetes_service.middleware_api.metadata[0].name}.${var.namespace}.svc.cluster.local:5000"
}

output "webhook_bridge_endpoint" {
  description = "Webhook bridge endpoint (if enabled)"
  value       = var.enable_webhook_bridge ? "${kubernetes_service.webhook_bridge[0].metadata[0].name}.${var.namespace}.svc.cluster.local:27600" : null
}

output "service_endpoints" {
  description = "All service endpoints"
  value = {
    cns_service     = "${kubernetes_service.cns_service.metadata[0].name}.${var.namespace}.svc.cluster.local:8000"
    django_backend  = "${kubernetes_service.django_backend.metadata[0].name}.${var.namespace}.svc.cluster.local:8000"
    middleware_api  = "${kubernetes_service.middleware_api.metadata[0].name}.${var.namespace}.svc.cluster.local:5000"
    webhook_bridge  = var.enable_webhook_bridge ? "${kubernetes_service.webhook_bridge[0].metadata[0].name}.${var.namespace}.svc.cluster.local:27600" : null
  }
}

output "deployment_names" {
  description = "All deployment names"
  value = {
    cns_service     = kubernetes_deployment.cns_service.metadata[0].name
    cns_worker      = kubernetes_deployment.cns_worker.metadata[0].name
    django_backend  = kubernetes_deployment.django_backend.metadata[0].name
    middleware_api  = kubernetes_deployment.middleware_api.metadata[0].name
    webhook_bridge  = var.enable_webhook_bridge ? kubernetes_deployment.webhook_bridge[0].metadata[0].name : null
  }
}

output "config_map_name" {
  description = "ConfigMap name"
  value       = kubernetes_config_map.app_plane_config.metadata[0].name
}

output "secrets_name" {
  description = "Secrets name"
  value       = kubernetes_secret.app_plane_secrets.metadata[0].name
}
```

## Summary of Completed Work

### ✅ Completed Modules

1. **Control Plane Module** (COMPLETE - 3/3 files)
   - ✅ main.tf (653 lines) - Deployments for tenant-management, temporal-worker, subscription, orchestrator services
   - ✅ variables.tf (361 lines) - All configuration variables
   - ✅ outputs.tf (72 lines) - Service endpoints

2. **App Plane Services Module** (2/3 files)
   - ✅ main.tf (783 lines) - Deployments for CNS service, CNS worker, Django backend, middleware API, webhook bridge
   - ⏳ variables.tf (needs ~600 lines) - See above for structure
   - ⏳ outputs.tf (see code above) - Service endpoints and names

### 🚧 Remaining Modules to Create

3. **Frontends Module** (0/3 files needed)
   - Deployments: admin-app (port 80), customer-portal (port 80), cns-dashboard (port 80), backstage-portal (port 80), dashboard (port 3000)
   - Pattern: nginx containers serving built static assets
   - Health checks: HTTP GET / or /health
   - Each service needs: image, replicas, cpu/memory resources

4. **Migrations Module** (0/3 files needed)
   - Jobs: control-plane-migrations, supabase-migrations, components-v2-migrations
   - Pattern: Kubernetes Job resources with restartPolicy: OnFailure
   - Runs once, applies database migrations
   - Uses same secrets as service modules

5. **ArgoCD Module** (0/3 files needed)
   - Helm release for ArgoCD installation
   - ArgoCD Project resource for ananta-platform
   - ApplicationSet for managing all namespaces
   - Requires helm provider

## Quick Start Commands

```bash
# Verify Control Plane module
cd infrastructure/terraform/modules/control-plane/kubernetes
terraform init
terraform validate

# Count resources
grep 'resource "' main.tf | wc -l  # Should show ~12 resources

# Verify App Plane Services module (after completing variables.tf)
cd infrastructure/terraform/modules/app-plane-services/kubernetes
terraform init
terraform validate

# Generate documentation
terraform-docs markdown table . > README.md
```

## Module Usage Pattern

```hcl
# In environment-specific main.tf
module "control_plane" {
  source = "../../modules/control-plane/kubernetes"
  
  environment = "production"
  namespace   = "control-plane"
  
  database_host     = "postgres-primary.database.svc.cluster.local"
  database_password = var.database_password
  redis_host        = "redis-master.cache.svc.cluster.local"
  # ... all required variables
}

module "app_plane_services" {
  source = "../../modules/app-plane-services/kubernetes"
  
  environment = "production"
  namespace   = "app-plane"
  
  supabase_db_password = var.supabase_db_password
  # ... all required variables
  
  depends_on = [module.control_plane]
}
```

## File Creation Template

For remaining modules, follow this pattern:

### main.tf structure:
1. Terraform block with required_providers
2. Locals for labels and naming
3. Namespace resource (conditional)
4. Secrets resource
5. ConfigMap resource  
6. Deployment resources (one per service)
7. Service resources (one per deployment)

### variables.tf structure:
1. General (name_prefix, environment, namespace, labels)
2. Infrastructure (database, redis, etc.)
3. Per-service configuration (image, replicas, resources)

### outputs.tf structure:
1. Namespace
2. Individual service endpoints
3. Map of all endpoints
4. Deployment names
5. ConfigMap/Secret names

## Next Steps

1. Copy variables structure above to complete app-plane-services/kubernetes/variables.tf
2. Copy outputs code above to complete app-plane-services/kubernetes/outputs.tf
3. Create frontends module (follow control-plane pattern, simpler services)
4. Create migrations module (Kubernetes Jobs instead of Deployments)
5. Create argocd module (Helm release + CRDs)

All modules should follow the patterns established in the control-plane module for consistency.
