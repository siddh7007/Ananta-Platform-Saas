# =============================================================================
# ARC-SaaS Keycloak Module
# =============================================================================
# Deploys Keycloak as an ECS Fargate service for identity management

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Admin Password Generation
# -----------------------------------------------------------------------------

resource "random_password" "keycloak_admin" {
  count   = var.admin_password == null ? 1 : 0
  length  = 24
  special = true
}

locals {
  admin_password = var.admin_password != null ? var.admin_password : random_password.keycloak_admin[0].result
}

# -----------------------------------------------------------------------------
# CloudWatch Log Group
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "keycloak" {
  name              = "/aws/ecs/${var.project_name}-${var.environment}/keycloak"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name    = "${var.project_name}-${var.environment}-keycloak-logs"
    Service = "keycloak"
  })
}

# -----------------------------------------------------------------------------
# Target Group
# -----------------------------------------------------------------------------

resource "aws_lb_target_group" "keycloak" {
  name        = "${var.project_name}-${var.environment}-keycloak"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  tags = merge(var.tags, {
    Name    = "${var.project_name}-${var.environment}-keycloak-tg"
    Service = "keycloak"
  })
}

# -----------------------------------------------------------------------------
# Listener Rule
# -----------------------------------------------------------------------------

resource "aws_lb_listener_rule" "keycloak" {
  listener_arn = var.listener_arn
  priority     = 50

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.keycloak.arn
  }

  condition {
    host_header {
      values = [var.keycloak_hostname]
    }
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Secrets Manager for Keycloak Credentials
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "keycloak_admin" {
  name        = "${var.project_name}/${var.environment}/keycloak/admin"
  description = "Keycloak admin credentials for ${var.project_name} ${var.environment}"

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-keycloak-admin"
  })
}

resource "aws_secretsmanager_secret_version" "keycloak_admin" {
  secret_id = aws_secretsmanager_secret.keycloak_admin.id
  secret_string = jsonencode({
    username = var.admin_username
    password = local.admin_password
  })
}

# -----------------------------------------------------------------------------
# Task Definition
# -----------------------------------------------------------------------------

resource "aws_ecs_task_definition" "keycloak" {
  family                   = "${var.project_name}-${var.environment}-keycloak"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.environment == "prod" ? "1024" : "512"
  memory                   = var.environment == "prod" ? "2048" : "1024"
  execution_role_arn       = var.task_execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "keycloak"
      image     = "quay.io/keycloak/keycloak:${var.keycloak_version}"
      essential = true

      command = ["start", "--optimized"]

      portMappings = [
        {
          containerPort = 8080
          hostPort      = 8080
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "KC_DB", value = "postgres" },
        { name = "KC_DB_URL", value = "jdbc:postgresql://${var.db_host}:${var.db_port}/${var.db_name}" },
        { name = "KC_DB_SCHEMA", value = "keycloak" },
        { name = "KC_HOSTNAME", value = var.keycloak_hostname },
        { name = "KC_HOSTNAME_STRICT", value = "true" },
        { name = "KC_PROXY", value = "edge" },
        { name = "KC_HTTP_ENABLED", value = "true" },
        { name = "KC_HEALTH_ENABLED", value = "true" },
        { name = "KC_METRICS_ENABLED", value = "true" },
        { name = "JAVA_OPTS_APPEND", value = "-Djgroups.dns.query=${var.project_name}-${var.environment}-keycloak.${var.service_discovery_namespace}" }
      ]

      secrets = [
        {
          name      = "KC_DB_USERNAME"
          valueFrom = "${var.db_credentials_secret_arn}:username::"
        },
        {
          name      = "KC_DB_PASSWORD"
          valueFrom = "${var.db_credentials_secret_arn}:password::"
        },
        {
          name      = "KEYCLOAK_ADMIN"
          valueFrom = "${aws_secretsmanager_secret.keycloak_admin.arn}:username::"
        },
        {
          name      = "KEYCLOAK_ADMIN_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.keycloak_admin.arn}:password::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.keycloak.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
        interval    = 30
        timeout     = 10
        retries     = 3
        startPeriod = 120
      }
    }
  ])

  tags = merge(var.tags, {
    Name    = "${var.project_name}-${var.environment}-keycloak-task"
    Service = "keycloak"
  })
}

# -----------------------------------------------------------------------------
# Service Discovery
# -----------------------------------------------------------------------------

resource "aws_service_discovery_service" "keycloak" {
  name = "keycloak"

  dns_config {
    namespace_id   = var.service_discovery_namespace_id
    routing_policy = "MULTIVALUE"

    dns_records {
      ttl  = 10
      type = "A"
    }
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# ECS Service
# -----------------------------------------------------------------------------

resource "aws_ecs_service" "keycloak" {
  name                               = "keycloak"
  cluster                            = var.cluster_id
  task_definition                    = aws_ecs_task_definition.keycloak.arn
  desired_count                      = var.environment == "prod" ? 2 : 1
  launch_type                        = var.environment == "prod" ? "FARGATE" : null
  platform_version                   = "LATEST"
  health_check_grace_period_seconds  = 180
  enable_execute_command             = true

  dynamic "capacity_provider_strategy" {
    for_each = var.environment != "prod" ? [1] : []
    content {
      capacity_provider = "FARGATE_SPOT"
      weight            = 100
    }
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.keycloak.arn
    container_name   = "keycloak"
    container_port   = 8080
  }

  service_registries {
    registry_arn = aws_service_discovery_service.keycloak.arn
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  tags = merge(var.tags, {
    Name    = "${var.project_name}-${var.environment}-keycloak-service"
    Service = "keycloak"
  })

  lifecycle {
    ignore_changes = [desired_count]
  }
}

# -----------------------------------------------------------------------------
# Auto Scaling
# -----------------------------------------------------------------------------

resource "aws_appautoscaling_target" "keycloak" {
  count              = var.enable_autoscaling ? 1 : 0
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${var.cluster_name}/keycloak"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"

  depends_on = [aws_ecs_service.keycloak]
}

resource "aws_appautoscaling_policy" "keycloak_cpu" {
  count              = var.enable_autoscaling ? 1 : 0
  name               = "${var.project_name}-${var.environment}-keycloak-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.keycloak[0].resource_id
  scalable_dimension = aws_appautoscaling_target.keycloak[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.keycloak[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
