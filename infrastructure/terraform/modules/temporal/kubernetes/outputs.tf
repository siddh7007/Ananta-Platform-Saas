# =============================================================================
# Temporal Kubernetes Module Outputs
# =============================================================================

output "service_name" {
  description = "Temporal service name"
  value       = kubernetes_service.temporal.metadata[0].name
}

output "grpc_address" {
  description = "Temporal gRPC address (cluster-internal)"
  value       = "${kubernetes_service.temporal.metadata[0].name}.${var.namespace}.svc.cluster.local:7233"
}

output "grpc_port" {
  description = "Temporal gRPC port"
  value       = 7233
}

output "ui_service_name" {
  description = "Temporal UI service name"
  value       = var.enable_ui ? kubernetes_service.temporal_ui[0].metadata[0].name : null
}

output "ui_url" {
  description = "Temporal UI URL (for port-forwarding)"
  value       = var.enable_ui ? "http://localhost:27021" : null
}

output "internal_ui_url" {
  description = "Temporal UI internal URL"
  value       = var.enable_ui ? "http://${kubernetes_service.temporal_ui[0].metadata[0].name}.${var.namespace}.svc.cluster.local:${var.ui_port}" : null
}

output "namespace" {
  description = "Kubernetes namespace"
  value       = var.namespace
}

output "temporal_namespaces" {
  description = "Created Temporal namespaces"
  value       = var.create_namespaces
}

output "db_secret_name" {
  description = "Secret name containing Temporal database credentials"
  value       = kubernetes_secret.temporal.metadata[0].name
}
