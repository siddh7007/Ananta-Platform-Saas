# ArgoCD Module Outputs

# Helm release information
output "helm_release_name" {
  description = "Name of the ArgoCD Helm release"
  value       = helm_release.argocd.name
}

output "helm_release_namespace" {
  description = "Namespace of the ArgoCD Helm release"
  value       = helm_release.argocd.namespace
}

output "helm_release_version" {
  description = "Version of the ArgoCD Helm chart"
  value       = helm_release.argocd.version
}

output "helm_release_status" {
  description = "Status of the ArgoCD Helm release"
  value       = helm_release.argocd.status
}

# ArgoCD server information
output "argocd_namespace" {
  description = "Kubernetes namespace where ArgoCD is installed"
  value       = var.namespace
}

output "argocd_server_url" {
  description = "ArgoCD server URL (for LoadBalancer or Ingress)"
  value = var.create_ingress ? (
    var.ingress_tls_enabled ? "https://${var.ingress_host}" : "http://${var.ingress_host}"
    ) : (
    var.service_type == "LoadBalancer" ? "http://pending-load-balancer-ip" : "http://argocd-server.${var.namespace}.svc.cluster.local"
  )
}

output "argocd_server_service_name" {
  description = "Name of the ArgoCD server service"
  value       = "${var.release_name}-server"
}

output "argocd_server_service_type" {
  description = "Type of the ArgoCD server service"
  value       = var.service_type
}

# Admin credentials
output "argocd_initial_admin_password" {
  description = "Initial admin password for ArgoCD (auto-generated if not provided)"
  value       = var.admin_password != "" ? var.admin_password : (length(random_password.argocd_admin) > 0 ? random_password.argocd_admin[0].result : null)
  sensitive   = true
}

output "argocd_admin_username" {
  description = "ArgoCD admin username"
  value       = "admin"
}

# ArgoCD Project information
output "argocd_project_created" {
  description = "Whether the ArgoCD project was created"
  value       = var.create_project
}

output "argocd_project_name" {
  description = "Name of the ArgoCD project"
  value       = var.create_project ? var.project_name : null
}

output "argocd_project_source_repos" {
  description = "Source repositories configured for the project"
  value       = var.create_project ? concat([var.git_repo_url], var.additional_source_repos) : []
}

# ApplicationSet information
output "applicationset_created" {
  description = "Whether the ApplicationSet was created"
  value       = var.create_applicationset
}

output "applicationset_name" {
  description = "Name of the ApplicationSet"
  value       = var.create_applicationset ? var.applicationset_name : null
}

output "applicationset_environments" {
  description = "Environments configured in the ApplicationSet"
  value = var.create_applicationset ? [
    for env in var.environments : {
      name      = env.name
      namespace = env.namespace
      branch    = env.git_branch != null ? env.git_branch : var.git_branch
    }
  ] : []
}

# Repository credentials information
output "git_repo_url" {
  description = "Git repository URL configured for ArgoCD"
  value       = var.git_repo_url
}

output "git_credentials_type" {
  description = "Type of Git credentials configured (https, ssh, or none)"
  value = var.git_username != "" && var.git_password != "" ? "https" : (
    var.git_ssh_private_key != "" ? "ssh" : "none"
  )
}

output "git_repo_https_secret_name" {
  description = "Name of the Git repository HTTPS credentials secret"
  value       = var.git_username != "" && var.git_password != "" ? "${var.project_name}-repo-creds-https" : null
}

output "git_repo_ssh_secret_name" {
  description = "Name of the Git repository SSH credentials secret"
  value       = var.git_ssh_private_key != "" ? "${var.project_name}-repo-creds-ssh" : null
}

# High availability configuration
output "ha_enabled" {
  description = "Whether high availability mode is enabled"
  value       = var.ha_enabled
}

# Ingress information
output "ingress_enabled" {
  description = "Whether Ingress is enabled for ArgoCD"
  value       = var.create_ingress
}

output "ingress_host" {
  description = "Hostname configured for ArgoCD Ingress"
  value       = var.create_ingress ? var.ingress_host : null
}

output "ingress_tls_enabled" {
  description = "Whether TLS is enabled for ArgoCD Ingress"
  value       = var.create_ingress ? var.ingress_tls_enabled : false
}

# Metrics configuration
output "metrics_enabled" {
  description = "Whether Prometheus metrics are enabled"
  value       = var.enable_metrics
}

# Component status
output "components_enabled" {
  description = "Status of optional ArgoCD components"
  value = {
    applicationset = var.enable_applicationset
    notifications  = var.enable_notifications
    dex            = var.enable_dex
  }
}

# Additional applications
output "additional_applications" {
  description = "Names of additional applications created"
  value       = keys(var.additional_applications)
}

# Quick start information
output "quick_start_commands" {
  description = "Quick start commands for accessing ArgoCD"
  value = var.service_type == "NodePort" || var.service_type == "ClusterIP" ? {
    port_forward = "kubectl port-forward svc/${var.release_name}-server -n ${var.namespace} 8080:443"
    login        = "argocd login localhost:8080 --username admin --password <password> --insecure"
    ui_url       = "https://localhost:8080"
  } : null
}

# CLI configuration
output "argocd_cli_config" {
  description = "Configuration for ArgoCD CLI"
  value = {
    server   = var.create_ingress ? var.ingress_host : "${var.release_name}-server.${var.namespace}.svc.cluster.local"
    username = "admin"
    insecure = var.insecure_server || !var.ingress_tls_enabled
  }
}

# Sync policy configuration
output "sync_policy" {
  description = "Sync policy configuration for applications"
  value = {
    automated  = var.sync_policy_automated
    prune      = var.sync_policy_prune
    self_heal  = var.sync_policy_self_heal
    allow_empty = var.sync_policy_allow_empty
  }
}

# Resource information for monitoring
output "resource_labels" {
  description = "Common labels applied to ArgoCD resources"
  value       = var.labels
}
