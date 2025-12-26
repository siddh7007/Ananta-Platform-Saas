# =============================================================================
# ECS Module - Cluster, Services, Auto-Scaling, ALB
# =============================================================================

# -----------------------------------------------------------------------------
# ECS Cluster
# -----------------------------------------------------------------------------

resource "aws_ecs_cluster" "main" {
  name = "${var.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = var.enable_container_insights ? "enabled" : "disabled"
  }

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"
      log_configuration {
        cloud_watch_log_group_name = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }

  tags = var.tags
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

# -----------------------------------------------------------------------------
# CloudWatch Log Groups
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "ecs_exec" {
  name              = "/aws/ecs/${var.name_prefix}/exec"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.cloudwatch_kms_key_id

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "tenant_mgmt" {
  name              = "/aws/ecs/${var.name_prefix}/tenant-management"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.cloudwatch_kms_key_id

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "cns_service" {
  name              = "/aws/ecs/${var.name_prefix}/cns-service"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.cloudwatch_kms_key_id

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "temporal_worker" {
  name              = "/aws/ecs/${var.name_prefix}/temporal-worker"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "orchestrator" {
  name              = "/aws/ecs/${var.name_prefix}/orchestrator"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "subscription" {
  name              = "/aws/ecs/${var.name_prefix}/subscription"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "keycloak" {
  name              = "/aws/ecs/${var.name_prefix}/keycloak"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "temporal" {
  name              = "/aws/ecs/${var.name_prefix}/temporal"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "temporal_ui" {
  name              = "/aws/ecs/${var.name_prefix}/temporal-ui"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "admin_app" {
  name              = "/aws/ecs/${var.name_prefix}/admin-app"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "customer_portal" {
  name              = "/aws/ecs/${var.name_prefix}/customer-portal"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "cns_dashboard" {
  name              = "/aws/ecs/${var.name_prefix}/cns-dashboard"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "novu" {
  name              = "/aws/ecs/${var.name_prefix}/novu"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Security Groups
# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------
# Security Groups
# -----------------------------------------------------------------------------
# NOTE: Security groups are now provided externally via variables
# to break circular dependencies. See modules/security-groups for
# centralized security group creation.


# -----------------------------------------------------------------------------
# Application Load Balancer
# -----------------------------------------------------------------------------

resource "aws_lb" "main" {
  name               = "${var.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = var.enable_alb_deletion_protection

  access_logs {
    bucket  = var.alb_logs_bucket
    prefix  = "${var.name_prefix}-alb"
    enabled = var.alb_logs_bucket != ""
  }

  tags = var.tags
}

# HTTP to HTTPS redirect listener
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS listener (requires ACM certificate)
resource "aws_lb_listener" "https" {
  count = var.acm_certificate_arn != "" ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "application/json"
      message_body = "{\"status\":\"ok\",\"service\":\"ananta-platform\"}"
      status_code  = "200"
    }
  }
}

# -----------------------------------------------------------------------------
# IAM Roles for ECS Tasks
# -----------------------------------------------------------------------------

# Task Execution Role (for ECS agent to pull images, write logs)
resource "aws_iam_role" "ecs_execution" {
  name = "${var.name_prefix}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${var.name_prefix}-ecs-secrets-policy"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          var.control_plane_db_secret_arn,
          var.app_plane_db_secret_arn,
          var.components_db_secret_arn
        ]
      }
    ]
  })
}

# Task Role (for application to access AWS services)
resource "aws_iam_role" "ecs_task" {
  name = "${var.name_prefix}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "ecs_task" {
  name = "${var.name_prefix}-ecs-task-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECSExecSSMAccess"
        Effect = "Allow"
        Action = [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      },
      {
        Sid    = "CloudWatchLogsAccess"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "${aws_cloudwatch_log_group.ecs_exec.arn}:*",
          "${aws_cloudwatch_log_group.tenant_mgmt.arn}:*",
          "${aws_cloudwatch_log_group.cns_service.arn}:*",
          "${aws_cloudwatch_log_group.temporal_worker.arn}:*",
          "${aws_cloudwatch_log_group.orchestrator.arn}:*",
          "${aws_cloudwatch_log_group.subscription.arn}:*",
          "${aws_cloudwatch_log_group.keycloak.arn}:*",
          "${aws_cloudwatch_log_group.temporal.arn}:*",
          "${aws_cloudwatch_log_group.temporal_ui.arn}:*",
          "${aws_cloudwatch_log_group.admin_app.arn}:*",
          "${aws_cloudwatch_log_group.customer_portal.arn}:*",
          "${aws_cloudwatch_log_group.cns_dashboard.arn}:*",
          "${aws_cloudwatch_log_group.novu.arn}:*"
        ]
      },
      {
        Sid    = "S3BucketAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.name_prefix}-*",
          "arn:aws:s3:::${var.name_prefix}-*/*"
        ]
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Target Groups
# -----------------------------------------------------------------------------

resource "aws_lb_target_group" "tenant_mgmt" {
  name        = "${var.name_prefix}-tenant-mgmt"
  port        = 14000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = var.tags
}

resource "aws_lb_target_group" "cns_service" {
  name        = "${var.name_prefix}-cns-service"
  port        = 27200
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = var.tags
}

resource "aws_lb_target_group" "orchestrator" {
  name        = "${var.name_prefix}-orchestrator"
  port        = 14001
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = var.tags
}

resource "aws_lb_target_group" "subscription" {
  name        = "${var.name_prefix}-subscription"
  port        = 14002
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = var.tags
}

resource "aws_lb_target_group" "keycloak" {
  name        = "${var.name_prefix}-keycloak"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = var.tags
}

resource "aws_lb_target_group" "temporal_ui" {
  name        = "${var.name_prefix}-temporal-ui"
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

  tags = var.tags
}

resource "aws_lb_target_group" "admin_app" {
  name        = "${var.name_prefix}-admin-app"
  port        = 80
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

  tags = var.tags
}

resource "aws_lb_target_group" "customer_portal" {
  name        = "${var.name_prefix}-customer-portal"
  port        = 80
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

  tags = var.tags
}

resource "aws_lb_target_group" "cns_dashboard" {
  name        = "${var.name_prefix}-cns-dashboard"
  port        = 80
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

  tags = var.tags
}

resource "aws_lb_target_group" "novu" {
  name        = "${var.name_prefix}-novu"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/v1/health-check"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Listener Rules
# -----------------------------------------------------------------------------

resource "aws_lb_listener_rule" "tenant_mgmt" {
  count = var.acm_certificate_arn != "" ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tenant_mgmt.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/health/*", "/explorer/*"]
    }
  }
}

resource "aws_lb_listener_rule" "cns_service" {
  count = var.acm_certificate_arn != "" ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 200

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.cns_service.arn
  }

  condition {
    path_pattern {
      values = ["/cns/*", "/api/bom/*", "/api/enrichment/*"]
    }
  }
}

resource "aws_lb_listener_rule" "orchestrator" {
  count = var.acm_certificate_arn != "" ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 300

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.orchestrator.arn
  }

  condition {
    path_pattern {
      values = ["/orchestrator/*"]
    }
  }
}

resource "aws_lb_listener_rule" "subscription" {
  count = var.acm_certificate_arn != "" ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 400

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.subscription.arn
  }

  condition {
    path_pattern {
      values = ["/subscription/*"]
    }
  }
}

resource "aws_lb_listener_rule" "keycloak" {
  count = var.acm_certificate_arn != "" ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 500

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.keycloak.arn
  }

  condition {
    path_pattern {
      values = ["/auth/*", "/realms/*"]
    }
  }
}

resource "aws_lb_listener_rule" "temporal_ui" {
  count = var.acm_certificate_arn != "" ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 600

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.temporal_ui.arn
  }

  condition {
    path_pattern {
      values = ["/temporal/*"]
    }
  }
}

resource "aws_lb_listener_rule" "admin_app" {
  count = var.acm_certificate_arn != "" ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 700

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.admin_app.arn
  }

  condition {
    host_header {
      values = ["admin.${var.domain_name}"]
    }
  }
}

resource "aws_lb_listener_rule" "customer_portal" {
  count = var.acm_certificate_arn != "" ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 800

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.customer_portal.arn
  }

  condition {
    host_header {
      values = ["app.${var.domain_name}"]
    }
  }
}

resource "aws_lb_listener_rule" "cns_dashboard" {
  count = var.acm_certificate_arn != "" ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 900

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.cns_dashboard.arn
  }

  condition {
    host_header {
      values = ["cns.${var.domain_name}"]
    }
  }
}

resource "aws_lb_listener_rule" "novu" {
  count = var.acm_certificate_arn != "" ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 1000

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.novu.arn
  }

  condition {
    path_pattern {
      values = ["/novu/*", "/v1/*"]
    }
  }
}

# -----------------------------------------------------------------------------
# ECS Task Definitions
# -----------------------------------------------------------------------------

resource "aws_ecs_task_definition" "tenant_mgmt" {
  family                   = "${var.name_prefix}-tenant-management"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.tenant_mgmt_cpu
  memory                   = var.tenant_mgmt_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "tenant-management-service"
      image     = var.tenant_mgmt_image
      essential = true

      portMappings = [
        {
          containerPort = 14000
          hostPort      = 14000
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "14000" },
        { name = "REDIS_URL", value = "redis://${var.redis_endpoint}:6379" }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${var.control_plane_db_secret_arn}:connection_string::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.tenant_mgmt.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:14000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = var.tags
}

resource "aws_ecs_task_definition" "cns_service" {
  family                   = "${var.name_prefix}-cns-service"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cns_service_cpu
  memory                   = var.cns_service_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "cns-service"
      image     = var.cns_service_image
      essential = true

      portMappings = [
        {
          containerPort = 27200
          hostPort      = 27200
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "ENVIRONMENT", value = "production" },
        { name = "PORT", value = "27200" },
        { name = "REDIS_URL", value = "redis://${var.redis_endpoint}:6379" },
        { name = "OTEL_EXPORTER_OTLP_ENDPOINT", value = var.jaeger_endpoint },
        { name = "OTEL_SERVICE_NAME", value = "cns-service" }
      ]

      secrets = [
        {
          name      = "SUPABASE_DATABASE_URL"
          valueFrom = "${var.app_plane_db_secret_arn}:connection_string::"
        },
        {
          name      = "COMPONENTS_DATABASE_URL"
          valueFrom = "${var.components_db_secret_arn}:connection_string::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.cns_service.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:27200/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = var.tags
}

# Temporal Worker Service - No HTTP interface
resource "aws_ecs_task_definition" "temporal_worker" {
  family                   = "${var.name_prefix}-temporal-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.temporal_worker_cpu
  memory                   = var.temporal_worker_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "temporal-worker-service"
      image     = var.temporal_worker_image
      essential = true

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "TEMPORAL_ADDRESS", value = var.temporal_address },
        { name = "TEMPORAL_NAMESPACE", value = "arc-saas" },
        { name = "TEMPORAL_TASK_QUEUE", value = "tenant-provisioning" }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${var.control_plane_db_secret_arn}:connection_string::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.temporal_worker.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = var.tags
}

# Orchestrator Service
resource "aws_ecs_task_definition" "orchestrator" {
  family                   = "${var.name_prefix}-orchestrator"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.orchestrator_cpu
  memory                   = var.orchestrator_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "orchestrator-service"
      image     = var.orchestrator_image
      essential = true

      portMappings = [
        {
          containerPort = 14001
          hostPort      = 14001
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "14001" }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${var.control_plane_db_secret_arn}:connection_string::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.orchestrator.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:14001/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = var.tags
}

# Subscription Service
resource "aws_ecs_task_definition" "subscription" {
  family                   = "${var.name_prefix}-subscription"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.subscription_cpu
  memory                   = var.subscription_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "subscription-service"
      image     = var.subscription_image
      essential = true

      portMappings = [
        {
          containerPort = 14002
          hostPort      = 14002
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "14002" }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${var.control_plane_db_secret_arn}:connection_string::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.subscription.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:14002/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = var.tags
}

# Keycloak
resource "aws_ecs_task_definition" "keycloak" {
  family                   = "${var.name_prefix}-keycloak"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.keycloak_cpu
  memory                   = var.keycloak_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

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
        { name = "KC_PROXY", value = "edge" },
        { name = "KC_HOSTNAME_STRICT", value = "false" },
        { name = "KC_HTTP_ENABLED", value = "true" },
        { name = "KC_HEALTH_ENABLED", value = "true" },
        { name = "KC_METRICS_ENABLED", value = "true" }
      ]

      secrets = [
        {
          name      = "KC_DB_URL"
          valueFrom = "${var.control_plane_db_secret_arn}:keycloak_jdbc_url::"
        },
        {
          name      = "KC_DB_USERNAME"
          valueFrom = "${var.control_plane_db_secret_arn}:username::"
        },
        {
          name      = "KC_DB_PASSWORD"
          valueFrom = "${var.control_plane_db_secret_arn}:password::"
        },
        {
          name      = "KEYCLOAK_ADMIN"
          valueFrom = "${var.control_plane_db_secret_arn}:keycloak_admin_user::"
        },
        {
          name      = "KEYCLOAK_ADMIN_PASSWORD"
          valueFrom = "${var.control_plane_db_secret_arn}:keycloak_admin_password::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.keycloak.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 120
      }
    }
  ])

  tags = var.tags
}

# Temporal Server
resource "aws_ecs_task_definition" "temporal" {
  family                   = "${var.name_prefix}-temporal"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.temporal_cpu
  memory                   = var.temporal_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "temporal"
      image     = var.temporal_image
      essential = true

      portMappings = [
        {
          containerPort = 7233
          hostPort      = 7233
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "DB", value = "postgresql" },
        { name = "DB_PORT", value = "5432" },
        { name = "POSTGRES_SEEDS", value = var.rds_endpoint },
        { name = "DYNAMIC_CONFIG_FILE_PATH", value = "config/dynamicconfig/development-sql.yaml" }
      ]

      secrets = [
        {
          name      = "POSTGRES_USER"
          valueFrom = "${var.control_plane_db_secret_arn}:username::"
        },
        {
          name      = "POSTGRES_PWD"
          valueFrom = "${var.control_plane_db_secret_arn}:password::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.temporal.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = var.tags
}

# Temporal UI
resource "aws_ecs_task_definition" "temporal_ui" {
  family                   = "${var.name_prefix}-temporal-ui"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.temporal_ui_cpu
  memory                   = var.temporal_ui_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

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
        { name = "TEMPORAL_ADDRESS", value = "${var.temporal_address}" },
        { name = "TEMPORAL_CORS_ORIGINS", value = "http://localhost:3000" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.temporal_ui.name
          awslogs-region        = data.aws_region.current.name
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

# Admin App (React)
resource "aws_ecs_task_definition" "admin_app" {
  family                   = "${var.name_prefix}-admin-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.admin_app_cpu
  memory                   = var.admin_app_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "admin-app"
      image     = var.admin_app_image
      essential = true

      portMappings = [
        {
          containerPort = 80
          hostPort      = 80
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "VITE_API_URL", value = "https://${var.domain_name}/api" },
        { name = "VITE_KEYCLOAK_URL", value = "https://${var.domain_name}/auth" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.admin_app.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost/ || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = var.tags
}

# Customer Portal (React)
resource "aws_ecs_task_definition" "customer_portal" {
  family                   = "${var.name_prefix}-customer-portal"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.customer_portal_cpu
  memory                   = var.customer_portal_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "customer-portal"
      image     = var.customer_portal_image
      essential = true

      portMappings = [
        {
          containerPort = 80
          hostPort      = 80
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "VITE_API_URL", value = "https://${var.domain_name}/api" },
        { name = "VITE_CNS_API_URL", value = "https://${var.domain_name}/cns" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.customer_portal.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost/ || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = var.tags
}

# CNS Dashboard (React)
resource "aws_ecs_task_definition" "cns_dashboard" {
  family                   = "${var.name_prefix}-cns-dashboard"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cns_dashboard_cpu
  memory                   = var.cns_dashboard_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "cns-dashboard"
      image     = var.cns_dashboard_image
      essential = true

      portMappings = [
        {
          containerPort = 80
          hostPort      = 80
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "VITE_CNS_API_URL", value = "https://${var.domain_name}/cns" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.cns_dashboard.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost/ || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = var.tags
}

# Novu Notification Service
resource "aws_ecs_task_definition" "novu" {
  family                   = "${var.name_prefix}-novu"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.novu_cpu
  memory                   = var.novu_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "novu"
      image     = var.novu_image
      essential = true

      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3000" },
        { name = "REDIS_HOST", value = var.redis_endpoint },
        { name = "REDIS_PORT", value = "6379" }
      ]

      secrets = [
        {
          name      = "MONGO_URL"
          valueFrom = "${var.control_plane_db_secret_arn}:novu_mongo_url::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.novu.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3000/v1/health-check || exit 1"]
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

resource "aws_ecs_service" "tenant_mgmt" {
  name            = "${var.name_prefix}-tenant-management"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.tenant_mgmt.arn
  desired_count   = var.tenant_mgmt_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.tenant_mgmt.arn
    container_name   = "tenant-management-service"
    container_port   = 14000
  }

  # Service Discovery Registration
  dynamic "service_registries" {
    for_each = var.enable_service_discovery && contains(keys(var.service_discovery_arns), "tenant-management-service") ? [1] : []
    content {
      registry_arn   = var.service_discovery_arns["tenant-management-service"]
      container_name = "tenant-management-service"
      container_port = 14000
    }
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

  tags = var.tags
}

resource "aws_ecs_service" "cns_service" {
  name            = "${var.name_prefix}-cns-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.cns_service.arn
  desired_count   = var.cns_service_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.cns_service.arn
    container_name   = "cns-service"
    container_port   = 27200
  }

  # Service Discovery Registration
  dynamic "service_registries" {
    for_each = var.enable_service_discovery && contains(keys(var.service_discovery_arns), "cns-service") ? [1] : []
    content {
      registry_arn   = var.service_discovery_arns["cns-service"]
      container_name = "cns-service"
      container_port = 27200
    }
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

  tags = var.tags
}

# Temporal Worker Service (No load balancer - worker only)
resource "aws_ecs_service" "temporal_worker" {
  name            = "${var.name_prefix}-temporal-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.temporal_worker.arn
  desired_count   = var.temporal_worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
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

  tags = var.tags
}

# Orchestrator Service
resource "aws_ecs_service" "orchestrator" {
  name            = "${var.name_prefix}-orchestrator"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.orchestrator.arn
  desired_count   = var.orchestrator_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.orchestrator.arn
    container_name   = "orchestrator-service"
    container_port   = 14001
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

  tags = var.tags
}

# Subscription Service
resource "aws_ecs_service" "subscription" {
  name            = "${var.name_prefix}-subscription"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.subscription.arn
  desired_count   = var.subscription_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.subscription.arn
    container_name   = "subscription-service"
    container_port   = 14002
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

  tags = var.tags
}

# Keycloak Service
resource "aws_ecs_service" "keycloak" {
  name            = "${var.name_prefix}-keycloak"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.keycloak.arn
  desired_count   = var.keycloak_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.keycloak.arn
    container_name   = "keycloak"
    container_port   = 8080
  }

  # Service Discovery Registration (for backend services to validate tokens)
  dynamic "service_registries" {
    for_each = var.enable_service_discovery && contains(keys(var.service_discovery_arns), "keycloak") ? [1] : []
    content {
      registry_arn   = var.service_discovery_arns["keycloak"]
      container_name = "keycloak"
      container_port = 8080
    }
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

  tags = var.tags
}

# Temporal Server (No load balancer - gRPC internal)
resource "aws_ecs_service" "temporal" {
  name            = "${var.name_prefix}-temporal"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.temporal.arn
  desired_count   = var.temporal_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  # Service Discovery Registration (critical for Temporal workers)
  dynamic "service_registries" {
    for_each = var.enable_service_discovery && contains(keys(var.service_discovery_arns), "temporal") ? [1] : []
    content {
      registry_arn   = var.service_discovery_arns["temporal"]
      container_name = "temporal"
      container_port = 7233
    }
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

  tags = var.tags
}

# Temporal UI Service
resource "aws_ecs_service" "temporal_ui" {
  name            = "${var.name_prefix}-temporal-ui"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.temporal_ui.arn
  desired_count   = var.temporal_ui_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
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

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = var.tags
}

# Admin App Service
resource "aws_ecs_service" "admin_app" {
  name            = "${var.name_prefix}-admin-app"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.admin_app.arn
  desired_count   = var.admin_app_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.admin_app.arn
    container_name   = "admin-app"
    container_port   = 80
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

  tags = var.tags
}

# Customer Portal Service
resource "aws_ecs_service" "customer_portal" {
  name            = "${var.name_prefix}-customer-portal"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.customer_portal.arn
  desired_count   = var.customer_portal_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.customer_portal.arn
    container_name   = "customer-portal"
    container_port   = 80
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

  tags = var.tags
}

# CNS Dashboard Service
resource "aws_ecs_service" "cns_dashboard" {
  name            = "${var.name_prefix}-cns-dashboard"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.cns_dashboard.arn
  desired_count   = var.cns_dashboard_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.cns_dashboard.arn
    container_name   = "cns-dashboard"
    container_port   = 80
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

  tags = var.tags
}

# Novu Service
resource "aws_ecs_service" "novu" {
  name            = "${var.name_prefix}-novu"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.novu.arn
  desired_count   = var.novu_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.novu.arn
    container_name   = "novu"
    container_port   = 3000
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

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Auto Scaling
# -----------------------------------------------------------------------------

resource "aws_appautoscaling_target" "tenant_mgmt" {
  count = var.enable_autoscaling ? 1 : 0

  max_capacity       = var.autoscaling_max_capacity
  min_capacity       = var.autoscaling_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.tenant_mgmt.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "tenant_mgmt_cpu" {
  count = var.enable_autoscaling ? 1 : 0

  name               = "${var.name_prefix}-tenant-mgmt-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.tenant_mgmt[0].resource_id
  scalable_dimension = aws_appautoscaling_target.tenant_mgmt[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.tenant_mgmt[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = var.autoscaling_cpu_target
    scale_in_cooldown  = var.autoscaling_scale_in_cooldown
    scale_out_cooldown = var.autoscaling_scale_out_cooldown
  }
}

resource "aws_appautoscaling_policy" "tenant_mgmt_memory" {
  count = var.enable_autoscaling ? 1 : 0

  name               = "${var.name_prefix}-tenant-mgmt-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.tenant_mgmt[0].resource_id
  scalable_dimension = aws_appautoscaling_target.tenant_mgmt[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.tenant_mgmt[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = var.autoscaling_memory_target
    scale_in_cooldown  = var.autoscaling_scale_in_cooldown
    scale_out_cooldown = var.autoscaling_scale_out_cooldown
  }
}

resource "aws_appautoscaling_target" "cns_service" {
  count = var.enable_autoscaling ? 1 : 0

  max_capacity       = var.autoscaling_max_capacity
  min_capacity       = var.autoscaling_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.cns_service.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cns_service_cpu" {
  count = var.enable_autoscaling ? 1 : 0

  name               = "${var.name_prefix}-cns-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.cns_service[0].resource_id
  scalable_dimension = aws_appautoscaling_target.cns_service[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.cns_service[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = var.autoscaling_cpu_target
    scale_in_cooldown  = var.autoscaling_scale_in_cooldown
    scale_out_cooldown = var.autoscaling_scale_out_cooldown
  }
}

resource "aws_appautoscaling_policy" "cns_service_memory" {
  count = var.enable_autoscaling ? 1 : 0

  name               = "${var.name_prefix}-cns-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.cns_service[0].resource_id
  scalable_dimension = aws_appautoscaling_target.cns_service[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.cns_service[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = var.autoscaling_memory_target
    scale_in_cooldown  = var.autoscaling_scale_in_cooldown
    scale_out_cooldown = var.autoscaling_scale_out_cooldown
  }
}

# -----------------------------------------------------------------------------
# Data Sources
# -----------------------------------------------------------------------------

data "aws_region" "current" {}

data "aws_caller_identity" "current" {}
