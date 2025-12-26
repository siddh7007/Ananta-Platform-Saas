# =============================================================================
# Cloud-Agnostic Database Module Outputs
# =============================================================================
# Unified outputs that work across all cloud providers.
# Uses coalesce pattern to select the active provider's outputs.
# =============================================================================

# -----------------------------------------------------------------------------
# Core Connection Outputs (Unified Interface)
# -----------------------------------------------------------------------------

output "endpoint" {
  description = "Database endpoint (host:port)"
  value = coalesce(
    try(module.aws[0].endpoint, null),
    try(module.azure[0].endpoint, null),
    try(module.gcp[0].endpoint, null),
    try(module.kubernetes[0].endpoint, null),
    ""
  )
}

output "address" {
  description = "Database hostname"
  value = coalesce(
    try(module.aws[0].address, null),
    try(module.azure[0].address, null),
    try(module.gcp[0].address, null),
    try(module.kubernetes[0].address, null),
    ""
  )
}

output "port" {
  description = "Database port"
  value = coalesce(
    try(module.aws[0].port, null),
    try(module.azure[0].port, null),
    try(module.gcp[0].port, null),
    try(module.kubernetes[0].port, null),
    5432
  )
}

output "database_name" {
  description = "Database name"
  value = coalesce(
    try(module.aws[0].database_name, null),
    try(module.azure[0].database_name, null),
    try(module.gcp[0].database_name, null),
    try(module.kubernetes[0].database_name, null),
    var.database_name
  )
}

output "username" {
  description = "Database username"
  value = coalesce(
    try(module.aws[0].username, null),
    try(module.azure[0].username, null),
    try(module.gcp[0].username, null),
    try(module.kubernetes[0].username, null),
    ""
  )
  sensitive = true
}

output "password" {
  description = "Database password"
  value = coalesce(
    try(module.aws[0].password, null),
    try(module.azure[0].password, null),
    try(module.gcp[0].password, null),
    try(module.kubernetes[0].password, null),
    ""
  )
  sensitive = true
}

output "connection_string" {
  description = "PostgreSQL connection string"
  value = coalesce(
    try(module.aws[0].connection_string, null),
    try(module.azure[0].connection_string, null),
    try(module.gcp[0].connection_string, null),
    try(module.kubernetes[0].connection_string, null),
    ""
  )
  sensitive = true
}

# -----------------------------------------------------------------------------
# Read Replica Outputs
# -----------------------------------------------------------------------------

output "replica_endpoints" {
  description = "List of read replica endpoints"
  value = coalesce(
    try(module.aws[0].replica_endpoints, null),
    try(module.azure[0].replica_endpoints, null),
    try(module.gcp[0].replica_endpoints, null),
    try(module.kubernetes[0].replica_endpoints, null),
    []
  )
}

# -----------------------------------------------------------------------------
# Connection Pooler Outputs
# -----------------------------------------------------------------------------

output "pooler_endpoint" {
  description = "Connection pooler endpoint (RDS Proxy, PgBouncer, etc.)"
  value = coalesce(
    try(module.aws[0].pooler_endpoint, null),
    try(module.azure[0].pooler_endpoint, null),
    try(module.gcp[0].pooler_endpoint, null),
    try(module.kubernetes[0].pooler_endpoint, null),
    null
  )
}

# -----------------------------------------------------------------------------
# Resource Identifiers (Unified)
# -----------------------------------------------------------------------------

output "resource_id" {
  description = "Primary resource identifier (instance ID, server ID, cluster name)"
  value = coalesce(
    try(module.aws[0].resource_id, null),
    try(module.azure[0].resource_id, null),
    try(module.gcp[0].resource_id, null),
    try(module.kubernetes[0].resource_id, null),
    ""
  )
}

output "resource_arn" {
  description = "Resource ARN (or equivalent identifier for non-AWS providers)"
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

output "cloud_provider" {
  description = "Active cloud provider for this deployment"
  value       = local.effective_provider
}

# =============================================================================
# Legacy AWS-Compatible Outputs (for backward compatibility)
# =============================================================================

output "instance_id" {
  description = "[Legacy] RDS instance ID (alias for resource_id)"
  value = coalesce(
    try(module.aws[0].resource_id, null),
    try(module.azure[0].resource_id, null),
    try(module.gcp[0].resource_id, null),
    try(module.kubernetes[0].resource_id, null),
    ""
  )
}

output "instance_arn" {
  description = "[Legacy] RDS instance ARN (alias for resource_arn)"
  value = coalesce(
    try(module.aws[0].resource_arn, null),
    try(module.azure[0].resource_arn, null),
    try(module.gcp[0].resource_arn, null),
    try(module.kubernetes[0].resource_arn, null),
    ""
  )
}

output "replica_addresses" {
  description = "[Legacy] List of read replica addresses"
  value = [
    for ep in coalesce(
      try(module.aws[0].replica_endpoints, null),
      try(module.azure[0].replica_endpoints, null),
      try(module.gcp[0].replica_endpoints, null),
      try(module.kubernetes[0].replica_endpoints, null),
      []
    ) : split(":", ep)[0]
  ]
}

output "replica_ids" {
  description = "[Legacy] List of read replica IDs"
  value = try(module.aws[0].replica_ids, [])
}

output "proxy_endpoint" {
  description = "[Legacy] RDS Proxy endpoint (alias for pooler_endpoint)"
  value = coalesce(
    try(module.aws[0].pooler_endpoint, null),
    try(module.kubernetes[0].pooler_endpoint, null),
    null
  )
}

output "proxy_arn" {
  description = "[Legacy] RDS Proxy ARN (AWS-specific)"
  value = try(module.aws[0].proxy_arn, null)
}

output "proxy_id" {
  description = "[Legacy] RDS Proxy ID (AWS-specific)"
  value = try(module.aws[0].proxy_id, null)
}

output "parameter_group_name" {
  description = "[Legacy] Parameter group name (AWS-specific)"
  value = try(module.aws[0].parameter_group_name, null)
}

# =============================================================================
# Provider-Specific Outputs
# =============================================================================
# These outputs expose provider-specific details when needed.
# Use these sparingly - prefer unified outputs when possible.
# =============================================================================

# -----------------------------------------------------------------------------
# AWS-Specific Outputs
# -----------------------------------------------------------------------------

output "aws" {
  description = "AWS-specific outputs (only populated when cloud_provider=aws)"
  value = length(module.aws) > 0 ? {
    instance_id          = try(module.aws[0].resource_id, null)
    instance_arn         = try(module.aws[0].resource_arn, null)
    parameter_group_name = try(module.aws[0].parameter_group_name, null)
    proxy_arn            = try(module.aws[0].proxy_arn, null)
    proxy_id             = try(module.aws[0].proxy_id, null)
    replica_ids          = try(module.aws[0].replica_ids, [])
  } : null
}

# -----------------------------------------------------------------------------
# Azure-Specific Outputs
# -----------------------------------------------------------------------------

output "azure" {
  description = "Azure-specific outputs (only populated when cloud_provider=azure)"
  value = length(module.azure) > 0 ? {
    server_name         = try(module.azure[0].server_name, null)
    resource_group_name = try(module.azure[0].resource_group_name, null)
  } : null
}

# -----------------------------------------------------------------------------
# GCP-Specific Outputs
# -----------------------------------------------------------------------------

output "gcp" {
  description = "GCP-specific outputs (only populated when cloud_provider=gcp)"
  value = length(module.gcp) > 0 ? {
    instance_name      = try(module.gcp[0].instance_name, null)
    connection_name    = try(module.gcp[0].connection_name, null)
    self_link          = try(module.gcp[0].self_link, null)
    private_ip_address = try(module.gcp[0].private_ip_address, null)
    secret_id          = try(module.gcp[0].secret_id, null)
  } : null
}

# -----------------------------------------------------------------------------
# Kubernetes-Specific Outputs
# -----------------------------------------------------------------------------

output "kubernetes" {
  description = "Kubernetes-specific outputs (only populated when cloud_provider=kubernetes)"
  value = length(module.kubernetes) > 0 ? {
    cluster_name          = try(module.kubernetes[0].cluster_name, null)
    namespace             = try(module.kubernetes[0].namespace, null)
    superuser_secret_name = try(module.kubernetes[0].superuser_secret_name, null)
    app_secret_name       = try(module.kubernetes[0].app_secret_name, null)
    primary_service       = try(module.kubernetes[0].primary_service, null)
    replica_service       = try(module.kubernetes[0].replica_service, null)
    pooler_service        = try(module.kubernetes[0].pooler_service, null)
  } : null
}
