# =============================================================================
# Cloud-Agnostic Cache Module Outputs
# =============================================================================
# Unified outputs that work across all cloud providers.
# Provider-specific outputs are available in nested objects.
# =============================================================================

# -----------------------------------------------------------------------------
# Primary Outputs (Unified Interface)
# -----------------------------------------------------------------------------

output "endpoint" {
  description = "Primary Redis endpoint"
  value = coalesce(
    try(module.aws[0].endpoint, null),
    try(module.azure[0].endpoint, null),
    try(module.gcp[0].endpoint, null),
    try(module.kubernetes[0].endpoint, null),
    ""
  )
}

output "reader_endpoint" {
  description = "Reader endpoint for Redis (for read replicas)"
  value = coalesce(
    try(module.aws[0].reader_endpoint, null),
    try(module.azure[0].reader_endpoint, null),
    try(module.gcp[0].reader_endpoint, null),
    try(module.kubernetes[0].reader_endpoint, null),
    ""
  )
}

output "port" {
  description = "Redis port"
  value = coalesce(
    try(module.aws[0].port, null),
    try(module.azure[0].port, null),
    try(module.gcp[0].port, null),
    try(module.kubernetes[0].port, null),
    6379
  )
}

output "connection_string" {
  description = "Redis connection string"
  value = coalesce(
    try(module.aws[0].connection_string, null),
    try(module.azure[0].connection_string, null),
    try(module.gcp[0].connection_string, null),
    try(module.kubernetes[0].connection_string, null),
    ""
  )
  sensitive = true
}

output "resource_id" {
  description = "Cache resource identifier (provider-specific format)"
  value = coalesce(
    try(module.aws[0].resource_id, null),
    try(module.azure[0].resource_id, null),
    try(module.gcp[0].resource_id, null),
    try(module.kubernetes[0].resource_id, null),
    ""
  )
}

output "resource_arn" {
  description = "Cache resource ARN/path (provider-specific format)"
  value = coalesce(
    try(module.aws[0].resource_arn, null),
    try(module.azure[0].resource_arn, null),
    try(module.gcp[0].resource_arn, null),
    try(module.kubernetes[0].resource_arn, null),
    ""
  )
}

# -----------------------------------------------------------------------------
# Provider Information
# -----------------------------------------------------------------------------

output "provider" {
  description = "Active cloud provider"
  value       = local.effective_provider
}

output "engine_version" {
  description = "Redis engine version"
  value       = var.engine_version
}

output "high_availability" {
  description = "Whether high availability is enabled"
  value       = local.normalized_high_availability
}

output "replica_count" {
  description = "Number of read replicas"
  value       = var.replica_count
}

# -----------------------------------------------------------------------------
# AWS-Specific Outputs
# -----------------------------------------------------------------------------

output "aws" {
  description = "AWS-specific outputs (only populated when using AWS)"
  value = local.effective_provider == "aws" ? {
    replication_group_id       = try(module.aws[0].replication_group_id, null)
    security_group_id          = try(module.aws[0].security_group_id, null)
    subnet_group_name          = try(module.aws[0].subnet_group_name, null)
    parameter_group_name       = try(module.aws[0].parameter_group_name, null)
    engine_version             = try(module.aws[0].engine_version, null)
    node_type                  = try(module.aws[0].node_type, null)
    num_cache_clusters         = try(module.aws[0].num_cache_clusters, null)
    automatic_failover_enabled = try(module.aws[0].automatic_failover_enabled, null)
  } : null
}

# -----------------------------------------------------------------------------
# Azure-Specific Outputs
# -----------------------------------------------------------------------------

output "azure" {
  description = "Azure-specific outputs (only populated when using Azure)"
  value = local.effective_provider == "azure" ? {
    redis_cache_name    = try(module.azure[0].redis_cache_name, null)
    resource_group_name = try(module.azure[0].resource_group_name, null)
    primary_access_key  = try(module.azure[0].primary_access_key, null)
    ssl_port            = try(module.azure[0].ssl_port, null)
    non_ssl_port        = try(module.azure[0].non_ssl_port, null)
    sku_name            = try(module.azure[0].sku_name, null)
    capacity            = try(module.azure[0].capacity, null)
    private_endpoint_ip = try(module.azure[0].private_endpoint_ip, null)
    redis_version       = try(module.azure[0].redis_version, null)
  } : null
  sensitive = true
}

# -----------------------------------------------------------------------------
# GCP-Specific Outputs
# -----------------------------------------------------------------------------

output "gcp" {
  description = "GCP-specific outputs (only populated when using GCP)"
  value = local.effective_provider == "gcp" ? {
    instance_name       = try(module.gcp[0].instance_name, null)
    project             = try(module.gcp[0].project, null)
    region              = try(module.gcp[0].region, null)
    current_location_id = try(module.gcp[0].current_location_id, null)
    auth_string         = try(module.gcp[0].auth_string, null)
    auth_secret_name    = try(module.gcp[0].auth_secret_name, null)
    tier                = try(module.gcp[0].tier, null)
    memory_size_gb      = try(module.gcp[0].memory_size_gb, null)
    redis_version       = try(module.gcp[0].redis_version, null)
    persistence_mode    = try(module.gcp[0].persistence_mode, null)
  } : null
  sensitive = true
}

# -----------------------------------------------------------------------------
# Kubernetes-Specific Outputs
# -----------------------------------------------------------------------------

output "kubernetes" {
  description = "Kubernetes-specific outputs (only populated when using Kubernetes)"
  value = local.effective_provider == "kubernetes" ? {
    cluster_name        = try(module.kubernetes[0].cluster_name, null)
    namespace           = try(module.kubernetes[0].namespace, null)
    password            = try(module.kubernetes[0].password, null)
    auth_secret_name    = try(module.kubernetes[0].auth_secret_name, null)
    service_name        = try(module.kubernetes[0].service_name, null)
    sentinel_service    = try(module.kubernetes[0].sentinel_service, null)
    sentinel_port       = try(module.kubernetes[0].sentinel_port, null)
    metrics_port        = try(module.kubernetes[0].metrics_port, null)
    replicas            = try(module.kubernetes[0].replicas, null)
    persistence_enabled = try(module.kubernetes[0].persistence_enabled, null)
    storage_class       = try(module.kubernetes[0].storage_class, null)
  } : null
  sensitive = true
}

# -----------------------------------------------------------------------------
# Legacy Outputs (for backward compatibility)
# -----------------------------------------------------------------------------

output "primary_endpoint_address" {
  description = "[Legacy] Primary endpoint address"
  value       = try(module.aws[0].endpoint, "")
}

output "reader_endpoint_address" {
  description = "[Legacy] Reader endpoint address"
  value       = try(module.aws[0].reader_endpoint, "")
}

output "replication_group_id" {
  description = "[Legacy] ElastiCache replication group ID"
  value       = try(module.aws[0].replication_group_id, "")
}

output "replication_group_arn" {
  description = "[Legacy] ElastiCache replication group ARN"
  value       = try(module.aws[0].resource_arn, "")
}

output "security_group_id" {
  description = "[Legacy] Security group ID"
  value       = try(module.aws[0].security_group_id, "")
}
