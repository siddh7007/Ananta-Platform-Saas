# =============================================================================
# GCP Secrets Module Variables
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

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# GCP-Specific Variables
# -----------------------------------------------------------------------------

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "replication_type" {
  description = "Replication type (automatic or user_managed)"
  type        = string
  default     = "automatic"

  validation {
    condition     = contains(["automatic", "user_managed"], var.replication_type)
    error_message = "Replication type must be 'automatic' or 'user_managed'."
  }
}

variable "replication_locations" {
  description = "List of locations for user-managed replication"
  type        = list(string)
  default     = []
}

variable "kms_key_name" {
  description = "Cloud KMS key name for encryption"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Rotation Configuration
# -----------------------------------------------------------------------------

variable "rotation_period" {
  description = "Rotation period (e.g., '2592000s' for 30 days)"
  type        = string
  default     = null
}

variable "next_rotation_time" {
  description = "Next rotation time (RFC3339 format)"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Notifications
# -----------------------------------------------------------------------------

variable "notification_topics" {
  description = "Pub/Sub topic names for secret notifications"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Secret Definitions
# -----------------------------------------------------------------------------

variable "secrets" {
  description = "Map of secrets to create"
  type = map(object({
    description = string
    value       = any
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
# IAM Configuration
# -----------------------------------------------------------------------------

variable "accessor_members" {
  description = "List of IAM members to grant secret accessor role"
  type        = list(string)
  default     = null
}

variable "create_accessor_service_account" {
  description = "Create a service account for secret access"
  type        = bool
  default     = false
}
