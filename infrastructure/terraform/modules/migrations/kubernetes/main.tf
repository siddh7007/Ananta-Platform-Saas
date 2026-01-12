# Terraform module for Kubernetes-based database migrations
# Handles Control Plane (LoopBack), Supabase, and Components-V2 migrations

terraform {
  required_version = ">= 1.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

# Local variables for common configuration
locals {
  common_labels = merge(
    var.labels,
    {
      "app.kubernetes.io/component"  = "migrations"
      "app.kubernetes.io/part-of"    = "ananta-platform"
      "app.kubernetes.io/managed-by" = "terraform"
    }
  )

  control_plane_labels = merge(
    local.common_labels,
    {
      "app.kubernetes.io/name" = "control-plane-migrations"
    }
  )

  supabase_labels = merge(
    local.common_labels,
    {
      "app.kubernetes.io/name" = "supabase-migrations"
    }
  )

  components_v2_labels = merge(
    local.common_labels,
    {
      "app.kubernetes.io/name" = "components-v2-migrations"
    }
  )
}

# Random suffix for job names to ensure uniqueness on re-runs
resource "random_id" "control_plane_job_suffix" {
  count       = var.run_control_plane_migrations ? 1 : 0
  byte_length = 4
  keepers = {
    timestamp = timestamp()
  }
}

resource "random_id" "supabase_job_suffix" {
  count       = var.run_supabase_migrations ? 1 : 0
  byte_length = 4
  keepers = {
    timestamp = timestamp()
  }
}

resource "random_id" "components_v2_job_suffix" {
  count       = var.run_components_v2_migrations ? 1 : 0
  byte_length = 4
  keepers = {
    timestamp = timestamp()
  }
}

# Kubernetes Secret for database credentials
resource "kubernetes_secret" "migration_db_credentials" {
  metadata {
    name      = "migration-db-credentials"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    # Control Plane database
    control_plane_db_password = var.control_plane_db_password
    control_plane_db_user     = var.control_plane_db_user

    # Supabase database
    supabase_db_password = var.supabase_db_password
    supabase_db_user     = var.supabase_db_user

    # Components-V2 database
    components_v2_db_password = var.components_v2_db_password
    components_v2_db_user     = var.components_v2_db_user
  }

  type = "Opaque"
}

# ConfigMap for migration configuration
resource "kubernetes_config_map" "migration_config" {
  metadata {
    name      = "migration-config"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    # Control Plane
    control_plane_db_host = var.control_plane_db_host
    control_plane_db_port = tostring(var.control_plane_db_port)
    control_plane_db_name = var.control_plane_db_name

    # Supabase
    supabase_db_host = var.supabase_db_host
    supabase_db_port = tostring(var.supabase_db_port)
    supabase_db_name = var.supabase_db_name

    # Components-V2
    components_v2_db_host = var.components_v2_db_host
    components_v2_db_port = tostring(var.components_v2_db_port)
    components_v2_db_name = var.components_v2_db_name

    # Migration settings
    migration_timeout = var.migration_timeout
  }
}

# Job: Control Plane Migrations (LoopBack db-migrate)
resource "kubernetes_job" "control_plane_migrations" {
  count = var.run_control_plane_migrations ? 1 : 0

  metadata {
    name      = "control-plane-migrations-${random_id.control_plane_job_suffix[0].hex}"
    namespace = var.namespace
    labels    = local.control_plane_labels
    annotations = {
      "migration.ananta.io/database"  = "control-plane"
      "migration.ananta.io/timestamp" = timestamp()
    }
  }

  spec {
    backoff_limit              = 3
    ttl_seconds_after_finished = 300
    completions                = 1
    parallelism                = 1

    template {
      metadata {
        labels = local.control_plane_labels
        annotations = {
          "sidecar.istio.io/inject" = "false"
        }
      }

      spec {
        restart_policy       = "Never"
        service_account_name = var.service_account_name

        # Init container: Wait for PostgreSQL readiness
        init_container {
          name  = "wait-for-postgres"
          image = var.postgres_wait_image

          command = [
            "sh",
            "-c",
            "echo '[INFO] Waiting for PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT...' && until pg_isready -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t 5; do echo '[INFO] PostgreSQL is unavailable - retrying in 2s...' && sleep 2; done && echo '[OK] PostgreSQL is ready'"
          ]

          env {
            name = "POSTGRES_HOST"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "control_plane_db_host"
              }
            }
          }

          env {
            name = "POSTGRES_PORT"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "control_plane_db_port"
              }
            }
          }

          env {
            name = "POSTGRES_DB"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "control_plane_db_name"
              }
            }
          }

          env {
            name = "POSTGRES_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.migration_db_credentials.metadata[0].name
                key  = "control_plane_db_user"
              }
            }
          }

          env {
            name = "PGPASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.migration_db_credentials.metadata[0].name
                key  = "control_plane_db_password"
              }
            }
          }

          resources {
            requests = {
              cpu    = "50m"
              memory = "64Mi"
            }
            limits = {
              cpu    = "100m"
              memory = "128Mi"
            }
          }
        }

        # Main container: Run LoopBack migrations
        container {
          name  = "run-migrations"
          image = var.control_plane_migration_image

          command = [
            "sh",
            "-c",
            "echo '[INFO] Starting Control Plane migrations...' && echo '[INFO] Database: $DB_HOST:$DB_PORT/$DB_DATABASE' && npm run migrate || { echo '[ERROR] Migration failed with exit code $?'; exit 1; } && echo '[OK] Control Plane migrations completed successfully'"
          ]

          env {
            name = "DB_HOST"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "control_plane_db_host"
              }
            }
          }

          env {
            name = "DB_PORT"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "control_plane_db_port"
              }
            }
          }

          env {
            name = "DB_DATABASE"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "control_plane_db_name"
              }
            }
          }

          env {
            name = "DB_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.migration_db_credentials.metadata[0].name
                key  = "control_plane_db_user"
              }
            }
          }

          env {
            name = "DB_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.migration_db_credentials.metadata[0].name
                key  = "control_plane_db_password"
              }
            }
          }

          env {
            name  = "DB_SCHEMA"
            value = var.control_plane_db_schema
          }

          env {
            name  = "NODE_ENV"
            value = "production"
          }

          resources {
            requests = {
              cpu    = var.migration_resources.requests.cpu
              memory = var.migration_resources.requests.memory
            }
            limits = {
              cpu    = var.migration_resources.limits.cpu
              memory = var.migration_resources.limits.memory
            }
          }

          security_context {
            run_as_non_root = true
            run_as_user     = 1000
            capabilities {
              drop = ["ALL"]
            }
            read_only_root_filesystem = false
          }
        }
      }
    }
  }

  wait_for_completion = var.wait_for_completion

  timeouts {
    create = var.migration_timeout
    update = var.migration_timeout
  }
}

# Job: Supabase Migrations
resource "kubernetes_job" "supabase_migrations" {
  count = var.run_supabase_migrations ? 1 : 0

  metadata {
    name      = "supabase-migrations-${random_id.supabase_job_suffix[0].hex}"
    namespace = var.namespace
    labels    = local.supabase_labels
    annotations = {
      "migration.ananta.io/database"  = "supabase"
      "migration.ananta.io/timestamp" = timestamp()
    }
  }

  spec {
    backoff_limit              = 3
    ttl_seconds_after_finished = 300
    completions                = 1
    parallelism                = 1

    template {
      metadata {
        labels = local.supabase_labels
        annotations = {
          "sidecar.istio.io/inject" = "false"
        }
      }

      spec {
        restart_policy       = "Never"
        service_account_name = var.service_account_name

        # Init container: Wait for PostgreSQL readiness
        init_container {
          name  = "wait-for-postgres"
          image = var.postgres_wait_image

          command = [
            "sh",
            "-c",
            "echo '[INFO] Waiting for Supabase PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT...' && until pg_isready -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t 5; do echo '[INFO] PostgreSQL is unavailable - retrying in 2s...' && sleep 2; done && echo '[OK] Supabase PostgreSQL is ready'"
          ]

          env {
            name = "POSTGRES_HOST"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "supabase_db_host"
              }
            }
          }

          env {
            name = "POSTGRES_PORT"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "supabase_db_port"
              }
            }
          }

          env {
            name = "POSTGRES_DB"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "supabase_db_name"
              }
            }
          }

          env {
            name = "POSTGRES_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.migration_db_credentials.metadata[0].name
                key  = "supabase_db_user"
              }
            }
          }

          env {
            name = "PGPASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.migration_db_credentials.metadata[0].name
                key  = "supabase_db_password"
              }
            }
          }

          resources {
            requests = {
              cpu    = "50m"
              memory = "64Mi"
            }
            limits = {
              cpu    = "100m"
              memory = "128Mi"
            }
          }
        }

        # Main container: Run SQL migrations
        container {
          name  = "run-migrations"
          image = var.supabase_migration_image

          command = [
            "sh",
            "-c",
            "echo '[INFO] Starting Supabase migrations...' && echo '[INFO] Database: $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB' && for migration in /migrations/*.sql; do if [ -f \"$migration\" ]; then echo '[INFO] Applying migration: '$(basename $migration) && psql -h \"$POSTGRES_HOST\" -p \"$POSTGRES_PORT\" -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -f \"$migration\" || { echo '[ERROR] Migration failed: '$(basename $migration); exit 1; }; fi; done && echo '[OK] Supabase migrations completed successfully'"
          ]

          env {
            name = "POSTGRES_HOST"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "supabase_db_host"
              }
            }
          }

          env {
            name = "POSTGRES_PORT"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "supabase_db_port"
              }
            }
          }

          env {
            name = "POSTGRES_DB"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "supabase_db_name"
              }
            }
          }

          env {
            name = "POSTGRES_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.migration_db_credentials.metadata[0].name
                key  = "supabase_db_user"
              }
            }
          }

          env {
            name = "PGPASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.migration_db_credentials.metadata[0].name
                key  = "supabase_db_password"
              }
            }
          }

          resources {
            requests = {
              cpu    = var.migration_resources.requests.cpu
              memory = var.migration_resources.requests.memory
            }
            limits = {
              cpu    = var.migration_resources.limits.cpu
              memory = var.migration_resources.limits.memory
            }
          }

          security_context {
            run_as_non_root = true
            run_as_user     = 999
            capabilities {
              drop = ["ALL"]
            }
            read_only_root_filesystem = false
          }
        }
      }
    }
  }

  wait_for_completion = var.wait_for_completion

  timeouts {
    create = var.migration_timeout
    update = var.migration_timeout
  }
}

# Job: Components-V2 Migrations
resource "kubernetes_job" "components_v2_migrations" {
  count = var.run_components_v2_migrations ? 1 : 0

  metadata {
    name      = "components-v2-migrations-${random_id.components_v2_job_suffix[0].hex}"
    namespace = var.namespace
    labels    = local.components_v2_labels
    annotations = {
      "migration.ananta.io/database"  = "components-v2"
      "migration.ananta.io/timestamp" = timestamp()
    }
  }

  spec {
    backoff_limit              = 3
    ttl_seconds_after_finished = 300
    completions                = 1
    parallelism                = 1

    template {
      metadata {
        labels = local.components_v2_labels
        annotations = {
          "sidecar.istio.io/inject" = "false"
        }
      }

      spec {
        restart_policy       = "Never"
        service_account_name = var.service_account_name

        # Init container: Wait for PostgreSQL readiness
        init_container {
          name  = "wait-for-postgres"
          image = var.postgres_wait_image

          command = [
            "sh",
            "-c",
            "echo '[INFO] Waiting for Components-V2 PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT...' && until pg_isready -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t 5; do echo '[INFO] PostgreSQL is unavailable - retrying in 2s...' && sleep 2; done && echo '[OK] Components-V2 PostgreSQL is ready'"
          ]

          env {
            name = "POSTGRES_HOST"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "components_v2_db_host"
              }
            }
          }

          env {
            name = "POSTGRES_PORT"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "components_v2_db_port"
              }
            }
          }

          env {
            name = "POSTGRES_DB"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "components_v2_db_name"
              }
            }
          }

          env {
            name = "POSTGRES_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.migration_db_credentials.metadata[0].name
                key  = "components_v2_db_user"
              }
            }
          }

          env {
            name = "PGPASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.migration_db_credentials.metadata[0].name
                key  = "components_v2_db_password"
              }
            }
          }

          resources {
            requests = {
              cpu    = "50m"
              memory = "64Mi"
            }
            limits = {
              cpu    = "100m"
              memory = "128Mi"
            }
          }
        }

        # Main container: Run SQL migrations
        container {
          name  = "run-migrations"
          image = var.components_v2_migration_image

          command = [
            "sh",
            "-c",
            "echo '[INFO] Starting Components-V2 migrations...' && echo '[INFO] Database: $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB' && for migration in /migrations/*.sql; do if [ -f \"$migration\" ]; then echo '[INFO] Applying migration: '$(basename $migration) && psql -h \"$POSTGRES_HOST\" -p \"$POSTGRES_PORT\" -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -f \"$migration\" || { echo '[ERROR] Migration failed: '$(basename $migration); exit 1; }; fi; done && echo '[OK] Components-V2 migrations completed successfully'"
          ]

          env {
            name = "POSTGRES_HOST"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "components_v2_db_host"
              }
            }
          }

          env {
            name = "POSTGRES_PORT"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "components_v2_db_port"
              }
            }
          }

          env {
            name = "POSTGRES_DB"
            value_from {
              config_map_key_ref {
                name = kubernetes_config_map.migration_config.metadata[0].name
                key  = "components_v2_db_name"
              }
            }
          }

          env {
            name = "POSTGRES_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.migration_db_credentials.metadata[0].name
                key  = "components_v2_db_user"
              }
            }
          }

          env {
            name = "PGPASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.migration_db_credentials.metadata[0].name
                key  = "components_v2_db_password"
              }
            }
          }

          resources {
            requests = {
              cpu    = var.migration_resources.requests.cpu
              memory = var.migration_resources.requests.memory
            }
            limits = {
              cpu    = var.migration_resources.limits.cpu
              memory = var.migration_resources.limits.memory
            }
          }

          security_context {
            run_as_non_root = true
            run_as_user     = 999
            capabilities {
              drop = ["ALL"]
            }
            read_only_root_filesystem = false
          }
        }
      }
    }
  }

  wait_for_completion = var.wait_for_completion

  timeouts {
    create = var.migration_timeout
    update = var.migration_timeout
  }
}
