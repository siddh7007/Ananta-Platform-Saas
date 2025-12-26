# =============================================================================
# Azure Cache Module Variables
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
  default     = "6"
}

variable "high_availability" {
  description = "Enable high availability (zone redundancy)"
  type        = bool
  default     = false
}

variable "replica_count" {
  description = "Number of replicas per primary (Premium tier only, 1-3)"
  type        = number
  default     = 1

  validation {
    condition     = var.replica_count >= 0 && var.replica_count <= 3
    error_message = "replica_count must be between 0 and 3"
  }
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Azure-Specific Variables
# -----------------------------------------------------------------------------

variable "resource_group_name" {
  description = "Existing resource group name"
  type        = string
  default     = ""
}

variable "create_resource_group" {
  description = "Create a new resource group"
  type        = bool
  default     = false
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus"
}

# -----------------------------------------------------------------------------
# Network Configuration
# -----------------------------------------------------------------------------

variable "public_network_access" {
  description = "Enable public network access"
  type        = bool
  default     = false
}

variable "subnet_id" {
  description = "Subnet ID for Premium tier VNet injection"
  type        = string
  default     = null
}

variable "enable_private_endpoint" {
  description = "Create private endpoint for Redis"
  type        = bool
  default     = false
}

variable "private_endpoint_subnet_id" {
  description = "Subnet ID for private endpoint"
  type        = string
  default     = null
}

variable "private_dns_zone_id" {
  description = "Private DNS zone ID for Redis"
  type        = string
  default     = null
}

variable "allowed_ip_ranges" {
  description = "List of allowed IP ranges (for public access)"
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
}

variable "maxmemory_reserved_mb" {
  description = "Memory reserved for non-cache operations (MB)"
  type        = number
  default     = 50
}

variable "maxfragmentationmemory_reserved_mb" {
  description = "Memory reserved for fragmentation (MB)"
  type        = number
  default     = 50
}

variable "notify_keyspace_events" {
  description = "Keyspace notification events"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Encryption
# -----------------------------------------------------------------------------

variable "encryption_in_transit" {
  description = "Enable TLS (disable non-SSL port)"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Clustering & HA (Premium tier)
# -----------------------------------------------------------------------------

variable "shard_count" {
  description = "Number of shards for clustering (Premium tier only)"
  type        = number
  default     = 1
}

variable "availability_zones" {
  description = "Availability zones for zone redundancy (Premium tier)"
  type        = list(string)
  default     = ["1", "2", "3"]
}

# -----------------------------------------------------------------------------
# Backup Configuration (Premium tier)
# -----------------------------------------------------------------------------

variable "enable_aof_backup" {
  description = "Enable AOF persistence (Premium tier only)"
  type        = bool
  default     = false
}

variable "enable_rdb_backup" {
  description = "Enable RDB backup (Premium tier only)"
  type        = bool
  default     = false
}

variable "rdb_backup_frequency" {
  description = "RDB backup frequency in minutes (15, 30, 60, 360, 720, 1440)"
  type        = number
  default     = 60
}

variable "rdb_backup_max_snapshot_count" {
  description = "Maximum number of RDB snapshots"
  type        = number
  default     = 1
}

variable "backup_storage_connection_string" {
  description = "Storage account connection string for RDB backups"
  type        = string
  default     = null
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Monitoring & Alerts
# -----------------------------------------------------------------------------

variable "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID for diagnostics"
  type        = string
  default     = null
}

variable "create_alerts" {
  description = "Create Azure Monitor alerts"
  type        = bool
  default     = true
}

variable "alert_action_group_ids" {
  description = "Action group IDs for alerts"
  type        = list(string)
  default     = []
}

variable "cache_miss_rate_threshold" {
  description = "Cache miss rate threshold for alerting (%)"
  type        = number
  default     = 50
}
