# =============================================================================
# Novu Notification Stack - Terraform Module
# =============================================================================
# Deploys complete Novu notification infrastructure:
# - MongoDB (Bitnami Helm)
# - Redis (Bitnami Helm)
# - Novu API
# - Novu WebSocket Server
# - Novu Worker
# - Novu Web Dashboard
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
  }
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  namespace = var.namespace
  labels = merge(var.labels, {
    "app.kubernetes.io/part-of" = "novu"
  })
}

# -----------------------------------------------------------------------------
# Namespace
# -----------------------------------------------------------------------------

resource "kubernetes_namespace" "notifications" {
  metadata {
    name   = local.namespace
    labels = local.labels
  }
}

# -----------------------------------------------------------------------------
# MongoDB - Novu Data Store
# -----------------------------------------------------------------------------

resource "helm_release" "mongodb" {
  name             = "novu-mongodb"
  repository       = "https://charts.bitnami.com/bitnami"
  chart            = "mongodb"
  version          = var.mongodb_chart_version
  namespace        = kubernetes_namespace.notifications.metadata[0].name
  create_namespace = false

  values = [
    yamlencode({
      image = {
        registry   = "docker.io"
        repository = "bitnami/mongodb"
        tag        = var.mongodb_version
      }

      architecture = "standalone"

      auth = {
        enabled      = true
        rootUser     = "root"
        rootPassword = var.mongodb_root_password
        databases    = ["novu-db"]
        usernames    = ["novu"]
        passwords    = [var.mongodb_password]
      }

      persistence = {
        enabled      = true
        storageClass = var.storage_class
        size         = var.mongodb_storage_size
      }

      resources = {
        requests = {
          cpu    = var.mongodb_cpu_request
          memory = var.mongodb_memory_request
        }
        limits = {
          cpu    = var.mongodb_cpu_limit
          memory = var.mongodb_memory_limit
        }
      }

      commonLabels = local.labels
    })
  ]

  wait    = true
  timeout = 600
}

# -----------------------------------------------------------------------------
# Redis - Novu Cache
# -----------------------------------------------------------------------------

resource "helm_release" "redis" {
  name             = "novu-redis"
  repository       = "https://charts.bitnami.com/bitnami"
  chart            = "redis"
  version          = var.redis_chart_version
  namespace        = kubernetes_namespace.notifications.metadata[0].name
  create_namespace = false

  values = [
    yamlencode({
      image = {
        registry   = "docker.io"
        repository = "bitnami/redis"
        tag        = var.redis_version
      }

      architecture = "standalone"

      auth = {
        enabled  = false  # Novu connects without auth
      }

      master = {
        persistence = {
          enabled      = true
          storageClass = var.storage_class
          size         = var.redis_storage_size
        }
        resources = {
          requests = {
            cpu    = var.redis_cpu_request
            memory = var.redis_memory_request
          }
          limits = {
            cpu    = var.redis_cpu_limit
            memory = var.redis_memory_limit
          }
        }
      }

      replica = {
        replicaCount = 0
      }

      commonLabels = local.labels
    })
  ]

  wait    = true
  timeout = 300

  depends_on = [helm_release.mongodb]
}

# -----------------------------------------------------------------------------
# Novu Secrets
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "novu_secrets" {
  metadata {
    name      = "novu-secrets"
    namespace = kubernetes_namespace.notifications.metadata[0].name
    labels    = local.labels
  }

  data = {
    JWT_SECRET           = var.novu_jwt_secret
    STORE_ENCRYPTION_KEY = var.novu_encryption_key
    NOVU_SECRET_KEY      = var.novu_secret_key
    MONGO_URL            = "mongodb://novu:${var.mongodb_password}@novu-mongodb:27017/novu-db"
    S3_ACCESS_KEY        = var.minio_access_key
    S3_SECRET_KEY        = var.minio_secret_key
  }

  type = "Opaque"
}

# -----------------------------------------------------------------------------
# Novu API Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "novu_api" {
  metadata {
    name      = "novu-api"
    namespace = kubernetes_namespace.notifications.metadata[0].name
    labels    = merge(local.labels, { "app.kubernetes.io/component" = "api" })
  }

  spec {
    replicas = var.api_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name"      = "novu-api"
        "app.kubernetes.io/component" = "api"
      }
    }

    template {
      metadata {
        labels = merge(local.labels, {
          "app.kubernetes.io/name"      = "novu-api"
          "app.kubernetes.io/component" = "api"
        })
      }

      spec {
        container {
          name  = "novu-api"
          image = "ghcr.io/novuhq/novu/api:${var.novu_version}"

          port {
            container_port = 3000
            name           = "http"
          }

          env {
            name  = "NODE_ENV"
            value = "production"
          }
          env {
            name  = "PORT"
            value = "3000"
          }
          env {
            name  = "API_ROOT_URL"
            value = var.novu_api_url
          }
          env {
            name  = "FRONT_BASE_URL"
            value = var.novu_web_url
          }
          env {
            name  = "WIDGET_BASE_URL"
            value = var.novu_web_url
          }
          env {
            name  = "DISABLE_USER_REGISTRATION"
            value = "false"
          }
          env {
            name  = "REDIS_HOST"
            value = "novu-redis-master"
          }
          env {
            name  = "REDIS_PORT"
            value = "6379"
          }
          env {
            name  = "S3_LOCAL_STACK"
            value = var.minio_endpoint
          }
          env {
            name  = "S3_BUCKET_NAME"
            value = "novu-storage"
          }
          env {
            name  = "S3_REGION"
            value = "us-east-1"
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.novu_secrets.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = var.api_cpu_request
              memory = var.api_memory_request
            }
            limits = {
              cpu    = var.api_cpu_limit
              memory = var.api_memory_limit
            }
          }

          liveness_probe {
            http_get {
              path = "/v1/health-check"
              port = 3000
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/v1/health-check"
              port = 3000
            }
            initial_delay_seconds = 10
            period_seconds        = 5
          }
        }
      }
    }
  }

  depends_on = [
    helm_release.mongodb,
    helm_release.redis
  ]
}

# -----------------------------------------------------------------------------
# Novu API Service
# -----------------------------------------------------------------------------

resource "kubernetes_service" "novu_api" {
  metadata {
    name      = "novu-api"
    namespace = kubernetes_namespace.notifications.metadata[0].name
    labels    = merge(local.labels, { "app.kubernetes.io/component" = "api" })
  }

  spec {
    selector = {
      "app.kubernetes.io/name"      = "novu-api"
      "app.kubernetes.io/component" = "api"
    }

    port {
      name        = "http"
      port        = 3000
      target_port = 3000
    }

    type = var.service_type
  }
}

# -----------------------------------------------------------------------------
# Novu WebSocket Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "novu_ws" {
  metadata {
    name      = "novu-ws"
    namespace = kubernetes_namespace.notifications.metadata[0].name
    labels    = merge(local.labels, { "app.kubernetes.io/component" = "ws" })
  }

  spec {
    replicas = var.ws_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name"      = "novu-ws"
        "app.kubernetes.io/component" = "ws"
      }
    }

    template {
      metadata {
        labels = merge(local.labels, {
          "app.kubernetes.io/name"      = "novu-ws"
          "app.kubernetes.io/component" = "ws"
        })
      }

      spec {
        container {
          name  = "novu-ws"
          image = "ghcr.io/novuhq/novu/ws:${var.novu_version}"

          port {
            container_port = 3002
            name           = "ws"
          }

          env {
            name  = "NODE_ENV"
            value = "production"
          }
          env {
            name  = "PORT"
            value = "3002"
          }
          env {
            name  = "REDIS_HOST"
            value = "novu-redis-master"
          }
          env {
            name  = "REDIS_PORT"
            value = "6379"
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.novu_secrets.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = var.ws_cpu_request
              memory = var.ws_memory_request
            }
            limits = {
              cpu    = var.ws_cpu_limit
              memory = var.ws_memory_limit
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.redis]
}

# -----------------------------------------------------------------------------
# Novu WebSocket Service
# -----------------------------------------------------------------------------

resource "kubernetes_service" "novu_ws" {
  metadata {
    name      = "novu-ws"
    namespace = kubernetes_namespace.notifications.metadata[0].name
    labels    = merge(local.labels, { "app.kubernetes.io/component" = "ws" })
  }

  spec {
    selector = {
      "app.kubernetes.io/name"      = "novu-ws"
      "app.kubernetes.io/component" = "ws"
    }

    port {
      name        = "ws"
      port        = 3002
      target_port = 3002
    }

    type = var.service_type
  }
}

# -----------------------------------------------------------------------------
# Novu Worker Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "novu_worker" {
  metadata {
    name      = "novu-worker"
    namespace = kubernetes_namespace.notifications.metadata[0].name
    labels    = merge(local.labels, { "app.kubernetes.io/component" = "worker" })
  }

  spec {
    replicas = var.worker_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name"      = "novu-worker"
        "app.kubernetes.io/component" = "worker"
      }
    }

    template {
      metadata {
        labels = merge(local.labels, {
          "app.kubernetes.io/name"      = "novu-worker"
          "app.kubernetes.io/component" = "worker"
        })
      }

      spec {
        container {
          name  = "novu-worker"
          image = "ghcr.io/novuhq/novu/worker:${var.novu_version}"

          env {
            name  = "NODE_ENV"
            value = "production"
          }
          env {
            name  = "REDIS_HOST"
            value = "novu-redis-master"
          }
          env {
            name  = "REDIS_PORT"
            value = "6379"
          }
          env {
            name  = "API_ROOT_URL"
            value = "http://novu-api:3000"
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.novu_secrets.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = var.worker_cpu_request
              memory = var.worker_memory_request
            }
            limits = {
              cpu    = var.worker_cpu_limit
              memory = var.worker_memory_limit
            }
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_deployment.novu_api,
    helm_release.redis
  ]
}

# -----------------------------------------------------------------------------
# Novu Web Dashboard Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "novu_web" {
  metadata {
    name      = "novu-web"
    namespace = kubernetes_namespace.notifications.metadata[0].name
    labels    = merge(local.labels, { "app.kubernetes.io/component" = "web" })
  }

  spec {
    replicas = var.web_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name"      = "novu-web"
        "app.kubernetes.io/component" = "web"
      }
    }

    template {
      metadata {
        labels = merge(local.labels, {
          "app.kubernetes.io/name"      = "novu-web"
          "app.kubernetes.io/component" = "web"
        })
      }

      spec {
        container {
          name  = "novu-web"
          image = "ghcr.io/novuhq/novu/web:${var.novu_version}"

          port {
            container_port = 4200
            name           = "http"
          }

          env {
            name  = "REACT_APP_API_URL"
            value = var.novu_api_url
          }
          env {
            name  = "REACT_APP_WS_URL"
            value = var.novu_ws_url
          }
          env {
            name  = "API_ROOT_URL"
            value = "http://novu-api:3000"
          }

          resources {
            requests = {
              cpu    = var.web_cpu_request
              memory = var.web_memory_request
            }
            limits = {
              cpu    = var.web_cpu_limit
              memory = var.web_memory_limit
            }
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 4200
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }
        }
      }
    }
  }

  depends_on = [kubernetes_deployment.novu_api]
}

# -----------------------------------------------------------------------------
# Novu Web Service
# -----------------------------------------------------------------------------

resource "kubernetes_service" "novu_web" {
  metadata {
    name      = "novu-web"
    namespace = kubernetes_namespace.notifications.metadata[0].name
    labels    = merge(local.labels, { "app.kubernetes.io/component" = "web" })
  }

  spec {
    selector = {
      "app.kubernetes.io/name"      = "novu-web"
      "app.kubernetes.io/component" = "web"
    }

    port {
      name        = "http"
      port        = 4200
      target_port = 4200
      node_port   = var.web_node_port
    }

    type = var.service_type == "NodePort" ? "NodePort" : var.service_type
  }
}
