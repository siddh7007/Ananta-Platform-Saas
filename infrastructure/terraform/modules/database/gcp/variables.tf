# =============================================================================
# GCP Cloud SQL Module Variables
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
  default     = "postgres"
}

variable "instance_size" {
  description = "Normalized instance size (micro, small, medium, large, xlarge)"
  type        = string
  default     = "small"
}

variable "storage_gb" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
}

variable "max_storage_gb" {
  description = "Maximum storage for auto-resize in GB"
  type        = number
  default     = 100
}

variable "engine_version" {
  description = "PostgreSQL version (e.g., '15', '14')"
  type        = string
  default     = "15"
}

variable "high_availability" {
  description = "Enable high availability (regional)"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Number of backup copies to retain"
  type        = number
  default     = 7
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "create_read_replica" {
  description = "Create read replicas"
  type        = bool
  default     = false
}

variable "replica_count" {
  description = "Number of read replicas"
  type        = number
  default     = 1
}

variable "replica_instance_size" {
  description = "Instance size for read replicas"
  type        = string
  default     = "small"
}

variable "master_username" {
  description = "Master database username"
  type        = string
  default     = "postgres"
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
}

variable "vpc_network_id" {
  description = "VPC network self_link for private IP"
  type        = string
}

variable "disk_type" {
  description = "Disk type (PD_SSD or PD_HDD)"
  type        = string
  default     = "PD_SSD"
}

variable "backup_start_time" {
  description = "Start time for backups (HH:MM format, UTC)"
  type        = string
  default     = "03:00"
}

variable "maintenance_window_day" {
  description = "Day of week for maintenance (1=Monday, 7=Sunday)"
  type        = number
  default     = 7
}

variable "maintenance_window_hour" {
  description = "Hour for maintenance window (0-23)"
  type        = number
  default     = 4
}

variable "authorized_networks" {
  description = "Authorized networks for database access"
  type = list(object({
    name = string
    cidr = string
  }))
  default = []
}

variable "database_flags" {
  description = "Additional database flags"
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}

variable "labels" {
  description = "Labels to apply to GCP resources"
  type        = map(string)
  default     = {}
}

variable "create_secret" {
  description = "Create Secret Manager secret for credentials"
  type        = bool
  default     = true
}

variable "create_monitoring_alerts" {
  description = "Create Cloud Monitoring alert policies"
  type        = bool
  default     = true
}

variable "notification_channels" {
  description = "Notification channels for alerts"
  type        = list(string)
  default     = []
}

variable "max_connections" {
  description = "Maximum number of connections (for alerting threshold)"
  type        = number
  default     = 100
}
