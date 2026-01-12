# =============================================================================
# Directus CMS - Terraform Module
# =============================================================================

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.20"
    }
  }
}

locals {
  labels = merge(var.labels, { "app.kubernetes.io/part-of" = "directus" })
}

resource "kubernetes_secret" "directus" {
  metadata {
    name      = "directus-secrets"
    namespace = var.namespace
    labels    = local.labels
  }

  data = {
    KEY            = var.directus_key
    SECRET         = var.directus_secret
    ADMIN_EMAIL    = var.admin_email
    ADMIN_PASSWORD = var.admin_password
    DB_PASSWORD    = var.db_password
  }

  type = "Opaque"
}

resource "kubernetes_deployment" "directus" {
  metadata {
    name      = "directus"
    namespace = var.namespace
    labels    = local.labels
  }

  spec {
    replicas = var.replicas
    selector {
      match_labels = { "app.kubernetes.io/name" = "directus" }
    }

    template {
      metadata {
        labels = merge(local.labels, { "app.kubernetes.io/name" = "directus" })
      }
      spec {
        container {
          name  = "directus"
          image = "directus/directus:${var.directus_version}"
          port {
            container_port = 8055
          }
          env {
            name = "KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.directus.metadata[0].name
                key  = "KEY"
              }
            }
          }
          env {
            name = "SECRET"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.directus.metadata[0].name
                key  = "SECRET"
              }
            }
          }
          env {
            name  = "DB_CLIENT"
            value = "pg"
          }
          env {
            name  = "DB_HOST"
            value = var.db_host
          }
          env {
            name  = "DB_PORT"
            value = "5432"
          }
          env {
            name  = "DB_DATABASE"
            value = "directus"
          }
          env {
            name  = "DB_USER"
            value = "postgres"
          }
          env {
            name = "DB_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.directus.metadata[0].name
                key  = "DB_PASSWORD"
              }
            }
          }
          env {
            name = "ADMIN_EMAIL"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.directus.metadata[0].name
                key  = "ADMIN_EMAIL"
              }
            }
          }
          env {
            name = "ADMIN_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.directus.metadata[0].name
                key  = "ADMIN_PASSWORD"
              }
            }
          }
          env {
            name  = "CORS_ENABLED"
            value = "true"
          }
          env {
            name  = "CORS_ORIGIN"
            value = "*"
          }
          env {
            name  = "CACHE_ENABLED"
            value = "true"
          }
          env {
            name  = "CACHE_STORE"
            value = "redis"
          }
          env {
            name  = "REDIS"
            value = var.redis_url
          }
          resources {
            requests = { cpu = var.cpu_request, memory = var.memory_request }
            limits   = { cpu = var.cpu_limit, memory = var.memory_limit }
          }
          liveness_probe {
            http_get {
              path = "/server/health"
              port = 8055
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }
          volume_mount {
            name       = "uploads"
            mount_path = "/directus/uploads"
          }
        }
        volume {
          name = "uploads"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.directus_uploads.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_persistent_volume_claim" "directus_uploads" {
  metadata {
    name      = "directus-uploads"
    namespace = var.namespace
    labels    = local.labels
  }

  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = var.storage_class
    resources {
      requests = { storage = var.storage_size }
    }
  }
}

resource "kubernetes_service" "directus" {
  metadata {
    name      = "directus"
    namespace = var.namespace
    labels    = local.labels
  }

  spec {
    selector = { "app.kubernetes.io/name" = "directus" }
    port {
      name        = "http"
      port        = 8055
      target_port = 8055
      node_port   = var.node_port
    }
    type = var.service_type
  }
}
