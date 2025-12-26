# =============================================================================
# Azure Cache Module Outputs
# =============================================================================

output "endpoint" {
  description = "Primary endpoint for Redis"
  value       = azurerm_redis_cache.main.hostname
}

output "reader_endpoint" {
  description = "Reader endpoint (same as primary for Azure)"
  value       = azurerm_redis_cache.main.hostname
}

output "port" {
  description = "Redis port"
  value       = var.encryption_in_transit ? azurerm_redis_cache.main.ssl_port : azurerm_redis_cache.main.port
}

output "connection_string" {
  description = "Redis connection string"
  value       = var.encryption_in_transit ? "rediss://:${azurerm_redis_cache.main.primary_access_key}@${azurerm_redis_cache.main.hostname}:${azurerm_redis_cache.main.ssl_port}" : "redis://:${azurerm_redis_cache.main.primary_access_key}@${azurerm_redis_cache.main.hostname}:${azurerm_redis_cache.main.port}"
  sensitive   = true
}

output "resource_id" {
  description = "Azure resource ID"
  value       = azurerm_redis_cache.main.id
}

output "resource_arn" {
  description = "Azure resource ID (ARN equivalent)"
  value       = azurerm_redis_cache.main.id
}

# Azure-specific outputs

output "redis_cache_name" {
  description = "Azure Cache for Redis name"
  value       = azurerm_redis_cache.main.name
}

output "resource_group_name" {
  description = "Resource group name"
  value       = local.resource_group_name
}

output "primary_access_key" {
  description = "Primary access key"
  value       = azurerm_redis_cache.main.primary_access_key
  sensitive   = true
}

output "secondary_access_key" {
  description = "Secondary access key"
  value       = azurerm_redis_cache.main.secondary_access_key
  sensitive   = true
}

output "ssl_port" {
  description = "SSL port"
  value       = azurerm_redis_cache.main.ssl_port
}

output "non_ssl_port" {
  description = "Non-SSL port"
  value       = azurerm_redis_cache.main.port
}

output "sku_name" {
  description = "SKU name"
  value       = local.sku_config.sku_name
}

output "capacity" {
  description = "SKU capacity"
  value       = local.sku_config.capacity
}

output "private_endpoint_ip" {
  description = "Private endpoint IP address"
  value       = var.enable_private_endpoint ? azurerm_private_endpoint.redis[0].private_service_connection[0].private_ip_address : null
}

output "redis_version" {
  description = "Redis version"
  value       = azurerm_redis_cache.main.redis_version
}
