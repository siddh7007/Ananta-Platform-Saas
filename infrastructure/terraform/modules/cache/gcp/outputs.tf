# =============================================================================
# GCP Cache Module Outputs
# =============================================================================

output "endpoint" {
  description = "Primary endpoint for Redis"
  value       = google_redis_instance.main.host
}

output "reader_endpoint" {
  description = "Reader endpoint for Redis (read replicas)"
  value       = google_redis_instance.main.read_endpoint
}

output "port" {
  description = "Redis port"
  value       = google_redis_instance.main.port
}

output "connection_string" {
  description = "Redis connection string"
  value       = var.auth_enabled ? "redis://:${google_redis_instance.main.auth_string}@${google_redis_instance.main.host}:${google_redis_instance.main.port}" : "redis://${google_redis_instance.main.host}:${google_redis_instance.main.port}"
  sensitive   = true
}

output "resource_id" {
  description = "Memorystore instance ID"
  value       = google_redis_instance.main.id
}

output "resource_arn" {
  description = "Memorystore instance full name (GCP resource path)"
  value       = google_redis_instance.main.id
}

# GCP-specific outputs

output "instance_name" {
  description = "Memorystore instance name"
  value       = google_redis_instance.main.name
}

output "project" {
  description = "GCP project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP region"
  value       = var.region
}

output "current_location_id" {
  description = "Current location ID"
  value       = google_redis_instance.main.current_location_id
}

output "auth_string" {
  description = "Redis AUTH string"
  value       = var.auth_enabled ? google_redis_instance.main.auth_string : null
  sensitive   = true
}

output "auth_secret_name" {
  description = "Secret Manager secret name for auth string"
  value       = var.auth_enabled && var.create_secret ? google_secret_manager_secret.auth_string[0].name : null
}

output "tier" {
  description = "Memorystore tier"
  value       = local.tier
}

output "memory_size_gb" {
  description = "Memory size in GB"
  value       = local.memory_size_gb
}

output "redis_version" {
  description = "Redis version"
  value       = google_redis_instance.main.redis_version
}

output "persistence_mode" {
  description = "Persistence mode (RDB or disabled)"
  value       = var.enable_persistence ? "RDB" : "DISABLED"
}

output "nodes" {
  description = "Instance nodes information"
  value       = google_redis_instance.main.nodes
}

output "server_ca_certs" {
  description = "Server CA certificates for TLS"
  value       = google_redis_instance.main.server_ca_certs
  sensitive   = true
}
