# =============================================================================
# Cloud-Agnostic Storage Module
# =============================================================================
# Provider-agnostic storage abstraction. Routes to appropriate cloud-specific
# implementation based on the selected provider.
#
# Supported providers:
#   - aws: Amazon S3
#   - azure: Azure Blob Storage
#   - gcp: Google Cloud Storage
#   - kubernetes: MinIO (S3-compatible)
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  # Determine effective provider (default to AWS for backward compatibility)
  effective_provider = var.cloud_provider != "" ? var.cloud_provider : "aws"

  # Normalize instance size from legacy variables if needed
  normalized_instance_size = var.instance_size != "" ? var.instance_size : "small"
}

# -----------------------------------------------------------------------------
# AWS S3 Module
# -----------------------------------------------------------------------------

module "aws" {
  source = "./aws"
  count  = local.effective_provider == "aws" ? 1 : 0

  # Common variables
  name_prefix        = var.name_prefix
  bucket_suffix      = var.bucket_suffix
  environment        = var.environment
  versioning_enabled = var.versioning_enabled
  public_access      = var.public_access
  tags               = var.tags

  # AWS-specific variables
  acl                         = var.aws_config.acl
  force_destroy               = var.aws_config.force_destroy
  kms_key_arn                 = var.aws_config.kms_key_arn
  cors_rules                  = var.aws_config.cors_rules
  lifecycle_rules             = var.aws_config.lifecycle_rules
  logging_bucket              = var.aws_config.logging_bucket
  logging_prefix              = var.aws_config.logging_prefix
  replication_role_arn        = var.aws_config.replication_role_arn
  replication_destination     = var.aws_config.replication_destination
  object_lock_enabled         = var.aws_config.object_lock_enabled
  object_lock_mode            = var.aws_config.object_lock_mode
  object_lock_days            = var.aws_config.object_lock_days
  intelligent_tiering_enabled = var.aws_config.intelligent_tiering_enabled
  notification_config         = var.aws_config.notification_config
}

# -----------------------------------------------------------------------------
# Azure Blob Storage Module
# -----------------------------------------------------------------------------

module "azure" {
  source = "./azure"
  count  = local.effective_provider == "azure" ? 1 : 0

  # Common variables
  name_prefix        = var.name_prefix
  bucket_suffix      = var.bucket_suffix
  environment        = var.environment
  versioning_enabled = var.versioning_enabled
  public_access      = var.public_access
  tags               = var.tags

  # Azure-specific variables
  resource_group_name         = var.azure_config.resource_group_name
  location                    = var.azure_config.location
  account_tier                = var.azure_config.account_tier
  replication_type            = var.azure_config.replication_type
  access_tier                 = var.azure_config.access_tier
  is_hns_enabled              = var.azure_config.is_hns_enabled
  min_tls_version             = var.azure_config.min_tls_version
  network_rules               = var.azure_config.network_rules
  key_vault_key_id            = var.azure_config.key_vault_key_id
  user_assigned_identity_id   = var.azure_config.user_assigned_identity_id
  lifecycle_rules             = var.azure_config.lifecycle_rules
  cors_rules                  = var.azure_config.cors_rules
  private_endpoint_subnet_id  = var.azure_config.private_endpoint_subnet_id
  private_dns_zone_ids        = var.azure_config.private_dns_zone_ids
  log_analytics_workspace_id  = var.azure_config.log_analytics_workspace_id
  immutable_storage_days      = var.azure_config.immutable_storage_days
}

# -----------------------------------------------------------------------------
# GCP Cloud Storage Module
# -----------------------------------------------------------------------------

module "gcp" {
  source = "./gcp"
  count  = local.effective_provider == "gcp" ? 1 : 0

  # Common variables
  name_prefix        = var.name_prefix
  bucket_suffix      = var.bucket_suffix
  environment        = var.environment
  versioning_enabled = var.versioning_enabled
  public_access      = var.public_access
  tags               = var.tags

  # GCP-specific variables
  project_id                  = var.gcp_config.project_id
  location                    = var.gcp_config.location
  storage_class               = var.gcp_config.storage_class
  labels                      = var.gcp_config.labels
  force_destroy               = var.gcp_config.force_destroy
  multi_regional              = var.gcp_config.multi_regional
  dual_region                 = var.gcp_config.dual_region
  uniform_bucket_level_access = var.gcp_config.uniform_bucket_level_access
  kms_key_name                = var.gcp_config.kms_key_name
  cors_rules                  = var.gcp_config.cors_rules
  lifecycle_rules             = var.gcp_config.lifecycle_rules
  logging_bucket              = var.gcp_config.logging_bucket
  logging_prefix              = var.gcp_config.logging_prefix
  retention_period_days       = var.gcp_config.retention_period_days
  retention_policy_locked     = var.gcp_config.retention_policy_locked
  soft_delete_retention_days  = var.gcp_config.soft_delete_retention_days
  website_config              = var.gcp_config.website_config
  iam_bindings                = var.gcp_config.iam_bindings
  default_object_acl          = var.gcp_config.default_object_acl
  notification_topic          = var.gcp_config.notification_topic
  notification_payload_format = var.gcp_config.notification_payload_format
  notification_event_types    = var.gcp_config.notification_event_types
  notification_object_prefix  = var.gcp_config.notification_object_prefix
  create_alerts               = var.gcp_config.create_alerts
  max_storage_bytes           = var.gcp_config.max_storage_bytes
  notification_channels       = var.gcp_config.notification_channels
}

# -----------------------------------------------------------------------------
# Kubernetes MinIO Module
# -----------------------------------------------------------------------------

module "kubernetes" {
  source = "./kubernetes"
  count  = local.effective_provider == "kubernetes" ? 1 : 0

  # Common variables
  name_prefix        = var.name_prefix
  bucket_suffix      = var.bucket_suffix
  environment        = var.environment
  instance_size      = local.normalized_instance_size
  versioning_enabled = var.versioning_enabled
  public_access      = var.public_access
  high_availability  = var.kubernetes_config.high_availability
  labels             = var.tags

  # Kubernetes-specific variables
  namespace                  = var.kubernetes_config.namespace
  create_namespace           = var.kubernetes_config.create_namespace
  use_operator               = var.kubernetes_config.use_operator
  service_account_name       = var.kubernetes_config.service_account_name
  minio_image                = var.kubernetes_config.minio_image
  minio_version              = var.kubernetes_config.minio_version
  access_key                 = var.kubernetes_config.access_key
  secret_key                 = var.kubernetes_config.secret_key
  minio_extra_env            = var.kubernetes_config.minio_extra_env
  storage_class_name         = var.kubernetes_config.storage_class_name
  storage_size               = var.kubernetes_config.storage_size
  tls_enabled                = var.kubernetes_config.tls_enabled
  tls_cert                   = var.kubernetes_config.tls_cert
  tls_key                    = var.kubernetes_config.tls_key
  service_type               = var.kubernetes_config.service_type
  service_annotations        = var.kubernetes_config.service_annotations
  ingress_enabled            = var.kubernetes_config.ingress_enabled
  ingress_class_name         = var.kubernetes_config.ingress_class_name
  ingress_host               = var.kubernetes_config.ingress_host
  ingress_path               = var.kubernetes_config.ingress_path
  ingress_annotations        = var.kubernetes_config.ingress_annotations
  ingress_tls_secret         = var.kubernetes_config.ingress_tls_secret
  console_ingress_enabled    = var.kubernetes_config.console_ingress_enabled
  console_ingress_host       = var.kubernetes_config.console_ingress_host
  console_ingress_tls_secret = var.kubernetes_config.console_ingress_tls_secret
  pod_annotations            = var.kubernetes_config.pod_annotations
  pod_security_context       = var.kubernetes_config.pod_security_context
  pod_affinity               = var.kubernetes_config.pod_affinity
  tolerations                = var.kubernetes_config.tolerations
  node_selector              = var.kubernetes_config.node_selector
  create_default_bucket      = var.kubernetes_config.create_default_bucket
  default_bucket_name        = var.kubernetes_config.default_bucket_name
  metrics_enabled            = var.kubernetes_config.metrics_enabled
  prometheus_labels          = var.kubernetes_config.prometheus_labels
}
