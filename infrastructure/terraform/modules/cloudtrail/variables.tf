# =============================================================================
# CloudTrail Module Variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "bucket_prefix" {
  description = "Prefix for S3 bucket name"
  type        = string
}

variable "kms_key_id" {
  description = "KMS key ID for S3 bucket encryption"
  type        = string
}

variable "cloudwatch_kms_key_id" {
  description = "KMS key ID for CloudWatch Logs encryption"
  type        = string
}

variable "is_multi_region_trail" {
  description = "Whether the trail is multi-region (recommended for production)"
  type        = bool
  default     = false
}

variable "enable_data_events" {
  description = "Enable data event logging for S3"
  type        = bool
  default     = false
}

variable "s3_bucket_arns" {
  description = "List of S3 bucket ARNs to log data events for"
  type        = list(string)
  default     = []
}

variable "enable_insights" {
  description = "Enable CloudTrail Insights for anomaly detection"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "Number of days to retain logs in S3 before deletion"
  type        = number
  default     = 2555  # 7 years for compliance
}

variable "log_archive_days" {
  description = "Number of days before moving logs to Glacier"
  type        = number
  default     = 90
}

variable "cloudwatch_log_retention_days" {
  description = "Number of days to retain logs in CloudWatch"
  type        = number
  default     = 90
}

variable "enable_sns_notifications" {
  description = "Enable SNS notifications for CloudTrail events"
  type        = bool
  default     = false
}

variable "notification_email" {
  description = "Email address for CloudTrail notifications"
  type        = string
  default     = ""
}

variable "create_metric_filters" {
  description = "Create CloudWatch metric filters and alarms for security events"
  type        = bool
  default     = true
}

variable "alarm_sns_topic_arns" {
  description = "List of SNS topic ARNs for CloudWatch alarms"
  type        = list(string)
  default     = null
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
