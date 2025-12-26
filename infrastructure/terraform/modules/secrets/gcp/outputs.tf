# =============================================================================
# GCP Secrets Module Outputs
# =============================================================================

output "secret_ids" {
  description = "Map of secret keys to secret IDs"
  value = merge(
    { for k, v in google_secret_manager_secret.secrets : k => v.id },
    { for k, v in google_secret_manager_secret.database : "db-${k}" => v.id },
    { for k, v in google_secret_manager_secret.generated : k => v.id }
  )
}

output "secret_names" {
  description = "Map of secret keys to secret names"
  value = merge(
    { for k, v in google_secret_manager_secret.secrets : k => v.name },
    { for k, v in google_secret_manager_secret.database : "db-${k}" => v.name },
    { for k, v in google_secret_manager_secret.generated : k => v.name }
  )
}

output "secret_version_ids" {
  description = "Map of secret keys to latest version IDs"
  value = merge(
    { for k, v in google_secret_manager_secret_version.secrets : k => v.id },
    { for k, v in google_secret_manager_secret_version.database : "db-${k}" => v.id },
    { for k, v in google_secret_manager_secret_version.generated : k => v.id }
  )
}

output "database_secret_ids" {
  description = "Map of database secret names to IDs"
  value       = { for k, v in google_secret_manager_secret.database : k => v.id }
}

output "generated_secret_values" {
  description = "Map of generated secret values"
  value       = { for k, v in random_password.generated : k => v.result }
  sensitive   = true
}

output "accessor_service_account_email" {
  description = "Email of the accessor service account"
  value       = var.create_accessor_service_account ? google_service_account.secrets_accessor[0].email : null
}

output "accessor_service_account_id" {
  description = "ID of the accessor service account"
  value       = var.create_accessor_service_account ? google_service_account.secrets_accessor[0].id : null
}

output "project_id" {
  description = "GCP project ID"
  value       = var.project_id
}

# Common interface outputs
output "resource_ids" {
  description = "Map of resource IDs for all secrets"
  value = merge(
    { for k, v in google_secret_manager_secret.secrets : k => v.id },
    { for k, v in google_secret_manager_secret.database : "db-${k}" => v.id },
    { for k, v in google_secret_manager_secret.generated : k => v.id }
  )
}

output "resource_arns" {
  description = "Map of resource ARNs/names for all secrets (GCP uses resource names)"
  value = merge(
    { for k, v in google_secret_manager_secret.secrets : k => v.name },
    { for k, v in google_secret_manager_secret.database : "db-${k}" => v.name },
    { for k, v in google_secret_manager_secret.generated : k => v.name }
  )
}
