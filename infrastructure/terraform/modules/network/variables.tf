# =============================================================================
# Cloud-Agnostic Network Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Required Variables
# -----------------------------------------------------------------------------

variable "cloud_provider" {
  description = "Cloud provider (aws, gcp, azure)"
  type        = string

  validation {
    condition     = contains(["aws", "gcp", "azure"], var.cloud_provider)
    error_message = "Cloud provider must be aws, gcp, or azure."
  }
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

# -----------------------------------------------------------------------------
# Common Network Configuration
# -----------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for the VPC (AWS) or base CIDR calculation (GCP)"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones (AWS) or regions (GCP)"
  type        = list(string)
  default     = []
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = []
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = []
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = []
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use single NAT Gateway (cost saving for non-prod)"
  type        = bool
  default     = false
}

variable "enable_vpc_endpoints" {
  description = "Enable VPC endpoints for private cloud service access"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags/labels to apply to resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# AWS-Specific Configuration
# -----------------------------------------------------------------------------

variable "aws_config" {
  description = "AWS-specific configuration"
  type = object({
    region                = optional(string, "us-east-1")
    cloudwatch_kms_key_id = optional(string)
  })
  default = {}
}

# -----------------------------------------------------------------------------
# GCP-Specific Configuration
# -----------------------------------------------------------------------------

variable "gcp_config" {
  description = "GCP-specific configuration"
  type = object({
    project_id                    = string
    region                        = optional(string, "us-central1")
    regions                       = optional(list(string))
    vpc_octet                     = optional(number, 0)
    routing_mode                  = optional(string, "GLOBAL")
    delete_default_routes         = optional(bool, false)
    mtu                           = optional(number, 1460)
    create_gke_subnets            = optional(bool, true)
    gke_subnet_cidrs              = optional(list(string), [])
    flow_log_interval             = optional(string, "INTERVAL_5_SEC")
    flow_log_sampling             = optional(number, 0.5)
    router_asn                    = optional(number, 64514)
    nat_ip_allocate_option        = optional(string, "AUTO_ONLY")
    nat_logging_enabled           = optional(bool, true)
    enable_private_service_access = optional(bool, true)
    enable_iap_ssh                = optional(bool, true)
    create_egress_rules           = optional(bool, true)
    gke_master_cidr_blocks        = optional(list(string), ["172.16.0.0/28"])
    create_serverless_connector   = optional(bool, false)
    enable_shared_vpc             = optional(bool, false)
    shared_vpc_service_projects   = optional(list(string), [])
    create_dns_policy             = optional(bool, false)
  })
  default = {
    project_id = ""
  }
}

# -----------------------------------------------------------------------------
# Azure-Specific Configuration (Placeholder)
# -----------------------------------------------------------------------------

variable "azure_config" {
  description = "Azure-specific configuration"
  type = object({
    resource_group_name = optional(string)
    location            = optional(string, "eastus")
    # TODO: Add more Azure-specific variables
  })
  default = {}
}
