# =============================================================================
# Terraform Outputs - Ananta Platform
# =============================================================================
# Cloud-agnostic outputs from the infrastructure deployment
# Supports AWS, Azure, GCP, and Kubernetes providers
# =============================================================================

# -----------------------------------------------------------------------------
# Provider Information
# -----------------------------------------------------------------------------

output "cloud_provider" {
  description = "The cloud provider used for this deployment"
  value       = var.cloud_provider
}

output "environment" {
  description = "The deployment environment"
  value       = var.environment
}

# -----------------------------------------------------------------------------
# Network Outputs (AWS-only)
# -----------------------------------------------------------------------------

output "vpc_id" {
  description = "The ID of the VPC (AWS only)"
  value       = local.is_aws ? module.network[0].vpc_id : null
}

output "vpc_cidr" {
  description = "The CIDR block of the VPC (AWS only)"
  value       = local.is_aws ? module.network[0].vpc_cidr : null
}

output "public_subnet_ids" {
  description = "List of public subnet IDs (AWS only)"
  value       = local.is_aws ? module.network[0].public_subnet_ids : []
}

output "private_subnet_ids" {
  description = "List of private subnet IDs (AWS only)"
  value       = local.is_aws ? module.network[0].private_subnet_ids : []
}

output "database_subnet_ids" {
  description = "List of database subnet IDs (AWS only)"
  value       = local.is_aws ? module.network[0].database_subnet_ids : []
}

output "nat_gateway_ips" {
  description = "List of NAT Gateway public IPs (AWS only)"
  value       = local.is_aws ? module.network[0].nat_gateway_ips : []
}

# -----------------------------------------------------------------------------
# Database Outputs (Cloud-Agnostic)
# -----------------------------------------------------------------------------

output "control_plane_db_endpoint" {
  description = "Control plane database endpoint"
  value       = module.control_plane_database.endpoint
  sensitive   = true
}

output "control_plane_db_port" {
  description = "Control plane database port"
  value       = module.control_plane_database.port
}

output "control_plane_db_connection_string" {
  description = "Control plane database connection string"
  value       = module.control_plane_database.connection_string
  sensitive   = true
}

output "app_plane_db_endpoint" {
  description = "App plane database endpoint"
  value       = module.app_plane_database.endpoint
  sensitive   = true
}

output "app_plane_db_port" {
  description = "App plane database port"
  value       = module.app_plane_database.port
}

output "app_plane_db_connection_string" {
  description = "App plane database connection string"
  value       = module.app_plane_database.connection_string
  sensitive   = true
}

output "components_db_endpoint" {
  description = "Components-V2 database endpoint"
  value       = module.components_database.endpoint
  sensitive   = true
}

output "components_db_port" {
  description = "Components-V2 database port"
  value       = module.components_database.port
}

output "components_db_connection_string" {
  description = "Components-V2 database connection string"
  value       = module.components_database.connection_string
  sensitive   = true
}

# Database Resource IDs (for reference)
output "database_resource_ids" {
  description = "Map of database resource identifiers (provider-specific format)"
  value = {
    control_plane = module.control_plane_database.resource_id
    app_plane     = module.app_plane_database.resource_id
    components    = module.components_database.resource_id
  }
}

# -----------------------------------------------------------------------------
# Cache (Redis) Outputs (Cloud-Agnostic)
# -----------------------------------------------------------------------------

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.cache.endpoint
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = module.cache.port
}

output "redis_connection_string" {
  description = "Redis connection string"
  value       = module.cache.connection_string
  sensitive   = true
}

output "redis_resource_id" {
  description = "Redis resource identifier (provider-specific format)"
  value       = module.cache.resource_id
}

# -----------------------------------------------------------------------------
# Secrets Outputs (Cloud-Agnostic)
# -----------------------------------------------------------------------------

output "secret_arns" {
  description = "Map of secret names to their ARNs/IDs"
  value       = module.secrets.secret_arns
  sensitive   = true
}

output "secret_names" {
  description = "Map of secret names to their full names/paths"
  value       = module.secrets.secret_names
}

# Backward-compatible secret ARN outputs
output "control_plane_db_secret_arn" {
  description = "ARN/ID of the control plane database credentials secret"
  value       = local.control_plane_db_secret_arn
  sensitive   = true
}

output "app_plane_db_secret_arn" {
  description = "ARN/ID of the app plane database credentials secret"
  value       = local.app_plane_db_secret_arn
  sensitive   = true
}

output "components_db_secret_arn" {
  description = "ARN/ID of the components database credentials secret"
  value       = local.components_db_secret_arn
  sensitive   = true
}

# -----------------------------------------------------------------------------
# ECS Outputs (AWS-only)
# -----------------------------------------------------------------------------

output "ecs_cluster_id" {
  description = "ECS cluster ID (AWS only)"
  value       = local.is_aws ? module.ecs[0].cluster_id : null
}

output "ecs_cluster_name" {
  description = "ECS cluster name (AWS only)"
  value       = local.is_aws ? module.ecs[0].cluster_name : null
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN (AWS only)"
  value       = local.is_aws ? module.ecs[0].cluster_arn : null
}

output "tenant_mgmt_service_name" {
  description = "Tenant management service name"
  value       = local.is_aws ? module.ecs[0].tenant_mgmt_service_name : (local.is_kubernetes ? "tenant-management-service" : null)
}

output "cns_service_name" {
  description = "CNS service name"
  value       = local.is_aws ? module.ecs[0].cns_service_name : (local.is_kubernetes ? "cns-service" : null)
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS name (AWS only)"
  value       = local.is_aws ? module.ecs[0].alb_dns_name : null
}

output "alb_zone_id" {
  description = "Application Load Balancer zone ID (AWS only)"
  value       = local.is_aws ? module.ecs[0].alb_zone_id : null
}

# -----------------------------------------------------------------------------
# Kubernetes Compute Outputs
# -----------------------------------------------------------------------------

output "kubernetes_namespace" {
  description = "Kubernetes namespace where resources are deployed"
  value       = local.is_kubernetes ? module.compute[0].kubernetes_namespace : null
}

output "kubernetes_deployments" {
  description = "Map of Kubernetes deployment names"
  value       = local.is_kubernetes ? module.compute[0].deployment_names : {}
}

output "kubernetes_services" {
  description = "Map of Kubernetes service details"
  value       = local.is_kubernetes ? module.compute[0].kubernetes_services : {}
}

output "kubernetes_service_urls" {
  description = "Map of Kubernetes service internal URLs"
  value       = local.is_kubernetes ? module.compute[0].service_urls : {}
}

output "kubernetes_ingress_endpoints" {
  description = "Map of Kubernetes ingress endpoints"
  value       = local.is_kubernetes ? module.compute[0].kubernetes_ingress_endpoints : {}
}

output "kubernetes_external_urls" {
  description = "Map of external URLs from ingress"
  value       = local.is_kubernetes ? module.compute[0].external_urls : {}
}

# -----------------------------------------------------------------------------
# Service Discovery Outputs (AWS-only)
# -----------------------------------------------------------------------------

output "service_discovery_namespace_id" {
  description = "Cloud Map namespace ID for service discovery (AWS only)"
  value       = local.is_aws ? module.service_discovery[0].namespace_id : null
}

output "service_discovery_namespace_name" {
  description = "Cloud Map namespace DNS name (AWS only)"
  value       = local.is_aws ? module.service_discovery[0].namespace_name : null
}

output "service_discovery_endpoints" {
  description = "Service discovery DNS endpoints for inter-service communication"
  value       = local.is_aws ? module.service_discovery[0].service_discovery_endpoints : {}
}

# -----------------------------------------------------------------------------
# Keycloak Outputs
# -----------------------------------------------------------------------------

output "keycloak_url" {
  description = "Keycloak URL"
  value = local.is_aws ? module.keycloak[0].keycloak_url : (
    local.is_kubernetes ? try(module.compute[0].external_urls["keycloak"], "http://keycloak.${var.kubernetes_namespace}.svc.cluster.local:8080") : null
  )
}

output "keycloak_admin_console_url" {
  description = "Keycloak admin console URL"
  value       = local.is_aws ? module.keycloak[0].admin_console_url : null
}

output "keycloak_admin_credentials_secret_arn" {
  description = "ARN of Keycloak admin credentials secret (AWS only)"
  value       = local.is_aws ? module.keycloak[0].admin_credentials_secret_arn : null
}

# -----------------------------------------------------------------------------
# Temporal Outputs
# -----------------------------------------------------------------------------

output "temporal_address" {
  description = "Temporal server gRPC address"
  value = local.is_aws ? module.temporal[0].temporal_address : (
    local.is_kubernetes ? "temporal.${var.kubernetes_namespace}.svc.cluster.local:7233" : null
  )
}

output "temporal_ui_url" {
  description = "Temporal UI URL"
  value = local.is_aws ? module.temporal[0].temporal_ui_url : (
    local.is_kubernetes ? try(module.compute[0].external_urls["temporal-ui"], "http://temporal-ui.${var.kubernetes_namespace}.svc.cluster.local:8080") : null
  )
}

output "temporal_namespace" {
  description = "Temporal namespace"
  value       = var.temporal_namespace
}

output "temporal_task_queue" {
  description = "Default Temporal task queue"
  value       = "tenant-provisioning"
}

# -----------------------------------------------------------------------------
# App Plane Outputs (AWS-only)
# -----------------------------------------------------------------------------

output "rabbitmq_endpoint" {
  description = "RabbitMQ broker endpoint (AWS only)"
  value       = local.is_aws ? module.app_plane[0].rabbitmq_endpoint : null
  sensitive   = true
}

output "rabbitmq_console_url" {
  description = "RabbitMQ management console URL (AWS only)"
  value       = local.is_aws ? module.app_plane[0].rabbitmq_console_url : null
}

output "s3_bom_bucket_name" {
  description = "Object storage bucket name for BOM storage"
  value       = local.is_aws ? module.app_plane[0].s3_bom_bucket_name : null
}

output "s3_assets_bucket_name" {
  description = "Object storage bucket name for assets"
  value       = local.is_aws ? module.app_plane[0].s3_assets_bucket_name : null
}

# -----------------------------------------------------------------------------
# Connection Information (Cloud-Agnostic)
# -----------------------------------------------------------------------------

output "connection_info" {
  description = "Connection information for services"
  value = {
    cloud_provider = var.cloud_provider
    environment    = var.environment

    # Database endpoints
    databases = {
      control_plane = {
        endpoint = module.control_plane_database.endpoint
        port     = module.control_plane_database.port
      }
      app_plane = {
        endpoint = module.app_plane_database.endpoint
        port     = module.app_plane_database.port
      }
      components = {
        endpoint = module.components_database.endpoint
        port     = module.components_database.port
      }
    }

    # Cache endpoint
    redis = {
      endpoint = module.cache.endpoint
      port     = module.cache.port
    }

    # Service URLs (provider-specific)
    services = local.is_aws ? {
      control_plane_api = "https://${module.ecs[0].alb_dns_name}/api"
      cns_service_api   = "https://${module.ecs[0].alb_dns_name}/cns"
      keycloak          = module.keycloak[0].keycloak_url
      temporal          = module.temporal[0].temporal_address
    } : (local.is_kubernetes ? {
      control_plane_api = try(module.compute[0].external_urls["tenant-management-service"], "")
      cns_service_api   = try(module.compute[0].external_urls["cns-service"], "")
      keycloak          = try(module.compute[0].external_urls["keycloak"], "")
      temporal          = "temporal.${var.kubernetes_namespace}.svc.cluster.local:7233"
    } : {})
  }
}

# -----------------------------------------------------------------------------
# Monitoring Endpoints
# -----------------------------------------------------------------------------

output "cloudwatch_log_groups" {
  description = "CloudWatch log group names (AWS only)"
  value       = local.is_aws ? module.ecs[0].log_group_names : []
}

output "prometheus_workspace_id" {
  description = "Amazon Managed Prometheus workspace ID (AWS only)"
  value       = local.is_aws && var.enable_prometheus ? module.ecs[0].prometheus_workspace_id : null
}

# -----------------------------------------------------------------------------
# Summary Output
# -----------------------------------------------------------------------------

output "deployment_summary" {
  description = "Summary of the deployment"
  value = {
    cloud_provider = var.cloud_provider
    environment    = var.environment
    project_name   = var.project_name

    # What was deployed
    infrastructure = {
      databases_count = 3
      cache_enabled   = true
      secrets_enabled = true
    }

    # Provider-specific details
    aws = local.is_aws ? {
      region       = var.aws_region
      vpc_id       = module.network[0].vpc_id
      ecs_cluster  = module.ecs[0].cluster_name
      alb_endpoint = module.ecs[0].alb_dns_name
    } : null

    kubernetes = local.is_kubernetes ? {
      namespace         = var.kubernetes_namespace
      ingress_class     = var.kubernetes_ingress_class
      deployments_count = length(try(module.compute[0].deployment_names, {}))
      services_count    = length(try(module.compute[0].services, {}))
    } : null

    azure = local.is_azure ? {
      location            = var.azure_location
      resource_group_name = var.azure_resource_group_name
    } : null

    gcp = local.is_gcp ? {
      project_id = var.gcp_project_id
      region     = var.gcp_region
    } : null
  }
}
