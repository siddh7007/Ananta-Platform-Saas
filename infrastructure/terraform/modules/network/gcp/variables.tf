# =============================================================================
# GCP Network Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Required Variables
# -----------------------------------------------------------------------------

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "regions" {
  description = "List of GCP regions to deploy to"
  type        = list(string)
}

# -----------------------------------------------------------------------------
# VPC Configuration
# -----------------------------------------------------------------------------

variable "vpc_octet" {
  description = "Second octet for VPC CIDR (10.X.0.0/16)"
  type        = number
  default     = 0
}

variable "routing_mode" {
  description = "VPC routing mode (REGIONAL or GLOBAL)"
  type        = string
  default     = "GLOBAL"

  validation {
    condition     = contains(["REGIONAL", "GLOBAL"], var.routing_mode)
    error_message = "Routing mode must be REGIONAL or GLOBAL."
  }
}

variable "delete_default_routes" {
  description = "Delete default routes on VPC creation"
  type        = bool
  default     = false
}

variable "mtu" {
  description = "VPC MTU (1460 or 1500)"
  type        = number
  default     = 1460

  validation {
    condition     = contains([1460, 1500], var.mtu)
    error_message = "MTU must be 1460 or 1500."
  }
}

# -----------------------------------------------------------------------------
# Subnet Configuration
# -----------------------------------------------------------------------------

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per region)"
  type        = list(string)
  default     = []
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per region)"
  type        = list(string)
  default     = []
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets (one per region)"
  type        = list(string)
  default     = []
}

variable "gke_subnet_cidrs" {
  description = "CIDR blocks for GKE subnets (one per region)"
  type        = list(string)
  default     = []
}

variable "create_gke_subnets" {
  description = "Create GKE-specific subnets with secondary ranges"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Flow Logs Configuration
# -----------------------------------------------------------------------------

variable "flow_log_interval" {
  description = "Aggregation interval for flow logs"
  type        = string
  default     = "INTERVAL_5_SEC"

  validation {
    condition = contains([
      "INTERVAL_5_SEC",
      "INTERVAL_30_SEC",
      "INTERVAL_1_MIN",
      "INTERVAL_5_MIN",
      "INTERVAL_10_MIN",
      "INTERVAL_15_MIN"
    ], var.flow_log_interval)
    error_message = "Invalid flow log interval."
  }
}

variable "flow_log_sampling" {
  description = "Flow log sampling rate (0.0 to 1.0)"
  type        = number
  default     = 0.5

  validation {
    condition     = var.flow_log_sampling >= 0 && var.flow_log_sampling <= 1
    error_message = "Flow log sampling must be between 0 and 1."
  }
}

variable "create_flow_log_sink" {
  description = "Create a logging sink for flow logs"
  type        = bool
  default     = false
}

variable "flow_log_sink_destination" {
  description = "Destination for flow log sink (storage bucket or BigQuery)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# NAT Configuration
# -----------------------------------------------------------------------------

variable "enable_nat_gateway" {
  description = "Enable Cloud NAT for private subnets"
  type        = bool
  default     = true
}

variable "router_asn" {
  description = "Base ASN for Cloud Routers (incremented per region)"
  type        = number
  default     = 64514
}

variable "nat_ip_allocate_option" {
  description = "NAT IP allocation option"
  type        = string
  default     = "AUTO_ONLY"

  validation {
    condition     = contains(["AUTO_ONLY", "MANUAL_ONLY"], var.nat_ip_allocate_option)
    error_message = "NAT IP allocate option must be AUTO_ONLY or MANUAL_ONLY."
  }
}

variable "nat_source_subnetwork_ip_ranges_to_nat" {
  description = "Source subnetwork IP ranges to NAT"
  type        = string
  default     = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  validation {
    condition = contains([
      "ALL_SUBNETWORKS_ALL_IP_RANGES",
      "ALL_SUBNETWORKS_ALL_PRIMARY_IP_RANGES",
      "LIST_OF_SUBNETWORKS"
    ], var.nat_source_subnetwork_ip_ranges_to_nat)
    error_message = "Invalid NAT source subnetwork IP ranges option."
  }
}

variable "nat_logging_enabled" {
  description = "Enable NAT logging"
  type        = bool
  default     = true
}

variable "nat_log_filter" {
  description = "NAT log filter (ERRORS_ONLY, TRANSLATIONS_ONLY, ALL)"
  type        = string
  default     = "ERRORS_ONLY"

  validation {
    condition     = contains(["ERRORS_ONLY", "TRANSLATIONS_ONLY", "ALL"], var.nat_log_filter)
    error_message = "NAT log filter must be ERRORS_ONLY, TRANSLATIONS_ONLY, or ALL."
  }
}

variable "nat_min_ports_per_vm" {
  description = "Minimum number of ports per VM for NAT"
  type        = number
  default     = 64
}

variable "nat_max_ports_per_vm" {
  description = "Maximum number of ports per VM for NAT (null for unlimited)"
  type        = number
  default     = null
}

variable "nat_endpoint_independent_mapping" {
  description = "Enable endpoint independent mapping for NAT"
  type        = bool
  default     = false
}

variable "nat_tcp_established_idle_timeout" {
  description = "TCP established idle timeout in seconds"
  type        = number
  default     = 1200
}

variable "nat_tcp_transitory_idle_timeout" {
  description = "TCP transitory idle timeout in seconds"
  type        = number
  default     = 30
}

variable "nat_udp_idle_timeout" {
  description = "UDP idle timeout in seconds"
  type        = number
  default     = 30
}

# -----------------------------------------------------------------------------
# Private Service Access
# -----------------------------------------------------------------------------

variable "enable_private_service_access" {
  description = "Enable private service access for Cloud SQL, etc."
  type        = bool
  default     = true
}

variable "private_service_range_prefix" {
  description = "Prefix length for private service access IP range"
  type        = number
  default     = 16
}

# -----------------------------------------------------------------------------
# Firewall Configuration
# -----------------------------------------------------------------------------

variable "enable_iap_ssh" {
  description = "Enable SSH access via Identity-Aware Proxy"
  type        = bool
  default     = true
}

variable "create_egress_rules" {
  description = "Create default egress firewall rules"
  type        = bool
  default     = true
}

variable "gke_master_cidr_blocks" {
  description = "CIDR blocks for GKE master nodes"
  type        = list(string)
  default     = ["172.16.0.0/28"]
}

# -----------------------------------------------------------------------------
# Serverless VPC Connector
# -----------------------------------------------------------------------------

variable "create_serverless_connector" {
  description = "Create VPC Access Connector for serverless services"
  type        = bool
  default     = false
}

variable "serverless_connector_min_instances" {
  description = "Minimum instances for serverless connector"
  type        = number
  default     = 2
}

variable "serverless_connector_max_instances" {
  description = "Maximum instances for serverless connector"
  type        = number
  default     = 10
}

variable "serverless_connector_machine_type" {
  description = "Machine type for serverless connector"
  type        = string
  default     = "e2-micro"
}

# -----------------------------------------------------------------------------
# Shared VPC Configuration
# -----------------------------------------------------------------------------

variable "enable_shared_vpc" {
  description = "Enable Shared VPC (this project becomes host)"
  type        = bool
  default     = false
}

variable "shared_vpc_service_projects" {
  description = "List of service project IDs for Shared VPC"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# DNS Configuration
# -----------------------------------------------------------------------------

variable "create_dns_policy" {
  description = "Create a DNS policy for the VPC"
  type        = bool
  default     = false
}

variable "dns_enable_inbound_forwarding" {
  description = "Enable inbound DNS forwarding"
  type        = bool
  default     = false
}

variable "dns_enable_logging" {
  description = "Enable DNS query logging"
  type        = bool
  default     = true
}

variable "dns_alternative_name_servers" {
  description = "Alternative name servers for DNS policy"
  type = list(object({
    ipv4_address    = string
    forwarding_path = string
  }))
  default = []
}

# -----------------------------------------------------------------------------
# Labels
# -----------------------------------------------------------------------------

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}
