# ArgoCD Module Variables

# Namespace configuration
variable "namespace" {
  description = "Kubernetes namespace for ArgoCD installation"
  type        = string
  default     = "argocd"
}

variable "create_namespace" {
  description = "Create the namespace if it doesn't exist"
  type        = bool
  default     = true
}

variable "release_name" {
  description = "Helm release name for ArgoCD"
  type        = string
  default     = "argocd"
}

# ArgoCD version configuration
variable "argocd_version" {
  description = "ArgoCD Helm chart version"
  type        = string
  default     = "5.51.6"
}

variable "argocd_image_tag" {
  description = "ArgoCD Docker image tag (leave empty to use chart default)"
  type        = string
  default     = ""
}

# Service configuration
variable "service_type" {
  description = "Kubernetes service type for ArgoCD server (LoadBalancer, NodePort, ClusterIP)"
  type        = string
  default     = "ClusterIP"

  validation {
    condition     = contains(["LoadBalancer", "NodePort", "ClusterIP"], var.service_type)
    error_message = "service_type must be LoadBalancer, NodePort, or ClusterIP"
  }
}

variable "service_annotations" {
  description = "Annotations to add to the ArgoCD server service"
  type        = map(string)
  default     = {}
}

# Admin configuration
variable "admin_password" {
  description = "Admin password for ArgoCD (leave empty to auto-generate)"
  type        = string
  default     = ""
  sensitive   = true
}

# Ingress configuration
variable "create_ingress" {
  description = "Create Ingress resource for ArgoCD server"
  type        = bool
  default     = false
}

variable "ingress_host" {
  description = "Hostname for ArgoCD Ingress"
  type        = string
  default     = "argocd.local"
}

variable "ingress_annotations" {
  description = "Annotations for ArgoCD Ingress"
  type        = map(string)
  default = {
    "kubernetes.io/ingress.class" = "nginx"
  }
}

variable "ingress_tls_enabled" {
  description = "Enable TLS for ArgoCD Ingress"
  type        = bool
  default     = false
}

variable "ingress_tls_secret_name" {
  description = "TLS secret name for ArgoCD Ingress"
  type        = string
  default     = "argocd-tls"
}

# High availability configuration
variable "ha_enabled" {
  description = "Enable high availability mode (multiple replicas, Redis HA)"
  type        = bool
  default     = false
}

# Server configuration
variable "insecure_server" {
  description = "Run ArgoCD server with --insecure flag (disable TLS)"
  type        = bool
  default     = false
}

variable "server_extra_args" {
  description = "Additional arguments for ArgoCD server"
  type        = list(string)
  default     = []
}

variable "server_config" {
  description = "Additional server configuration settings"
  type        = map(string)
  default     = {}
}

variable "reconciliation_timeout" {
  description = "Reconciliation timeout for ArgoCD"
  type        = string
  default     = "180s"
}

# Metrics and monitoring
variable "enable_metrics" {
  description = "Enable Prometheus metrics and ServiceMonitor"
  type        = bool
  default     = true
}

# ApplicationSet controller
variable "enable_applicationset" {
  description = "Enable ApplicationSet controller"
  type        = bool
  default     = true
}

# Notifications controller
variable "enable_notifications" {
  description = "Enable notifications controller"
  type        = bool
  default     = false
}

# Dex for SSO
variable "enable_dex" {
  description = "Enable Dex for SSO integration"
  type        = bool
  default     = false
}

# Config management plugins
variable "config_management_plugins" {
  description = "Configuration for config management plugins"
  type        = any
  default     = null
}

# Git repository configuration
variable "git_repo_url" {
  description = "Git repository URL for ArgoCD applications"
  type        = string
}

variable "git_branch" {
  description = "Default Git branch for applications"
  type        = string
  default     = "main"
}

variable "git_repo_path" {
  description = "Default path within Git repository for applications"
  type        = string
  default     = "infrastructure/gitops"
}

# Git credentials (HTTPS)
variable "git_username" {
  description = "Git username for HTTPS authentication"
  type        = string
  default     = ""
  sensitive   = true
}

variable "git_password" {
  description = "Git password or token for HTTPS authentication"
  type        = string
  default     = ""
  sensitive   = true
}

# Git credentials (SSH)
variable "git_ssh_private_key" {
  description = "Git SSH private key for SSH authentication"
  type        = string
  default     = ""
  sensitive   = true
}

# ArgoCD Project configuration
variable "create_project" {
  description = "Create ArgoCD project for the platform"
  type        = bool
  default     = true
}

variable "project_name" {
  description = "Name of the ArgoCD project"
  type        = string
  default     = "ananta-platform"
}

variable "project_description" {
  description = "Description of the ArgoCD project"
  type        = string
  default     = "Ananta Platform multi-tenant SaaS control plane"
}

variable "additional_source_repos" {
  description = "Additional source repositories for the project"
  type        = list(string)
  default     = []
}

variable "additional_destinations" {
  description = "Additional destination configurations for the project"
  type = list(object({
    namespace = string
    server    = string
    name      = optional(string)
  }))
  default = []
}

variable "cluster_resource_whitelist" {
  description = "Cluster resource whitelist for the project"
  type = list(object({
    group = string
    kind  = string
  }))
  default = null
}

variable "namespace_resource_whitelist" {
  description = "Namespace resource whitelist for the project"
  type = list(object({
    group = string
    kind  = string
  }))
  default = null
}

variable "warn_orphaned_resources" {
  description = "Warn about orphaned resources"
  type        = bool
  default     = true
}

variable "sync_windows" {
  description = "Sync windows configuration for the project"
  type        = any
  default     = []
}

variable "project_roles" {
  description = "Role definitions for the project"
  type        = any
  default     = []
}

# ApplicationSet configuration
variable "create_applicationset" {
  description = "Create ApplicationSet for multi-environment deployments"
  type        = bool
  default     = true
}

variable "applicationset_name" {
  description = "Name of the ApplicationSet"
  type        = string
  default     = "ananta-platform"
}

variable "environments" {
  description = "List of environments for ApplicationSet"
  type = list(object({
    name         = string
    namespace    = string
    git_branch   = optional(string)
    cluster_name = optional(string)
    repo_path    = optional(string)
    values       = optional(string)
  }))
  default = [
    {
      name      = "dev"
      namespace = "ananta-dev"
    },
    {
      name      = "staging"
      namespace = "ananta-staging"
    },
    {
      name      = "prod"
      namespace = "ananta-prod"
    }
  ]
}

# Helm source configuration
variable "use_helm_source" {
  description = "Use Helm as source type in ApplicationSet"
  type        = bool
  default     = false
}

variable "helm_value_files" {
  description = "Helm value files for ApplicationSet"
  type        = list(string)
  default     = []
}

# Sync policy configuration
variable "sync_policy_automated" {
  description = "Enable automated sync for applications"
  type        = bool
  default     = true
}

variable "sync_policy_prune" {
  description = "Enable pruning of resources during sync"
  type        = bool
  default     = true
}

variable "sync_policy_self_heal" {
  description = "Enable self-healing for applications"
  type        = bool
  default     = true
}

variable "sync_policy_allow_empty" {
  description = "Allow empty sync (useful for initial deployment)"
  type        = bool
  default     = false
}

variable "sync_options" {
  description = "Sync options for applications"
  type        = list(string)
  default = [
    "CreateNamespace=true",
    "PruneLast=true"
  ]
}

# Sync retry configuration
variable "sync_retry_enabled" {
  description = "Enable sync retry on failure"
  type        = bool
  default     = true
}

variable "sync_retry_limit" {
  description = "Maximum number of sync retries"
  type        = number
  default     = 5
}

variable "sync_retry_backoff_duration" {
  description = "Initial backoff duration for sync retries"
  type        = string
  default     = "5s"
}

variable "sync_retry_backoff_factor" {
  description = "Backoff factor for sync retries"
  type        = number
  default     = 2
}

variable "sync_retry_backoff_max_duration" {
  description = "Maximum backoff duration for sync retries"
  type        = string
  default     = "3m"
}

# Ignore differences configuration
variable "ignore_differences" {
  description = "Resource differences to ignore during sync"
  type        = any
  default     = []
}

# Additional applications
variable "additional_applications" {
  description = "Additional ArgoCD applications to create"
  type        = map(object({
    source = object({
      path            = string
      repo_url        = optional(string)
      target_revision = optional(string)
    })
    destination = object({
      namespace = string
      server    = optional(string)
    })
    labels        = optional(map(string))
    finalizers    = optional(list(string))
    spec_override = optional(map(any))
  }))
  default = {}
}

# Helm set values
variable "helm_set_values" {
  description = "Additional Helm set values for ArgoCD chart"
  type        = map(string)
  default     = {}
}

variable "helm_set_sensitive_values" {
  description = "Additional sensitive Helm set values for ArgoCD chart"
  type        = map(string)
  default     = {}
  sensitive   = true
}

# Labels
variable "labels" {
  description = "Common labels to apply to all resources"
  type        = map(string)
  default = {
    "managed-by" = "terraform"
    "platform"   = "ananta"
  }
}
