# =============================================================================
# Kubernetes PostgreSQL Module (Bitnami Helm Chart)
# =============================================================================
# This module deploys PostgreSQL on Kubernetes using the Bitnami Helm chart.
# Simpler alternative to CloudNativePG for local/dev environments.
# =============================================================================

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = ">= 2.12"
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
  # Map normalized instance sizes to Kubernetes resources
  resource_map = {
    micro = {
      memory_request = "256Mi"
      memory_limit   = "512Mi"
      cpu_request    = "250m"
      cpu_limit      = "500m"
    }
    small = {
      memory_request = "512Mi"
      memory_limit   = "1Gi"
      cpu_request    = "500m"
      cpu_limit      = "1"
    }
    medium = {
      memory_request = "2Gi"
      memory_limit   = "4Gi"
      cpu_request    = "1"
      cpu_limit      = "2"
    }
    large = {
      memory_request = "4Gi"
      memory_limit   = "8Gi"
      cpu_request    = "2"
      cpu_limit      = "4"
    }
    xlarge = {
      memory_request = "8Gi"
      memory_limit   = "16Gi"
      cpu_request    = "4"
      cpu_limit      = "8"
    }
  }

  resources = lookup(local.resource_map, var.instance_size, local.resource_map["small"])

  # Resource naming
  release_name = "${var.name_prefix}-postgresql"

  # Common labels
  labels = merge(
    {
      "app.kubernetes.io/name"       = "postgresql"
      "app.kubernetes.io/instance"   = local.release_name
      "app.kubernetes.io/component"  = "database"
      "app.kubernetes.io/managed-by" = "terraform-helm"
      "environment"                  = var.environment
    },
    var.labels
  )
}

# -----------------------------------------------------------------------------
# Random Password Generation
# -----------------------------------------------------------------------------

resource "random_password" "superuser" {
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}:?"
}

resource "random_password" "app_user" {
  count            = var.app_username != "" ? 1 : 0
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}:?"
}

resource "random_password" "replication" {
  count            = var.high_availability ? 1 : 0
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}:?"
}

# -----------------------------------------------------------------------------
# Namespace (optional)
# -----------------------------------------------------------------------------

resource "kubernetes_namespace" "database" {
  count = var.create_namespace ? 1 : 0

  metadata {
    name   = var.namespace
    labels = local.labels
  }
}

# -----------------------------------------------------------------------------
# PostgreSQL Helm Release (Bitnami)
# -----------------------------------------------------------------------------

resource "helm_release" "postgresql" {
  name             = local.release_name
  namespace        = var.namespace
  create_namespace = var.create_namespace && !var.create_namespace
  repository       = "https://charts.bitnami.com/bitnami"
  chart            = "postgresql"
  version          = var.chart_version

  wait          = true
  wait_for_jobs = true
  timeout       = 600

  values = [yamlencode({
    # Global settings
    fullnameOverride = local.release_name

    # Image configuration
    image = {
      registry   = "docker.io"
      repository = "bitnami/postgresql"
      tag        = var.engine_version
    }

    # Authentication
    auth = {
      postgresPassword = random_password.superuser.result
      username         = var.app_username != "" ? var.app_username : null
      password         = var.app_username != "" ? random_password.app_user[0].result : null
      database         = var.database_name
      replicationUsername = var.high_availability ? "replicator" : null
      replicationPassword = var.high_availability ? random_password.replication[0].result : null
    }

    # Architecture: standalone or replication
    architecture = var.high_availability ? "replication" : "standalone"

    # Primary configuration
    primary = {
      # Resources
      resources = {
        requests = {
          cpu    = local.resources.cpu_request
          memory = local.resources.memory_request
        }
        limits = {
          cpu    = local.resources.cpu_limit
          memory = local.resources.memory_limit
        }
      }

      # Persistence
      persistence = {
        enabled      = true
        storageClass = var.storage_class
        size         = "${var.storage_gb}Gi"
      }

      # PostgreSQL configuration
      extendedConfiguration = join("\n", [
        "max_connections = ${var.max_connections}",
        "shared_buffers = ${var.shared_buffers}",
        "effective_cache_size = ${var.effective_cache_size}",
        "maintenance_work_mem = ${var.maintenance_work_mem}",
        "checkpoint_completion_target = 0.9",
        "wal_buffers = 16MB",
        "default_statistics_target = 100",
        "random_page_cost = 1.1",
        "effective_io_concurrency = 200",
        "min_wal_size = 256MB",
        "max_wal_size = 1GB",
        "log_checkpoints = on",
        "log_connections = on",
        "log_disconnections = on",
        "log_lock_waits = on",
      ])

      # Init scripts (create additional databases)
      initdb = var.additional_databases != [] ? {
        scripts = {
          "init-databases.sql" = join("\n", [
            for db in var.additional_databases :
            "SELECT 'CREATE DATABASE ${db}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${db}')\\gexec"
          ])
        }
      } : null

      # Service configuration
      service = {
        type = var.service_type
        ports = {
          postgresql = 5432
        }
      }
    }

    # Read replicas (if HA enabled)
    readReplicas = var.high_availability ? {
      replicaCount = var.replica_count
      resources = {
        requests = {
          cpu    = local.resources.cpu_request
          memory = local.resources.memory_request
        }
        limits = {
          cpu    = local.resources.cpu_limit
          memory = local.resources.memory_limit
        }
      }
      persistence = {
        enabled      = true
        storageClass = var.storage_class
        size         = "${var.storage_gb}Gi"
      }
    } : {
      replicaCount = 0
    }

    # Metrics (Prometheus exporter)
    metrics = {
      enabled = var.enable_monitoring
      serviceMonitor = {
        enabled = var.create_service_monitor
      }
    }

    # Common labels
    commonLabels = local.labels
  })]

  depends_on = [kubernetes_namespace.database]
}

# -----------------------------------------------------------------------------
# Kubernetes Secret for Connection Details
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "connection" {
  metadata {
    name      = "${local.release_name}-connection"
    namespace = var.namespace
    labels    = local.labels
  }

  data = {
    host              = "${local.release_name}.${var.namespace}.svc.cluster.local"
    port              = "5432"
    database          = var.database_name
    username          = "postgres"
    password          = random_password.superuser.result
    app_username      = var.app_username
    app_password      = var.app_username != "" ? random_password.app_user[0].result : ""
    connection_string = "postgresql://postgres:${random_password.superuser.result}@${local.release_name}.${var.namespace}.svc.cluster.local:5432/${var.database_name}"
  }

  type = "Opaque"

  depends_on = [helm_release.postgresql]
}
