# =============================================================================
# Cloud-Agnostic Compute Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Provider Selection
# -----------------------------------------------------------------------------

variable "cloud_provider" {
  description = "Cloud provider to use (kubernetes, ecs, azure_container_apps, gcp_cloud_run)"
  type        = string
  default     = ""

  validation {
    condition = var.cloud_provider == "" || contains([
      "kubernetes",
      "ecs",
      "azure_container_apps",
      "gcp_cloud_run"
    ], var.cloud_provider)
    error_message = "cloud_provider must be one of: kubernetes, ecs, azure_container_apps, gcp_cloud_run"
  }
}

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
  description = "Labels/tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "annotations" {
  description = "Annotations to apply to resources (K8s-specific)"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# ConfigMap/Configuration Data
# -----------------------------------------------------------------------------

variable "config_data" {
  description = "Shared configuration data for services"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Services Configuration (Common Interface)
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
      type       = string
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
      type                  = string
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
      type                  = string
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
# Kubernetes-Specific Configuration
# -----------------------------------------------------------------------------

variable "kubernetes_config" {
  description = "Kubernetes-specific configuration"
  type = object({
    namespace        = optional(string, "default")
    create_namespace = optional(bool, false)

    # Service account
    create_service_account      = optional(bool, true)
    service_account_name        = optional(string, "")
    service_account_annotations = optional(map(string), {})

    # Image pull secrets
    image_pull_secrets = optional(list(string), [])

    # Pod security context
    pod_security_context = optional(object({
      run_as_user     = optional(number)
      run_as_group    = optional(number)
      run_as_non_root = optional(bool, true)
      fs_group        = optional(number)
    }))

    # Scheduling
    node_selector = optional(map(string), {})
    tolerations = optional(list(object({
      key      = string
      operator = optional(string, "Equal")
      value    = optional(string)
      effect   = string
    })), [])
    pod_affinity = optional(object({
      node_affinity = optional(object({
        required = optional(object({
          match_expressions = list(object({
            key      = string
            operator = string
            values   = list(string)
          }))
        }))
      }))
    }))

    # Ingress
    ingress_class_name  = optional(string, "nginx")
    ingress_annotations = optional(map(string), {})

    # Monitoring
    prometheus_operator_enabled = optional(bool, false)
    prometheus_labels           = optional(map(string), { "prometheus" = "main" })
  })
  default = {}
}

# -----------------------------------------------------------------------------
# AWS ECS Configuration (Placeholder)
# -----------------------------------------------------------------------------

variable "ecs_config" {
  description = "AWS ECS-specific configuration"
  type = object({
    cluster_name       = optional(string)
    vpc_id             = optional(string)
    subnet_ids         = optional(list(string), [])
    security_group_ids = optional(list(string), [])
    execution_role_arn = optional(string)
    task_role_arn      = optional(string)
    launch_type        = optional(string, "FARGATE")

    # Load balancer
    create_alb           = optional(bool, true)
    alb_subnet_ids       = optional(list(string), [])
    alb_security_groups  = optional(list(string), [])
    certificate_arn      = optional(string)

    # Logging
    log_group_name           = optional(string)
    log_retention_days       = optional(number, 30)

    # Service discovery
    enable_service_discovery = optional(bool, false)
    service_discovery_namespace_id = optional(string)
  })
  default = {}
}

# -----------------------------------------------------------------------------
# Azure Container Apps Configuration (Placeholder)
# -----------------------------------------------------------------------------

variable "azure_config" {
  description = "Azure Container Apps-specific configuration"
  type = object({
    resource_group_name          = optional(string)
    location                     = optional(string)
    container_app_environment_id = optional(string)

    # Registry
    registry_server   = optional(string)
    registry_username = optional(string)
    registry_password = optional(string)

    # Networking
    virtual_network_id = optional(string)
    subnet_id          = optional(string)

    # Scaling rules
    min_replicas = optional(number, 1)
    max_replicas = optional(number, 10)
  })
  default = {}
}

# -----------------------------------------------------------------------------
# GCP Cloud Run Configuration (Placeholder)
# -----------------------------------------------------------------------------

variable "gcp_config" {
  description = "GCP Cloud Run-specific configuration"
  type = object({
    project_id = optional(string)
    region     = optional(string)

    # VPC Connector
    vpc_connector_name = optional(string)
    vpc_egress         = optional(string, "ALL_TRAFFIC")

    # IAM
    service_account_email = optional(string)
    allow_unauthenticated = optional(bool, false)

    # Scaling
    min_instances = optional(number, 0)
    max_instances = optional(number, 100)

    # Cloud SQL
    cloud_sql_connections = optional(list(string), [])
  })
  default = {}
}
