# =============================================================================
# Kubernetes Secrets Module Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Common Interface Outputs
# -----------------------------------------------------------------------------

output "secret_arns" {
  description = "Map of secret names to their resource identifiers"
  value = merge(
    { for k, v in kubernetes_secret.secrets : k => "${v.metadata[0].namespace}/${v.metadata[0].name}" },
    { for k, v in kubernetes_secret.database : k => "${v.metadata[0].namespace}/${v.metadata[0].name}" },
    { for k, v in kubernetes_secret.generated : k => "${v.metadata[0].namespace}/${v.metadata[0].name}" },
    { for k, v in kubernetes_secret.tls : k => "${v.metadata[0].namespace}/${v.metadata[0].name}" },
    { for k, v in kubernetes_secret.docker_registry : k => "${v.metadata[0].namespace}/${v.metadata[0].name}" }
  )
}

output "secret_names" {
  description = "Map of secret keys to their Kubernetes names"
  value = merge(
    { for k, v in kubernetes_secret.secrets : k => v.metadata[0].name },
    { for k, v in kubernetes_secret.database : k => v.metadata[0].name },
    { for k, v in kubernetes_secret.generated : k => v.metadata[0].name },
    { for k, v in kubernetes_secret.tls : k => v.metadata[0].name },
    { for k, v in kubernetes_secret.docker_registry : k => v.metadata[0].name }
  )
}

output "resource_ids" {
  description = "Map of resource identifiers (namespace/name format)"
  value = merge(
    { for k, v in kubernetes_secret.secrets : "secret-${k}" => "${v.metadata[0].namespace}/${v.metadata[0].name}" },
    { for k, v in kubernetes_secret.database : "db-${k}" => "${v.metadata[0].namespace}/${v.metadata[0].name}" },
    { for k, v in kubernetes_secret.generated : "gen-${k}" => "${v.metadata[0].namespace}/${v.metadata[0].name}" },
    { for k, v in kubernetes_secret.tls : "tls-${k}" => "${v.metadata[0].namespace}/${v.metadata[0].name}" },
    { for k, v in kubernetes_secret.docker_registry : "registry-${k}" => "${v.metadata[0].namespace}/${v.metadata[0].name}" }
  )
}

output "resource_arns" {
  description = "Map of resource ARN equivalents (kubernetes:// URIs)"
  value = merge(
    { for k, v in kubernetes_secret.secrets : "secret-${k}" => "kubernetes://${v.metadata[0].namespace}/secrets/${v.metadata[0].name}" },
    { for k, v in kubernetes_secret.database : "db-${k}" => "kubernetes://${v.metadata[0].namespace}/secrets/${v.metadata[0].name}" },
    { for k, v in kubernetes_secret.generated : "gen-${k}" => "kubernetes://${v.metadata[0].namespace}/secrets/${v.metadata[0].name}" },
    { for k, v in kubernetes_secret.tls : "tls-${k}" => "kubernetes://${v.metadata[0].namespace}/secrets/${v.metadata[0].name}" },
    { for k, v in kubernetes_secret.docker_registry : "registry-${k}" => "kubernetes://${v.metadata[0].namespace}/secrets/${v.metadata[0].name}" }
  )
}

# -----------------------------------------------------------------------------
# Kubernetes-Specific Outputs
# -----------------------------------------------------------------------------

output "namespace" {
  description = "Kubernetes namespace containing the secrets"
  value       = var.create_namespace ? kubernetes_namespace.secrets[0].metadata[0].name : var.namespace
}

output "generic_secrets" {
  description = "Map of generic secret details"
  value = { for k, v in kubernetes_secret.secrets : k => {
    name      = v.metadata[0].name
    namespace = v.metadata[0].namespace
    type      = v.type
  } }
}

output "database_secrets" {
  description = "Map of database secret details"
  value = { for k, v in kubernetes_secret.database : k => {
    name      = v.metadata[0].name
    namespace = v.metadata[0].namespace
  } }
}

output "generated_secrets" {
  description = "Map of generated secret details"
  value = { for k, v in kubernetes_secret.generated : k => {
    name      = v.metadata[0].name
    namespace = v.metadata[0].namespace
  } }
}

output "generated_secret_values" {
  description = "Map of generated secret values"
  value       = { for k, v in random_password.generated : k => v.result }
  sensitive   = true
}

output "tls_secrets" {
  description = "Map of TLS secret details"
  value = { for k, v in kubernetes_secret.tls : k => {
    name      = v.metadata[0].name
    namespace = v.metadata[0].namespace
  } }
}

output "docker_registry_secrets" {
  description = "Map of Docker registry secret details"
  value = { for k, v in kubernetes_secret.docker_registry : k => {
    name      = v.metadata[0].name
    namespace = v.metadata[0].namespace
    server    = var.docker_registry_secrets[k].server
  } }
}

# -----------------------------------------------------------------------------
# External Secrets Operator Outputs
# -----------------------------------------------------------------------------

output "external_secrets" {
  description = "Map of external secret details"
  value = var.use_external_secrets_operator ? { for k, v in kubernetes_manifest.external_secret : k => {
    name      = v.manifest.metadata.name
    namespace = v.manifest.metadata.namespace
  } } : {}
}

output "secret_stores" {
  description = "Map of secret store details"
  value = var.use_external_secrets_operator ? { for k, v in kubernetes_manifest.cluster_secret_store : k => {
    name         = v.manifest.metadata.name
    kind         = v.manifest.kind
    cluster_wide = var.secret_stores[k].cluster_wide
  } } : {}
}

# -----------------------------------------------------------------------------
# Service Account Outputs
# -----------------------------------------------------------------------------

output "accessor_service_account_name" {
  description = "Name of the secrets accessor service account"
  value       = var.create_accessor_service_account ? kubernetes_service_account.secrets_accessor[0].metadata[0].name : ""
}

output "accessor_role_name" {
  description = "Name of the secrets reader role"
  value       = var.create_accessor_service_account ? kubernetes_role.secrets_reader[0].metadata[0].name : ""
}
