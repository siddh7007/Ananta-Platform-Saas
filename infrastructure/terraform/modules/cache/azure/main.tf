# =============================================================================
# Azure Cache Module - Azure Cache for Redis Implementation
# =============================================================================
# Azure-specific implementation of the cloud-agnostic cache interface.
# Uses Azure Cache for Redis with optional geo-replication.
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables - SKU Mapping
# -----------------------------------------------------------------------------

locals {
  # Map normalized sizes to Azure Cache for Redis SKUs
  sku_map = {
    micro  = { family = "C", capacity = 0, sku_name = "Basic" }    # 250 MB
    small  = { family = "C", capacity = 1, sku_name = "Standard" } # 1 GB
    medium = { family = "C", capacity = 2, sku_name = "Standard" } # 2.5 GB
    large  = { family = "P", capacity = 1, sku_name = "Premium" }  # 6 GB
    xlarge = { family = "P", capacity = 2, sku_name = "Premium" }  # 13 GB
  }

  sku_config = lookup(local.sku_map, var.instance_size, local.sku_map["small"])

  # Redis version mapping
  redis_version = split(".", var.engine_version)[0]
}

# -----------------------------------------------------------------------------
# Resource Group (Optional)
# -----------------------------------------------------------------------------

resource "azurerm_resource_group" "main" {
  count    = var.create_resource_group ? 1 : 0
  name     = "${var.name_prefix}-redis-rg"
  location = var.location

  tags = var.tags
}

locals {
  resource_group_name = var.create_resource_group ? azurerm_resource_group.main[0].name : var.resource_group_name
}

# -----------------------------------------------------------------------------
# Azure Cache for Redis
# -----------------------------------------------------------------------------

resource "azurerm_redis_cache" "main" {
  name                = "${var.name_prefix}-redis"
  location            = var.location
  resource_group_name = local.resource_group_name

  # SKU configuration
  family   = local.sku_config.family
  capacity = local.sku_config.capacity
  sku_name = local.sku_config.sku_name

  # Network configuration
  public_network_access_enabled = var.public_network_access
  subnet_id                     = local.sku_config.sku_name == "Premium" ? var.subnet_id : null

  # Redis configuration
  redis_version                 = local.redis_version
  enable_non_ssl_port           = !var.encryption_in_transit
  minimum_tls_version           = var.encryption_in_transit ? "1.2" : "1.0"

  redis_configuration {
    maxmemory_policy            = var.maxmemory_policy
    maxmemory_reserved          = var.maxmemory_reserved_mb
    maxfragmentationmemory_reserved = var.maxfragmentationmemory_reserved_mb
    notify_keyspace_events      = var.notify_keyspace_events

    # Enable AOF persistence for Premium tier
    aof_backup_enabled = local.sku_config.sku_name == "Premium" ? var.enable_aof_backup : false

    # Enable RDB backup for Premium tier
    rdb_backup_enabled = local.sku_config.sku_name == "Premium" ? var.enable_rdb_backup : false
    rdb_backup_frequency = var.enable_rdb_backup && local.sku_config.sku_name == "Premium" ? var.rdb_backup_frequency : null
    rdb_backup_max_snapshot_count = var.enable_rdb_backup && local.sku_config.sku_name == "Premium" ? var.rdb_backup_max_snapshot_count : null
    rdb_storage_connection_string = var.enable_rdb_backup && local.sku_config.sku_name == "Premium" ? var.backup_storage_connection_string : null
  }

  # Clustering (Premium only)
  shard_count = local.sku_config.sku_name == "Premium" && var.high_availability ? var.shard_count : null

  # Zone redundancy (Premium only)
  zones = local.sku_config.sku_name == "Premium" && var.high_availability ? var.availability_zones : null

  # Replicas per primary (Premium only)
  replicas_per_primary = local.sku_config.sku_name == "Premium" ? var.replica_count : null

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis"
  })

  lifecycle {
    ignore_changes = [
      redis_version,  # Managed via updates
    ]
  }
}

# -----------------------------------------------------------------------------
# Private Endpoint (Optional)
# -----------------------------------------------------------------------------

resource "azurerm_private_endpoint" "redis" {
  count               = var.enable_private_endpoint ? 1 : 0
  name                = "${var.name_prefix}-redis-pe"
  location            = var.location
  resource_group_name = local.resource_group_name
  subnet_id           = var.private_endpoint_subnet_id

  private_service_connection {
    name                           = "${var.name_prefix}-redis-psc"
    private_connection_resource_id = azurerm_redis_cache.main.id
    subresource_names              = ["redisCache"]
    is_manual_connection           = false
  }

  dynamic "private_dns_zone_group" {
    for_each = var.private_dns_zone_id != null ? [1] : []
    content {
      name                 = "redis-dns-zone-group"
      private_dns_zone_ids = [var.private_dns_zone_id]
    }
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Firewall Rules (for public access)
# -----------------------------------------------------------------------------

resource "azurerm_redis_firewall_rule" "allowed_ips" {
  for_each            = var.public_network_access ? { for idx, ip in var.allowed_ip_ranges : idx => ip } : {}
  name                = "allowed-ip-${each.key}"
  redis_cache_name    = azurerm_redis_cache.main.name
  resource_group_name = local.resource_group_name
  start_ip            = split("-", each.value)[0]
  end_ip              = length(split("-", each.value)) > 1 ? split("-", each.value)[1] : split("-", each.value)[0]
}

# -----------------------------------------------------------------------------
# Diagnostic Settings
# -----------------------------------------------------------------------------

resource "azurerm_monitor_diagnostic_setting" "redis" {
  count                      = var.log_analytics_workspace_id != null ? 1 : 0
  name                       = "${var.name_prefix}-redis-diag"
  target_resource_id         = azurerm_redis_cache.main.id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  enabled_log {
    category = "ConnectedClientList"
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

# -----------------------------------------------------------------------------
# Azure Monitor Alerts
# -----------------------------------------------------------------------------

resource "azurerm_monitor_metric_alert" "memory_usage" {
  count               = var.create_alerts ? 1 : 0
  name                = "${var.name_prefix}-redis-memory-alert"
  resource_group_name = local.resource_group_name
  scopes              = [azurerm_redis_cache.main.id]
  description         = "Alert when Redis memory usage exceeds 80%"
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "Microsoft.Cache/redis"
    metric_name      = "usedmemorypercentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  dynamic "action" {
    for_each = var.alert_action_group_ids
    content {
      action_group_id = action.value
    }
  }

  tags = var.tags
}

resource "azurerm_monitor_metric_alert" "cpu_usage" {
  count               = var.create_alerts ? 1 : 0
  name                = "${var.name_prefix}-redis-cpu-alert"
  resource_group_name = local.resource_group_name
  scopes              = [azurerm_redis_cache.main.id]
  description         = "Alert when Redis CPU exceeds 75%"
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "Microsoft.Cache/redis"
    metric_name      = "percentProcessorTime"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 75
  }

  dynamic "action" {
    for_each = var.alert_action_group_ids
    content {
      action_group_id = action.value
    }
  }

  tags = var.tags
}

resource "azurerm_monitor_metric_alert" "cache_hits" {
  count               = var.create_alerts ? 1 : 0
  name                = "${var.name_prefix}-redis-cache-miss-alert"
  resource_group_name = local.resource_group_name
  scopes              = [azurerm_redis_cache.main.id]
  description         = "Alert when cache miss rate is high"
  severity            = 3
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "Microsoft.Cache/redis"
    metric_name      = "cachemissrate"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = var.cache_miss_rate_threshold
  }

  dynamic "action" {
    for_each = var.alert_action_group_ids
    content {
      action_group_id = action.value
    }
  }

  tags = var.tags
}
