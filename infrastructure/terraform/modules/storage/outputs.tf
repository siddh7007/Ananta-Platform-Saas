# =============================================================================
# Cloud-Agnostic Storage Module Outputs
# =============================================================================
# Unified outputs using coalesce pattern to return values from the active
# provider module.
# =============================================================================

# -----------------------------------------------------------------------------
# Common Outputs (Provider-Agnostic Interface)
# -----------------------------------------------------------------------------

output "bucket_name" {
  description = "Bucket/container name"
  value = coalesce(
    try(module.aws[0].bucket_name, null),
    try(module.azure[0].bucket_name, null),
    try(module.gcp[0].bucket_name, null),
    try(module.kubernetes[0].bucket_name, null),
    ""
  )
}

output "bucket_arn" {
  description = "Bucket ARN or equivalent identifier"
  value = coalesce(
    try(module.aws[0].bucket_arn, null),
    try(module.azure[0].bucket_arn, null),
    try(module.gcp[0].bucket_arn, null),
    try(module.kubernetes[0].bucket_arn, null),
    ""
  )
}

output "endpoint" {
  description = "Bucket endpoint URL"
  value = coalesce(
    try(module.aws[0].endpoint, null),
    try(module.azure[0].endpoint, null),
    try(module.gcp[0].endpoint, null),
    try(module.kubernetes[0].endpoint, null),
    ""
  )
}

output "resource_id" {
  description = "Resource ID"
  value = coalesce(
    try(module.aws[0].resource_id, null),
    try(module.azure[0].resource_id, null),
    try(module.gcp[0].resource_id, null),
    try(module.kubernetes[0].resource_id, null),
    ""
  )
}

output "resource_arn" {
  description = "Resource ARN or equivalent"
  value = coalesce(
    try(module.aws[0].resource_arn, null),
    try(module.azure[0].resource_arn, null),
    try(module.gcp[0].resource_arn, null),
    try(module.kubernetes[0].resource_arn, null),
    ""
  )
}

output "cloud_provider" {
  description = "Active cloud provider"
  value       = local.effective_provider
}

# -----------------------------------------------------------------------------
# AWS-Specific Outputs
# -----------------------------------------------------------------------------

output "aws_bucket_domain_name" {
  description = "AWS S3 bucket domain name"
  value       = try(module.aws[0].bucket_domain_name, "")
}

output "aws_bucket_regional_domain_name" {
  description = "AWS S3 bucket regional domain name"
  value       = try(module.aws[0].bucket_regional_domain_name, "")
}

output "aws_hosted_zone_id" {
  description = "AWS Route 53 hosted zone ID for the bucket"
  value       = try(module.aws[0].hosted_zone_id, "")
}

output "aws_region" {
  description = "AWS region for the bucket"
  value       = try(module.aws[0].region, "")
}

# -----------------------------------------------------------------------------
# Azure-Specific Outputs
# -----------------------------------------------------------------------------

output "azure_storage_account_id" {
  description = "Azure storage account ID"
  value       = try(module.azure[0].storage_account_id, "")
}

output "azure_storage_account_name" {
  description = "Azure storage account name"
  value       = try(module.azure[0].storage_account_name, "")
}

output "azure_primary_access_key" {
  description = "Azure storage account primary access key"
  value       = try(module.azure[0].primary_access_key, "")
  sensitive   = true
}

output "azure_primary_connection_string" {
  description = "Azure storage account primary connection string"
  value       = try(module.azure[0].primary_connection_string, "")
  sensitive   = true
}

output "azure_primary_blob_endpoint" {
  description = "Azure primary blob endpoint"
  value       = try(module.azure[0].primary_blob_endpoint, "")
}

# -----------------------------------------------------------------------------
# GCP-Specific Outputs
# -----------------------------------------------------------------------------

output "gcp_url" {
  description = "GCP bucket URL (gs://bucket-name)"
  value       = try(module.gcp[0].url, "")
}

output "gcp_self_link" {
  description = "GCP bucket self link"
  value       = try(module.gcp[0].self_link, "")
}

output "gcp_project" {
  description = "GCP project ID"
  value       = try(module.gcp[0].project, "")
}

output "gcp_location" {
  description = "GCP bucket location"
  value       = try(module.gcp[0].location, "")
}

output "gcp_storage_class" {
  description = "GCP storage class"
  value       = try(module.gcp[0].storage_class, "")
}

# -----------------------------------------------------------------------------
# Kubernetes-Specific Outputs
# -----------------------------------------------------------------------------

output "kubernetes_namespace" {
  description = "Kubernetes namespace for MinIO"
  value       = try(module.kubernetes[0].namespace, "")
}

output "kubernetes_service_name" {
  description = "Kubernetes service name for MinIO"
  value       = try(module.kubernetes[0].service_name, "")
}

output "kubernetes_access_key" {
  description = "MinIO access key"
  value       = try(module.kubernetes[0].access_key, "")
  sensitive   = true
}

output "kubernetes_secret_key" {
  description = "MinIO secret key"
  value       = try(module.kubernetes[0].secret_key, "")
  sensitive   = true
}

output "kubernetes_connection_string" {
  description = "MinIO connection string"
  value       = try(module.kubernetes[0].connection_string, "")
  sensitive   = true
}

output "kubernetes_console_endpoint" {
  description = "MinIO console endpoint"
  value       = try(module.kubernetes[0].console_endpoint, "")
}

output "kubernetes_secret_name" {
  description = "Kubernetes secret containing MinIO credentials"
  value       = try(module.kubernetes[0].secret_name, "")
}
