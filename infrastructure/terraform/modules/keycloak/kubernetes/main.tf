# =============================================================================
# Keycloak Kubernetes Module - Identity Provider
# =============================================================================
# Deploys Keycloak as a Kubernetes Deployment with:
# - Configurable database backend (PostgreSQL)
# - Realm import job for initial setup
# - Optional Vault integration for secrets
# - Health checks and resource management
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
  app_name = "keycloak"

  common_labels = merge(var.labels, {
    "app.kubernetes.io/name"       = local.app_name
    "app.kubernetes.io/instance"   = "${var.name_prefix}-${local.app_name}"
    "app.kubernetes.io/component"  = "auth"
    "app.kubernetes.io/managed-by" = "terraform"
    "environment"                  = var.environment
  })

  # Resource sizing based on environment
  resource_defaults = {
    local = {
      requests = { cpu = "500m", memory = "512Mi" }
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

  resources = lookup(local.resource_defaults, var.environment, local.resource_defaults["dev"])
}

# -----------------------------------------------------------------------------
# Password Defaults (Simple defaults for local development)
# -----------------------------------------------------------------------------

locals {
  # Use provided password or simple default for local dev
  effective_db_password    = coalesce(var.db_password, "keycloak123")
  effective_admin_password = coalesce(var.admin_password, "admin123")
}

# -----------------------------------------------------------------------------
# Secrets
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "keycloak" {
  metadata {
    name      = "${var.name_prefix}-${local.app_name}-secrets"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = var.use_vault_secrets ? {} : {
    KEYCLOAK_ADMIN_PASSWORD = local.effective_admin_password
    KC_DB_PASSWORD          = local.effective_db_password
  }

  type = "Opaque"
}

# -----------------------------------------------------------------------------
# ConfigMap
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "keycloak" {
  metadata {
    name      = "${var.name_prefix}-${local.app_name}-config"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    KC_DB                = "postgres"
    KC_DB_URL            = "jdbc:postgresql://${var.db_host}:${var.db_port}/${var.db_name}"
    KC_DB_USERNAME       = var.db_username
    KC_PROXY             = "edge"
    KC_HEALTH_ENABLED    = "true"
    KC_METRICS_ENABLED   = "true"
    KC_HTTP_ENABLED      = "true"
    KC_HOSTNAME_STRICT   = "false"
    KEYCLOAK_ADMIN       = var.admin_username
  }
}

# -----------------------------------------------------------------------------
# Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "keycloak" {
  metadata {
    name      = local.app_name
    namespace = var.namespace
    labels    = local.common_labels
  }

  spec {
    replicas = var.replicas

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
          "vault.hashicorp.com/agent-inject"                                = "true"
          "vault.hashicorp.com/role"                                        = "keycloak"
          "vault.hashicorp.com/agent-inject-secret-keycloak"                = var.vault_secrets_path
          "vault.hashicorp.com/agent-inject-template-keycloak"              = <<-EOT
            {{- with secret "${var.vault_secrets_path}" -}}
            export KEYCLOAK_ADMIN_PASSWORD="{{ .Data.data.admin_password }}"
            export KC_DB_PASSWORD="{{ .Data.data.db_password }}"
            {{- end }}
          EOT
        } : {}
      }

      spec {
        service_account_name = var.use_vault_secrets ? kubernetes_service_account.keycloak[0].metadata[0].name : null

        container {
          name  = local.app_name
          image = var.keycloak_image

          args = var.dev_mode ? ["start-dev"] : ["start", "--optimized"]

          port {
            container_port = 8080
            name           = "http"
            protocol       = "TCP"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.keycloak.metadata[0].name
            }
          }

          dynamic "env_from" {
            for_each = var.use_vault_secrets ? [] : [1]
            content {
              secret_ref {
                name = kubernetes_secret.keycloak.metadata[0].name
              }
            }
          }

          # For Vault injection, source the secrets file
          dynamic "env" {
            for_each = var.use_vault_secrets ? [1] : []
            content {
              name  = "VAULT_SECRETS_PATH"
              value = "/vault/secrets/keycloak"
            }
          }

          resources {
            requests = merge(
              local.resources.requests,
              var.resources != null ? var.resources.requests : {}
            )
            limits = merge(
              local.resources.limits,
              var.resources != null ? var.resources.limits : {}
            )
          }

          readiness_probe {
            http_get {
              path = "/health/ready"
              port = 8080
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          liveness_probe {
            http_get {
              path = "/health/live"
              port = 8080
            }
            initial_delay_seconds = 60
            period_seconds        = 30
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          dynamic "volume_mount" {
            for_each = var.import_realm ? [1] : []
            content {
              name       = "realm-config"
              mount_path = "/opt/keycloak/data/import"
              read_only  = true
            }
          }
        }

        dynamic "volume" {
          for_each = var.import_realm ? [1] : []
          content {
            name = "realm-config"
            config_map {
              name = var.realm_config_map
            }
          }
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Service Account (for Vault integration)
# -----------------------------------------------------------------------------

resource "kubernetes_service_account" "keycloak" {
  count = var.use_vault_secrets ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-${local.app_name}"
    namespace = var.namespace
    labels    = local.common_labels
  }
}

# -----------------------------------------------------------------------------
# Service
# -----------------------------------------------------------------------------

resource "kubernetes_service" "keycloak" {
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
      name        = "http"
      port        = 8080
      target_port = 8080
      protocol    = "TCP"
    }

    type = var.service_type
  }
}

# -----------------------------------------------------------------------------
# Realm Import Job
# -----------------------------------------------------------------------------

resource "kubernetes_job" "realm_import" {
  count = var.import_realm ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-keycloak-realm-import"
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
          name  = "realm-import"
          image = "curlimages/curl:8.5.0"

          command = ["/bin/sh", "-c"]
          args = [<<-EOT
            echo "Waiting for Keycloak to be ready..."
            until curl -sf http://${local.app_name}:8080/health/ready; do
              echo "Keycloak not ready, waiting..."
              sleep 5
            done
            echo "Keycloak is ready, importing realm..."

            # Get admin token
            echo "Getting admin token..."
            TOKEN=$(curl -s -X POST "http://${local.app_name}:8080/realms/master/protocol/openid-connect/token" \
              -H "Content-Type: application/x-www-form-urlencoded" \
              -d "username=${var.admin_username}" \
              -d "password=${var.use_vault_secrets ? "$KEYCLOAK_ADMIN_PASSWORD" : local.effective_admin_password}" \
              -d "grant_type=password" \
              -d "client_id=admin-cli" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')

            if [ -z "$TOKEN" ]; then
              echo "Failed to get admin token"
              exit 1
            fi
            echo "Got admin token"

            # Check if realm exists
            echo "Checking if realm exists..."
            REALM_EXISTS=$(curl -s -o /dev/null -w "%%{http_code}" \
              "http://${local.app_name}:8080/admin/realms/arc-saas" \
              -H "Authorization: Bearer $TOKEN")

            if [ "$REALM_EXISTS" = "200" ]; then
              echo "Realm arc-saas already exists, skipping import"
              exit 0
            fi

            # Import realm
            echo "Creating arc-saas realm..."
            RESULT=$(curl -s -w "\n%%{http_code}" -X POST "http://${local.app_name}:8080/admin/realms" \
              -H "Authorization: Bearer $TOKEN" \
              -H "Content-Type: application/json" \
              -d @/realm-config/arc-saas-realm.json)

            HTTP_CODE=$(echo "$RESULT" | tail -1)
            BODY=$(echo "$RESULT" | head -n -1)

            if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
              echo "Realm import successful!"
            else
              echo "Realm import failed with status $HTTP_CODE: $BODY"
              exit 1
            fi
          EOT
          ]

          dynamic "env" {
            for_each = var.use_vault_secrets ? [1] : []
            content {
              name = "KEYCLOAK_ADMIN_PASSWORD"
              value_from {
                secret_key_ref {
                  name = kubernetes_secret.keycloak.metadata[0].name
                  key  = "KEYCLOAK_ADMIN_PASSWORD"
                }
              }
            }
          }

          volume_mount {
            name       = "realm-config"
            mount_path = "/realm-config"
          }
        }

        volume {
          name = "realm-config"
          config_map {
            name = var.realm_config_map
          }
        }
      }
    }
  }

  depends_on = [kubernetes_deployment.keycloak]
}
