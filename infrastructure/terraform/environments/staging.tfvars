# =============================================================================
# Staging Environment Configuration
# =============================================================================
# Production-like settings for QA/staging testing
# =============================================================================

# -----------------------------------------------------------------------------
# General Configuration
# -----------------------------------------------------------------------------

project_name = "ananta"
environment  = "staging"
aws_region   = "us-east-1"

tags = {
  Environment = "staging"
  Project     = "ananta-platform"
  ManagedBy   = "terraform"
  CostCenter  = "staging"
}

# -----------------------------------------------------------------------------
# Network Configuration
# -----------------------------------------------------------------------------

vpc_cidr = "10.1.0.0/16"

availability_zones = [
  "us-east-1a",
  "us-east-1b",
  "us-east-1c"
]

public_subnet_cidrs = [
  "10.1.1.0/24",
  "10.1.2.0/24",
  "10.1.3.0/24"
]

private_subnet_cidrs = [
  "10.1.11.0/24",
  "10.1.12.0/24",
  "10.1.13.0/24"
]

database_subnet_cidrs = [
  "10.1.21.0/24",
  "10.1.22.0/24",
  "10.1.23.0/24"
]

# Single NAT Gateway for cost savings in staging
enable_nat_gateway = true
single_nat_gateway = true

# -----------------------------------------------------------------------------
# Control Plane Database Configuration
# -----------------------------------------------------------------------------

control_plane_db_instance_class         = "db.t3.small"
control_plane_db_allocated_storage      = 20
control_plane_db_max_allocated_storage  = 100
control_plane_db_engine_version         = "15.4"
control_plane_db_multi_az               = false
control_plane_db_backup_retention_period = 7

# -----------------------------------------------------------------------------
# App Plane Database Configuration
# -----------------------------------------------------------------------------

app_plane_db_instance_class         = "db.t3.small"
app_plane_db_allocated_storage      = 50
app_plane_db_max_allocated_storage  = 200
app_plane_db_engine_version         = "15.4"
app_plane_db_multi_az               = false

# -----------------------------------------------------------------------------
# Components Database Configuration
# -----------------------------------------------------------------------------

components_db_instance_class    = "db.t3.small"
components_db_allocated_storage = 20

# -----------------------------------------------------------------------------
# ElastiCache (Redis) Configuration
# -----------------------------------------------------------------------------

redis_node_type                  = "cache.t3.small"
redis_num_cache_nodes            = 2
redis_engine_version             = "7.0"
redis_parameter_group_family     = "redis7"
redis_automatic_failover_enabled = true

# -----------------------------------------------------------------------------
# ECS Configuration
# -----------------------------------------------------------------------------

ecs_cluster_name          = "ananta-staging-cluster"
enable_container_insights = true
ecs_log_retention_days    = 14

# Control Plane Services
tenant_mgmt_cpu           = 512
tenant_mgmt_memory        = 1024
tenant_mgmt_desired_count = 2

# App Plane Services
cns_service_cpu           = 512
cns_service_memory        = 1024
cns_service_desired_count = 2

# -----------------------------------------------------------------------------
# Auto Scaling Configuration
# -----------------------------------------------------------------------------

enable_autoscaling          = true
autoscaling_min_capacity    = 1
autoscaling_max_capacity    = 4
autoscaling_cpu_target      = 70
autoscaling_memory_target   = 80
autoscaling_scale_in_cooldown  = 300
autoscaling_scale_out_cooldown = 60

# -----------------------------------------------------------------------------
# Secrets Management
# -----------------------------------------------------------------------------

secrets_manager_prefix    = "ananta-staging"
enable_secrets_rotation   = true
secrets_rotation_days     = 30

# -----------------------------------------------------------------------------
# Keycloak Configuration
# -----------------------------------------------------------------------------

keycloak_instance_class    = "t3.small"
keycloak_db_instance_class = "db.t3.small"

# -----------------------------------------------------------------------------
# Temporal Configuration
# -----------------------------------------------------------------------------

temporal_db_instance_class = "db.t3.small"
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

s3_bucket_prefix     = "ananta-staging"
enable_s3_versioning = true
s3_lifecycle_days    = 60

# -----------------------------------------------------------------------------
# Monitoring & Observability
# -----------------------------------------------------------------------------

enable_prometheus          = true
enable_grafana             = true
enable_jaeger              = true
prometheus_retention_days  = 14

# -----------------------------------------------------------------------------
# Domain Configuration
# -----------------------------------------------------------------------------

domain_name        = "staging.ananta.example.com"
create_dns_records = true
acm_certificate_arn = ""  # Set via environment-specific secret
