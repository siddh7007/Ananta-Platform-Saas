# =============================================================================
# ARC-SaaS Development Environment - Outputs
# =============================================================================

# Network Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.network.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.network.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.network.private_subnet_ids
}

# Database Outputs
output "db_endpoint" {
  description = "Database endpoint"
  value       = module.database.db_endpoint
}

output "db_credentials_secret_arn" {
  description = "Database credentials secret ARN"
  value       = module.database.db_credentials_secret_arn
}

# Redis Outputs
output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = module.elasticache.primary_endpoint_address
}

output "redis_credentials_secret_arn" {
  description = "Redis credentials secret ARN"
  value       = module.elasticache.redis_credentials_secret_arn
}

# ECS Outputs
output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.ecs.alb_dns_name
}

# Keycloak Outputs
output "keycloak_url" {
  description = "Keycloak URL"
  value       = module.keycloak.keycloak_url
}

output "keycloak_admin_secret_arn" {
  description = "Keycloak admin credentials secret ARN"
  value       = module.keycloak.admin_credentials_secret_arn
}
