# =============================================================================
# Azure Storage Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Common Variables (from interface)
# -----------------------------------------------------------------------------

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "bucket_suffix" {
  description = "Suffix for storage account/container name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "versioning_enabled" {
  description = "Enable blob versioning"
  type        = bool
  default     = true
}

variable "public_access" {
  description = "Allow public access"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Azure-Specific Variables
# -----------------------------------------------------------------------------

variable "resource_group_name" {
  description = "Existing resource group name"
  type        = string
  default     = ""
}

variable "create_resource_group" {
  description = "Create a new resource group"
  type        = bool
  default     = false
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus"
}

variable "container_name" {
  description = "Blob container name (defaults to bucket_suffix)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Storage Account Configuration
# -----------------------------------------------------------------------------

variable "account_tier" {
  description = "Storage account tier (Standard or Premium)"
  type        = string
  default     = "Standard"
}

variable "account_kind" {
  description = "Storage account kind"
  type        = string
  default     = "StorageV2"
}

variable "replication_type" {
  description = "Replication type (LRS, GRS, RAGRS, ZRS, GZRS, RAGZRS)"
  type        = string
  default     = "LRS"
}

variable "access_tier" {
  description = "Blob access tier (Hot, Cool)"
  type        = string
  default     = "Hot"
}

variable "shared_access_key_enabled" {
  description = "Enable shared access key authentication"
  type        = bool
  default     = true
}

variable "enable_hierarchical_namespace" {
  description = "Enable Data Lake Gen2 hierarchical namespace"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# Encryption
# -----------------------------------------------------------------------------

variable "customer_managed_key" {
  description = "Customer managed key configuration"
  type = object({
    key_vault_key_id          = string
    user_assigned_identity_id = string
  })
  default = null
}

# -----------------------------------------------------------------------------
# Network Rules
# -----------------------------------------------------------------------------

variable "network_rules" {
  description = "Network rules for the storage account"
  type = object({
    default_action             = string
    ip_rules                   = list(string)
    virtual_network_subnet_ids = list(string)
    bypass                     = list(string)
  })
  default = null
}

# -----------------------------------------------------------------------------
# Blob Properties
# -----------------------------------------------------------------------------

variable "change_feed_enabled" {
  description = "Enable change feed"
  type        = bool
  default     = false
}

variable "last_access_time_enabled" {
  description = "Enable last access time tracking"
  type        = bool
  default     = false
}

variable "soft_delete_retention_days" {
  description = "Blob soft delete retention days (0 to disable)"
  type        = number
  default     = 7
}

variable "container_soft_delete_retention_days" {
  description = "Container soft delete retention days (0 to disable)"
  type        = number
  default     = 7
}

# -----------------------------------------------------------------------------
# CORS Configuration
# -----------------------------------------------------------------------------

variable "cors_rules" {
  description = "CORS rules for blob storage"
  type = list(object({
    allowed_headers    = list(string)
    allowed_methods    = list(string)
    allowed_origins    = list(string)
    exposed_headers    = list(string)
    max_age_seconds    = number
  }))
  default = []
}

# -----------------------------------------------------------------------------
# Lifecycle Rules
# -----------------------------------------------------------------------------

variable "lifecycle_rules" {
  description = "Lifecycle management rules"
  type = list(object({
    name         = string
    enabled      = bool
    prefix_match = list(string)
    blob_types   = list(string)
    base_blob_actions = optional(object({
      tier_to_cool_after_days    = optional(number)
      tier_to_archive_after_days = optional(number)
      delete_after_days          = optional(number)
    }))
    snapshot_actions = optional(object({
      delete_after_days = number
    }))
    version_actions = optional(object({
      delete_after_days = number
    }))
  }))
  default = []
}

# -----------------------------------------------------------------------------
# Private Endpoint
# -----------------------------------------------------------------------------

variable "enable_private_endpoint" {
  description = "Enable private endpoint for blob storage"
  type        = bool
  default     = false
}

variable "private_endpoint_subnet_id" {
  description = "Subnet ID for private endpoint"
  type        = string
  default     = null
}

variable "private_dns_zone_id" {
  description = "Private DNS zone ID for blob storage"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Monitoring
# -----------------------------------------------------------------------------

variable "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID for diagnostics"
  type        = string
  default     = null
}
