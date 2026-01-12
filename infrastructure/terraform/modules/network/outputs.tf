# =============================================================================
# Cloud-Agnostic Network Module Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Common Outputs (Provider-Agnostic)
# -----------------------------------------------------------------------------

output "vpc_id" {
  description = "VPC/Network ID"
  value = (
    var.cloud_provider == "aws" ? try(module.aws[0].vpc_id, null) :
    var.cloud_provider == "gcp" ? try(module.gcp[0].vpc_id, null) :
    null
  )
}

output "vpc_name" {
  description = "VPC/Network name"
  value = (
    var.cloud_provider == "gcp" ? try(module.gcp[0].vpc_name, null) :
    null
  )
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value = (
    var.cloud_provider == "aws" ? try(module.aws[0].public_subnet_ids, []) :
    var.cloud_provider == "gcp" ? try(module.gcp[0].public_subnet_ids, []) :
    []
  )
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value = (
    var.cloud_provider == "aws" ? try(module.aws[0].private_subnet_ids, []) :
    var.cloud_provider == "gcp" ? try(module.gcp[0].private_subnet_ids, []) :
    []
  )
}

output "database_subnet_ids" {
  description = "List of database subnet IDs"
  value = (
    var.cloud_provider == "aws" ? try(module.aws[0].database_subnet_ids, []) :
    var.cloud_provider == "gcp" ? try(module.gcp[0].database_subnet_ids, []) :
    []
  )
}

# -----------------------------------------------------------------------------
# AWS-Specific Outputs
# -----------------------------------------------------------------------------

output "aws_vpc_cidr" {
  description = "AWS VPC CIDR block"
  value       = var.cloud_provider == "aws" ? try(module.aws[0].vpc_cidr, null) : null
}

output "aws_db_subnet_group_name" {
  description = "AWS database subnet group name"
  value       = var.cloud_provider == "aws" ? try(module.aws[0].db_subnet_group_name, null) : null
}

output "aws_cache_subnet_group_name" {
  description = "AWS ElastiCache subnet group name"
  value       = var.cloud_provider == "aws" ? try(module.aws[0].cache_subnet_group_name, null) : null
}

output "aws_nat_gateway_ips" {
  description = "AWS NAT Gateway public IPs"
  value       = var.cloud_provider == "aws" ? try(module.aws[0].nat_gateway_ips, []) : []
}

output "aws_internet_gateway_id" {
  description = "AWS Internet Gateway ID"
  value       = var.cloud_provider == "aws" ? try(module.aws[0].internet_gateway_id, null) : null
}

output "aws_vpc_endpoint_s3_id" {
  description = "AWS S3 VPC endpoint ID"
  value       = var.cloud_provider == "aws" ? try(module.aws[0].vpc_endpoint_s3_id, null) : null
}

output "aws_vpc_endpoint_security_group_id" {
  description = "AWS VPC endpoint security group ID"
  value       = var.cloud_provider == "aws" ? try(module.aws[0].vpc_endpoint_security_group_id, null) : null
}

# -----------------------------------------------------------------------------
# GCP-Specific Outputs
# -----------------------------------------------------------------------------

output "gcp_vpc_self_link" {
  description = "GCP VPC self link"
  value       = var.cloud_provider == "gcp" ? try(module.gcp[0].vpc_self_link, null) : null
}

output "gcp_public_subnet_self_links" {
  description = "GCP public subnet self links"
  value       = var.cloud_provider == "gcp" ? try(module.gcp[0].public_subnet_self_links, []) : []
}

output "gcp_private_subnet_self_links" {
  description = "GCP private subnet self links"
  value       = var.cloud_provider == "gcp" ? try(module.gcp[0].private_subnet_self_links, []) : []
}

output "gcp_database_subnet_self_links" {
  description = "GCP database subnet self links"
  value       = var.cloud_provider == "gcp" ? try(module.gcp[0].database_subnet_self_links, []) : []
}

output "gcp_gke_subnet_ids" {
  description = "GCP GKE subnet IDs"
  value       = var.cloud_provider == "gcp" ? try(module.gcp[0].gke_subnet_ids, []) : []
}

output "gcp_gke_subnet_self_links" {
  description = "GCP GKE subnet self links"
  value       = var.cloud_provider == "gcp" ? try(module.gcp[0].gke_subnet_self_links, []) : []
}

output "gcp_gke_pod_ranges" {
  description = "GCP GKE pod secondary IP ranges"
  value       = var.cloud_provider == "gcp" ? try(module.gcp[0].gke_pod_ranges, {}) : {}
}

output "gcp_gke_service_ranges" {
  description = "GCP GKE service secondary IP ranges"
  value       = var.cloud_provider == "gcp" ? try(module.gcp[0].gke_service_ranges, {}) : {}
}

output "gcp_router_ids" {
  description = "GCP Cloud Router IDs"
  value       = var.cloud_provider == "gcp" ? try(module.gcp[0].router_ids, []) : []
}

output "gcp_nat_ids" {
  description = "GCP Cloud NAT IDs"
  value       = var.cloud_provider == "gcp" ? try(module.gcp[0].nat_ids, []) : []
}

output "gcp_private_service_range_name" {
  description = "GCP private service access IP range name"
  value       = var.cloud_provider == "gcp" ? try(module.gcp[0].private_service_range_name, null) : null
}

output "gcp_serverless_connector_ids" {
  description = "GCP VPC Access Connector IDs"
  value       = var.cloud_provider == "gcp" ? try(module.gcp[0].serverless_connector_ids, []) : []
}

output "gcp_network_config" {
  description = "GCP consolidated network configuration"
  value       = var.cloud_provider == "gcp" ? try(module.gcp[0].network_config, null) : null
}

# -----------------------------------------------------------------------------
# Consolidated Network Configuration
# -----------------------------------------------------------------------------

output "network_config" {
  description = "Consolidated network configuration for use by other modules"
  value = {
    provider    = var.cloud_provider
    vpc_id      = (
      var.cloud_provider == "aws" ? try(module.aws[0].vpc_id, null) :
      var.cloud_provider == "gcp" ? try(module.gcp[0].vpc_id, null) :
      null
    )
    public_subnets = (
      var.cloud_provider == "aws" ? try(module.aws[0].public_subnet_ids, []) :
      var.cloud_provider == "gcp" ? try(module.gcp[0].public_subnet_ids, []) :
      []
    )
    private_subnets = (
      var.cloud_provider == "aws" ? try(module.aws[0].private_subnet_ids, []) :
      var.cloud_provider == "gcp" ? try(module.gcp[0].private_subnet_ids, []) :
      []
    )
    database_subnets = (
      var.cloud_provider == "aws" ? try(module.aws[0].database_subnet_ids, []) :
      var.cloud_provider == "gcp" ? try(module.gcp[0].database_subnet_ids, []) :
      []
    )
    nat_enabled = var.enable_nat_gateway
  }
}
