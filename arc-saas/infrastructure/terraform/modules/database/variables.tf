# =============================================================================
# ARC-SaaS Database Module - Variables
# =============================================================================

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "arc-saas"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "postgres_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_name" {
  description = "Name of the database to create"
  type        = string
  default     = "arc_saas"
}

variable "db_username" {
  description = "Master database username"
  type        = string
  default     = "arc_admin"
}

variable "db_password" {
  description = "Master database password (if null, will be generated)"
  type        = string
  default     = null
  sensitive   = true
}

variable "allocated_storage" {
  description = "Initial storage allocation in GB"
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Maximum storage for autoscaling in GB"
  type        = number
  default     = 100
}

variable "storage_type" {
  description = "Storage type (gp2, gp3, io1)"
  type        = string
  default     = "gp3"
}

variable "kms_key_arn" {
  description = "KMS key ARN for storage encryption"
  type        = string
  default     = null
}

variable "db_subnet_group_name" {
  description = "Name of the DB subnet group"
  type        = string
}

variable "security_group_ids" {
  description = "List of security group IDs"
  type        = list(string)
}

variable "multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "max_connections" {
  description = "Maximum number of database connections"
  type        = string
  default     = "200"
}

variable "enable_performance_insights" {
  description = "Enable Performance Insights"
  type        = bool
  default     = true
}

variable "enhanced_monitoring_interval" {
  description = "Enhanced monitoring interval in seconds (0 to disable)"
  type        = number
  default     = 60
}

variable "enable_cloudwatch_alarms" {
  description = "Enable CloudWatch alarms"
  type        = bool
  default     = true
}

variable "alarm_sns_topic_arns" {
  description = "SNS topic ARNs for alarm notifications"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
