# =============================================================================
# AWS Database Module Outputs
# =============================================================================
# Unified outputs matching the cloud-agnostic interface
# =============================================================================

output "endpoint" {
  description = "Database endpoint (host:port)"
  value       = aws_db_instance.main.endpoint
}

output "address" {
  description = "Database hostname only"
  value       = aws_db_instance.main.address
}

output "port" {
  description = "Database port"
  value       = aws_db_instance.main.port
}

output "database_name" {
  description = "Database name"
  value       = aws_db_instance.main.db_name
}

output "username" {
  description = "Master username"
  value       = aws_db_instance.main.username
  sensitive   = true
}

output "password" {
  description = "Master password"
  value       = random_password.master.result
  sensitive   = true
}

output "connection_string" {
  description = "PostgreSQL connection string"
  value       = var.enable_connection_pooling ? "postgresql://${aws_db_instance.main.username}:${random_password.master.result}@${aws_db_proxy.main[0].endpoint}/${aws_db_instance.main.db_name}" : "postgresql://${aws_db_instance.main.username}:${random_password.master.result}@${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}"
  sensitive   = true
}

output "replica_endpoints" {
  description = "Read replica endpoints"
  value       = aws_db_instance.replica[*].endpoint
}

output "pooler_endpoint" {
  description = "Connection pooler endpoint (RDS Proxy)"
  value       = var.enable_connection_pooling ? aws_db_proxy.main[0].endpoint : null
}

output "resource_id" {
  description = "RDS instance ID"
  value       = aws_db_instance.main.id
}

output "resource_arn" {
  description = "RDS instance ARN"
  value       = aws_db_instance.main.arn
}

# -----------------------------------------------------------------------------
# AWS-Specific Outputs
# -----------------------------------------------------------------------------

output "instance_class" {
  description = "RDS instance class"
  value       = aws_db_instance.main.instance_class
}

output "parameter_group_name" {
  description = "Parameter group name"
  value       = aws_db_parameter_group.main.name
}

output "security_group_id" {
  description = "Security group ID"
  value       = var.create_security_group ? aws_security_group.database[0].id : var.security_group_id
}

output "proxy_arn" {
  description = "RDS Proxy ARN"
  value       = var.enable_connection_pooling ? aws_db_proxy.main[0].arn : null
}
