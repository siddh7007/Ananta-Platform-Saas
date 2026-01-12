# =============================================================================
# GCP Compute Module - Google Kubernetes Engine (GKE)
# =============================================================================
# This module deploys a production-ready GKE cluster with:
# - Private cluster with authorized networks
# - Node pools with autoscaling
# - Workload identity
# - Network policies
# - Binary authorization
# =============================================================================

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = ">= 5.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  resource_prefix = "${var.name_prefix}-${var.environment}"

  # Common labels
  labels = merge(
    {
      environment = var.environment
      managed-by  = "terraform"
      module      = "compute"
    },
    var.labels
  )

  # Node pool size configurations
  node_configs = {
    small = {
      machine_type   = "e2-standard-2"
      disk_size_gb   = 50
      min_node_count = 1
      max_node_count = 3
    }
    medium = {
      machine_type   = "e2-standard-4"
      disk_size_gb   = 100
      min_node_count = 2
      max_node_count = 5
    }
    large = {
      machine_type   = "e2-standard-8"
      disk_size_gb   = 200
      min_node_count = 3
      max_node_count = 10
    }
    xlarge = {
      machine_type   = "e2-standard-16"
      disk_size_gb   = 500
      min_node_count = 5
      max_node_count = 20
    }
  }

  default_config = local.node_configs[var.cluster_size]
}

# -----------------------------------------------------------------------------
# Service Account for GKE Nodes
# -----------------------------------------------------------------------------

resource "google_service_account" "gke_nodes" {
  account_id   = "${local.resource_prefix}-gke-nodes"
  display_name = "GKE Node Service Account for ${local.resource_prefix}"
  project      = var.project_id
}

# Minimum required roles for GKE nodes
resource "google_project_iam_member" "gke_nodes_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/stackdriver.resourceMetadata.writer",
    "roles/artifactregistry.reader",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

# -----------------------------------------------------------------------------
# GKE Cluster
# -----------------------------------------------------------------------------

resource "google_container_cluster" "main" {
  provider = google-beta

  name     = "${local.resource_prefix}-gke"
  project  = var.project_id
  location = var.region

  # Node locations (zones within the region)
  node_locations = var.node_zones

  # We use separately managed node pools
  remove_default_node_pool = true
  initial_node_count       = 1

  # Network configuration
  network    = var.vpc_network_id
  subnetwork = var.subnet_id

  networking_mode = "VPC_NATIVE"
  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_range_name
    services_secondary_range_name = var.services_range_name
  }

  # Private cluster configuration
  private_cluster_config {
    enable_private_nodes    = var.enable_private_nodes
    enable_private_endpoint = var.enable_private_endpoint
    master_ipv4_cidr_block  = var.master_ipv4_cidr_block

    master_global_access_config {
      enabled = var.master_global_access_enabled
    }
  }

  # Authorized networks for master access
  dynamic "master_authorized_networks_config" {
    for_each = var.enable_master_authorized_networks ? [1] : []
    content {
      dynamic "cidr_blocks" {
        for_each = var.master_authorized_networks
        content {
          cidr_block   = cidr_blocks.value.cidr_block
          display_name = cidr_blocks.value.display_name
        }
      }
    }
  }

  # Cluster addons
  addons_config {
    http_load_balancing {
      disabled = !var.enable_http_load_balancing
    }

    horizontal_pod_autoscaling {
      disabled = !var.enable_horizontal_pod_autoscaling
    }

    network_policy_config {
      disabled = !var.enable_network_policy
    }

    gce_persistent_disk_csi_driver_config {
      enabled = var.enable_gce_pd_csi_driver
    }

    gcs_fuse_csi_driver_config {
      enabled = var.enable_gcs_fuse_csi_driver
    }

    dns_cache_config {
      enabled = var.enable_dns_cache
    }
  }

  # Network policy
  network_policy {
    enabled  = var.enable_network_policy
    provider = var.enable_network_policy ? "CALICO" : "PROVIDER_UNSPECIFIED"
  }

  # Workload Identity
  workload_identity_config {
    workload_pool = var.enable_workload_identity ? "${var.project_id}.svc.id.goog" : null
  }

  # Binary Authorization
  dynamic "binary_authorization" {
    for_each = var.enable_binary_authorization ? [1] : []
    content {
      evaluation_mode = "PROJECT_SINGLETON_POLICY_ENFORCE"
    }
  }

  # Cluster autoscaling (node auto-provisioning)
  dynamic "cluster_autoscaling" {
    for_each = var.enable_cluster_autoscaling ? [1] : []
    content {
      enabled = true

      auto_provisioning_defaults {
        service_account = google_service_account.gke_nodes.email
        oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]

        management {
          auto_upgrade = true
          auto_repair  = true
        }

        disk_type = var.node_disk_type
      }

      resource_limits {
        resource_type = "cpu"
        minimum       = var.autoscaling_cpu_min
        maximum       = var.autoscaling_cpu_max
      }

      resource_limits {
        resource_type = "memory"
        minimum       = var.autoscaling_memory_min
        maximum       = var.autoscaling_memory_max
      }
    }
  }

  # Maintenance window
  maintenance_policy {
    recurring_window {
      start_time = var.maintenance_start_time
      end_time   = var.maintenance_end_time
      recurrence = var.maintenance_recurrence
    }

    dynamic "maintenance_exclusion" {
      for_each = var.maintenance_exclusions
      content {
        exclusion_name = maintenance_exclusion.value.name
        start_time     = maintenance_exclusion.value.start_time
        end_time       = maintenance_exclusion.value.end_time
        exclusion_options {
          scope = maintenance_exclusion.value.scope
        }
      }
    }
  }

  # Release channel
  release_channel {
    channel = var.release_channel
  }

  # Logging and monitoring
  logging_config {
    enable_components = var.logging_components
  }

  monitoring_config {
    enable_components = var.monitoring_components

    managed_prometheus {
      enabled = var.enable_managed_prometheus
    }
  }

  # Security configuration
  enable_shielded_nodes = var.enable_shielded_nodes
  enable_intranode_visibility = var.enable_intranode_visibility

  # Datapath provider (advanced dataplane)
  datapath_provider = var.datapath_provider

  # Gateway API
  dynamic "gateway_api_config" {
    for_each = var.enable_gateway_api ? [1] : []
    content {
      channel = "CHANNEL_STANDARD"
    }
  }

  # DNS config
  dns_config {
    cluster_dns        = var.cluster_dns
    cluster_dns_scope  = var.cluster_dns_scope
    cluster_dns_domain = var.cluster_dns_domain
  }

  # Resource labels
  resource_labels = local.labels

  # Deletion protection
  deletion_protection = var.deletion_protection

  lifecycle {
    ignore_changes = [
      node_pool,
      initial_node_count,
    ]
  }

  depends_on = [google_project_iam_member.gke_nodes_roles]
}

# -----------------------------------------------------------------------------
# Default Node Pool
# -----------------------------------------------------------------------------

resource "google_container_node_pool" "default" {
  name     = "default-pool"
  project  = var.project_id
  location = var.region
  cluster  = google_container_cluster.main.name

  initial_node_count = local.default_config.min_node_count

  # Autoscaling
  autoscaling {
    min_node_count  = local.default_config.min_node_count
    max_node_count  = local.default_config.max_node_count
    location_policy = "BALANCED"
  }

  # Node management
  management {
    auto_repair  = true
    auto_upgrade = true
  }

  # Upgrade settings
  upgrade_settings {
    max_surge       = var.node_pool_max_surge
    max_unavailable = var.node_pool_max_unavailable
    strategy        = "SURGE"
  }

  # Node configuration
  node_config {
    machine_type = coalesce(var.node_machine_type, local.default_config.machine_type)
    disk_size_gb = coalesce(var.node_disk_size_gb, local.default_config.disk_size_gb)
    disk_type    = var.node_disk_type

    # Service account
    service_account = google_service_account.gke_nodes.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]

    # Shielded instance config
    shielded_instance_config {
      enable_secure_boot          = var.enable_secure_boot
      enable_integrity_monitoring = var.enable_integrity_monitoring
    }

    # Workload metadata config
    workload_metadata_config {
      mode = var.enable_workload_identity ? "GKE_METADATA" : "MODE_UNSPECIFIED"
    }

    # Spot VMs (for cost savings in non-prod)
    spot = var.use_spot_instances

    # Labels and taints
    labels = merge(local.labels, {
      node-pool = "default"
    })

    dynamic "taint" {
      for_each = var.default_node_pool_taints
      content {
        key    = taint.value.key
        value  = taint.value.value
        effect = taint.value.effect
      }
    }

    # Metadata
    metadata = {
      disable-legacy-endpoints = "true"
    }

    # Tags for firewall rules
    tags = concat(["gke-node", "${local.resource_prefix}-gke-node"], var.node_tags)
  }

  lifecycle {
    ignore_changes = [
      initial_node_count,
    ]
  }
}

# -----------------------------------------------------------------------------
# Additional Node Pools
# -----------------------------------------------------------------------------

resource "google_container_node_pool" "additional" {
  for_each = var.additional_node_pools

  name     = each.key
  project  = var.project_id
  location = var.region
  cluster  = google_container_cluster.main.name

  initial_node_count = each.value.min_node_count

  # Autoscaling
  autoscaling {
    min_node_count  = each.value.min_node_count
    max_node_count  = each.value.max_node_count
    location_policy = "BALANCED"
  }

  # Node management
  management {
    auto_repair  = true
    auto_upgrade = each.value.auto_upgrade
  }

  # Node configuration
  node_config {
    machine_type = each.value.machine_type
    disk_size_gb = each.value.disk_size_gb
    disk_type    = each.value.disk_type

    # GPU config
    dynamic "guest_accelerator" {
      for_each = each.value.gpu_type != null ? [1] : []
      content {
        type  = each.value.gpu_type
        count = each.value.gpu_count
      }
    }

    # Service account
    service_account = google_service_account.gke_nodes.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]

    # Shielded instance config
    shielded_instance_config {
      enable_secure_boot          = var.enable_secure_boot
      enable_integrity_monitoring = var.enable_integrity_monitoring
    }

    # Workload metadata config
    workload_metadata_config {
      mode = var.enable_workload_identity ? "GKE_METADATA" : "MODE_UNSPECIFIED"
    }

    # Spot VMs
    spot = each.value.use_spot

    # Labels and taints
    labels = merge(local.labels, {
      node-pool = each.key
    }, each.value.labels)

    dynamic "taint" {
      for_each = each.value.taints
      content {
        key    = taint.value.key
        value  = taint.value.value
        effect = taint.value.effect
      }
    }

    # Metadata
    metadata = {
      disable-legacy-endpoints = "true"
    }

    # Tags
    tags = concat(["gke-node", "${local.resource_prefix}-gke-node"], each.value.tags)
  }
}

# -----------------------------------------------------------------------------
# Backup Configuration (GKE Backup)
# -----------------------------------------------------------------------------

resource "google_gke_backup_backup_plan" "main" {
  count = var.enable_backup ? 1 : 0

  name     = "${local.resource_prefix}-backup-plan"
  project  = var.project_id
  location = var.region
  cluster  = google_container_cluster.main.id

  retention_policy {
    backup_delete_lock_days = var.backup_delete_lock_days
    backup_retain_days      = var.backup_retain_days
    locked                  = var.backup_locked
  }

  backup_schedule {
    cron_schedule = var.backup_cron_schedule
  }

  backup_config {
    include_volume_data = var.backup_include_volumes
    include_secrets     = var.backup_include_secrets
    all_namespaces      = var.backup_all_namespaces

    dynamic "selected_namespaces" {
      for_each = !var.backup_all_namespaces && length(var.backup_namespaces) > 0 ? [1] : []
      content {
        namespaces = var.backup_namespaces
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Cloud Monitoring Alerts
# -----------------------------------------------------------------------------

resource "google_monitoring_alert_policy" "node_cpu_high" {
  count        = var.create_monitoring_alerts ? 1 : 0
  display_name = "${local.resource_prefix}-gke-node-cpu-high"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Node CPU > 80%"

    condition_threshold {
      filter          = "resource.type = \"k8s_node\" AND resource.labels.cluster_name = \"${google_container_cluster.main.name}\" AND metric.type = \"kubernetes.io/node/cpu/allocatable_utilization\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = local.labels
}

resource "google_monitoring_alert_policy" "node_memory_high" {
  count        = var.create_monitoring_alerts ? 1 : 0
  display_name = "${local.resource_prefix}-gke-node-memory-high"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Node Memory > 80%"

    condition_threshold {
      filter          = "resource.type = \"k8s_node\" AND resource.labels.cluster_name = \"${google_container_cluster.main.name}\" AND metric.type = \"kubernetes.io/node/memory/allocatable_utilization\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = local.labels
}

resource "google_monitoring_alert_policy" "pod_restart" {
  count        = var.create_monitoring_alerts ? 1 : 0
  display_name = "${local.resource_prefix}-gke-pod-restarts"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Pod restart rate high"

    condition_threshold {
      filter          = "resource.type = \"k8s_container\" AND resource.labels.cluster_name = \"${google_container_cluster.main.name}\" AND metric.type = \"kubernetes.io/container/restart_count\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 5

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.label.pod_name"]
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = local.labels
}
