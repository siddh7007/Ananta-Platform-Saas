# =============================================================================
# Kubernetes Cache Module Outputs
# =============================================================================

output "endpoint" {
  description = "Redis endpoint (service:port)"
  value       = var.high_availability ? "${local.cluster_name}-redis.${var.namespace}.svc.cluster.local:6379" : "${local.cluster_name}.${var.namespace}.svc.cluster.local:6379"
}

output "reader_endpoint" {
  description = "Redis reader endpoint (same as primary for K8s)"
  value       = var.high_availability ? "${local.cluster_name}-redis.${var.namespace}.svc.cluster.local:6379" : "${local.cluster_name}.${var.namespace}.svc.cluster.local:6379"
}

output "port" {
  description = "Redis port"
  value       = 6379
}

output "connection_string" {
  description = "Redis connection string with auth"
  value       = "redis://:${random_password.redis_password.result}@${var.high_availability ? "${local.cluster_name}-redis" : local.cluster_name}.${var.namespace}.svc.cluster.local:6379"
  sensitive   = true
}

output "resource_id" {
  description = "Resource identifier (cluster name)"
  value       = local.cluster_name
}

output "resource_arn" {
  description = "Resource path (namespace/name)"
  value       = "${var.namespace}/${local.cluster_name}"
}

# Kubernetes-specific outputs

output "cluster_name" {
  description = "Redis cluster name"
  value       = local.cluster_name
}

output "namespace" {
  description = "Kubernetes namespace"
  value       = var.namespace
}

output "password" {
  description = "Redis password"
  value       = random_password.redis_password.result
  sensitive   = true
}

output "auth_secret_name" {
  description = "Secret name containing Redis password"
  value       = kubernetes_secret.redis_auth.metadata[0].name
}

output "service_name" {
  description = "Redis service name"
  value       = var.high_availability ? "${local.cluster_name}-redis" : local.cluster_name
}

output "sentinel_service" {
  description = "Sentinel service name (HA mode only)"
  value       = var.high_availability ? "${local.cluster_name}-sentinel" : null
}

output "sentinel_port" {
  description = "Sentinel port (HA mode only)"
  value       = var.high_availability ? 26379 : null
}

output "metrics_port" {
  description = "Prometheus metrics port"
  value       = var.enable_monitoring ? 9121 : null
}

output "replicas" {
  description = "Number of Redis replicas"
  value       = var.high_availability ? var.replica_count + 1 : 1
}

output "persistence_enabled" {
  description = "Whether persistence is enabled"
  value       = var.persistence_enabled
}

output "storage_class" {
  description = "Storage class used"
  value       = var.persistence_enabled ? var.storage_class : null
}
