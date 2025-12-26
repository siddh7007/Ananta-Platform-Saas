# =============================================================================
# Production Environment Configuration
# =============================================================================
# High-availability, secure settings for production workloads
# =============================================================================

# -----------------------------------------------------------------------------
# General Configuration
# -----------------------------------------------------------------------------

project_name = "ananta"
environment  = "prod"
aws_region   = "us-east-1"

tags = {
  Environment = "prod"
  Project     = "ananta-platform"
  ManagedBy   = "terraform"
  CostCenter  = "production"
  Compliance  = "required"
}

# -----------------------------------------------------------------------------
# Network Configuration
# -----------------------------------------------------------------------------

vpc_cidr = "10.2.0.0/16"

availability_zones = [
  "us-east-1a",
  "us-east-1b",
  "us-east-1c"
]

public_subnet_cidrs = [
  "10.2.1.0/24",
  "10.2.2.0/24",
  "10.2.3.0/24"
]

private_subnet_cidrs = [
  "10.2.11.0/24",
  "10.2.12.0/24",
  "10.2.13.0/24"
]

database_subnet_cidrs = [
  "10.2.21.0/24",
  "10.2.22.0/24",
  "10.2.23.0/24"
]

# High availability: NAT Gateway per AZ
enable_nat_gateway = true
single_nat_gateway = false

# -----------------------------------------------------------------------------
# Control Plane Database Configuration
# -----------------------------------------------------------------------------

control_plane_db_instance_class         = "db.r6g.large"
control_plane_db_allocated_storage      = 50
control_plane_db_max_allocated_storage  = 500
control_plane_db_engine_version         = "15.4"
control_plane_db_multi_az               = true
control_plane_db_backup_retention_period = 30

# High Availability - Read Replicas
control_plane_db_create_read_replica    = true
control_plane_db_replica_count          = 2
control_plane_db_replica_instance_class = "db.r6g.large"

# Connection Pooling - RDS Proxy
control_plane_db_create_rds_proxy       = true

# -----------------------------------------------------------------------------
# App Plane Database Configuration
# -----------------------------------------------------------------------------

app_plane_db_instance_class         = "db.r6g.large"
app_plane_db_allocated_storage      = 100
app_plane_db_max_allocated_storage  = 1000
app_plane_db_engine_version         = "15.4"
app_plane_db_multi_az               = true

# High Availability - Read Replicas
app_plane_db_create_read_replica    = true
app_plane_db_replica_count          = 2
app_plane_db_replica_instance_class = "db.r6g.large"

# Connection Pooling - RDS Proxy
app_plane_db_create_rds_proxy       = true

# -----------------------------------------------------------------------------
# Components Database Configuration
# -----------------------------------------------------------------------------

components_db_instance_class    = "db.r6g.medium"
components_db_allocated_storage = 50

# -----------------------------------------------------------------------------
# ElastiCache (Redis) Configuration
# -----------------------------------------------------------------------------

redis_node_type                  = "cache.r6g.large"
redis_num_cache_nodes            = 3
redis_engine_version             = "7.0"
redis_parameter_group_family     = "redis7"
redis_automatic_failover_enabled = true

# -----------------------------------------------------------------------------
# ECS Configuration
# -----------------------------------------------------------------------------

ecs_cluster_name          = "ananta-prod-cluster"
enable_container_insights = true
ecs_log_retention_days    = 90

# Control Plane Services (production resources)
tenant_mgmt_cpu           = 1024
tenant_mgmt_memory        = 2048
tenant_mgmt_desired_count = 3

# App Plane Services (production resources)
cns_service_cpu           = 1024
cns_service_memory        = 2048
cns_service_desired_count = 3

# -----------------------------------------------------------------------------
# Auto Scaling Configuration
# -----------------------------------------------------------------------------

enable_autoscaling          = true
autoscaling_min_capacity    = 2
autoscaling_max_capacity    = 20
autoscaling_cpu_target      = 60
autoscaling_memory_target   = 70
autoscaling_scale_in_cooldown  = 600
autoscaling_scale_out_cooldown = 60

# -----------------------------------------------------------------------------
# Secrets Management
# -----------------------------------------------------------------------------

secrets_manager_prefix    = "ananta-prod"
enable_secrets_rotation   = true
secrets_rotation_days     = 14

# -----------------------------------------------------------------------------
# Keycloak Configuration
# -----------------------------------------------------------------------------

keycloak_instance_class    = "t3.medium"
keycloak_db_instance_class = "db.r6g.medium"

# -----------------------------------------------------------------------------
# Temporal Configuration
# -----------------------------------------------------------------------------

temporal_db_instance_class = "db.r6g.medium"
temporal_namespace         = "arc-saas"

# -----------------------------------------------------------------------------
# Message Queue Configuration
# -----------------------------------------------------------------------------

mq_instance_type   = "mq.m5.large"
mq_engine_version  = "3.11.20"
mq_deployment_mode = "CLUSTER_MULTI_AZ"

# -----------------------------------------------------------------------------
# Object Storage Configuration
# -----------------------------------------------------------------------------

s3_bucket_prefix     = "ananta-prod"
enable_s3_versioning = true
s3_lifecycle_days    = 180

# -----------------------------------------------------------------------------
# Monitoring & Observability
# -----------------------------------------------------------------------------

enable_prometheus          = true
enable_grafana             = true
enable_jaeger              = true
prometheus_retention_days  = 30

# -----------------------------------------------------------------------------
# Domain Configuration
# -----------------------------------------------------------------------------

domain_name        = "app.ananta.example.com"
create_dns_records = true
acm_certificate_arn = ""  # Set via environment-specific secret
