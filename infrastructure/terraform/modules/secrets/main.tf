# =============================================================================
# Cloud-Agnostic Secrets Module
# =============================================================================
# Unified secrets management supporting:
# - AWS Secrets Manager
# - Azure Key Vault
# - GCP Secret Manager
# - Kubernetes Secrets (native + External Secrets Operator)
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  # Default to AWS if not specified (backward compatibility)
  effective_provider = var.cloud_provider != "" ? var.cloud_provider : "aws"

  # Common tags/labels
  common_tags = merge(var.tags, {
    Environment = var.environment
    ManagedBy   = "terraform"
    Module      = "secrets"
  })
}

# -----------------------------------------------------------------------------
# AWS Secrets Manager
# -----------------------------------------------------------------------------

module "aws" {
  source = "./aws"
  count  = local.effective_provider == "aws" ? 1 : 0

  # Common variables
  name_prefix    = var.name_prefix
  environment    = var.environment
  secrets_prefix = var.secrets_prefix
  tags           = local.common_tags

  # Secret definitions
  secrets           = var.secrets
  database_secrets  = var.database_secrets
  generated_secrets = var.generated_secrets

  # AWS-specific configuration
  kms_key_arn          = var.aws_config.kms_key_arn
  recovery_window_days = var.aws_config.recovery_window_days
  enable_rotation      = var.aws_config.enable_rotation
  rotation_lambda_arn  = var.aws_config.rotation_lambda_arn
  rotation_days        = var.aws_config.rotation_days
  replica_regions      = var.aws_config.replica_regions
  create_access_policy = var.aws_config.create_access_policy
}

# -----------------------------------------------------------------------------
# Azure Key Vault
# -----------------------------------------------------------------------------

module "azure" {
  source = "./azure"
  count  = local.effective_provider == "azure" ? 1 : 0

  # Common variables
  name_prefix = var.name_prefix
  environment = var.environment
  tags        = local.common_tags

  # Secret definitions
  secrets           = var.secrets
  database_secrets  = var.database_secrets
  generated_secrets = var.generated_secrets

  # Azure-specific configuration
  resource_group_name             = var.azure_config.resource_group_name
  location                        = var.azure_config.location
  tenant_id                       = var.azure_config.tenant_id
  sku_name                        = var.azure_config.sku_name
  enabled_for_deployment          = var.azure_config.enabled_for_deployment
  enabled_for_disk_encryption     = var.azure_config.enabled_for_disk_encryption
  enabled_for_template_deployment = var.azure_config.enabled_for_template_deployment
  enable_rbac_authorization       = var.azure_config.enable_rbac_authorization
  purge_protection_enabled        = var.azure_config.purge_protection_enabled
  soft_delete_retention_days      = var.azure_config.soft_delete_retention_days
  access_policies                 = var.azure_config.access_policies
  network_acls                    = var.azure_config.network_acls
  private_endpoint_subnet_id      = var.azure_config.private_endpoint_subnet_id
  enable_diagnostics              = var.azure_config.enable_diagnostics
  log_analytics_workspace_id      = var.azure_config.log_analytics_workspace_id
}

# -----------------------------------------------------------------------------
# GCP Secret Manager
# -----------------------------------------------------------------------------

module "gcp" {
  source = "./gcp"
  count  = local.effective_provider == "gcp" ? 1 : 0

  # Common variables
  name_prefix = var.name_prefix
  environment = var.environment
  tags        = local.common_tags

  # Secret definitions
  secrets           = var.secrets
  database_secrets  = var.database_secrets
  generated_secrets = var.generated_secrets

  # GCP-specific configuration
  project_id                      = var.gcp_config.project_id
  labels                          = var.gcp_config.labels
  replication_type                = var.gcp_config.replication_type
  replication_locations           = var.gcp_config.replication_locations
  kms_key_name                    = var.gcp_config.kms_key_name
  enable_rotation                 = var.gcp_config.enable_rotation
  rotation_period                 = var.gcp_config.rotation_period
  rotation_topic                  = var.gcp_config.rotation_topic
  iam_bindings                    = var.gcp_config.iam_bindings
  create_accessor_service_account = var.gcp_config.create_accessor_service_account
}

# -----------------------------------------------------------------------------
# Kubernetes Secrets
# -----------------------------------------------------------------------------

module "kubernetes" {
  source = "./kubernetes"
  count  = local.effective_provider == "kubernetes" ? 1 : 0

  # Common variables
  name_prefix = var.name_prefix
  environment = var.environment
  tags        = local.common_tags

  # Secret definitions
  secrets           = var.secrets
  database_secrets  = var.database_secrets
  generated_secrets = var.generated_secrets

  # Kubernetes-specific configuration
  namespace                       = var.kubernetes_config.namespace
  create_namespace                = var.kubernetes_config.create_namespace
  labels                          = var.kubernetes_config.labels
  annotations                     = var.kubernetes_config.annotations
  tls_secrets                     = var.kubernetes_config.tls_secrets
  docker_registry_secrets         = var.kubernetes_config.docker_registry_secrets
  use_external_secrets_operator   = var.kubernetes_config.use_external_secrets_operator
  external_secrets                = var.kubernetes_config.external_secrets
  secret_stores                   = var.kubernetes_config.secret_stores
  create_accessor_service_account = var.kubernetes_config.create_accessor_service_account
  service_account_annotations     = var.kubernetes_config.service_account_annotations
}
