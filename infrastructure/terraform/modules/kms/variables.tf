# =============================================================================
# KMS Module Variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "deletion_window_days" {
  description = "Number of days before a KMS key is deleted after destruction"
  type        = number
  default     = 30
  validation {
    condition     = var.deletion_window_days >= 7 && var.deletion_window_days <= 30
    error_message = "Deletion window must be between 7 and 30 days."
  }
}

variable "multi_region" {
  description = "Whether the KMS key is a multi-region key"
  type        = bool
  default     = false
}

variable "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role (for Secrets Manager decryption)"
  type        = string
}

variable "cloudtrail_bucket_name" {
  description = "Name of the CloudTrail S3 bucket for KMS policy"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
