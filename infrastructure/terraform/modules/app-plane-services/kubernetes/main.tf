# =============================================================================
# App Plane Services Kubernetes Module
# =============================================================================
# Deploys App Plane backend services to Kubernetes:
# - cns-service (FastAPI - port 8000)
# - cns-worker (Temporal worker)
# - django-backend (port 8000)
# - middleware-api (Flask - port 5000)
# - webhook-bridge (port 27600)
# - audit-logger
# - novu-consumer
# =============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.20"
    }
  }
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  service_prefix = "${var.name_prefix}-${var.environment}"

  common_labels = merge(
    {
      "app.kubernetes.io/part-of"    = "ananta-app-plane"
      "app.kubernetes.io/managed-by" = "terraform"
      "environment"                  = var.environment
      "plane"                        = "app"
    },
    var.labels
  )
}

# -----------------------------------------------------------------------------
# Namespace
# -----------------------------------------------------------------------------

resource "kubernetes_namespace" "app_plane" {
  count = var.create_namespace ? 1 : 0

  metadata {
    name   = var.namespace
    labels = local.common_labels
  }
}

# -----------------------------------------------------------------------------
# Secrets
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "app_plane_secrets" {
  metadata {
    name      = "${local.service_prefix}-secrets"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    # Supabase Database
    SUPABASE_DB_PASSWORD       = var.supabase_db_password
    SUPABASE_JWT_SECRET        = var.supabase_jwt_secret
    SUPABASE_SERVICE_ROLE_KEY  = var.supabase_service_role_key

    # Components V2 Database
    COMPONENTS_V2_DB_PASSWORD  = var.components_v2_db_password

    # Redis
    REDIS_PASSWORD             = var.redis_password

    # RabbitMQ
    RABBITMQ_PASSWORD          = var.rabbitmq_password

    # MinIO/S3
    MINIO_ROOT_USER            = var.minio_root_user
    MINIO_ROOT_PASSWORD        = var.minio_root_password

    # JWT/Auth
    JWT_SECRET_KEY             = var.jwt_secret_key

    # Django
    DJANGO_SECRET_KEY          = var.django_secret_key

    # Keycloak
    KEYCLOAK_CLIENT_SECRET     = var.keycloak_client_secret

    # Supplier API Keys
    MOUSER_API_KEY             = var.mouser_api_key
    DIGIKEY_CLIENT_ID          = var.digikey_client_id
    DIGIKEY_CLIENT_SECRET      = var.digikey_client_secret
    ELEMENT14_API_KEY          = var.element14_api_key

    # AI Provider Keys
    OPENAI_API_KEY             = var.openai_api_key
    CLAUDE_API_KEY             = var.claude_api_key
    PERPLEXITY_API_KEY         = var.perplexity_api_key

    # Admin Tokens
    ADMIN_API_TOKEN            = var.admin_api_token
    CNS_ADMIN_TOKEN            = var.cns_admin_token
  }

  type = "Opaque"

  depends_on = [kubernetes_namespace.app_plane]
}

resource "kubernetes_config_map" "app_plane_config" {
  metadata {
    name      = "${local.service_prefix}-config"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    # General
    NODE_ENV                   = var.environment
    ENVIRONMENT                = var.environment
    LOG_LEVEL                  = var.log_level
    DEBUG                      = tostring(var.debug_mode)

    # Database URLs (constructed)
    SUPABASE_DATABASE_URL      = "postgresql://postgres:@supabase-db:5432/postgres"
    COMPONENTS_V2_DATABASE_URL = "postgresql://postgres:@components-v2-postgres:5432/components_v2"
    DATABASE_URL               = "postgresql://postgres:@components-v2-postgres:5432/components_v2"

    # Service URLs
    SUPABASE_URL               = var.supabase_url
    CONTROL_PLANE_URL          = var.control_plane_url
    TEMPORAL_HOST              = var.temporal_host
    TEMPORAL_NAMESPACE         = var.temporal_namespace
    TEMPORAL_TASK_QUEUE        = var.temporal_task_queue

    # Redis
    REDIS_URL                  = "redis://redis:6379/2"
    REDIS_CACHE_TTL            = "3600"

    # RabbitMQ
    RABBITMQ_HOST              = var.rabbitmq_host
    RABBITMQ_PORT              = "5672"
    RABBITMQ_STREAM_PORT       = "5552"
    RABBITMQ_USER              = var.rabbitmq_user
    RABBITMQ_VHOST             = "/"

    # MinIO
    MINIO_ENDPOINT             = var.minio_endpoint
    MINIO_PUBLIC_ENDPOINT      = var.minio_public_endpoint
    MINIO_SECURE               = "false"
    MINIO_BUCKET_UPLOADS       = var.s3_bucket_uploads
    MINIO_BUCKET_RESULTS       = var.s3_bucket_results
    MINIO_BUCKET_AUDIT         = var.s3_bucket_audit

    # Feature Flags
    ENABLE_AI_SUGGESTIONS      = tostring(var.enable_ai_suggestions)
    ENABLE_WEB_SCRAPING        = tostring(var.enable_web_scraping)
    ENABLE_COST_TRACKING       = tostring(var.enable_cost_tracking)
    TEMPORAL_ENABLED           = tostring(var.temporal_enabled)

    # Quality Thresholds
    QUALITY_REJECT_THRESHOLD   = tostring(var.quality_reject_threshold)
    QUALITY_STAGING_THRESHOLD  = tostring(var.quality_staging_threshold)
    QUALITY_AUTO_APPROVE_THRESHOLD = tostring(var.quality_auto_approve_threshold)
  }

  depends_on = [kubernetes_namespace.app_plane]
}

# -----------------------------------------------------------------------------
# CNS Service Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "cns_service" {
  metadata {
    name      = "cns-service"
    namespace = var.namespace
    labels = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "cns-service"
      "app.kubernetes.io/component" = "api"
    })
  }

  spec {
    replicas = var.cns_service_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "cns-service"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "cns-service"
          "app.kubernetes.io/component" = "api"
        })
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port"   = "8000"
          "prometheus.io/path"   = "/metrics"
        }
      }

      spec {
        container {
          name  = "cns-service"
          image = var.cns_service_image

          port {
            name           = "http"
            container_port = 8000
            protocol       = "TCP"
          }

          env {
            name  = "CNS_PORT"
            value = "8000"
          }

          env {
            name  = "CNS_HOST"
            value = "0.0.0.0"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.app_plane_config.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.app_plane_secrets.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = var.cns_service_cpu_request
              memory = var.cns_service_memory_request
            }
            limits = {
              cpu    = var.cns_service_cpu_limit
              memory = var.cns_service_memory_limit
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 8000
            }
            initial_delay_seconds = 45
            period_seconds        = 30
            timeout_seconds       = 10
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 8000
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
    kubernetes_secret.app_plane_secrets,
    kubernetes_config_map.app_plane_config
  ]
}

resource "kubernetes_service" "cns_service" {
  metadata {
    name      = "cns-service"
    namespace = var.namespace
    labels = merge(local.common_labels, {
      "app.kubernetes.io/name" = "cns-service"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "cns-service"
    }

    port {
      name        = "http"
      port        = 8000
      target_port = 8000
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }

  depends_on = [kubernetes_deployment.cns_service]
}

# -----------------------------------------------------------------------------
# CNS Worker Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "cns_worker" {
  metadata {
    name      = "cns-worker"
    namespace = var.namespace
    labels = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "cns-worker"
      "app.kubernetes.io/component" = "worker"
    })
  }

  spec {
    replicas = var.cns_worker_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "cns-worker"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "cns-worker"
          "app.kubernetes.io/component" = "worker"
        })
      }

      spec {
        container {
          name    = "cns-worker"
          image   = var.cns_service_image
          command = ["python", "-m", "app.workers.bom_worker"]

          env_from {
            config_map_ref {
              name = kubernetes_config_map.app_plane_config.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.app_plane_secrets.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = var.cns_worker_cpu_request
              memory = var.cns_worker_memory_request
            }
            limits = {
              cpu    = var.cns_worker_cpu_limit
              memory = var.cns_worker_memory_limit
            }
          }

          liveness_probe {
            exec {
              command = ["sh", "-c", "pgrep -f 'bom_worker' || exit 1"]
            }
            initial_delay_seconds = 60
            period_seconds        = 30
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
    kubernetes_secret.app_plane_secrets,
    kubernetes_config_map.app_plane_config
  ]
}

# -----------------------------------------------------------------------------
# Django Backend Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "django_backend" {
  metadata {
    name      = "django-backend"
    namespace = var.namespace
    labels = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "django-backend"
      "app.kubernetes.io/component" = "api"
    })
  }

  spec {
    replicas = var.django_backend_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "django-backend"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "django-backend"
          "app.kubernetes.io/component" = "api"
        })
      }

      spec {
        container {
          name  = "django-backend"
          image = var.django_backend_image

          port {
            name           = "http"
            container_port = 8000
            protocol       = "TCP"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.app_plane_config.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.app_plane_secrets.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = var.django_backend_cpu_request
              memory = var.django_backend_memory_request
            }
            limits = {
              cpu    = var.django_backend_cpu_limit
              memory = var.django_backend_memory_limit
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 8000
            }
            initial_delay_seconds = 60
            period_seconds        = 30
            timeout_seconds       = 10
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 8000
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
    kubernetes_secret.app_plane_secrets,
    kubernetes_config_map.app_plane_config
  ]
}

resource "kubernetes_service" "django_backend" {
  metadata {
    name      = "django-backend"
    namespace = var.namespace
    labels = merge(local.common_labels, {
      "app.kubernetes.io/name" = "django-backend"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "django-backend"
    }

    port {
      name        = "http"
      port        = 8000
      target_port = 8000
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }

  depends_on = [kubernetes_deployment.django_backend]
}

# -----------------------------------------------------------------------------
# Middleware API Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "middleware_api" {
  metadata {
    name      = "middleware-api"
    namespace = var.namespace
    labels = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "middleware-api"
      "app.kubernetes.io/component" = "api"
    })
  }

  spec {
    replicas = var.middleware_api_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "middleware-api"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "middleware-api"
          "app.kubernetes.io/component" = "api"
        })
      }

      spec {
        container {
          name  = "middleware-api"
          image = var.middleware_api_image

          port {
            name           = "http"
            container_port = 5000
            protocol       = "TCP"
          }

          env {
            name  = "FLASK_APP"
            value = "app.py"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.app_plane_config.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.app_plane_secrets.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = var.middleware_api_cpu_request
              memory = var.middleware_api_memory_request
            }
            limits = {
              cpu    = var.middleware_api_cpu_limit
              memory = var.middleware_api_memory_limit
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 5000
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 5000
            }
            initial_delay_seconds = 20
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
    kubernetes_secret.app_plane_secrets,
    kubernetes_config_map.app_plane_config
  ]
}

resource "kubernetes_service" "middleware_api" {
  metadata {
    name      = "middleware-api"
    namespace = var.namespace
    labels = merge(local.common_labels, {
      "app.kubernetes.io/name" = "middleware-api"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "middleware-api"
    }

    port {
      name        = "http"
      port        = 5000
      target_port = 5000
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }

  depends_on = [kubernetes_deployment.middleware_api]
}

# -----------------------------------------------------------------------------
# Webhook Bridge Deployment (Optional)
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "webhook_bridge" {
  count = var.enable_webhook_bridge ? 1 : 0

  metadata {
    name      = "webhook-bridge"
    namespace = var.namespace
    labels = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "webhook-bridge"
      "app.kubernetes.io/component" = "api"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "webhook-bridge"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "webhook-bridge"
          "app.kubernetes.io/component" = "api"
        })
      }

      spec {
        container {
          name  = "webhook-bridge"
          image = var.webhook_bridge_image

          port {
            name           = "http"
            container_port = 27600
            protocol       = "TCP"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.app_plane_config.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.app_plane_secrets.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 27600
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
    kubernetes_secret.app_plane_secrets,
    kubernetes_config_map.app_plane_config
  ]
}

resource "kubernetes_service" "webhook_bridge" {
  count = var.enable_webhook_bridge ? 1 : 0

  metadata {
    name      = "webhook-bridge"
    namespace = var.namespace
    labels = merge(local.common_labels, {
      "app.kubernetes.io/name" = "webhook-bridge"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "webhook-bridge"
    }

    port {
      name        = "http"
      port        = 27600
      target_port = 27600
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }

  depends_on = [kubernetes_deployment.webhook_bridge]
}
