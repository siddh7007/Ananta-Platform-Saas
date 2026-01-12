# =============================================================================
# Cloud-Agnostic Network Module
# =============================================================================
# Provider-agnostic network module that supports:
# - AWS VPC with subnets, NAT Gateway, and VPC endpoints
# - GCP VPC with subnets, Cloud NAT, and private service access
# - Azure Virtual Network with subnets and NAT Gateway
#
# Usage:
#   module "network" {
#     source         = "./modules/network"
#     cloud_provider = "aws"  # or "gcp", "azure"
#     # ... common variables
#     aws_config = { ... }  # Only needed when cloud_provider = "aws"
#   }
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  # Determine effective provider
  effective_provider = var.cloud_provider
}

# -----------------------------------------------------------------------------
# AWS Provider Module
# -----------------------------------------------------------------------------

module "aws" {
  source = "./aws"
  count  = local.effective_provider == "aws" ? 1 : 0

  # Common interface variables
  name_prefix            = var.name_prefix
  vpc_cidr               = var.vpc_cidr
  availability_zones     = var.availability_zones
  public_subnet_cidrs    = var.public_subnet_cidrs
  private_subnet_cidrs   = var.private_subnet_cidrs
  database_subnet_cidrs  = var.database_subnet_cidrs
  enable_nat_gateway     = var.enable_nat_gateway
  single_nat_gateway     = var.single_nat_gateway
  enable_vpc_endpoints   = var.enable_vpc_endpoints
  tags                   = var.tags

  # AWS-specific variables
  cloudwatch_kms_key_id = try(var.aws_config.cloudwatch_kms_key_id, null)
  aws_region            = try(var.aws_config.region, "us-east-1")
}

# -----------------------------------------------------------------------------
# GCP Provider Module
# -----------------------------------------------------------------------------

module "gcp" {
  source = "./gcp"
  count  = local.effective_provider == "gcp" ? 1 : 0

  # Common interface variables
  name_prefix           = var.name_prefix
  environment           = var.environment
  regions               = try(var.gcp_config.regions, [try(var.gcp_config.region, "us-central1")])
  vpc_octet             = try(var.gcp_config.vpc_octet, 0)
  public_subnet_cidrs   = var.public_subnet_cidrs
  private_subnet_cidrs  = var.private_subnet_cidrs
  database_subnet_cidrs = var.database_subnet_cidrs
  enable_nat_gateway    = var.enable_nat_gateway
  labels                = var.tags

  # GCP-specific variables
  project_id                    = try(var.gcp_config.project_id, "")
  routing_mode                  = try(var.gcp_config.routing_mode, "GLOBAL")
  delete_default_routes         = try(var.gcp_config.delete_default_routes, false)
  mtu                           = try(var.gcp_config.mtu, 1460)
  create_gke_subnets            = try(var.gcp_config.create_gke_subnets, true)
  gke_subnet_cidrs              = try(var.gcp_config.gke_subnet_cidrs, [])
  flow_log_interval             = try(var.gcp_config.flow_log_interval, "INTERVAL_5_SEC")
  flow_log_sampling             = try(var.gcp_config.flow_log_sampling, 0.5)
  router_asn                    = try(var.gcp_config.router_asn, 64514)
  nat_ip_allocate_option        = try(var.gcp_config.nat_ip_allocate_option, "AUTO_ONLY")
  nat_logging_enabled           = try(var.gcp_config.nat_logging_enabled, true)
  enable_private_service_access = try(var.gcp_config.enable_private_service_access, true)
  enable_iap_ssh                = try(var.gcp_config.enable_iap_ssh, true)
  create_egress_rules           = try(var.gcp_config.create_egress_rules, true)
  gke_master_cidr_blocks        = try(var.gcp_config.gke_master_cidr_blocks, ["172.16.0.0/28"])
  create_serverless_connector   = try(var.gcp_config.create_serverless_connector, false)
  enable_shared_vpc             = try(var.gcp_config.enable_shared_vpc, false)
  shared_vpc_service_projects   = try(var.gcp_config.shared_vpc_service_projects, [])
  create_dns_policy             = try(var.gcp_config.create_dns_policy, false)
}

# -----------------------------------------------------------------------------
# Azure Provider Module (Placeholder for future implementation)
# -----------------------------------------------------------------------------

# module "azure" {
#   source = "./azure"
#   count  = local.effective_provider == "azure" ? 1 : 0
#
#   # Azure-specific variables
#   # TODO: Implement Azure Virtual Network module
# }
