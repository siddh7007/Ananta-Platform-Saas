# =============================================================================
# ARC-SaaS ECS Service - Additional Variables
# =============================================================================

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "ecr_repository_urls" {
  description = "Map of service names to ECR repository URLs"
  type        = map(string)
  default     = {}
}

variable "db_credentials_secret_arn" {
  description = "ARN of the database credentials secret"
  type        = string
  default     = ""
}

variable "redis_credentials_secret_arn" {
  description = "ARN of the Redis credentials secret"
  type        = string
  default     = ""
}

variable "app_secrets_arn" {
  description = "ARN of the application secrets"
  type        = string
  default     = ""
}
