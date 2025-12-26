# =============================================================================
# Temporal Module Outputs
# =============================================================================

output "temporal_server_service_name" {
  description = "Temporal server ECS service name"
  value       = aws_ecs_service.temporal_server.name
}

output "temporal_server_service_id" {
  description = "Temporal server ECS service ID"
  value       = aws_ecs_service.temporal_server.id
}

output "temporal_ui_service_name" {
  description = "Temporal UI ECS service name"
  value       = aws_ecs_service.temporal_ui.name
}

output "temporal_ui_service_id" {
  description = "Temporal UI ECS service ID"
  value       = aws_ecs_service.temporal_ui.id
}

output "temporal_db_endpoint" {
  description = "Temporal database endpoint"
  value       = aws_db_instance.temporal.address
  sensitive   = true
}

output "temporal_db_port" {
  description = "Temporal database port"
  value       = aws_db_instance.temporal.port
}

output "db_credentials_secret_arn" {
  description = "ARN of Temporal database credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "temporal_address" {
  description = "Temporal server gRPC address (internal)"
  value       = "temporal-server.${var.name_prefix}.local:7233"
}

output "temporal_ui_url" {
  description = "Temporal UI URL (via ALB)"
  value       = "https://${var.name_prefix}.example.com/temporal-ui"
}

output "namespace" {
  description = "Temporal namespace"
  value       = var.namespace
}

output "task_queue" {
  description = "Default task queue"
  value       = var.task_queue
}

output "service_discovery_namespace_id" {
  description = "Service discovery namespace ID"
  value       = aws_service_discovery_private_dns_namespace.temporal.id
}

output "service_discovery_namespace_name" {
  description = "Service discovery namespace name"
  value       = aws_service_discovery_private_dns_namespace.temporal.name
}
