# =============================================================================
# Cloud-Agnostic Compute Module Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Common Interface Outputs
# -----------------------------------------------------------------------------

output "service_endpoints" {
  description = "Map of service names to their endpoints"
  value = coalesce(
    try(module.kubernetes[0].service_endpoints, null),
    # try(module.ecs[0].service_endpoints, null),
    # try(module.azure_container_apps[0].service_endpoints, null),
    # try(module.gcp_cloud_run[0].service_endpoints, null),
    {}
  )
}

output "deployment_names" {
  description = "Map of service keys to deployment/service names"
  value = coalesce(
    try(module.kubernetes[0].deployment_names, null),
    # try(module.ecs[0].service_names, null),
    # try(module.azure_container_apps[0].container_app_names, null),
    # try(module.gcp_cloud_run[0].service_names, null),
    {}
  )
}

output "resource_ids" {
  description = "Map of all resource identifiers"
  value = coalesce(
    try(module.kubernetes[0].resource_ids, null),
    # try(module.ecs[0].resource_ids, null),
    # try(module.azure_container_apps[0].resource_ids, null),
    # try(module.gcp_cloud_run[0].resource_ids, null),
    {}
  )
}

output "service_urls" {
  description = "Map of service internal URLs"
  value = coalesce(
    try(module.kubernetes[0].service_urls, null),
    # try(module.ecs[0].service_urls, null),
    # try(module.azure_container_apps[0].service_urls, null),
    # try(module.gcp_cloud_run[0].service_urls, null),
    {}
  )
}

output "external_urls" {
  description = "Map of external URLs (ingress/load balancer)"
  value = coalesce(
    try(module.kubernetes[0].external_urls, null),
    # try(module.ecs[0].external_urls, null),
    # try(module.azure_container_apps[0].external_urls, null),
    # try(module.gcp_cloud_run[0].external_urls, null),
    {}
  )
}

output "cloud_provider" {
  description = "The cloud provider being used"
  value       = local.effective_provider
}

# -----------------------------------------------------------------------------
# Kubernetes-Specific Outputs
# -----------------------------------------------------------------------------

output "kubernetes_namespace" {
  description = "Kubernetes namespace (K8s only)"
  value       = try(module.kubernetes[0].namespace, "")
}

output "kubernetes_deployments" {
  description = "Map of deployment details (K8s only)"
  value       = try(module.kubernetes[0].deployments, {})
}

output "kubernetes_services" {
  description = "Map of service details (K8s only)"
  value       = try(module.kubernetes[0].services, {})
}

output "kubernetes_ingress_endpoints" {
  description = "Map of ingress details (K8s only)"
  value       = try(module.kubernetes[0].ingress_endpoints, {})
}

output "kubernetes_hpa_status" {
  description = "Map of HPA status (K8s only)"
  value       = try(module.kubernetes[0].hpa_status, {})
}

output "kubernetes_service_account_name" {
  description = "Service account name (K8s only)"
  value       = try(module.kubernetes[0].service_account_name, "")
}

output "kubernetes_configmap_name" {
  description = "ConfigMap name (K8s only)"
  value       = try(module.kubernetes[0].configmap_name, "")
}

output "kubernetes_service_monitors" {
  description = "Map of ServiceMonitor details (K8s only, Prometheus Operator)"
  value       = try(module.kubernetes[0].service_monitors, {})
}

# -----------------------------------------------------------------------------
# AWS ECS-Specific Outputs (Placeholder)
# -----------------------------------------------------------------------------

# output "ecs_cluster_name" {
#   description = "ECS cluster name (AWS only)"
#   value       = try(module.ecs[0].cluster_name, "")
# }

# output "ecs_service_arns" {
#   description = "Map of ECS service ARNs (AWS only)"
#   value       = try(module.ecs[0].service_arns, {})
# }

# output "ecs_task_definition_arns" {
#   description = "Map of task definition ARNs (AWS only)"
#   value       = try(module.ecs[0].task_definition_arns, {})
# }

# output "ecs_load_balancer_dns" {
#   description = "ALB DNS name (AWS only)"
#   value       = try(module.ecs[0].load_balancer_dns, "")
# }

# -----------------------------------------------------------------------------
# Azure Container Apps-Specific Outputs (Placeholder)
# -----------------------------------------------------------------------------

# output "azure_container_app_ids" {
#   description = "Map of Container App IDs (Azure only)"
#   value       = try(module.azure_container_apps[0].container_app_ids, {})
# }

# output "azure_container_app_fqdns" {
#   description = "Map of Container App FQDNs (Azure only)"
#   value       = try(module.azure_container_apps[0].container_app_fqdns, {})
# }

# -----------------------------------------------------------------------------
# GCP Cloud Run-Specific Outputs (Placeholder)
# -----------------------------------------------------------------------------

# output "gcp_cloud_run_urls" {
#   description = "Map of Cloud Run service URLs (GCP only)"
#   value       = try(module.gcp_cloud_run[0].service_urls, {})
# }

# output "gcp_cloud_run_locations" {
#   description = "Map of Cloud Run service locations (GCP only)"
#   value       = try(module.gcp_cloud_run[0].service_locations, {})
# }

# -----------------------------------------------------------------------------
# Connection Information
# -----------------------------------------------------------------------------

output "connection_info" {
  description = "Connection information for all services"
  value = coalesce(
    try(module.kubernetes[0].connection_info, null),
    # try(module.ecs[0].connection_info, null),
    # try(module.azure_container_apps[0].connection_info, null),
    # try(module.gcp_cloud_run[0].connection_info, null),
    {}
  )
}

# -----------------------------------------------------------------------------
# Summary Output
# -----------------------------------------------------------------------------

output "summary" {
  description = "Summary of deployed resources"
  value = coalesce(
    try(module.kubernetes[0].summary, null),
    # try(module.ecs[0].summary, null),
    # try(module.azure_container_apps[0].summary, null),
    # try(module.gcp_cloud_run[0].summary, null),
    {
      provider = local.effective_provider
      message  = "No resources deployed"
    }
  )
}
