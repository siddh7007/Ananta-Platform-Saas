# =============================================================================
# Kubernetes PostgreSQL Helm Module Outputs
# =============================================================================

output "host" {
  description = "PostgreSQL service hostname"
  value       = "${local.release_name}-postgresql"
}

output "port" {
  description = "PostgreSQL service port"
  value       = 5432
}

output "database" {
  description = "Default database name"
  value       = var.database_name
}

output "app_username" {
  description = "Application username"
  value       = var.app_username
}

output "superuser_secret_name" {
  description = "Name of the secret containing superuser credentials"
  value       = kubernetes_secret.connection.metadata[0].name
}

output "app_secret_name" {
  description = "Name of the secret containing app user credentials"
  value       = kubernetes_secret.connection.metadata[0].name
}

output "connection_string" {
  description = "PostgreSQL connection string (superuser)"
  value       = "postgresql://postgres@${local.release_name}-postgresql:5432/${var.database_name}"
  sensitive   = true
}

output "app_connection_string" {
  description = "PostgreSQL connection string (app user)"
  value       = var.app_username != "" ? "postgresql://${var.app_username}@${local.release_name}-postgresql:5432/${var.database_name}" : ""
  sensitive   = true
}

output "read_replica_host" {
  description = "PostgreSQL read replica hostname (if HA enabled)"
  value       = var.high_availability ? "${local.release_name}-postgresql-read" : ""
}

output "helm_release_name" {
  description = "Helm release name"
  value       = local.release_name
}
