# =============================================================================
# AWS Secrets Module Variables
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

variable "secrets_prefix" {
  description = "Prefix for secret names"
  type        = string
  default     = "ananta"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
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
  description = "Map of database secrets to create (with special structure)"
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
# AWS-Specific Variables
# -----------------------------------------------------------------------------

variable "kms_key_arn" {
  description = "KMS key ARN for encrypting secrets"
  type        = string
  default     = null
}

variable "recovery_window_days" {
  description = "Number of days before a deleted secret is permanently deleted"
  type        = number
  default     = 7
}

variable "replica_regions" {
  description = "List of regions to replicate secrets to"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Rotation Configuration
# -----------------------------------------------------------------------------

variable "enable_rotation" {
  description = "Enable automatic secret rotation for database secrets"
  type        = bool
  default     = false
}

variable "rotation_lambda_arn" {
  description = "ARN of Lambda function for secret rotation"
  type        = string
  default     = null
}

variable "rotation_days" {
  description = "Number of days between rotations"
  type        = number
  default     = 30
}

# -----------------------------------------------------------------------------
# Access Policy
# -----------------------------------------------------------------------------

variable "create_access_policy" {
  description = "Create IAM policy for reading secrets"
  type        = bool
  default     = true
}
