# =============================================================================
# Kubernetes Frontend Applications Module Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Namespace
# -----------------------------------------------------------------------------

output "namespace" {
  description = "Kubernetes namespace where frontends are deployed"
  value       = var.namespace
}

# -----------------------------------------------------------------------------
# Admin App Outputs
# -----------------------------------------------------------------------------

output "admin_app_service_name" {
  description = "Admin app service name"
  value       = var.deploy_admin_app ? kubernetes_service.admin_app[0].metadata[0].name : null
}

output "admin_app_endpoint" {
  description = "Admin app internal endpoint"
  value       = var.deploy_admin_app ? "${kubernetes_service.admin_app[0].metadata[0].name}.${var.namespace}.svc.cluster.local:${var.admin_app_port}" : null
}

output "admin_app_url" {
  description = "Admin app URL (if ingress is enabled)"
  value       = var.create_ingress && var.deploy_admin_app ? "http${var.ingress_tls_enabled ? "s" : ""}://${var.admin_app_hostname}" : null
}

output "admin_app_replicas" {
  description = "Number of admin app replicas"
  value       = var.deploy_admin_app ? var.admin_app_replicas : 0
}

# -----------------------------------------------------------------------------
# Customer Portal Outputs
# -----------------------------------------------------------------------------

output "customer_portal_service_name" {
  description = "Customer portal service name"
  value       = var.deploy_customer_portal ? kubernetes_service.customer_portal[0].metadata[0].name : null
}

output "customer_portal_endpoint" {
  description = "Customer portal internal endpoint"
  value       = var.deploy_customer_portal ? "${kubernetes_service.customer_portal[0].metadata[0].name}.${var.namespace}.svc.cluster.local:${var.customer_portal_port}" : null
}

output "customer_portal_url" {
  description = "Customer portal URL (if ingress is enabled)"
  value       = var.create_ingress && var.deploy_customer_portal ? "http${var.ingress_tls_enabled ? "s" : ""}://${var.customer_portal_hostname}" : null
}

output "customer_portal_replicas" {
  description = "Number of customer portal replicas"
  value       = var.deploy_customer_portal ? var.customer_portal_replicas : 0
}

# -----------------------------------------------------------------------------
# CNS Dashboard Outputs
# -----------------------------------------------------------------------------

output "cns_dashboard_service_name" {
  description = "CNS dashboard service name"
  value       = var.deploy_cns_dashboard ? kubernetes_service.cns_dashboard[0].metadata[0].name : null
}

output "cns_dashboard_endpoint" {
  description = "CNS dashboard internal endpoint"
  value       = var.deploy_cns_dashboard ? "${kubernetes_service.cns_dashboard[0].metadata[0].name}.${var.namespace}.svc.cluster.local:${var.cns_dashboard_port}" : null
}

output "cns_dashboard_url" {
  description = "CNS dashboard URL (if ingress is enabled)"
  value       = var.create_ingress && var.deploy_cns_dashboard ? "http${var.ingress_tls_enabled ? "s" : ""}://${var.cns_dashboard_hostname}" : null
}

output "cns_dashboard_replicas" {
  description = "Number of CNS dashboard replicas"
  value       = var.deploy_cns_dashboard ? var.cns_dashboard_replicas : 0
}

# -----------------------------------------------------------------------------
# Backstage Portal Outputs
# -----------------------------------------------------------------------------

output "backstage_portal_service_name" {
  description = "Backstage portal service name"
  value       = var.deploy_backstage_portal ? kubernetes_service.backstage_portal[0].metadata[0].name : null
}

output "backstage_portal_endpoint" {
  description = "Backstage portal internal endpoint"
  value       = var.deploy_backstage_portal ? "${kubernetes_service.backstage_portal[0].metadata[0].name}.${var.namespace}.svc.cluster.local:${var.backstage_portal_port}" : null
}

output "backstage_portal_url" {
  description = "Backstage portal URL (if ingress is enabled)"
  value       = var.create_ingress && var.deploy_backstage_portal ? "http${var.ingress_tls_enabled ? "s" : ""}://${var.backstage_portal_hostname}" : null
}

output "backstage_portal_replicas" {
  description = "Number of backstage portal replicas"
  value       = var.deploy_backstage_portal ? var.backstage_portal_replicas : 0
}

# -----------------------------------------------------------------------------
# Dashboard Outputs
# -----------------------------------------------------------------------------

output "dashboard_service_name" {
  description = "Dashboard service name"
  value       = var.deploy_dashboard ? kubernetes_service.dashboard[0].metadata[0].name : null
}

output "dashboard_endpoint" {
  description = "Dashboard internal endpoint"
  value       = var.deploy_dashboard ? "${kubernetes_service.dashboard[0].metadata[0].name}.${var.namespace}.svc.cluster.local:${var.dashboard_port}" : null
}

output "dashboard_url" {
  description = "Dashboard URL (if ingress is enabled)"
  value       = var.create_ingress && var.deploy_dashboard ? "http${var.ingress_tls_enabled ? "s" : ""}://${var.dashboard_hostname}" : null
}

output "dashboard_replicas" {
  description = "Number of dashboard replicas"
  value       = var.deploy_dashboard ? var.dashboard_replicas : 0
}

# -----------------------------------------------------------------------------
# ConfigMap Outputs
# -----------------------------------------------------------------------------

output "config_map_name" {
  description = "Shared frontend configuration ConfigMap name"
  value       = kubernetes_config_map.frontend_config.metadata[0].name
}

# -----------------------------------------------------------------------------
# Ingress Outputs
# -----------------------------------------------------------------------------

output "ingress_name" {
  description = "Ingress resource name (if created)"
  value       = var.create_ingress ? kubernetes_ingress_v1.frontends[0].metadata[0].name : null
}

output "ingress_class" {
  description = "Ingress class used"
  value       = var.create_ingress ? var.ingress_class : null
}

output "ingress_hosts" {
  description = "List of all ingress hostnames"
  value = var.create_ingress ? compact([
    var.deploy_admin_app ? var.admin_app_hostname : "",
    var.deploy_customer_portal ? var.customer_portal_hostname : "",
    var.deploy_cns_dashboard ? var.cns_dashboard_hostname : "",
    var.deploy_backstage_portal ? var.backstage_portal_hostname : "",
    var.deploy_dashboard ? var.dashboard_hostname : "",
  ]) : []
}

# -----------------------------------------------------------------------------
# Summary Outputs
# -----------------------------------------------------------------------------

output "deployed_applications" {
  description = "List of deployed frontend applications"
  value = compact([
    var.deploy_admin_app ? "admin-app" : "",
    var.deploy_customer_portal ? "customer-portal" : "",
    var.deploy_cns_dashboard ? "cns-dashboard" : "",
    var.deploy_backstage_portal ? "backstage-portal" : "",
    var.deploy_dashboard ? "dashboard" : "",
  ])
}

output "total_replicas" {
  description = "Total number of frontend replicas across all applications"
  value = (
    (var.deploy_admin_app ? var.admin_app_replicas : 0) +
    (var.deploy_customer_portal ? var.customer_portal_replicas : 0) +
    (var.deploy_cns_dashboard ? var.cns_dashboard_replicas : 0) +
    (var.deploy_backstage_portal ? var.backstage_portal_replicas : 0) +
    (var.deploy_dashboard ? var.dashboard_replicas : 0)
  )
}

output "service_endpoints" {
  description = "Map of service names to their internal endpoints"
  value = {
    admin_app        = var.deploy_admin_app ? "${kubernetes_service.admin_app[0].metadata[0].name}.${var.namespace}.svc.cluster.local:${var.admin_app_port}" : null
    customer_portal  = var.deploy_customer_portal ? "${kubernetes_service.customer_portal[0].metadata[0].name}.${var.namespace}.svc.cluster.local:${var.customer_portal_port}" : null
    cns_dashboard    = var.deploy_cns_dashboard ? "${kubernetes_service.cns_dashboard[0].metadata[0].name}.${var.namespace}.svc.cluster.local:${var.cns_dashboard_port}" : null
    backstage_portal = var.deploy_backstage_portal ? "${kubernetes_service.backstage_portal[0].metadata[0].name}.${var.namespace}.svc.cluster.local:${var.backstage_portal_port}" : null
    dashboard        = var.deploy_dashboard ? "${kubernetes_service.dashboard[0].metadata[0].name}.${var.namespace}.svc.cluster.local:${var.dashboard_port}" : null
  }
}

output "external_urls" {
  description = "Map of external URLs (if ingress is enabled)"
  value = var.create_ingress ? {
    admin_app        = var.deploy_admin_app ? "http${var.ingress_tls_enabled ? "s" : ""}://${var.admin_app_hostname}" : null
    customer_portal  = var.deploy_customer_portal ? "http${var.ingress_tls_enabled ? "s" : ""}://${var.customer_portal_hostname}" : null
    cns_dashboard    = var.deploy_cns_dashboard ? "http${var.ingress_tls_enabled ? "s" : ""}://${var.cns_dashboard_hostname}" : null
    backstage_portal = var.deploy_backstage_portal ? "http${var.ingress_tls_enabled ? "s" : ""}://${var.backstage_portal_hostname}" : null
    dashboard        = var.deploy_dashboard ? "http${var.ingress_tls_enabled ? "s" : ""}://${var.dashboard_hostname}" : null
  } : {}
}
