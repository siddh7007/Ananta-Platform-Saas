# =============================================================================
# Azure Storage Module Outputs
# =============================================================================

output "bucket_name" {
  description = "Blob container name"
  value       = azurerm_storage_container.main.name
}

output "bucket_arn" {
  description = "Storage account resource ID"
  value       = azurerm_storage_account.main.id
}

output "endpoint" {
  description = "Blob storage primary endpoint"
  value       = azurerm_storage_account.main.primary_blob_endpoint
}

output "resource_id" {
  description = "Storage account ID"
  value       = azurerm_storage_account.main.id
}

output "resource_arn" {
  description = "Storage account resource ID"
  value       = azurerm_storage_account.main.id
}

# Azure-specific outputs

output "storage_account_name" {
  description = "Storage account name"
  value       = azurerm_storage_account.main.name
}

output "container_name" {
  description = "Blob container name"
  value       = azurerm_storage_container.main.name
}

output "resource_group_name" {
  description = "Resource group name"
  value       = local.resource_group_name
}

output "primary_access_key" {
  description = "Primary access key"
  value       = azurerm_storage_account.main.primary_access_key
  sensitive   = true
}

output "secondary_access_key" {
  description = "Secondary access key"
  value       = azurerm_storage_account.main.secondary_access_key
  sensitive   = true
}

output "primary_connection_string" {
  description = "Primary connection string"
  value       = azurerm_storage_account.main.primary_connection_string
  sensitive   = true
}

output "primary_blob_endpoint" {
  description = "Primary blob endpoint"
  value       = azurerm_storage_account.main.primary_blob_endpoint
}

output "primary_blob_host" {
  description = "Primary blob host"
  value       = azurerm_storage_account.main.primary_blob_host
}

output "secondary_blob_endpoint" {
  description = "Secondary blob endpoint"
  value       = azurerm_storage_account.main.secondary_blob_endpoint
}

output "versioning_enabled" {
  description = "Whether versioning is enabled"
  value       = var.versioning_enabled
}

output "private_endpoint_ip" {
  description = "Private endpoint IP address"
  value       = var.enable_private_endpoint ? azurerm_private_endpoint.blob[0].private_service_connection[0].private_ip_address : null
}
