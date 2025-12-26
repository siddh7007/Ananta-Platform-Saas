# =============================================================================
# Keycloak Module Outputs
# =============================================================================

output "keycloak_service_name" {
  description = "Keycloak ECS service name"
  value       = aws_ecs_service.keycloak.name
}

output "keycloak_service_id" {
  description = "Keycloak ECS service ID"
  value       = aws_ecs_service.keycloak.id
}

output "keycloak_target_group_arn" {
  description = "Keycloak ALB target group ARN"
  value       = aws_lb_target_group.keycloak.arn
}

output "keycloak_db_endpoint" {
  description = "Keycloak database endpoint"
  value       = aws_db_instance.keycloak.address
  sensitive   = true
}

output "keycloak_db_port" {
  description = "Keycloak database port"
  value       = aws_db_instance.keycloak.port
}

output "admin_credentials_secret_arn" {
  description = "ARN of Keycloak admin credentials secret"
  value       = aws_secretsmanager_secret.admin_password.arn
}

output "db_credentials_secret_arn" {
  description = "ARN of Keycloak database credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "keycloak_url" {
  description = "Keycloak URL (via ALB)"
  value       = "https://${var.name_prefix}.example.com/auth"
}

output "admin_console_url" {
  description = "Keycloak admin console URL"
  value       = "https://${var.name_prefix}.example.com/admin"
}
