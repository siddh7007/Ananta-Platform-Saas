# =============================================================================
# Cloud-Agnostic Cache Module
# =============================================================================
# Provider-agnostic cache module that supports:
# - AWS ElastiCache for Redis
# - Azure Cache for Redis
# - Google Cloud Memorystore for Redis
# - Kubernetes Redis (via Operator or StatefulSet)
#
# Usage:
#   module "cache" {
#     source         = "./modules/cache"
#     cloud_provider = "aws"  # or "azure", "gcp", "kubernetes"
#     # ... common variables
#     aws_config = { ... }  # Only needed when cloud_provider = "aws"
#   }
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  # Determine effective provider (support legacy AWS-only usage)
  effective_provider = var.cloud_provider != "" ? var.cloud_provider : "aws"

  # Map legacy AWS variables to normalized interface for backward compatibility
  normalized_instance_size = var.instance_size != "" ? var.instance_size : (
    can(regex("micro", var.node_type)) ? "micro" :
    can(regex("small", var.node_type)) ? "small" :
    can(regex("medium", var.node_type)) ? "medium" :
    can(regex("large", var.node_type)) ? "large" :
    can(regex("xlarge", var.node_type)) ? "xlarge" : "small"
  )

  # Normalize high availability setting
  normalized_high_availability = var.high_availability != null ? var.high_availability : var.automatic_failover_enabled
}

# -----------------------------------------------------------------------------
# AWS Provider Module
# -----------------------------------------------------------------------------

module "aws" {
  source = "./aws"
  count  = local.effective_provider == "aws" ? 1 : 0

  # Common interface variables
  name_prefix       = var.name_prefix
  environment       = var.environment
  instance_size     = local.normalized_instance_size
  engine_version    = var.engine_version
  high_availability = local.normalized_high_availability
  replica_count     = var.replica_count
  tags              = var.tags

  # AWS-specific variables (from aws_config or legacy variables)
  vpc_id                    = coalesce(try(var.aws_config.vpc_id, null), var.vpc_id)
  subnet_ids                = coalesce(try(var.aws_config.subnet_ids, null), var.subnet_ids, [])
  security_group_id         = coalesce(try(var.aws_config.security_group_id, null), var.security_group_id, "")
  create_security_group     = try(var.aws_config.create_security_group, var.security_group_id == "" || var.security_group_id == null)
  allowed_security_groups   = coalesce(try(var.aws_config.allowed_security_groups, null), var.allowed_security_groups, [])
  maxmemory_policy          = coalesce(try(var.aws_config.maxmemory_policy, null), var.maxmemory_policy, "volatile-lru")
  timeout_seconds           = try(var.aws_config.timeout_seconds, 0)
  notify_keyspace_events    = try(var.aws_config.notify_keyspace_events, "")
  encryption_at_rest        = coalesce(try(var.aws_config.encryption_at_rest, null), var.at_rest_encryption_enabled, true)
  encryption_in_transit     = coalesce(try(var.aws_config.encryption_in_transit, null), var.transit_encryption_enabled, true)
  auth_token                = coalesce(try(var.aws_config.auth_token, null), var.auth_token)
  maintenance_window        = coalesce(try(var.aws_config.maintenance_window, null), var.maintenance_window, "sun:05:00-sun:06:00")
  snapshot_window           = coalesce(try(var.aws_config.snapshot_window, null), var.snapshot_window, "03:00-04:00")
  snapshot_retention_days   = coalesce(try(var.aws_config.snapshot_retention_days, null), var.snapshot_retention_limit, 7)
  sns_topic_arn             = try(var.aws_config.sns_topic_arn, null)
  create_alarms             = try(var.aws_config.create_alarms, true)
  alarm_actions             = coalesce(try(var.aws_config.alarm_actions, null), var.alarm_actions, [])
  evictions_alarm_threshold = try(var.aws_config.evictions_alarm_threshold, 100)
}

# -----------------------------------------------------------------------------
# Azure Provider Module
# -----------------------------------------------------------------------------

module "azure" {
  source = "./azure"
  count  = local.effective_provider == "azure" ? 1 : 0

  # Common interface variables
  name_prefix       = var.name_prefix
  environment       = var.environment
  instance_size     = local.normalized_instance_size
  engine_version    = var.engine_version
  high_availability = local.normalized_high_availability
  replica_count     = var.replica_count
  tags              = var.tags

  # Azure-specific variables
  resource_group_name              = try(var.azure_config.resource_group_name, "")
  create_resource_group            = try(var.azure_config.create_resource_group, false)
  location                         = try(var.azure_config.location, "eastus")
  public_network_access            = try(var.azure_config.public_network_access, false)
  subnet_id                        = try(var.azure_config.subnet_id, null)
  enable_private_endpoint          = try(var.azure_config.enable_private_endpoint, false)
  private_endpoint_subnet_id       = try(var.azure_config.private_endpoint_subnet_id, null)
  private_dns_zone_id              = try(var.azure_config.private_dns_zone_id, null)
  allowed_ip_ranges                = try(var.azure_config.allowed_ip_ranges, [])
  maxmemory_policy                 = coalesce(try(var.azure_config.maxmemory_policy, null), var.maxmemory_policy, "volatile-lru")
  maxmemory_reserved_mb            = try(var.azure_config.maxmemory_reserved_mb, 50)
  maxfragmentationmemory_reserved_mb = try(var.azure_config.maxfragmentationmemory_reserved_mb, 50)
  notify_keyspace_events           = try(var.azure_config.notify_keyspace_events, "")
  encryption_in_transit            = try(var.azure_config.encryption_in_transit, true)
  shard_count                      = try(var.azure_config.shard_count, 1)
  availability_zones               = try(var.azure_config.availability_zones, ["1", "2", "3"])
  enable_aof_backup                = try(var.azure_config.enable_aof_backup, false)
  enable_rdb_backup                = try(var.azure_config.enable_rdb_backup, false)
  rdb_backup_frequency             = try(var.azure_config.rdb_backup_frequency, 60)
  rdb_backup_max_snapshot_count    = try(var.azure_config.rdb_backup_max_snapshot_count, 1)
  backup_storage_connection_string = try(var.azure_config.backup_storage_connection_string, null)
  log_analytics_workspace_id       = try(var.azure_config.log_analytics_workspace_id, null)
  create_alerts                    = try(var.azure_config.create_alerts, true)
  alert_action_group_ids           = try(var.azure_config.alert_action_group_ids, [])
  cache_miss_rate_threshold        = try(var.azure_config.cache_miss_rate_threshold, 50)
}

# -----------------------------------------------------------------------------
# GCP Provider Module
# -----------------------------------------------------------------------------

module "gcp" {
  source = "./gcp"
  count  = local.effective_provider == "gcp" ? 1 : 0

  # Common interface variables
  name_prefix       = var.name_prefix
  environment       = var.environment
  instance_size     = local.normalized_instance_size
  engine_version    = var.engine_version
  high_availability = local.normalized_high_availability
  replica_count     = var.replica_count
  tags              = var.tags

  # GCP-specific variables
  project_id             = try(var.gcp_config.project_id, "")
  region                 = try(var.gcp_config.region, "us-central1")
  labels                 = try(var.gcp_config.labels, {})
  vpc_network_id         = try(var.gcp_config.vpc_network_id, "")
  connect_mode           = try(var.gcp_config.connect_mode, "PRIVATE_SERVICE_ACCESS")
  reserved_ip_range      = try(var.gcp_config.reserved_ip_range, null)
  maxmemory_policy       = coalesce(try(var.gcp_config.maxmemory_policy, null), var.maxmemory_policy, "volatile-lru")
  notify_keyspace_events = try(var.gcp_config.notify_keyspace_events, "")
  redis_configs          = try(var.gcp_config.redis_configs, {})
  auth_enabled           = try(var.gcp_config.auth_enabled, true)
  encryption_in_transit  = try(var.gcp_config.encryption_in_transit, true)
  create_secret          = try(var.gcp_config.create_secret, true)
  enable_persistence     = try(var.gcp_config.enable_persistence, false)
  rdb_snapshot_period    = try(var.gcp_config.rdb_snapshot_period, "TWENTY_FOUR_HOURS")
  maintenance_window     = try(var.gcp_config.maintenance_window, null)
  create_alerts          = try(var.gcp_config.create_alerts, true)
  notification_channels  = try(var.gcp_config.notification_channels, [])
  evictions_threshold    = try(var.gcp_config.evictions_threshold, 100)
}

# -----------------------------------------------------------------------------
# Kubernetes Provider Module
# -----------------------------------------------------------------------------

module "kubernetes" {
  source = "./kubernetes"
  count  = local.effective_provider == "kubernetes" ? 1 : 0

  # Common interface variables
  name_prefix       = var.name_prefix
  environment       = var.environment
  instance_size     = local.normalized_instance_size
  engine_version    = var.engine_version
  high_availability = local.normalized_high_availability
  replica_count     = var.replica_count
  tags              = var.tags

  # Kubernetes-specific variables
  namespace              = try(var.kubernetes_config.namespace, "redis")
  create_namespace       = try(var.kubernetes_config.create_namespace, true)
  labels                 = try(var.kubernetes_config.labels, {})
  install_operator       = try(var.kubernetes_config.install_operator, true)
  operator_version       = try(var.kubernetes_config.operator_version, "3.2.9")
  operator_namespace     = try(var.kubernetes_config.operator_namespace, "redis-operator")
  redis_image            = try(var.kubernetes_config.redis_image, "redis:7.0-alpine")
  maxmemory_policy       = coalesce(try(var.kubernetes_config.maxmemory_policy, null), var.maxmemory_policy, "volatile-lru")
  notify_keyspace_events = try(var.kubernetes_config.notify_keyspace_events, "")
  timeout_seconds        = try(var.kubernetes_config.timeout_seconds, 0)
  redis_custom_config    = try(var.kubernetes_config.redis_custom_config, [])
  sentinel_config        = try(var.kubernetes_config.sentinel_config, [])
  persistence_enabled    = try(var.kubernetes_config.persistence_enabled, true)
  storage_class          = try(var.kubernetes_config.storage_class, "standard")
  storage_gb             = try(var.kubernetes_config.storage_gb, 10)
  service_type           = try(var.kubernetes_config.service_type, "ClusterIP")
  service_annotations    = try(var.kubernetes_config.service_annotations, {})
  enable_monitoring      = try(var.kubernetes_config.enable_monitoring, true)
  exporter_image         = try(var.kubernetes_config.exporter_image, "oliver006/redis_exporter:v1.55.0")
  create_service_monitor = try(var.kubernetes_config.create_service_monitor, true)
  create_prometheus_rules = try(var.kubernetes_config.create_prometheus_rules, true)
  evictions_threshold    = try(var.kubernetes_config.evictions_threshold, 100)
}
