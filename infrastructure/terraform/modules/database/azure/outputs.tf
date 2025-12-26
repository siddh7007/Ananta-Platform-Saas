# =============================================================================
# Azure Database Module Outputs
# =============================================================================

output "endpoint" {
  description = "Database endpoint (host:port)"
  value       = "${azurerm_postgresql_flexible_server.main.fqdn}:5432"
}

output "address" {
  description = "Database hostname"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "port" {
  description = "Database port"
  value       = 5432
}

output "database_name" {
  description = "Database name"
  value       = azurerm_postgresql_flexible_server_database.main.name
}

output "username" {
  description = "Master username"
  value       = azurerm_postgresql_flexible_server.main.administrator_login
  sensitive   = true
}

output "password" {
  description = "Master password"
  value       = random_password.master.result
  sensitive   = true
}

output "connection_string" {
  description = "PostgreSQL connection string"
  value       = "postgresql://${azurerm_postgresql_flexible_server.main.administrator_login}:${random_password.master.result}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${azurerm_postgresql_flexible_server_database.main.name}?sslmode=require"
  sensitive   = true
}

output "replica_endpoints" {
  description = "Read replica endpoints"
  value       = [for r in azurerm_postgresql_flexible_server.replica : "${r.fqdn}:5432"]
}

output "pooler_endpoint" {
  description = "Connection pooler endpoint"
  value       = null # Azure Flexible Server doesn't have built-in pooler
}

output "resource_id" {
  description = "Server ID"
  value       = azurerm_postgresql_flexible_server.main.id
}

output "resource_arn" {
  description = "Server ID (Azure equivalent of ARN)"
  value       = azurerm_postgresql_flexible_server.main.id
}

# Azure-specific outputs
output "server_name" {
  description = "PostgreSQL server name"
  value       = azurerm_postgresql_flexible_server.main.name
}

output "resource_group_name" {
  description = "Resource group name"
  value       = local.resource_group_name
}
