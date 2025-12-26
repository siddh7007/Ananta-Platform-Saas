# =============================================================================
# Kubernetes Compute Module Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Common Interface Outputs
# -----------------------------------------------------------------------------

output "service_endpoints" {
  description = "Map of service names to their internal endpoints"
  value = { for k, v in kubernetes_service.app : k => {
    name      = v.metadata[0].name
    namespace = v.metadata[0].namespace
    cluster_ip = v.spec[0].cluster_ip
    ports = [for p in v.spec[0].port : {
      name        = p.name
      port        = p.port
      target_port = p.target_port
      protocol    = p.protocol
    }]
    endpoint = "http://${v.metadata[0].name}.${v.metadata[0].namespace}.svc.cluster.local:${v.spec[0].port[0].port}"
  } }
}

output "deployment_names" {
  description = "Map of service keys to deployment names"
  value = { for k, v in kubernetes_deployment.app : k => v.metadata[0].name }
}

output "resource_ids" {
  description = "Map of all resource identifiers"
  value = merge(
    { for k, v in kubernetes_deployment.app : "deployment-${k}" => "${v.metadata[0].namespace}/${v.metadata[0].name}" },
    { for k, v in kubernetes_service.app : "service-${k}" => "${v.metadata[0].namespace}/${v.metadata[0].name}" },
    { for k, v in kubernetes_ingress_v1.app : "ingress-${k}" => "${v.metadata[0].namespace}/${v.metadata[0].name}" },
    { for k, v in kubernetes_horizontal_pod_autoscaler_v2.app : "hpa-${k}" => "${v.metadata[0].namespace}/${v.metadata[0].name}" },
    { for k, v in kubernetes_pod_disruption_budget_v1.app : "pdb-${k}" => "${v.metadata[0].namespace}/${v.metadata[0].name}" }
  )
}

# -----------------------------------------------------------------------------
# Namespace Outputs
# -----------------------------------------------------------------------------

output "namespace" {
  description = "Kubernetes namespace where resources are deployed"
  value       = var.create_namespace ? kubernetes_namespace.app[0].metadata[0].name : var.namespace
}

# -----------------------------------------------------------------------------
# Deployment Outputs
# -----------------------------------------------------------------------------

output "deployments" {
  description = "Map of deployment details"
  value = { for k, v in kubernetes_deployment.app : k => {
    name              = v.metadata[0].name
    namespace         = v.metadata[0].namespace
    replicas          = v.spec[0].replicas
    available_replicas = try(v.status[0].available_replicas, 0)
    ready_replicas    = try(v.status[0].ready_replicas, 0)
    labels            = v.metadata[0].labels
  } }
}

# -----------------------------------------------------------------------------
# Service Outputs
# -----------------------------------------------------------------------------

output "services" {
  description = "Map of service details"
  value = { for k, v in kubernetes_service.app : k => {
    name       = v.metadata[0].name
    namespace  = v.metadata[0].namespace
    type       = v.spec[0].type
    cluster_ip = v.spec[0].cluster_ip
    ports = [for p in v.spec[0].port : {
      name        = p.name
      port        = p.port
      target_port = p.target_port
      node_port   = try(p.node_port, null)
    }]
  } }
}

output "service_urls" {
  description = "Map of service internal URLs"
  value = { for k, v in kubernetes_service.app : k =>
    "http://${v.metadata[0].name}.${v.metadata[0].namespace}.svc.cluster.local:${v.spec[0].port[0].port}"
  }
}

# -----------------------------------------------------------------------------
# Ingress Outputs
# -----------------------------------------------------------------------------

output "ingress_endpoints" {
  description = "Map of ingress details with external URLs"
  value = { for k, v in kubernetes_ingress_v1.app : k => {
    name      = v.metadata[0].name
    namespace = v.metadata[0].namespace
    hosts     = [for rule in v.spec[0].rule : rule.host]
    paths = flatten([for rule in v.spec[0].rule : [
      for path in rule.http[0].path : {
        host     = rule.host
        path     = path.path
        path_type = path.path_type
        backend  = path.backend[0].service[0].name
      }
    ]])
    load_balancer_ip = try(v.status[0].load_balancer[0].ingress[0].ip, "")
    load_balancer_hostname = try(v.status[0].load_balancer[0].ingress[0].hostname, "")
  } }
}

output "external_urls" {
  description = "Map of external URLs from ingress"
  value = { for k, v in kubernetes_ingress_v1.app : k =>
    try(
      "https://${v.spec[0].rule[0].host}${v.spec[0].rule[0].http[0].path[0].path}",
      ""
    )
  }
}

# -----------------------------------------------------------------------------
# Service Account Outputs
# -----------------------------------------------------------------------------

output "service_account_name" {
  description = "Name of the service account"
  value       = var.create_service_account ? kubernetes_service_account.app[0].metadata[0].name : var.service_account_name
}

# -----------------------------------------------------------------------------
# ConfigMap Outputs
# -----------------------------------------------------------------------------

output "configmap_name" {
  description = "Name of the shared ConfigMap"
  value       = length(var.config_data) > 0 ? kubernetes_config_map.app[0].metadata[0].name : ""
}

# -----------------------------------------------------------------------------
# Autoscaling Outputs
# -----------------------------------------------------------------------------

output "hpa_status" {
  description = "Map of HPA details"
  value = { for k, v in kubernetes_horizontal_pod_autoscaler_v2.app : k => {
    name         = v.metadata[0].name
    namespace    = v.metadata[0].namespace
    min_replicas = v.spec[0].min_replicas
    max_replicas = v.spec[0].max_replicas
    current_replicas = try(v.status[0].current_replicas, 0)
    desired_replicas = try(v.status[0].desired_replicas, 0)
  } }
}

# -----------------------------------------------------------------------------
# Pod Disruption Budget Outputs
# -----------------------------------------------------------------------------

output "pdb_status" {
  description = "Map of PDB details"
  value = { for k, v in kubernetes_pod_disruption_budget_v1.app : k => {
    name          = v.metadata[0].name
    namespace     = v.metadata[0].namespace
    min_available = try(v.spec[0].min_available, null)
  } }
}

# -----------------------------------------------------------------------------
# Network Policy Outputs
# -----------------------------------------------------------------------------

output "network_policies" {
  description = "Map of NetworkPolicy details"
  value = { for k, v in kubernetes_network_policy.app : k => {
    name      = v.metadata[0].name
    namespace = v.metadata[0].namespace
  } }
}

# -----------------------------------------------------------------------------
# Monitoring Outputs
# -----------------------------------------------------------------------------

output "service_monitors" {
  description = "Map of ServiceMonitor details (if Prometheus Operator enabled)"
  value = var.prometheus_operator_enabled ? { for k, v in kubernetes_manifest.service_monitor : k => {
    name      = v.manifest.metadata.name
    namespace = v.manifest.metadata.namespace
  } } : {}
}

# -----------------------------------------------------------------------------
# Connection Information
# -----------------------------------------------------------------------------

output "connection_info" {
  description = "Connection information for all services"
  value = { for k, v in kubernetes_service.app : k => {
    internal_dns = "${v.metadata[0].name}.${v.metadata[0].namespace}.svc.cluster.local"
    ports = { for p in v.spec[0].port : p.name => p.port }
    external_url = try(
      kubernetes_ingress_v1.app[k] != null ? "https://${kubernetes_ingress_v1.app[k].spec[0].rule[0].host}" : null,
      null
    )
  } }
}

# -----------------------------------------------------------------------------
# Summary Output
# -----------------------------------------------------------------------------

output "summary" {
  description = "Summary of deployed resources"
  value = {
    namespace          = var.create_namespace ? kubernetes_namespace.app[0].metadata[0].name : var.namespace
    deployment_count   = length(kubernetes_deployment.app)
    service_count      = length(kubernetes_service.app)
    ingress_count      = length(kubernetes_ingress_v1.app)
    hpa_count          = length(kubernetes_horizontal_pod_autoscaler_v2.app)
    pdb_count          = length(kubernetes_pod_disruption_budget_v1.app)
    network_policy_count = length(kubernetes_network_policy.app)
    service_monitor_count = var.prometheus_operator_enabled ? length(kubernetes_manifest.service_monitor) : 0
    services_deployed  = keys(kubernetes_deployment.app)
  }
}
