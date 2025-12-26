# =============================================================================
# Service Discovery Module Outputs
# =============================================================================

output "namespace_id" {
  description = "Service discovery namespace ID"
  value       = aws_service_discovery_private_dns_namespace.main.id
}

output "namespace_arn" {
  description = "Service discovery namespace ARN"
  value       = aws_service_discovery_private_dns_namespace.main.arn
}

output "namespace_name" {
  description = "Service discovery namespace name (e.g., 'ananta-dev.local')"
  value       = aws_service_discovery_private_dns_namespace.main.name
}

output "namespace_hosted_zone_id" {
  description = "Route 53 hosted zone ID for the namespace"
  value       = aws_service_discovery_private_dns_namespace.main.hosted_zone
}

output "service_arns" {
  description = "Map of service names to their Cloud Map service ARNs (for ECS service_registries)"
  value = merge(
    { for k, v in aws_service_discovery_service.services : k => v.arn },
    { for k, v in aws_service_discovery_service.internal_services : k => v.arn }
  )
}

output "service_ids" {
  description = "Map of service names to their Cloud Map service IDs"
  value = merge(
    { for k, v in aws_service_discovery_service.services : k => v.id },
    { for k, v in aws_service_discovery_service.internal_services : k => v.id }
  )
}

output "service_discovery_endpoints" {
  description = <<-EOT
    Map of service names to their DNS endpoints (for inter-service communication).
    Example: tenant-management-service.ananta-dev.local
  EOT
  value = merge(
    {
      for k, v in aws_service_discovery_service.services :
      k => "${k}.${aws_service_discovery_private_dns_namespace.main.name}"
    },
    {
      for k, v in aws_service_discovery_service.internal_services :
      k => "${k}.${aws_service_discovery_private_dns_namespace.main.name}"
    }
  )
}

output "service_discovery_ports" {
  description = "Map of service names to their port numbers"
  value = merge(
    { for k, v in var.services : k => v.port },
    { for k, v in var.internal_services : k => v.port }
  )
}

# -----------------------------------------------------------------------------
# Convenience Outputs for Common Services
# -----------------------------------------------------------------------------

output "temporal_address" {
  description = "Temporal server address for worker connections (host:port)"
  value       = contains(keys(var.internal_services), "temporal") ? "temporal.${aws_service_discovery_private_dns_namespace.main.name}:${var.internal_services["temporal"].port}" : null
}

output "keycloak_internal_url" {
  description = "Keycloak internal URL for backend service connections"
  value       = contains(keys(var.services), "keycloak") ? "http://keycloak.${aws_service_discovery_private_dns_namespace.main.name}:${var.services["keycloak"].port}" : null
}

output "tenant_mgmt_internal_url" {
  description = "Tenant management service internal URL"
  value       = contains(keys(var.services), "tenant-management-service") ? "http://tenant-management-service.${aws_service_discovery_private_dns_namespace.main.name}:${var.services["tenant-management-service"].port}" : null
}

output "cns_internal_url" {
  description = "CNS service internal URL"
  value       = contains(keys(var.services), "cns-service") ? "http://cns-service.${aws_service_discovery_private_dns_namespace.main.name}:${var.services["cns-service"].port}" : null
}
