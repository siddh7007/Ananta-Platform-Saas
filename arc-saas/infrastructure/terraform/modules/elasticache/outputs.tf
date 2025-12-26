# =============================================================================
# ARC-SaaS ElastiCache Module - Outputs
# =============================================================================

output "replication_group_id" {
  description = "ID of the ElastiCache replication group"
  value       = aws_elasticache_replication_group.main.id
}

output "replication_group_arn" {
  description = "ARN of the ElastiCache replication group"
  value       = aws_elasticache_replication_group.main.arn
}

output "primary_endpoint_address" {
  description = "Primary endpoint address"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "reader_endpoint_address" {
  description = "Reader endpoint address"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "port" {
  description = "Redis port"
  value       = 6379
}

output "redis_credentials_secret_arn" {
  description = "ARN of the Secrets Manager secret containing Redis credentials"
  value       = var.transit_encryption_enabled ? aws_secretsmanager_secret.redis_credentials[0].arn : null
}

output "redis_credentials_secret_name" {
  description = "Name of the Secrets Manager secret containing Redis credentials"
  value       = var.transit_encryption_enabled ? aws_secretsmanager_secret.redis_credentials[0].name : null
}

output "connection_string" {
  description = "Redis connection string (primary, without auth token)"
  value       = "redis://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
}
