# =============================================================================
# Database Module - Cloud-Agnostic Interface
# =============================================================================
# This file defines the unified interface for PostgreSQL databases across:
# - AWS (RDS PostgreSQL)
# - Azure (Azure Database for PostgreSQL Flexible Server)
# - GCP (Cloud SQL for PostgreSQL)
# - Kubernetes (CloudNativePG Operator)
# =============================================================================

# -----------------------------------------------------------------------------
# Common Variables (Cloud-Agnostic)
# -----------------------------------------------------------------------------

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
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

# -----------------------------------------------------------------------------
# Normalized Instance Sizing
# -----------------------------------------------------------------------------

variable "instance_size" {
  description = "Normalized instance size (micro, small, medium, large, xlarge)"
  type        = string
  default     = "small"
  validation {
    condition     = contains(["micro", "small", "medium", "large", "xlarge"], var.instance_size)
    error_message = "Instance size must be one of: micro, small, medium, large, xlarge."
  }
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

# -----------------------------------------------------------------------------
# High Availability Configuration
# -----------------------------------------------------------------------------

variable "high_availability" {
  description = "Enable high availability (multi-zone deployment)"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 7
}

variable "create_read_replica" {
  description = "Create read replica for read scaling"
  type        = bool
  default     = false
}

variable "replica_count" {
  description = "Number of read replicas to create"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# Connection Pooling
# -----------------------------------------------------------------------------

variable "enable_connection_pooling" {
  description = "Enable connection pooling (RDS Proxy, PgBouncer, etc.)"
  type        = bool
  default     = false
}

variable "max_connections_percent" {
  description = "Maximum percentage of database connections for pooler"
  type        = number
  default     = 100
}

# -----------------------------------------------------------------------------
# Security Configuration
# -----------------------------------------------------------------------------

variable "publicly_accessible" {
  description = "Allow public access to the database"
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

# -----------------------------------------------------------------------------
# Monitoring Configuration
# -----------------------------------------------------------------------------

variable "enable_performance_insights" {
  description = "Enable performance insights/monitoring"
  type        = bool
  default     = true
}

variable "enable_enhanced_monitoring" {
  description = "Enable enhanced monitoring (detailed metrics)"
  type        = bool
  default     = true
}

variable "monitoring_interval_seconds" {
  description = "Enhanced monitoring interval in seconds"
  type        = number
  default     = 60
}

# -----------------------------------------------------------------------------
# Tags
# -----------------------------------------------------------------------------

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Provider-Specific Configuration (Passthrough)
# -----------------------------------------------------------------------------

variable "provider_config" {
  description = "Provider-specific configuration options"
  type        = any
  default     = {}
}

# =============================================================================
# Common Outputs (Must be implemented by each provider module)
# =============================================================================

# These outputs are defined in the provider-specific modules and aggregated
# by the main module wrapper. Each provider must implement:
#
# - endpoint          : Primary database connection endpoint (host:port)
# - address           : Database hostname only (without port)
# - port              : Database port number
# - database_name     : Name of the created database
# - username          : Master username
# - password          : Master password (sensitive)
# - connection_string : Full connection string (sensitive)
# - replica_endpoints : List of read replica endpoints (if any)
# - pooler_endpoint   : Connection pooler endpoint (if enabled)
# - resource_id       : Cloud-specific resource identifier
# - resource_arn      : Cloud-specific resource ARN/ID
