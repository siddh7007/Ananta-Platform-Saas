# =============================================================================
# Cloud-Agnostic Secrets Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Provider Selection
# -----------------------------------------------------------------------------

variable "cloud_provider" {
  description = "Cloud provider to use (aws, azure, gcp, kubernetes)"
  type        = string
  default     = ""

  validation {
    condition     = var.cloud_provider == "" || contains(["aws", "azure", "gcp", "kubernetes"], var.cloud_provider)
    error_message = "cloud_provider must be one of: aws, azure, gcp, kubernetes"
  }
}

# -----------------------------------------------------------------------------
# Common Variables
# -----------------------------------------------------------------------------

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "secrets_prefix" {
  description = "Prefix for secret names/paths"
  type        = string
  default     = "ananta"
}

variable "tags" {
  description = "Tags/labels to apply to resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Secret Definitions (Common Across Providers)
# -----------------------------------------------------------------------------

variable "secrets" {
  description = "Map of generic secrets to create"
  type = map(object({
    description = string
    value       = any
  }))
  default = {}
}

variable "database_secrets" {
  description = "Map of database connection secrets"
  type = map(object({
    host     = string
    port     = number
    database = string
    username = string
    password = string
    engine   = optional(string, "postgresql")
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
    override_special = optional(string, "!@#$%&*()-_=+[]{}:?")
    upper            = optional(bool, true)
    lower            = optional(bool, true)
    numeric          = optional(bool, true)
  }))
  default = {}
}

# -----------------------------------------------------------------------------
# AWS Configuration
# -----------------------------------------------------------------------------

variable "aws_config" {
  description = "AWS-specific configuration for Secrets Manager"
  type = object({
    kms_key_arn          = optional(string)
    recovery_window_days = optional(number, 7)
    enable_rotation      = optional(bool, false)
    rotation_lambda_arn  = optional(string)
    rotation_days        = optional(number, 30)
    replica_regions      = optional(list(string), [])
    create_access_policy = optional(bool, true)
  })
  default = {}
}

# -----------------------------------------------------------------------------
# Azure Configuration
# -----------------------------------------------------------------------------

variable "azure_config" {
  description = "Azure-specific configuration for Key Vault"
  type = object({
    resource_group_name             = optional(string)
    location                        = optional(string, "eastus")
    tenant_id                       = optional(string)
    sku_name                        = optional(string, "standard")
    enabled_for_deployment          = optional(bool, false)
    enabled_for_disk_encryption     = optional(bool, false)
    enabled_for_template_deployment = optional(bool, false)
    enable_rbac_authorization       = optional(bool, true)
    purge_protection_enabled        = optional(bool, true)
    soft_delete_retention_days      = optional(number, 90)
    access_policies = optional(list(object({
      tenant_id               = string
      object_id               = string
      certificate_permissions = optional(list(string), [])
      key_permissions         = optional(list(string), [])
      secret_permissions      = optional(list(string), ["Get", "List"])
      storage_permissions     = optional(list(string), [])
    })), [])
    network_acls = optional(object({
      default_action             = optional(string, "Deny")
      bypass                     = optional(string, "AzureServices")
      ip_rules                   = optional(list(string), [])
      virtual_network_subnet_ids = optional(list(string), [])
    }))
    private_endpoint_subnet_id = optional(string)
    enable_diagnostics         = optional(bool, false)
    log_analytics_workspace_id = optional(string)
  })
  default = {}
}

# -----------------------------------------------------------------------------
# GCP Configuration
# -----------------------------------------------------------------------------

variable "gcp_config" {
  description = "GCP-specific configuration for Secret Manager"
  type = object({
    project_id            = optional(string)
    labels                = optional(map(string), {})
    replication_type      = optional(string, "automatic")
    replication_locations = optional(list(string), [])
    kms_key_name          = optional(string)
    enable_rotation       = optional(bool, false)
    rotation_period       = optional(string, "7776000s")  # 90 days
    rotation_topic        = optional(string)
    iam_bindings = optional(list(object({
      role    = string
      members = list(string)
    })), [])
    create_accessor_service_account = optional(bool, false)
  })
  default = {}
}

# -----------------------------------------------------------------------------
# Kubernetes Configuration
# -----------------------------------------------------------------------------

variable "kubernetes_config" {
  description = "Kubernetes-specific configuration for secrets"
  type = object({
    namespace        = optional(string, "default")
    create_namespace = optional(bool, false)
    labels           = optional(map(string), {})
    annotations      = optional(map(string), {})
    tls_secrets = optional(map(object({
      description = string
      certificate = string
      private_key = string
    })), {})
    docker_registry_secrets = optional(map(object({
      description = string
      server      = string
      username    = string
      password    = string
      email       = optional(string, "")
    })), {})
    use_external_secrets_operator = optional(bool, false)
    external_secrets = optional(map(object({
      refresh_interval  = optional(string, "1h")
      secret_store_name = string
      secret_store_kind = optional(string, "ClusterSecretStore")
      data = list(object({
        secret_key      = string
        remote_key      = string
        remote_property = optional(string)
      }))
      template = optional(object({
        type = optional(string, "Opaque")
        data = optional(map(string))
      }))
    })), {})
    secret_stores = optional(map(object({
      cluster_wide    = optional(bool, true)
      provider_config = any
    })), {})
    create_accessor_service_account = optional(bool, false)
    service_account_annotations     = optional(map(string), {})
  })
  default = {}
}
