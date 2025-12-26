# =============================================================================
# Cloud-Agnostic Secrets Module Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Common Interface Outputs
# -----------------------------------------------------------------------------

output "secret_arns" {
  description = "Map of secret names to their ARNs/identifiers"
  value = coalesce(
    try(module.aws[0].secret_arns, null),
    try(module.azure[0].secret_arns, null),
    try(module.gcp[0].secret_arns, null),
    try(module.kubernetes[0].secret_arns, null),
    {}
  )
}

output "secret_names" {
  description = "Map of secret keys to their provider-specific names"
  value = coalesce(
    try(module.aws[0].secret_names, null),
    try(module.azure[0].secret_names, null),
    try(module.gcp[0].secret_names, null),
    try(module.kubernetes[0].secret_names, null),
    {}
  )
}

output "resource_ids" {
  description = "Map of resource identifiers for all secrets"
  value = coalesce(
    try(module.aws[0].resource_ids, null),
    try(module.azure[0].resource_ids, null),
    try(module.gcp[0].resource_ids, null),
    try(module.kubernetes[0].resource_ids, null),
    {}
  )
}

output "resource_arns" {
  description = "Map of resource ARNs/URIs for all secrets"
  value = coalesce(
    try(module.aws[0].resource_arns, null),
    try(module.azure[0].resource_arns, null),
    try(module.gcp[0].resource_arns, null),
    try(module.kubernetes[0].resource_arns, null),
    {}
  )
}

output "generated_secret_values" {
  description = "Map of generated secret values"
  value = coalesce(
    try(module.aws[0].generated_secret_values, null),
    try(module.azure[0].generated_secret_values, null),
    try(module.gcp[0].generated_secret_values, null),
    try(module.kubernetes[0].generated_secret_values, null),
    {}
  )
  sensitive = true
}

output "cloud_provider" {
  description = "The cloud provider being used"
  value       = local.effective_provider
}

# -----------------------------------------------------------------------------
# AWS-Specific Outputs
# -----------------------------------------------------------------------------

output "aws_kms_key_id" {
  description = "KMS key ID used for encryption (AWS only)"
  value       = try(module.aws[0].kms_key_id, "")
}

output "aws_access_policy_arn" {
  description = "ARN of the IAM policy for secret access (AWS only)"
  value       = try(module.aws[0].access_policy_arn, "")
}

# -----------------------------------------------------------------------------
# Azure-Specific Outputs
# -----------------------------------------------------------------------------

output "azure_key_vault_id" {
  description = "Key Vault ID (Azure only)"
  value       = try(module.azure[0].key_vault_id, "")
}

output "azure_key_vault_uri" {
  description = "Key Vault URI (Azure only)"
  value       = try(module.azure[0].key_vault_uri, "")
}

output "azure_key_vault_name" {
  description = "Key Vault name (Azure only)"
  value       = try(module.azure[0].key_vault_name, "")
}

# -----------------------------------------------------------------------------
# GCP-Specific Outputs
# -----------------------------------------------------------------------------

output "gcp_project_id" {
  description = "GCP project ID (GCP only)"
  value       = try(module.gcp[0].project_id, "")
}

output "gcp_accessor_service_account_email" {
  description = "Service account email for secret access (GCP only)"
  value       = try(module.gcp[0].accessor_service_account_email, "")
}

# -----------------------------------------------------------------------------
# Kubernetes-Specific Outputs
# -----------------------------------------------------------------------------

output "kubernetes_namespace" {
  description = "Kubernetes namespace containing secrets (K8s only)"
  value       = try(module.kubernetes[0].namespace, "")
}

output "kubernetes_service_account_name" {
  description = "Service account name for secret access (K8s only)"
  value       = try(module.kubernetes[0].accessor_service_account_name, "")
}

output "kubernetes_external_secrets" {
  description = "Map of External Secrets details (K8s only)"
  value       = try(module.kubernetes[0].external_secrets, {})
}

output "kubernetes_secret_stores" {
  description = "Map of Secret Store details (K8s only)"
  value       = try(module.kubernetes[0].secret_stores, {})
}
