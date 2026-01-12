# =============================================================================
# Kubernetes PostgreSQL Helm Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Required Variables
# -----------------------------------------------------------------------------

variable "namespace" {
  description = "Kubernetes namespace for PostgreSQL"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name (local, dev, staging, prod)"
  type        = string
}

# -----------------------------------------------------------------------------
# Helm Chart Configuration
# -----------------------------------------------------------------------------

variable "chart_version" {
  description = "Bitnami PostgreSQL Helm chart version"
  type        = string
  default     = "14.0.5"
}

variable "create_namespace" {
  description = "Create namespace if it doesn't exist"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# PostgreSQL Configuration
# -----------------------------------------------------------------------------

variable "engine_version" {
  description = "PostgreSQL version (15, 16, etc.)"
  type        = string
  default     = "15"
}

variable "database_name" {
  description = "Default database name"
  type        = string
  default     = "ananta"
}

variable "app_username" {
  description = "Application username"
  type        = string
  default     = "ananta_app"
}

variable "instance_size" {
  description = "Instance size: micro, small, medium, large, xlarge"
  type        = string
  default     = "small"
}

variable "storage_gb" {
  description = "Storage size in GB"
  type        = number
  default     = 10
}

variable "storage_class" {
  description = "Kubernetes storage class"
  type        = string
  default     = "local-path"
}

# -----------------------------------------------------------------------------
# High Availability
# -----------------------------------------------------------------------------

variable "high_availability" {
  description = "Enable high availability (primary + replicas)"
  type        = bool
  default     = false
}

variable "replica_count" {
  description = "Number of read replicas (if HA enabled)"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# PostgreSQL Tuning Parameters
# -----------------------------------------------------------------------------

variable "max_connections" {
  description = "Maximum number of connections"
  type        = number
  default     = 100
}

variable "shared_buffers" {
  description = "Shared buffers size"
  type        = string
  default     = "128MB"
}

variable "effective_cache_size" {
  description = "Effective cache size"
  type        = string
  default     = "512MB"
}

variable "maintenance_work_mem" {
  description = "Maintenance work memory"
  type        = string
  default     = "64MB"
}

# -----------------------------------------------------------------------------
# Additional Databases
# -----------------------------------------------------------------------------

variable "additional_databases" {
  description = "List of additional databases to create"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Service Configuration
# -----------------------------------------------------------------------------

variable "service_type" {
  description = "Kubernetes service type"
  type        = string
  default     = "ClusterIP"
}

# -----------------------------------------------------------------------------
# Monitoring
# -----------------------------------------------------------------------------

variable "enable_monitoring" {
  description = "Enable Prometheus metrics exporter"
  type        = bool
  default     = false
}

variable "create_service_monitor" {
  description = "Create ServiceMonitor for Prometheus Operator"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# Labels
# -----------------------------------------------------------------------------

variable "labels" {
  description = "Additional labels to apply to resources"
  type        = map(string)
  default     = {}
}
