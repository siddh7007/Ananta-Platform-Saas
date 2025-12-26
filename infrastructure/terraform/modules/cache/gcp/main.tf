# =============================================================================
# GCP Cache Module - Cloud Memorystore for Redis Implementation
# =============================================================================
# GCP-specific implementation of the cloud-agnostic cache interface.
# Uses Google Cloud Memorystore for Redis.
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables - Tier and Memory Mapping
# -----------------------------------------------------------------------------

locals {
  # Map normalized sizes to Memorystore memory sizes (GB)
  memory_size_map = {
    micro  = 1   # 1 GB
    small  = 2   # 2 GB
    medium = 5   # 5 GB
    large  = 10  # 10 GB
    xlarge = 25  # 25 GB
  }

  memory_size_gb = lookup(local.memory_size_map, var.instance_size, 2)

  # Tier based on HA requirements
  tier = var.high_availability ? "STANDARD_HA" : "BASIC"

  # Redis version normalization
  redis_version = "REDIS_${replace(var.engine_version, ".", "_")}"
}

# -----------------------------------------------------------------------------
# Memorystore Redis Instance
# -----------------------------------------------------------------------------

resource "google_redis_instance" "main" {
  name           = "${var.name_prefix}-redis"
  project        = var.project_id
  region         = var.region
  tier           = local.tier
  memory_size_gb = local.memory_size_gb
  redis_version  = local.redis_version

  # Display name
  display_name = "${var.name_prefix} Redis (${var.environment})"

  # Network configuration
  authorized_network = var.vpc_network_id
  connect_mode       = var.connect_mode
  reserved_ip_range  = var.reserved_ip_range

  # Redis configuration
  redis_configs = merge({
    maxmemory-policy = var.maxmemory_policy
    notify-keyspace-events = var.notify_keyspace_events
  }, var.redis_configs)

  # Auth
  auth_enabled = var.auth_enabled

  # Encryption
  transit_encryption_mode = var.encryption_in_transit ? "SERVER_AUTHENTICATION" : "DISABLED"

  # Maintenance window
  dynamic "maintenance_policy" {
    for_each = var.maintenance_window != null ? [var.maintenance_window] : []
    content {
      weekly_maintenance_window {
        day = maintenance_policy.value.day
        start_time {
          hours   = maintenance_policy.value.hour
          minutes = 0
          seconds = 0
          nanos   = 0
        }
      }
    }
  }

  # Read replicas (Standard tier only)
  replica_count       = local.tier == "STANDARD_HA" ? var.replica_count : null
  read_replicas_mode  = local.tier == "STANDARD_HA" && var.replica_count > 0 ? "READ_REPLICAS_ENABLED" : "READ_REPLICAS_DISABLED"

  # Persistence (RDB snapshots)
  dynamic "persistence_config" {
    for_each = var.enable_persistence ? [1] : []
    content {
      persistence_mode    = "RDB"
      rdb_snapshot_period = var.rdb_snapshot_period
    }
  }

  labels = merge(var.labels, {
    environment = var.environment
    managed-by  = "terraform"
  })

  lifecycle {
    ignore_changes = [
      redis_version,  # Managed via maintenance windows
    ]
  }
}

# -----------------------------------------------------------------------------
# Secret Manager - Auth String (Optional)
# -----------------------------------------------------------------------------

resource "google_secret_manager_secret" "auth_string" {
  count     = var.auth_enabled && var.create_secret ? 1 : 0
  project   = var.project_id
  secret_id = "${var.name_prefix}-redis-auth"

  replication {
    auto {}
  }

  labels = var.labels
}

resource "google_secret_manager_secret_version" "auth_string" {
  count       = var.auth_enabled && var.create_secret ? 1 : 0
  secret      = google_secret_manager_secret.auth_string[0].id
  secret_data = google_redis_instance.main.auth_string
}

# -----------------------------------------------------------------------------
# Cloud Monitoring Alerts
# -----------------------------------------------------------------------------

resource "google_monitoring_alert_policy" "memory_usage" {
  count        = var.create_alerts ? 1 : 0
  project      = var.project_id
  display_name = "${var.name_prefix}-redis-memory-usage"
  combiner     = "OR"

  conditions {
    display_name = "Memory Usage High"

    condition_threshold {
      filter          = "resource.type = \"redis_instance\" AND resource.labels.instance_id = \"${google_redis_instance.main.name}\" AND metric.type = \"redis.googleapis.com/stats/memory/usage_ratio\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "86400s"
  }
}

resource "google_monitoring_alert_policy" "cpu_usage" {
  count        = var.create_alerts ? 1 : 0
  project      = var.project_id
  display_name = "${var.name_prefix}-redis-cpu-usage"
  combiner     = "OR"

  conditions {
    display_name = "CPU Usage High"

    condition_threshold {
      filter          = "resource.type = \"redis_instance\" AND resource.labels.instance_id = \"${google_redis_instance.main.name}\" AND metric.type = \"redis.googleapis.com/stats/cpu_utilization\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.75

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "86400s"
  }
}

resource "google_monitoring_alert_policy" "evictions" {
  count        = var.create_alerts ? 1 : 0
  project      = var.project_id
  display_name = "${var.name_prefix}-redis-evictions"
  combiner     = "OR"

  conditions {
    display_name = "High Eviction Rate"

    condition_threshold {
      filter          = "resource.type = \"redis_instance\" AND resource.labels.instance_id = \"${google_redis_instance.main.name}\" AND metric.type = \"redis.googleapis.com/stats/evicted_keys\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.evictions_threshold

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "86400s"
  }
}
