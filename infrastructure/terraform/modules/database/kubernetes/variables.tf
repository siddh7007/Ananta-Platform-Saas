# =============================================================================
# Kubernetes PostgreSQL Module Variables
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

variable "engine_version" {
  description = "PostgreSQL version (e.g., '15', '14')"
  type        = string
  default     = "15"
}

variable "high_availability" {
  description = "Enable high availability (multiple replicas)"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "replica_count" {
  description = "Number of read replicas"
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
  description = "Kubernetes namespace for deployment"
  type        = string
  default     = "database"
}

variable "create_namespace" {
  description = "Create the namespace if it doesn't exist"
  type        = bool
  default     = true
}

variable "storage_class" {
  description = "Storage class for PVCs"
  type        = string
  default     = "standard"
}

variable "labels" {
  description = "Additional labels for Kubernetes resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# CloudNativePG Operator Variables
# -----------------------------------------------------------------------------

variable "install_operator" {
  description = "Install CloudNativePG operator via Helm"
  type        = bool
  default     = true
}

variable "operator_version" {
  description = "CloudNativePG operator Helm chart version"
  type        = string
  default     = "0.19.1"
}

variable "operator_namespace" {
  description = "Namespace for CloudNativePG operator"
  type        = string
  default     = "cnpg-system"
}

# -----------------------------------------------------------------------------
# Database User Variables
# -----------------------------------------------------------------------------

variable "app_username" {
  description = "Application database username"
  type        = string
  default     = "app"
}

variable "init_sql" {
  description = "SQL statements to run after database initialization"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# PostgreSQL Configuration
# -----------------------------------------------------------------------------

variable "max_connections" {
  description = "Maximum number of connections"
  type        = number
  default     = 100
}

variable "shared_buffers" {
  description = "Shared buffers configuration"
  type        = string
  default     = "256MB"
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

variable "postgresql_parameters" {
  description = "Additional PostgreSQL parameters"
  type        = map(string)
  default     = {}
}

variable "pg_hba_rules" {
  description = "pg_hba.conf rules"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Backup Configuration
# -----------------------------------------------------------------------------

variable "enable_backup" {
  description = "Enable backup to object storage"
  type        = bool
  default     = false
}

variable "backup_destination" {
  description = "S3-compatible destination path for backups"
  type        = string
  default     = ""
}

variable "backup_s3_credentials" {
  description = "S3 credentials secret reference"
  type = object({
    accessKeyId = object({
      name = string
      key  = string
    })
    secretAccessKey = object({
      name = string
      key  = string
    })
  })
  default = null
}

# -----------------------------------------------------------------------------
# Connection Pooler (PgBouncer) Variables
# -----------------------------------------------------------------------------

variable "create_pooler" {
  description = "Create PgBouncer connection pooler"
  type        = bool
  default     = false
}

variable "pooler_instances" {
  description = "Number of pooler instances"
  type        = number
  default     = 2
}

variable "pooler_mode" {
  description = "PgBouncer pool mode (session, transaction, statement)"
  type        = string
  default     = "transaction"
}

variable "pooler_max_client_conn" {
  description = "Maximum client connections to pooler"
  type        = number
  default     = 1000
}

variable "pooler_default_pool_size" {
  description = "Default pool size per user/database"
  type        = number
  default     = 20
}

# -----------------------------------------------------------------------------
# Service Configuration
# -----------------------------------------------------------------------------

variable "create_external_service" {
  description = "Create external service for database access"
  type        = bool
  default     = false
}

variable "service_type" {
  description = "Service type (ClusterIP, NodePort, LoadBalancer)"
  type        = string
  default     = "ClusterIP"
}

variable "service_annotations" {
  description = "Annotations for the external service"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Monitoring Variables
# -----------------------------------------------------------------------------

variable "enable_monitoring" {
  description = "Enable Prometheus monitoring"
  type        = bool
  default     = true
}

variable "create_prometheus_rules" {
  description = "Create PrometheusRule for alerting"
  type        = bool
  default     = true
}

variable "custom_queries_configmap" {
  description = "ConfigMap name for custom Prometheus queries"
  type        = list(object({
    name = string
    key  = string
  }))
  default = null
}

# -----------------------------------------------------------------------------
# Scheduling Variables
# -----------------------------------------------------------------------------

variable "enable_pod_antiaffinity" {
  description = "Enable pod anti-affinity for HA"
  type        = bool
  default     = true
}

variable "node_selector" {
  description = "Node selector for scheduling"
  type        = map(string)
  default     = {}
}

variable "tolerations" {
  description = "Tolerations for scheduling"
  type = list(object({
    key      = string
    operator = string
    value    = optional(string)
    effect   = string
  }))
  default = []
}
