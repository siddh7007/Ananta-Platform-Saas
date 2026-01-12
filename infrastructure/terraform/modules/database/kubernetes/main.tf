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
    local = {
      source  = "hashicorp/local"
      version = ">= 2.4"
    }
    null = {
      source  = "hashicorp/null"
      version = ">= 3.2"
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
# Using local_file + null_resource instead of kubernetes_manifest to avoid
# provider bug with CNPG controller adding default parameters

resource "local_file" "cluster_manifest" {
  filename = "${path.module}/generated/${local.cluster_name}.yaml"
  content  = yamlencode({
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
        }
      }

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
      }

      # Monitoring
      monitoring = {
        enablePodMonitor = var.enable_monitoring
      }

      # Affinity rules (includes nodeSelector and tolerations for CNPG)
      affinity = {
        podAntiAffinityType = "preferred"
        topologyKey         = "kubernetes.io/hostname"
      }
    }
  })

  depends_on = [
    helm_release.cloudnative_pg,
    kubernetes_secret.superuser,
    kubernetes_secret.app_user
  ]
}

resource "null_resource" "cluster" {
  triggers = {
    manifest_sha = local_file.cluster_manifest.content_md5
    cluster_name = local.cluster_name
    namespace    = var.namespace
  }

  provisioner "local-exec" {
    command = "kubectl apply -f ${local_file.cluster_manifest.filename}"
  }

  provisioner "local-exec" {
    when    = destroy
    command = "kubectl delete cluster ${self.triggers.cluster_name} -n ${self.triggers.namespace} --ignore-not-found=true"
  }

  depends_on = [local_file.cluster_manifest]
}

# -----------------------------------------------------------------------------
# Pooler (PgBouncer) for Connection Pooling
# -----------------------------------------------------------------------------
# Disabled for now - can be enabled with create_pooler variable
# The Pooler resource also has kubernetes_manifest issues with CNPG

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

  depends_on = [null_resource.cluster]
}

# -----------------------------------------------------------------------------
# PrometheusRule for Alerting (if Prometheus Operator is installed)
# -----------------------------------------------------------------------------
# Disabled for local environment - requires Prometheus Operator CRDs
