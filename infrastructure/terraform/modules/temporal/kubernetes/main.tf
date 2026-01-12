# =============================================================================
# Temporal Kubernetes Module - Workflow Engine
# =============================================================================
# Deploys Temporal workflow engine on Kubernetes with:
# - Auto-setup container for database schema creation
# - PostgreSQL backend
# - Temporal UI for workflow management
# - Namespace creation for arc-saas workflows
# - Optional Vault integration for secrets
# =============================================================================

terraform {
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
  app_name    = "temporal"
  ui_app_name = "temporal-ui"

  common_labels = merge(var.labels, {
    "app.kubernetes.io/name"       = local.app_name
    "app.kubernetes.io/instance"   = "${var.name_prefix}-${local.app_name}"
    "app.kubernetes.io/component"  = "workflow"
    "app.kubernetes.io/managed-by" = "terraform"
    "environment"                  = var.environment
  })

  ui_labels = merge(var.labels, {
    "app.kubernetes.io/name"       = local.ui_app_name
    "app.kubernetes.io/instance"   = "${var.name_prefix}-${local.ui_app_name}"
    "app.kubernetes.io/component"  = "workflow-ui"
    "app.kubernetes.io/managed-by" = "terraform"
    "environment"                  = var.environment
  })

  # Resource sizing
  server_resources = {
    local = {
      requests = { cpu = "250m", memory = "512Mi" }
      limits   = { cpu = "1000m", memory = "1Gi" }
    }
    dev = {
      requests = { cpu = "500m", memory = "512Mi" }
      limits   = { cpu = "1000m", memory = "1Gi" }
    }
    staging = {
      requests = { cpu = "1000m", memory = "1Gi" }
      limits   = { cpu = "2000m", memory = "2Gi" }
    }
    prod = {
      requests = { cpu = "2000m", memory = "2Gi" }
      limits   = { cpu = "4000m", memory = "4Gi" }
    }
  }

  ui_resources = {
    local = {
      requests = { cpu = "50m", memory = "128Mi" }
      limits   = { cpu = "200m", memory = "256Mi" }
    }
    dev = {
      requests = { cpu = "100m", memory = "128Mi" }
      limits   = { cpu = "200m", memory = "256Mi" }
    }
    staging = {
      requests = { cpu = "200m", memory = "256Mi" }
      limits   = { cpu = "500m", memory = "512Mi" }
    }
    prod = {
      requests = { cpu = "500m", memory = "512Mi" }
      limits   = { cpu = "1000m", memory = "1Gi" }
    }
  }

  server_res = lookup(local.server_resources, var.environment, local.server_resources["dev"])
  ui_res     = lookup(local.ui_resources, var.environment, local.ui_resources["dev"])
}

# -----------------------------------------------------------------------------
# Random Password Generation
# -----------------------------------------------------------------------------

locals {
  # Use provided password or simple default for local dev
  effective_db_password = coalesce(var.db_password, "temporal123")
}

# -----------------------------------------------------------------------------
# Secret
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "temporal" {
  metadata {
    name      = "${var.name_prefix}-${local.app_name}-secrets"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = var.use_vault_secrets ? {} : {
    POSTGRES_PWD = local.effective_db_password
  }

  type = "Opaque"
}

# -----------------------------------------------------------------------------
# ConfigMap
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "temporal" {
  metadata {
    name      = "${var.name_prefix}-${local.app_name}-config"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    DB             = "postgres12"
    DB_PORT        = tostring(var.db_port)
    POSTGRES_SEEDS = var.db_host
    POSTGRES_USER  = var.db_username
    LOG_LEVEL      = var.log_level
  }
}

# -----------------------------------------------------------------------------
# Temporal Server Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "temporal" {
  metadata {
    name      = local.app_name
    namespace = var.namespace
    labels    = local.common_labels
  }

  spec {
    replicas = var.server_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name"     = local.app_name
        "app.kubernetes.io/instance" = "${var.name_prefix}-${local.app_name}"
      }
    }

    template {
      metadata {
        labels = local.common_labels
        annotations = var.use_vault_secrets ? {
          "vault.hashicorp.com/agent-inject"                              = "true"
          "vault.hashicorp.com/role"                                      = "temporal"
          "vault.hashicorp.com/agent-inject-secret-temporal"              = var.vault_secrets_path
          "vault.hashicorp.com/agent-inject-template-temporal"            = <<-EOT
            {{- with secret "${var.vault_secrets_path}" -}}
            export POSTGRES_PWD="{{ .Data.data.db_password }}"
            {{- end }}
          EOT
        } : {}
      }

      spec {
        service_account_name = var.use_vault_secrets ? kubernetes_service_account.temporal[0].metadata[0].name : null

        container {
          name  = local.app_name
          image = "temporalio/auto-setup:${var.temporal_version}"

          port {
            container_port = 7233
            name           = "grpc"
            protocol       = "TCP"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.temporal.metadata[0].name
            }
          }

          dynamic "env_from" {
            for_each = var.use_vault_secrets ? [] : [1]
            content {
              secret_ref {
                name = kubernetes_secret.temporal.metadata[0].name
              }
            }
          }

          resources {
            requests = local.server_res.requests
            limits   = local.server_res.limits
          }

          # Temporal auto-setup takes time to initialize
          startup_probe {
            tcp_socket {
              port = 7233
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            failure_threshold     = 30  # Allow 5 minutes for startup
          }

          readiness_probe {
            tcp_socket {
              port = 7233
            }
            initial_delay_seconds = 10
            period_seconds        = 10
            failure_threshold     = 3
          }

          liveness_probe {
            tcp_socket {
              port = 7233
            }
            initial_delay_seconds = 60
            period_seconds        = 30
            failure_threshold     = 3
          }
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Service Account (for Vault integration)
# -----------------------------------------------------------------------------

resource "kubernetes_service_account" "temporal" {
  count = var.use_vault_secrets ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-${local.app_name}"
    namespace = var.namespace
    labels    = local.common_labels
  }
}

# -----------------------------------------------------------------------------
# Temporal Service
# -----------------------------------------------------------------------------

resource "kubernetes_service" "temporal" {
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
      name        = "grpc"
      port        = 7233
      target_port = 7233
      protocol    = "TCP"
    }

    type = var.service_type
  }
}

# -----------------------------------------------------------------------------
# Temporal UI Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "temporal_ui" {
  count = var.enable_ui ? 1 : 0

  metadata {
    name      = local.ui_app_name
    namespace = var.namespace
    labels    = local.ui_labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name"     = local.ui_app_name
        "app.kubernetes.io/instance" = "${var.name_prefix}-${local.ui_app_name}"
      }
    }

    template {
      metadata {
        labels = local.ui_labels
      }

      spec {
        container {
          name  = local.ui_app_name
          image = "temporalio/ui:${var.ui_version}"

          port {
            container_port = var.ui_port
            name           = "http"
            protocol       = "TCP"
          }

          env {
            name  = "TEMPORAL_ADDRESS"
            value = "${kubernetes_service.temporal.metadata[0].name}.${var.namespace}.svc.cluster.local:7233"
          }

          env {
            name  = "TEMPORAL_UI_PORT"
            value = tostring(var.ui_port)
          }

          env {
            name  = "TEMPORAL_CORS_ORIGINS"
            value = var.cors_origins
          }

          resources {
            requests = local.ui_res.requests
            limits   = local.ui_res.limits
          }

          readiness_probe {
            http_get {
              path = "/"
              port = var.ui_port
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }

          liveness_probe {
            http_get {
              path = "/"
              port = var.ui_port
            }
            initial_delay_seconds = 30
            period_seconds        = 30
          }
        }
      }
    }
  }

  depends_on = [kubernetes_deployment.temporal]
}

# -----------------------------------------------------------------------------
# Temporal UI Service
# -----------------------------------------------------------------------------

resource "kubernetes_service" "temporal_ui" {
  count = var.enable_ui ? 1 : 0

  metadata {
    name      = local.ui_app_name
    namespace = var.namespace
    labels    = local.ui_labels
  }

  spec {
    selector = {
      "app.kubernetes.io/name"     = local.ui_app_name
      "app.kubernetes.io/instance" = "${var.name_prefix}-${local.ui_app_name}"
    }

    port {
      name        = "http"
      port        = var.ui_port
      target_port = var.ui_port
      protocol    = "TCP"
    }

    type = var.service_type
  }
}

# -----------------------------------------------------------------------------
# Namespace Creation Job
# -----------------------------------------------------------------------------

resource "kubernetes_job" "create_namespaces" {
  count = length(var.create_namespaces) > 0 ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-temporal-ns-init"
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

        # Use the same image as the main deployment to avoid image pull issues
        container {
          name  = "namespace-init"
          image = "temporalio/auto-setup:${var.temporal_version}"

          command = ["/bin/sh", "-c"]
          args = [<<-EOT
            echo "Waiting for Temporal to be ready..."
            # Use tctl cluster health to check readiness
            MAX_RETRIES=60
            RETRY_COUNT=0
            until tctl --address ${local.app_name}:7233 cluster health 2>/dev/null | grep -q "SERVING"; do
              RETRY_COUNT=$((RETRY_COUNT + 1))
              if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
                echo "Timeout waiting for Temporal after $MAX_RETRIES attempts"
                exit 1
              fi
              echo "Attempt $RETRY_COUNT/$MAX_RETRIES: Temporal not ready, waiting 10s..."
              sleep 10
            done
            echo "Temporal is ready, creating namespaces..."

            %{for ns in var.create_namespaces~}
            echo "Creating namespace: ${ns}"
            tctl --address ${local.app_name}:7233 --namespace ${ns} namespace register \
              --retention 3 \
              --description "Namespace for ${ns} workflows" 2>&1 || \
              echo "Namespace ${ns} may already exist (this is OK)"
            %{endfor~}

            echo "All namespaces created successfully"
            # List namespaces to verify
            echo "Verifying namespaces:"
            tctl --address ${local.app_name}:7233 namespace list 2>&1 || true
          EOT
          ]
        }
      }
    }
  }

  depends_on = [kubernetes_deployment.temporal]
}
