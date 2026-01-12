# =============================================================================
# Keycloak Kubernetes Module Variables
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
  default     = "keycloak"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "keycloak"
}

variable "db_password" {
  description = "Database password (if not using Vault). If provided, overrides generated password."
  type        = string
  default     = null
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Keycloak Configuration
# -----------------------------------------------------------------------------

variable "keycloak_image" {
  description = "Keycloak Docker image"
  type        = string
  default     = "quay.io/keycloak/keycloak:23.0"
}

variable "dev_mode" {
  description = "Run Keycloak in dev mode (start-dev)"
  type        = bool
  default     = false
}

variable "admin_username" {
  description = "Keycloak admin username"
  type        = string
  default     = "admin"
}

variable "admin_password" {
  description = "Keycloak admin password (if not using Vault). Simple default for local dev."
  type        = string
  default     = null
  sensitive   = true
}

variable "replicas" {
  description = "Number of replicas"
  type        = number
  default     = 1
}

variable "service_type" {
  description = "Kubernetes service type"
  type        = string
  default     = "ClusterIP"
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
  description = "Vault secrets path for Keycloak credentials"
  type        = string
  default     = "secret/data/auth/keycloak"
}

# -----------------------------------------------------------------------------
# Realm Configuration
# -----------------------------------------------------------------------------

variable "import_realm" {
  description = "Import realm on startup"
  type        = bool
  default     = true
}

variable "realm_config_map" {
  description = "ConfigMap name containing realm JSON"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Resources
# -----------------------------------------------------------------------------

variable "resources" {
  description = "Resource requests and limits"
  type = object({
    requests = map(string)
    limits   = map(string)
  })
  default = null
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}
