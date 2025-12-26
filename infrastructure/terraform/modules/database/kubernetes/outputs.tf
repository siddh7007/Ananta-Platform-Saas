# =============================================================================
# Kubernetes PostgreSQL Module Outputs
# =============================================================================

output "endpoint" {
  description = "Database endpoint (service:port)"
  value       = "${local.cluster_name}-rw.${var.namespace}.svc.cluster.local:5432"
}

output "address" {
  description = "Database hostname (internal service)"
  value       = "${local.cluster_name}-rw.${var.namespace}.svc.cluster.local"
}

output "port" {
  description = "Database port"
  value       = 5432
}

output "database_name" {
  description = "Database name"
  value       = var.database_name
}

output "username" {
  description = "Application username"
  value       = var.app_username
  sensitive   = true
}

output "password" {
  description = "Application password"
  value       = random_password.app_user.result
  sensitive   = true
}

output "connection_string" {
  description = "PostgreSQL connection string"
  value       = "postgresql://${var.app_username}:${random_password.app_user.result}@${local.cluster_name}-rw.${var.namespace}.svc.cluster.local:5432/${var.database_name}?sslmode=require"
  sensitive   = true
}

output "replica_endpoints" {
  description = "Read replica service endpoint"
  value       = var.high_availability ? ["${local.cluster_name}-ro.${var.namespace}.svc.cluster.local:5432"] : []
}

output "pooler_endpoint" {
  description = "Connection pooler endpoint"
  value       = var.create_pooler ? "${local.cluster_name}-pooler.${var.namespace}.svc.cluster.local:5432" : null
}

output "resource_id" {
  description = "Cluster name (Kubernetes resource identifier)"
  value       = local.cluster_name
}

output "resource_arn" {
  description = "Cluster full name (namespace/name)"
  value       = "${var.namespace}/${local.cluster_name}"
}

# Kubernetes-specific outputs

output "cluster_name" {
  description = "CloudNativePG cluster name"
  value       = local.cluster_name
}

output "namespace" {
  description = "Kubernetes namespace"
  value       = var.namespace
}

output "superuser_secret_name" {
  description = "Secret name containing superuser credentials"
  value       = kubernetes_secret.superuser.metadata[0].name
}

output "app_secret_name" {
  description = "Secret name containing application credentials"
  value       = kubernetes_secret.app_user.metadata[0].name
}

output "primary_service" {
  description = "Primary (read-write) service name"
  value       = "${local.cluster_name}-rw"
}

output "replica_service" {
  description = "Replica (read-only) service name"
  value       = var.high_availability ? "${local.cluster_name}-ro" : null
}

output "pooler_service" {
  description = "Connection pooler service name"
  value       = var.create_pooler ? "${local.cluster_name}-pooler" : null
}
