# =============================================================================
# Kubernetes Secrets Module Variables
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
  description = "Tags to apply (mapped to labels)"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Kubernetes-Specific Variables
# -----------------------------------------------------------------------------

variable "namespace" {
  description = "Kubernetes namespace for secrets"
  type        = string
  default     = "default"
}

variable "create_namespace" {
  description = "Create the namespace if it doesn't exist"
  type        = bool
  default     = false
}

variable "labels" {
  description = "Labels to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "annotations" {
  description = "Annotations to apply to all resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Generic Secrets
# -----------------------------------------------------------------------------

variable "secrets" {
  description = "Map of generic secrets to create"
  type = map(object({
    description = string
    value       = map(string)
    type        = optional(string, "Opaque")
  }))
  default = {}
}

# -----------------------------------------------------------------------------
# Database Secrets
# -----------------------------------------------------------------------------

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

# -----------------------------------------------------------------------------
# Auto-Generated Secrets
# -----------------------------------------------------------------------------

variable "generated_secrets" {
  description = "Map of secrets to auto-generate"
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
# TLS Secrets
# -----------------------------------------------------------------------------

variable "tls_secrets" {
  description = "Map of TLS certificate secrets"
  type = map(object({
    description = string
    certificate = string
    private_key = string
  }))
  default   = {}
  sensitive = true
}

# -----------------------------------------------------------------------------
# Docker Registry Secrets
# -----------------------------------------------------------------------------

variable "docker_registry_secrets" {
  description = "Map of Docker registry credentials"
  type = map(object({
    description = string
    server      = string
    username    = string
    password    = string
    email       = optional(string, "")
  }))
  default   = {}
  sensitive = true
}

# -----------------------------------------------------------------------------
# External Secrets Operator Configuration
# -----------------------------------------------------------------------------

variable "use_external_secrets_operator" {
  description = "Use External Secrets Operator for managing secrets"
  type        = bool
  default     = false
}

variable "external_secrets" {
  description = "Map of external secrets to sync from external vault"
  type = map(object({
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
  }))
  default = {}
}

variable "secret_stores" {
  description = "Map of secret stores to create (for External Secrets Operator)"
  type = map(object({
    cluster_wide    = optional(bool, true)
    provider_config = any  # Provider-specific configuration (AWS, Azure, GCP, Vault, etc.)
  }))
  default = {}
}

# -----------------------------------------------------------------------------
# Service Account Configuration
# -----------------------------------------------------------------------------

variable "create_accessor_service_account" {
  description = "Create a service account for accessing secrets"
  type        = bool
  default     = false
}

variable "service_account_annotations" {
  description = "Annotations for the accessor service account"
  type        = map(string)
  default     = {}
}
