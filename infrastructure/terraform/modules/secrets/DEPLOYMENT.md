# Secrets Rotation Deployment Checklist

This checklist ensures proper deployment of the secrets rotation automation.

## Pre-Deployment Checklist

### Infrastructure Prerequisites

- [ ] **VPC configured with private subnets**
  - Private subnets have route to NAT gateway
  - NAT gateway is running and associated with Elastic IP
  - Route tables properly configured

- [ ] **RDS instances running**
  - Control Plane PostgreSQL database
  - App Plane (Supabase) PostgreSQL database
  - Components-V2 PostgreSQL database
  - All databases have `postgres` superuser

- [ ] **Security groups configured**
  - RDS security groups exist
  - RDS port 5432 accessible from VPC
  - Outbound rules allow internet access (for Secrets Manager API)

- [ ] **KMS key created (optional but recommended)**
  - Key policy allows Secrets Manager service
  - Key policy allows Lambda service for encryption/decryption
  - Key policy allows ECS task roles for GetSecretValue

### Build Prerequisites

- [ ] **Docker installed and running**
  ```bash
  docker --version
  docker ps
  ```

- [ ] **AWS CLI configured**
  ```bash
  aws sts get-caller-identity
  aws secretsmanager list-secrets --region us-east-1
  ```

- [ ] **Terraform installed**
  ```bash
  terraform --version  # Should be >= 1.5.0
  ```

## Build Lambda Layer

### Step 1: Build psycopg2 Layer

**Linux/Mac:**
```bash
cd infrastructure/terraform/modules/secrets/lambda
chmod +x build-layer.sh
./build-layer.sh
```

**Windows:**
```powershell
cd infrastructure\terraform\modules\secrets\lambda
.\build-layer.ps1
```

### Step 2: Verify Layer Built

```bash
# Check layer exists
ls -lh lambda/layers/psycopg2-layer.zip

# Verify size (should be 5-10 MB)
# If too small (<1 MB), build failed
```

**Expected output:**
```
-rw-r--r--  1 user  staff   7.2M Dec 21 10:00 psycopg2-layer.zip
```

## Terraform Deployment

### Step 3: Review Configuration

**Edit environment-specific tfvars:**
```bash
# For dev environment
vim environments/dev/terraform.tfvars
```

**Add rotation variables:**
```hcl
# Secrets rotation
enable_rotation = true
rotation_days   = 30

# VPC configuration
vpc_id     = "vpc-xxxxx"
subnet_ids = ["subnet-xxxxx", "subnet-yyyyy"]

# RDS security groups
rds_security_group_ids = [
  "sg-control-plane-xxxxx",
  "sg-app-plane-xxxxx",
  "sg-components-xxxxx"
]

# RDS instance ARNs
rds_instance_arns = [
  "arn:aws:rds:us-east-1:123456789012:db:dev-control-plane",
  "arn:aws:rds:us-east-1:123456789012:db:dev-app-plane",
  "arn:aws:rds:us-east-1:123456789012:db:dev-components"
]
```

### Step 4: Initialize Terraform

```bash
cd infrastructure/terraform/environments/dev
terraform init
terraform fmt
terraform validate
```

### Step 5: Plan Deployment

```bash
terraform plan -out=tfplan

# Review plan carefully:
# - 3 secrets should be created
# - 1 Lambda function should be created (if rotation enabled)
# - 3 rotation schedules should be created (if rotation enabled)
# - 1 security group for Lambda
# - IAM roles and policies
```

### Step 6: Apply Configuration

```bash
terraform apply tfplan
```

**Monitor output for:**
- Secret creation
- Lambda function creation
- Rotation schedule setup

### Step 7: Verify Deployment

```bash
# List secrets
aws secretsmanager list-secrets \
  --region us-east-1 \
  --query 'SecretList[?contains(Name, `ananta`)].{Name:Name,RotationEnabled:RotationEnabled}'

# Check Lambda function
aws lambda get-function \
  --function-name dev-secrets-rotation \
  --region us-east-1

# Verify VPC configuration
aws lambda get-function-configuration \
  --function-name dev-secrets-rotation \
  --region us-east-1 \
  --query 'VpcConfig'
```

## Post-Deployment Testing

### Step 8: Test Manual Rotation

**Start with ONE secret first:**
```bash
# Trigger rotation for control plane DB
aws secretsmanager rotate-secret \
  --secret-id "ananta/dev/control-plane-db" \
  --region us-east-1
```

**Monitor rotation progress:**
```bash
# Watch rotation status
watch -n 5 'aws secretsmanager describe-secret \
  --secret-id "ananta/dev/control-plane-db" \
  --region us-east-1 \
  --query "RotationEnabled"'
```

### Step 9: Check Lambda Logs

```bash
# Tail Lambda logs
aws logs tail /aws/lambda/dev-secrets-rotation \
  --follow \
  --region us-east-1
```

**Look for these log patterns:**
```
[ROTATION] Starting rotation for event: ...
[CREATE_SECRET] Creating new secret version...
[CREATE_SECRET] Created new secret version ... with AWSPENDING stage
[SET_SECRET] Setting new password in database...
[SET_SECRET] Connecting to database...
[SET_SECRET] Successfully set new password in database
[TEST_SECRET] Testing new password...
[TEST_SECRET] Successfully tested new secret - connection verified
[FINISH_SECRET] Finalizing rotation...
[FINISH_SECRET] Rotation complete - ... is now AWSCURRENT
```

### Step 10: Verify Database Connection

**Test with new credentials:**
```bash
# Get new password
NEW_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id "ananta/dev/control-plane-db" \
  --region us-east-1 \
  --query 'SecretString' \
  --output text | jq -r '.password')

# Test connection
psql -h <db-endpoint> -U postgres -d arc_saas -c "SELECT 1"
# When prompted, enter $NEW_PASSWORD
```

### Step 11: Rotate Remaining Secrets

**If first rotation succeeded:**
```bash
# App Plane DB
aws secretsmanager rotate-secret \
  --secret-id "ananta/dev/app-plane-db" \
  --region us-east-1

# Components DB
aws secretsmanager rotate-secret \
  --secret-id "ananta/dev/components-db" \
  --region us-east-1
```

## Monitoring Setup

### Step 12: Configure CloudWatch Alarms

```bash
# Create SNS topic for alerts
aws sns create-topic \
  --name dev-secrets-rotation-alerts \
  --region us-east-1

# Subscribe email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:dev-secrets-rotation-alerts \
  --protocol email \
  --notification-endpoint devops@example.com \
  --region us-east-1
```

### Step 13: Set Up Rotation Failure Alarms

```bash
# Alarm for rotation failures
aws cloudwatch put-metric-alarm \
  --alarm-name "dev-secrets-rotation-failures" \
  --alarm-description "Alert on secret rotation failures" \
  --metric-name "Errors" \
  --namespace "AWS/Lambda" \
  --statistic "Sum" \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator "GreaterThanThreshold" \
  --dimensions Name=FunctionName,Value=dev-secrets-rotation \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:dev-secrets-rotation-alerts \
  --region us-east-1
```

## Application Integration

### Step 14: Update ECS Task Definitions

**Update task definitions to read from Secrets Manager:**

```json
{
  "containerDefinitions": [
    {
      "name": "tenant-management-service",
      "secrets": [
        {
          "name": "DB_HOST",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:ananta/dev/control-plane-db:host::"
        },
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:ananta/dev/control-plane-db:password::"
        }
      ]
    }
  ]
}
```

### Step 15: Deploy Updated Applications

```bash
# Update ECS service
aws ecs update-service \
  --cluster dev-cluster \
  --service tenant-management-service \
  --force-new-deployment \
  --region us-east-1
```

### Step 16: Verify Applications

```bash
# Check ECS task logs
aws logs tail /ecs/dev/tenant-management-service \
  --follow \
  --region us-east-1

# Look for successful database connections
# Ensure no authentication errors
```

## Security Hardening

### Step 17: Remove Hardcoded Credentials

- [ ] Remove database passwords from `.env` files
- [ ] Remove passwords from ECS environment variables
- [ ] Update CI/CD pipelines to use Secrets Manager
- [ ] Rotate secrets one final time after cleanup

### Step 18: Audit Access

```bash
# Check who can access secrets
aws secretsmanager describe-secret \
  --secret-id "ananta/dev/control-plane-db" \
  --region us-east-1 \
  --query 'ARN' | xargs -I {} \
  aws iam get-policy-version \
    --policy-arn "arn:aws:iam::123456789012:policy/dev-secrets-access-policy" \
    --version-id v1
```

### Step 19: Enable CloudTrail Logging

- [ ] Ensure CloudTrail is logging Secrets Manager API calls
- [ ] Set up S3 bucket lifecycle policies for log retention
- [ ] Configure CloudTrail log file validation

## Rollback Procedure

### If Rotation Fails

**Step 1: Disable rotation**
```bash
aws secretsmanager cancel-rotate-secret \
  --secret-id "ananta/dev/control-plane-db" \
  --region us-east-1
```

**Step 2: Revert to previous version**
```bash
# Get previous version
PREVIOUS_VERSION=$(aws secretsmanager describe-secret \
  --secret-id "ananta/dev/control-plane-db" \
  --region us-east-1 \
  --query 'VersionIdsToStages[?contains(Value, `AWSPREVIOUS`)].Key | [0]' \
  --output text)

# Move AWSCURRENT to previous version
aws secretsmanager update-secret-version-stage \
  --secret-id "ananta/dev/control-plane-db" \
  --version-stage AWSCURRENT \
  --move-to-version-id $PREVIOUS_VERSION \
  --region us-east-1
```

**Step 3: Restart applications**
```bash
aws ecs update-service \
  --cluster dev-cluster \
  --service tenant-management-service \
  --force-new-deployment \
  --region us-east-1
```

## Maintenance

### Regular Tasks

- [ ] **Weekly**: Review rotation logs for errors
- [ ] **Monthly**: Test manual rotation in dev environment
- [ ] **Quarterly**: Update Lambda layer with latest psycopg2
- [ ] **Quarterly**: Review and update rotation schedule
- [ ] **Annually**: Rotate KMS keys used for secret encryption

### Monitoring Dashboard

Create CloudWatch dashboard with:
- Rotation success/failure rate
- Lambda execution duration
- Lambda error count
- Secret access patterns
- Database connection metrics

## Documentation

- [ ] Update runbooks with rotation procedures
- [ ] Document emergency access procedures
- [ ] Train team on rotation process
- [ ] Create escalation procedures for rotation failures

## Sign-Off

- [ ] **DevOps Lead**: Deployment verified
- [ ] **Security Lead**: Security controls validated
- [ ] **Platform Lead**: Application integration confirmed
- [ ] **SRE Lead**: Monitoring and alerting configured

---

**Deployment Date**: ______________

**Deployed By**: ______________

**Reviewed By**: ______________
