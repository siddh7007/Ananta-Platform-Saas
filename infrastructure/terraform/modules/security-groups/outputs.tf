# =============================================================================
# Security Groups Module Outputs
# =============================================================================

output "alb_security_group_id" {
  description = "Security group ID for Application Load Balancer"
  value       = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  description = "Security group ID for ECS Fargate tasks"
  value       = aws_security_group.ecs.id
}

output "rds_security_group_id" {
  description = "Security group ID for RDS PostgreSQL instances"
  value       = aws_security_group.rds.id
}

output "redis_security_group_id" {
  description = "Security group ID for ElastiCache Redis"
  value       = aws_security_group.redis.id
}

output "rabbitmq_security_group_id" {
  description = "Security group ID for Amazon MQ (RabbitMQ)"
  value       = aws_security_group.rabbitmq.id
}

output "temporal_security_group_id" {
  description = "Security group ID for Temporal server"
  value       = aws_security_group.temporal.id
}

output "keycloak_security_group_id" {
  description = "Security group ID for Keycloak"
  value       = aws_security_group.keycloak.id
}
