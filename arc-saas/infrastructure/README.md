# ARC-SaaS Infrastructure

This directory contains Infrastructure as Code (IaC) for deploying ARC-SaaS to cloud environments.

## Directory Structure

```
infrastructure/
├── terraform/              # Terraform modules and environments
│   ├── modules/           # Reusable Terraform modules
│   │   ├── network/       # VPC, subnets, security groups
│   │   ├── database/      # RDS PostgreSQL
│   │   ├── elasticache/   # Redis cluster
│   │   ├── ecs/           # ECS Fargate services
│   │   └── keycloak/      # Keycloak deployment
│   └── environments/      # Environment-specific configurations
│       ├── dev/           # Development environment
│       ├── staging/       # Staging environment
│       └── prod/          # Production environment
├── helm/                   # Kubernetes Helm charts
│   └── charts/
│       ├── tenant-management-service/
│       ├── admin-app/
│       ├── temporal-worker-service/
│       └── monitoring/
└── scripts/               # Deployment and bootstrap scripts
```

## Prerequisites

- AWS CLI configured with appropriate credentials
- Terraform >= 1.5.0
- Helm >= 3.12.0 (for K8s deployments)
- kubectl (for K8s deployments)

## Quick Start

### 1. Initialize Terraform

```bash
cd infrastructure/terraform/environments/dev
terraform init
```

### 2. Plan the deployment

```bash
terraform plan -var-file="terraform.tfvars"
```

### 3. Apply the infrastructure

```bash
terraform apply -var-file="terraform.tfvars"
```

## Deployment Options

### Option A: AWS ECS Fargate (Recommended for Simplicity)

Uses ECS Fargate for container orchestration. Best for:
- Small to medium deployments
- Teams new to container orchestration
- Cost-effective for variable workloads

### Option B: AWS EKS (Kubernetes)

Uses EKS with Helm charts. Best for:
- Large-scale deployments
- Teams with Kubernetes expertise
- Complex orchestration requirements

## Architecture

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                      AWS VPC                            │
                    │  ┌─────────────────────────────────────────────────┐   │
                    │  │                Public Subnets                    │   │
                    │  │  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │   │
Internet ──────────►│  │  │   ALB   │  │   NAT   │  │     Bastion    │  │   │
                    │  │  └────┬────┘  └────┬────┘  └─────────────────┘  │   │
                    │  └───────┼────────────┼───────────────────────────┘   │
                    │          │            │                                │
                    │  ┌───────┼────────────┼───────────────────────────┐   │
                    │  │       │  Private Subnets                       │   │
                    │  │  ┌────▼────┐  ┌────▼────┐  ┌──────────────┐   │   │
                    │  │  │   ECS   │  │   ECS   │  │     ECS      │   │   │
                    │  │  │ Admin   │  │ Tenant  │  │   Worker     │   │   │
                    │  │  │  App    │  │  Mgmt   │  │   Service    │   │   │
                    │  │  └─────────┘  └────┬────┘  └──────────────┘   │   │
                    │  │                    │                           │   │
                    │  │  ┌─────────────────┼─────────────────────┐    │   │
                    │  │  │                 │    Data Tier        │    │   │
                    │  │  │  ┌──────────┐  │  ┌───────────────┐  │    │   │
                    │  │  │  │   RDS    │◄─┘  │  ElastiCache  │  │    │   │
                    │  │  │  │ Postgres │     │    Redis      │  │    │   │
                    │  │  │  └──────────┘     └───────────────┘  │    │   │
                    │  │  └───────────────────────────────────────┘    │   │
                    │  └────────────────────────────────────────────────┘   │
                    └─────────────────────────────────────────────────────────┘
```

## Environment Variables

Each environment requires the following variables in `terraform.tfvars`:

| Variable | Description | Example |
|----------|-------------|---------|
| `project_name` | Project identifier | `arc-saas` |
| `environment` | Environment name | `dev`, `staging`, `prod` |
| `aws_region` | AWS region | `us-east-1` |
| `vpc_cidr` | VPC CIDR block | `10.0.0.0/16` |
| `db_instance_class` | RDS instance type | `db.t3.medium` |
| `redis_node_type` | ElastiCache node type | `cache.t3.micro` |

## Security

- All secrets stored in AWS Secrets Manager
- TLS termination at ALB
- Private subnets for all services
- Security groups with least privilege
- IAM roles with minimal permissions

## Monitoring

The monitoring stack includes:
- CloudWatch for logs and metrics
- Prometheus for service metrics (via sidecar)
- Grafana dashboards
- ALB access logs in S3

## CI/CD Integration

GitHub Actions workflows are provided in `.github/workflows/`:
- `terraform-plan.yml` - Runs on PR to show plan
- `terraform-apply.yml` - Deploys on merge to main
- `deploy-services.yml` - Deploys application services

## Disaster Recovery

- RDS automated backups (7 days retention)
- Cross-region replication (optional)
- Point-in-time recovery enabled
- Infrastructure as code ensures reproducibility

## Cost Estimation

| Component | Dev | Staging | Prod |
|-----------|-----|---------|------|
| ECS Fargate | ~$50/mo | ~$150/mo | ~$500/mo |
| RDS PostgreSQL | ~$30/mo | ~$100/mo | ~$400/mo |
| ElastiCache | ~$20/mo | ~$50/mo | ~$200/mo |
| ALB | ~$20/mo | ~$20/mo | ~$50/mo |
| NAT Gateway | ~$30/mo | ~$30/mo | ~$60/mo |
| **Total** | ~$150/mo | ~$350/mo | ~$1,200/mo |

*Estimates based on us-east-1 pricing. Actual costs may vary.*
