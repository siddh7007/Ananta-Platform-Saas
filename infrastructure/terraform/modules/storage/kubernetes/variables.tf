# =============================================================================
# Kubernetes Storage Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Common Variables (from interface)
# -----------------------------------------------------------------------------

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "bucket_suffix" {
  description = "Suffix for bucket name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "instance_size" {
  description = "Normalized instance size (micro, small, medium, large, xlarge)"
  type        = string
  default     = "small"

  validation {
    condition     = contains(["micro", "small", "medium", "large", "xlarge"], var.instance_size)
    error_message = "Instance size must be one of: micro, small, medium, large, xlarge."
  }
}

variable "versioning_enabled" {
  description = "Enable object versioning"
  type        = bool
  default     = true
}

variable "public_access" {
  description = "Allow public access (via ingress)"
  type        = bool
  default     = false
}

variable "high_availability" {
  description = "Enable high availability (distributed mode)"
  type        = bool
  default     = false
}

variable "labels" {
  description = "Labels to apply (mapped to Kubernetes labels)"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Kubernetes-Specific Variables
# -----------------------------------------------------------------------------

variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
  default     = "minio"
}

variable "create_namespace" {
  description = "Create namespace if it doesn't exist"
  type        = bool
  default     = true
}

variable "use_operator" {
  description = "Use MinIO Operator instead of StatefulSet"
  type        = bool
  default     = false
}

variable "service_account_name" {
  description = "Service account name for MinIO pods"
  type        = string
  default     = "default"
}

# -----------------------------------------------------------------------------
# MinIO Configuration
# -----------------------------------------------------------------------------

variable "minio_image" {
  description = "MinIO container image"
  type        = string
  default     = "minio/minio"
}

variable "minio_version" {
  description = "MinIO version tag"
  type        = string
  default     = "RELEASE.2024-01-01T16-36-33Z"
}

variable "access_key" {
  description = "MinIO access key (generated if not provided)"
  type        = string
  default     = null
  sensitive   = true
}

variable "secret_key" {
  description = "MinIO secret key (generated if not provided)"
  type        = string
  default     = null
  sensitive   = true
}

variable "minio_extra_env" {
  description = "Additional environment variables for MinIO"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Storage Configuration
# -----------------------------------------------------------------------------

variable "storage_class_name" {
  description = "Storage class for PVCs"
  type        = string
  default     = null
}

variable "storage_size" {
  description = "Storage size per replica (overrides instance_size default)"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# TLS Configuration
# -----------------------------------------------------------------------------

variable "tls_enabled" {
  description = "Enable TLS for MinIO"
  type        = bool
  default     = false
}

variable "tls_cert" {
  description = "TLS certificate (PEM format)"
  type        = string
  default     = null
  sensitive   = true
}

variable "tls_key" {
  description = "TLS private key (PEM format)"
  type        = string
  default     = null
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Service Configuration
# -----------------------------------------------------------------------------

variable "service_type" {
  description = "Kubernetes service type (ClusterIP, LoadBalancer, NodePort)"
  type        = string
  default     = "ClusterIP"
}

variable "service_annotations" {
  description = "Annotations for the MinIO service"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Ingress Configuration
# -----------------------------------------------------------------------------

variable "ingress_enabled" {
  description = "Enable ingress for MinIO API"
  type        = bool
  default     = false
}

variable "ingress_class_name" {
  description = "Ingress class name"
  type        = string
  default     = "nginx"
}

variable "ingress_host" {
  description = "Hostname for MinIO API ingress"
  type        = string
  default     = ""
}

variable "ingress_path" {
  description = "Path for MinIO API ingress"
  type        = string
  default     = "/"
}

variable "ingress_annotations" {
  description = "Annotations for ingress"
  type        = map(string)
  default     = {}
}

variable "ingress_tls_secret" {
  description = "TLS secret name for ingress"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Console Ingress Configuration
# -----------------------------------------------------------------------------

variable "console_ingress_enabled" {
  description = "Enable ingress for MinIO console"
  type        = bool
  default     = false
}

variable "console_ingress_host" {
  description = "Hostname for MinIO console ingress"
  type        = string
  default     = ""
}

variable "console_ingress_tls_secret" {
  description = "TLS secret name for console ingress"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Pod Configuration
# -----------------------------------------------------------------------------

variable "pod_annotations" {
  description = "Annotations for MinIO pods"
  type        = map(string)
  default     = {}
}

variable "pod_security_context" {
  description = "Pod security context"
  type = object({
    run_as_user     = optional(number)
    run_as_group    = optional(number)
    fs_group        = optional(number)
    run_as_non_root = optional(bool)
  })
  default = null
}

variable "pod_affinity" {
  description = "Pod affinity configuration"
  type = object({
    pod_anti_affinity = optional(object({
      required = optional(bool, true)
    }))
  })
  default = null
}

variable "tolerations" {
  description = "Pod tolerations"
  type = list(object({
    key      = string
    operator = string
    value    = optional(string)
    effect   = string
  }))
  default = []
}

variable "node_selector" {
  description = "Node selector for pod scheduling"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Bucket Configuration
# -----------------------------------------------------------------------------

variable "create_default_bucket" {
  description = "Create a default bucket on startup"
  type        = bool
  default     = true
}

variable "default_bucket_name" {
  description = "Name of the default bucket to create"
  type        = string
  default     = "default"
}

# -----------------------------------------------------------------------------
# Monitoring
# -----------------------------------------------------------------------------

variable "metrics_enabled" {
  description = "Enable Prometheus metrics"
  type        = bool
  default     = true
}

variable "prometheus_labels" {
  description = "Labels for ServiceMonitor (for Prometheus Operator)"
  type        = map(string)
  default = {
    "prometheus" = "kube-prometheus"
  }
}
