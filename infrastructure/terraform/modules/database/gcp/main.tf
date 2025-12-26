# =============================================================================
# GCP Cloud SQL PostgreSQL Module
# =============================================================================
# This module deploys Cloud SQL for PostgreSQL on Google Cloud Platform
# with private IP, high availability, backups, and read replicas.
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
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  # Map normalized instance sizes to GCP Cloud SQL tiers
  tier_map = {
    micro  = "db-f1-micro"
    small  = "db-g1-small"
    medium = "db-custom-2-4096"
    large  = "db-custom-4-8192"
    xlarge = "db-custom-8-16384"
  }

  tier = lookup(local.tier_map, var.instance_size, "db-custom-2-4096")

  # Resource naming
  resource_prefix = "${var.name_prefix}-${var.environment}"

  # Common labels
  labels = merge(
    {
      environment = var.environment
      managed-by  = "terraform"
      module      = "database"
    },
    var.labels
  )
}

# -----------------------------------------------------------------------------
# Random Password Generation
# -----------------------------------------------------------------------------

resource "random_password" "master" {
  length  = 24
  special = true
  # Cloud SQL has specific character restrictions
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_id" "suffix" {
  byte_length = 4
}

# -----------------------------------------------------------------------------
# Cloud SQL PostgreSQL Instance
# -----------------------------------------------------------------------------

resource "google_sql_database_instance" "main" {
  provider = google-beta

  name             = "${local.resource_prefix}-postgres-${random_id.suffix.hex}"
  database_version = "POSTGRES_${replace(var.engine_version, ".", "_")}"
  region           = var.region
  project          = var.project_id

  deletion_protection = var.deletion_protection

  settings {
    tier              = local.tier
    availability_type = var.high_availability ? "REGIONAL" : "ZONAL"
    disk_size         = var.storage_gb
    disk_type         = var.disk_type
    disk_autoresize   = true
    disk_autoresize_limit = var.max_storage_gb

    # Backup configuration
    backup_configuration {
      enabled                        = true
      start_time                     = var.backup_start_time
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = var.backup_retention_days
        retention_unit   = "COUNT"
      }
    }

    # Maintenance window
    maintenance_window {
      day          = var.maintenance_window_day
      hour         = var.maintenance_window_hour
      update_track = "stable"
    }

    # IP configuration - private only
    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.vpc_network_id
      enable_private_path_for_google_cloud_services = true

      dynamic "authorized_networks" {
        for_each = var.authorized_networks
        content {
          name  = authorized_networks.value.name
          value = authorized_networks.value.cidr
        }
      }
    }

    # Database flags
    dynamic "database_flags" {
      for_each = var.database_flags
      content {
        name  = database_flags.value.name
        value = database_flags.value.value
      }
    }

    # Default database flags for PostgreSQL
    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }

    database_flags {
      name  = "log_lock_waits"
      value = "on"
    }

    # Insights configuration
    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }

    user_labels = local.labels
  }

  lifecycle {
    prevent_destroy = false
    ignore_changes  = [settings[0].disk_size]
  }
}

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------

resource "google_sql_database" "main" {
  name     = var.database_name
  instance = google_sql_database_instance.main.name
  project  = var.project_id

  charset   = "UTF8"
  collation = "en_US.UTF8"

  deletion_policy = "ABANDON"
}

# -----------------------------------------------------------------------------
# Database User
# -----------------------------------------------------------------------------

resource "google_sql_user" "master" {
  name     = var.master_username
  instance = google_sql_database_instance.main.name
  project  = var.project_id
  password = random_password.master.result

  deletion_policy = "ABANDON"
}

# -----------------------------------------------------------------------------
# Read Replicas
# -----------------------------------------------------------------------------

resource "google_sql_database_instance" "replica" {
  count    = var.create_read_replica ? var.replica_count : 0
  provider = google-beta

  name                 = "${local.resource_prefix}-postgres-replica-${count.index + 1}-${random_id.suffix.hex}"
  master_instance_name = google_sql_database_instance.main.name
  database_version     = google_sql_database_instance.main.database_version
  region               = var.region
  project              = var.project_id

  replica_configuration {
    failover_target = false
  }

  settings {
    tier            = lookup(local.tier_map, var.replica_instance_size, local.tier)
    disk_size       = var.storage_gb
    disk_type       = var.disk_type
    disk_autoresize = true

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_network_id
    }

    # Insights for replicas too
    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }

    user_labels = merge(local.labels, {
      replica = "true"
      index   = tostring(count.index + 1)
    })
  }

  deletion_protection = var.deletion_protection

  lifecycle {
    prevent_destroy = false
  }

  depends_on = [google_sql_database_instance.main]
}

# -----------------------------------------------------------------------------
# Secret Manager - Store credentials
# -----------------------------------------------------------------------------

resource "google_secret_manager_secret" "db_credentials" {
  count     = var.create_secret ? 1 : 0
  secret_id = "${local.resource_prefix}-db-credentials"
  project   = var.project_id

  labels = local.labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_credentials" {
  count  = var.create_secret ? 1 : 0
  secret = google_secret_manager_secret.db_credentials[0].id

  secret_data = jsonencode({
    host     = google_sql_database_instance.main.private_ip_address
    port     = 5432
    database = var.database_name
    username = var.master_username
    password = random_password.master.result
    connection_string = "postgresql://${var.master_username}:${random_password.master.result}@${google_sql_database_instance.main.private_ip_address}:5432/${var.database_name}?sslmode=require"
  })
}

# -----------------------------------------------------------------------------
# Cloud Monitoring Alerts
# -----------------------------------------------------------------------------

resource "google_monitoring_alert_policy" "cpu_high" {
  count        = var.create_monitoring_alerts ? 1 : 0
  display_name = "${local.resource_prefix}-database-cpu-high"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "CPU Utilization > 80%"

    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND metric.type = \"cloudsql.googleapis.com/database/cpu/utilization\" AND resource.label.database_id = \"${var.project_id}:${google_sql_database_instance.main.name}\""
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

resource "google_monitoring_alert_policy" "memory_high" {
  count        = var.create_monitoring_alerts ? 1 : 0
  display_name = "${local.resource_prefix}-database-memory-high"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Memory Utilization > 80%"

    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND metric.type = \"cloudsql.googleapis.com/database/memory/utilization\" AND resource.label.database_id = \"${var.project_id}:${google_sql_database_instance.main.name}\""
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

resource "google_monitoring_alert_policy" "disk_high" {
  count        = var.create_monitoring_alerts ? 1 : 0
  display_name = "${local.resource_prefix}-database-disk-high"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Disk Utilization > 85%"

    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND metric.type = \"cloudsql.googleapis.com/database/disk/utilization\" AND resource.label.database_id = \"${var.project_id}:${google_sql_database_instance.main.name}\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.85

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

resource "google_monitoring_alert_policy" "connections_high" {
  count        = var.create_monitoring_alerts ? 1 : 0
  display_name = "${local.resource_prefix}-database-connections-high"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Active Connections > 80% of max"

    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND metric.type = \"cloudsql.googleapis.com/database/postgresql/num_backends\" AND resource.label.database_id = \"${var.project_id}:${google_sql_database_instance.main.name}\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.max_connections * 0.8

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
