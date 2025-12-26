# =============================================================================
# Azure Secrets Module Outputs
# =============================================================================

output "key_vault_id" {
  description = "Key Vault ID"
  value       = local.key_vault_id
}

output "key_vault_name" {
  description = "Key Vault name"
  value       = var.create_key_vault ? azurerm_key_vault.main[0].name : null
}

output "key_vault_uri" {
  description = "Key Vault URI"
  value       = var.create_key_vault ? azurerm_key_vault.main[0].vault_uri : null
}

output "secret_ids" {
  description = "Map of secret keys to secret IDs"
  value = merge(
    { for k, v in azurerm_key_vault_secret.secrets : k => v.id },
    { for k, v in azurerm_key_vault_secret.database : "db-${k}" => v.id },
    { for k, v in azurerm_key_vault_secret.generated : k => v.id }
  )
}

output "secret_names" {
  description = "Map of secret keys to secret names"
  value = merge(
    { for k, v in azurerm_key_vault_secret.secrets : k => v.name },
    { for k, v in azurerm_key_vault_secret.database : "db-${k}" => v.name },
    { for k, v in azurerm_key_vault_secret.generated : k => v.name }
  )
}

output "secret_versions" {
  description = "Map of secret keys to current version IDs"
  value = merge(
    { for k, v in azurerm_key_vault_secret.secrets : k => v.version },
    { for k, v in azurerm_key_vault_secret.database : "db-${k}" => v.version },
    { for k, v in azurerm_key_vault_secret.generated : k => v.version }
  )
}

output "database_secret_ids" {
  description = "Map of database secret names to IDs"
  value       = { for k, v in azurerm_key_vault_secret.database : k => v.id }
}

output "generated_secret_values" {
  description = "Map of generated secret values"
  value       = { for k, v in random_password.generated : k => v.result }
  sensitive   = true
}

output "private_endpoint_ip" {
  description = "Private endpoint IP address"
  value       = var.private_endpoint_subnet_id != null ? azurerm_private_endpoint.key_vault[0].private_service_connection[0].private_ip_address : null
}

# Common interface outputs
output "resource_ids" {
  description = "Map of resource IDs for all secrets"
  value = merge(
    { for k, v in azurerm_key_vault_secret.secrets : k => v.id },
    { for k, v in azurerm_key_vault_secret.database : "db-${k}" => v.id },
    { for k, v in azurerm_key_vault_secret.generated : k => v.id }
  )
}

output "resource_arns" {
  description = "Map of resource ARNs/IDs for all secrets (Azure uses IDs)"
  value = merge(
    { for k, v in azurerm_key_vault_secret.secrets : k => v.id },
    { for k, v in azurerm_key_vault_secret.database : "db-${k}" => v.id },
    { for k, v in azurerm_key_vault_secret.generated : k => v.id }
  )
}
