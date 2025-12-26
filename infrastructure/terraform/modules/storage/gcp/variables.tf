# =============================================================================
# GCP Storage Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Common Variables (from interface)
# -----------------------------------------------------------------------------

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "bucket_suffix" {
  description = "Suffix for bucket name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "versioning_enabled" {
  description = "Enable object versioning"
  type        = bool
  default     = true
}

variable "public_access" {
  description = "Allow public access"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply (mapped to labels)"
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

variable "location" {
  description = "Bucket location (region or multi-region)"
  type        = string
  default     = "US"
}

variable "storage_class" {
  description = "Storage class (STANDARD, NEARLINE, COLDLINE, ARCHIVE)"
  type        = string
  default     = "STANDARD"
}

variable "labels" {
  description = "Labels to apply to the bucket"
  type        = map(string)
  default     = {}
}

variable "force_destroy" {
  description = "Allow bucket deletion with objects"
  type        = bool
  default     = false
}

variable "multi_regional" {
  description = "Use multi-regional storage"
  type        = bool
  default     = false
}

variable "dual_region" {
  description = "Use dual-region storage"
  type        = bool
  default     = false
}

variable "uniform_bucket_level_access" {
  description = "Enable uniform bucket-level access"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Encryption
# -----------------------------------------------------------------------------

variable "kms_key_name" {
  description = "Cloud KMS key name for encryption"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# CORS Configuration
# -----------------------------------------------------------------------------

variable "cors_rules" {
  description = "CORS configuration"
  type = list(object({
    allowed_origins = list(string)
    allowed_methods = list(string)
    allowed_headers = list(string)
    max_age_seconds = number
  }))
  default = []
}

# -----------------------------------------------------------------------------
# Lifecycle Rules
# -----------------------------------------------------------------------------

variable "lifecycle_rules" {
  description = "Lifecycle rules for the bucket"
  type = list(object({
    age_days              = optional(number)
    created_before        = optional(string)
    with_state            = optional(string)  # LIVE, ARCHIVED, ANY
    prefix                = optional(list(string))
    matches_storage_class = optional(list(string))
    num_newer_versions    = optional(number)
    action_type           = string  # Delete, SetStorageClass
    action_storage_class  = optional(string)
  }))
  default = []
}

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------

variable "logging_bucket" {
  description = "Bucket for access logs"
  type        = string
  default     = null
}

variable "logging_prefix" {
  description = "Prefix for log objects"
  type        = string
  default     = "logs/"
}

# -----------------------------------------------------------------------------
# Retention
# -----------------------------------------------------------------------------

variable "retention_period_days" {
  description = "Retention period in days (0 to disable)"
  type        = number
  default     = 0
}

variable "retention_policy_locked" {
  description = "Lock retention policy"
  type        = bool
  default     = false
}

variable "soft_delete_retention_days" {
  description = "Soft delete retention period in days"
  type        = number
  default     = 7
}

# -----------------------------------------------------------------------------
# Website Hosting
# -----------------------------------------------------------------------------

variable "website_config" {
  description = "Static website hosting configuration"
  type = object({
    main_page_suffix = string
    not_found_page   = string
  })
  default = null
}

# -----------------------------------------------------------------------------
# IAM
# -----------------------------------------------------------------------------

variable "iam_bindings" {
  description = "IAM bindings for the bucket"
  type = list(object({
    role   = string
    member = string
  }))
  default = []
}

variable "default_object_acl" {
  description = "Default object ACL (legacy, use IAM instead)"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Notifications
# -----------------------------------------------------------------------------

variable "notification_topic" {
  description = "Pub/Sub topic for bucket notifications"
  type        = string
  default     = null
}

variable "notification_payload_format" {
  description = "Notification payload format (JSON_API_V1 or NONE)"
  type        = string
  default     = "JSON_API_V1"
}

variable "notification_event_types" {
  description = "Event types to notify"
  type        = list(string)
  default     = ["OBJECT_FINALIZE"]
}

variable "notification_object_prefix" {
  description = "Object name prefix filter for notifications"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Monitoring
# -----------------------------------------------------------------------------

variable "create_alerts" {
  description = "Create Cloud Monitoring alerts"
  type        = bool
  default     = false
}

variable "max_storage_bytes" {
  description = "Maximum storage size threshold for alerting"
  type        = number
  default     = 0
}

variable "notification_channels" {
  description = "Notification channel IDs for alerts"
  type        = list(string)
  default     = []
}
