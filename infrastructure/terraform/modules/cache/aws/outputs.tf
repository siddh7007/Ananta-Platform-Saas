# =============================================================================
# AWS Cache Module Outputs
# =============================================================================

output "endpoint" {
  description = "Primary endpoint for Redis cluster"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "reader_endpoint" {
  description = "Reader endpoint for Redis cluster (for read replicas)"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "port" {
  description = "Redis port"
  value       = 6379
}

output "connection_string" {
  description = "Redis connection string"
  value       = var.encryption_in_transit ? "rediss://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379" : "redis://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
  sensitive   = true
}

output "resource_id" {
  description = "Replication group ID"
  value       = aws_elasticache_replication_group.main.id
}

output "resource_arn" {
  description = "Replication group ARN"
  value       = aws_elasticache_replication_group.main.arn
}

# AWS-specific outputs

output "replication_group_id" {
  description = "ElastiCache replication group ID"
  value       = aws_elasticache_replication_group.main.id
}

output "security_group_id" {
  description = "Security group ID for Redis"
  value       = var.create_security_group ? aws_security_group.redis[0].id : var.security_group_id
}

output "subnet_group_name" {
  description = "ElastiCache subnet group name"
  value       = aws_elasticache_subnet_group.main.name
}

output "parameter_group_name" {
  description = "ElastiCache parameter group name"
  value       = aws_elasticache_parameter_group.main.name
}

output "engine_version" {
  description = "Redis engine version"
  value       = aws_elasticache_replication_group.main.engine_version_actual
}

output "node_type" {
  description = "ElastiCache node type"
  value       = local.node_type
}

output "num_cache_clusters" {
  description = "Number of cache clusters in replication group"
  value       = aws_elasticache_replication_group.main.num_cache_clusters
}

output "automatic_failover_enabled" {
  description = "Whether automatic failover is enabled"
  value       = aws_elasticache_replication_group.main.automatic_failover_enabled
}
