# =============================================================================
# Cloud-Agnostic Cache Module Variables
# =============================================================================
# This module supports multiple cloud providers with a unified interface.
# Provider-specific configuration is passed via the respective *_config objects.
# =============================================================================

# -----------------------------------------------------------------------------
# Provider Selection
# -----------------------------------------------------------------------------

variable "cloud_provider" {
  description = "Cloud provider to use (aws, azure, gcp, kubernetes)"
  type        = string
  default     = ""  # Empty means use legacy AWS mode for backward compatibility

  validation {
    condition     = var.cloud_provider == "" || contains(["aws", "azure", "gcp", "kubernetes"], var.cloud_provider)
    error_message = "cloud_provider must be one of: aws, azure, gcp, kubernetes"
  }
}

# -----------------------------------------------------------------------------
# Common Interface Variables (Used by all providers)
# -----------------------------------------------------------------------------

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "instance_size" {
  description = "Normalized instance size (micro, small, medium, large, xlarge)"
  type        = string
  default     = ""

  validation {
    condition     = var.instance_size == "" || contains(["micro", "small", "medium", "large", "xlarge"], var.instance_size)
    error_message = "instance_size must be one of: micro, small, medium, large, xlarge"
  }
}

variable "engine_version" {
  description = "Redis engine version (e.g., '7.0', '6.x')"
  type        = string
  default     = "7.0"
}

variable "high_availability" {
  description = "Enable high availability (implementation varies by provider)"
  type        = bool
  default     = null  # null means derive from legacy variable
}

variable "replica_count" {
  description = "Number of read replicas (0-5)"
  type        = number
  default     = 0

  validation {
    condition     = var.replica_count >= 0 && var.replica_count <= 5
    error_message = "replica_count must be between 0 and 5"
  }
}

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

variable "tags" {
  description = "Tags/labels to apply to resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Provider-Specific Configuration Objects
# -----------------------------------------------------------------------------

variable "aws_config" {
  description = "AWS-specific configuration"
  type = object({
    vpc_id                    = optional(string)
    subnet_ids                = optional(list(string))
    security_group_id         = optional(string)
    create_security_group     = optional(bool)
    allowed_security_groups   = optional(list(string))
    maxmemory_policy          = optional(string)
    timeout_seconds           = optional(number)
    notify_keyspace_events    = optional(string)
    encryption_at_rest        = optional(bool)
    encryption_in_transit     = optional(bool)
    auth_token                = optional(string)
    maintenance_window        = optional(string)
    snapshot_window           = optional(string)
    snapshot_retention_days   = optional(number)
    sns_topic_arn             = optional(string)
    create_alarms             = optional(bool)
    alarm_actions             = optional(list(string))
    evictions_alarm_threshold = optional(number)
  })
  default = null
}

variable "azure_config" {
  description = "Azure-specific configuration"
  type = object({
    resource_group_name              = optional(string)
    create_resource_group            = optional(bool)
    location                         = optional(string)
    public_network_access            = optional(bool)
    subnet_id                        = optional(string)
    enable_private_endpoint          = optional(bool)
    private_endpoint_subnet_id       = optional(string)
    private_dns_zone_id              = optional(string)
    allowed_ip_ranges                = optional(list(string))
    maxmemory_policy                 = optional(string)
    maxmemory_reserved_mb            = optional(number)
    maxfragmentationmemory_reserved_mb = optional(number)
    notify_keyspace_events           = optional(string)
    encryption_in_transit            = optional(bool)
    shard_count                      = optional(number)
    availability_zones               = optional(list(string))
    enable_aof_backup                = optional(bool)
    enable_rdb_backup                = optional(bool)
    rdb_backup_frequency             = optional(number)
    rdb_backup_max_snapshot_count    = optional(number)
    backup_storage_connection_string = optional(string)
    log_analytics_workspace_id       = optional(string)
    create_alerts                    = optional(bool)
    alert_action_group_ids           = optional(list(string))
    cache_miss_rate_threshold        = optional(number)
  })
  default = null
}

variable "gcp_config" {
  description = "GCP-specific configuration"
  type = object({
    project_id             = optional(string)
    region                 = optional(string)
    labels                 = optional(map(string))
    vpc_network_id         = optional(string)
    connect_mode           = optional(string)
    reserved_ip_range      = optional(string)
    maxmemory_policy       = optional(string)
    notify_keyspace_events = optional(string)
    redis_configs          = optional(map(string))
    auth_enabled           = optional(bool)
    encryption_in_transit  = optional(bool)
    create_secret          = optional(bool)
    enable_persistence     = optional(bool)
    rdb_snapshot_period    = optional(string)
    maintenance_window     = optional(object({
      day  = string
      hour = number
    }))
    create_alerts          = optional(bool)
    notification_channels  = optional(list(string))
    evictions_threshold    = optional(number)
  })
  default = null
}

variable "kubernetes_config" {
  description = "Kubernetes-specific configuration"
  type = object({
    namespace              = optional(string)
    create_namespace       = optional(bool)
    labels                 = optional(map(string))
    install_operator       = optional(bool)
    operator_version       = optional(string)
    operator_namespace     = optional(string)
    redis_image            = optional(string)
    maxmemory_policy       = optional(string)
    notify_keyspace_events = optional(string)
    timeout_seconds        = optional(number)
    redis_custom_config    = optional(list(string))
    sentinel_config        = optional(list(string))
    persistence_enabled    = optional(bool)
    storage_class          = optional(string)
    storage_gb             = optional(number)
    service_type           = optional(string)
    service_annotations    = optional(map(string))
    enable_monitoring      = optional(bool)
    exporter_image         = optional(string)
    create_service_monitor = optional(bool)
    create_prometheus_rules = optional(bool)
    evictions_threshold    = optional(number)
  })
  default = null
}

# =============================================================================
# Legacy AWS Variables (for backward compatibility)
# =============================================================================
# These variables are retained to support existing AWS-only configurations.
# For new deployments, use cloud_provider="aws" with aws_config object.
# =============================================================================

variable "vpc_id" {
  description = "[Legacy] VPC ID for security group"
  type        = string
  default     = ""
}

variable "subnet_ids" {
  description = "[Legacy] List of subnet IDs"
  type        = list(string)
  default     = []
}

variable "security_group_id" {
  description = "[Legacy] Existing security group ID"
  type        = string
  default     = ""
}

variable "allowed_security_groups" {
  description = "[Legacy] Security groups allowed to access Redis"
  type        = list(string)
  default     = []
}

variable "node_type" {
  description = "[Legacy] ElastiCache node type (use instance_size instead)"
  type        = string
  default     = "cache.t3.small"
}

variable "automatic_failover_enabled" {
  description = "[Legacy] Enable automatic failover (use high_availability instead)"
  type        = bool
  default     = false
}

variable "at_rest_encryption_enabled" {
  description = "[Legacy] Enable encryption at rest"
  type        = bool
  default     = true
}

variable "transit_encryption_enabled" {
  description = "[Legacy] Enable encryption in transit"
  type        = bool
  default     = true
}

variable "auth_token" {
  description = "[Legacy] Redis AUTH token"
  type        = string
  default     = null
  sensitive   = true
}

variable "maintenance_window" {
  description = "[Legacy] Maintenance window"
  type        = string
  default     = "sun:05:00-sun:06:00"
}

variable "snapshot_window" {
  description = "[Legacy] Snapshot window"
  type        = string
  default     = "03:00-04:00"
}

variable "snapshot_retention_limit" {
  description = "[Legacy] Snapshot retention limit in days"
  type        = number
  default     = 7
}

variable "alarm_actions" {
  description = "[Legacy] List of ARNs for alarm actions"
  type        = list(string)
  default     = []
}
