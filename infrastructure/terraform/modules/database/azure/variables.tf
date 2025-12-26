# =============================================================================
# Azure Database Module Variables
# =============================================================================

# Common interface variables
variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "database_name" {
  description = "Name of the database to create"
  type        = string
}

variable "engine_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15"
}

variable "instance_size" {
  description = "Normalized instance size"
  type        = string
  default     = "small"
}

variable "storage_gb" {
  description = "Storage allocation in GB"
  type        = number
  default     = 32
}

variable "max_storage_gb" {
  description = "Maximum storage in GB"
  type        = number
  default     = 128
}

variable "high_availability" {
  description = "Enable high availability"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Backup retention period"
  type        = number
  default     = 7
}

variable "create_read_replica" {
  description = "Create read replica"
  type        = bool
  default     = false
}

variable "replica_count" {
  description = "Number of read replicas"
  type        = number
  default     = 1
}

variable "enable_connection_pooling" {
  description = "Enable connection pooling (via PgBouncer)"
  type        = bool
  default     = false
}

variable "max_connections_percent" {
  description = "Max connections percentage"
  type        = number
  default     = 100
}

variable "publicly_accessible" {
  description = "Allow public access"
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "encryption_enabled" {
  description = "Enable encryption"
  type        = bool
  default     = true
}

variable "enable_performance_insights" {
  description = "Enable performance insights"
  type        = bool
  default     = true
}

variable "enable_enhanced_monitoring" {
  description = "Enable enhanced monitoring"
  type        = bool
  default     = true
}

variable "monitoring_interval_seconds" {
  description = "Monitoring interval"
  type        = number
  default     = 60
}

variable "tags" {
  description = "Tags"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Azure-Specific Variables
# -----------------------------------------------------------------------------

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus"
}

variable "resource_group_name" {
  description = "Existing resource group name"
  type        = string
  default     = ""
}

variable "create_resource_group" {
  description = "Create a new resource group"
  type        = bool
  default     = true
}

variable "virtual_network_id" {
  description = "Virtual network ID for private access"
  type        = string
}

variable "subnet_id" {
  description = "Subnet ID for the database"
  type        = string
}

variable "private_dns_zone_id" {
  description = "Existing private DNS zone ID"
  type        = string
  default     = null
}

variable "create_private_dns_zone" {
  description = "Create a new private DNS zone"
  type        = bool
  default     = true
}

variable "standby_availability_zone" {
  description = "Availability zone for HA standby"
  type        = string
  default     = "2"
}

variable "allow_azure_services" {
  description = "Allow Azure services to access"
  type        = bool
  default     = true
}

variable "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID for diagnostics"
  type        = string
  default     = null
}

variable "enable_alerts" {
  description = "Enable metric alerts"
  type        = bool
  default     = true
}

variable "action_group_id" {
  description = "Action group ID for alerts"
  type        = string
  default     = null
}
