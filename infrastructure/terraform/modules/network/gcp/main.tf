# =============================================================================
# GCP Network Module - VPC, Subnets, NAT, and Firewall Rules
# =============================================================================
# This module deploys networking infrastructure on Google Cloud Platform
# with VPC, subnets, Cloud NAT, Cloud Router, and firewall rules.
# =============================================================================

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = ">= 5.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  resource_prefix = "${var.name_prefix}-${var.environment}"

  # Common labels
  labels = merge(
    {
      environment = var.environment
      managed-by  = "terraform"
      module      = "network"
    },
    var.labels
  )

  # Calculate subnet ranges if auto-generate is enabled
  # Base: 10.x.0.0/16 where x is configurable
  vpc_octet = var.vpc_octet

  # Auto-generate subnet CIDRs based on region index
  auto_public_cidrs   = [for i, r in var.regions : "10.${local.vpc_octet}.${i * 16}.0/20"]
  auto_private_cidrs  = [for i, r in var.regions : "10.${local.vpc_octet}.${i * 16 + 4}.0/22"]
  auto_database_cidrs = [for i, r in var.regions : "10.${local.vpc_octet}.${i * 16 + 8}.0/24"]
  auto_gke_cidrs      = [for i, r in var.regions : "10.${local.vpc_octet}.${i * 16 + 9}.0/24"]

  # Use provided CIDRs or auto-generated
  public_cidrs   = length(var.public_subnet_cidrs) > 0 ? var.public_subnet_cidrs : local.auto_public_cidrs
  private_cidrs  = length(var.private_subnet_cidrs) > 0 ? var.private_subnet_cidrs : local.auto_private_cidrs
  database_cidrs = length(var.database_subnet_cidrs) > 0 ? var.database_subnet_cidrs : local.auto_database_cidrs
  gke_cidrs      = length(var.gke_subnet_cidrs) > 0 ? var.gke_subnet_cidrs : local.auto_gke_cidrs
}

# -----------------------------------------------------------------------------
# VPC Network
# -----------------------------------------------------------------------------

resource "google_compute_network" "main" {
  name                            = "${local.resource_prefix}-vpc"
  project                         = var.project_id
  auto_create_subnetworks         = false
  routing_mode                    = var.routing_mode
  delete_default_routes_on_create = var.delete_default_routes
  mtu                             = var.mtu

  description = "VPC for ${var.name_prefix} ${var.environment} environment"
}

# -----------------------------------------------------------------------------
# Public Subnets
# -----------------------------------------------------------------------------

resource "google_compute_subnetwork" "public" {
  count = length(var.regions)

  name          = "${local.resource_prefix}-public-${var.regions[count.index]}"
  project       = var.project_id
  region        = var.regions[count.index]
  network       = google_compute_network.main.id
  ip_cidr_range = local.public_cidrs[count.index]

  purpose                  = "PRIVATE"
  private_ip_google_access = true

  log_config {
    aggregation_interval = var.flow_log_interval
    flow_sampling        = var.flow_log_sampling
    metadata             = "INCLUDE_ALL_METADATA"
  }

  secondary_ip_range = []

  description = "Public subnet in ${var.regions[count.index]}"
}

# -----------------------------------------------------------------------------
# Private Subnets (for workloads)
# -----------------------------------------------------------------------------

resource "google_compute_subnetwork" "private" {
  count = length(var.regions)

  name          = "${local.resource_prefix}-private-${var.regions[count.index]}"
  project       = var.project_id
  region        = var.regions[count.index]
  network       = google_compute_network.main.id
  ip_cidr_range = local.private_cidrs[count.index]

  purpose                  = "PRIVATE"
  private_ip_google_access = true

  log_config {
    aggregation_interval = var.flow_log_interval
    flow_sampling        = var.flow_log_sampling
    metadata             = "INCLUDE_ALL_METADATA"
  }

  description = "Private subnet in ${var.regions[count.index]}"
}

# -----------------------------------------------------------------------------
# Database Subnets (isolated for DB workloads)
# -----------------------------------------------------------------------------

resource "google_compute_subnetwork" "database" {
  count = length(var.regions)

  name          = "${local.resource_prefix}-database-${var.regions[count.index]}"
  project       = var.project_id
  region        = var.regions[count.index]
  network       = google_compute_network.main.id
  ip_cidr_range = local.database_cidrs[count.index]

  purpose                  = "PRIVATE"
  private_ip_google_access = true

  log_config {
    aggregation_interval = var.flow_log_interval
    flow_sampling        = var.flow_log_sampling
    metadata             = "INCLUDE_ALL_METADATA"
  }

  description = "Database subnet in ${var.regions[count.index]}"
}

# -----------------------------------------------------------------------------
# GKE Subnets (with secondary ranges for pods/services)
# -----------------------------------------------------------------------------

resource "google_compute_subnetwork" "gke" {
  count = var.create_gke_subnets ? length(var.regions) : 0

  name          = "${local.resource_prefix}-gke-${var.regions[count.index]}"
  project       = var.project_id
  region        = var.regions[count.index]
  network       = google_compute_network.main.id
  ip_cidr_range = local.gke_cidrs[count.index]

  purpose                  = "PRIVATE"
  private_ip_google_access = true

  # Secondary ranges for GKE pods and services
  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.${local.vpc_octet + 100}.${count.index * 4}.0/22"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.${local.vpc_octet + 100}.${count.index * 4 + 128}.0/24"
  }

  log_config {
    aggregation_interval = var.flow_log_interval
    flow_sampling        = var.flow_log_sampling
    metadata             = "INCLUDE_ALL_METADATA"
  }

  description = "GKE subnet in ${var.regions[count.index]}"
}

# -----------------------------------------------------------------------------
# Cloud Router (for Cloud NAT)
# -----------------------------------------------------------------------------

resource "google_compute_router" "main" {
  count = var.enable_nat_gateway ? length(var.regions) : 0

  name    = "${local.resource_prefix}-router-${var.regions[count.index]}"
  project = var.project_id
  region  = var.regions[count.index]
  network = google_compute_network.main.id

  bgp {
    asn               = var.router_asn + count.index
    advertise_mode    = "CUSTOM"
    advertised_groups = ["ALL_SUBNETS"]
  }

  description = "Cloud Router for NAT in ${var.regions[count.index]}"
}

# -----------------------------------------------------------------------------
# Cloud NAT
# -----------------------------------------------------------------------------

resource "google_compute_router_nat" "main" {
  count = var.enable_nat_gateway ? length(var.regions) : 0

  name                               = "${local.resource_prefix}-nat-${var.regions[count.index]}"
  project                            = var.project_id
  region                             = var.regions[count.index]
  router                             = google_compute_router.main[count.index].name
  nat_ip_allocate_option             = var.nat_ip_allocate_option
  source_subnetwork_ip_ranges_to_nat = var.nat_source_subnetwork_ip_ranges_to_nat

  # If using specific IPs instead of auto-allocation
  dynamic "subnetwork" {
    for_each = var.nat_source_subnetwork_ip_ranges_to_nat == "LIST_OF_SUBNETWORKS" ? [1] : []
    content {
      name                    = google_compute_subnetwork.private[count.index].id
      source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
    }
  }

  dynamic "subnetwork" {
    for_each = var.nat_source_subnetwork_ip_ranges_to_nat == "LIST_OF_SUBNETWORKS" && var.create_gke_subnets ? [1] : []
    content {
      name                    = google_compute_subnetwork.gke[count.index].id
      source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
    }
  }

  # Logging
  log_config {
    enable = var.nat_logging_enabled
    filter = var.nat_log_filter
  }

  # Timeouts
  min_ports_per_vm                    = var.nat_min_ports_per_vm
  max_ports_per_vm                    = var.nat_max_ports_per_vm
  enable_endpoint_independent_mapping = var.nat_endpoint_independent_mapping

  tcp_established_idle_timeout_sec = var.nat_tcp_established_idle_timeout
  tcp_transitory_idle_timeout_sec  = var.nat_tcp_transitory_idle_timeout
  udp_idle_timeout_sec             = var.nat_udp_idle_timeout
}

# -----------------------------------------------------------------------------
# Private Service Access (for Cloud SQL, Memorystore, etc.)
# -----------------------------------------------------------------------------

resource "google_compute_global_address" "private_service_range" {
  count = var.enable_private_service_access ? 1 : 0

  name          = "${local.resource_prefix}-private-service-range"
  project       = var.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = var.private_service_range_prefix
  network       = google_compute_network.main.id

  description = "Private service access IP range"
}

resource "google_service_networking_connection" "private_service_connection" {
  count = var.enable_private_service_access ? 1 : 0

  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_service_range[0].name]
}

# -----------------------------------------------------------------------------
# Firewall Rules - Ingress
# -----------------------------------------------------------------------------

# Allow internal traffic within VPC
resource "google_compute_firewall" "allow_internal" {
  name    = "${local.resource_prefix}-allow-internal"
  project = var.project_id
  network = google_compute_network.main.id

  direction = "INGRESS"
  priority  = 1000

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = concat(
    local.public_cidrs,
    local.private_cidrs,
    local.database_cidrs,
    var.create_gke_subnets ? local.gke_cidrs : []
  )

  description = "Allow all internal traffic"
}

# Allow SSH from IAP (Identity-Aware Proxy)
resource "google_compute_firewall" "allow_iap_ssh" {
  count = var.enable_iap_ssh ? 1 : 0

  name    = "${local.resource_prefix}-allow-iap-ssh"
  project = var.project_id
  network = google_compute_network.main.id

  direction = "INGRESS"
  priority  = 1000

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  # IAP's IP range
  source_ranges = ["35.235.240.0/20"]

  target_tags = ["allow-ssh"]

  description = "Allow SSH via IAP"
}

# Allow HTTP/HTTPS from Load Balancers
resource "google_compute_firewall" "allow_lb_health_checks" {
  name    = "${local.resource_prefix}-allow-lb-health"
  project = var.project_id
  network = google_compute_network.main.id

  direction = "INGRESS"
  priority  = 1000

  allow {
    protocol = "tcp"
  }

  # Google Cloud Load Balancer health check ranges
  source_ranges = [
    "35.191.0.0/16",
    "130.211.0.0/22"
  ]

  target_tags = ["allow-health-check"]

  description = "Allow health checks from GCP load balancers"
}

# Allow GKE master to node communication
resource "google_compute_firewall" "allow_gke_master" {
  count = var.create_gke_subnets ? 1 : 0

  name    = "${local.resource_prefix}-allow-gke-master"
  project = var.project_id
  network = google_compute_network.main.id

  direction = "INGRESS"
  priority  = 1000

  allow {
    protocol = "tcp"
    ports    = ["443", "10250"]
  }

  # GKE master ranges (will be specific to your cluster)
  source_ranges = var.gke_master_cidr_blocks

  target_tags = ["gke-node"]

  description = "Allow GKE master to node communication"
}

# -----------------------------------------------------------------------------
# Firewall Rules - Egress
# -----------------------------------------------------------------------------

# Default allow all egress (can be made more restrictive)
resource "google_compute_firewall" "allow_egress" {
  count = var.create_egress_rules ? 1 : 0

  name    = "${local.resource_prefix}-allow-egress"
  project = var.project_id
  network = google_compute_network.main.id

  direction = "EGRESS"
  priority  = 1000

  allow {
    protocol = "all"
  }

  destination_ranges = ["0.0.0.0/0"]

  description = "Allow all egress traffic"
}

# -----------------------------------------------------------------------------
# VPC Access Connector (for Serverless)
# -----------------------------------------------------------------------------

resource "google_vpc_access_connector" "serverless" {
  count = var.create_serverless_connector ? length(var.regions) : 0

  name          = "${local.resource_prefix}-connector-${var.regions[count.index]}"
  project       = var.project_id
  region        = var.regions[count.index]
  network       = google_compute_network.main.id
  ip_cidr_range = "10.${local.vpc_octet}.${200 + count.index}.0/28"

  min_instances = var.serverless_connector_min_instances
  max_instances = var.serverless_connector_max_instances

  machine_type = var.serverless_connector_machine_type
}

# -----------------------------------------------------------------------------
# VPC Flow Logs Export (to Cloud Logging)
# -----------------------------------------------------------------------------

# Flow logs are enabled per-subnet via log_config block above.
# Optional: Create a log sink for long-term storage or SIEM integration

resource "google_logging_project_sink" "vpc_flow_logs" {
  count = var.create_flow_log_sink ? 1 : 0

  name                   = "${local.resource_prefix}-vpc-flow-logs-sink"
  project                = var.project_id
  destination            = var.flow_log_sink_destination
  filter                 = "resource.type=\"gce_subnetwork\" AND log_id(\"compute.googleapis.com/vpc_flows\")"
  unique_writer_identity = true

  description = "Export VPC flow logs to ${var.flow_log_sink_destination}"
}

# -----------------------------------------------------------------------------
# Shared VPC (Optional)
# -----------------------------------------------------------------------------

resource "google_compute_shared_vpc_host_project" "host" {
  count   = var.enable_shared_vpc ? 1 : 0
  project = var.project_id
}

resource "google_compute_shared_vpc_service_project" "service" {
  for_each = var.enable_shared_vpc ? toset(var.shared_vpc_service_projects) : toset([])

  host_project    = var.project_id
  service_project = each.value

  depends_on = [google_compute_shared_vpc_host_project.host]
}

# -----------------------------------------------------------------------------
# DNS Policy (for Private DNS)
# -----------------------------------------------------------------------------

resource "google_dns_policy" "main" {
  count = var.create_dns_policy ? 1 : 0

  name                      = "${local.resource_prefix}-dns-policy"
  project                   = var.project_id
  enable_inbound_forwarding = var.dns_enable_inbound_forwarding
  enable_logging            = var.dns_enable_logging

  networks {
    network_url = google_compute_network.main.id
  }

  dynamic "alternative_name_server_config" {
    for_each = length(var.dns_alternative_name_servers) > 0 ? [1] : []
    content {
      dynamic "target_name_servers" {
        for_each = var.dns_alternative_name_servers
        content {
          ipv4_address    = target_name_servers.value.ipv4_address
          forwarding_path = target_name_servers.value.forwarding_path
        }
      }
    }
  }

  description = "DNS policy for ${local.resource_prefix}"
}
