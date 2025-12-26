# =============================================================================
# AWS Database Module Variables
# =============================================================================
# AWS-specific variables for RDS PostgreSQL
# =============================================================================

# -----------------------------------------------------------------------------
# Common Variables (from interface)
# -----------------------------------------------------------------------------

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "database_name" {
  description = "Name of the database to create"
  type        = string
}

variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15"
}

variable "instance_size" {
  description = "Normalized instance size (micro, small, medium, large, xlarge)"
  type        = string
  default     = "small"
}

variable "storage_gb" {
  description = "Storage allocation in GB"
  type        = number
  default     = 20
}

variable "max_storage_gb" {
  description = "Maximum storage for autoscaling in GB (0 to disable)"
  type        = number
  default     = 100
}

variable "high_availability" {
  description = "Enable high availability (Multi-AZ)"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 7
}

variable "create_read_replica" {
  description = "Create read replica"
  type        = bool
  default     = false
}

variable "replica_count" {
  description = "Number of read replicas"
  type        = number
  default     = 1
}

variable "enable_connection_pooling" {
  description = "Enable RDS Proxy for connection pooling"
  type        = bool
  default     = false
}

variable "max_connections_percent" {
  description = "Maximum percentage of database connections for RDS Proxy"
  type        = number
  default     = 100
}

variable "publicly_accessible" {
  description = "Allow public access"
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "encryption_enabled" {
  description = "Enable encryption at rest"
  type        = bool
  default     = true
}

variable "enable_performance_insights" {
  description = "Enable Performance Insights"
  type        = bool
  default     = true
}

variable "enable_enhanced_monitoring" {
  description = "Enable enhanced monitoring"
  type        = bool
  default     = true
}

variable "monitoring_interval_seconds" {
  description = "Enhanced monitoring interval in seconds"
  type        = number
  default     = 60
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# AWS-Specific Variables
# -----------------------------------------------------------------------------

variable "vpc_id" {
  description = "VPC ID for the database"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for the database"
  type        = list(string)
}

variable "security_group_id" {
  description = "Existing security group ID (if not creating new)"
  type        = string
  default     = null
}

variable "create_security_group" {
  description = "Create a new security group for the database"
  type        = bool
  default     = true
}

variable "allowed_security_groups" {
  description = "Security groups allowed to connect to the database"
  type        = list(string)
  default     = []
}

variable "kms_key_id" {
  description = "KMS key ID for encryption"
  type        = string
  default     = null
}

variable "credentials_secret_arn" {
  description = "Secrets Manager ARN for database credentials (required for RDS Proxy)"
  type        = string
  default     = null
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "alarm_sns_topic_arns" {
  description = "SNS topic ARNs for CloudWatch alarms"
  type        = list(string)
  default     = []
}
