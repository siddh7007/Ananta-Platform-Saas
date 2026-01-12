# =============================================================================
# Supabase Stack - Terraform Module
# =============================================================================
# Deploys Supabase infrastructure:
# - PostgREST API
# - Postgres Meta
# - Supabase Studio
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
  labels = merge(var.labels, { "app.kubernetes.io/part-of" = "supabase" })
}

# PostgREST API
resource "kubernetes_deployment" "supabase_api" {
  metadata {
    name      = "supabase-api"
    namespace = var.namespace
    labels    = merge(local.labels, { "app.kubernetes.io/component" = "api" })
  }

  spec {
    replicas = var.api_replicas
    selector {
      match_labels = { "app.kubernetes.io/name" = "supabase-api" }
    }

    template {
      metadata {
        labels = merge(local.labels, { "app.kubernetes.io/name" = "supabase-api" })
      }
      spec {
        container {
          name  = "postgrest"
          image = "postgrest/postgrest:${var.postgrest_version}"
          port {
            container_port = 3000
            name           = "http"
          }
          env {
            name  = "PGRST_DB_URI"
            value = "postgres://postgres:${var.db_password}@${var.db_host}:5432/postgres"
          }
          env {
            name  = "PGRST_DB_SCHEMA"
            value = "public"
          }
          env {
            name  = "PGRST_DB_ANON_ROLE"
            value = "anon"
          }
          env {
            name  = "PGRST_JWT_SECRET"
            value = var.jwt_secret
          }
          resources {
            requests = { cpu = "100m", memory = "128Mi" }
            limits   = { cpu = "500m", memory = "256Mi" }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "supabase_api" {
  metadata {
    name      = "supabase-api"
    namespace = var.namespace
    labels    = merge(local.labels, { "app.kubernetes.io/component" = "api" })
  }

  spec {
    selector = { "app.kubernetes.io/name" = "supabase-api" }
    port {
      name        = "http"
      port        = 3000
      target_port = 3000
      node_port   = var.api_node_port
    }
    type = var.service_type
  }
}

# Postgres Meta
resource "kubernetes_deployment" "supabase_meta" {
  metadata {
    name      = "supabase-meta"
    namespace = var.namespace
    labels    = merge(local.labels, { "app.kubernetes.io/component" = "meta" })
  }

  spec {
    replicas = 1
    selector {
      match_labels = { "app.kubernetes.io/name" = "supabase-meta" }
    }

    template {
      metadata {
        labels = merge(local.labels, { "app.kubernetes.io/name" = "supabase-meta" })
      }
      spec {
        container {
          name  = "postgres-meta"
          image = "supabase/postgres-meta:${var.meta_version}"
          port {
            container_port = 8080
          }
          env {
            name  = "PG_META_PORT"
            value = "8080"
          }
          env {
            name  = "PG_META_DB_HOST"
            value = var.db_host
          }
          env {
            name  = "PG_META_DB_PORT"
            value = "5432"
          }
          env {
            name  = "PG_META_DB_NAME"
            value = "postgres"
          }
          env {
            name  = "PG_META_DB_USER"
            value = "postgres"
          }
          env {
            name  = "PG_META_DB_PASSWORD"
            value = var.db_password
          }
          resources {
            requests = { cpu = "50m", memory = "64Mi" }
            limits   = { cpu = "200m", memory = "128Mi" }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "supabase_meta" {
  metadata {
    name      = "supabase-meta"
    namespace = var.namespace
  }

  spec {
    selector = { "app.kubernetes.io/name" = "supabase-meta" }
    port {
      port        = 8080
      target_port = 8080
    }
    type = "ClusterIP"
  }
}

# Supabase Studio
resource "kubernetes_deployment" "supabase_studio" {
  metadata {
    name      = "supabase-studio"
    namespace = var.namespace
    labels    = merge(local.labels, { "app.kubernetes.io/component" = "studio" })
  }

  spec {
    replicas = 1
    selector {
      match_labels = { "app.kubernetes.io/name" = "supabase-studio" }
    }

    template {
      metadata {
        labels = merge(local.labels, { "app.kubernetes.io/name" = "supabase-studio" })
      }
      spec {
        container {
          name  = "studio"
          image = "supabase/studio:${var.studio_version}"
          port {
            container_port = 3000
          }
          env {
            name  = "STUDIO_PG_META_URL"
            value = "http://supabase-meta:8080"
          }
          env {
            name  = "POSTGRES_PASSWORD"
            value = var.db_password
          }
          env {
            name  = "SUPABASE_URL"
            value = "http://supabase-api:3000"
          }
          resources {
            requests = { cpu = "100m", memory = "256Mi" }
            limits   = { cpu = "500m", memory = "512Mi" }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "supabase_studio" {
  metadata {
    name      = "supabase-studio"
    namespace = var.namespace
  }

  spec {
    selector = { "app.kubernetes.io/name" = "supabase-studio" }
    port {
      name        = "http"
      port        = 3000
      target_port = 3000
      node_port   = var.studio_node_port
    }
    type = var.service_type
  }
}
