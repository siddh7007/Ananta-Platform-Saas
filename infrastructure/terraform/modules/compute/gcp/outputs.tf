# =============================================================================
# GCP Compute Module Outputs (GKE)
# =============================================================================

# -----------------------------------------------------------------------------
# Cluster Outputs
# -----------------------------------------------------------------------------

output "cluster_id" {
  description = "GKE cluster ID"
  value       = google_container_cluster.main.id
}

output "cluster_name" {
  description = "GKE cluster name"
  value       = google_container_cluster.main.name
}

output "cluster_location" {
  description = "GKE cluster location (region)"
  value       = google_container_cluster.main.location
}

output "cluster_endpoint" {
  description = "GKE cluster endpoint (master IP)"
  value       = google_container_cluster.main.endpoint
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "GKE cluster CA certificate (base64 encoded)"
  value       = google_container_cluster.main.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "cluster_master_version" {
  description = "GKE cluster master version"
  value       = google_container_cluster.main.master_version
}

output "cluster_self_link" {
  description = "GKE cluster self link"
  value       = google_container_cluster.main.self_link
}

# -----------------------------------------------------------------------------
# Node Pool Outputs
# -----------------------------------------------------------------------------

output "default_node_pool_name" {
  description = "Name of the default node pool"
  value       = google_container_node_pool.default.name
}

output "default_node_pool_instance_group_urls" {
  description = "Instance group URLs for the default node pool"
  value       = google_container_node_pool.default.instance_group_urls
}

output "additional_node_pool_names" {
  description = "Names of additional node pools"
  value       = { for k, v in google_container_node_pool.additional : k => v.name }
}

# -----------------------------------------------------------------------------
# Service Account Outputs
# -----------------------------------------------------------------------------

output "node_service_account_email" {
  description = "Service account email for GKE nodes"
  value       = google_service_account.gke_nodes.email
}

output "node_service_account_id" {
  description = "Service account ID for GKE nodes"
  value       = google_service_account.gke_nodes.id
}

# -----------------------------------------------------------------------------
# Network Outputs
# -----------------------------------------------------------------------------

output "cluster_ipv4_cidr" {
  description = "IPv4 CIDR for the cluster pods"
  value       = google_container_cluster.main.cluster_ipv4_cidr
}

output "services_ipv4_cidr" {
  description = "IPv4 CIDR for the cluster services"
  value       = google_container_cluster.main.services_ipv4_cidr
}

output "master_ipv4_cidr_block" {
  description = "IPv4 CIDR block for the master network"
  value       = google_container_cluster.main.private_cluster_config[0].master_ipv4_cidr_block
}

# -----------------------------------------------------------------------------
# Workload Identity Outputs
# -----------------------------------------------------------------------------

output "workload_identity_pool" {
  description = "Workload Identity pool"
  value       = var.enable_workload_identity ? "${var.project_id}.svc.id.goog" : null
}

# -----------------------------------------------------------------------------
# Connection Information
# -----------------------------------------------------------------------------

output "get_credentials_command" {
  description = "gcloud command to get cluster credentials"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.main.name} --region ${var.region} --project ${var.project_id}"
}

output "kubeconfig_context" {
  description = "Expected kubeconfig context name"
  value       = "gke_${var.project_id}_${var.region}_${google_container_cluster.main.name}"
}

# -----------------------------------------------------------------------------
# Consolidated Outputs
# -----------------------------------------------------------------------------

output "cluster_config" {
  description = "Complete cluster configuration for use by other modules"
  value = {
    id                    = google_container_cluster.main.id
    name                  = google_container_cluster.main.name
    location              = google_container_cluster.main.location
    endpoint              = google_container_cluster.main.endpoint
    ca_certificate        = google_container_cluster.main.master_auth[0].cluster_ca_certificate
    workload_identity_pool = var.enable_workload_identity ? "${var.project_id}.svc.id.goog" : null
    node_service_account  = google_service_account.gke_nodes.email
  }
  sensitive = true
}
