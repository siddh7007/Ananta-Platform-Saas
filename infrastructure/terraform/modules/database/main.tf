# =============================================================================
# Cloud-Agnostic Database Module
# =============================================================================
# Provider-agnostic database module that supports:
# - AWS RDS PostgreSQL
# - Azure Database for PostgreSQL Flexible Server
# - Google Cloud SQL for PostgreSQL
# - Kubernetes CloudNativePG Operator
#
# Usage:
#   module "database" {
#     source         = "./modules/database"
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
    can(regex("micro", var.instance_class)) ? "micro" :
    can(regex("small", var.instance_class)) ? "small" :
    can(regex("medium", var.instance_class)) ? "medium" :
    can(regex("large", var.instance_class)) ? "large" :
    can(regex("xlarge", var.instance_class)) ? "xlarge" : "small"
  )

  normalized_storage_gb = var.storage_gb > 0 ? var.storage_gb : var.allocated_storage

  # Determine high availability from various provider-specific flags
  normalized_high_availability = var.high_availability != null ? var.high_availability : var.multi_az
}

# -----------------------------------------------------------------------------
# AWS Provider Module
# -----------------------------------------------------------------------------

module "aws" {
  source = "./aws"
  count  = local.effective_provider == "aws" ? 1 : 0

  # Common interface variables
  name_prefix           = var.name_prefix
  environment           = var.environment
  database_name         = var.database_name
  instance_size         = local.normalized_instance_size
  storage_gb            = local.normalized_storage_gb
  engine_version        = var.engine_version
  high_availability     = local.normalized_high_availability
  backup_retention_days = var.backup_retention_days
  replica_count         = var.replica_count
  tags                  = var.tags

  # AWS-specific variables (from aws_config or legacy variables)
  vpc_id                     = coalesce(try(var.aws_config.vpc_id, null), var.vpc_id)
  subnet_ids                 = coalesce(try(var.aws_config.subnet_ids, null), var.database_subnet_ids, [])
  security_group_id          = coalesce(try(var.aws_config.security_group_id, null), var.security_group_id, "")
  create_security_group      = try(var.aws_config.create_security_group, var.security_group_id == "" || var.security_group_id == null)
  allowed_security_groups    = try(var.aws_config.allowed_security_groups, [])
  publicly_accessible        = try(var.aws_config.publicly_accessible, false)
  max_storage_gb             = coalesce(try(var.aws_config.max_storage_gb, null), var.max_allocated_storage, 100)
  encryption_enabled         = try(var.aws_config.encryption_enabled, true)
  kms_key_id                 = coalesce(try(var.aws_config.kms_key_id, null), var.kms_key_id)
  deletion_protection        = coalesce(try(var.aws_config.deletion_protection, null), var.deletion_protection, true)
  create_read_replica        = coalesce(try(var.aws_config.create_read_replica, null), var.create_read_replica, false)
  enable_connection_pooling  = coalesce(try(var.aws_config.enable_connection_pooling, null), var.create_rds_proxy, false)
  credentials_secret_arn     = coalesce(try(var.aws_config.credentials_secret_arn, null), var.db_credentials_secret_arn)
  max_connections_percent    = try(var.aws_config.max_connections_percent, var.proxy_max_connections_percent, 100)
  enable_performance_insights = coalesce(try(var.aws_config.enable_performance_insights, null), var.performance_insights_enabled, true)
  enable_enhanced_monitoring  = try(var.aws_config.enable_enhanced_monitoring, var.monitoring_interval > 0)
  monitoring_interval_seconds = coalesce(try(var.aws_config.monitoring_interval_seconds, null), var.monitoring_interval, 60)
  alarm_sns_topic_arns       = coalesce(try(var.aws_config.alarm_sns_topic_arns, null), var.alarm_sns_topic_arns, [])
  aws_region                 = coalesce(try(var.aws_config.aws_region, null), var.aws_region, "us-east-1")
}

# -----------------------------------------------------------------------------
# Azure Provider Module
# -----------------------------------------------------------------------------

module "azure" {
  source = "./azure"
  count  = local.effective_provider == "azure" ? 1 : 0

  # Common interface variables
  name_prefix           = var.name_prefix
  environment           = var.environment
  database_name         = var.database_name
  instance_size         = local.normalized_instance_size
  storage_gb            = local.normalized_storage_gb
  engine_version        = var.engine_version
  high_availability     = local.normalized_high_availability
  backup_retention_days = var.backup_retention_days
  replica_count         = var.replica_count
  tags                  = var.tags

  # Azure-specific variables
  resource_group_name        = try(var.azure_config.resource_group_name, "")
  location                   = try(var.azure_config.location, "eastus")
  create_resource_group      = try(var.azure_config.create_resource_group, false)
  delegated_subnet_id        = try(var.azure_config.delegated_subnet_id, null)
  private_dns_zone_id        = try(var.azure_config.private_dns_zone_id, null)
  geo_redundant_backup       = try(var.azure_config.geo_redundant_backup, false)
  maintenance_window         = try(var.azure_config.maintenance_window, null)
  enable_threat_detection    = try(var.azure_config.enable_threat_detection, true)
  log_analytics_workspace_id = try(var.azure_config.log_analytics_workspace_id, null)
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
  database_name         = var.database_name
  instance_size         = local.normalized_instance_size
  storage_gb            = local.normalized_storage_gb
  engine_version        = var.engine_version
  high_availability     = local.normalized_high_availability
  backup_retention_days = var.backup_retention_days
  replica_count         = var.replica_count
  tags                  = var.tags

  # GCP-specific variables
  project_id                = try(var.gcp_config.project_id, "")
  region                    = try(var.gcp_config.region, "us-central1")
  zone                      = try(var.gcp_config.zone, null)
  vpc_network_id            = try(var.gcp_config.vpc_network_id, null)
  private_network           = try(var.gcp_config.private_network, null)
  disk_type                 = try(var.gcp_config.disk_type, "PD_SSD")
  authorized_networks       = try(var.gcp_config.authorized_networks, [])
  deletion_protection       = coalesce(try(var.gcp_config.deletion_protection, null), var.deletion_protection, true)
  create_secret             = try(var.gcp_config.create_secret, true)
  query_insights_enabled    = try(var.gcp_config.query_insights_enabled, true)
  notification_channels     = try(var.gcp_config.notification_channels, [])
  labels                    = try(var.gcp_config.labels, {})
}

# -----------------------------------------------------------------------------
# Kubernetes Provider Module (CloudNativePG)
# -----------------------------------------------------------------------------

module "kubernetes" {
  source = "./kubernetes"
  count  = local.effective_provider == "kubernetes" ? 1 : 0

  # Common interface variables
  name_prefix           = var.name_prefix
  environment           = var.environment
  database_name         = var.database_name
  instance_size         = local.normalized_instance_size
  storage_gb            = local.normalized_storage_gb
  engine_version        = var.engine_version
  high_availability     = local.normalized_high_availability
  backup_retention_days = var.backup_retention_days
  replica_count         = var.replica_count
  tags                  = var.tags

  # Kubernetes-specific variables
  namespace                = try(var.kubernetes_config.namespace, "database")
  create_namespace         = try(var.kubernetes_config.create_namespace, true)
  storage_class            = try(var.kubernetes_config.storage_class, "standard")
  labels                   = try(var.kubernetes_config.labels, {})
  install_operator         = try(var.kubernetes_config.install_operator, true)
  operator_version         = try(var.kubernetes_config.operator_version, "0.19.1")
  operator_namespace       = try(var.kubernetes_config.operator_namespace, "cnpg-system")
  app_username             = try(var.kubernetes_config.app_username, "app")
  init_sql                 = try(var.kubernetes_config.init_sql, [])
  max_connections          = try(var.kubernetes_config.max_connections, 100)
  shared_buffers           = try(var.kubernetes_config.shared_buffers, "256MB")
  effective_cache_size     = try(var.kubernetes_config.effective_cache_size, "512MB")
  maintenance_work_mem     = try(var.kubernetes_config.maintenance_work_mem, "64MB")
  postgresql_parameters    = try(var.kubernetes_config.postgresql_parameters, {})
  pg_hba_rules             = try(var.kubernetes_config.pg_hba_rules, [])
  enable_backup            = try(var.kubernetes_config.enable_backup, false)
  backup_destination       = try(var.kubernetes_config.backup_destination, "")
  backup_s3_credentials    = try(var.kubernetes_config.backup_s3_credentials, null)
  create_pooler            = try(var.kubernetes_config.create_pooler, false)
  pooler_instances         = try(var.kubernetes_config.pooler_instances, 2)
  pooler_mode              = try(var.kubernetes_config.pooler_mode, "transaction")
  pooler_max_client_conn   = try(var.kubernetes_config.pooler_max_client_conn, 1000)
  pooler_default_pool_size = try(var.kubernetes_config.pooler_default_pool_size, 20)
  create_external_service  = try(var.kubernetes_config.create_external_service, false)
  service_type             = try(var.kubernetes_config.service_type, "ClusterIP")
  service_annotations      = try(var.kubernetes_config.service_annotations, {})
  enable_monitoring        = try(var.kubernetes_config.enable_monitoring, true)
  create_prometheus_rules  = try(var.kubernetes_config.create_prometheus_rules, true)
  enable_pod_antiaffinity  = try(var.kubernetes_config.enable_pod_antiaffinity, true)
  node_selector            = try(var.kubernetes_config.node_selector, {})
  tolerations              = try(var.kubernetes_config.tolerations, [])
}
