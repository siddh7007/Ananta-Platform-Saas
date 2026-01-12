# =============================================================================
# Vault Kubernetes Module Outputs
# =============================================================================

output "address" {
  description = "Vault server address (internal)"
  value       = "http://${var.name_prefix}-vault.${var.namespace}.svc.cluster.local:8200"
}

output "external_address" {
  description = "Vault server address (for port-forward)"
  value       = "http://localhost:8200"
}

output "namespace" {
  description = "Vault namespace"
  value       = var.namespace
}

output "service_name" {
  description = "Vault service name"
  value       = "${var.name_prefix}-vault"
}

output "injector_enabled" {
  description = "Whether Vault Agent Injector is enabled"
  value       = var.enable_injector
}

output "dev_mode" {
  description = "Whether Vault is running in dev mode"
  value       = var.dev_mode
}

output "root_token_secret" {
  description = "Kubernetes secret containing root token (production mode only)"
  value       = var.dev_mode ? null : "${var.name_prefix}-keys"
}
