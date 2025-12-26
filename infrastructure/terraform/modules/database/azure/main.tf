# =============================================================================
# Azure Database Module - PostgreSQL Flexible Server Implementation
# =============================================================================
# Azure-specific implementation of the cloud-agnostic database interface
# Uses: Azure Database for PostgreSQL Flexible Server
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables - Instance Size Mapping
# -----------------------------------------------------------------------------

locals {
  # Map normalized sizes to Azure SKU names
  sku_name_map = {
    micro  = "B_Standard_B1ms"
    small  = "B_Standard_B2s"
    medium = "GP_Standard_D2s_v3"
    large  = "GP_Standard_D4s_v3"
    xlarge = "GP_Standard_D8s_v3"
  }

  sku_name = lookup(local.sku_name_map, var.instance_size, "B_Standard_B2s")

  # PostgreSQL version mapping
  pg_version = var.engine_version
}

# -----------------------------------------------------------------------------
# Random Password Generation
# -----------------------------------------------------------------------------

resource "random_password" "master" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# -----------------------------------------------------------------------------
# Resource Group (if not provided)
# -----------------------------------------------------------------------------

resource "azurerm_resource_group" "main" {
  count    = var.create_resource_group ? 1 : 0
  name     = "${var.name_prefix}-rg"
  location = var.location

  tags = var.tags
}

locals {
  resource_group_name = var.create_resource_group ? azurerm_resource_group.main[0].name : var.resource_group_name
}

# -----------------------------------------------------------------------------
# Private DNS Zone for PostgreSQL
# -----------------------------------------------------------------------------

resource "azurerm_private_dns_zone" "postgresql" {
  count               = var.create_private_dns_zone ? 1 : 0
  name                = "${var.name_prefix}.private.postgres.database.azure.com"
  resource_group_name = local.resource_group_name

  tags = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgresql" {
  count                 = var.create_private_dns_zone ? 1 : 0
  name                  = "${var.name_prefix}-pdz-link"
  private_dns_zone_name = azurerm_private_dns_zone.postgresql[0].name
  virtual_network_id    = var.virtual_network_id
  resource_group_name   = local.resource_group_name

  tags = var.tags
}

# -----------------------------------------------------------------------------
# PostgreSQL Flexible Server
# -----------------------------------------------------------------------------

resource "azurerm_postgresql_flexible_server" "main" {
  name                = "${var.name_prefix}-pg"
  resource_group_name = local.resource_group_name
  location            = var.location

  # Version and SKU
  version    = local.pg_version
  sku_name   = local.sku_name

  # Administrator credentials
  administrator_login    = "postgres"
  administrator_password = random_password.master.result

  # Storage configuration
  storage_mb = var.storage_gb * 1024

  # Storage auto-growth (if supported by SKU)
  auto_grow_enabled = var.max_storage_gb > var.storage_gb

  # Network configuration
  delegated_subnet_id = var.subnet_id
  private_dns_zone_id = var.create_private_dns_zone ? azurerm_private_dns_zone.postgresql[0].id : var.private_dns_zone_id

  # High availability
  dynamic "high_availability" {
    for_each = var.high_availability ? [1] : []
    content {
      mode                      = "ZoneRedundant"
      standby_availability_zone = var.standby_availability_zone
    }
  }

  # Backup configuration
  backup_retention_days        = var.backup_retention_days
  geo_redundant_backup_enabled = var.environment == "prod"

  # Maintenance window
  maintenance_window {
    day_of_week  = 0  # Sunday
    start_hour   = 4
    start_minute = 0
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-pg"
  })

  lifecycle {
    ignore_changes = [
      zone,
      high_availability[0].standby_availability_zone
    ]
  }

  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgresql]
}

# -----------------------------------------------------------------------------
# PostgreSQL Database
# -----------------------------------------------------------------------------

resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = var.database_name
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "UTF8"
}

# -----------------------------------------------------------------------------
# PostgreSQL Configuration
# -----------------------------------------------------------------------------

resource "azurerm_postgresql_flexible_server_configuration" "log_statement" {
  name      = "log_statement"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "all"
}

resource "azurerm_postgresql_flexible_server_configuration" "log_min_duration" {
  name      = "log_min_duration_statement"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "1000"
}

resource "azurerm_postgresql_flexible_server_configuration" "pg_stat_statements" {
  name      = "shared_preload_libraries"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "pg_stat_statements"
}

# -----------------------------------------------------------------------------
# Read Replica
# -----------------------------------------------------------------------------

resource "azurerm_postgresql_flexible_server" "replica" {
  count               = var.create_read_replica ? var.replica_count : 0
  name                = "${var.name_prefix}-replica-${count.index + 1}"
  resource_group_name = local.resource_group_name
  location            = var.location

  create_mode      = "Replica"
  source_server_id = azurerm_postgresql_flexible_server.main.id

  sku_name = local.sku_name

  # Replicas can have different storage
  storage_mb = var.storage_gb * 1024

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-replica-${count.index + 1}"
    Role = "replica"
  })
}

# -----------------------------------------------------------------------------
# Firewall Rules (for public access if needed)
# -----------------------------------------------------------------------------

resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure_services" {
  count            = var.allow_azure_services ? 1 : 0
  name             = "AllowAllAzureServicesAndResourcesWithinAzureIps"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# -----------------------------------------------------------------------------
# Diagnostic Settings
# -----------------------------------------------------------------------------

resource "azurerm_monitor_diagnostic_setting" "postgresql" {
  count                          = var.enable_enhanced_monitoring && var.log_analytics_workspace_id != null ? 1 : 0
  name                           = "${var.name_prefix}-diag"
  target_resource_id             = azurerm_postgresql_flexible_server.main.id
  log_analytics_workspace_id     = var.log_analytics_workspace_id

  enabled_log {
    category = "PostgreSQLLogs"
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

# -----------------------------------------------------------------------------
# Alerts
# -----------------------------------------------------------------------------

resource "azurerm_monitor_metric_alert" "cpu_utilization" {
  count               = var.enable_alerts ? 1 : 0
  name                = "${var.name_prefix}-cpu-alert"
  resource_group_name = local.resource_group_name
  scopes              = [azurerm_postgresql_flexible_server.main.id]
  description         = "Alert when CPU utilization exceeds 80%"
  severity            = 2

  criteria {
    metric_namespace = "Microsoft.DBforPostgreSQL/flexibleServers"
    metric_name      = "cpu_percent"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  action {
    action_group_id = var.action_group_id
  }

  tags = var.tags
}

resource "azurerm_monitor_metric_alert" "storage_alert" {
  count               = var.enable_alerts ? 1 : 0
  name                = "${var.name_prefix}-storage-alert"
  resource_group_name = local.resource_group_name
  scopes              = [azurerm_postgresql_flexible_server.main.id]
  description         = "Alert when storage utilization exceeds 90%"
  severity            = 2

  criteria {
    metric_namespace = "Microsoft.DBforPostgreSQL/flexibleServers"
    metric_name      = "storage_percent"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 90
  }

  action {
    action_group_id = var.action_group_id
  }

  tags = var.tags
}
