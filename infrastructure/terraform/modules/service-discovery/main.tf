# =============================================================================
# AWS Cloud Map Service Discovery Module
# =============================================================================
# This module creates a private DNS namespace and service discovery services
# for ECS-to-ECS communication within the VPC.
#
# Services can discover each other using DNS names like:
#   - tenant-management-service.ananta-dev.local
#   - cns-service.ananta-dev.local
#   - keycloak.ananta-dev.local
# =============================================================================

# -----------------------------------------------------------------------------
# Private DNS Namespace
# -----------------------------------------------------------------------------

resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "${var.name_prefix}.local"
  description = "Service discovery namespace for ${var.name_prefix}"
  vpc         = var.vpc_id

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-service-discovery"
    }
  )
}

# -----------------------------------------------------------------------------
# Service Discovery Services
# -----------------------------------------------------------------------------

resource "aws_service_discovery_service" "services" {
  for_each = var.services

  name = each.key

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = var.dns_ttl
      type = "A"
    }

    # Use MULTIVALUE for multiple healthy instances
    routing_policy = "MULTIVALUE"
  }

  # Custom health check configuration
  # ECS will mark tasks as healthy/unhealthy based on container health checks
  health_check_custom_config {
    failure_threshold = var.health_check_failure_threshold
  }

  # Optional: Enable HTTP health checks if needed
  dynamic "health_check_config" {
    for_each = each.value.health_check_path != null ? [1] : []

    content {
      type                   = "HTTP"
      resource_path          = each.value.health_check_path
      failure_threshold      = var.health_check_failure_threshold

      # Optional HTTP-specific settings
      # request_interval and resource_path must be set together
    }
  }

  tags = merge(
    var.tags,
    {
      Name    = "${var.name_prefix}-${each.key}"
      Service = each.key
      Port    = tostring(each.value.port)
    }
  )
}

# -----------------------------------------------------------------------------
# Service Registry for Internal Services (non-HTTP)
# -----------------------------------------------------------------------------
# These services don't have ALB endpoints but need service discovery
# Examples: Temporal gRPC server, RabbitMQ, Redis (if hosted in ECS)

resource "aws_service_discovery_service" "internal_services" {
  for_each = var.internal_services

  name = each.key

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = var.dns_ttl
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = var.health_check_failure_threshold
  }

  tags = merge(
    var.tags,
    {
      Name     = "${var.name_prefix}-${each.key}"
      Service  = each.key
      Type     = "internal"
      Protocol = lookup(each.value, "protocol", "tcp")
      Port     = tostring(each.value.port)
    }
  )
}
