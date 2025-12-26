# VPC Endpoints Configuration

## Overview

VPC endpoints enable private connectivity to AWS services without requiring internet gateways, NAT devices, VPN connections, or AWS Direct Connect. This improves security and can significantly reduce data transfer costs.

## Endpoint Types

### Gateway Endpoints (FREE)

Gateway endpoints are free and route traffic through the VPC route tables. They support:

1. **S3** - Amazon Simple Storage Service
   - Use case: Private access to S3 buckets from ECS tasks, EC2 instances
   - No data processing charges
   - Reduces NAT Gateway costs for S3 traffic

2. **DynamoDB** - Amazon DynamoDB
   - Use case: Private access to DynamoDB tables for Terraform state locking
   - No data processing charges
   - Reduces NAT Gateway costs for DynamoDB traffic

### Interface Endpoints (PrivateLink)

Interface endpoints create ENIs in your subnets and charge per hour plus data processing. They support:

1. **ECR API** (`com.amazonaws.{region}.ecr.api`)
   - Use case: Container registry authentication and metadata
   - Required for: ECS pulling images from ECR
   - Cost: $0.01/hour + $0.01/GB processed

2. **ECR DKR** (`com.amazonaws.{region}.ecr.dkr`)
   - Use case: Docker registry operations (push/pull images)
   - Required for: ECS pulling container images
   - Cost: $0.01/hour + $0.01/GB processed

3. **Secrets Manager** (`com.amazonaws.{region}.secretsmanager`)
   - Use case: Secure retrieval of database credentials, API keys
   - Required for: ECS tasks accessing secrets
   - Cost: $0.01/hour + $0.01/GB processed

4. **CloudWatch Logs** (`com.amazonaws.{region}.logs`)
   - Use case: Private logging from ECS tasks, Lambda functions
   - Required for: Container logging without NAT Gateway
   - Cost: $0.01/hour + $0.01/GB processed

5. **SSM** (`com.amazonaws.{region}.ssm`)
   - Use case: Systems Manager Parameter Store access
   - Required for: ECS/EC2 parameter management
   - Cost: $0.01/hour + $0.01/GB processed

6. **SSM Messages** (`com.amazonaws.{region}.ssmmessages`)
   - Use case: Session Manager connectivity
   - Required for: SSH-less access to EC2/ECS
   - Cost: $0.01/hour + $0.01/GB processed

7. **EC2 Messages** (`com.amazonaws.{region}.ec2messages`)
   - Use case: SSM agent communication
   - Required for: Systems Manager agent connectivity
   - Cost: $0.01/hour + $0.01/GB processed

8. **STS** (`com.amazonaws.{region}.sts`)
   - Use case: IAM role assumption, temporary credentials
   - Required for: Cross-account access, ECS task roles
   - Cost: $0.01/hour + $0.01/GB processed

## Cost Analysis

### Monthly Costs (us-east-1)

**Gateway Endpoints:**
- S3: $0.00 (FREE)
- DynamoDB: $0.00 (FREE)

**Interface Endpoints (per endpoint):**
- Hourly: $0.01/hour × 730 hours = $7.30/month
- Data Processing: $0.01/GB (variable)

**Total for 8 Interface Endpoints:**
- Base cost: $58.40/month (8 × $7.30)
- Data processing: Variable based on usage

**Potential Savings:**
- NAT Gateway: $0.045/hour = $32.85/month
- NAT Data Transfer: $0.045/GB (first 10TB)
- If you eliminate NAT Gateway and transfer >5TB/month through VPC endpoints, you break even
- Security and compliance benefits are immeasurable

## Configuration

### Enable/Disable VPC Endpoints

```hcl
# In terraform.tfvars or variables
enable_vpc_endpoints = true  # Default: true
```

### Conditional Creation

All VPC endpoints are conditionally created based on `var.enable_vpc_endpoints`:

```hcl
resource "aws_vpc_endpoint" "s3" {
  count = var.enable_vpc_endpoints ? 1 : 0
  # ...
}
```

### Security Group

A dedicated security group is created for interface endpoints:

- **Ingress:** HTTPS (443) from VPC CIDR
- **Egress:** All traffic (required for AWS service communication)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         VPC (10.0.0.0/16)                   │
│                                                             │
│  ┌───────────────┐                                          │
│  │ Private Subnet│──────┐                                   │
│  │ (ECS Tasks)   │      │                                   │
│  └───────────────┘      │                                   │
│                         │                                   │
│                         ▼                                   │
│              ┌─────────────────────┐                        │
│              │ Interface Endpoints │                        │
│              │ (ENI in subnet)     │                        │
│              │  - ECR API          │                        │
│              │  - ECR DKR          │                        │
│              │  - Secrets Manager  │                        │
│              │  - CloudWatch Logs  │                        │
│              │  - SSM              │                        │
│              │  - STS              │                        │
│              └─────────────────────┘                        │
│                         │                                   │
│                         │ Private DNS                       │
│                         ▼                                   │
│              ┌─────────────────────┐                        │
│              │  AWS Services       │                        │
│              │  (via PrivateLink)  │                        │
│              └─────────────────────┘                        │
│                                                             │
│  ┌───────────────┐                                          │
│  │ Route Tables  │                                          │
│  │  - Private    │──────┐                                   │
│  │  - Database   │      │                                   │
│  └───────────────┘      │                                   │
│                         ▼                                   │
│              ┌─────────────────────┐                        │
│              │ Gateway Endpoints   │                        │
│              │  - S3               │                        │
│              │  - DynamoDB         │                        │
│              └─────────────────────┘                        │
│                         │                                   │
│                         │ Route Table Entry                 │
│                         ▼                                   │
│              ┌─────────────────────┐                        │
│              │  AWS Services       │                        │
│              │  (via Gateway)      │                        │
│              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Usage Examples

### ECS Task Accessing ECR

```hcl
# ECS task automatically uses VPC endpoints when available
# No configuration changes needed in task definitions
```

### Private DNS Resolution

Interface endpoints enable private DNS by default:

```bash
# Instead of resolving to public IP
nslookup ecr.api.us-east-1.amazonaws.com
# Returns: 10.0.11.x (private subnet IP)

# S3 gateway endpoint
nslookup s3.us-east-1.amazonaws.com
# Routes through route table prefix list
```

## Outputs

The network module exposes VPC endpoint IDs and security group:

```hcl
module.network.vpc_endpoint_s3_id
module.network.vpc_endpoint_dynamodb_id
module.network.vpc_endpoint_ecr_api_id
module.network.vpc_endpoint_ecr_dkr_id
module.network.vpc_endpoint_secretsmanager_id
module.network.vpc_endpoint_logs_id
module.network.vpc_endpoint_ssm_id
module.network.vpc_endpoint_ssmmessages_id
module.network.vpc_endpoint_ec2messages_id
module.network.vpc_endpoint_sts_id
module.network.vpc_endpoint_security_group_id
```

## Testing

### Verify Endpoint Creation

```bash
# List VPC endpoints
aws ec2 describe-vpc-endpoints \
  --filters "Name=vpc-id,Values=vpc-xxxxx" \
  --region us-east-1

# Test connectivity from ECS task
aws ecs execute-command --cluster ananta-dev-cluster \
  --task <task-id> \
  --container tenant-mgmt \
  --interactive \
  --command "/bin/bash"

# Inside container, test DNS resolution
nslookup ecr.api.us-east-1.amazonaws.com
nslookup secretsmanager.us-east-1.amazonaws.com
```

### Verify Private Access

```bash
# Check that ECR API resolves to private IP
dig +short ecr.api.us-east-1.amazonaws.com
# Should return 10.0.x.x (not public IP)

# Test S3 access without NAT Gateway
aws s3 ls s3://my-bucket --region us-east-1
# Should work even with NAT Gateway disabled
```

## Troubleshooting

### Issue: DNS Resolution Fails

**Symptom:** Services cannot resolve AWS service endpoints

**Solution:**
1. Verify VPC has DNS support enabled:
   ```hcl
   enable_dns_hostnames = true
   enable_dns_support   = true
   ```

2. Check interface endpoint has private DNS enabled:
   ```hcl
   private_dns_enabled = true
   ```

### Issue: Connection Timeout to AWS Services

**Symptom:** ECS tasks timeout when accessing AWS services

**Solution:**
1. Verify security group allows HTTPS (443) from VPC CIDR
2. Check subnet route tables include gateway endpoint prefixes
3. Ensure interface endpoints are in the same subnets as your workloads

### Issue: High Costs

**Symptom:** VPC endpoint costs exceed NAT Gateway costs

**Solution:**
1. Monitor data processing charges:
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/PrivateLinkEndpoints \
     --metric-name BytesProcessed \
     --dimensions Name=VPC Endpoint Id,Value=vpce-xxxxx
   ```

2. Consider disabling interface endpoints and using NAT Gateway for low-traffic environments:
   ```hcl
   enable_vpc_endpoints = false  # Dev environments
   ```

## Best Practices

1. **Always enable for production** - Security and compliance benefits outweigh costs
2. **Use gateway endpoints** - Free for S3/DynamoDB access
3. **Monitor data transfer** - Track costs vs NAT Gateway savings
4. **Enable private DNS** - Simplifies application configuration
5. **Scope security groups tightly** - Only allow HTTPS from VPC CIDR
6. **Tag all endpoints** - For cost allocation and tracking

## References

- [AWS VPC Endpoints Documentation](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints.html)
- [VPC Endpoint Pricing](https://aws.amazon.com/privatelink/pricing/)
- [Interface Endpoints vs Gateway Endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/vpce-interface.html)
- [Service Endpoints by Region](https://docs.aws.amazon.com/general/latest/gr/rande.html)
