# =============================================================================
# Cloud-Agnostic Database Module Variables
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

variable "database_name" {
  description = "Name of the database to create"
  type        = string
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

variable "storage_gb" {
  description = "Allocated storage in GB"
  type        = number
  default     = 0  # 0 means use allocated_storage for backward compatibility
}

variable "engine_version" {
  description = "PostgreSQL engine version (e.g., '15', '14', '13')"
  type        = string
  default     = "15"
}

variable "high_availability" {
  description = "Enable high availability (implementation varies by provider)"
  type        = bool
  default     = null  # null means derive from legacy multi_az variable
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
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
    vpc_id                      = optional(string)
    subnet_ids                  = optional(list(string))
    security_group_id           = optional(string)
    create_security_group       = optional(bool)
    allowed_security_groups     = optional(list(string))
    publicly_accessible         = optional(bool)
    max_storage_gb              = optional(number)
    encryption_enabled          = optional(bool)
    kms_key_id                  = optional(string)
    deletion_protection         = optional(bool)
    create_read_replica         = optional(bool)
    enable_connection_pooling   = optional(bool)
    credentials_secret_arn      = optional(string)
    max_connections_percent     = optional(number)
    enable_performance_insights = optional(bool)
    enable_enhanced_monitoring  = optional(bool)
    monitoring_interval_seconds = optional(number)
    alarm_sns_topic_arns        = optional(list(string))
    aws_region                  = optional(string)
  })
  default = null
}

variable "azure_config" {
  description = "Azure-specific configuration"
  type = object({
    resource_group_name        = optional(string)
    location                   = optional(string)
    create_resource_group      = optional(bool)
    delegated_subnet_id        = optional(string)
    private_dns_zone_id        = optional(string)
    geo_redundant_backup       = optional(bool)
    maintenance_window         = optional(object({
      day_of_week  = number
      start_hour   = number
      start_minute = number
    }))
    enable_threat_detection    = optional(bool)
    log_analytics_workspace_id = optional(string)
  })
  default = null
}

variable "gcp_config" {
  description = "GCP-specific configuration"
  type = object({
    project_id             = optional(string)
    region                 = optional(string)
    zone                   = optional(string)
    vpc_network_id         = optional(string)
    private_network        = optional(string)
    disk_type              = optional(string)
    authorized_networks    = optional(list(object({
      name  = string
      value = string
    })))
    deletion_protection    = optional(bool)
    create_secret          = optional(bool)
    query_insights_enabled = optional(bool)
    notification_channels  = optional(list(string))
    labels                 = optional(map(string))
  })
  default = null
}

variable "kubernetes_config" {
  description = "Kubernetes-specific configuration (CloudNativePG)"
  type = object({
    namespace              = optional(string)
    create_namespace       = optional(bool)
    storage_class          = optional(string)
    labels                 = optional(map(string))
    install_operator       = optional(bool)
    operator_version       = optional(string)
    operator_namespace     = optional(string)
    app_username           = optional(string)
    init_sql               = optional(list(string))
    max_connections        = optional(number)
    shared_buffers         = optional(string)
    effective_cache_size   = optional(string)
    maintenance_work_mem   = optional(string)
    postgresql_parameters  = optional(map(string))
    pg_hba_rules           = optional(list(string))
    enable_backup          = optional(bool)
    backup_destination     = optional(string)
    backup_s3_credentials  = optional(object({
      accessKeyId = object({
        name = string
        key  = string
      })
      secretAccessKey = object({
        name = string
        key  = string
      })
    }))
    create_pooler            = optional(bool)
    pooler_instances         = optional(number)
    pooler_mode              = optional(string)
    pooler_max_client_conn   = optional(number)
    pooler_default_pool_size = optional(number)
    create_external_service  = optional(bool)
    service_type             = optional(string)
    service_annotations      = optional(map(string))
    enable_monitoring        = optional(bool)
    create_prometheus_rules  = optional(bool)
    enable_pod_antiaffinity  = optional(bool)
    node_selector            = optional(map(string))
    tolerations              = optional(list(object({
      key      = string
      operator = string
      value    = optional(string)
      effect   = string
    })))
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
  description = "[Legacy] VPC ID where the database will be deployed"
  type        = string
  default     = ""
}

variable "database_subnet_ids" {
  description = "[Legacy] List of database subnet IDs"
  type        = list(string)
  default     = []
}

variable "security_group_id" {
  description = "[Legacy] Security group ID for the database"
  type        = string
  default     = ""
}

variable "instance_class" {
  description = "[Legacy] RDS instance class (use instance_size instead)"
  type        = string
  default     = "db.t3.medium"
}

variable "allocated_storage" {
  description = "[Legacy] Allocated storage in GB (use storage_gb instead)"
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "[Legacy] Maximum storage autoscaling limit in GB"
  type        = number
  default     = 100
}

variable "multi_az" {
  description = "[Legacy] Enable Multi-AZ deployment (use high_availability instead)"
  type        = bool
  default     = false
}

variable "backup_retention_period" {
  description = "[Legacy] Alias for backup_retention_days"
  type        = number
  default     = 7
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "skip_final_snapshot" {
  description = "[Legacy] Skip final snapshot when deleting (AWS-specific)"
  type        = bool
  default     = false
}

variable "alarm_sns_topic_arns" {
  description = "[Legacy] List of SNS topic ARNs for CloudWatch alarms"
  type        = list(string)
  default     = []
}

variable "kms_key_id" {
  description = "[Legacy] KMS key ID for database encryption"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Legacy Read Replica Configuration
# -----------------------------------------------------------------------------

variable "create_read_replica" {
  description = "[Legacy] Enable read replica creation"
  type        = bool
  default     = false
}

variable "replica_instance_class" {
  description = "[Legacy] RDS instance class for read replicas"
  type        = string
  default     = null
}

variable "performance_insights_enabled" {
  description = "[Legacy] Enable Performance Insights"
  type        = bool
  default     = true
}

variable "performance_insights_retention_period" {
  description = "[Legacy] Performance Insights retention period in days"
  type        = number
  default     = 7
}

variable "monitoring_interval" {
  description = "[Legacy] Enhanced monitoring interval in seconds"
  type        = number
  default     = 60

  validation {
    condition     = contains([0, 1, 5, 10, 15, 30, 60], var.monitoring_interval)
    error_message = "monitoring_interval must be 0, 1, 5, 10, 15, 30, or 60"
  }
}

# -----------------------------------------------------------------------------
# Legacy RDS Proxy Configuration
# -----------------------------------------------------------------------------

variable "create_rds_proxy" {
  description = "[Legacy] Enable RDS Proxy for connection pooling"
  type        = bool
  default     = false
}

variable "db_credentials_secret_arn" {
  description = "[Legacy] ARN of the Secrets Manager secret"
  type        = string
  default     = null
}

variable "proxy_idle_client_timeout" {
  description = "[Legacy] RDS Proxy idle client timeout"
  type        = number
  default     = 1800
}

variable "proxy_max_connections_percent" {
  description = "[Legacy] Maximum connections percent for RDS Proxy"
  type        = number
  default     = 100
}

variable "proxy_max_idle_connections_percent" {
  description = "[Legacy] Maximum idle connections percent"
  type        = number
  default     = 50
}

variable "proxy_require_tls" {
  description = "[Legacy] Require TLS for RDS Proxy connections"
  type        = bool
  default     = true
}

variable "aws_region" {
  description = "[Legacy] AWS region for IAM policy conditions"
  type        = string
  default     = "us-east-1"
}
