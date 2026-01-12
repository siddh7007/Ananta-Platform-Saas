# =============================================================================
# GCP Compute Module Variables (GKE)
# =============================================================================

# -----------------------------------------------------------------------------
# Required Variables
# -----------------------------------------------------------------------------

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "region" {
  description = "GCP region for the cluster"
  type        = string
}

variable "vpc_network_id" {
  description = "VPC network ID for the cluster"
  type        = string
}

variable "subnet_id" {
  description = "Subnet ID for the cluster"
  type        = string
}

variable "pods_range_name" {
  description = "Name of the secondary IP range for pods"
  type        = string
}

variable "services_range_name" {
  description = "Name of the secondary IP range for services"
  type        = string
}

# -----------------------------------------------------------------------------
# Cluster Configuration
# -----------------------------------------------------------------------------

variable "cluster_size" {
  description = "Cluster size preset (small, medium, large, xlarge)"
  type        = string
  default     = "medium"

  validation {
    condition     = contains(["small", "medium", "large", "xlarge"], var.cluster_size)
    error_message = "Cluster size must be small, medium, large, or xlarge."
  }
}

variable "node_zones" {
  description = "List of zones for node distribution"
  type        = list(string)
  default     = []
}

variable "release_channel" {
  description = "GKE release channel (RAPID, REGULAR, STABLE)"
  type        = string
  default     = "REGULAR"

  validation {
    condition     = contains(["RAPID", "REGULAR", "STABLE", "UNSPECIFIED"], var.release_channel)
    error_message = "Release channel must be RAPID, REGULAR, STABLE, or UNSPECIFIED."
  }
}

variable "deletion_protection" {
  description = "Enable deletion protection for the cluster"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Network Configuration
# -----------------------------------------------------------------------------

variable "enable_private_nodes" {
  description = "Enable private nodes (no public IPs)"
  type        = bool
  default     = true
}

variable "enable_private_endpoint" {
  description = "Enable private endpoint (master only accessible via VPC)"
  type        = bool
  default     = false
}

variable "master_ipv4_cidr_block" {
  description = "CIDR block for the master network"
  type        = string
  default     = "172.16.0.0/28"
}

variable "master_global_access_enabled" {
  description = "Enable global access to master endpoint"
  type        = bool
  default     = true
}

variable "enable_master_authorized_networks" {
  description = "Enable master authorized networks"
  type        = bool
  default     = true
}

variable "master_authorized_networks" {
  description = "List of authorized networks for master access"
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  default = []
}

# -----------------------------------------------------------------------------
# Addons and Features
# -----------------------------------------------------------------------------

variable "enable_http_load_balancing" {
  description = "Enable HTTP load balancing addon"
  type        = bool
  default     = true
}

variable "enable_horizontal_pod_autoscaling" {
  description = "Enable horizontal pod autoscaling"
  type        = bool
  default     = true
}

variable "enable_network_policy" {
  description = "Enable network policy (Calico)"
  type        = bool
  default     = true
}

variable "enable_gce_pd_csi_driver" {
  description = "Enable GCE Persistent Disk CSI driver"
  type        = bool
  default     = true
}

variable "enable_gcs_fuse_csi_driver" {
  description = "Enable GCS FUSE CSI driver"
  type        = bool
  default     = false
}

variable "enable_dns_cache" {
  description = "Enable NodeLocal DNSCache"
  type        = bool
  default     = true
}

variable "enable_workload_identity" {
  description = "Enable Workload Identity"
  type        = bool
  default     = true
}

variable "enable_binary_authorization" {
  description = "Enable Binary Authorization"
  type        = bool
  default     = false
}

variable "enable_shielded_nodes" {
  description = "Enable Shielded GKE Nodes"
  type        = bool
  default     = true
}

variable "enable_intranode_visibility" {
  description = "Enable intranode visibility for traffic debugging"
  type        = bool
  default     = false
}

variable "datapath_provider" {
  description = "Datapath provider (LEGACY_DATAPATH, ADVANCED_DATAPATH)"
  type        = string
  default     = "ADVANCED_DATAPATH"
}

variable "enable_gateway_api" {
  description = "Enable Gateway API"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# DNS Configuration
# -----------------------------------------------------------------------------

variable "cluster_dns" {
  description = "Cluster DNS provider (PROVIDER_UNSPECIFIED, PLATFORM_DEFAULT, CLOUD_DNS)"
  type        = string
  default     = "CLOUD_DNS"
}

variable "cluster_dns_scope" {
  description = "Cluster DNS scope (DNS_SCOPE_UNSPECIFIED, CLUSTER_SCOPE, VPC_SCOPE)"
  type        = string
  default     = "CLUSTER_SCOPE"
}

variable "cluster_dns_domain" {
  description = "Cluster DNS domain"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Cluster Autoscaling
# -----------------------------------------------------------------------------

variable "enable_cluster_autoscaling" {
  description = "Enable cluster autoscaling (node auto-provisioning)"
  type        = bool
  default     = false
}

variable "autoscaling_cpu_min" {
  description = "Minimum CPU cores for cluster autoscaling"
  type        = number
  default     = 4
}

variable "autoscaling_cpu_max" {
  description = "Maximum CPU cores for cluster autoscaling"
  type        = number
  default     = 100
}

variable "autoscaling_memory_min" {
  description = "Minimum memory (GB) for cluster autoscaling"
  type        = number
  default     = 16
}

variable "autoscaling_memory_max" {
  description = "Maximum memory (GB) for cluster autoscaling"
  type        = number
  default     = 400
}

# -----------------------------------------------------------------------------
# Node Pool Configuration
# -----------------------------------------------------------------------------

variable "node_machine_type" {
  description = "Machine type for nodes (overrides cluster_size default)"
  type        = string
  default     = null
}

variable "node_disk_size_gb" {
  description = "Disk size for nodes in GB (overrides cluster_size default)"
  type        = number
  default     = null
}

variable "node_disk_type" {
  description = "Disk type for nodes (pd-standard, pd-balanced, pd-ssd)"
  type        = string
  default     = "pd-balanced"
}

variable "use_spot_instances" {
  description = "Use spot instances for cost savings (not for production)"
  type        = bool
  default     = false
}

variable "enable_secure_boot" {
  description = "Enable Secure Boot for shielded nodes"
  type        = bool
  default     = true
}

variable "enable_integrity_monitoring" {
  description = "Enable integrity monitoring for shielded nodes"
  type        = bool
  default     = true
}

variable "node_pool_max_surge" {
  description = "Max surge for node pool upgrades"
  type        = number
  default     = 1
}

variable "node_pool_max_unavailable" {
  description = "Max unavailable for node pool upgrades"
  type        = number
  default     = 0
}

variable "default_node_pool_taints" {
  description = "Taints for the default node pool"
  type = list(object({
    key    = string
    value  = string
    effect = string
  }))
  default = []
}

variable "node_tags" {
  description = "Network tags for nodes"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Additional Node Pools
# -----------------------------------------------------------------------------

variable "additional_node_pools" {
  description = "Map of additional node pools to create"
  type = map(object({
    machine_type   = string
    disk_size_gb   = number
    disk_type      = string
    min_node_count = number
    max_node_count = number
    auto_upgrade   = bool
    use_spot       = bool
    gpu_type       = optional(string)
    gpu_count      = optional(number, 0)
    labels         = optional(map(string), {})
    taints = optional(list(object({
      key    = string
      value  = string
      effect = string
    })), [])
    tags = optional(list(string), [])
  }))
  default = {}
}

# -----------------------------------------------------------------------------
# Maintenance Configuration
# -----------------------------------------------------------------------------

variable "maintenance_start_time" {
  description = "Maintenance window start time (RFC3339)"
  type        = string
  default     = "2024-01-01T04:00:00Z"
}

variable "maintenance_end_time" {
  description = "Maintenance window end time (RFC3339)"
  type        = string
  default     = "2024-01-01T08:00:00Z"
}

variable "maintenance_recurrence" {
  description = "Maintenance window recurrence (RRULE format)"
  type        = string
  default     = "FREQ=WEEKLY;BYDAY=SA,SU"
}

variable "maintenance_exclusions" {
  description = "Maintenance exclusion windows"
  type = list(object({
    name       = string
    start_time = string
    end_time   = string
    scope      = string
  }))
  default = []
}

# -----------------------------------------------------------------------------
# Logging and Monitoring
# -----------------------------------------------------------------------------

variable "logging_components" {
  description = "Logging components to enable"
  type        = list(string)
  default     = ["SYSTEM_COMPONENTS", "WORKLOADS"]
}

variable "monitoring_components" {
  description = "Monitoring components to enable"
  type        = list(string)
  default     = ["SYSTEM_COMPONENTS", "WORKLOADS"]
}

variable "enable_managed_prometheus" {
  description = "Enable managed Prometheus for monitoring"
  type        = bool
  default     = true
}

variable "create_monitoring_alerts" {
  description = "Create Cloud Monitoring alerts"
  type        = bool
  default     = true
}

variable "notification_channels" {
  description = "Notification channel IDs for alerts"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Backup Configuration
# -----------------------------------------------------------------------------

variable "enable_backup" {
  description = "Enable GKE Backup"
  type        = bool
  default     = false
}

variable "backup_cron_schedule" {
  description = "Cron schedule for backups"
  type        = string
  default     = "0 2 * * *"
}

variable "backup_retain_days" {
  description = "Days to retain backups"
  type        = number
  default     = 30
}

variable "backup_delete_lock_days" {
  description = "Days to lock backup before deletion"
  type        = number
  default     = 0
}

variable "backup_locked" {
  description = "Lock backup retention policy"
  type        = bool
  default     = false
}

variable "backup_include_volumes" {
  description = "Include volume data in backups"
  type        = bool
  default     = true
}

variable "backup_include_secrets" {
  description = "Include secrets in backups"
  type        = bool
  default     = true
}

variable "backup_all_namespaces" {
  description = "Backup all namespaces"
  type        = bool
  default     = true
}

variable "backup_namespaces" {
  description = "Specific namespaces to backup (if not all)"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Labels
# -----------------------------------------------------------------------------

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}
