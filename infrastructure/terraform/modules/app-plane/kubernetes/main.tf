# =============================================================================
# App Plane Kubernetes Module
# =============================================================================
# Deploys the complete App Plane to Kubernetes:
# - Supabase PostgreSQL (tenant data)
# - Components-V2 PostgreSQL (component catalog)
# - Redis cache
# - RabbitMQ message broker
# - MinIO S3-compatible storage
# - Supabase services (PostgREST, Studio, Meta)
# - CNS Service (component normalization)
# - Customer Portal
# - Dashboard
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
  common_labels = merge(var.labels, {
    "app.kubernetes.io/part-of"    = "ananta-app-plane"
    "app.kubernetes.io/managed-by" = "terraform"
    "environment"                  = var.environment
  })

  # Simple default passwords for local development
  # Using try() or ternary for null-safety
  supabase_db_password    = var.supabase_db_password != null && var.supabase_db_password != "" ? var.supabase_db_password : "postgres"
  components_db_password  = var.components_db_password != null && var.components_db_password != "" ? var.components_db_password : "postgres"
  redis_password          = var.redis_password != null ? var.redis_password : ""  # Redis can run without password in local
  rabbitmq_password       = var.rabbitmq_password != null && var.rabbitmq_password != "" ? var.rabbitmq_password : "admin123"
  minio_root_password     = var.minio_root_password != null && var.minio_root_password != "" ? var.minio_root_password : "minioadmin"

  # Resource sizing based on environment
  resource_profiles = {
    local = {
      supabase_db = { cpu = "500m", memory = "512Mi", storage = "10Gi" }
      components_db = { cpu = "250m", memory = "256Mi", storage = "5Gi" }
      redis = { cpu = "100m", memory = "128Mi" }
      rabbitmq = { cpu = "250m", memory = "512Mi" }  # Increased from 256Mi - RabbitMQ 4.x with streams needs more memory
      minio = { cpu = "250m", memory = "256Mi", storage = "10Gi" }
      cns_service = { cpu = "500m", memory = "512Mi" }  # Increased for Python + SQLAlchemy + OpenTelemetry
      customer_portal = { cpu = "100m", memory = "128Mi" }
    }
    dev = {
      supabase_db = { cpu = "1000m", memory = "1Gi", storage = "20Gi" }
      components_db = { cpu = "500m", memory = "512Mi", storage = "10Gi" }
      redis = { cpu = "250m", memory = "256Mi" }
      rabbitmq = { cpu = "500m", memory = "512Mi" }
      minio = { cpu = "500m", memory = "512Mi", storage = "50Gi" }
      cns_service = { cpu = "500m", memory = "512Mi" }
      customer_portal = { cpu = "250m", memory = "256Mi" }
    }
    prod = {
      supabase_db = { cpu = "2000m", memory = "4Gi", storage = "100Gi" }
      components_db = { cpu = "1000m", memory = "2Gi", storage = "50Gi" }
      redis = { cpu = "500m", memory = "512Mi" }
      rabbitmq = { cpu = "1000m", memory = "1Gi" }
      minio = { cpu = "1000m", memory = "1Gi", storage = "500Gi" }
      cns_service = { cpu = "1000m", memory = "1Gi" }
      customer_portal = { cpu = "500m", memory = "512Mi" }
    }
  }

  resources = lookup(local.resource_profiles, var.environment, local.resource_profiles["dev"])
}

# -----------------------------------------------------------------------------
# Supabase PostgreSQL Database
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "supabase_db" {
  metadata {
    name      = "${var.name_prefix}-supabase-db-secrets"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    POSTGRES_PASSWORD = local.supabase_db_password
    POSTGRES_USER     = "postgres"
    POSTGRES_DB       = "postgres"
  }

  type = "Opaque"
}

resource "kubernetes_stateful_set" "supabase_db" {
  metadata {
    name      = "supabase-db"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "supabase-db"
      "app.kubernetes.io/component" = "database"
    })
  }

  spec {
    service_name = "supabase-db"
    replicas     = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "supabase-db"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "supabase-db"
          "app.kubernetes.io/component" = "database"
        })
      }

      spec {
        container {
          name  = "supabase-db"
          image = var.images.supabase_db

          port {
            container_port = 5432
            name           = "postgres"
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.supabase_db.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = local.resources.supabase_db.cpu
              memory = local.resources.supabase_db.memory
            }
            limits = {
              cpu    = local.resources.supabase_db.cpu
              memory = local.resources.supabase_db.memory
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
          }

          liveness_probe {
            exec {
              command = ["pg_isready", "-U", "postgres"]
            }
            initial_delay_seconds = 30
            period_seconds        = 30
          }
        }

        volume {
          name = "init-scripts"
          config_map {
            name = kubernetes_config_map.supabase_init.metadata[0].name
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
            storage = local.resources.supabase_db.storage
          }
        }
      }
    }
  }
}

resource "kubernetes_config_map" "supabase_init" {
  metadata {
    name      = "${var.name_prefix}-supabase-init"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    "01-init-extensions.sql" = <<-EOF
      -- =============================================================================
      -- Supabase Required Roles and Extensions
      -- =============================================================================
      -- The supabase/postgres image requires these roles to exist before migrations
      -- can run. This script creates them idempotently.

      -- Enable required extensions for Supabase
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
      CREATE EXTENSION IF NOT EXISTS "pgjwt" SCHEMA extensions;

      -- Create supabase_admin role (superuser for migrations)
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
          CREATE ROLE supabase_admin WITH LOGIN SUPERUSER PASSWORD 'postgres';
        END IF;
      END
      $$;

      -- Create authenticator role (PostgREST connection role)
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
          CREATE ROLE authenticator WITH LOGIN NOINHERIT PASSWORD 'postgres';
        END IF;
      END
      $$;

      -- Create anon role (anonymous/public access)
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN NOINHERIT;
        END IF;
      END
      $$;

      -- Create authenticated role (logged-in users)
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN NOINHERIT;
        END IF;
      END
      $$;

      -- Create service_role (backend services with elevated privileges)
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role WITH LOGIN BYPASSRLS PASSWORD 'postgres';
        END IF;
      END
      $$;

      -- Grant role hierarchy
      GRANT anon TO authenticator;
      GRANT authenticated TO authenticator;
      GRANT service_role TO authenticator;

      -- Create required schemas
      CREATE SCHEMA IF NOT EXISTS extensions;
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE SCHEMA IF NOT EXISTS storage;
      CREATE SCHEMA IF NOT EXISTS realtime;

      -- Grant schema access
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
      GRANT USAGE ON SCHEMA auth TO service_role;
      GRANT USAGE ON SCHEMA storage TO service_role;

      -- Create directus database (optional)
      SELECT 'CREATE DATABASE directus' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'directus')\gexec
    EOF
  }
}

resource "kubernetes_service" "supabase_db" {
  metadata {
    name      = "supabase-db"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "supabase-db"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "supabase-db"
    }

    port {
      name        = "postgres"
      port        = 5432
      target_port = 5432
    }

    type = "ClusterIP"
  }
}

# -----------------------------------------------------------------------------
# Components-V2 PostgreSQL Database
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "components_db" {
  metadata {
    name      = "${var.name_prefix}-components-db-secrets"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    POSTGRES_PASSWORD = local.components_db_password
    POSTGRES_USER     = "postgres"
    POSTGRES_DB       = "components_v2"
  }

  type = "Opaque"
}

resource "kubernetes_stateful_set" "components_db" {
  metadata {
    name      = "components-db"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "components-db"
      "app.kubernetes.io/component" = "database"
    })
  }

  spec {
    service_name = "components-db"
    replicas     = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "components-db"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "components-db"
          "app.kubernetes.io/component" = "database"
        })
      }

      spec {
        container {
          name  = "components-db"
          image = var.images.components_db

          port {
            container_port = 5432
            name           = "postgres"
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.components_db.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = local.resources.components_db.cpu
              memory = local.resources.components_db.memory
            }
            limits = {
              cpu    = local.resources.components_db.cpu
              memory = local.resources.components_db.memory
            }
          }

          volume_mount {
            name       = "data"
            mount_path = "/var/lib/postgresql/data"
            sub_path   = "pgdata"
          }

          readiness_probe {
            exec {
              command = ["pg_isready", "-U", "postgres", "-d", "components_v2"]
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }

          liveness_probe {
            exec {
              command = ["pg_isready", "-U", "postgres", "-d", "components_v2"]
            }
            initial_delay_seconds = 30
            period_seconds        = 30
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
            storage = local.resources.components_db.storage
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "components_db" {
  metadata {
    name      = "components-db"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "components-db"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "components-db"
    }

    port {
      name        = "postgres"
      port        = 5432
      target_port = 5432
    }

    type = "ClusterIP"
  }
}

# -----------------------------------------------------------------------------
# Redis Cache (Native Kubernetes StatefulSet - uses official Redis image)
# -----------------------------------------------------------------------------
# Replaced Bitnami Helm chart with native StatefulSet to avoid image tag deletion issues.
# Bitnami deletes old image tags when publishing new revisions, which can break deployments.

resource "kubernetes_stateful_set" "redis" {
  metadata {
    name      = "redis-master"
    namespace = var.namespace
    labels = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "redis"
      "app.kubernetes.io/component" = "master"
      "app"                         = "redis"
    })
  }

  spec {
    service_name = "redis-master"
    replicas     = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name"      = "redis"
        "app.kubernetes.io/component" = "master"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "redis"
          "app.kubernetes.io/component" = "master"
          "app"                         = "redis"
        })
      }

      spec {
        container {
          name  = "redis"
          image = "redis:7-alpine"

          port {
            name           = "redis"
            container_port = 6379
          }

          command = ["redis-server"]
          args = local.redis_password != "" ? [
            "--requirepass", local.redis_password,
            "--maxmemory-policy", "allkeys-lru",
            "--tcp-keepalive", "300",
            "--appendonly", "yes",
            "--appendfsync", "everysec"
          ] : [
            "--maxmemory-policy", "allkeys-lru",
            "--tcp-keepalive", "300",
            "--appendonly", "yes",
            "--appendfsync", "everysec"
          ]

          volume_mount {
            name       = "data"
            mount_path = "/data"
          }

          resources {
            requests = {
              cpu    = local.resources.redis.cpu
              memory = local.resources.redis.memory
            }
            limits = {
              cpu    = local.resources.redis.cpu
              memory = local.resources.redis.memory
            }
          }

          readiness_probe {
            exec {
              command = ["redis-cli", "ping"]
            }
            initial_delay_seconds = 5
            period_seconds        = 10
            timeout_seconds       = 5
          }

          liveness_probe {
            exec {
              command = ["redis-cli", "ping"]
            }
            initial_delay_seconds = 30
            period_seconds        = 15
            timeout_seconds       = 5
          }
        }
      }
    }

    volume_claim_template {
      metadata {
        name = "data"
      }
      spec {
        access_modes       = ["ReadWriteOnce"]
        storage_class_name = var.storage_class
        resources {
          requests = {
            storage = "1Gi"
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "redis_master" {
  metadata {
    name      = "redis-master"
    namespace = var.namespace
    labels = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "redis"
      "app.kubernetes.io/component" = "master"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name"      = "redis"
      "app.kubernetes.io/component" = "master"
    }

    port {
      name        = "redis"
      port        = 6379
      target_port = 6379
    }

    type = "ClusterIP"
  }
}

# -----------------------------------------------------------------------------
# RabbitMQ StatefulSet (native Kubernetes - uses official RabbitMQ image)
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "rabbitmq" {
  metadata {
    name      = "rabbitmq"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    "rabbitmq-password"      = "guest"
    "rabbitmq-erlang-cookie" = "ananta-rabbitmq-cookie"
  }
}
resource "kubernetes_config_map" "rabbitmq_config" {
  metadata {
    name      = "rabbitmq-config"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    "enabled_plugins" = "[rabbitmq_management,rabbitmq_stream,rabbitmq_stream_management,rabbitmq_prometheus]."
    "rabbitmq.conf"   = <<-EOT
      ## Stream plugin
      stream.listeners.tcp.default = 5552

      ## Memory settings
      vm_memory_high_watermark.relative = 0.7

      ## Channel limits
      channel_max = 2048

      ## Management plugin
      management.tcp.port = 15672

      ## Default user (for local dev)
      default_user = guest
      default_pass = guest
      default_user_tags.administrator = true

      ## Loopback users - allow guest from any host (local dev only)
      loopback_users = none
    EOT
  }
}

resource "kubernetes_stateful_set" "rabbitmq" {
  metadata {
    name      = "rabbitmq"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "rabbitmq"
    })
  }

  spec {
    service_name = "rabbitmq"
    replicas     = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "rabbitmq"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name" = "rabbitmq"
        })
      }

      spec {
        container {
          name  = "rabbitmq"
          image = "rabbitmq:4.0-management"

          port {
            name           = "amqp"
            container_port = 5672
          }

          port {
            name           = "management"
            container_port = 15672
          }

          port {
            name           = "stream"
            container_port = 5552
          }

          port {
            name           = "metrics"
            container_port = 15692
          }

          env {
            name  = "RABBITMQ_ERLANG_COOKIE"
            value = "ananta-rabbitmq-cookie"
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/rabbitmq/conf.d/99-custom.conf"
            sub_path   = "rabbitmq.conf"
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/rabbitmq/enabled_plugins"
            sub_path   = "enabled_plugins"
          }

          volume_mount {
            name       = "data"
            mount_path = "/var/lib/rabbitmq"
          }

          resources {
            requests = {
              cpu    = local.resources.rabbitmq.cpu
              memory = local.resources.rabbitmq.memory
            }
            limits = {
              cpu    = local.resources.rabbitmq.cpu
              memory = local.resources.rabbitmq.memory
            }
          }

          readiness_probe {
            exec {
              command = ["rabbitmq-diagnostics", "check_running"]
            }
            initial_delay_seconds = 20
            period_seconds        = 10
            timeout_seconds       = 10
          }

          liveness_probe {
            exec {
              command = ["rabbitmq-diagnostics", "ping"]
            }
            initial_delay_seconds = 60
            period_seconds        = 30
            timeout_seconds       = 10
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.rabbitmq_config.metadata[0].name
          }
        }
      }
    }

    volume_claim_template {
      metadata {
        name = "data"
      }
      spec {
        access_modes       = ["ReadWriteOnce"]
        storage_class_name = var.storage_class
        resources {
          requests = {
            storage = "5Gi"
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "rabbitmq" {
  metadata {
    name      = "rabbitmq"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "rabbitmq"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "rabbitmq"
    }

    port {
      name        = "amqp"
      port        = 5672
      target_port = 5672
    }

    port {
      name        = "management"
      port        = 15672
      target_port = 15672
    }

    port {
      name        = "stream"
      port        = 5552
      target_port = 5552
    }

    port {
      name        = "metrics"
      port        = 15692
      target_port = 15692
    }
  }
}

# -----------------------------------------------------------------------------
# RabbitMQ Streams Initialization Job
# -----------------------------------------------------------------------------
# Creates the required RabbitMQ streams for CNS enrichment service.
# RabbitMQ 4.x streams require declaration via rabbitmqadmin or API -
# they cannot be auto-created on first connection like regular queues.
# -----------------------------------------------------------------------------

resource "kubernetes_job" "rabbitmq_stream_init" {
  metadata {
    name      = "rabbitmq-stream-init"
    namespace = var.namespace
    labels    = local.common_labels
  }

  spec {
    ttl_seconds_after_finished = 600
    backoff_limit              = 10

    template {
      metadata {
        labels = local.common_labels
      }

      spec {
        restart_policy = "OnFailure"

        container {
          name  = "stream-init"
          image = "curlimages/curl:latest"

          command = ["/bin/sh", "-c"]
          args = [<<-EOT
            echo "========================================"
            echo "RabbitMQ Stream Initialization"
            echo "========================================"

            echo "Waiting for RabbitMQ to be fully ready..."
            # Wait for management API to be available
            until curl -sf -u guest:guest http://rabbitmq:15672/api/overview > /dev/null 2>&1; do
              echo "RabbitMQ management API not ready, waiting..."
              sleep 5
            done
            echo "RabbitMQ management API is ready!"

            # Wait for stream plugin to initialize
            sleep 5

            echo ""
            echo "Creating platform.events exchange..."
            # Create platform.events topic exchange for event routing
            curl -sf -u guest:guest \
              -X PUT \
              -H "Content-Type: application/json" \
              -d '{"type":"topic","durable":true,"auto_delete":false}' \
              "http://rabbitmq:15672/api/exchanges/%2F/platform.events" && \
              echo " - platform.events exchange created successfully!" || \
              echo " - platform.events exchange already exists or failed"

            echo ""
            echo "Creating CNS enrichment streams..."

            # Create stream.component.enrich stream queue
            # Using RabbitMQ HTTP API to create a stream-type queue
            echo "Creating stream.component.enrich..."
            curl -sf -u guest:guest \
              -X PUT \
              -H "Content-Type: application/json" \
              -d '{"auto_delete":false,"durable":true,"arguments":{"x-queue-type":"stream"}}' \
              "http://rabbitmq:15672/api/queues/%2F/stream.component.enrich" && \
              echo " - stream.component.enrich created successfully!" || \
              echo " - stream.component.enrich already exists or failed"

            # Create stream.component.enrich.results for enrichment results
            echo "Creating stream.component.enrich.results..."
            curl -sf -u guest:guest \
              -X PUT \
              -H "Content-Type: application/json" \
              -d '{"auto_delete":false,"durable":true,"arguments":{"x-queue-type":"stream"}}' \
              "http://rabbitmq:15672/api/queues/%2F/stream.component.enrich.results" && \
              echo " - stream.component.enrich.results created successfully!" || \
              echo " - stream.component.enrich.results already exists or failed"

            # Create stream.bom.status for BOM status updates
            echo "Creating stream.bom.status..."
            curl -sf -u guest:guest \
              -X PUT \
              -H "Content-Type: application/json" \
              -d '{"auto_delete":false,"durable":true,"arguments":{"x-queue-type":"stream"}}' \
              "http://rabbitmq:15672/api/queues/%2F/stream.bom.status" && \
              echo " - stream.bom.status created successfully!" || \
              echo " - stream.bom.status already exists or failed"

            # Create stream.platform.admin for platform admin notifications
            echo "Creating stream.platform.admin..."
            curl -sf -u guest:guest               -X PUT               -H "Content-Type: application/json"               -d '{"auto_delete":false,"durable":true,"arguments":{"x-queue-type":"stream"}}'               "http://rabbitmq:15672/api/queues/%2F/stream.platform.admin" &&               echo " - stream.platform.admin created successfully\!" ||               echo " - stream.platform.admin already exists or failed"

            # Create stream.platform.bom for BOM workflow updates
            echo "Creating stream.platform.bom..."
            curl -sf -u guest:guest               -X PUT               -H "Content-Type: application/json"               -d '{"auto_delete":false,"durable":true,"arguments":{"x-queue-type":"stream"}}'               "http://rabbitmq:15672/api/queues/%2F/stream.platform.bom" &&               echo " - stream.platform.bom created successfully\!" ||               echo " - stream.platform.bom already exists or failed"

            echo ""
            echo "Verifying streams were created..."
            curl -sf -u guest:guest "http://rabbitmq:15672/api/queues" | grep -o '"name":"stream\.[^"]*"' || echo "Streams listed"

            echo ""
            echo "========================================"
            echo "Stream initialization complete!"
            echo "========================================"
          EOT
          ]
        }
      }
    }
  }

  depends_on = [
    kubernetes_stateful_set.rabbitmq,
    kubernetes_service.rabbitmq
  ]
}

# -----------------------------------------------------------------------------
# MinIO S3-Compatible Storage (Native StatefulSet)
# -----------------------------------------------------------------------------
# Uses direct Kubernetes StatefulSet instead of Helm for more reliable
# local development deployments. Creates all required buckets via init job.
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "minio" {
  metadata {
    name      = "minio"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "minio"
      "app.kubernetes.io/component" = "storage"
    })
  }

  data = {
    rootUser     = "minioadmin"
    rootPassword = local.minio_root_password
  }

  type = "Opaque"
}

resource "kubernetes_stateful_set" "minio" {
  metadata {
    name      = "minio"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app"                         = "minio"
      "app.kubernetes.io/name"      = "minio"
      "app.kubernetes.io/component" = "storage"
    })
  }

  spec {
    service_name = "minio-headless"
    replicas     = 1

    selector {
      match_labels = {
        app = "minio"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app"                         = "minio"
          "app.kubernetes.io/name"      = "minio"
          "app.kubernetes.io/component" = "storage"
        })
      }

      spec {
        container {
          name  = "minio"
          image = var.images.minio

          args = ["server", "/data", "--console-address", ":9001"]

          port {
            name           = "api"
            container_port = 9000
          }

          port {
            name           = "console"
            container_port = 9001
          }

          env {
            name = "MINIO_ROOT_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.minio.metadata[0].name
                key  = "rootUser"
              }
            }
          }

          env {
            name = "MINIO_ROOT_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.minio.metadata[0].name
                key  = "rootPassword"
              }
            }
          }

          resources {
            requests = {
              cpu    = local.resources.minio.cpu
              memory = local.resources.minio.memory
            }
            limits = {
              cpu    = local.resources.minio.cpu
              memory = local.resources.minio.memory
            }
          }

          volume_mount {
            name       = "data"
            mount_path = "/data"
          }

          liveness_probe {
            http_get {
              path = "/minio/health/live"
              port = 9000
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/minio/health/ready"
              port = 9000
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }
        }
      }
    }

    volume_claim_template {
      metadata {
        name = "data"
      }
      spec {
        access_modes       = ["ReadWriteOnce"]
        storage_class_name = var.storage_class

        resources {
          requests = {
            storage = local.resources.minio.storage
          }
        }
      }
    }

    update_strategy {
      type = "RollingUpdate"
    }
  }
}

resource "kubernetes_service" "minio_headless" {
  metadata {
    name      = "minio-headless"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "minio"
    })
  }

  spec {
    type                        = "ClusterIP"
    cluster_ip                  = "None"
    publish_not_ready_addresses = true

    selector = {
      app = "minio"
    }

    port {
      name        = "api"
      port        = 9000
      target_port = 9000
    }

    port {
      name        = "console"
      port        = 9001
      target_port = 9001
    }
  }
}

resource "kubernetes_service" "minio" {
  metadata {
    name      = "minio"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "minio"
    })
  }

  spec {
    type = "ClusterIP"

    selector = {
      app = "minio"
    }

    port {
      name        = "api"
      port        = 9000
      target_port = 9000
    }

    port {
      name        = "console"
      port        = 9001
      target_port = 9001
    }
  }
}

resource "kubernetes_service" "minio_console" {
  metadata {
    name      = "minio-console"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "minio"
    })
  }

  spec {
    type = "ClusterIP"

    selector = {
      app = "minio"
    }

    port {
      name        = "console"
      port        = 9001
      target_port = 9001
    }
  }
}

# Bucket initialization job - creates all required buckets
resource "kubernetes_job" "minio_bucket_init" {
  metadata {
    name      = "minio-bucket-init"
    namespace = var.namespace
    labels    = local.common_labels
  }

  spec {
    ttl_seconds_after_finished = 600
    backoff_limit              = 5

    template {
      metadata {
        labels = local.common_labels
      }

      spec {
        restart_policy = "OnFailure"

        container {
          name  = "mc"
          image = "minio/mc:latest"

          command = ["/bin/sh", "-c"]
          args = [<<-EOT
            echo "Waiting for MinIO to be ready..."
            until curl -sf http://minio:9000/minio/health/live; do
              echo "MinIO not ready, waiting..."
              sleep 2
            done
            echo "MinIO is ready!"

            mc alias set myminio http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD

            echo "Creating buckets..."
            mc mb myminio/bom-uploads --ignore-existing
            mc mb myminio/documents --ignore-existing
            mc mb myminio/exports --ignore-existing
            mc mb myminio/avatars --ignore-existing
            mc mb myminio/enrichment-audit --ignore-existing
            mc mb myminio/bulk-uploads --ignore-existing
            mc mb myminio/novu-storage --ignore-existing

            echo "Setting public access for avatars..."
            mc anonymous set download myminio/avatars

            echo "Bucket initialization complete!"
            mc ls myminio
          EOT
          ]

          env {
            name = "MINIO_ROOT_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.minio.metadata[0].name
                key  = "rootUser"
              }
            }
          }

          env {
            name = "MINIO_ROOT_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.minio.metadata[0].name
                key  = "rootPassword"
              }
            }
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_stateful_set.minio,
    kubernetes_service.minio
  ]
}

# -----------------------------------------------------------------------------
# Supabase PostgREST API (Optional - CNS Service connects directly to DB)
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "supabase_api" {
  count = var.deploy_supabase_api ? 1 : 0

  metadata {
    name      = "supabase-api"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "supabase-api"
      "app.kubernetes.io/component" = "api"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "supabase-api"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "supabase-api"
          "app.kubernetes.io/component" = "api"
        })
      }

      spec {
        container {
          name  = "supabase-api"
          image = var.images.supabase_api

          port {
            container_port = 3000
            name           = "http"
          }

          env {
            name  = "PGRST_DB_URI"
            value = "postgres://postgres:${local.supabase_db_password}@supabase-db:5432/postgres"
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
            value = var.supabase_jwt_secret
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "250m"
              memory = "256Mi"
            }
          }

          # Startup probe - allows up to 2 minutes for PostgREST to connect to DB
          startup_probe {
            http_get {
              path = "/"
              port = 3000
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            failure_threshold     = 24
            timeout_seconds       = 5
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 3000
            }
            initial_delay_seconds = 5
            period_seconds        = 10
            timeout_seconds       = 5
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 3000
            }
            initial_delay_seconds = 10
            period_seconds        = 30
            timeout_seconds       = 5
          }
        }
      }
    }
  }

  depends_on = [kubernetes_stateful_set.supabase_db]
}

resource "kubernetes_service" "supabase_api" {
  count = var.deploy_supabase_api ? 1 : 0

  metadata {
    name      = "supabase-api"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "supabase-api"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "supabase-api"
    }

    port {
      name        = "http"
      port        = 3000
      target_port = 3000
    }

    type = "ClusterIP"
  }
}

# -----------------------------------------------------------------------------
# CNS Service
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "cns_service" {
  metadata {
    name      = "${var.name_prefix}-cns-service-config"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    # Authentication - Keycloak (Auth0-compatible)
    AUTH0_ENABLED        = "true"
    AUTH0_DOMAIN         = "keycloak.auth-system.svc.cluster.local:8080/realms/ananta-saas"
    AUTH0_AUDIENCE       = "cbp-frontend"

    # Database URLs (required by pydantic Settings) - Use fully qualified Kubernetes DNS
    DATABASE_URL               = "postgresql://postgres:${local.supabase_db_password}@supabase-db.${var.namespace}.svc.cluster.local:5432/postgres"
    SUPABASE_DATABASE_URL      = "postgresql://postgres:${local.supabase_db_password}@supabase-db.${var.namespace}.svc.cluster.local:5432/postgres"
    COMPONENTS_V2_DATABASE_URL = "postgresql://postgres:${local.components_db_password}@components-db.${var.namespace}.svc.cluster.local:5432/components_v2"

    # Supabase connection details
    SUPABASE_URL         = "http://supabase-api:3000"
    SUPABASE_DB_HOST     = "supabase-db"
    SUPABASE_DB_PORT     = "5432"
    SUPABASE_DB_NAME     = "postgres"
    SUPABASE_DB_USER     = "postgres"

    # Components-V2 database
    COMPONENTS_DB_HOST   = "components-db"
    COMPONENTS_DB_PORT   = "5432"
    COMPONENTS_DB_NAME   = "components_v2"
    COMPONENTS_DB_USER   = "postgres"

    # Infrastructure - CNS code reads these env vars with specific names
    # REDIS_URL is required by CNS config.py (not just REDIS_HOST)
    REDIS_HOST           = "redis-master.${var.namespace}.svc.cluster.local"
    REDIS_PORT           = "6379"
    REDIS_URL            = "redis://redis-master.${var.namespace}.svc.cluster.local:6379/0"

    # RabbitMQ with full FQDN for cluster DNS resolution
    RABBITMQ_HOST        = "rabbitmq.${var.namespace}.svc.cluster.local"
    RABBITMQ_PORT        = "5672"
    RABBITMQ_STREAM_PORT = "5552"  # RabbitMQ Streams protocol port
    RABBITMQ_URL         = "amqp://guest:guest@rabbitmq.${var.namespace}.svc.cluster.local:5672/"

    MINIO_ENDPOINT       = "minio:9000"
    MINIO_USE_SSL        = "false"

    # Temporal - CNS code reads TEMPORAL_HOST (not TEMPORAL_ADDRESS)
    TEMPORAL_ADDRESS     = var.temporal_address
    TEMPORAL_HOST        = var.temporal_address
    TEMPORAL_URL         = var.temporal_address
    TEMPORAL_NAMESPACE   = "enrichment"
    TEMPORAL_ENABLED     = "true"

    # Vendor API Enable flags (all enabled by default)
    MOUSER_ENABLED       = "true"
    DIGIKEY_ENABLED      = "true"
    ELEMENT14_ENABLED    = "true"
    ARROW_ENABLED        = "true"

    LOG_LEVEL            = "INFO"

    # Disable OpenTelemetry OTLP exporter (no collector deployed locally)
    OTEL_SDK_DISABLED    = "true"
    OTEL_TRACES_EXPORTER = "none"
  }
}

# CNS Service Secrets (Vendor API Keys)
resource "kubernetes_secret" "cns_service" {
  metadata {
    name      = "${var.name_prefix}-cns-service-secrets"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    # JWT Secret for authentication
    JWT_SECRET_KEY        = var.cns_jwt_secret

    # Vendor API Keys (actual production keys)
    MOUSER_API_KEY        = var.mouser_api_key
    DIGIKEY_CLIENT_ID     = var.digikey_client_id
    DIGIKEY_CLIENT_SECRET = var.digikey_client_secret
    ELEMENT14_API_KEY     = var.element14_api_key
    ARROW_API_KEY         = var.arrow_api_key
  }

  type = "Opaque"
}

resource "kubernetes_deployment" "cns_service" {
  count = var.deploy_cns_service ? 1 : 0

  metadata {
    name      = "cns-service"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "cns-service"
      "app.kubernetes.io/component" = "api"
    })
  }

  spec {
    replicas = 1

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
      }

      spec {
        # Init container: Wait for database schema to be ready
        init_container {
          name  = "wait-for-schema"
          image = "postgres:15-alpine"

          command = ["/bin/sh", "-c"]
          args = [<<-EOT
            echo "Waiting for database schema verification..."
            MAX_ATTEMPTS=60
            ATTEMPT=0

            # Wait for Supabase bom_processing_jobs table
            until PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h supabase-db -p 5432 -U postgres -d postgres -c "SELECT 1 FROM bom_processing_jobs LIMIT 1" 2>/dev/null; do
              ATTEMPT=$((ATTEMPT + 1))
              if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
                echo "[ERROR] Schema not ready after $MAX_ATTEMPTS attempts"
                exit 1
              fi
              echo "Attempt $ATTEMPT/$MAX_ATTEMPTS - waiting for schema..."
              sleep 5
            done
            echo "Supabase schema ready!"

            # Wait for Components-V2 component_catalog table
            ATTEMPT=0
            until PGPASSWORD=$COMPONENTS_DB_PASSWORD psql -h components-db -p 5432 -U postgres -d components_v2 -c "SELECT 1 FROM component_catalog LIMIT 1" 2>/dev/null; do
              ATTEMPT=$((ATTEMPT + 1))
              if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
                echo "[ERROR] Components-V2 schema not ready after $MAX_ATTEMPTS attempts"
                exit 1
              fi
              echo "Attempt $ATTEMPT/$MAX_ATTEMPTS - waiting for Components-V2 schema..."
              sleep 5
            done
            echo "Components-V2 schema ready!"
            echo "All schemas verified. Starting CNS Service..."
          EOT
          ]

          env {
            name = "SUPABASE_DB_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.supabase_db.metadata[0].name
                key  = "POSTGRES_PASSWORD"
              }
            }
          }

          env {
            name = "COMPONENTS_DB_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.components_db.metadata[0].name
                key  = "POSTGRES_PASSWORD"
              }
            }
          }
        }

        container {
          name  = "cns-service"
          image = var.images.cns_service

          port {
            container_port = 8000
            name           = "http"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.cns_service.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.cns_service.metadata[0].name
            }
          }

          env {
            name = "SUPABASE_DB_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.supabase_db.metadata[0].name
                key  = "POSTGRES_PASSWORD"
              }
            }
          }

          env {
            name = "COMPONENTS_DB_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.components_db.metadata[0].name
                key  = "POSTGRES_PASSWORD"
              }
            }
          }

          # RabbitMQ password from Helm-managed secret
          env {
            name = "RABBITMQ_PASSWORD"
            value_from {
              secret_key_ref {
                name = "rabbitmq"  # Bitnami Helm creates this secret
                key  = "rabbitmq-password"
              }
            }
          }

          # MinIO credentials from Helm-managed secret
          env {
            name = "MINIO_ACCESS_KEY"
            value_from {
              secret_key_ref {
                name = "minio"  # MinIO Helm creates this secret
                key  = "rootUser"
              }
            }
          }

          env {
            name = "MINIO_SECRET_KEY"
            value_from {
              secret_key_ref {
                name = "minio"  # MinIO Helm creates this secret
                key  = "rootPassword"
              }
            }
          }

          resources {
            requests = {
              cpu    = local.resources.cns_service.cpu
              memory = local.resources.cns_service.memory
            }
            limits = {
              cpu    = local.resources.cns_service.cpu
              memory = local.resources.cns_service.memory
            }
          }

          # Startup probe - allows up to 2 minutes for Python to start and connect to DBs
          startup_probe {
            http_get {
              path = "/health"
              port = 8000
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            failure_threshold     = 24
            timeout_seconds       = 5
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 8000
            }
            initial_delay_seconds = 15
            period_seconds        = 10
            timeout_seconds       = 5
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 8000
            }
            initial_delay_seconds = 30
            period_seconds        = 30
            timeout_seconds       = 5
            failure_threshold     = 5
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_stateful_set.supabase_db,
    kubernetes_stateful_set.components_db,
    kubernetes_stateful_set.redis,
    kubernetes_stateful_set.rabbitmq,
    # CRITICAL: Wait for database migrations and RabbitMQ streams before starting
    kubernetes_job.db_migration,
    kubernetes_job.rabbitmq_stream_init
  ]
}

resource "kubernetes_service" "cns_service" {
  count = var.deploy_cns_service ? 1 : 0

  metadata {
    name      = "cns-service"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "cns-service"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "cns-service"
    }

    port {
      name        = "http"
      port        = 27200
      target_port = 8000
    }

    type = "ClusterIP"
  }
}

# -----------------------------------------------------------------------------
# CNS Temporal Worker
# Executes BOM enrichment workflows scheduled by CNS Service consumers
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "cns_worker" {
  count = var.deploy_cns_service ? 1 : 0

  metadata {
    name      = "cns-worker"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "cns-worker"
      "app.kubernetes.io/component" = "worker"
    })
  }

  spec {
    replicas = 1

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
        # Init container: Wait for database schema and Temporal to be ready
        init_container {
          name  = "wait-for-dependencies"
          image = "postgres:15-alpine"

          command = ["/bin/sh", "-c"]
          args = [<<-EOT
            echo "Waiting for CNS Worker dependencies..."
            MAX_ATTEMPTS=60
            ATTEMPT=0

            # Wait for Supabase schema
            until PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h supabase-db -p 5432 -U postgres -d postgres -c "SELECT 1 FROM bom_processing_jobs LIMIT 1" 2>/dev/null; do
              ATTEMPT=$((ATTEMPT + 1))
              if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
                echo "[ERROR] Supabase schema not ready after $MAX_ATTEMPTS attempts"
                exit 1
              fi
              echo "Attempt $ATTEMPT/$MAX_ATTEMPTS - waiting for Supabase schema..."
              sleep 5
            done
            echo "Supabase schema ready!"

            # Wait for Components-V2 schema
            ATTEMPT=0
            until PGPASSWORD=$COMPONENTS_DB_PASSWORD psql -h components-db -p 5432 -U postgres -d components_v2 -c "SELECT 1 FROM component_catalog LIMIT 1" 2>/dev/null; do
              ATTEMPT=$((ATTEMPT + 1))
              if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
                echo "[ERROR] Components-V2 schema not ready after $MAX_ATTEMPTS attempts"
                exit 1
              fi
              echo "Attempt $ATTEMPT/$MAX_ATTEMPTS - waiting for Components-V2 schema..."
              sleep 5
            done
            echo "Components-V2 schema ready!"
            echo "All dependencies verified. Starting CNS Worker..."
          EOT
          ]

          env {
            name = "SUPABASE_DB_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.supabase_db.metadata[0].name
                key  = "POSTGRES_PASSWORD"
              }
            }
          }

          env {
            name = "COMPONENTS_DB_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.components_db.metadata[0].name
                key  = "POSTGRES_PASSWORD"
              }
            }
          }
        }

        container {
          name  = "cns-worker"
          image = var.images.cns_service  # Uses same image as cns-service

          # Override command to run the Temporal worker
          command = ["python", "-m", "app.workers.bom_worker"]

          env_from {
            config_map_ref {
              name = kubernetes_config_map.cns_service.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.cns_service.metadata[0].name
            }
          }

          # Override LOG_LEVEL to see worker startup
          env {
            name  = "LOG_LEVEL"
            value = "INFO"
          }

          resources {
            requests = {
              cpu    = local.resources.cns_service.cpu
              memory = local.resources.cns_service.memory
            }
            limits = {
              cpu    = local.resources.cns_service.cpu
              memory = local.resources.cns_service.memory
            }
          }

          # Worker doesn't expose HTTP - use simple exec probe
          liveness_probe {
            exec {
              command = ["python", "-c", "import sys; sys.exit(0)"]
            }
            initial_delay_seconds = 30
            period_seconds        = 60
            timeout_seconds       = 5
            failure_threshold     = 3
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_stateful_set.supabase_db,
    kubernetes_stateful_set.components_db,
    kubernetes_stateful_set.redis,
    kubernetes_stateful_set.rabbitmq,
    kubernetes_deployment.cns_service,
    # CRITICAL: Wait for database migrations and RabbitMQ streams before starting
    kubernetes_job.db_migration,
    kubernetes_job.rabbitmq_stream_init
  ]
}

# -----------------------------------------------------------------------------
# Customer Portal
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "customer_portal" {
  count = var.deploy_customer_portal ? 1 : 0

  metadata {
    name      = "customer-portal"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "customer-portal"
      "app.kubernetes.io/component" = "frontend"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "customer-portal"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "customer-portal"
          "app.kubernetes.io/component" = "frontend"
        })
      }

      spec {
        container {
          name  = "customer-portal"
          image = var.images.customer_portal

          port {
            container_port = 80
            name           = "http"
          }

          resources {
            requests = {
              cpu    = local.resources.customer_portal.cpu
              memory = local.resources.customer_portal.memory
            }
            limits = {
              cpu    = local.resources.customer_portal.cpu
              memory = local.resources.customer_portal.memory
            }
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "customer_portal" {
  count = var.deploy_customer_portal ? 1 : 0

  metadata {
    name      = "customer-portal"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "customer-portal"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "customer-portal"
    }

    port {
      name        = "http"
      port        = 27100
      target_port = 80
    }

    type = "ClusterIP"
  }
}

# -----------------------------------------------------------------------------
# Database Migration Job
# -----------------------------------------------------------------------------

resource "kubernetes_job" "db_migration" {
  count = var.run_migrations ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-app-plane-migration"
    namespace = var.namespace
    labels    = local.common_labels
  }

  spec {
    ttl_seconds_after_finished = 600
    backoff_limit              = 5

    template {
      metadata {
        labels = local.common_labels
      }

      spec {
        restart_policy = "OnFailure"

        container {
          name  = "migration"
          image = "postgres:15-alpine"

          command = ["/bin/sh", "-c"]
          args = [<<-EOT
            echo "======================================"
            echo "Waiting for Supabase DB to be ready..."
            echo "======================================"
            until pg_isready -h supabase-db -p 5432 -U postgres 2>/dev/null; do
              sleep 5
            done
            echo "Supabase DB is ready!"

            echo "======================================"
            echo "Creating Supabase roles..."
            echo "======================================"
            PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h supabase-db -p 5432 -U postgres -d postgres <<-'EOSQL'
            -- Create supabase_admin role (superuser for migrations)
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
                CREATE ROLE supabase_admin WITH LOGIN SUPERUSER PASSWORD 'postgres';
              END IF;
            END
            $$;

            -- Create authenticator role (PostgREST connection role)
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
                CREATE ROLE authenticator WITH LOGIN NOINHERIT PASSWORD 'postgres';
              END IF;
            END
            $$;

            -- Create anon role (anonymous/public access)
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
                CREATE ROLE anon NOLOGIN NOINHERIT;
              END IF;
            END
            $$;

            -- Create authenticated role (logged-in users)
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
                CREATE ROLE authenticated NOLOGIN NOINHERIT;
              END IF;
            END
            $$;

            -- Create service_role (backend services with elevated privileges)
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
                CREATE ROLE service_role WITH LOGIN BYPASSRLS PASSWORD 'postgres';
              END IF;
            END
            $$;

            -- Grant role hierarchy
            GRANT anon TO authenticator;
            GRANT authenticated TO authenticator;
            GRANT service_role TO authenticator;

            -- Create required schemas
            CREATE SCHEMA IF NOT EXISTS extensions;
            CREATE SCHEMA IF NOT EXISTS auth;
            CREATE SCHEMA IF NOT EXISTS storage;
            CREATE SCHEMA IF NOT EXISTS realtime;

            -- Grant schema access
            GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
            GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
            GRANT USAGE ON SCHEMA auth TO service_role;
            GRANT USAGE ON SCHEMA storage TO service_role;
            EOSQL
            echo "Supabase roles created!"

            echo "======================================"
            echo "Running Supabase migrations..."
            echo "======================================"
            PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h supabase-db -p 5432 -U postgres -d postgres -f /migrations/001_SUPABASE_MASTER.sql

            echo "======================================"
            echo "Waiting for Components DB to be ready..."
            echo "======================================"
            until pg_isready -h components-db -p 5432 -U postgres 2>/dev/null; do
              sleep 5
            done
            echo "Components DB is ready!"

            echo "======================================"
            echo "Running Components-V2 migrations..."
            echo "======================================"
            PGPASSWORD=$COMPONENTS_DB_PASSWORD psql -h components-db -p 5432 -U postgres -d components_v2 -f /migrations/002_COMPONENTS_V2_MASTER.sql

            echo "======================================"
            echo "All migrations completed successfully!"
            echo "======================================"
          EOT
          ]

          env {
            name = "SUPABASE_DB_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.supabase_db.metadata[0].name
                key  = "POSTGRES_PASSWORD"
              }
            }
          }

          env {
            name = "COMPONENTS_DB_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.components_db.metadata[0].name
                key  = "POSTGRES_PASSWORD"
              }
            }
          }

          volume_mount {
            name       = "migrations"
            mount_path = "/migrations"
          }
        }

        volume {
          name = "migrations"
          config_map {
            name = var.migrations_config_map
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_stateful_set.supabase_db,
    kubernetes_stateful_set.components_db
  ]
}

# =============================================================================
# SUPABASE STUDIO & META (Database Admin UI)
# =============================================================================

# -----------------------------------------------------------------------------
# Supabase Meta (PostgreSQL Metadata API)
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "supabase_meta" {
  count = var.deploy_supabase_studio ? 1 : 0

  metadata {
    name      = "supabase-meta"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "supabase-meta"
      "app.kubernetes.io/component" = "database-admin"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "supabase-meta"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "supabase-meta"
          "app.kubernetes.io/component" = "database-admin"
        })
      }

      spec {
        container {
          name  = "supabase-meta"
          image = var.images.supabase_meta

          port {
            container_port = 8080
            name           = "http"
          }

          env {
            name  = "PG_META_PORT"
            value = "8080"
          }

          env {
            name  = "PG_META_DB_HOST"
            value = "supabase-db"
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
            name = "PG_META_DB_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.supabase_db.metadata[0].name
                key  = "POSTGRES_PASSWORD"
              }
            }
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "200m"
              memory = "256Mi"
            }
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 8080
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }
        }
      }
    }
  }

  depends_on = [kubernetes_stateful_set.supabase_db]
}

resource "kubernetes_service" "supabase_meta" {
  count = var.deploy_supabase_studio ? 1 : 0

  metadata {
    name      = "supabase-meta"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "supabase-meta"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "supabase-meta"
    }

    port {
      name        = "http"
      port        = 8080
      target_port = 8080
    }

    type = "ClusterIP"
  }
}

# -----------------------------------------------------------------------------
# Supabase Studio (Database Admin UI)
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "supabase_studio" {
  count = var.deploy_supabase_studio ? 1 : 0

  metadata {
    name      = "supabase-studio"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "supabase-studio"
      "app.kubernetes.io/component" = "database-admin"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "supabase-studio"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "supabase-studio"
          "app.kubernetes.io/component" = "database-admin"
        })
      }

      spec {
        container {
          name  = "supabase-studio"
          image = var.images.supabase_studio

          port {
            container_port = 3000
            name           = "http"
          }

          env {
            name  = "STUDIO_PG_META_URL"
            value = "http://supabase-meta:8080"
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
            name  = "SUPABASE_URL"
            value = "http://supabase-api:3000"
          }

          env {
            name  = "SUPABASE_REST_URL"
            value = "http://supabase-api:3000/rest/v1/"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "250m"
              memory = "512Mi"
            }
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 3000
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_deployment.supabase_meta
  ]
}

resource "kubernetes_service" "supabase_studio" {
  count = var.deploy_supabase_studio ? 1 : 0

  metadata {
    name      = "supabase-studio"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "supabase-studio"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "supabase-studio"
    }

    port {
      name        = "http"
      port        = 27800
      target_port = 3000
    }

    type = "ClusterIP"
  }
}

# =============================================================================
# CNS DASHBOARD (React Admin Frontend)
# =============================================================================

resource "kubernetes_deployment" "cns_dashboard" {
  count = var.deploy_cns_dashboard && var.images.cns_dashboard != null ? 1 : 0

  metadata {
    name      = "cns-dashboard"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "cns-dashboard"
      "app.kubernetes.io/component" = "frontend"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "cns-dashboard"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "cns-dashboard"
          "app.kubernetes.io/component" = "frontend"
        })
      }

      spec {
        container {
          name  = "cns-dashboard"
          image = var.images.cns_dashboard

          port {
            container_port = 27810
            name           = "http"
          }

          env {
            name  = "CNS_DASHBOARD_PORT"
            value = "27810"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "200m"
              memory = "256Mi"
            }
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 27810
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }
        }
      }
    }
  }

  depends_on = [kubernetes_deployment.cns_service]
}

resource "kubernetes_service" "cns_dashboard" {
  count = var.deploy_cns_dashboard && var.images.cns_dashboard != null ? 1 : 0

  metadata {
    name      = "cns-dashboard"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "cns-dashboard"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "cns-dashboard"
    }

    port {
      name        = "http"
      port        = 27250
      target_port = 27810
    }

    type = "ClusterIP"
  }
}

# =============================================================================
# NOVU NOTIFICATION SERVICES
# =============================================================================

# -----------------------------------------------------------------------------
# Novu MongoDB (Dedicated for Novu)
# -----------------------------------------------------------------------------

resource "kubernetes_stateful_set" "novu_mongodb" {
  count = var.deploy_novu ? 1 : 0

  metadata {
    name      = "novu-mongodb"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "novu-mongodb"
      "app.kubernetes.io/component" = "database"
    })
  }

  spec {
    service_name = "novu-mongodb"
    replicas     = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "novu-mongodb"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "novu-mongodb"
          "app.kubernetes.io/component" = "database"
        })
      }

      spec {
        container {
          name  = "mongodb"
          image = var.images.mongodb

          port {
            container_port = 27017
            name           = "mongodb"
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "1Gi"
            }
          }

          volume_mount {
            name       = "data"
            mount_path = "/data/db"
          }

          readiness_probe {
            exec {
              command = ["sh", "-c", "timeout 2 sh -c '>/dev/tcp/127.0.0.1/27017'"]
            }
            initial_delay_seconds = 10
            period_seconds        = 10
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
            storage = "5Gi"
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "novu_mongodb" {
  count = var.deploy_novu ? 1 : 0

  metadata {
    name      = "novu-mongodb"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "novu-mongodb"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "novu-mongodb"
    }

    port {
      name        = "mongodb"
      port        = 27017
      target_port = 27017
    }

    cluster_ip = "None"
  }
}

# -----------------------------------------------------------------------------
# Novu Redis (Dedicated for Novu)
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "novu_redis" {
  count = var.deploy_novu ? 1 : 0

  metadata {
    name      = "novu-redis"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "novu-redis"
      "app.kubernetes.io/component" = "cache"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "novu-redis"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "novu-redis"
          "app.kubernetes.io/component" = "cache"
        })
      }

      spec {
        container {
          name  = "redis"
          image = var.images.redis
          command = ["redis-server", "--appendonly", "yes"]

          port {
            container_port = 6379
            name           = "redis"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "200m"
              memory = "256Mi"
            }
          }

          readiness_probe {
            exec {
              command = ["redis-cli", "ping"]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "novu_redis" {
  count = var.deploy_novu ? 1 : 0

  metadata {
    name      = "novu-redis"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "novu-redis"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "novu-redis"
    }

    port {
      name        = "redis"
      port        = 6379
      target_port = 6379
    }

    type = "ClusterIP"
  }
}

# -----------------------------------------------------------------------------
# Novu Secrets
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "novu" {
  count = var.deploy_novu ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-novu-secrets"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    JWT_SECRET           = var.novu_jwt_secret
    STORE_ENCRYPTION_KEY = var.novu_encryption_key
    NOVU_SECRET_KEY      = var.novu_secret_key
  }

  type = "Opaque"
}

# -----------------------------------------------------------------------------
# Novu API
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "novu_api" {
  count = var.deploy_novu ? 1 : 0

  metadata {
    name      = "novu-api"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "novu-api"
      "app.kubernetes.io/component" = "notification-api"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "novu-api"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "novu-api"
          "app.kubernetes.io/component" = "notification-api"
        })
      }

      spec {
        container {
          name  = "novu-api"
          image = var.images.novu_api

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
            name  = "DISABLE_USER_REGISTRATION"
            value = "false"
          }

          env {
            name  = "MONGO_URL"
            value = "mongodb://novu-mongodb:27017/novu-db"
          }

          env {
            name  = "REDIS_HOST"
            value = "novu-redis"
          }

          env {
            name  = "REDIS_PORT"
            value = "6379"
          }

          env {
            name  = "S3_LOCAL_STACK"
            value = "http://minio:9000"
          }

          env {
            name  = "S3_BUCKET_NAME"
            value = "novu-storage"
          }

          env {
            name  = "S3_REGION"
            value = "us-east-1"
          }

          env {
            name  = "AWS_ACCESS_KEY_ID"
            value = "minioadmin"
          }

          env {
            name = "AWS_SECRET_ACCESS_KEY"
            value_from {
              secret_key_ref {
                name = "minio"  # MinIO Helm creates this secret
                key  = "rootPassword"
              }
            }
          }

          env {
            name = "JWT_SECRET"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.novu[0].metadata[0].name
                key  = "JWT_SECRET"
              }
            }
          }

          env {
            name = "STORE_ENCRYPTION_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.novu[0].metadata[0].name
                key  = "STORE_ENCRYPTION_KEY"
              }
            }
          }

          env {
            name = "NOVU_SECRET_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.novu[0].metadata[0].name
                key  = "NOVU_SECRET_KEY"
              }
            }
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "1Gi"
            }
          }

          readiness_probe {
            http_get {
              path = "/v1/health-check"
              port = 3000
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_stateful_set.novu_mongodb,
    kubernetes_deployment.novu_redis
  ]
}

resource "kubernetes_service" "novu_api" {
  count = var.deploy_novu ? 1 : 0

  metadata {
    name      = "novu-api"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "novu-api"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "novu-api"
    }

    port {
      name        = "http"
      port        = 13100
      target_port = 3000
    }

    type = "ClusterIP"
  }
}

# -----------------------------------------------------------------------------
# Novu WebSocket
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "novu_ws" {
  count = var.deploy_novu ? 1 : 0

  metadata {
    name      = "novu-ws"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "novu-ws"
      "app.kubernetes.io/component" = "notification-ws"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "novu-ws"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "novu-ws"
          "app.kubernetes.io/component" = "notification-ws"
        })
      }

      spec {
        container {
          name  = "novu-ws"
          image = var.images.novu_ws

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
            name  = "MONGO_URL"
            value = "mongodb://novu-mongodb:27017/novu-db"
          }

          env {
            name  = "REDIS_HOST"
            value = "novu-redis"
          }

          env {
            name  = "REDIS_PORT"
            value = "6379"
          }

          env {
            name = "JWT_SECRET"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.novu[0].metadata[0].name
                key  = "JWT_SECRET"
              }
            }
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "250m"
              memory = "512Mi"
            }
          }

          readiness_probe {
            tcp_socket {
              port = 3002
            }
            initial_delay_seconds = 15
            period_seconds        = 10
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_stateful_set.novu_mongodb,
    kubernetes_deployment.novu_redis
  ]
}

resource "kubernetes_service" "novu_ws" {
  count = var.deploy_novu ? 1 : 0

  metadata {
    name      = "novu-ws"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "novu-ws"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "novu-ws"
    }

    port {
      name        = "ws"
      port        = 13102
      target_port = 3002
    }

    type = "ClusterIP"
  }
}

# -----------------------------------------------------------------------------
# Novu Worker
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "novu_worker" {
  count = var.deploy_novu ? 1 : 0

  metadata {
    name      = "novu-worker"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "novu-worker"
      "app.kubernetes.io/component" = "notification-worker"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "novu-worker"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "novu-worker"
          "app.kubernetes.io/component" = "notification-worker"
        })
      }

      spec {
        container {
          name  = "novu-worker"
          image = var.images.novu_worker

          env {
            name  = "NODE_ENV"
            value = "production"
          }

          env {
            name  = "MONGO_URL"
            value = "mongodb://novu-mongodb:27017/novu-db"
          }

          env {
            name  = "REDIS_HOST"
            value = "novu-redis"
          }

          env {
            name  = "REDIS_PORT"
            value = "6379"
          }

          env {
            name  = "API_ROOT_URL"
            value = "http://novu-api:3000"
          }

          env {
            name = "JWT_SECRET"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.novu[0].metadata[0].name
                key  = "JWT_SECRET"
              }
            }
          }

          env {
            name = "STORE_ENCRYPTION_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.novu[0].metadata[0].name
                key  = "STORE_ENCRYPTION_KEY"
              }
            }
          }

          env {
            name = "NOVU_SECRET_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.novu[0].metadata[0].name
                key  = "NOVU_SECRET_KEY"
              }
            }
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "1Gi"
            }
          }
        }
      }
    }
  }

  depends_on = [kubernetes_deployment.novu_api]
}

# -----------------------------------------------------------------------------
# Novu Web (Dashboard UI)
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "novu_web" {
  count = var.deploy_novu ? 1 : 0

  metadata {
    name      = "novu-web"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "novu-web"
      "app.kubernetes.io/component" = "notification-ui"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "novu-web"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "novu-web"
          "app.kubernetes.io/component" = "notification-ui"
        })
      }

      spec {
        container {
          name  = "novu-web"
          image = var.images.novu_web

          port {
            container_port = 4200
            name           = "http"
          }

          env {
            name  = "REACT_APP_API_URL"
            value = "http://localhost:13100"
          }

          env {
            name  = "REACT_APP_WS_URL"
            value = "http://localhost:13102"
          }

          env {
            name  = "API_ROOT_URL"
            value = "http://novu-api:3000"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "200m"
              memory = "256Mi"
            }
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 4200
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }
        }
      }
    }
  }

  depends_on = [kubernetes_deployment.novu_api]
}

resource "kubernetes_service" "novu_web" {
  count = var.deploy_novu ? 1 : 0

  metadata {
    name      = "novu-web"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "novu-web"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "novu-web"
    }

    port {
      name        = "http"
      port        = 13200
      target_port = 4200
    }

    type = "ClusterIP"
  }
}

# =============================================================================
# OBSERVABILITY STACK (Jaeger, Prometheus, Grafana)
# =============================================================================

# -----------------------------------------------------------------------------
# Jaeger (Distributed Tracing)
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "jaeger" {
  count = var.deploy_observability ? 1 : 0

  metadata {
    name      = "jaeger"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "jaeger"
      "app.kubernetes.io/component" = "observability"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "jaeger"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "jaeger"
          "app.kubernetes.io/component" = "observability"
        })
      }

      spec {
        container {
          name  = "jaeger"
          image = var.images.jaeger

          port {
            container_port = 6831
            name           = "thrift-compact"
            protocol       = "UDP"
          }

          port {
            container_port = 6832
            name           = "thrift-binary"
            protocol       = "UDP"
          }

          port {
            container_port = 5778
            name           = "config"
          }

          port {
            container_port = 16686
            name           = "ui"
          }

          port {
            container_port = 14268
            name           = "collector"
          }

          port {
            container_port = 14250
            name           = "grpc"
          }

          port {
            container_port = 4317
            name           = "otlp-grpc"
          }

          port {
            container_port = 4318
            name           = "otlp-http"
          }

          env {
            name  = "COLLECTOR_OTLP_ENABLED"
            value = "true"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "250m"
              memory = "512Mi"
            }
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 16686
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "jaeger" {
  count = var.deploy_observability ? 1 : 0

  metadata {
    name      = "jaeger"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "jaeger"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "jaeger"
    }

    port {
      name        = "ui"
      port        = 16686
      target_port = 16686
    }

    port {
      name        = "collector"
      port        = 14268
      target_port = 14268
    }

    port {
      name        = "otlp-grpc"
      port        = 4317
      target_port = 4317
    }

    port {
      name        = "otlp-http"
      port        = 4318
      target_port = 4318
    }

    type = "ClusterIP"
  }
}

# -----------------------------------------------------------------------------
# Prometheus ConfigMap
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "prometheus" {
  count = var.deploy_observability ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-prometheus-config"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    "prometheus.yml" = <<-EOT
      global:
        scrape_interval: 15s
        evaluation_interval: 15s

      scrape_configs:
        - job_name: 'prometheus'
          static_configs:
            - targets: ['localhost:9090']

        - job_name: 'app-plane-services'
          kubernetes_sd_configs:
            - role: pod
              namespaces:
                names:
                  - ${var.namespace}
          relabel_configs:
            - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
              action: keep
              regex: true
            - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
              action: replace
              target_label: __metrics_path__
              regex: (.+)
            - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
              action: replace
              regex: ([^:]+)(?::\d+)?;(\d+)
              replacement: $1:$2
              target_label: __address__

        - job_name: 'redis'
          static_configs:
            - targets: ['redis:6379']

        - job_name: 'rabbitmq'
          static_configs:
            - targets: ['rabbitmq:15692']
    EOT
  }
}

# -----------------------------------------------------------------------------
# Prometheus
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "prometheus" {
  count = var.deploy_observability ? 1 : 0

  metadata {
    name      = "prometheus"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "prometheus"
      "app.kubernetes.io/component" = "observability"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "prometheus"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "prometheus"
          "app.kubernetes.io/component" = "observability"
        })
      }

      spec {
        service_account_name = "default"

        container {
          name  = "prometheus"
          image = var.images.prometheus

          args = [
            "--config.file=/etc/prometheus/prometheus.yml",
            "--storage.tsdb.path=/prometheus",
            "--web.console.libraries=/usr/share/prometheus/console_libraries",
            "--web.console.templates=/usr/share/prometheus/consoles",
            "--web.enable-lifecycle"
          ]

          port {
            container_port = 9090
            name           = "http"
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "1Gi"
            }
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/prometheus"
          }

          volume_mount {
            name       = "data"
            mount_path = "/prometheus"
          }

          readiness_probe {
            http_get {
              path = "/-/ready"
              port = 9090
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.prometheus[0].metadata[0].name
          }
        }

        volume {
          name = "data"
          empty_dir {}
        }
      }
    }
  }
}

resource "kubernetes_service" "prometheus" {
  count = var.deploy_observability ? 1 : 0

  metadata {
    name      = "prometheus"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "prometheus"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "prometheus"
    }

    port {
      name        = "http"
      port        = 9090
      target_port = 9090
    }

    type = "ClusterIP"
  }
}

# -----------------------------------------------------------------------------
# Grafana Secrets
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "grafana" {
  count = var.deploy_observability ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-grafana-secrets"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    GF_SECURITY_ADMIN_PASSWORD = var.grafana_admin_password
  }

  type = "Opaque"
}

# -----------------------------------------------------------------------------
# Grafana ConfigMap (Datasources)
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "grafana_datasources" {
  count = var.deploy_observability ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-grafana-datasources"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    "datasources.yaml" = <<-EOT
      apiVersion: 1
      datasources:
        - name: Prometheus
          type: prometheus
          access: proxy
          url: http://prometheus:9090
          isDefault: true
        - name: Jaeger
          type: jaeger
          access: proxy
          url: http://jaeger:16686
    EOT
  }
}

# -----------------------------------------------------------------------------
# Grafana
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "grafana" {
  count = var.deploy_observability ? 1 : 0

  metadata {
    name      = "grafana"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = "grafana"
      "app.kubernetes.io/component" = "observability"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "grafana"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = "grafana"
          "app.kubernetes.io/component" = "observability"
        })
      }

      spec {
        container {
          name  = "grafana"
          image = var.images.grafana

          port {
            container_port = 3000
            name           = "http"
          }

          env {
            name  = "GF_SECURITY_ADMIN_USER"
            value = "admin"
          }

          env {
            name = "GF_SECURITY_ADMIN_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.grafana[0].metadata[0].name
                key  = "GF_SECURITY_ADMIN_PASSWORD"
              }
            }
          }

          env {
            name  = "GF_PATHS_PROVISIONING"
            value = "/etc/grafana/provisioning"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "250m"
              memory = "512Mi"
            }
          }

          volume_mount {
            name       = "datasources"
            mount_path = "/etc/grafana/provisioning/datasources"
          }

          volume_mount {
            name       = "data"
            mount_path = "/var/lib/grafana"
          }

          readiness_probe {
            http_get {
              path = "/api/health"
              port = 3000
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }
        }

        volume {
          name = "datasources"
          config_map {
            name = kubernetes_config_map.grafana_datasources[0].metadata[0].name
          }
        }

        volume {
          name = "data"
          empty_dir {}
        }
      }
    }
  }

  depends_on = [kubernetes_deployment.prometheus]
}

resource "kubernetes_service" "grafana" {
  count = var.deploy_observability ? 1 : 0

  metadata {
    name      = "grafana"
    namespace = var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = "grafana"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "grafana"
    }

    port {
      name        = "http"
      port        = 3000
      target_port = 3000
    }

    type = "ClusterIP"
  }
}
