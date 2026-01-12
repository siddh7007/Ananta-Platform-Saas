# =============================================================================
# Temporal Kubernetes Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Required Variables
# -----------------------------------------------------------------------------

variable "namespace" {
  description = "Kubernetes namespace"
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
# Database Configuration
# -----------------------------------------------------------------------------

variable "db_host" {
  description = "Database host"
  type        = string
}

variable "db_port" {
  description = "Database port"
  type        = number
  default     = 5432
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "temporal"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "temporal"
}

variable "db_password" {
  description = "Database password (if not using Vault). If provided, overrides generated password."
  type        = string
  default     = null
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Temporal Configuration
# -----------------------------------------------------------------------------

variable "temporal_version" {
  description = "Temporal version"
  type        = string
  default     = "1.24.2"
}

variable "ui_version" {
  description = "Temporal UI version"
  type        = string
  default     = "2.32.0"
}

variable "server_replicas" {
  description = "Number of Temporal server replicas"
  type        = number
  default     = 1
}

variable "log_level" {
  description = "Log level"
  type        = string
  default     = "info"
}

variable "service_type" {
  description = "Kubernetes service type"
  type        = string
  default     = "ClusterIP"
}

# -----------------------------------------------------------------------------
# UI Configuration
# -----------------------------------------------------------------------------

variable "enable_ui" {
  description = "Enable Temporal UI"
  type        = bool
  default     = true
}

variable "ui_port" {
  description = "Temporal UI port"
  type        = number
  default     = 8080
}

variable "cors_origins" {
  description = "CORS allowed origins"
  type        = string
  default     = "http://localhost:3000,http://localhost:27555"
}

# -----------------------------------------------------------------------------
# Namespace Configuration
# -----------------------------------------------------------------------------

variable "create_namespaces" {
  description = "Temporal namespaces to create"
  type        = list(string)
  default     = ["arc-saas", "default"]
}

# -----------------------------------------------------------------------------
# Vault Integration
# -----------------------------------------------------------------------------

variable "use_vault_secrets" {
  description = "Use Vault for secrets management"
  type        = bool
  default     = false
}

variable "vault_secrets_path" {
  description = "Vault secrets path for Temporal credentials"
  type        = string
  default     = "secret/data/temporal"
}

# -----------------------------------------------------------------------------
# Labels
# -----------------------------------------------------------------------------

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}
