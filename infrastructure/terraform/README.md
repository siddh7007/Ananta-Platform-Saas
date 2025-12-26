# Ananta Platform - Terraform Infrastructure

This directory contains the Terraform configuration for deploying the Ananta Platform to AWS.

## Quick Links

- [CI/CD Pipeline Guide](./CICD-GUIDE.md) - Comprehensive guide to deployment workflows
- [Security Baseline](./.tfsec-baseline.json) - Accepted security findings
- [Module Tests](./test/) - Terratest integration tests

## CI/CD Status

This infrastructure uses automated CI/CD pipelines with:

- Automated security scanning (tfsec, Checkov)
- Cost estimation on every PR (Infracost)
- Drift detection every 6 hours
- Automated rollback on failures
- State backup before every apply
- Module testing with Terratest

See [CICD-GUIDE.md](./CICD-GUIDE.md) for complete documentation.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Account                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                              VPC                                       │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │  │
│  │  │  Public Subnet  │  │  Public Subnet  │  │  Public Subnet  │       │  │
│  │  │   (AZ-a)        │  │   (AZ-b)        │  │   (AZ-c)        │       │  │
│  │  │   ┌─────┐       │  │   ┌─────┐       │  │   ┌─────┐       │       │  │
│  │  │   │ NAT │       │  │   │ NAT │       │  │   │ NAT │       │       │  │
│  │  │   └─────┘       │  │   └─────┘       │  │   └─────┘       │       │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │  │
│  │                                                                       │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │  │
│  │  │ Private Subnet  │  │ Private Subnet  │  │ Private Subnet  │       │  │
│  │  │   (AZ-a)        │  │   (AZ-b)        │  │   (AZ-c)        │       │  │
│  │  │   ┌──────────┐  │  │   ┌──────────┐  │  │   ┌──────────┐  │       │  │
│  │  │   │ ECS Tasks│  │  │   │ ECS Tasks│  │  │   │ ECS Tasks│  │       │  │
│  │  │   └──────────┘  │  │   └──────────┘  │  │   └──────────┘  │       │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │  │
│  │                                                                       │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │  │
│  │  │ Database Subnet │  │ Database Subnet │  │ Database Subnet │       │  │
│  │  │   (AZ-a)        │  │   (AZ-b)        │  │   (AZ-c)        │       │  │
│  │  │   ┌────────┐    │  │   ┌────────┐    │  │   ┌────────┐    │       │  │
│  │  │   │ RDS    │    │  │   │ Redis  │    │  │   │ RabbitMQ│   │       │  │
│  │  │   └────────┘    │  │   └────────┘    │  │   └────────┘    │       │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Module Structure

```
infrastructure/terraform/
├── backend.tf                 # Remote state configuration
├── main.tf                    # Root module - orchestrates all modules
├── variables.tf               # Input variables
├── outputs.tf                 # Output values
├── environments/              # Environment-specific configurations
│   ├── dev.tfvars
│   ├── staging.tfvars
│   └── prod.tfvars
└── modules/
    ├── network/               # VPC, subnets, NAT gateways
    ├── database/              # RDS PostgreSQL instances
    ├── elasticache/           # Redis cluster
    ├── ecs/                   # ECS cluster, services, ALB
    ├── secrets/               # AWS Secrets Manager
    └── app-plane/             # RabbitMQ, S3 buckets
```

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Terraform** >= 1.5.0
3. **AWS CLI** configured with credentials
4. **S3 bucket** for remote state (created once per account)
5. **DynamoDB table** for state locking (created once per account)

## Bootstrap (First-Time Setup)

Before running Terraform, create the state backend resources:

```bash
# Set your AWS account ID
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-east-1

# Create S3 bucket for Terraform state
aws s3api create-bucket \
  --bucket ananta-terraform-state-${AWS_ACCOUNT_ID} \
  --region ${AWS_REGION}

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket ananta-terraform-state-${AWS_ACCOUNT_ID} \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket ananta-terraform-state-${AWS_ACCOUNT_ID} \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"}}]}'

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name ananta-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

## Usage

### Initialize Terraform

```bash
cd infrastructure/terraform

# Initialize with backend configuration
terraform init \
  -backend-config="bucket=ananta-terraform-state-${AWS_ACCOUNT_ID}" \
  -backend-config="key=ananta-platform/dev/terraform.tfstate" \
  -backend-config="region=us-east-1" \
  -backend-config="dynamodb_table=ananta-terraform-locks"
```

### Plan Changes

```bash
# Development
terraform plan -var-file="environments/dev.tfvars" -out=tfplan

# Staging
terraform plan -var-file="environments/staging.tfvars" -out=tfplan

# Production
terraform plan -var-file="environments/prod.tfvars" -out=tfplan
```

### Apply Changes

```bash
terraform apply tfplan
```

### Destroy Infrastructure

```bash
# CAUTION: This destroys all resources!
terraform destroy -var-file="environments/dev.tfvars"
```

## Environment Configurations

| Setting | Dev | Staging | Prod |
|---------|-----|---------|------|
| NAT Gateway | Single | Single | Per-AZ |
| RDS Multi-AZ | No | No | Yes |
| ECS Tasks | 1 | 2 | 3 |
| Auto-scaling | Disabled | Enabled | Enabled |
| Backup Retention | 3 days | 7 days | 30 days |
| Log Retention | 7 days | 14 days | 90 days |

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/terraform.yml`) automates:

1. **Format Check**: Validates Terraform formatting
2. **Validate**: Checks configuration syntax
3. **Plan**: Generates execution plan (on PR)
4. **Apply**: Deploys changes (on merge/manual trigger)
5. **Security Scan**: Runs tfsec and Checkov

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AWS_ROLE_ARN_DEV` | IAM role ARN for dev deployment |
| `AWS_ROLE_ARN_STAGING` | IAM role ARN for staging deployment |
| `AWS_ROLE_ARN_PROD` | IAM role ARN for production deployment |
| `TF_STATE_BUCKET` | S3 bucket for Terraform state |
| `TF_LOCK_TABLE` | DynamoDB table for state locking |

### GitHub Environments

Configure these environments in your repository settings:
- `dev` - Auto-deploy on merge
- `staging` - Requires approval
- `prod` - Requires approval

## Module Details

### Network Module

Creates the VPC infrastructure:
- VPC with DNS hostnames
- Public, private, and database subnets across AZs
- Internet Gateway
- NAT Gateway(s) with Elastic IPs
- Route tables and associations
- VPC Flow Logs

### Database Module

Provisions RDS PostgreSQL instances:
- Random password generation
- Security group with ECS access
- Parameter group with pg_stat_statements
- Performance Insights enabled
- CloudWatch alarms for monitoring

### ElastiCache Module

Deploys Redis cluster:
- Replication group with optional Multi-AZ
- Transit encryption (TLS)
- Parameter group with LRU eviction
- CloudWatch dashboard

### ECS Module

Sets up container infrastructure:
- ECS Cluster with Fargate
- Application Load Balancer
- Target groups with health checks
- Task definitions for services
- Auto-scaling policies (CPU/Memory)

### Secrets Module

Manages sensitive credentials:
- Database credentials
- Redis auth token
- Keycloak admin password
- JWT signing keys
- IAM policy for ECS access

### App Plane Module

App-specific infrastructure:
- Amazon MQ (RabbitMQ)
- S3 buckets (BOM, assets, exports)
- CloudWatch log groups
- Optional SQS queues

## Outputs

After applying, key outputs include:

```bash
# View all outputs
terraform output

# Specific outputs
terraform output alb_dns_name
terraform output control_plane_db_endpoint
terraform output redis_endpoint
```

## Troubleshooting

### State Lock Errors

```bash
# Force unlock (use with caution)
terraform force-unlock <LOCK_ID>
```

### Plan Drift

```bash
# Refresh state from actual infrastructure
terraform refresh -var-file="environments/dev.tfvars"
```

### Import Existing Resources

```bash
# Import existing RDS instance
terraform import module.control_plane_database.aws_db_instance.main <rds-instance-id>
```

## Security Considerations

1. **No hardcoded secrets** - All credentials managed via Secrets Manager
2. **Encryption at rest** - Enabled for all databases and S3
3. **Encryption in transit** - TLS enabled for Redis and RabbitMQ
4. **Private subnets** - Databases and ECS tasks in private subnets
5. **Security groups** - Least-privilege access between services
6. **IAM roles** - Service-specific roles with minimal permissions

## Cost Optimization

### Development
- t3.micro instances
- Single NAT Gateway
- Disabled auto-scaling
- Shorter log retention

### Production
- Reserved instances recommended
- Multi-AZ for HA
- Auto-scaling for efficiency
- Lifecycle policies for S3
