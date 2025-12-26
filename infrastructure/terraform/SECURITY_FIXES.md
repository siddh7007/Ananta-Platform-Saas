# Terraform Security Fixes - Ananta Platform

## Overview

This document outlines all security improvements implemented to address critical vulnerabilities in the Ananta Platform Terraform infrastructure.

## Security Issues Fixed

### 1. Database Password Security (ALREADY FIXED)
- **Status**: COMPLIANT
- **Implementation**: `modules/database/main.tf` lines 9-13
- Uses `random_password` resource with 32-character passwords
- Special characters included for complexity
- Passwords stored in Secrets Manager (not exposed)

### 2. IAM Wildcard Permissions (FIXED)
- **Status**: REMEDIATED
- **Files Modified**:
  - `modules/ecs/main.tf` lines 345-401
  - `modules/secrets/main.tf` lines 213-265

#### Changes Made:

**ECS Task Role** (`modules/ecs/main.tf`):
- Added `aws:SourceAccount` condition to SSM access for ECS Exec
- Restricted CloudWatch Logs access to specific log groups (no wildcard)
- Added `aws:SourceAccount` condition to S3 bucket access
- All statements now include `Sid` for better auditability

**Secrets Rotation Lambda** (`modules/secrets/main.tf`):
- CloudWatch Logs restricted to Lambda function log groups only
- RDS access limited to specific instance ARNs (variable-driven)
- Added `aws:ResourceAccount` condition to RDS operations
- Removed wildcard `Resource = "*"` from all statements

### 3. KMS Customer Managed Keys (IMPLEMENTED)
- **Status**: NEW MODULE CREATED
- **Module**: `modules/kms/`
- **Features**:
  - Separate KMS keys for different data classifications:
    - RDS databases
    - S3 buckets
    - Secrets Manager
    - CloudWatch Logs
    - EBS volumes
    - Amazon MQ (RabbitMQ)
  - Automatic key rotation enabled for all keys
  - Service-specific key policies with least privilege
  - Deletion window configurable (7-30 days, default 30)
  - Support for multi-region keys
  - KMS aliases for easy reference

#### Key Policies:
Each KMS key has:
- Root account access for administration
- Service-specific access (RDS, S3, Secrets Manager, etc.)
- CloudWatch Logs integration
- Conditions to limit access scope

#### Integration Points:
- **Database Module**: Accepts `kms_key_id` variable for RDS encryption
- **App Plane Module**: Accepts `kms_key_id_s3` and `kms_key_id_mq` for S3 and RabbitMQ
- **All CloudWatch Log Groups**: Encrypted with `cloudwatch_kms_key_id`

### 4. CloudTrail Audit Logging (IMPLEMENTED)
- **Status**: NEW MODULE CREATED
- **Module**: `modules/cloudtrail/`
- **Features**:

#### Core Capabilities:
- Multi-region trail support (for production)
- Log file validation enabled
- Management events tracking
- Optional data events for S3 buckets
- CloudTrail Insights for anomaly detection

#### S3 Bucket for Logs:
- Versioning enabled
- KMS encryption with customer-managed key
- All public access blocked
- Lifecycle policy:
  - Archive to Glacier after 90 days
  - Retain for 7 years (2555 days) for compliance
  - Noncurrent versions to Glacier after 30 days
  - Delete noncurrent versions after 90 days
- Bucket policy enforces:
  - Encrypted uploads only
  - HTTPS transport only
  - CloudTrail write access

#### CloudWatch Logs Integration:
- Real-time log streaming to CloudWatch
- KMS encryption
- Configurable retention (default 90 days)
- IAM role for CloudTrail → CloudWatch

#### Metric Filters & Alarms:
Creates CloudWatch metric filters for:
1. **Unauthorized API Calls** - Threshold: 5 in 5 minutes
2. **Console Sign-in Without MFA** - Threshold: 1
3. **Root Account Usage** - Threshold: 1
4. **IAM Policy Changes** - Threshold: 1
5. **Security Group Changes** - Threshold: 5 in 5 minutes

Each alarm can send notifications to SNS topics.

#### Optional Features:
- SNS topic for CloudTrail notifications
- Email subscriptions for security events
- Data event logging for specific S3 buckets
- Insights for API call rate anomaly detection

### 5. VPC Flow Logs (ALREADY ENABLED)
- **Status**: COMPLIANT
- **Implementation**: `modules/network/main.tf` lines 209-268
- Captures ALL traffic (ACCEPT and REJECT)
- Logs sent to CloudWatch with 30-day retention
- Now includes KMS encryption support

### 6. Enhanced CloudWatch Logs Encryption
- **Status**: IMPLEMENTED
- **Files Modified**:
  - `modules/ecs/main.tf` - All ECS service log groups
  - `modules/app-plane/main.tf` - CNS and enrichment worker logs
  - `modules/network/main.tf` - VPC flow logs

All CloudWatch Log Groups now support KMS encryption via `cloudwatch_kms_key_id` variable.

## How to Use

### 1. Add KMS Module to Root Configuration

```hcl
# In main.tf

module "kms" {
  source = "./modules/kms"

  name_prefix                  = local.name_prefix
  ecs_task_execution_role_arn = module.ecs.task_execution_role_arn
  cloudtrail_bucket_name      = "${var.project_name}-${var.environment}-cloudtrail"

  deletion_window_days = var.environment == "prod" ? 30 : 7
  multi_region        = var.environment == "prod"

  tags = local.common_tags
}
```

### 2. Add CloudTrail Module

```hcl
module "cloudtrail" {
  source = "./modules/cloudtrail"

  name_prefix            = local.name_prefix
  bucket_prefix          = var.project_name
  kms_key_id             = module.kms.s3_kms_key_id
  cloudwatch_kms_key_id  = module.kms.cloudwatch_kms_key_id

  is_multi_region_trail = var.environment == "prod"
  enable_data_events    = var.environment == "prod"
  enable_insights       = var.environment == "prod"

  s3_bucket_arns = [
    module.app_plane.bom_bucket_arn,
    module.app_plane.assets_bucket_arn
  ]

  create_metric_filters  = true
  alarm_sns_topic_arns   = var.alarm_sns_topic_arns

  tags = local.common_tags
}
```

### 3. Update Database Modules

```hcl
module "control_plane_database" {
  source = "./modules/database"

  # ... existing configuration ...

  kms_key_id = module.kms.rds_kms_key_id

  tags = local.common_tags
}
```

### 4. Update ECS Module

```hcl
module "ecs" {
  source = "./modules/ecs"

  # ... existing configuration ...

  cloudwatch_kms_key_id = module.kms.cloudwatch_kms_key_id

  tags = local.common_tags
}
```

### 5. Update Secrets Module

```hcl
module "secrets" {
  source = "./modules/secrets"

  # ... existing configuration ...

  rds_instance_arns = [
    module.control_plane_database.instance_arn,
    module.app_plane_database.instance_arn,
    module.components_database.instance_arn
  ]

  tags = local.common_tags
}
```

### 6. Update Network Module

```hcl
module "network" {
  source = "./modules/network"

  # ... existing configuration ...

  cloudwatch_kms_key_id = module.kms.cloudwatch_kms_key_id

  tags = local.common_tags
}
```

### 7. Update App Plane Module

```hcl
module "app_plane" {
  source = "./modules/app-plane"

  # ... existing configuration ...

  kms_key_id_s3         = module.kms.s3_kms_key_id
  kms_key_id_mq         = module.kms.mq_kms_key_id
  cloudwatch_kms_key_id = module.kms.cloudwatch_kms_key_id

  tags = local.common_tags
}
```

## Security Checklist

Use this checklist before deploying to production:

- [ ] KMS module deployed with key rotation enabled
- [ ] All databases encrypted with customer-managed KMS keys
- [ ] CloudTrail enabled in multi-region mode
- [ ] CloudTrail log file validation enabled
- [ ] CloudTrail sending logs to CloudWatch
- [ ] Metric filters and alarms configured
- [ ] SNS topic configured for security alerts
- [ ] All CloudWatch Log Groups encrypted with KMS
- [ ] VPC Flow Logs enabled and encrypted
- [ ] S3 buckets encrypted with KMS
- [ ] Amazon MQ encrypted with KMS
- [ ] IAM policies follow least privilege (no wildcards)
- [ ] All public access to S3 buckets blocked
- [ ] Database deletion protection enabled (production)
- [ ] Multi-AZ enabled for databases (production)
- [ ] SNS subscriptions confirmed for alerts

## Compliance Mappings

| Control | Requirement | Implementation |
|---------|-------------|----------------|
| **CIS AWS 3.1** | CloudTrail enabled in all regions | `cloudtrail` module with `is_multi_region_trail = true` |
| **CIS AWS 3.2** | CloudTrail log file validation enabled | Enabled by default |
| **CIS AWS 3.3** | S3 bucket for CloudTrail logs not publicly accessible | `aws_s3_bucket_public_access_block` |
| **CIS AWS 3.4** | CloudTrail logs integrated with CloudWatch | `cloud_watch_logs_group_arn` configured |
| **CIS AWS 3.6** | S3 bucket access logging enabled | CloudTrail logs all S3 API calls |
| **CIS AWS 3.7** | CloudTrail logs encrypted at rest | KMS encryption enabled |
| **CIS AWS 2.3.1** | RDS encryption at rest enabled | All RDS instances use KMS |
| **CIS AWS 2.3.2** | Auto Minor Version Upgrade enabled | All RDS instances have `auto_minor_version_upgrade = true` |
| **CIS AWS 2.4.1** | VPC Flow Logging enabled | All VPCs have flow logs |
| **CIS AWS 4.3** | Root account MFA monitoring | CloudWatch metric filter for root usage |
| **CIS AWS 4.6** | IAM policy changes monitoring | CloudWatch metric filter for IAM changes |
| **SOC2 CC6.1** | Logical access controls | IAM policies with least privilege |
| **SOC2 CC6.6** | Audit logging | CloudTrail + CloudWatch Logs |
| **SOC2 CC6.7** | Encryption at rest | KMS for all data stores |
| **NIST 800-53 AU-2** | Auditable events | CloudTrail with comprehensive logging |
| **NIST 800-53 SC-13** | Cryptographic protection | FIPS 140-2 validated KMS |

## Cost Considerations

### KMS Costs:
- Customer Managed Keys: $1/month per key
- API requests: $0.03/10,000 requests
- **Estimated**: ~$8/month for 6 keys + API usage

### CloudTrail Costs:
- First trail: FREE
- Additional trails: $2/100,000 events
- S3 storage: ~$0.023/GB/month (Standard)
- Glacier storage: ~$0.004/GB/month (after 90 days)
- **Estimated**: $10-50/month depending on activity

### CloudWatch Logs:
- Ingestion: $0.50/GB
- Storage: $0.03/GB/month
- **Estimated**: $20-100/month depending on log volume

### Total Security Enhancement Cost:
- **Development**: ~$40-80/month
- **Production**: ~$100-200/month (with multi-region CloudTrail)

## Migration Path

If you have existing infrastructure without these security controls:

1. **Deploy KMS module first** - Existing resources continue with current encryption
2. **Enable CloudTrail** - No impact on existing resources
3. **Update databases** - Requires snapshot/restore for KMS encryption change
4. **Update log groups** - Seamless, logs start encrypting immediately
5. **Update S3 buckets** - New objects encrypted, existing objects unchanged

## Testing Security Controls

```bash
# Verify KMS keys are created
aws kms list-keys --region us-east-1

# Verify CloudTrail is active
aws cloudtrail get-trail-status --name ananta-dev-trail

# Verify CloudWatch metric filters
aws logs describe-metric-filters --log-group-name /aws/cloudtrail/ananta-dev

# Test unauthorized API call alarm
aws ec2 describe-instances --region us-west-2  # If you don't have permission

# Verify S3 encryption
aws s3api get-bucket-encryption --bucket ananta-dev-bom-123456789012

# Verify RDS encryption
aws rds describe-db-instances --db-instance-identifier ananta-dev-control-plane-postgres
```

## References

- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [CIS AWS Foundations Benchmark](https://www.cisecurity.org/benchmark/amazon_web_services)
- [AWS KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)
- [CloudTrail Best Practices](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/best-practices-security.html)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

## Support

For questions or issues with these security controls, contact the DevSecOps team or create an issue in the infrastructure repository.
