# =============================================================================
# Vault Kubernetes Module Variables
# =============================================================================

variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "labels" {
  description = "Common labels for resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Vault Configuration
# -----------------------------------------------------------------------------

variable "helm_chart_version" {
  description = "Vault Helm chart version"
  type        = string
  default     = "0.27.0"
}

variable "vault_version" {
  description = "Vault image version"
  type        = string
  default     = "1.15.4"
}

variable "dev_mode" {
  description = "Run Vault in dev mode (auto-unsealed, in-memory)"
  type        = bool
  default     = false
}

variable "enable_injector" {
  description = "Enable Vault Agent Injector for sidecar injection"
  type        = bool
  default     = true
}

variable "enable_csi" {
  description = "Enable Vault CSI Provider"
  type        = bool
  default     = false
}

variable "init_secrets" {
  description = "Initialize secrets for platform services"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Storage Configuration
# -----------------------------------------------------------------------------

variable "storage_size" {
  description = "Storage size for Vault data"
  type        = string
  default     = "1Gi"
}

variable "storage_class" {
  description = "Storage class for PVC"
  type        = string
  default     = ""
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
# Resource Configuration
# -----------------------------------------------------------------------------

variable "memory_request" {
  description = "Memory request"
  type        = string
  default     = "256Mi"
}

variable "memory_limit" {
  description = "Memory limit"
  type        = string
  default     = "512Mi"
}

variable "cpu_request" {
  description = "CPU request"
  type        = string
  default     = "100m"
}

variable "cpu_limit" {
  description = "CPU limit"
  type        = string
  default     = "500m"
}
