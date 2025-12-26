# =============================================================================
# Kubernetes Cache Module Variables
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
  description = "Redis version (used for image tag)"
  type        = string
  default     = "7.0"
}

variable "high_availability" {
  description = "Enable high availability (Redis Failover with Sentinel)"
  type        = bool
  default     = false
}

variable "replica_count" {
  description = "Number of Redis replicas (in addition to primary)"
  type        = number
  default     = 1
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Kubernetes-Specific Variables
# -----------------------------------------------------------------------------

variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
  default     = "redis"
}

variable "create_namespace" {
  description = "Create the namespace"
  type        = bool
  default     = true
}

variable "labels" {
  description = "Additional labels for resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Operator Configuration
# -----------------------------------------------------------------------------

variable "install_operator" {
  description = "Install Redis Operator via Helm"
  type        = bool
  default     = true
}

variable "operator_version" {
  description = "Redis Operator Helm chart version"
  type        = string
  default     = "3.2.9"
}

variable "operator_namespace" {
  description = "Namespace for Redis Operator"
  type        = string
  default     = "redis-operator"
}

# -----------------------------------------------------------------------------
# Redis Configuration
# -----------------------------------------------------------------------------

variable "redis_image" {
  description = "Redis container image"
  type        = string
  default     = "redis:7.0-alpine"
}

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

variable "timeout_seconds" {
  description = "Connection timeout in seconds"
  type        = number
  default     = 0
}

variable "redis_custom_config" {
  description = "Additional Redis configuration lines"
  type        = list(string)
  default     = []
}

variable "sentinel_config" {
  description = "Sentinel configuration (HA mode)"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Storage Configuration
# -----------------------------------------------------------------------------

variable "persistence_enabled" {
  description = "Enable persistent storage"
  type        = bool
  default     = true
}

variable "storage_class" {
  description = "Storage class for PVCs"
  type        = string
  default     = "standard"
}

variable "storage_gb" {
  description = "Storage size in GB"
  type        = number
  default     = 10
}

# -----------------------------------------------------------------------------
# Service Configuration
# -----------------------------------------------------------------------------

variable "service_type" {
  description = "Kubernetes service type"
  type        = string
  default     = "ClusterIP"
}

variable "service_annotations" {
  description = "Annotations for the service"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Monitoring Configuration
# -----------------------------------------------------------------------------

variable "enable_monitoring" {
  description = "Enable Prometheus monitoring"
  type        = bool
  default     = true
}

variable "exporter_image" {
  description = "Redis exporter image"
  type        = string
  default     = "oliver006/redis_exporter:v1.55.0"
}

variable "create_service_monitor" {
  description = "Create ServiceMonitor for Prometheus Operator"
  type        = bool
  default     = true
}

variable "create_prometheus_rules" {
  description = "Create PrometheusRule for alerting"
  type        = bool
  default     = true
}

variable "evictions_threshold" {
  description = "Evictions per second threshold for alerting"
  type        = number
  default     = 100
}
