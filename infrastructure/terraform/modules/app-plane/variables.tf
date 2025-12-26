# =============================================================================
# App Plane Module Variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "aws_account_id" {
  description = "AWS account ID (used for globally unique bucket names)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  type        = string
}

# -----------------------------------------------------------------------------
# Amazon MQ (RabbitMQ) Configuration
# -----------------------------------------------------------------------------

variable "mq_instance_type" {
  description = "Amazon MQ broker instance type"
  type        = string
  default     = "mq.t3.micro"
}

variable "mq_engine_version" {
  description = "RabbitMQ engine version"
  type        = string
  default     = "3.11.20"
}

variable "mq_deployment_mode" {
  description = "Deployment mode (SINGLE_INSTANCE or CLUSTER_MULTI_AZ)"
  type        = string
  default     = "SINGLE_INSTANCE"
}

variable "use_sqs_instead_of_rabbitmq" {
  description = "Use SQS instead of Amazon MQ RabbitMQ"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# S3 Configuration
# -----------------------------------------------------------------------------

variable "s3_bucket_prefix" {
  description = "Prefix for S3 bucket names"
  type        = string
  default     = "ananta"
}

variable "enable_s3_versioning" {
  description = "Enable versioning on S3 buckets"
  type        = bool
  default     = true
}

variable "s3_lifecycle_days" {
  description = "Days before transitioning objects to cheaper storage"
  type        = number
  default     = 90
}

variable "cors_allowed_origins" {
  description = "List of allowed origins for CORS"
  type        = list(string)
  default     = ["*"]
}

variable "enable_cloudfront" {
  description = "Enable CloudFront distribution for assets"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# Logging Configuration
# -----------------------------------------------------------------------------

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

# -----------------------------------------------------------------------------
# Monitoring Configuration
# -----------------------------------------------------------------------------

variable "create_cloudwatch_alarms" {
  description = "Create CloudWatch alarms"
  type        = bool
  default     = true
}

variable "alarm_actions" {
  description = "List of actions for alarm state"
  type        = list(string)
  default     = []
}

variable "ok_actions" {
  description = "List of actions for OK state"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Security Configuration
# -----------------------------------------------------------------------------

variable "kms_key_id_s3" {
  description = "KMS key ID for S3 bucket encryption"
  type        = string
  default     = null
}

variable "kms_key_id_mq" {
  description = "KMS key ID for Amazon MQ encryption"
  type        = string
  default     = null
}

variable "cloudwatch_kms_key_id" {
  description = "KMS key ID for CloudWatch Logs encryption"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Tags
# -----------------------------------------------------------------------------

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
