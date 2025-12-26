# =============================================================================
# Kubernetes Secrets Module - Native Secrets & External Secrets Operator
# =============================================================================
# Kubernetes-native secrets management. Supports both native Kubernetes
# secrets and External Secrets Operator for integration with external vaults.
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  secret_name_prefix = var.name_prefix

  common_labels = merge(var.labels, {
    "app.kubernetes.io/managed-by" = "terraform"
    "environment"                  = var.environment
  })

  common_annotations = merge(var.annotations, {
    "terraform.io/managed" = "true"
  })
}

# -----------------------------------------------------------------------------
# Namespace (optional)
# -----------------------------------------------------------------------------

resource "kubernetes_namespace" "secrets" {
  count = var.create_namespace ? 1 : 0

  metadata {
    name   = var.namespace
    labels = local.common_labels
  }
}

# -----------------------------------------------------------------------------
# Generic Secrets
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "secrets" {
  for_each = var.secrets

  metadata {
    name        = "${local.secret_name_prefix}-${each.key}"
    namespace   = var.create_namespace ? kubernetes_namespace.secrets[0].metadata[0].name : var.namespace
    labels      = merge(local.common_labels, { type = "generic" })
    annotations = merge(local.common_annotations, { description = each.value.description })
  }

  data = { for k, v in each.value.value : k => v }
  type = each.value.type
}

# -----------------------------------------------------------------------------
# Database Secrets
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "database" {
  for_each = var.database_secrets

  metadata {
    name        = "${local.secret_name_prefix}-db-${each.key}"
    namespace   = var.create_namespace ? kubernetes_namespace.secrets[0].metadata[0].name : var.namespace
    labels      = merge(local.common_labels, { type = "database" })
    annotations = merge(local.common_annotations, { description = "Database credentials for ${each.key}" })
  }

  data = {
    host              = each.value.host
    port              = tostring(each.value.port)
    database          = each.value.database
    username          = each.value.username
    password          = each.value.password
    engine            = each.value.engine
    connection_string = "${each.value.engine}://${each.value.username}:${each.value.password}@${each.value.host}:${each.value.port}/${each.value.database}"
  }

  type = "Opaque"
}

# -----------------------------------------------------------------------------
# Auto-Generated Secrets
# -----------------------------------------------------------------------------

resource "random_password" "generated" {
  for_each = var.generated_secrets

  length           = each.value.length
  special          = each.value.special
  override_special = each.value.override_special
  upper            = each.value.upper
  lower            = each.value.lower
  numeric          = each.value.numeric
}

resource "kubernetes_secret" "generated" {
  for_each = var.generated_secrets

  metadata {
    name        = "${local.secret_name_prefix}-${each.key}"
    namespace   = var.create_namespace ? kubernetes_namespace.secrets[0].metadata[0].name : var.namespace
    labels      = merge(local.common_labels, { type = "generated", generated = "true" })
    annotations = merge(local.common_annotations, { description = each.value.description })
  }

  data = {
    value = random_password.generated[each.key].result
  }

  type = "Opaque"
}

# -----------------------------------------------------------------------------
# TLS Secrets
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "tls" {
  for_each = var.tls_secrets

  metadata {
    name        = "${local.secret_name_prefix}-tls-${each.key}"
    namespace   = var.create_namespace ? kubernetes_namespace.secrets[0].metadata[0].name : var.namespace
    labels      = merge(local.common_labels, { type = "tls" })
    annotations = merge(local.common_annotations, { description = each.value.description })
  }

  data = {
    "tls.crt" = each.value.certificate
    "tls.key" = each.value.private_key
  }

  type = "kubernetes.io/tls"
}

# -----------------------------------------------------------------------------
# Docker Registry Secrets
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "docker_registry" {
  for_each = var.docker_registry_secrets

  metadata {
    name        = "${local.secret_name_prefix}-registry-${each.key}"
    namespace   = var.create_namespace ? kubernetes_namespace.secrets[0].metadata[0].name : var.namespace
    labels      = merge(local.common_labels, { type = "docker-registry" })
    annotations = merge(local.common_annotations, { description = each.value.description })
  }

  data = {
    ".dockerconfigjson" = jsonencode({
      auths = {
        (each.value.server) = {
          username = each.value.username
          password = each.value.password
          email    = each.value.email
          auth     = base64encode("${each.value.username}:${each.value.password}")
        }
      }
    })
  }

  type = "kubernetes.io/dockerconfigjson"
}

# -----------------------------------------------------------------------------
# External Secrets (for External Secrets Operator)
# -----------------------------------------------------------------------------

resource "kubernetes_manifest" "external_secret" {
  for_each = var.use_external_secrets_operator ? var.external_secrets : {}

  manifest = {
    apiVersion = "external-secrets.io/v1beta1"
    kind       = "ExternalSecret"
    metadata = {
      name      = "${local.secret_name_prefix}-${each.key}"
      namespace = var.create_namespace ? kubernetes_namespace.secrets[0].metadata[0].name : var.namespace
      labels    = merge(local.common_labels, { type = "external" })
    }
    spec = {
      refreshInterval = each.value.refresh_interval
      secretStoreRef = {
        name = each.value.secret_store_name
        kind = each.value.secret_store_kind
      }
      target = {
        name           = "${local.secret_name_prefix}-${each.key}"
        creationPolicy = "Owner"
        template = each.value.template != null ? {
          type = each.value.template.type
          data = each.value.template.data
        } : null
      }
      data = [for d in each.value.data : {
        secretKey = d.secret_key
        remoteRef = {
          key      = d.remote_key
          property = d.remote_property
        }
      }]
    }
  }
}

# -----------------------------------------------------------------------------
# ClusterSecretStore (for External Secrets Operator)
# -----------------------------------------------------------------------------

resource "kubernetes_manifest" "cluster_secret_store" {
  for_each = var.use_external_secrets_operator ? var.secret_stores : {}

  manifest = {
    apiVersion = "external-secrets.io/v1beta1"
    kind       = each.value.cluster_wide ? "ClusterSecretStore" : "SecretStore"
    metadata = {
      name      = each.key
      namespace = each.value.cluster_wide ? null : (var.create_namespace ? kubernetes_namespace.secrets[0].metadata[0].name : var.namespace)
      labels    = local.common_labels
    }
    spec = {
      provider = each.value.provider_config
    }
  }
}

# -----------------------------------------------------------------------------
# Service Account for Secret Access
# -----------------------------------------------------------------------------

resource "kubernetes_service_account" "secrets_accessor" {
  count = var.create_accessor_service_account ? 1 : 0

  metadata {
    name        = "${var.name_prefix}-secrets-accessor"
    namespace   = var.create_namespace ? kubernetes_namespace.secrets[0].metadata[0].name : var.namespace
    labels      = local.common_labels
    annotations = var.service_account_annotations
  }

  automount_service_account_token = true
}

# Role for secret access
resource "kubernetes_role" "secrets_reader" {
  count = var.create_accessor_service_account ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-secrets-reader"
    namespace = var.create_namespace ? kubernetes_namespace.secrets[0].metadata[0].name : var.namespace
    labels    = local.common_labels
  }

  rule {
    api_groups = [""]
    resources  = ["secrets"]
    verbs      = ["get", "list", "watch"]
    resource_names = concat(
      [for k, v in kubernetes_secret.secrets : v.metadata[0].name],
      [for k, v in kubernetes_secret.database : v.metadata[0].name],
      [for k, v in kubernetes_secret.generated : v.metadata[0].name]
    )
  }
}

# Role binding
resource "kubernetes_role_binding" "secrets_reader" {
  count = var.create_accessor_service_account ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-secrets-reader"
    namespace = var.create_namespace ? kubernetes_namespace.secrets[0].metadata[0].name : var.namespace
    labels    = local.common_labels
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.secrets_reader[0].metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.secrets_accessor[0].metadata[0].name
    namespace = var.create_namespace ? kubernetes_namespace.secrets[0].metadata[0].name : var.namespace
  }
}
