# =============================================================================
# AWS Cache Module Variables
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

variable "instance_size" {
  description = "Normalized instance size (micro, small, medium, large, xlarge)"
  type        = string
  default     = "small"
}

variable "engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "high_availability" {
  description = "Enable high availability (Multi-AZ)"
  type        = bool
  default     = false
}

variable "replica_count" {
  description = "Number of read replicas (0-5)"
  type        = number
  default     = 0
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# AWS-Specific Variables
# -----------------------------------------------------------------------------

variable "vpc_id" {
  description = "VPC ID for security group"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for the cache cluster"
  type        = list(string)
}

variable "security_group_id" {
  description = "Existing security group ID (if not creating new one)"
  type        = string
  default     = ""
}

variable "create_security_group" {
  description = "Create a new security group for Redis"
  type        = bool
  default     = true
}

variable "allowed_security_groups" {
  description = "List of security groups allowed to access Redis"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Redis Configuration
# -----------------------------------------------------------------------------

variable "maxmemory_policy" {
  description = "Redis maxmemory eviction policy"
  type        = string
  default     = "volatile-lru"

  validation {
    condition = contains([
      "volatile-lru", "allkeys-lru", "volatile-lfu", "allkeys-lfu",
      "volatile-random", "allkeys-random", "volatile-ttl", "noeviction"
    ], var.maxmemory_policy)
    error_message = "Invalid maxmemory_policy value."
  }
}

variable "timeout_seconds" {
  description = "Connection timeout in seconds (0 to disable)"
  type        = number
  default     = 0
}

variable "notify_keyspace_events" {
  description = "Keyspace notification events (empty to disable)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Encryption
# -----------------------------------------------------------------------------

variable "encryption_at_rest" {
  description = "Enable encryption at rest"
  type        = bool
  default     = true
}

variable "encryption_in_transit" {
  description = "Enable encryption in transit (TLS)"
  type        = bool
  default     = true
}

variable "auth_token" {
  description = "Auth token for Redis (required if encryption_in_transit is true)"
  type        = string
  default     = null
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Maintenance & Backup
# -----------------------------------------------------------------------------

variable "maintenance_window" {
  description = "Weekly maintenance window (e.g., 'sun:05:00-sun:06:00')"
  type        = string
  default     = "sun:05:00-sun:06:00"
}

variable "snapshot_window" {
  description = "Daily snapshot window (e.g., '03:00-04:00')"
  type        = string
  default     = "03:00-04:00"
}

variable "snapshot_retention_days" {
  description = "Number of days to retain snapshots"
  type        = number
  default     = 7
}

# -----------------------------------------------------------------------------
# Monitoring & Alarms
# -----------------------------------------------------------------------------

variable "sns_topic_arn" {
  description = "SNS topic ARN for ElastiCache notifications"
  type        = string
  default     = null
}

variable "create_alarms" {
  description = "Create CloudWatch alarms"
  type        = bool
  default     = true
}

variable "alarm_actions" {
  description = "List of ARNs for alarm actions"
  type        = list(string)
  default     = []
}

variable "evictions_alarm_threshold" {
  description = "Threshold for evictions alarm"
  type        = number
  default     = 100
}
