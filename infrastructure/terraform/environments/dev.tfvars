# =============================================================================
# Development Environment Configuration
# =============================================================================
# Cost-optimized settings for development/testing
# =============================================================================

# -----------------------------------------------------------------------------
# General Configuration
# -----------------------------------------------------------------------------

project_name = "ananta"
environment  = "dev"
aws_region   = "us-east-1"

tags = {
  Environment = "dev"
  Project     = "ananta-platform"
  ManagedBy   = "terraform"
  CostCenter  = "development"
}

# -----------------------------------------------------------------------------
# Network Configuration
# -----------------------------------------------------------------------------

vpc_cidr = "10.0.0.0/16"

availability_zones = [
  "us-east-1a",
  "us-east-1b"
]

public_subnet_cidrs = [
  "10.0.1.0/24",
  "10.0.2.0/24"
]

private_subnet_cidrs = [
  "10.0.11.0/24",
  "10.0.12.0/24"
]

database_subnet_cidrs = [
  "10.0.21.0/24",
  "10.0.22.0/24"
]

# Cost optimization: Single NAT Gateway
enable_nat_gateway = true
single_nat_gateway = true

# -----------------------------------------------------------------------------
# Control Plane Database Configuration
# -----------------------------------------------------------------------------

control_plane_db_instance_class         = "db.t3.micro"
control_plane_db_allocated_storage      = 20
control_plane_db_max_allocated_storage  = 50
control_plane_db_engine_version         = "15.4"
control_plane_db_multi_az               = false
control_plane_db_backup_retention_period = 3

# -----------------------------------------------------------------------------
# App Plane Database Configuration
# -----------------------------------------------------------------------------

app_plane_db_instance_class         = "db.t3.micro"
app_plane_db_allocated_storage      = 20
app_plane_db_max_allocated_storage  = 100
app_plane_db_engine_version         = "15.4"
app_plane_db_multi_az               = false

# -----------------------------------------------------------------------------
# Components Database Configuration
# -----------------------------------------------------------------------------

components_db_instance_class    = "db.t3.micro"
components_db_allocated_storage = 10

# -----------------------------------------------------------------------------
# ElastiCache (Redis) Configuration
# -----------------------------------------------------------------------------

redis_node_type                  = "cache.t3.micro"
redis_num_cache_nodes            = 1
redis_engine_version             = "7.0"
redis_parameter_group_family     = "redis7"
redis_automatic_failover_enabled = false

# -----------------------------------------------------------------------------
# ECS Configuration
# -----------------------------------------------------------------------------

ecs_cluster_name          = "ananta-dev-cluster"
enable_container_insights = true
ecs_log_retention_days    = 7

# Control Plane Services (minimal resources)
tenant_mgmt_cpu           = 256
tenant_mgmt_memory        = 512
tenant_mgmt_desired_count = 1

# App Plane Services (minimal resources)
cns_service_cpu           = 256
cns_service_memory        = 512
cns_service_desired_count = 1

# -----------------------------------------------------------------------------
# Auto Scaling Configuration
# -----------------------------------------------------------------------------

enable_autoscaling         = false  # Disabled for dev
autoscaling_min_capacity   = 1
autoscaling_max_capacity   = 2
autoscaling_cpu_target     = 80
autoscaling_memory_target  = 80

# -----------------------------------------------------------------------------
# Secrets Management
# -----------------------------------------------------------------------------

secrets_manager_prefix    = "ananta-dev"
enable_secrets_rotation   = false  # Disabled for dev
secrets_rotation_days     = 30

# -----------------------------------------------------------------------------
# Keycloak Configuration
# -----------------------------------------------------------------------------

keycloak_instance_class    = "t3.micro"
keycloak_db_instance_class = "db.t3.micro"

# -----------------------------------------------------------------------------
# Temporal Configuration
# -----------------------------------------------------------------------------

temporal_db_instance_class = "db.t3.micro"
temporal_namespace         = "arc-saas"

# -----------------------------------------------------------------------------
# Message Queue Configuration
# -----------------------------------------------------------------------------

mq_instance_type   = "mq.t3.micro"
mq_engine_version  = "3.11.20"
mq_deployment_mode = "SINGLE_INSTANCE"

# -----------------------------------------------------------------------------
# Object Storage Configuration
# -----------------------------------------------------------------------------

s3_bucket_prefix     = "ananta-dev"
enable_s3_versioning = false
s3_lifecycle_days    = 30

# -----------------------------------------------------------------------------
# Monitoring & Observability
# -----------------------------------------------------------------------------

enable_prometheus          = true
enable_grafana             = true
enable_jaeger              = true
prometheus_retention_days  = 7

# -----------------------------------------------------------------------------
# Domain Configuration (Optional)
# -----------------------------------------------------------------------------

domain_name        = ""
create_dns_records = false
acm_certificate_arn = ""
