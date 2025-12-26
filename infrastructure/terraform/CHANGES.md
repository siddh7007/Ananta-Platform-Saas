# Terraform Infrastructure Changes

## Latest: VPC Endpoints for Private AWS Service Access

**Date:** 2025-12-21

Added comprehensive VPC endpoints to enable private connectivity to AWS services without NAT Gateway.

### What's New

**Gateway Endpoints (FREE):**
- S3 - Private S3 access from ECS tasks
- DynamoDB - Private DynamoDB access for state locking

**Interface Endpoints (PrivateLink):**
- ECR API + ECR DKR - Pull container images privately
- Secrets Manager - Secure secrets retrieval
- CloudWatch Logs - Private logging
- SSM, SSM Messages, EC2 Messages - Systems Manager support
- STS - IAM role assumption

### Benefits

- **Security:** No internet gateway exposure for AWS service traffic
- **Cost Reduction:** Potential NAT Gateway elimination (saves $32.85/month + $0.045/GB)
- **Performance:** Lower latency via AWS PrivateLink backbone
- **Compliance:** Private connectivity meets regulatory requirements

### Configuration

```hcl
# Enable/disable all VPC endpoints (default: true)
enable_vpc_endpoints = true
```

### Files Changed

- `modules/network/main.tf` - Added 10 VPC endpoints + security group
- `modules/network/variables.tf` - Added `enable_vpc_endpoints` and `aws_region` variables
- `modules/network/outputs.tf` - Added VPC endpoint ID outputs
- `modules/network/VPC_ENDPOINTS.md` - Comprehensive documentation
- `main.tf` - Pass `enable_vpc_endpoints` and `aws_region` to network module
- `variables.tf` - Added `enable_vpc_endpoints` variable
- `outputs.tf` - Exposed VPC endpoint outputs

### Cost Analysis

- **Gateway Endpoints:** Free
- **Interface Endpoints:** $7.30/month each (8 endpoints = $58.40/month base)
- **Data Processing:** $0.01/GB
- **NAT Gateway Savings:** $32.85/month + $0.045/GB

See `modules/network/VPC_ENDPOINTS.md` for complete cost breakdown.

---

## Previous: Keycloak + Temporal Modules

**Date:** 2025-12-20

Fixed circular dependency between modules and added Keycloak + Temporal modules.

## Changes Made

### 1. Security Groups Module (NEW)
Created `modules/security-groups/` to break circular dependencies.

**Creates 7 security groups**:
- ALB, ECS, RDS, Redis, RabbitMQ, Temporal, Keycloak

### 2. Keycloak Module (NEW)
Created `modules/keycloak/` for OAuth2/OIDC provider.

**Includes**:
- Dedicated RDS PostgreSQL database
- ECS Fargate service
- ALB integration
- Secrets Manager for credentials

### 3. Temporal Module (NEW)
Created `modules/temporal/` for workflow orchestration.

**Includes**:
- Temporal server + UI (separate ECS services)
- Dedicated RDS PostgreSQL database
- Service Discovery for internal DNS
- ALB integration for UI

### 4. Fixed Modules
- `database/` - Now accepts external security group ID
- `elasticache/` - Now accepts external security group ID
- `ecs/` - Now accepts external security group IDs
- `ecs/outputs.tf` - Added ALB HTTPS listener ARN output

### 5. Updated Root Module
- `main.tf` - Added security-groups, keycloak, temporal modules
- `variables.tf` - Added keycloak and temporal variables
- `outputs.tf` - Added keycloak and temporal outputs

## Module Dependencies (Fixed)

```
Network → Security Groups → (Database + ECS in parallel) → Keycloak/Temporal
```

No more circular dependencies!

## New Outputs

```bash
terraform output keycloak_url
terraform output keycloak_admin_console_url  
terraform output temporal_address
terraform output temporal_ui_url
```

## Testing

```bash
cd infrastructure/terraform
terraform init
terraform validate
terraform plan -var-file="environments/dev/terraform.tfvars"
```

## Files Changed

**New modules**: security-groups, keycloak, temporal (9 files)
**Modified**: main.tf, variables.tf, outputs.tf, database/, elasticache/, ecs/ (10 files)

All changes maintain backward compatibility with existing deployments.
