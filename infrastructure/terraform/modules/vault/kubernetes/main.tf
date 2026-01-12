# =============================================================================
# Vault Kubernetes Module
# =============================================================================
# Deploys HashiCorp Vault on Kubernetes using the official Helm chart.
# Configures Kubernetes auth method for secret injection.
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
  vault_name = "${var.name_prefix}-vault"

  common_labels = merge(var.labels, {
    "app.kubernetes.io/name"      = "vault"
    "app.kubernetes.io/instance"  = local.vault_name
    "app.kubernetes.io/component" = "secrets"
  })
}

# -----------------------------------------------------------------------------
# Vault Helm Release
# -----------------------------------------------------------------------------

resource "helm_release" "vault" {
  name             = local.vault_name
  repository       = "https://helm.releases.hashicorp.com"
  chart            = "vault"
  version          = var.helm_chart_version
  namespace        = var.namespace
  create_namespace = false

  values = [
    yamlencode({
      global = {
        enabled = true
      }

      server = {
        # Dev mode for local development (auto-unsealed, in-memory)
        dev = {
          enabled  = var.dev_mode
          devRootToken = var.dev_mode ? "root" : null
        }

        # Production mode settings
        standalone = {
          enabled = !var.dev_mode
          config = var.dev_mode ? null : <<-EOT
            ui = true

            listener "tcp" {
              tls_disable = 1
              address = "[::]:8200"
              cluster_address = "[::]:8201"
            }

            storage "file" {
              path = "/vault/data"
            }
          EOT
        }

        # Resources
        resources = {
          requests = {
            memory = var.memory_request
            cpu    = var.cpu_request
          }
          limits = {
            memory = var.memory_limit
            cpu    = var.cpu_limit
          }
        }

        # Data volume for production mode
        dataStorage = var.dev_mode ? null : {
          enabled      = true
          size         = var.storage_size
          storageClass = var.storage_class
        }

        # Service configuration
        service = {
          enabled = true
          type    = var.service_type
          port    = 8200
        }

        # Readiness/Liveness probes
        readinessProbe = {
          enabled = true
          path    = "/v1/sys/health?standbyok=true"
        }
        livenessProbe = {
          enabled     = true
          path        = "/v1/sys/health?standbyok=true"
          initialDelaySeconds = 60
        }
      }

      # Vault UI
      ui = {
        enabled = true
        serviceType = var.service_type
      }

      # Injector for sidecar injection
      injector = {
        enabled = var.enable_injector
        resources = {
          requests = {
            memory = "64Mi"
            cpu    = "50m"
          }
          limits = {
            memory = "128Mi"
            cpu    = "100m"
          }
        }
      }

      # CSI provider for secret store CSI driver
      csi = {
        enabled = var.enable_csi
      }
    })
  ]

  # Wait for Vault to be ready
  wait = true
  timeout = 300
}

# -----------------------------------------------------------------------------
# Vault Initialization Job (for production mode)
# -----------------------------------------------------------------------------

resource "kubernetes_job" "vault_init" {
  count = var.dev_mode ? 0 : 1

  metadata {
    name      = "${local.vault_name}-init"
    namespace = var.namespace
    labels    = local.common_labels
  }

  spec {
    ttl_seconds_after_finished = 600
    backoff_limit = 5

    template {
      metadata {
        labels = local.common_labels
      }

      spec {
        restart_policy = "OnFailure"
        service_account_name = "${local.vault_name}-vault"

        container {
          name  = "vault-init"
          image = "hashicorp/vault:${var.vault_version}"

          command = ["/bin/sh", "-c"]
          args = [<<-EOT
            set -e

            VAULT_ADDR="http://${local.vault_name}:8200"
            export VAULT_ADDR

            # Wait for Vault to be ready
            until vault status 2>&1 | grep -q "Initialized"; do
              echo "Waiting for Vault to start..."
              sleep 5
            done

            # Check if already initialized
            if vault status | grep -q "Initialized.*true"; then
              echo "Vault already initialized"
              exit 0
            fi

            # Initialize Vault
            echo "Initializing Vault..."
            vault operator init -key-shares=1 -key-threshold=1 \
              -format=json > /vault-init/init-keys.json

            # Extract unseal key and root token
            UNSEAL_KEY=$(cat /vault-init/init-keys.json | grep -o '"unseal_keys_b64":\[\"[^"]*' | cut -d'"' -f4)
            ROOT_TOKEN=$(cat /vault-init/init-keys.json | grep -o '"root_token":"[^"]*' | cut -d'"' -f4)

            # Unseal Vault
            echo "Unsealing Vault..."
            vault operator unseal $UNSEAL_KEY

            # Store keys in Kubernetes secret
            kubectl create secret generic ${local.vault_name}-keys \
              --namespace=${var.namespace} \
              --from-literal=unseal-key=$UNSEAL_KEY \
              --from-literal=root-token=$ROOT_TOKEN \
              --dry-run=client -o yaml | kubectl apply -f -

            echo "Vault initialized and unsealed successfully!"
          EOT
          ]

          env {
            name  = "VAULT_ADDR"
            value = "http://${local.vault_name}:8200"
          }

          volume_mount {
            name       = "vault-init"
            mount_path = "/vault-init"
          }
        }

        volume {
          name = "vault-init"
          empty_dir {}
        }
      }
    }
  }

  depends_on = [helm_release.vault]
}

# -----------------------------------------------------------------------------
# Vault Secret Seeding (Initial secrets for platform)
# -----------------------------------------------------------------------------

resource "kubernetes_job" "vault_seed" {
  count = var.init_secrets ? 1 : 0

  metadata {
    name      = "${local.vault_name}-seed"
    namespace = var.namespace
    labels    = local.common_labels
  }

  spec {
    ttl_seconds_after_finished = 600
    backoff_limit = 5

    template {
      metadata {
        labels = local.common_labels
      }

      spec {
        restart_policy = "OnFailure"

        container {
          name  = "vault-seed"
          image = "hashicorp/vault:${var.vault_version}"

          command = ["/bin/sh", "-c"]
          args = [<<-EOT
            set -e

            VAULT_ADDR="http://${local.vault_name}:8200"
            export VAULT_ADDR

            # Get root token
            if [ "${var.dev_mode}" = "true" ]; then
              VAULT_TOKEN="root"
            else
              # Wait for init job to complete
              sleep 30
              VAULT_TOKEN=$(kubectl get secret ${local.vault_name}-keys -n ${var.namespace} -o jsonpath='{.data.root-token}' | base64 -d)
            fi
            export VAULT_TOKEN

            # Enable KV secrets engine
            vault secrets enable -path=secret -version=2 kv 2>/dev/null || true

            # Enable Kubernetes auth
            vault auth enable kubernetes 2>/dev/null || true

            # Configure Kubernetes auth
            vault write auth/kubernetes/config \
              kubernetes_host="https://kubernetes.default.svc" \
              kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
              token_reviewer_jwt=@/var/run/secrets/kubernetes.io/serviceaccount/token

            # Generate and store database passwords
            DB_POSTGRES_PASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
            DB_KEYCLOAK_PASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
            DB_TEMPORAL_PASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
            DB_ANANTA_PASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)

            vault kv put secret/database/postgres \
              username=postgres \
              password=$DB_POSTGRES_PASS

            vault kv put secret/database/keycloak \
              username=keycloak \
              password=$DB_KEYCLOAK_PASS

            vault kv put secret/database/temporal \
              username=temporal \
              password=$DB_TEMPORAL_PASS

            vault kv put secret/database/ananta \
              username=ananta_app \
              password=$DB_ANANTA_PASS

            # Redis password
            REDIS_PASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
            vault kv put secret/cache/redis \
              password=$REDIS_PASS

            # Keycloak admin credentials
            KC_ADMIN_PASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
            vault kv put secret/auth/keycloak \
              admin_username=admin \
              admin_password=$KC_ADMIN_PASS \
              db_password=$DB_KEYCLOAK_PASS

            # Control plane secrets
            JWT_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
            vault kv put secret/control-plane/jwt \
              secret=$JWT_SECRET

            vault kv put secret/control-plane/database \
              host=postgresql.database-system.svc.cluster.local \
              port=5432 \
              database=ananta \
              username=ananta_app \
              password=$DB_ANANTA_PASS

            # Create policies for each service
            vault policy write database-read - <<EOF
            path "secret/data/database/*" {
              capabilities = ["read"]
            }
            EOF

            vault policy write control-plane - <<EOF
            path "secret/data/control-plane/*" {
              capabilities = ["read"]
            }
            path "secret/data/database/ananta" {
              capabilities = ["read"]
            }
            path "secret/data/cache/redis" {
              capabilities = ["read"]
            }
            path "secret/data/auth/keycloak" {
              capabilities = ["read"]
            }
            EOF

            vault policy write keycloak - <<EOF
            path "secret/data/auth/keycloak" {
              capabilities = ["read"]
            }
            path "secret/data/database/keycloak" {
              capabilities = ["read"]
            }
            EOF

            vault policy write temporal - <<EOF
            path "secret/data/temporal/*" {
              capabilities = ["read"]
            }
            path "secret/data/database/temporal" {
              capabilities = ["read"]
            }
            EOF

            # Create Kubernetes auth roles
            vault write auth/kubernetes/role/control-plane \
              bound_service_account_names=* \
              bound_service_account_namespaces=control-plane \
              policies=control-plane \
              ttl=1h

            vault write auth/kubernetes/role/keycloak \
              bound_service_account_names=* \
              bound_service_account_namespaces=auth-system \
              policies=keycloak \
              ttl=1h

            vault write auth/kubernetes/role/temporal \
              bound_service_account_names=* \
              bound_service_account_namespaces=temporal-system \
              policies=temporal \
              ttl=1h

            vault write auth/kubernetes/role/database \
              bound_service_account_names=* \
              bound_service_account_namespaces=database-system \
              policies=database-read \
              ttl=1h

            echo "Vault secrets seeded successfully!"
          EOT
          ]

          env {
            name  = "VAULT_ADDR"
            value = "http://${local.vault_name}:8200"
          }
        }
      }
    }
  }

  depends_on = [
    helm_release.vault,
    kubernetes_job.vault_init
  ]
}

# -----------------------------------------------------------------------------
# Vault Agent Injector ConfigMap (for sidecar injection templates)
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "vault_agent_config" {
  count = var.enable_injector ? 1 : 0

  metadata {
    name      = "${local.vault_name}-agent-config"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    "database.ctmpl" = <<-EOT
      {{- with secret "secret/data/database/ananta" -}}
      DATABASE_HOST={{ .Data.data.host }}
      DATABASE_PORT={{ .Data.data.port }}
      DATABASE_NAME={{ .Data.data.database }}
      DATABASE_USERNAME={{ .Data.data.username }}
      DATABASE_PASSWORD={{ .Data.data.password }}
      {{- end -}}
    EOT

    "redis.ctmpl" = <<-EOT
      {{- with secret "secret/data/cache/redis" -}}
      REDIS_PASSWORD={{ .Data.data.password }}
      {{- end -}}
    EOT

    "keycloak.ctmpl" = <<-EOT
      {{- with secret "secret/data/auth/keycloak" -}}
      KEYCLOAK_ADMIN={{ .Data.data.admin_username }}
      KEYCLOAK_ADMIN_PASSWORD={{ .Data.data.admin_password }}
      KC_DB_PASSWORD={{ .Data.data.db_password }}
      {{- end -}}
    EOT
  }
}
