# =============================================================================
# GCP Cache Module Variables
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
  description = "Redis engine version (e.g., '7.0', '6.x')"
  type        = string
  default     = "7.0"
}

variable "high_availability" {
  description = "Enable high availability (STANDARD_HA tier)"
  type        = bool
  default     = false
}

variable "replica_count" {
  description = "Number of read replicas (0-5, STANDARD_HA tier only)"
  type        = number
  default     = 0

  validation {
    condition     = var.replica_count >= 0 && var.replica_count <= 5
    error_message = "replica_count must be between 0 and 5"
  }
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# GCP-Specific Variables
# -----------------------------------------------------------------------------

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Network Configuration
# -----------------------------------------------------------------------------

variable "vpc_network_id" {
  description = "VPC network ID for Memorystore"
  type        = string
}

variable "connect_mode" {
  description = "Connection mode (DIRECT_PEERING or PRIVATE_SERVICE_ACCESS)"
  type        = string
  default     = "PRIVATE_SERVICE_ACCESS"

  validation {
    condition     = contains(["DIRECT_PEERING", "PRIVATE_SERVICE_ACCESS"], var.connect_mode)
    error_message = "connect_mode must be DIRECT_PEERING or PRIVATE_SERVICE_ACCESS"
  }
}

variable "reserved_ip_range" {
  description = "Reserved IP range for Memorystore (CIDR notation)"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Redis Configuration
# -----------------------------------------------------------------------------

variable "maxmemory_policy" {
  description = "Redis maxmemory eviction policy"
  type        = string
  default     = "volatile-lru"
}

variable "notify_keyspace_events" {
  description = "Keyspace notification events"
  type        = string
  default     = ""
}

variable "redis_configs" {
  description = "Additional Redis configuration parameters"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Authentication & Encryption
# -----------------------------------------------------------------------------

variable "auth_enabled" {
  description = "Enable Redis AUTH"
  type        = bool
  default     = true
}

variable "encryption_in_transit" {
  description = "Enable TLS encryption"
  type        = bool
  default     = true
}

variable "create_secret" {
  description = "Create Secret Manager secret for auth string"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Persistence
# -----------------------------------------------------------------------------

variable "enable_persistence" {
  description = "Enable RDB persistence"
  type        = bool
  default     = false
}

variable "rdb_snapshot_period" {
  description = "RDB snapshot period (ONE_HOUR, SIX_HOURS, TWELVE_HOURS, TWENTY_FOUR_HOURS)"
  type        = string
  default     = "TWENTY_FOUR_HOURS"

  validation {
    condition     = contains(["ONE_HOUR", "SIX_HOURS", "TWELVE_HOURS", "TWENTY_FOUR_HOURS"], var.rdb_snapshot_period)
    error_message = "rdb_snapshot_period must be ONE_HOUR, SIX_HOURS, TWELVE_HOURS, or TWENTY_FOUR_HOURS"
  }
}

# -----------------------------------------------------------------------------
# Maintenance
# -----------------------------------------------------------------------------

variable "maintenance_window" {
  description = "Maintenance window configuration"
  type = object({
    day  = string  # DAY_OF_WEEK (MONDAY, TUESDAY, etc.)
    hour = number  # Hour of day (0-23)
  })
  default = null
}

# -----------------------------------------------------------------------------
# Monitoring & Alerts
# -----------------------------------------------------------------------------

variable "create_alerts" {
  description = "Create Cloud Monitoring alerts"
  type        = bool
  default     = true
}

variable "notification_channels" {
  description = "Notification channel IDs for alerts"
  type        = list(string)
  default     = []
}

variable "evictions_threshold" {
  description = "Evictions per second threshold for alerting"
  type        = number
  default     = 100
}
