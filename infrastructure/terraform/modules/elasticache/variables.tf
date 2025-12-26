# =============================================================================
# ElastiCache Module Variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for the Redis cluster"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for the Redis cluster"
  type        = list(string)
}

variable "redis_security_group_id" {
  description = "Security group ID for Redis cluster (from security-groups module)"
  type        = string
}

# -----------------------------------------------------------------------------
# Redis Configuration
# -----------------------------------------------------------------------------

variable "node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "num_cache_nodes" {
  description = "Number of cache nodes in the cluster"
  type        = number
  default     = 1
}

variable "engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "parameter_group_family" {
  description = "Redis parameter group family"
  type        = string
  default     = "redis7"
}

variable "automatic_failover_enabled" {
  description = "Enable automatic failover for Multi-AZ"
  type        = bool
  default     = false
}

variable "multi_az_enabled" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = false
}

variable "transit_encryption_enabled" {
  description = "Enable in-transit encryption (TLS)"
  type        = bool
  default     = true
}

variable "auth_token" {
  description = "Auth token for Redis (required if transit encryption enabled)"
  type        = string
  default     = null
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Maintenance Configuration
# -----------------------------------------------------------------------------

variable "maintenance_window" {
  description = "Weekly time range for maintenance (UTC)"
  type        = string
  default     = "sun:05:00-sun:06:00"
}

variable "snapshot_window" {
  description = "Daily time range for snapshots (UTC)"
  type        = string
  default     = "03:00-04:00"
}

variable "snapshot_retention_limit" {
  description = "Number of days to retain snapshots"
  type        = number
  default     = 7
}

# -----------------------------------------------------------------------------
# Monitoring Configuration
# -----------------------------------------------------------------------------

variable "create_cloudwatch_alarms" {
  description = "Create CloudWatch alarms for the cluster"
  type        = bool
  default     = true
}

variable "create_cloudwatch_dashboard" {
  description = "Create CloudWatch dashboard for the cluster"
  type        = bool
  default     = false
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for notifications"
  type        = string
  default     = null
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

variable "max_connections_alarm_threshold" {
  description = "Threshold for max connections alarm"
  type        = number
  default     = 1000
}

# -----------------------------------------------------------------------------
# Tags
# -----------------------------------------------------------------------------

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
