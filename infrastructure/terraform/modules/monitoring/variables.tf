# =============================================================================
# Monitoring Module Variables
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
# SNS & Encryption
# =============================================================================

variable "enable_encryption" {
  description = "Enable KMS encryption for SNS topics"
  type        = bool
  default     = true
}

# =============================================================================
# RDS Database IDs
# =============================================================================

variable "control_plane_db_id" {
  description = "RDS instance ID for Control Plane database"
  type        = string
  default     = ""
}

variable "app_plane_db_id" {
  description = "RDS instance ID for App Plane database"
  type        = string
  default     = ""
}

variable "components_db_id" {
  description = "RDS instance ID for Components database"
  type        = string
  default     = ""
}

# =============================================================================
# ElastiCache (Redis)
# =============================================================================

variable "redis_cluster_id" {
  description = "ElastiCache cluster ID for Redis"
  type        = string
  default     = ""
}

# =============================================================================
# ECS Configuration
# =============================================================================

variable "ecs_cluster_name" {
  description = "ECS cluster name"
  type        = string
  default     = ""
}

variable "ecs_services" {
  description = "Map of ECS service names to monitor"
  type        = map(string)
  default     = {}
  # Example:
  # {
  #   "tenant-mgmt" = "tenant-management-service"
  #   "cns" = "cns-service"
  # }
}

# =============================================================================
# CloudWatch Alarm Thresholds
# =============================================================================

variable "db_cpu_threshold" {
  description = "CPU utilization threshold for RDS alarms (percentage)"
  type        = number
  default     = 80
}

variable "db_storage_threshold_bytes" {
  description = "Free storage space threshold for RDS alarms (bytes)"
  type        = number
  default     = 10737418240 # 10 GB
}

variable "db_connections_threshold" {
  description = "Database connections threshold"
  type        = number
  default     = 80
}

variable "ecs_cpu_threshold" {
  description = "CPU utilization threshold for ECS alarms (percentage)"
  type        = number
  default     = 80
}

variable "ecs_memory_threshold" {
  description = "Memory utilization threshold for ECS alarms (percentage)"
  type        = number
  default     = 85
}

# =============================================================================
# PagerDuty Integration
# =============================================================================

variable "enable_pagerduty" {
  description = "Enable PagerDuty integration for critical alerts"
  type        = bool
  default     = false
}

variable "pagerduty_integration_key" {
  description = "PagerDuty integration key (stored in environment variable)"
  type        = string
  default     = ""
  sensitive   = true
}

# =============================================================================
# Slack Integration
# =============================================================================

variable "enable_slack" {
  description = "Enable Slack integration for alerts"
  type        = bool
  default     = false
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for alert notifications"
  type        = string
  default     = ""
  sensitive   = true
}

# =============================================================================
# Email Notifications
# =============================================================================

variable "alert_email_addresses" {
  description = "List of email addresses to receive alerts"
  type        = list(string)
  default     = []
}
