# =============================================================================
# Keycloak Kubernetes Module Outputs
# =============================================================================

output "service_name" {
  description = "Keycloak service name"
  value       = kubernetes_service.keycloak.metadata[0].name
}

output "internal_url" {
  description = "Internal Keycloak URL (cluster-internal)"
  value       = "http://${kubernetes_service.keycloak.metadata[0].name}.${var.namespace}.svc.cluster.local:8080"
}

output "external_url" {
  description = "External Keycloak URL (for port-forwarding)"
  value       = "http://localhost:8180"
}

output "admin_username" {
  description = "Keycloak admin username"
  value       = var.admin_username
}

output "admin_password_secret" {
  description = "Secret name containing admin password"
  value       = kubernetes_secret.keycloak.metadata[0].name
}

output "namespace" {
  description = "Kubernetes namespace"
  value       = var.namespace
}

output "db_secret_name" {
  description = "Secret name containing Keycloak database credentials"
  value       = kubernetes_secret.keycloak.metadata[0].name
}
