# =============================================================================
# Kubernetes Compute Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Common Variables
# -----------------------------------------------------------------------------

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "instance_size" {
  description = "Instance size (small, medium, large, xlarge)"
  type        = string
  default     = "small"

  validation {
    condition     = contains(["small", "medium", "large", "xlarge"], var.instance_size)
    error_message = "instance_size must be one of: small, medium, large, xlarge"
  }
}

variable "labels" {
  description = "Labels to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "annotations" {
  description = "Annotations to apply to all resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Namespace Configuration
# -----------------------------------------------------------------------------

variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
  default     = "default"
}

variable "create_namespace" {
  description = "Create the namespace if it doesn't exist"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# Service Account Configuration
# -----------------------------------------------------------------------------

variable "create_service_account" {
  description = "Create a service account for the workloads"
  type        = bool
  default     = true
}

variable "service_account_name" {
  description = "Name of existing service account (if not creating)"
  type        = string
  default     = ""
}

variable "service_account_annotations" {
  description = "Annotations for the service account (e.g., IAM role for IRSA)"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# ConfigMap
# -----------------------------------------------------------------------------

variable "config_data" {
  description = "Data for shared ConfigMap"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Services Configuration
# -----------------------------------------------------------------------------

variable "services" {
  description = "Map of services to deploy"
  type = map(object({
    image     = string
    component = optional(string, "backend")
    replicas  = optional(number)

    # Resource limits
    cpu_request    = optional(string)
    cpu_limit      = optional(string)
    memory_request = optional(string)
    memory_limit   = optional(string)

    # Deployment strategy
    strategy_type   = optional(string, "RollingUpdate")
    max_surge       = optional(string, "25%")
    max_unavailable = optional(string, "25%")

    # Ports
    ports = list(object({
      name         = string
      port         = number
      protocol     = optional(string, "TCP")
      service_port = optional(number)
      node_port    = optional(number)
    }))

    # Environment variables
    env_vars = optional(map(string), {})
    env_from_secrets = optional(map(object({
      secret_name = string
      key         = string
    })), {})
    env_from_configmap = optional(map(object({
      configmap_name = string
      key            = string
    })), {})

    # Volumes
    volumes = optional(list(object({
      name       = string
      type       = string  # configmap, secret, pvc, emptydir
      source     = optional(string)
      medium     = optional(string)
      size_limit = optional(string)
    })), [])

    volume_mounts = optional(list(object({
      name       = string
      mount_path = string
      read_only  = optional(bool, false)
      sub_path   = optional(string)
    })), [])

    # Health checks
    liveness_probe = optional(object({
      type                  = string  # http, tcp, exec
      path                  = optional(string)
      port                  = optional(number)
      scheme                = optional(string, "HTTP")
      command               = optional(list(string))
      initial_delay_seconds = optional(number, 30)
      period_seconds        = optional(number, 10)
      timeout_seconds       = optional(number, 5)
      failure_threshold     = optional(number, 3)
      success_threshold     = optional(number, 1)
    }))

    readiness_probe = optional(object({
      type                  = string  # http, tcp, exec
      path                  = optional(string)
      port                  = optional(number)
      scheme                = optional(string, "HTTP")
      command               = optional(list(string))
      initial_delay_seconds = optional(number, 5)
      period_seconds        = optional(number, 5)
      timeout_seconds       = optional(number, 3)
      failure_threshold     = optional(number, 3)
      success_threshold     = optional(number, 1)
    }))

    # Security contexts
    container_security_context = optional(object({
      run_as_user                = optional(number)
      run_as_non_root            = optional(bool, true)
      read_only_root_filesystem  = optional(bool, true)
      allow_privilege_escalation = optional(bool, false)
    }))

    pod_annotations = optional(map(string), {})

    # Service configuration
    create_service      = optional(bool, true)
    service_type        = optional(string, "ClusterIP")
    service_annotations = optional(map(string), {})
    session_affinity    = optional(string, "None")

    # Ingress configuration
    ingress_enabled     = optional(bool, false)
    ingress_host        = optional(string)
    ingress_path        = optional(string, "/")
    ingress_path_type   = optional(string, "Prefix")
    ingress_annotations = optional(map(string), {})
    ingress_tls_secret  = optional(string)

    # Autoscaling
    autoscaling_enabled          = optional(bool, false)
    autoscaling_min_replicas     = optional(number, 1)
    autoscaling_max_replicas     = optional(number, 10)
    autoscaling_cpu_threshold    = optional(number, 70)
    autoscaling_memory_threshold = optional(number)

    # Pod Disruption Budget
    pdb_enabled       = optional(bool, false)
    pdb_min_available = optional(string, "50%")

    # Network Policy
    network_policy_enabled = optional(bool, false)
    network_policy_ingress = optional(list(object({
      from = list(object({
        namespace_selector = optional(map(string))
        pod_selector       = optional(map(string))
      }))
      ports = list(object({
        port     = number
        protocol = optional(string, "TCP")
      }))
    })), [])
    network_policy_egress = optional(list(object({
      to = list(object({
        namespace_selector = optional(map(string))
        pod_selector       = optional(map(string))
        cidr               = optional(string)
      }))
      ports = list(object({
        port     = number
        protocol = optional(string, "TCP")
      }))
    })), [])

    # Metrics
    metrics_enabled   = optional(bool, false)
    metrics_port_name = optional(string, "metrics")
    metrics_path      = optional(string, "/metrics")
    metrics_interval  = optional(string, "30s")
  }))
  default = {}
}

# -----------------------------------------------------------------------------
# Image Pull Secrets
# -----------------------------------------------------------------------------

variable "image_pull_secrets" {
  description = "List of image pull secret names"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Pod Security Context
# -----------------------------------------------------------------------------

variable "pod_security_context" {
  description = "Pod security context"
  type = object({
    run_as_user     = optional(number)
    run_as_group    = optional(number)
    run_as_non_root = optional(bool, true)
    fs_group        = optional(number)
  })
  default = null
}

# -----------------------------------------------------------------------------
# Scheduling
# -----------------------------------------------------------------------------

variable "node_selector" {
  description = "Node selector for pod scheduling"
  type        = map(string)
  default     = {}
}

variable "tolerations" {
  description = "Pod tolerations"
  type = list(object({
    key      = string
    operator = optional(string, "Equal")
    value    = optional(string)
    effect   = string
  }))
  default = []
}

variable "pod_affinity" {
  description = "Pod affinity configuration"
  type = object({
    node_affinity = optional(object({
      required = optional(object({
        match_expressions = list(object({
          key      = string
          operator = string
          values   = list(string)
        }))
      }))
    }))
  })
  default = null
}

# -----------------------------------------------------------------------------
# Ingress Configuration
# -----------------------------------------------------------------------------

variable "ingress_class_name" {
  description = "Ingress class name"
  type        = string
  default     = "nginx"
}

variable "ingress_annotations" {
  description = "Common annotations for all ingress resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Monitoring Configuration
# -----------------------------------------------------------------------------

variable "prometheus_operator_enabled" {
  description = "Enable ServiceMonitor resources for Prometheus Operator"
  type        = bool
  default     = false
}

variable "prometheus_labels" {
  description = "Labels for Prometheus to discover ServiceMonitors"
  type        = map(string)
  default = {
    "prometheus" = "main"
  }
}
