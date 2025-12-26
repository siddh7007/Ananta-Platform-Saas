# =============================================================================
# Azure Secrets Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Common Variables (from interface)
# -----------------------------------------------------------------------------

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
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
  description = "Azure resource group name"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "create_key_vault" {
  description = "Create a new Key Vault"
  type        = bool
  default     = true
}

variable "existing_key_vault_id" {
  description = "Existing Key Vault ID (if not creating new)"
  type        = string
  default     = null
}

variable "sku_name" {
  description = "Key Vault SKU (standard or premium)"
  type        = string
  default     = "standard"
}

variable "enabled_for_deployment" {
  description = "Allow Azure VMs to retrieve certificates"
  type        = bool
  default     = false
}

variable "enabled_for_disk_encryption" {
  description = "Allow Azure Disk Encryption to retrieve secrets"
  type        = bool
  default     = false
}

variable "enabled_for_template_deployment" {
  description = "Allow Resource Manager to retrieve secrets"
  type        = bool
  default     = false
}

variable "enable_rbac_authorization" {
  description = "Use RBAC instead of access policies"
  type        = bool
  default     = false
}

variable "purge_protection_enabled" {
  description = "Enable purge protection (prevents permanent deletion)"
  type        = bool
  default     = true
}

variable "soft_delete_retention_days" {
  description = "Number of days to retain soft-deleted secrets"
  type        = number
  default     = 7
}

variable "network_acls" {
  description = "Network ACLs for Key Vault"
  type = object({
    default_action             = string
    bypass                     = string
    ip_rules                   = list(string)
    virtual_network_subnet_ids = list(string)
  })
  default = null
}

variable "access_policies" {
  description = "Additional access policies"
  type = map(object({
    object_id               = string
    secret_permissions      = optional(list(string), ["Get", "List"])
    key_permissions         = optional(list(string), [])
    certificate_permissions = optional(list(string), [])
  }))
  default = {}
}

# -----------------------------------------------------------------------------
# Secret Definitions
# -----------------------------------------------------------------------------

variable "secrets" {
  description = "Map of secrets to create"
  type = map(object({
    description     = string
    value           = any
    expiration_date = optional(string)
    not_before_date = optional(string)
  }))
  default = {}
}

variable "database_secrets" {
  description = "Map of database secrets to create"
  type = map(object({
    host     = string
    port     = number
    database = string
    username = string
    password = string
    engine   = optional(string, "postgres")
  }))
  default   = {}
  sensitive = true
}

variable "generated_secrets" {
  description = "Map of auto-generated secrets"
  type = map(object({
    description      = string
    length           = optional(number, 32)
    special          = optional(bool, true)
    override_special = optional(string)
    upper            = optional(bool, true)
    lower            = optional(bool, true)
    numeric          = optional(bool, true)
  }))
  default = {}
}

# -----------------------------------------------------------------------------
# Private Endpoint
# -----------------------------------------------------------------------------

variable "private_endpoint_subnet_id" {
  description = "Subnet ID for private endpoint"
  type        = string
  default     = null
}

variable "private_dns_zone_ids" {
  description = "Private DNS zone IDs for private endpoint"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Diagnostics
# -----------------------------------------------------------------------------

variable "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID for diagnostics"
  type        = string
  default     = null
}
