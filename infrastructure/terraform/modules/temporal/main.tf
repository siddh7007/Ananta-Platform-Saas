# =============================================================================
# Temporal Module - Workflow Orchestration
# =============================================================================
# Deploys Temporal workflow engine with:
# - RDS PostgreSQL for persistence
# - Elasticsearch for visibility (optional)
# - Temporal server (ECS Fargate)
# - Temporal UI (ECS Fargate)
# - Admin tools and monitoring
#
# Namespaces: arc-saas (control plane), default, enrichment (app plane)
# Task Queue: tenant-provisioning
# =============================================================================

# -----------------------------------------------------------------------------
# Random Password Generation
# -----------------------------------------------------------------------------

resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# -----------------------------------------------------------------------------
# Temporal Database
# -----------------------------------------------------------------------------

resource "aws_db_subnet_group" "temporal" {
  name       = "${var.name_prefix}-temporal-db-subnet-group"
  subnet_ids = var.database_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-temporal-db-subnet-group"
  })
}

resource "aws_db_parameter_group" "temporal" {
  name_prefix = "${var.name_prefix}-temporal-pg15-"
  family      = "postgres15"
  description = "Parameter group for Temporal database"

  parameter {
    name  = "max_connections"
    value = "500"
  }

  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/10240}"  # 10% of instance memory
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = var.tags
}

resource "aws_db_instance" "temporal" {
  identifier = "${var.name_prefix}-temporal-db"

  # Engine configuration
  engine               = "postgres"
  engine_version       = var.db_engine_version
  instance_class       = var.db_instance_class
  parameter_group_name = aws_db_parameter_group.temporal.name

  # Storage configuration
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = 200
  storage_type          = "gp3"
  storage_encrypted     = true

  # Database configuration
  db_name  = "temporal"
  username = "temporal"
  password = random_password.db_password.result
  port     = 5432

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.temporal.name
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
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.name_prefix}-temporal-final-snapshot"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-temporal-db"
  })
}

# -----------------------------------------------------------------------------
# Secrets Manager
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "db_credentials" {
  name_prefix = "${var.name_prefix}-temporal-db-"
  description = "Temporal database credentials"

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username          = aws_db_instance.temporal.username
    password          = random_password.db_password.result
    host              = aws_db_instance.temporal.address
    port              = aws_db_instance.temporal.port
    database          = aws_db_instance.temporal.db_name
    connection_string = "postgresql://${aws_db_instance.temporal.username}:${random_password.db_password.result}@${aws_db_instance.temporal.address}:${aws_db_instance.temporal.port}/${aws_db_instance.temporal.db_name}"
  })
}

# -----------------------------------------------------------------------------
# CloudWatch Log Groups
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "temporal_server" {
  name              = "/aws/ecs/${var.name_prefix}/temporal-server"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "temporal_ui" {
  name              = "/aws/ecs/${var.name_prefix}/temporal-ui"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# -----------------------------------------------------------------------------
# ECS Task Definition - Temporal Server
# -----------------------------------------------------------------------------

resource "aws_ecs_task_definition" "temporal_server" {
  family                   = "${var.name_prefix}-temporal-server"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.server_task_cpu
  memory                   = var.server_task_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "temporal-server"
      image     = var.temporal_server_image
      essential = true

      portMappings = [
        {
          containerPort = 7233
          hostPort      = 7233
          protocol      = "tcp"
          name          = "grpc"
        },
        {
          containerPort = 6933
          hostPort      = 6933
          protocol      = "tcp"
          name          = "membership"
        }
      ]

      environment = [
        { name = "DB", value = "postgresql" },
        { name = "DB_PORT", value = tostring(aws_db_instance.temporal.port) },
        { name = "POSTGRES_USER", value = aws_db_instance.temporal.username },
        { name = "POSTGRES_DB", value = aws_db_instance.temporal.db_name },
        { name = "POSTGRES_SEEDS", value = aws_db_instance.temporal.address },
        { name = "DYNAMIC_CONFIG_FILE_PATH", value = "config/dynamicconfig/development-sql.yaml" },
        { name = "ENABLE_ES", value = "false" },
        { name = "ES_SEEDS", value = "" },
        { name = "ES_VERSION", value = "v7" },
        { name = "TEMPORAL_ADDRESS", value = "0.0.0.0:7233" },
        { name = "TEMPORAL_CLI_ADDRESS", value = "temporal:7233" },
        { name = "SERVICES", value = "history,matching,frontend,worker" },
        { name = "NUM_HISTORY_SHARDS", value = "512" },
        { name = "LOG_LEVEL", value = var.log_level }
      ]

      secrets = [
        {
          name      = "POSTGRES_PWD"
          valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:password::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.temporal_server.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command = [
          "CMD-SHELL",
          "temporal workflow list --namespace ${var.namespace} --address localhost:7233 || exit 1"
        ]
        interval    = 30
        timeout     = 10
        retries     = 5
        startPeriod = 120
      }
    }
  ])

  tags = var.tags
}

# -----------------------------------------------------------------------------
# ECS Task Definition - Temporal UI
# -----------------------------------------------------------------------------

resource "aws_ecs_task_definition" "temporal_ui" {
  family                   = "${var.name_prefix}-temporal-ui"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ui_task_cpu
  memory                   = var.ui_task_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "temporal-ui"
      image     = var.temporal_ui_image
      essential = true

      portMappings = [
        {
          containerPort = 8080
          hostPort      = 8080
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "TEMPORAL_ADDRESS", value = "temporal-server.${var.name_prefix}.local:7233" },
        { name = "TEMPORAL_CORS_ORIGINS", value = "http://localhost:3000" },
        { name = "TEMPORAL_UI_PORT", value = "8080" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.temporal_ui.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = var.tags
}

# -----------------------------------------------------------------------------
# ECS Services
# -----------------------------------------------------------------------------

resource "aws_ecs_service" "temporal_server" {
  name            = "${var.name_prefix}-temporal-server"
  cluster         = var.ecs_cluster_id
  task_definition = aws_ecs_task_definition.temporal_server.arn
  desired_count   = var.server_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.temporal_security_group_id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.temporal_server.arn
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

  depends_on = [aws_db_instance.temporal]

  tags = var.tags
}

resource "aws_ecs_service" "temporal_ui" {
  name            = "${var.name_prefix}-temporal-ui"
  cluster         = var.ecs_cluster_id
  task_definition = aws_ecs_task_definition.temporal_ui.arn
  desired_count   = var.ui_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.temporal_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.temporal_ui.arn
    container_name   = "temporal-ui"
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

  depends_on = [aws_ecs_service.temporal_server]

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Service Discovery (Cloud Map)
# -----------------------------------------------------------------------------

resource "aws_service_discovery_private_dns_namespace" "temporal" {
  name = "${var.name_prefix}.local"
  vpc  = var.vpc_id

  tags = var.tags
}

resource "aws_service_discovery_service" "temporal_server" {
  name = "temporal-server"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.temporal.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# ALB Target Group - Temporal UI
# -----------------------------------------------------------------------------

resource "aws_lb_target_group" "temporal_ui" {
  name        = "${var.name_prefix}-temporal-ui-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = var.tags
}

# -----------------------------------------------------------------------------
# ALB Listener Rule - Temporal UI
# -----------------------------------------------------------------------------

resource "aws_lb_listener_rule" "temporal_ui" {
  listener_arn = var.alb_https_listener_arn
  priority     = 60

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.temporal_ui.arn
  }

  condition {
    path_pattern {
      values = ["/temporal/*", "/temporal-ui/*"]
    }
  }

  tags = var.tags
}
