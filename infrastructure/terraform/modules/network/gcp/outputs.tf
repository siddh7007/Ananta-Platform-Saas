# =============================================================================
# GCP Network Module Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# VPC Outputs
# -----------------------------------------------------------------------------

output "vpc_id" {
  description = "VPC ID"
  value       = google_compute_network.main.id
}

output "vpc_name" {
  description = "VPC name"
  value       = google_compute_network.main.name
}

output "vpc_self_link" {
  description = "VPC self link"
  value       = google_compute_network.main.self_link
}

# -----------------------------------------------------------------------------
# Public Subnet Outputs
# -----------------------------------------------------------------------------

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = google_compute_subnetwork.public[*].id
}

output "public_subnet_names" {
  description = "List of public subnet names"
  value       = google_compute_subnetwork.public[*].name
}

output "public_subnet_self_links" {
  description = "List of public subnet self links"
  value       = google_compute_subnetwork.public[*].self_link
}

output "public_subnet_cidrs" {
  description = "List of public subnet CIDR ranges"
  value       = google_compute_subnetwork.public[*].ip_cidr_range
}

# -----------------------------------------------------------------------------
# Private Subnet Outputs
# -----------------------------------------------------------------------------

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = google_compute_subnetwork.private[*].id
}

output "private_subnet_names" {
  description = "List of private subnet names"
  value       = google_compute_subnetwork.private[*].name
}

output "private_subnet_self_links" {
  description = "List of private subnet self links"
  value       = google_compute_subnetwork.private[*].self_link
}

output "private_subnet_cidrs" {
  description = "List of private subnet CIDR ranges"
  value       = google_compute_subnetwork.private[*].ip_cidr_range
}

# -----------------------------------------------------------------------------
# Database Subnet Outputs
# -----------------------------------------------------------------------------

output "database_subnet_ids" {
  description = "List of database subnet IDs"
  value       = google_compute_subnetwork.database[*].id
}

output "database_subnet_names" {
  description = "List of database subnet names"
  value       = google_compute_subnetwork.database[*].name
}

output "database_subnet_self_links" {
  description = "List of database subnet self links"
  value       = google_compute_subnetwork.database[*].self_link
}

output "database_subnet_cidrs" {
  description = "List of database subnet CIDR ranges"
  value       = google_compute_subnetwork.database[*].ip_cidr_range
}

# -----------------------------------------------------------------------------
# GKE Subnet Outputs
# -----------------------------------------------------------------------------

output "gke_subnet_ids" {
  description = "List of GKE subnet IDs"
  value       = google_compute_subnetwork.gke[*].id
}

output "gke_subnet_names" {
  description = "List of GKE subnet names"
  value       = google_compute_subnetwork.gke[*].name
}

output "gke_subnet_self_links" {
  description = "List of GKE subnet self links"
  value       = google_compute_subnetwork.gke[*].self_link
}

output "gke_subnet_cidrs" {
  description = "List of GKE subnet CIDR ranges"
  value       = google_compute_subnetwork.gke[*].ip_cidr_range
}

output "gke_pod_ranges" {
  description = "Map of GKE pod secondary range names by subnet"
  value = {
    for s in google_compute_subnetwork.gke : s.name => {
      name       = "pods"
      cidr_range = [for r in s.secondary_ip_range : r.ip_cidr_range if r.range_name == "pods"][0]
    }
  }
}

output "gke_service_ranges" {
  description = "Map of GKE service secondary range names by subnet"
  value = {
    for s in google_compute_subnetwork.gke : s.name => {
      name       = "services"
      cidr_range = [for r in s.secondary_ip_range : r.ip_cidr_range if r.range_name == "services"][0]
    }
  }
}

# -----------------------------------------------------------------------------
# Router and NAT Outputs
# -----------------------------------------------------------------------------

output "router_ids" {
  description = "List of Cloud Router IDs"
  value       = google_compute_router.main[*].id
}

output "router_names" {
  description = "List of Cloud Router names"
  value       = google_compute_router.main[*].name
}

output "nat_ids" {
  description = "List of Cloud NAT IDs"
  value       = google_compute_router_nat.main[*].id
}

output "nat_names" {
  description = "List of Cloud NAT names"
  value       = google_compute_router_nat.main[*].name
}

# -----------------------------------------------------------------------------
# Private Service Access Outputs
# -----------------------------------------------------------------------------

output "private_service_range_name" {
  description = "Name of the private service access IP range"
  value       = var.enable_private_service_access ? google_compute_global_address.private_service_range[0].name : null
}

output "private_service_range_address" {
  description = "Private service access IP range address"
  value       = var.enable_private_service_access ? google_compute_global_address.private_service_range[0].address : null
}

output "private_service_connection_peering" {
  description = "Private service connection peering name"
  value       = var.enable_private_service_access ? google_service_networking_connection.private_service_connection[0].peering : null
}

# -----------------------------------------------------------------------------
# Serverless Connector Outputs
# -----------------------------------------------------------------------------

output "serverless_connector_ids" {
  description = "List of VPC Access Connector IDs"
  value       = google_vpc_access_connector.serverless[*].id
}

output "serverless_connector_names" {
  description = "List of VPC Access Connector names"
  value       = google_vpc_access_connector.serverless[*].name
}

output "serverless_connector_self_links" {
  description = "List of VPC Access Connector self links"
  value       = google_vpc_access_connector.serverless[*].self_link
}

# -----------------------------------------------------------------------------
# Firewall Outputs
# -----------------------------------------------------------------------------

output "firewall_internal_id" {
  description = "Internal firewall rule ID"
  value       = google_compute_firewall.allow_internal.id
}

output "firewall_iap_ssh_id" {
  description = "IAP SSH firewall rule ID"
  value       = var.enable_iap_ssh ? google_compute_firewall.allow_iap_ssh[0].id : null
}

output "firewall_lb_health_id" {
  description = "Load balancer health check firewall rule ID"
  value       = google_compute_firewall.allow_lb_health_checks.id
}

# -----------------------------------------------------------------------------
# Consolidated Outputs (for module consumption)
# -----------------------------------------------------------------------------

output "network_config" {
  description = "Complete network configuration for use by other modules"
  value = {
    vpc_id       = google_compute_network.main.id
    vpc_name     = google_compute_network.main.name
    vpc_self_link = google_compute_network.main.self_link

    subnets = {
      public   = { for i, s in google_compute_subnetwork.public : var.regions[i] => s.self_link }
      private  = { for i, s in google_compute_subnetwork.private : var.regions[i] => s.self_link }
      database = { for i, s in google_compute_subnetwork.database : var.regions[i] => s.self_link }
      gke      = var.create_gke_subnets ? { for i, s in google_compute_subnetwork.gke : var.regions[i] => s.self_link } : {}
    }

    nat_enabled = var.enable_nat_gateway
    private_service_access_enabled = var.enable_private_service_access
  }
}
