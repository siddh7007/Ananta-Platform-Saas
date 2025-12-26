# =============================================================================
# ElastiCache Module Outputs
# =============================================================================

output "replication_group_id" {
  description = "ID of the Redis replication group"
  value       = aws_elasticache_replication_group.main.id
}

output "replication_group_arn" {
  description = "ARN of the Redis replication group"
  value       = aws_elasticache_replication_group.main.arn
}

output "primary_endpoint" {
  description = "Primary endpoint address for the Redis cluster"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "reader_endpoint" {
  description = "Reader endpoint address for the Redis cluster"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "configuration_endpoint" {
  description = "Configuration endpoint for cluster mode enabled"
  value       = aws_elasticache_replication_group.main.configuration_endpoint_address
}

output "port" {
  description = "Redis port"
  value       = 6379
}

output "security_group_id" {
  description = "Security group ID for the Redis cluster"
  value       = aws_security_group.redis.id
}

output "parameter_group_name" {
  description = "Name of the parameter group"
  value       = aws_elasticache_parameter_group.main.name
}

output "subnet_group_name" {
  description = "Name of the subnet group"
  value       = aws_elasticache_subnet_group.main.name
}

output "connection_string" {
  description = "Redis connection string (without auth token)"
  value       = "redis://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
}

output "connection_string_tls" {
  description = "Redis connection string with TLS"
  value       = var.transit_encryption_enabled ? "rediss://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379" : null
}
