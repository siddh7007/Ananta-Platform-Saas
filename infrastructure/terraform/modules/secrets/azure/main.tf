# =============================================================================
# Azure Secrets Module - Key Vault Implementation
# =============================================================================
# Azure-specific implementation of the cloud-agnostic secrets interface.
# Uses Azure Key Vault for secrets management.
# =============================================================================

# -----------------------------------------------------------------------------
# Data Sources
# -----------------------------------------------------------------------------

data "azurerm_client_config" "current" {}

# -----------------------------------------------------------------------------
# Key Vault
# -----------------------------------------------------------------------------

resource "azurerm_key_vault" "main" {
  count = var.create_key_vault ? 1 : 0

  name                = replace("${var.name_prefix}-kv", "_", "-")
  location            = var.location
  resource_group_name = var.resource_group_name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = var.sku_name

  enabled_for_deployment          = var.enabled_for_deployment
  enabled_for_disk_encryption     = var.enabled_for_disk_encryption
  enabled_for_template_deployment = var.enabled_for_template_deployment
  enable_rbac_authorization       = var.enable_rbac_authorization
  purge_protection_enabled        = var.purge_protection_enabled
  soft_delete_retention_days      = var.soft_delete_retention_days

  # Network rules
  dynamic "network_acls" {
    for_each = var.network_acls != null ? [var.network_acls] : []
    content {
      default_action             = network_acls.value.default_action
      bypass                     = network_acls.value.bypass
      ip_rules                   = network_acls.value.ip_rules
      virtual_network_subnet_ids = network_acls.value.virtual_network_subnet_ids
    }
  }

  tags = merge(var.tags, {
    Environment = var.environment
  })
}

# Key Vault access policy for current user/service principal
resource "azurerm_key_vault_access_policy" "current" {
  count = var.create_key_vault && !var.enable_rbac_authorization ? 1 : 0

  key_vault_id = azurerm_key_vault.main[0].id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = data.azurerm_client_config.current.object_id

  secret_permissions = [
    "Get",
    "List",
    "Set",
    "Delete",
    "Recover",
    "Backup",
    "Restore",
    "Purge"
  ]

  key_permissions = [
    "Get",
    "List",
    "Create",
    "Delete",
    "Recover",
    "Backup",
    "Restore"
  ]

  certificate_permissions = [
    "Get",
    "List",
    "Create",
    "Delete",
    "Recover",
    "Backup",
    "Restore"
  ]
}

# Additional access policies
resource "azurerm_key_vault_access_policy" "additional" {
  for_each = var.create_key_vault && !var.enable_rbac_authorization ? var.access_policies : {}

  key_vault_id = azurerm_key_vault.main[0].id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = each.value.object_id

  secret_permissions      = each.value.secret_permissions
  key_permissions         = each.value.key_permissions
  certificate_permissions = each.value.certificate_permissions
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  key_vault_id = var.create_key_vault ? azurerm_key_vault.main[0].id : var.existing_key_vault_id
}

# -----------------------------------------------------------------------------
# Generic Secrets
# -----------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "secrets" {
  for_each = var.secrets

  name         = replace(each.key, "_", "-")
  value        = jsonencode(each.value.value)
  key_vault_id = local.key_vault_id
  content_type = "application/json"

  expiration_date = each.value.expiration_date
  not_before_date = each.value.not_before_date

  tags = merge(var.tags, {
    Description = each.value.description
  })

  depends_on = [azurerm_key_vault_access_policy.current]
}

# -----------------------------------------------------------------------------
# Database Secrets
# -----------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "database" {
  for_each = var.database_secrets

  name         = replace("db-${each.key}", "_", "-")
  key_vault_id = local.key_vault_id
  content_type = "application/json"

  value = jsonencode({
    host              = each.value.host
    port              = each.value.port
    database          = each.value.database
    username          = each.value.username
    password          = each.value.password
    engine            = each.value.engine
    connection_string = "${each.value.engine}://${each.value.username}:${each.value.password}@${each.value.host}:${each.value.port}/${each.value.database}"
  })

  tags = merge(var.tags, {
    Type = "database"
  })

  depends_on = [azurerm_key_vault_access_policy.current]
}

# -----------------------------------------------------------------------------
# Auto-Generated Secrets
# -----------------------------------------------------------------------------

resource "random_password" "generated" {
  for_each = var.generated_secrets

  length           = each.value.length
  special          = each.value.special
  override_special = each.value.override_special
  upper            = each.value.upper
  lower            = each.value.lower
  numeric          = each.value.numeric
}

resource "azurerm_key_vault_secret" "generated" {
  for_each = var.generated_secrets

  name         = replace(each.key, "_", "-")
  value        = random_password.generated[each.key].result
  key_vault_id = local.key_vault_id
  content_type = "text/plain"

  tags = merge(var.tags, {
    Description = each.value.description
    Generated   = "true"
  })

  depends_on = [azurerm_key_vault_access_policy.current]
}

# -----------------------------------------------------------------------------
# Private Endpoint (Optional)
# -----------------------------------------------------------------------------

resource "azurerm_private_endpoint" "key_vault" {
  count = var.create_key_vault && var.private_endpoint_subnet_id != null ? 1 : 0

  name                = "${var.name_prefix}-kv-pe"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.private_endpoint_subnet_id

  private_service_connection {
    name                           = "${var.name_prefix}-kv-psc"
    private_connection_resource_id = azurerm_key_vault.main[0].id
    subresource_names              = ["vault"]
    is_manual_connection           = false
  }

  dynamic "private_dns_zone_group" {
    for_each = length(var.private_dns_zone_ids) > 0 ? [1] : []
    content {
      name                 = "default"
      private_dns_zone_ids = var.private_dns_zone_ids
    }
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Diagnostic Settings (Optional)
# -----------------------------------------------------------------------------

resource "azurerm_monitor_diagnostic_setting" "key_vault" {
  count = var.create_key_vault && var.log_analytics_workspace_id != null ? 1 : 0

  name                       = "${var.name_prefix}-kv-diag"
  target_resource_id         = azurerm_key_vault.main[0].id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  enabled_log {
    category = "AuditEvent"
  }

  enabled_log {
    category = "AzurePolicyEvaluationDetails"
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}
