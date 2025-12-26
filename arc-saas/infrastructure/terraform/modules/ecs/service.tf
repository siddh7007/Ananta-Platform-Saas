# =============================================================================
# ARC-SaaS ECS Service Definition Template
# =============================================================================
# This file provides the template for creating ECS services
# Copy and customize for each service

# -----------------------------------------------------------------------------
# Example: Tenant Management Service
# -----------------------------------------------------------------------------

# Target Group
resource "aws_lb_target_group" "tenant_management" {
  name        = "${var.project_name}-${var.environment}-tenant-mgmt"
  port        = 14000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    path                = "/ping"
    matcher             = "200"
  }

  tags = merge(var.tags, {
    Name    = "${var.project_name}-${var.environment}-tenant-mgmt-tg"
    Service = "tenant-management-service"
  })
}

# Listener Rule
resource "aws_lb_listener_rule" "tenant_management" {
  listener_arn = var.certificate_arn != "" ? aws_lb_listener.https[0].arn : aws_lb_listener.http.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tenant_management.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/ping", "/explorer/*"]
    }
  }

  tags = var.tags
}

# Task Definition
resource "aws_ecs_task_definition" "tenant_management" {
  family                   = "${var.project_name}-${var.environment}-tenant-management"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.environment == "prod" ? "512" : "256"
  memory                   = var.environment == "prod" ? "1024" : "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "tenant-management-service"
      image     = "${var.ecr_repository_urls["tenant-management-service"]}:latest"
      essential = true

      portMappings = [
        {
          containerPort = 14000
          hostPort      = 14000
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = var.environment },
        { name = "PORT", value = "14000" },
        { name = "LOG_LEVEL", value = var.environment == "prod" ? "info" : "debug" }
      ]

      secrets = [
        {
          name      = "DB_HOST"
          valueFrom = "${var.db_credentials_secret_arn}:host::"
        },
        {
          name      = "DB_PORT"
          valueFrom = "${var.db_credentials_secret_arn}:port::"
        },
        {
          name      = "DB_USER"
          valueFrom = "${var.db_credentials_secret_arn}:username::"
        },
        {
          name      = "DB_PASSWORD"
          valueFrom = "${var.db_credentials_secret_arn}:password::"
        },
        {
          name      = "DB_DATABASE"
          valueFrom = "${var.db_credentials_secret_arn}:database::"
        },
        {
          name      = "REDIS_URL"
          valueFrom = "${var.redis_credentials_secret_arn}:connection_string::"
        },
        {
          name      = "JWT_SECRET"
          valueFrom = "${var.app_secrets_arn}:jwt_secret::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.services["tenant-management-service"].name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:14000/ping || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = merge(var.tags, {
    Name    = "${var.project_name}-${var.environment}-tenant-management-task"
    Service = "tenant-management-service"
  })
}

# Service Discovery Service
resource "aws_service_discovery_service" "tenant_management" {
  name = "tenant-management"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.main.id
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

# ECS Service
resource "aws_ecs_service" "tenant_management" {
  name                               = "tenant-management-service"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.tenant_management.arn
  desired_count                      = var.environment == "prod" ? 2 : 1
  launch_type                        = var.environment == "prod" ? "FARGATE" : null
  platform_version                   = "LATEST"
  health_check_grace_period_seconds  = 120
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
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.tenant_management.arn
    container_name   = "tenant-management-service"
    container_port   = 14000
  }

  service_registries {
    registry_arn = aws_service_discovery_service.tenant_management.arn
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS"
  }

  tags = merge(var.tags, {
    Name    = "${var.project_name}-${var.environment}-tenant-management-service"
    Service = "tenant-management-service"
  })

  lifecycle {
    ignore_changes = [desired_count]
  }
}
