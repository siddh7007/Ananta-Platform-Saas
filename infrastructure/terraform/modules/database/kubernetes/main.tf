# =============================================================================
# Kubernetes PostgreSQL Module (CloudNativePG Operator)
# =============================================================================
# This module deploys PostgreSQL on Kubernetes using the CloudNativePG operator.
# It provides cloud-agnostic database deployment on any Kubernetes cluster.
# =============================================================================

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = ">= 2.10"
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
  cluster_name = "${var.name_prefix}-${var.environment}-pg"

  # Common labels
  labels = merge(
    {
      "app.kubernetes.io/name"       = "postgresql"
      "app.kubernetes.io/instance"   = local.cluster_name
      "app.kubernetes.io/component"  = "database"
      "app.kubernetes.io/managed-by" = "terraform"
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
# CloudNativePG Operator Installation (via Helm)
# -----------------------------------------------------------------------------

resource "helm_release" "cloudnative_pg" {
  count = var.install_operator ? 1 : 0

  name             = "cnpg"
  repository       = "https://cloudnative-pg.github.io/charts"
  chart            = "cloudnative-pg"
  version          = var.operator_version
  namespace        = var.operator_namespace
  create_namespace = true

  values = [
    yamlencode({
      resources = {
        requests = {
          cpu    = "100m"
          memory = "256Mi"
        }
        limits = {
          cpu    = "500m"
          memory = "512Mi"
        }
      }
      monitoring = {
        podMonitorEnabled = var.enable_monitoring
      }
    })
  ]
}

# -----------------------------------------------------------------------------
# Database Credentials Secret
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "superuser" {
  metadata {
    name      = "${local.cluster_name}-superuser"
    namespace = var.namespace
    labels    = local.labels
  }

  data = {
    username = "postgres"
    password = random_password.superuser.result
  }

  type = "kubernetes.io/basic-auth"

  depends_on = [kubernetes_namespace.database]
}

resource "kubernetes_secret" "app_user" {
  metadata {
    name      = "${local.cluster_name}-app"
    namespace = var.namespace
    labels    = local.labels
  }

  data = {
    username = var.app_username
    password = random_password.app_user.result
  }

  type = "kubernetes.io/basic-auth"

  depends_on = [kubernetes_namespace.database]
}

# -----------------------------------------------------------------------------
# CloudNativePG Cluster
# -----------------------------------------------------------------------------

resource "kubernetes_manifest" "cluster" {
  manifest = {
    apiVersion = "postgresql.cnpg.io/v1"
    kind       = "Cluster"

    metadata = {
      name      = local.cluster_name
      namespace = var.namespace
      labels    = local.labels
    }

    spec = {
      description = "PostgreSQL cluster for ${var.name_prefix} ${var.environment}"

      # PostgreSQL image version
      imageName = "ghcr.io/cloudnative-pg/postgresql:${var.engine_version}"

      # Number of instances (primary + replicas)
      instances = var.high_availability ? (var.replica_count + 1) : 1

      # Primary update strategy
      primaryUpdateStrategy = "unsupervised"

      # Storage configuration
      storage = {
        size         = "${var.storage_gb}Gi"
        storageClass = var.storage_class
      }

      # Resource limits
      resources = {
        requests = {
          memory = local.resources.memory_request
          cpu    = local.resources.cpu_request
        }
        limits = {
          memory = local.resources.memory_limit
          cpu    = local.resources.cpu_limit
        }
      }

      # Superuser secret
      superuserSecret = {
        name = kubernetes_secret.superuser.metadata[0].name
      }

      # Bootstrap configuration
      bootstrap = {
        initdb = {
          database = var.database_name
          owner    = var.app_username
          secret = {
            name = kubernetes_secret.app_user.metadata[0].name
          }
          postInitApplicationSQL = var.init_sql
        }
      }

      # Backup configuration
      backup = var.enable_backup ? {
        barmanObjectStore = {
          destinationPath = var.backup_destination
          s3Credentials   = var.backup_s3_credentials
          wal = {
            compression = "gzip"
          }
        }
        retentionPolicy = "${var.backup_retention_days}d"
      } : null

      # PostgreSQL configuration
      postgresql = {
        parameters = merge(
          {
            max_connections        = tostring(var.max_connections)
            shared_buffers         = var.shared_buffers
            effective_cache_size   = var.effective_cache_size
            maintenance_work_mem   = var.maintenance_work_mem
            checkpoint_completion_target = "0.9"
            wal_buffers            = "16MB"
            default_statistics_target = "100"
            random_page_cost       = "1.1"
            effective_io_concurrency = "200"
            min_wal_size           = "1GB"
            max_wal_size           = "4GB"
            log_checkpoints        = "on"
            log_connections        = "on"
            log_disconnections     = "on"
            log_lock_waits         = "on"
          },
          var.postgresql_parameters
        )
        pg_hba = var.pg_hba_rules
      }

      # Monitoring
      monitoring = var.enable_monitoring ? {
        enablePodMonitor = true
        customQueriesConfigMap = var.custom_queries_configmap
      } : null

      # Affinity rules
      affinity = var.enable_pod_antiaffinity ? {
        podAntiAffinityType = "preferred"
        topologyKey         = "kubernetes.io/hostname"
      } : null

      # Node selector
      nodeSelector = var.node_selector

      # Tolerations
      tolerations = var.tolerations
    }
  }

  depends_on = [
    helm_release.cloudnative_pg,
    kubernetes_secret.superuser,
    kubernetes_secret.app_user
  ]
}

# -----------------------------------------------------------------------------
# Pooler (PgBouncer) for Connection Pooling
# -----------------------------------------------------------------------------

resource "kubernetes_manifest" "pooler" {
  count = var.create_pooler ? 1 : 0

  manifest = {
    apiVersion = "postgresql.cnpg.io/v1"
    kind       = "Pooler"

    metadata = {
      name      = "${local.cluster_name}-pooler"
      namespace = var.namespace
      labels    = local.labels
    }

    spec = {
      cluster = {
        name = local.cluster_name
      }

      instances = var.pooler_instances
      type      = "rw"

      pgbouncer = {
        poolMode = var.pooler_mode
        parameters = {
          max_client_conn = tostring(var.pooler_max_client_conn)
          default_pool_size = tostring(var.pooler_default_pool_size)
        }
      }

      template = {
        spec = {
          containers = [{
            name = "pgbouncer"
            resources = {
              requests = {
                cpu    = "100m"
                memory = "128Mi"
              }
              limits = {
                cpu    = "500m"
                memory = "256Mi"
              }
            }
          }]
        }
      }
    }
  }

  depends_on = [kubernetes_manifest.cluster]
}

# -----------------------------------------------------------------------------
# Service for external access
# -----------------------------------------------------------------------------

resource "kubernetes_service" "database" {
  count = var.create_external_service ? 1 : 0

  metadata {
    name      = "${local.cluster_name}-external"
    namespace = var.namespace
    labels    = local.labels
    annotations = var.service_annotations
  }

  spec {
    selector = {
      "cnpg.io/cluster" = local.cluster_name
      "role"            = "primary"
    }

    port {
      name        = "postgresql"
      port        = 5432
      target_port = 5432
    }

    type = var.service_type
  }

  depends_on = [kubernetes_manifest.cluster]
}

# -----------------------------------------------------------------------------
# PrometheusRule for Alerting (if Prometheus Operator is installed)
# -----------------------------------------------------------------------------

resource "kubernetes_manifest" "prometheus_rules" {
  count = var.enable_monitoring && var.create_prometheus_rules ? 1 : 0

  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "PrometheusRule"

    metadata = {
      name      = "${local.cluster_name}-alerts"
      namespace = var.namespace
      labels = merge(local.labels, {
        "prometheus" = "kube-prometheus"
      })
    }

    spec = {
      groups = [{
        name = "postgresql.rules"
        rules = [
          {
            alert = "PostgreSQLDown"
            expr  = "cnpg_pg_up == 0"
            for   = "5m"
            labels = {
              severity = "critical"
            }
            annotations = {
              summary     = "PostgreSQL instance is down"
              description = "PostgreSQL instance {{ $labels.instance }} has been down for more than 5 minutes."
            }
          },
          {
            alert = "PostgreSQLHighConnections"
            expr  = "cnpg_pg_stat_activity_count / cnpg_pg_settings_setting{name=\"max_connections\"} > 0.8"
            for   = "5m"
            labels = {
              severity = "warning"
            }
            annotations = {
              summary     = "PostgreSQL connection count is high"
              description = "PostgreSQL instance {{ $labels.instance }} has more than 80% connections in use."
            }
          },
          {
            alert = "PostgreSQLReplicationLag"
            expr  = "cnpg_pg_replication_lag > 30"
            for   = "5m"
            labels = {
              severity = "warning"
            }
            annotations = {
              summary     = "PostgreSQL replication lag is high"
              description = "PostgreSQL instance {{ $labels.instance }} has replication lag of {{ $value }} seconds."
            }
          }
        ]
      }]
    }
  }

  depends_on = [kubernetes_manifest.cluster]
}
