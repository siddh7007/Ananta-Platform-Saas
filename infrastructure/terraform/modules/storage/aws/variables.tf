# =============================================================================
# AWS Storage Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Common Variables (from interface)
# -----------------------------------------------------------------------------

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "bucket_suffix" {
  description = "Suffix for bucket name (name_prefix-bucket_suffix)"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "versioning_enabled" {
  description = "Enable versioning"
  type        = bool
  default     = true
}

variable "encryption_enabled" {
  description = "Enable server-side encryption"
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
# AWS-Specific Variables
# -----------------------------------------------------------------------------

variable "force_destroy" {
  description = "Allow bucket deletion with objects"
  type        = bool
  default     = false
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption"
  type        = string
  default     = null
}

variable "bucket_policy" {
  description = "Bucket policy JSON"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# CORS Configuration
# -----------------------------------------------------------------------------

variable "cors_rules" {
  description = "CORS rules for the bucket"
  type = list(object({
    allowed_headers = list(string)
    allowed_methods = list(string)
    allowed_origins = list(string)
    expose_headers  = optional(list(string), [])
    max_age_seconds = optional(number, 3600)
  }))
  default = []
}

# -----------------------------------------------------------------------------
# Lifecycle Rules
# -----------------------------------------------------------------------------

variable "lifecycle_rules" {
  description = "Lifecycle rules for the bucket"
  type = list(object({
    id                                  = string
    enabled                             = bool
    prefix                              = string
    expiration_days                     = optional(number)
    noncurrent_version_expiration_days  = optional(number)
    transitions = optional(list(object({
      days          = number
      storage_class = string  # STANDARD_IA, ONEZONE_IA, INTELLIGENT_TIERING, GLACIER, DEEP_ARCHIVE
    })), [])
    noncurrent_version_transitions = optional(list(object({
      days          = number
      storage_class = string
    })), [])
  }))
  default = []
}

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------

variable "logging_bucket" {
  description = "Target bucket for access logs"
  type        = string
  default     = null
}

variable "logging_prefix" {
  description = "Prefix for log objects"
  type        = string
  default     = "logs/"
}

# -----------------------------------------------------------------------------
# Replication
# -----------------------------------------------------------------------------

variable "replication_enabled" {
  description = "Enable cross-region replication"
  type        = bool
  default     = false
}

variable "replication_destination_bucket_arn" {
  description = "Destination bucket ARN for replication"
  type        = string
  default     = null
}

variable "replication_role_arn" {
  description = "IAM role ARN for replication"
  type        = string
  default     = null
}

variable "replication_prefix" {
  description = "Prefix filter for replication"
  type        = string
  default     = ""
}

variable "replication_storage_class" {
  description = "Storage class in destination bucket"
  type        = string
  default     = "STANDARD"
}

variable "replicate_delete_markers" {
  description = "Replicate delete markers"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# Object Lock
# -----------------------------------------------------------------------------

variable "object_lock_enabled" {
  description = "Enable object lock"
  type        = bool
  default     = false
}

variable "object_lock_mode" {
  description = "Object lock mode (GOVERNANCE or COMPLIANCE)"
  type        = string
  default     = "GOVERNANCE"
}

variable "object_lock_retention_days" {
  description = "Default retention period in days"
  type        = number
  default     = 30
}

# -----------------------------------------------------------------------------
# Intelligent Tiering
# -----------------------------------------------------------------------------

variable "intelligent_tiering_enabled" {
  description = "Enable intelligent tiering"
  type        = bool
  default     = false
}

variable "archive_access_tier_days" {
  description = "Days before moving to Archive Access tier"
  type        = number
  default     = 90
}

variable "deep_archive_access_tier_days" {
  description = "Days before moving to Deep Archive Access tier"
  type        = number
  default     = 180
}

# -----------------------------------------------------------------------------
# Notifications
# -----------------------------------------------------------------------------

variable "enable_notifications" {
  description = "Enable bucket notifications"
  type        = bool
  default     = false
}

variable "lambda_notifications" {
  description = "Lambda function notifications"
  type = list(object({
    lambda_arn    = string
    events        = list(string)
    filter_prefix = optional(string, "")
    filter_suffix = optional(string, "")
  }))
  default = []
}

variable "sqs_notifications" {
  description = "SQS queue notifications"
  type = list(object({
    queue_arn     = string
    events        = list(string)
    filter_prefix = optional(string, "")
    filter_suffix = optional(string, "")
  }))
  default = []
}

variable "sns_notifications" {
  description = "SNS topic notifications"
  type = list(object({
    topic_arn     = string
    events        = list(string)
    filter_prefix = optional(string, "")
    filter_suffix = optional(string, "")
  }))
  default = []
}
