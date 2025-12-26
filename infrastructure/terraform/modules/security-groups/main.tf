# =============================================================================
# Security Groups Module
# =============================================================================
# This module creates all security groups to break circular dependencies
# between database and ECS modules.
#
# Created security groups:
# - ALB security group (public-facing load balancer)
# - ECS security group (Fargate tasks)
# - RDS security group (PostgreSQL databases)
# - Redis security group (ElastiCache)
# - RabbitMQ security group (Amazon MQ)
# - Temporal security group
# - Keycloak security group
# =============================================================================

# -----------------------------------------------------------------------------
# ALB Security Group (Public Internet → Load Balancer)
# -----------------------------------------------------------------------------

resource "aws_security_group" "alb" {
  name_prefix = "${var.name_prefix}-alb-"
  description = "Security group for Application Load Balancer"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP from internet"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS from internet"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-alb-sg"
  })
}

# -----------------------------------------------------------------------------
# ECS Security Group (Fargate Tasks)
# -----------------------------------------------------------------------------

resource "aws_security_group" "ecs" {
  name_prefix = "${var.name_prefix}-ecs-"
  description = "Security group for ECS Fargate tasks"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    security_groups = [aws_security_group.alb.id]
    description     = "Allow all from ALB"
  }

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
    description = "Allow all between ECS tasks"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-ecs-sg"
  })
}

# -----------------------------------------------------------------------------
# RDS Security Group (PostgreSQL Databases)
# -----------------------------------------------------------------------------

resource "aws_security_group" "rds" {
  name_prefix = "${var.name_prefix}-rds-"
  description = "Security group for RDS PostgreSQL instances"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
    description     = "PostgreSQL from ECS tasks"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-rds-sg"
  })
}

# -----------------------------------------------------------------------------
# Redis Security Group (ElastiCache)
# -----------------------------------------------------------------------------

resource "aws_security_group" "redis" {
  name_prefix = "${var.name_prefix}-redis-"
  description = "Security group for ElastiCache Redis"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
    description     = "Redis from ECS tasks"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis-sg"
  })
}

# -----------------------------------------------------------------------------
# RabbitMQ Security Group (Amazon MQ)
# -----------------------------------------------------------------------------

resource "aws_security_group" "rabbitmq" {
  name_prefix = "${var.name_prefix}-rabbitmq-"
  description = "Security group for Amazon MQ (RabbitMQ)"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5671
    to_port         = 5671
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
    description     = "AMQP over TLS from ECS tasks"
  }

  ingress {
    from_port       = 5672
    to_port         = 5672
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
    description     = "AMQP from ECS tasks"
  }

  ingress {
    from_port       = 15672
    to_port         = 15672
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
    description     = "Management UI from ECS tasks"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-rabbitmq-sg"
  })
}

# -----------------------------------------------------------------------------
# Temporal Security Group
# -----------------------------------------------------------------------------

resource "aws_security_group" "temporal" {
  name_prefix = "${var.name_prefix}-temporal-"
  description = "Security group for Temporal server"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 7233
    to_port         = 7233
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
    description     = "Temporal gRPC from ECS tasks"
  }

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "Temporal UI from ALB"
  }

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
    description = "Allow all within Temporal services"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-temporal-sg"
  })
}

# -----------------------------------------------------------------------------
# Keycloak Security Group
# -----------------------------------------------------------------------------

resource "aws_security_group" "keycloak" {
  name_prefix = "${var.name_prefix}-keycloak-"
  description = "Security group for Keycloak"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "Keycloak HTTP from ALB"
  }

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
    description     = "Keycloak HTTP from ECS tasks"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-keycloak-sg"
  })
}
