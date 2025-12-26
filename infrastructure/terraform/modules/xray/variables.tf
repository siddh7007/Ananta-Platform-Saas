# =============================================================================
# X-Ray Module Variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}

# =============================================================================
# Sampling Configuration
# =============================================================================

variable "default_sampling_rate" {
  description = "Default sampling rate for traces (0.0 to 1.0)"
  type        = number
  default     = 0.1 # 10% sampling
  validation {
    condition     = var.default_sampling_rate >= 0 && var.default_sampling_rate <= 1
    error_message = "Sampling rate must be between 0.0 and 1.0"
  }
}

variable "default_reservoir_size" {
  description = "Number of traces per second to sample before applying fixed_rate"
  type        = number
  default     = 1
}

# =============================================================================
# Encryption
# =============================================================================

variable "enable_kms_encryption" {
  description = "Enable KMS encryption for X-Ray traces"
  type        = bool
  default     = true
}

variable "kms_key_id" {
  description = "KMS key ID for X-Ray encryption (leave empty to create new key)"
  type        = string
  default     = ""
}

# =============================================================================
# X-Ray Insights
# =============================================================================

variable "enable_insights" {
  description = "Enable X-Ray Insights for anomaly detection"
  type        = bool
  default     = true
}

variable "enable_insights_notifications" {
  description = "Enable notifications for X-Ray Insights events"
  type        = bool
  default     = false
}

# =============================================================================
# Alarms
# =============================================================================

variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN for X-Ray alarms (leave empty to disable alarms)"
  type        = string
  default     = ""
}

variable "error_rate_threshold" {
  description = "Error rate threshold for alarms (percentage)"
  type        = number
  default     = 5.0
}

variable "latency_threshold_ms" {
  description = "Latency threshold for alarms (milliseconds)"
  type        = number
  default     = 1000
}
