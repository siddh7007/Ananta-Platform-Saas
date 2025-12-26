# =============================================================================
# Azure Storage Module - Blob Storage Implementation
# =============================================================================
# Azure-specific implementation of the cloud-agnostic storage interface.
# Uses Azure Blob Storage with optional versioning, encryption, and replication.
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  # Storage account names must be 3-24 chars, lowercase alphanumeric only
  storage_account_name = substr(replace(lower("${var.name_prefix}${var.bucket_suffix}"), "/[^a-z0-9]/", ""), 0, 24)
  container_name       = var.container_name != "" ? var.container_name : var.bucket_suffix
}

# -----------------------------------------------------------------------------
# Resource Group (Optional)
# -----------------------------------------------------------------------------

resource "azurerm_resource_group" "main" {
  count    = var.create_resource_group ? 1 : 0
  name     = "${var.name_prefix}-storage-rg"
  location = var.location

  tags = var.tags
}

locals {
  resource_group_name = var.create_resource_group ? azurerm_resource_group.main[0].name : var.resource_group_name
}

# -----------------------------------------------------------------------------
# Storage Account
# -----------------------------------------------------------------------------

resource "azurerm_storage_account" "main" {
  name                     = local.storage_account_name
  resource_group_name      = local.resource_group_name
  location                 = var.location
  account_tier             = var.account_tier
  account_replication_type = var.replication_type
  account_kind             = var.account_kind
  access_tier              = var.access_tier

  # Security
  enable_https_traffic_only       = true
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = var.public_access
  shared_access_key_enabled       = var.shared_access_key_enabled

  # Versioning
  is_hns_enabled = var.enable_hierarchical_namespace

  # Encryption
  dynamic "customer_managed_key" {
    for_each = var.customer_managed_key != null ? [var.customer_managed_key] : []
    content {
      key_vault_key_id          = customer_managed_key.value.key_vault_key_id
      user_assigned_identity_id = customer_managed_key.value.user_assigned_identity_id
    }
  }

  # Network rules
  dynamic "network_rules" {
    for_each = var.network_rules != null ? [var.network_rules] : []
    content {
      default_action             = network_rules.value.default_action
      ip_rules                   = network_rules.value.ip_rules
      virtual_network_subnet_ids = network_rules.value.virtual_network_subnet_ids
      bypass                     = network_rules.value.bypass
    }
  }

  # Blob properties
  blob_properties {
    versioning_enabled       = var.versioning_enabled
    change_feed_enabled      = var.change_feed_enabled
    last_access_time_enabled = var.last_access_time_enabled

    dynamic "delete_retention_policy" {
      for_each = var.soft_delete_retention_days > 0 ? [1] : []
      content {
        days = var.soft_delete_retention_days
      }
    }

    dynamic "container_delete_retention_policy" {
      for_each = var.container_soft_delete_retention_days > 0 ? [1] : []
      content {
        days = var.container_soft_delete_retention_days
      }
    }

    dynamic "cors_rule" {
      for_each = var.cors_rules
      content {
        allowed_headers    = cors_rule.value.allowed_headers
        allowed_methods    = cors_rule.value.allowed_methods
        allowed_origins    = cors_rule.value.allowed_origins
        exposed_headers    = cors_rule.value.exposed_headers
        max_age_in_seconds = cors_rule.value.max_age_seconds
      }
    }
  }

  tags = merge(var.tags, {
    Name = local.storage_account_name
  })
}

# -----------------------------------------------------------------------------
# Blob Container
# -----------------------------------------------------------------------------

resource "azurerm_storage_container" "main" {
  name                  = local.container_name
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = var.public_access ? "blob" : "private"
}

# -----------------------------------------------------------------------------
# Lifecycle Management Policy
# -----------------------------------------------------------------------------

resource "azurerm_storage_management_policy" "main" {
  count              = length(var.lifecycle_rules) > 0 ? 1 : 0
  storage_account_id = azurerm_storage_account.main.id

  dynamic "rule" {
    for_each = var.lifecycle_rules
    content {
      name    = rule.value.name
      enabled = rule.value.enabled

      filters {
        prefix_match = rule.value.prefix_match
        blob_types   = rule.value.blob_types
      }

      actions {
        dynamic "base_blob" {
          for_each = rule.value.base_blob_actions != null ? [rule.value.base_blob_actions] : []
          content {
            tier_to_cool_after_days_since_modification_greater_than    = base_blob.value.tier_to_cool_after_days
            tier_to_archive_after_days_since_modification_greater_than = base_blob.value.tier_to_archive_after_days
            delete_after_days_since_modification_greater_than          = base_blob.value.delete_after_days
          }
        }

        dynamic "snapshot" {
          for_each = rule.value.snapshot_actions != null ? [rule.value.snapshot_actions] : []
          content {
            delete_after_days_since_creation_greater_than = snapshot.value.delete_after_days
          }
        }

        dynamic "version" {
          for_each = rule.value.version_actions != null ? [rule.value.version_actions] : []
          content {
            delete_after_days_since_creation = version.value.delete_after_days
          }
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Private Endpoint (Optional)
# -----------------------------------------------------------------------------

resource "azurerm_private_endpoint" "blob" {
  count               = var.enable_private_endpoint ? 1 : 0
  name                = "${var.name_prefix}-blob-pe"
  location            = var.location
  resource_group_name = local.resource_group_name
  subnet_id           = var.private_endpoint_subnet_id

  private_service_connection {
    name                           = "${var.name_prefix}-blob-psc"
    private_connection_resource_id = azurerm_storage_account.main.id
    subresource_names              = ["blob"]
    is_manual_connection           = false
  }

  dynamic "private_dns_zone_group" {
    for_each = var.private_dns_zone_id != null ? [1] : []
    content {
      name                 = "blob-dns-zone-group"
      private_dns_zone_ids = [var.private_dns_zone_id]
    }
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Diagnostic Settings
# -----------------------------------------------------------------------------

resource "azurerm_monitor_diagnostic_setting" "storage" {
  count                      = var.log_analytics_workspace_id != null ? 1 : 0
  name                       = "${var.name_prefix}-storage-diag"
  target_resource_id         = "${azurerm_storage_account.main.id}/blobServices/default"
  log_analytics_workspace_id = var.log_analytics_workspace_id

  enabled_log {
    category = "StorageRead"
  }

  enabled_log {
    category = "StorageWrite"
  }

  enabled_log {
    category = "StorageDelete"
  }

  metric {
    category = "Transaction"
    enabled  = true
  }

  metric {
    category = "Capacity"
    enabled  = true
  }
}
