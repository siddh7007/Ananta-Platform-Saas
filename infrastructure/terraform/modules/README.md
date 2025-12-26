# Terraform Modules - Ananta Platform

This directory contains reusable Terraform modules for the Ananta Platform SaaS infrastructure.

## Module Overview

### Core Infrastructure Modules

| Module | Purpose | Dependencies |
|--------|---------|--------------|
| `network` | VPC, subnets, NAT Gateway, VPC Flow Logs | None |
| `database` | RDS PostgreSQL with auto-generated passwords | `network`, `kms` (optional) |
| `elasticache` | Redis cluster for caching | `network` |
| `secrets` | AWS Secrets Manager for credentials | `database`, `elasticache`, `kms` (optional) |
| `ecs` | ECS cluster, services, ALB, auto-scaling | `network`, `secrets`, `kms` (optional) |
| `app-plane` | RabbitMQ, S3 buckets, SQS queues | `network`, `ecs`, `kms` (optional) |

### Security Modules (NEW)

| Module | Purpose | Dependencies |
|--------|---------|--------------|
| `kms` | Customer-managed encryption keys | `ecs` (for task execution role) |
| `cloudtrail` | Audit logging and security monitoring | `kms` |

---

## Module Details

### network

**Purpose**: Provisions VPC networking infrastructure

**Key Features**:
- Multi-AZ VPC with public, private, and database subnets
- NAT Gateway for private subnet internet access (optional)
- VPC Flow Logs to CloudWatch
- Internet Gateway for public subnets
- Route tables and associations

**Outputs**:
- `vpc_id` - VPC identifier
- `public_subnet_ids` - List of public subnet IDs
- `private_subnet_ids` - List of private subnet IDs
- `database_subnet_ids` - List of database subnet IDs

**Security**:
- ✅ VPC Flow Logs enabled
- ✅ CloudWatch Logs encryption (KMS)
- ✅ Network segmentation (3-tier)

---

### database

**Purpose**: Managed PostgreSQL databases with RDS

**Key Features**:
- Auto-generated secure passwords (32 chars)
- Multi-AZ for high availability (optional)
- Automated backups and point-in-time recovery
- Enhanced monitoring and Performance Insights
- Parameter groups with query logging
- Deletion protection for production
- Storage auto-scaling

**Outputs**:
- `endpoint` - Database connection endpoint
- `password` - Auto-generated password (sensitive)
- `instance_arn` - RDS instance ARN
- `connection_string` - Full PostgreSQL connection string

**Security**:
- ✅ Random 32-character passwords
- ✅ KMS encryption at rest
- ✅ SSL/TLS in transit
- ✅ Private subnets only
- ✅ Security group restrictions

---

### elasticache

**Purpose**: Redis cluster for caching and session storage

**Key Features**:
- Single-node or cluster mode
- Automatic failover (optional)
- Encryption in transit
- Automatic backups
- CloudWatch monitoring

**Outputs**:
- `primary_endpoint` - Redis primary endpoint
- `port` - Redis port (6379)
- `security_group_id` - Redis security group

**Security**:
- ✅ Encryption in transit (TLS)
- ✅ Private subnets only
- ✅ Security group restrictions

---

### secrets

**Purpose**: Centralized secrets management with AWS Secrets Manager

**Key Features**:
- Database credentials storage
- Redis connection details
- Keycloak admin credentials
- JWT signing secrets
- External API keys
- Automatic secret rotation (optional)

**Outputs**:
- `control_plane_db_secret_arn` - Control plane DB secret ARN
- `app_plane_db_secret_arn` - App plane DB secret ARN
- `components_db_secret_arn` - Components DB secret ARN
- `secrets_access_policy_arn` - IAM policy for secret access

**Security**:
- ✅ KMS encryption at rest
- ✅ Automatic rotation support
- ✅ Recovery window (7 days)
- ✅ Least-privilege IAM policies

---

### ecs

**Purpose**: ECS Fargate cluster with services, ALB, and auto-scaling

**Key Features**:
- Fargate launch type (serverless)
- Application Load Balancer with HTTPS
- Auto-scaling based on CPU/memory
- ECS Exec for debugging
- Container Insights monitoring
- CloudWatch Logs integration
- Health checks and rolling deployments

**Services Included**:
- Tenant Management Service (port 14000)
- CNS Service (port 27200)
- Temporal Worker (no HTTP)
- Orchestrator Service
- Subscription Service
- Keycloak (port 8080)
- Temporal Server (port 7233)
- Temporal UI (port 8080)
- Admin App (port 27555)
- Customer Portal (port 27100)
- CNS Dashboard (port 27250)
- Novu Notifications

**Outputs**:
- `cluster_id` - ECS cluster ID
- `alb_dns_name` - Load balancer DNS name
- `ecs_security_group_id` - ECS tasks security group
- `task_execution_role_arn` - Task execution role ARN
- `service_names` - Map of all service names

**Security**:
- ✅ Least-privilege IAM policies
- ✅ No wildcard permissions
- ✅ Security groups with minimal access
- ✅ CloudWatch Logs encryption (KMS)
- ✅ Secrets from Secrets Manager
- ✅ Private subnets for tasks

---

### app-plane

**Purpose**: App Plane infrastructure (RabbitMQ, S3, SQS)

**Key Features**:
- Amazon MQ (RabbitMQ) for message queuing
- S3 buckets for BOM storage, assets, exports
- Optional SQS queues (alternative to RabbitMQ)
- CloudWatch Logs for services
- Lifecycle policies for cost optimization
- CORS configuration for direct uploads

**Outputs**:
- `rabbitmq_endpoint` - RabbitMQ broker endpoint
- `rabbitmq_password` - Auto-generated password
- `bom_bucket_id` - BOM storage bucket ID
- `assets_bucket_id` - Assets bucket ID
- `s3_access_policy_arn` - IAM policy for S3 access

**Security**:
- ✅ RabbitMQ not publicly accessible
- ✅ KMS encryption for S3 and RabbitMQ
- ✅ All public access blocked (S3)
- ✅ Versioning enabled
- ✅ Lifecycle policies
- ✅ CloudWatch Logs encryption (KMS)

---

### kms (NEW)

**Purpose**: Customer-managed KMS keys for encryption at rest

**Key Features**:
- Separate keys for different data classifications
- Automatic key rotation (yearly)
- Service-specific key policies
- Multi-region support (optional)
- KMS aliases for easy reference
- 30-day deletion window (configurable)

**Keys Provided**:
1. **RDS KMS Key** - Database encryption
2. **S3 KMS Key** - Object storage encryption
3. **Secrets Manager KMS Key** - Secrets encryption
4. **CloudWatch Logs KMS Key** - Log encryption
5. **EBS KMS Key** - Volume encryption
6. **Amazon MQ KMS Key** - Message broker encryption

**Outputs**:
- `rds_kms_key_id` / `rds_kms_key_arn`
- `s3_kms_key_id` / `s3_kms_key_arn`
- `secrets_kms_key_id` / `secrets_kms_key_arn`
- `cloudwatch_kms_key_id` / `cloudwatch_kms_key_arn`
- `ebs_kms_key_id` / `ebs_kms_key_arn`
- `mq_kms_key_id` / `mq_kms_key_arn`

**Security**:
- ✅ Automatic key rotation
- ✅ Least-privilege key policies
- ✅ Service-specific conditions
- ✅ CloudTrail audit logging
- ✅ FIPS 140-2 validated

**Cost**: ~$8/month (6 keys + API usage)

---

### cloudtrail (NEW)

**Purpose**: Comprehensive audit logging and security monitoring

**Key Features**:
- Multi-region trail support (production)
- Log file validation
- Management events tracking
- Data events for S3 (optional)
- CloudTrail Insights (optional)
- CloudWatch Logs integration
- Real-time security alarms
- SNS notifications

**S3 Bucket Features**:
- Versioning enabled
- KMS encryption
- All public access blocked
- Lifecycle policy (Glacier after 90 days)
- 7-year retention for compliance
- HTTPS-only access

**Security Metric Filters**:
1. Unauthorized API Calls (threshold: 5)
2. Console Sign-in Without MFA (threshold: 1)
3. Root Account Usage (threshold: 1)
4. IAM Policy Changes (threshold: 1)
5. Security Group Changes (threshold: 5)

**Outputs**:
- `cloudtrail_id` - CloudTrail ID
- `cloudtrail_arn` - CloudTrail ARN
- `s3_bucket_id` - CloudTrail logs S3 bucket
- `cloudwatch_log_group_name` - CloudWatch log group
- `sns_topic_arn` - SNS topic for notifications

**Security**:
- ✅ Multi-region (production)
- ✅ Log file validation
- ✅ KMS encryption (S3 + CloudWatch)
- ✅ All public access blocked
- ✅ Real-time security alarms
- ✅ 7-year retention

**Cost**: ~$50-100/month (varies by activity)

---

## Usage Examples

### Basic Setup

```hcl
module "network" {
  source = "./modules/network"

  name_prefix           = "ananta-dev"
  vpc_cidr              = "10.0.0.0/16"
  availability_zones    = ["us-east-1a", "us-east-1b"]
  public_subnet_cidrs   = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnet_cidrs  = ["10.0.10.0/24", "10.0.11.0/24"]
  database_subnet_cidrs = ["10.0.20.0/24", "10.0.21.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false  # Use one per AZ for production

  tags = {
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
```

### Secure Database with KMS

```hcl
module "kms" {
  source = "./modules/kms"

  name_prefix                  = "ananta-dev"
  ecs_task_execution_role_arn = module.ecs.task_execution_role_arn

  deletion_window_days = 30
  multi_region        = false

  tags = {
    Environment = "dev"
  }
}

module "database" {
  source = "./modules/database"

  name_prefix         = "ananta-dev-control-plane"
  vpc_id              = module.network.vpc_id
  database_subnet_ids = module.network.database_subnet_ids

  allowed_security_groups = [module.ecs.ecs_security_group_id]

  database_name = "arc_saas"
  kms_key_id    = module.kms.rds_kms_key_id

  multi_az                = true
  deletion_protection     = true
  backup_retention_period = 7

  tags = {
    Environment = "dev"
  }
}
```

### CloudTrail with Alarms

```hcl
module "cloudtrail" {
  source = "./modules/cloudtrail"

  name_prefix   = "ananta-prod"
  bucket_prefix = "ananta"

  kms_key_id            = module.kms.s3_kms_key_id
  cloudwatch_kms_key_id = module.kms.cloudwatch_kms_key_id

  # Production settings
  is_multi_region_trail = true
  enable_data_events    = true
  enable_insights       = true

  s3_bucket_arns = [
    module.app_plane.bom_bucket_arn,
    module.app_plane.assets_bucket_arn
  ]

  # Security alarms
  create_metric_filters = true
  alarm_sns_topic_arns  = [aws_sns_topic.security_alerts.arn]

  # Optional email notifications
  enable_sns_notifications = true
  notification_email       = "security@ananta-platform.com"

  tags = {
    Environment = "prod"
  }
}
```

---

## Security Best Practices

### 1. Always Use KMS Customer-Managed Keys

```hcl
# Deploy KMS module first
module "kms" { ... }

# Reference in other modules
kms_key_id = module.kms.rds_kms_key_id
```

### 2. Enable CloudTrail in All Environments

```hcl
# Dev: Single-region
is_multi_region_trail = false

# Production: Multi-region
is_multi_region_trail = true
enable_insights       = true
```

### 3. Use Strong Database Settings

```hcl
# Production databases
multi_az                = true
deletion_protection     = true
backup_retention_period = 30
skip_final_snapshot     = false
```

### 4. Encrypt All CloudWatch Logs

```hcl
# Pass KMS key to all modules
cloudwatch_kms_key_id = module.kms.cloudwatch_kms_key_id
```

### 5. Implement Security Alarms

```hcl
# Create SNS topic
resource "aws_sns_topic" "security_alerts" {
  name = "ananta-security-alerts"
}

# Subscribe security team
resource "aws_sns_topic_subscription" "security_email" {
  topic_arn = aws_sns_topic.security_alerts.arn
  protocol  = "email"
  endpoint  = "security@ananta-platform.com"
}
```

---

## Testing Modules

### Validate Configuration

```bash
cd infrastructure/terraform
terraform init
terraform validate
terraform fmt -recursive
```

### Plan Changes

```bash
# Dev environment
terraform plan -var-file="environments/dev/terraform.tfvars" -out=dev.tfplan

# Review changes
terraform show dev.tfplan
```

### Apply Changes

```bash
# Apply with approval
terraform apply dev.tfplan

# Auto-approve (CI/CD only)
terraform apply -auto-approve -var-file="environments/dev/terraform.tfvars"
```

---

## Module Versioning

All modules follow semantic versioning:

- **Major**: Breaking changes
- **Minor**: New features (backwards compatible)
- **Patch**: Bug fixes

Current versions:
- `network`: v1.0.0
- `database`: v1.1.0 (added KMS support)
- `ecs`: v1.2.0 (added KMS, fixed IAM)
- `secrets`: v1.1.0 (added rotation)
- `app-plane`: v1.1.0 (added KMS)
- `kms`: v1.0.0 (NEW)
- `cloudtrail`: v1.0.0 (NEW)

---

## Troubleshooting

### KMS Key Permission Denied

**Issue**: ECS tasks can't access Secrets Manager
**Solution**: Ensure `ecs_task_execution_role_arn` is passed to KMS module

### CloudTrail Logs Not Appearing

**Issue**: No logs in CloudWatch
**Solution**: Check IAM role policy for CloudTrail → CloudWatch

### Database Can't Decrypt Snapshots

**Issue**: KMS key not accessible
**Solution**: Grant KMS key access to RDS service

### S3 Bucket Encryption Conflicts

**Issue**: Existing objects not encrypted
**Solution**: Use S3 Batch Operations to re-encrypt

---

## Contributing

When adding new modules:

1. Create module directory: `modules/<module-name>/`
2. Add required files: `main.tf`, `variables.tf`, `outputs.tf`
3. Document in this README
4. Add usage example
5. Update SECURITY_FIXES.md if security-related
6. Test in dev environment
7. Submit PR with test results

---

## References

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [CIS AWS Foundations Benchmark](https://www.cisecurity.org/benchmark/amazon_web_services)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Ananta Platform Security Audit Report](./SECURITY_AUDIT_REPORT.md)
- [Security Fixes Documentation](./SECURITY_FIXES.md)
