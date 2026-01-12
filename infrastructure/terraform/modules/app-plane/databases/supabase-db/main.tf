# =============================================================================
# Supabase PostgreSQL Database Module
# =============================================================================
# Deploys PostgreSQL for Supabase tenant data storage using CloudNativePG
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

locals {
  app_name = "supabase-db"

  common_labels = merge(var.labels, {
    "app.kubernetes.io/name"       = local.app_name
    "app.kubernetes.io/instance"   = "${var.name_prefix}-${local.app_name}"
    "app.kubernetes.io/component"  = "database"
    "app.kubernetes.io/managed-by" = "terraform"
    "environment"                  = var.environment
  })

  # Resource sizing based on environment
  resources = {
    local = {
      storage  = "10Gi"
      cpu      = "500m"
      memory   = "512Mi"
    }
    dev = {
      storage  = "20Gi"
      cpu      = "1000m"
      memory   = "1Gi"
    }
    staging = {
      storage  = "50Gi"
      cpu      = "2000m"
      memory   = "4Gi"
    }
    prod = {
      storage  = "100Gi"
      cpu      = "4000m"
      memory   = "8Gi"
    }
  }

  env_resources = lookup(local.resources, var.environment, local.resources["dev"])
}

# -----------------------------------------------------------------------------
# Secret for Supabase DB credentials
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "supabase_db" {
  metadata {
    name      = "${var.name_prefix}-${local.app_name}-credentials"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    POSTGRES_USER     = var.postgres_user
    POSTGRES_PASSWORD = var.postgres_password
    POSTGRES_DB       = var.postgres_db
  }

  type = "Opaque"
}

# -----------------------------------------------------------------------------
# ConfigMap for initialization scripts
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "init_scripts" {
  metadata {
    name      = "${var.name_prefix}-${local.app_name}-init"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    "01-init-extensions.sql" = <<-EOF
      -- Enable required extensions for Supabase
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pg_graphql";
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      CREATE EXTENSION IF NOT EXISTS "pgjwt";
      CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
    EOF
  }
}

# -----------------------------------------------------------------------------
# StatefulSet for Supabase PostgreSQL
# -----------------------------------------------------------------------------

resource "kubernetes_stateful_set" "supabase_db" {
  metadata {
    name      = local.app_name
    namespace = var.namespace
    labels    = local.common_labels
  }

  spec {
    service_name = local.app_name
    replicas     = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name"     = local.app_name
        "app.kubernetes.io/instance" = "${var.name_prefix}-${local.app_name}"
      }
    }

    template {
      metadata {
        labels = local.common_labels
      }

      spec {
        container {
          name  = local.app_name
          image = var.postgres_image

          port {
            container_port = 5432
            name           = "postgres"
          }

          env {
            name = "POSTGRES_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.supabase_db.metadata[0].name
                key  = "POSTGRES_USER"
              }
            }
          }

          env {
            name = "POSTGRES_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.supabase_db.metadata[0].name
                key  = "POSTGRES_PASSWORD"
              }
            }
          }

          env {
            name = "POSTGRES_DB"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.supabase_db.metadata[0].name
                key  = "POSTGRES_DB"
              }
            }
          }

          resources {
            requests = {
              cpu    = local.env_resources.cpu
              memory = local.env_resources.memory
            }
            limits = {
              cpu    = local.env_resources.cpu
              memory = local.env_resources.memory
            }
          }

          volume_mount {
            name       = "data"
            mount_path = "/var/lib/postgresql/data"
            sub_path   = "pgdata"
          }

          volume_mount {
            name       = "init-scripts"
            mount_path = "/docker-entrypoint-initdb.d"
          }

          readiness_probe {
            exec {
              command = ["pg_isready", "-U", "postgres"]
            }
            initial_delay_seconds = 10
            period_seconds        = 10
            timeout_seconds       = 5
          }

          liveness_probe {
            exec {
              command = ["pg_isready", "-U", "postgres"]
            }
            initial_delay_seconds = 30
            period_seconds        = 30
            timeout_seconds       = 5
          }
        }

        volume {
          name = "init-scripts"
          config_map {
            name = kubernetes_config_map.init_scripts.metadata[0].name
          }
        }
      }
    }

    volume_claim_template {
      metadata {
        name   = "data"
        labels = local.common_labels
      }
      spec {
        access_modes       = ["ReadWriteOnce"]
        storage_class_name = var.storage_class
        resources {
          requests = {
            storage = local.env_resources.storage
          }
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Service
# -----------------------------------------------------------------------------

resource "kubernetes_service" "supabase_db" {
  metadata {
    name      = local.app_name
    namespace = var.namespace
    labels    = local.common_labels
  }

  spec {
    selector = {
      "app.kubernetes.io/name"     = local.app_name
      "app.kubernetes.io/instance" = "${var.name_prefix}-${local.app_name}"
    }

    port {
      name        = "postgres"
      port        = var.service_port
      target_port = 5432
    }

    type = "ClusterIP"
  }
}
