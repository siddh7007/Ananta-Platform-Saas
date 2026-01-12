# =============================================================================
# Control Plane Kubernetes Module
# =============================================================================
# Deploys ARC-SaaS control plane services to Kubernetes:
# - tenant-management-service (port 14000)
# - temporal-worker-service
# - subscription-service (port 3002)
# - orchestrator-service (port 3003)
# =============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.20"
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
  # Resource naming
  service_prefix = "${var.name_prefix}-${var.environment}"

  # Common labels for all resources
  common_labels = merge(
    {
      "app.kubernetes.io/part-of"    = "ananta-control-plane"
      "app.kubernetes.io/managed-by" = "terraform"
      "environment"                  = var.environment
      "plane"                        = "control"
    },
    var.labels
  )

  # Service-specific labels
  tenant_mgmt_labels = merge(
    local.common_labels,
    {
      "app.kubernetes.io/name"      = "tenant-management-service"
      "app.kubernetes.io/component" = "api"
    }
  )

  temporal_worker_labels = merge(
    local.common_labels,
    {
      "app.kubernetes.io/name"      = "temporal-worker-service"
      "app.kubernetes.io/component" = "worker"
    }
  )

  subscription_labels = merge(
    local.common_labels,
    {
      "app.kubernetes.io/name"      = "subscription-service"
      "app.kubernetes.io/component" = "api"
    }
  )

  orchestrator_labels = merge(
    local.common_labels,
    {
      "app.kubernetes.io/name"      = "orchestrator-service"
      "app.kubernetes.io/component" = "api"
    }
  )
}

# -----------------------------------------------------------------------------
# Namespace
# -----------------------------------------------------------------------------

resource "kubernetes_namespace" "control_plane" {
  count = var.create_namespace ? 1 : 0

  metadata {
    name   = var.namespace
    labels = local.common_labels
  }
}

# -----------------------------------------------------------------------------
# Secrets
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "control_plane_secrets" {
  metadata {
    name      = "${local.service_prefix}-secrets"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    # Database credentials
    DB_HOST                = var.database_host
    DB_PORT                = tostring(var.database_port)
    DB_DATABASE            = var.database_name
    DB_USER                = var.database_user
    DB_PASSWORD            = var.database_password
    DB_SCHEMA              = var.database_schema

    # Redis credentials
    REDIS_HOST             = var.redis_host
    REDIS_PORT             = tostring(var.redis_port)
    REDIS_PASSWORD         = var.redis_password
    REDIS_DATABASE         = tostring(var.redis_database)

    # JWT secrets
    JWT_SECRET             = var.jwt_secret
    JWT_ISSUER             = var.jwt_issuer

    # Keycloak config
    KEYCLOAK_URL           = var.keycloak_url
    KEYCLOAK_REALM         = var.keycloak_realm
    KEYCLOAK_CLIENT_ID     = var.keycloak_client_id
    KEYCLOAK_CLIENT_SECRET = var.keycloak_client_secret

    # Temporal config
    TEMPORAL_ADDRESS       = var.temporal_address
    TEMPORAL_NAMESPACE     = var.temporal_namespace
    TEMPORAL_TASK_QUEUE    = var.temporal_task_queue

    # Novu config
    NOVU_API_KEY           = var.novu_api_key
    NOVU_BACKEND_URL       = var.novu_backend_url
  }

  type = "Opaque"

  depends_on = [kubernetes_namespace.control_plane]
}

resource "kubernetes_config_map" "control_plane_config" {
  metadata {
    name      = "${local.service_prefix}-config"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    NODE_ENV               = var.environment
    LOG_LEVEL              = var.log_level
    API_BASE_PATH          = "/api"
    ENABLE_SWAGGER         = tostring(var.enable_swagger)
    ENABLE_CORS            = "true"
    CORS_ORIGINS           = var.cors_origins
  }

  depends_on = [kubernetes_namespace.control_plane]
}

# -----------------------------------------------------------------------------
# Tenant Management Service Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "tenant_management" {
  metadata {
    name      = "tenant-management-service"
    namespace = var.namespace
    labels    = local.tenant_mgmt_labels
  }

  spec {
    replicas = var.tenant_mgmt_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "tenant-management-service"
      }
    }

    template {
      metadata {
        labels = local.tenant_mgmt_labels
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port"   = "14000"
          "prometheus.io/path"   = "/metrics"
        }
      }

      spec {
        container {
          name  = "tenant-management"
          image = var.tenant_mgmt_image

          port {
            name           = "http"
            container_port = 14000
            protocol       = "TCP"
          }

          env {
            name  = "HOST"
            value = "0.0.0.0"
          }

          env {
            name  = "PORT"
            value = "14000"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.control_plane_config.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.control_plane_secrets.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = var.tenant_mgmt_cpu_request
              memory = var.tenant_mgmt_memory_request
            }
            limits = {
              cpu    = var.tenant_mgmt_cpu_limit
              memory = var.tenant_mgmt_memory_limit
            }
          }

          liveness_probe {
            http_get {
              path = "/ping"
              port = 14000
            }
            initial_delay_seconds = 60
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/ping"
              port = 14000
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          image_pull_policy = "Always"
        }

        restart_policy = "Always"
      }
    }
  }

  depends_on = [
    kubernetes_secret.control_plane_secrets,
    kubernetes_config_map.control_plane_config
  ]
}

resource "kubernetes_service" "tenant_management" {
  metadata {
    name      = "tenant-management-service"
    namespace = var.namespace
    labels    = local.tenant_mgmt_labels
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "tenant-management-service"
    }

    port {
      name        = "http"
      port        = 14000
      target_port = 14000
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }

  depends_on = [kubernetes_deployment.tenant_management]
}

# -----------------------------------------------------------------------------
# Temporal Worker Service Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "temporal_worker" {
  metadata {
    name      = "temporal-worker-service"
    namespace = var.namespace
    labels    = local.temporal_worker_labels
  }

  spec {
    replicas = var.temporal_worker_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "temporal-worker-service"
      }
    }

    template {
      metadata {
        labels = local.temporal_worker_labels
      }

      spec {
        container {
          name  = "temporal-worker"
          image = var.temporal_worker_image

          env_from {
            config_map_ref {
              name = kubernetes_config_map.control_plane_config.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.control_plane_secrets.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = var.temporal_worker_cpu_request
              memory = var.temporal_worker_memory_request
            }
            limits = {
              cpu    = var.temporal_worker_cpu_limit
              memory = var.temporal_worker_memory_limit
            }
          }

          # Health check via Temporal connection
          liveness_probe {
            exec {
              command = ["sh", "-c", "pgrep -f 'node.*worker' || exit 1"]
            }
            initial_delay_seconds = 60
            period_seconds        = 30
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            exec {
              command = ["sh", "-c", "pgrep -f 'node.*worker' || exit 1"]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          image_pull_policy = "Always"
        }

        restart_policy = "Always"
      }
    }
  }

  depends_on = [
    kubernetes_secret.control_plane_secrets,
    kubernetes_config_map.control_plane_config
  ]
}

# -----------------------------------------------------------------------------
# Subscription Service Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "subscription" {
  metadata {
    name      = "subscription-service"
    namespace = var.namespace
    labels    = local.subscription_labels
  }

  spec {
    replicas = var.subscription_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "subscription-service"
      }
    }

    template {
      metadata {
        labels = local.subscription_labels
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port"   = "3002"
          "prometheus.io/path"   = "/metrics"
        }
      }

      spec {
        container {
          name  = "subscription"
          image = var.subscription_image

          port {
            name           = "http"
            container_port = 3002
            protocol       = "TCP"
          }

          env {
            name  = "HOST"
            value = "0.0.0.0"
          }

          env {
            name  = "PORT"
            value = "3002"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.control_plane_config.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.control_plane_secrets.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = var.subscription_cpu_request
              memory = var.subscription_memory_request
            }
            limits = {
              cpu    = var.subscription_cpu_limit
              memory = var.subscription_memory_limit
            }
          }

          liveness_probe {
            http_get {
              path = "/ping"
              port = 3002
            }
            initial_delay_seconds = 60
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/ping"
              port = 3002
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          image_pull_policy = "Always"
        }

        restart_policy = "Always"
      }
    }
  }

  depends_on = [
    kubernetes_secret.control_plane_secrets,
    kubernetes_config_map.control_plane_config
  ]
}

resource "kubernetes_service" "subscription" {
  metadata {
    name      = "subscription-service"
    namespace = var.namespace
    labels    = local.subscription_labels
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "subscription-service"
    }

    port {
      name        = "http"
      port        = 3002
      target_port = 3002
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }

  depends_on = [kubernetes_deployment.subscription]
}

# -----------------------------------------------------------------------------
# Orchestrator Service Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "orchestrator" {
  metadata {
    name      = "orchestrator-service"
    namespace = var.namespace
    labels    = local.orchestrator_labels
  }

  spec {
    replicas = var.orchestrator_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "orchestrator-service"
      }
    }

    template {
      metadata {
        labels = local.orchestrator_labels
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port"   = "3003"
          "prometheus.io/path"   = "/metrics"
        }
      }

      spec {
        container {
          name  = "orchestrator"
          image = var.orchestrator_image

          port {
            name           = "http"
            container_port = 3003
            protocol       = "TCP"
          }

          env {
            name  = "HOST"
            value = "0.0.0.0"
          }

          env {
            name  = "PORT"
            value = "3003"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.control_plane_config.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.control_plane_secrets.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = var.orchestrator_cpu_request
              memory = var.orchestrator_memory_request
            }
            limits = {
              cpu    = var.orchestrator_cpu_limit
              memory = var.orchestrator_memory_limit
            }
          }

          liveness_probe {
            http_get {
              path = "/ping"
              port = 3003
            }
            initial_delay_seconds = 60
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/ping"
              port = 3003
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          image_pull_policy = "Always"
        }

        restart_policy = "Always"
      }
    }
  }

  depends_on = [
    kubernetes_secret.control_plane_secrets,
    kubernetes_config_map.control_plane_config
  ]
}

resource "kubernetes_service" "orchestrator" {
  metadata {
    name      = "orchestrator-service"
    namespace = var.namespace
    labels    = local.orchestrator_labels
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "orchestrator-service"
    }

    port {
      name        = "http"
      port        = 3003
      target_port = 3003
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }

  depends_on = [kubernetes_deployment.orchestrator]
}
