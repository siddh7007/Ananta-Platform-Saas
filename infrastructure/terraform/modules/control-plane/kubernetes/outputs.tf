# =============================================================================
# Control Plane Kubernetes Module Outputs
# =============================================================================

output "namespace" {
  description = "Kubernetes namespace"
  value       = var.namespace
}

output "tenant_management_service_name" {
  description = "Tenant management service name"
  value       = kubernetes_service.tenant_management.metadata[0].name
}

output "tenant_management_endpoint" {
  description = "Tenant management service endpoint"
  value       = "${kubernetes_service.tenant_management.metadata[0].name}.${var.namespace}.svc.cluster.local:14000"
}

output "subscription_service_name" {
  description = "Subscription service name"
  value       = kubernetes_service.subscription.metadata[0].name
}

output "subscription_endpoint" {
  description = "Subscription service endpoint"
  value       = "${kubernetes_service.subscription.metadata[0].name}.${var.namespace}.svc.cluster.local:3002"
}

output "orchestrator_service_name" {
  description = "Orchestrator service name"
  value       = kubernetes_service.orchestrator.metadata[0].name
}

output "orchestrator_endpoint" {
  description = "Orchestrator service endpoint"
  value       = "${kubernetes_service.orchestrator.metadata[0].name}.${var.namespace}.svc.cluster.local:3003"
}

output "temporal_worker_deployment_name" {
  description = "Temporal worker deployment name"
  value       = kubernetes_deployment.temporal_worker.metadata[0].name
}

output "config_map_name" {
  description = "ConfigMap name"
  value       = kubernetes_config_map.control_plane_config.metadata[0].name
}

output "secrets_name" {
  description = "Secrets name"
  value       = kubernetes_secret.control_plane_secrets.metadata[0].name
}

output "service_endpoints" {
  description = "All service endpoints"
  value = {
    tenant_management = "${kubernetes_service.tenant_management.metadata[0].name}.${var.namespace}.svc.cluster.local:14000"
    subscription      = "${kubernetes_service.subscription.metadata[0].name}.${var.namespace}.svc.cluster.local:3002"
    orchestrator      = "${kubernetes_service.orchestrator.metadata[0].name}.${var.namespace}.svc.cluster.local:3003"
  }
}

output "deployment_names" {
  description = "All deployment names"
  value = {
    tenant_management = kubernetes_deployment.tenant_management.metadata[0].name
    temporal_worker   = kubernetes_deployment.temporal_worker.metadata[0].name
    subscription      = kubernetes_deployment.subscription.metadata[0].name
    orchestrator      = kubernetes_deployment.orchestrator.metadata[0].name
  }
}
