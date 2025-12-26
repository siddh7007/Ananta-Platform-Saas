# Network Module

## Overview

The network module creates a production-ready VPC with public, private, and database subnets across multiple availability zones. It includes VPC endpoints for secure, private connectivity to AWS services.

## Features

- Multi-AZ deployment for high availability
- Public subnets with Internet Gateway
- Private subnets with NAT Gateway (optional)
- Isolated database subnets
- VPC Flow Logs to CloudWatch
- **VPC Endpoints for private AWS service access**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VPC (10.0.0.0/16)                        │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │ Public Subnet│   │ Public Subnet│   │ Public Subnet│   │
│  │ 10.0.1.0/24  │   │ 10.0.2.0/24  │   │ 10.0.3.0/24  │   │
│  │    (AZ-a)    │   │    (AZ-b)    │   │    (AZ-c)    │   │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   │
│         │                  │                  │            │
│         └──────────────────┼──────────────────┘            │
│                            ▼                                │
│                   Internet Gateway                          │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │Private Subnet│   │Private Subnet│   │Private Subnet│   │
│  │ 10.0.11.0/24 │   │ 10.0.12.0/24 │   │ 10.0.13.0/24 │   │
│  │    (AZ-a)    │   │    (AZ-b)    │   │    (AZ-c)    │   │
│  │              │   │              │   │              │   │
│  │ ECS Tasks    │   │ ECS Tasks    │   │ ECS Tasks    │   │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   │
│         │                  │                  │            │
│         ├──────────────────┴──────────────────┤            │
│         │         NAT Gateway (optional)      │            │
│         └─────────────────┬──────────────────┘            │
│                           │                                │
│                           ▼                                │
│              ┌────────────────────────┐                    │
│              │   VPC Endpoints        │                    │
│              │  - S3 (Gateway)        │                    │
│              │  - DynamoDB (Gateway)  │                    │
│              │  - ECR (Interface)     │                    │
│              │  - Secrets (Interface) │                    │
│              │  - Logs (Interface)    │                    │
│              │  - SSM (Interface)     │                    │
│              └────────────────────────┘                    │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │Database      │   │Database      │   │Database      │   │
│  │Subnet        │   │Subnet        │   │Subnet        │   │
│  │ 10.0.21.0/24 │   │ 10.0.22.0/24 │   │ 10.0.23.0/24 │   │
│  │    (AZ-a)    │   │    (AZ-b)    │   │    (AZ-c)    │   │
│  │              │   │              │   │              │   │
│  │ RDS          │   │ RDS Standby  │   │              │   │
│  └──────────────┘   └──────────────┘   └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Usage

```hcl
module "network" {
  source = "./modules/network"

  name_prefix           = "ananta-dev"
  vpc_cidr              = "10.0.0.0/16"
  availability_zones    = ["us-east-1a", "us-east-1b", "us-east-1c"]

  public_subnet_cidrs   = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnet_cidrs  = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
  database_subnet_cidrs = ["10.0.21.0/24", "10.0.22.0/24", "10.0.23.0/24"]

  enable_nat_gateway    = true
  single_nat_gateway    = false  # Use one per AZ for HA
  enable_vpc_endpoints  = true   # Enable private AWS service access

  aws_region            = "us-east-1"

  tags = {
    Environment = "dev"
    Project     = "ananta"
  }
}
```

## Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `name_prefix` | string | - | Prefix for resource names |
| `vpc_cidr` | string | - | CIDR block for VPC |
| `availability_zones` | list(string) | - | List of AZs |
| `public_subnet_cidrs` | list(string) | - | Public subnet CIDRs |
| `private_subnet_cidrs` | list(string) | - | Private subnet CIDRs |
| `database_subnet_cidrs` | list(string) | - | Database subnet CIDRs |
| `enable_nat_gateway` | bool | `true` | Enable NAT Gateway |
| `single_nat_gateway` | bool | `false` | Use single NAT (cost saving) |
| `enable_vpc_endpoints` | bool | `true` | Enable VPC endpoints |
| `aws_region` | string | - | AWS region |
| `cloudwatch_kms_key_id` | string | `null` | KMS key for flow logs |
| `tags` | map(string) | `{}` | Common tags |

## Outputs

### Network
- `vpc_id` - VPC ID
- `vpc_cidr` - VPC CIDR block
- `public_subnet_ids` - Public subnet IDs
- `private_subnet_ids` - Private subnet IDs
- `database_subnet_ids` - Database subnet IDs
- `nat_gateway_ips` - NAT Gateway public IPs

### VPC Endpoints
- `vpc_endpoint_s3_id` - S3 endpoint ID
- `vpc_endpoint_dynamodb_id` - DynamoDB endpoint ID
- `vpc_endpoint_ecr_api_id` - ECR API endpoint ID
- `vpc_endpoint_ecr_dkr_id` - ECR DKR endpoint ID
- `vpc_endpoint_secretsmanager_id` - Secrets Manager endpoint ID
- `vpc_endpoint_logs_id` - CloudWatch Logs endpoint ID
- `vpc_endpoint_ssm_id` - SSM endpoint ID
- `vpc_endpoint_ssmmessages_id` - SSM Messages endpoint ID
- `vpc_endpoint_ec2messages_id` - EC2 Messages endpoint ID
- `vpc_endpoint_sts_id` - STS endpoint ID
- `vpc_endpoint_security_group_id` - Security group for endpoints

### Subnet Groups
- `db_subnet_group_name` - RDS subnet group
- `cache_subnet_group_name` - ElastiCache subnet group

## VPC Endpoints

See [VPC_ENDPOINTS.md](./VPC_ENDPOINTS.md) for comprehensive documentation on:
- Cost analysis and savings calculations
- Architecture diagrams
- Testing and troubleshooting
- Best practices

### Quick Reference

**Gateway Endpoints (FREE):**
- S3 - Private S3 bucket access
- DynamoDB - Private DynamoDB access

**Interface Endpoints ($7.30/month each):**
- ECR API + ECR DKR - Pull container images privately
- Secrets Manager - Retrieve secrets securely
- CloudWatch Logs - Private logging
- SSM, SSM Messages, EC2 Messages - Systems Manager
- STS - IAM role assumption

**Total Cost:** ~$58.40/month (8 interface endpoints)

**Savings:** Eliminate NAT Gateway ($32.85/month) + data transfer ($0.045/GB)

## Security

### VPC Flow Logs
All network traffic is logged to CloudWatch with 30-day retention.

### Network Isolation
- Public subnets: ALB, NAT Gateway
- Private subnets: ECS tasks, application services
- Database subnets: RDS, ElastiCache (no internet access)

### VPC Endpoint Security
- Dedicated security group for interface endpoints
- HTTPS (443) only from VPC CIDR
- Private DNS enabled for seamless integration

## Cost Optimization

### Development Environment
```hcl
single_nat_gateway    = true   # Single NAT ($32.85/month)
enable_vpc_endpoints  = true   # Private access ($58.40/month)
# Total: ~$91/month
```

### Production Environment
```hcl
single_nat_gateway    = false  # NAT per AZ ($98.55/month for 3 AZs)
enable_vpc_endpoints  = true   # Private access ($58.40/month)
# Total: ~$157/month
# But eliminates $0.045/GB data transfer for AWS services
```

### Cost Comparison

| Scenario | NAT Cost | VPC Endpoints | Data Transfer (1TB) | Total |
|----------|----------|---------------|---------------------|-------|
| NAT Only | $32.85 | $0 | $45 | $77.85 |
| VPC Endpoints Only | $0 | $58.40 | $10 | $68.40 |
| Both (Recommended) | $32.85 | $58.40 | $10 | $101.25 |

**Recommendation:** Use both NAT Gateway (for internet access) and VPC Endpoints (for AWS services).

## Troubleshooting

### NAT Gateway Issues
```bash
# Check NAT Gateway status
aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=vpc-xxxxx"

# Verify route tables
aws ec2 describe-route-tables --filter "Name=vpc-id,Values=vpc-xxxxx"
```

### VPC Endpoint Issues
```bash
# List VPC endpoints
aws ec2 describe-vpc-endpoints --filter "Name=vpc-id,Values=vpc-xxxxx"

# Test DNS resolution from ECS task
nslookup ecr.api.us-east-1.amazonaws.com
# Should return private IP (10.0.x.x)
```

### VPC Flow Logs
```bash
# View flow logs
aws logs tail /aws/vpc/ananta-dev/flow-logs --follow
```

## References

- [AWS VPC Documentation](https://docs.aws.amazon.com/vpc/)
- [VPC Endpoints Guide](https://docs.aws.amazon.com/vpc/latest/privatelink/)
- [NAT Gateway Pricing](https://aws.amazon.com/vpc/pricing/)
- [VPC Endpoint Pricing](https://aws.amazon.com/privatelink/pricing/)
