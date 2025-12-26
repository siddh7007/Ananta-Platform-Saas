# =============================================================================
# Keycloak Module - OAuth2/OIDC Provider
# =============================================================================
# Deploys Keycloak as an ECS Fargate service with dedicated RDS PostgreSQL
# backend for identity and access management.
#
# Components:
# - RDS PostgreSQL database for Keycloak data
# - ECS Fargate task definition and service
# - ALB target group for routing
# - Secrets Manager for admin credentials
# - CloudWatch logs for monitoring
# =============================================================================

# -----------------------------------------------------------------------------
# Random Password Generation
# -----------------------------------------------------------------------------

resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "admin_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# -----------------------------------------------------------------------------
# Keycloak Database
# -----------------------------------------------------------------------------

resource "aws_db_subnet_group" "keycloak" {
  name       = "${var.name_prefix}-keycloak-db-subnet-group"
  subnet_ids = var.database_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-keycloak-db-subnet-group"
  })
}

resource "aws_db_parameter_group" "keycloak" {
  name_prefix = "${var.name_prefix}-keycloak-pg15-"
  family      = "postgres15"
  description = "Parameter group for Keycloak database"

  parameter {
    name  = "max_connections"
    value = "200"
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = var.tags
}

resource "aws_db_instance" "keycloak" {
  identifier = "${var.name_prefix}-keycloak-db"

  # Engine configuration
  engine               = "postgres"
  engine_version       = var.db_engine_version
  instance_class       = var.db_instance_class
  parameter_group_name = aws_db_parameter_group.keycloak.name

  # Storage configuration
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  # Database configuration
  db_name  = "keycloak"
  username = "keycloak"
  password = random_password.db_password.result
  port     = 5432

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.keycloak.name
  vpc_security_group_ids = [var.rds_security_group_id]
  publicly_accessible    = false
  multi_az               = var.db_multi_az

  # Backup configuration
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Monitoring
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]

  # Protection settings
  deletion_protection = var.deletion_protection
  skip_final_snapshot = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.name_prefix}-keycloak-final-snapshot"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-keycloak-db"
  })
}

# -----------------------------------------------------------------------------
# Secrets Manager
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "admin_password" {
  name_prefix = "${var.name_prefix}-keycloak-admin-"
  description = "Keycloak admin credentials"

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "admin_password" {
  secret_id = aws_secretsmanager_secret.admin_password.id
  secret_string = jsonencode({
    username = var.admin_username
    password = random_password.admin_password.result
  })
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name_prefix = "${var.name_prefix}-keycloak-db-"
  description = "Keycloak database credentials"

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username          = aws_db_instance.keycloak.username
    password          = random_password.db_password.result
    host              = aws_db_instance.keycloak.address
    port              = aws_db_instance.keycloak.port
    database          = aws_db_instance.keycloak.db_name
    connection_string = "postgresql://${aws_db_instance.keycloak.username}:${random_password.db_password.result}@${aws_db_instance.keycloak.address}:${aws_db_instance.keycloak.port}/${aws_db_instance.keycloak.db_name}"
  })
}

# -----------------------------------------------------------------------------
# CloudWatch Log Group
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "keycloak" {
  name              = "/aws/ecs/${var.name_prefix}/keycloak"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# -----------------------------------------------------------------------------
# ECS Task Definition
# -----------------------------------------------------------------------------

resource "aws_ecs_task_definition" "keycloak" {
  family                   = "${var.name_prefix}-keycloak"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "keycloak"
      image     = var.keycloak_image
      essential = true

      portMappings = [
        {
          containerPort = 8080
          hostPort      = 8080
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "KC_DB", value = "postgres" },
        { name = "KC_DB_URL_HOST", value = aws_db_instance.keycloak.address },
        { name = "KC_DB_URL_PORT", value = tostring(aws_db_instance.keycloak.port) },
        { name = "KC_DB_URL_DATABASE", value = aws_db_instance.keycloak.db_name },
        { name = "KC_DB_USERNAME", value = aws_db_instance.keycloak.username },
        { name = "KC_HOSTNAME_STRICT", value = "false" },
        { name = "KC_HOSTNAME_STRICT_HTTPS", value = "false" },
        { name = "KC_HTTP_ENABLED", value = "true" },
        { name = "KC_PROXY", value = "edge" },
        { name = "KC_HEALTH_ENABLED", value = "true" },
        { name = "KC_METRICS_ENABLED", value = "true" },
        { name = "KEYCLOAK_ADMIN", value = var.admin_username }
      ]

      secrets = [
        {
          name      = "KC_DB_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:password::"
        },
        {
          name      = "KEYCLOAK_ADMIN_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.admin_password.arn}:password::"
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
        command     = ["CMD-SHELL", "curl -f http://localhost:8080/health/ready || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 120
      }
    }
  ])

  tags = var.tags
}

# -----------------------------------------------------------------------------
# ECS Service
# -----------------------------------------------------------------------------

resource "aws_ecs_service" "keycloak" {
  name            = "${var.name_prefix}-keycloak"
  cluster         = var.ecs_cluster_id
  task_definition = aws_ecs_task_definition.keycloak.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.keycloak_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.keycloak.arn
    container_name   = "keycloak"
    container_port   = 8080
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_execute_command = true

  lifecycle {
    ignore_changes = [desired_count]
  }

  depends_on = [aws_db_instance.keycloak]

  tags = var.tags
}

# -----------------------------------------------------------------------------
# ALB Target Group
# -----------------------------------------------------------------------------

resource "aws_lb_target_group" "keycloak" {
  name        = "${var.name_prefix}-keycloak-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health/ready"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = var.tags
}

# -----------------------------------------------------------------------------
# ALB Listener Rule
# -----------------------------------------------------------------------------

resource "aws_lb_listener_rule" "keycloak" {
  listener_arn = var.alb_https_listener_arn
  priority     = 50

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.keycloak.arn
  }

  condition {
    path_pattern {
      values = ["/auth/*", "/realms/*", "/admin/*", "/resources/*", "/js/*"]
    }
  }

  tags = var.tags
}
