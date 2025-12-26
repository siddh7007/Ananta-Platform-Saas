# =============================================================================
# ARC-SaaS Keycloak Module - Outputs
# =============================================================================

output "service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.keycloak.name
}

output "service_id" {
  description = "ID of the ECS service"
  value       = aws_ecs_service.keycloak.id
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = aws_lb_target_group.keycloak.arn
}

output "admin_credentials_secret_arn" {
  description = "ARN of the admin credentials secret"
  value       = aws_secretsmanager_secret.keycloak_admin.arn
}

output "admin_credentials_secret_name" {
  description = "Name of the admin credentials secret"
  value       = aws_secretsmanager_secret.keycloak_admin.name
}

output "keycloak_url" {
  description = "Keycloak URL"
  value       = "https://${var.keycloak_hostname}"
}

output "service_discovery_name" {
  description = "Service discovery DNS name"
  value       = "${aws_service_discovery_service.keycloak.name}.${var.service_discovery_namespace}"
}
