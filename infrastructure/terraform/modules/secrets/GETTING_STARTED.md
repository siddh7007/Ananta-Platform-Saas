# Getting Started with Secrets Rotation

Quick start guide for implementing automatic secrets rotation in your environment.

## Prerequisites Checklist

Before you begin, ensure you have:

- [ ] AWS account with appropriate permissions
- [ ] Terraform >= 1.5.0 installed
- [ ] Docker installed and running
- [ ] AWS CLI configured
- [ ] VPC with private subnets and NAT gateway
- [ ] RDS PostgreSQL instances running
- [ ] Basic understanding of AWS Secrets Manager

## Step 1: Build the Lambda Layer (5 minutes)

The rotation Lambda requires the psycopg2 library for PostgreSQL connectivity.

### On Linux/Mac:

```bash
cd infrastructure/terraform/modules/secrets/lambda
chmod +x build-layer.sh
./build-layer.sh
```

### On Windows:

```powershell
cd infrastructure\terraform\modules\secrets\lambda
.\build-layer.ps1
```

### Verify:

```bash
ls -lh lambda/layers/psycopg2-layer.zip
# Should show ~5-10 MB file
```

## Step 2: Configure Terraform Variables (10 minutes)

### Option A: Start with Rotation Disabled (Recommended for Testing)

Create or update your environment-specific `terraform.tfvars`:

```hcl
# environments/dev/terraform.tfvars

# Basic secrets configuration
module "secrets" {
  source = "../../modules/secrets"

  name_prefix            = "dev"
  secrets_manager_prefix = "ananta"

  # Database credentials
  control_plane_db_host     = "dev-control-plane.abc123.us-east-1.rds.amazonaws.com"
  control_plane_db_name     = "arc_saas"
  control_plane_db_password = var.control_plane_db_password

  app_plane_db_host     = "dev-app-plane.xyz789.us-east-1.rds.amazonaws.com"
  app_plane_db_name     = "postgres"
  app_plane_db_password = var.app_plane_db_password

  components_db_host     = "dev-components.def456.us-east-1.rds.amazonaws.com"
  components_db_name     = "components_v2"
  components_db_password = var.components_db_password

  redis_endpoint = "dev-redis.abc123.cache.amazonaws.com"
  redis_port     = 6379

  # Rotation disabled for initial testing
  enable_rotation = false

  tags = {
    Environment = "dev"
    ManagedBy   = "Terraform"
  }
}
```

### Option B: Enable Rotation from the Start

If you're ready for full automation:

```hcl
# Add these to the above configuration
enable_rotation = true
rotation_days   = 30
aws_region      = "us-east-1"

# VPC configuration for Lambda
vpc_id     = "vpc-xxxxx"
subnet_ids = ["subnet-private-1", "subnet-private-2"]

# RDS security groups (Lambda needs access)
rds_security_group_ids = [
  "sg-control-plane-db",
  "sg-app-plane-db",
  "sg-components-db"
]

# RDS instance ARNs for IAM policies
rds_instance_arns = [
  "arn:aws:rds:us-east-1:123456789012:db:dev-control-plane",
  "arn:aws:rds:us-east-1:123456789012:db:dev-app-plane",
  "arn:aws:rds:us-east-1:123456789012:db:dev-components"
]

# Optional: KMS encryption
kms_key_arn = "arn:aws:kms:us-east-1:123456789012:key/xxxxx"
```

## Step 3: Initialize and Plan (5 minutes)

```bash
cd infrastructure/terraform/environments/dev

# Initialize Terraform
terraform init

# Format files
terraform fmt -recursive

# Validate configuration
terraform validate

# Review plan
terraform plan -out=tfplan
```

**Review the plan carefully**:
- Should create 7 secrets (3 databases, Redis, Keycloak, JWT, API keys)
- If rotation enabled: Lambda function, security group, IAM roles
- Check for any errors or unexpected changes

## Step 4: Deploy (10 minutes)

```bash
# Apply the plan
terraform apply tfplan

# Wait for completion
# Should take 2-5 minutes
```

**Expected output**:
```
Apply complete! Resources: 15 added, 0 changed, 0 destroyed.

Outputs:

control_plane_db_secret_arn = "arn:aws:secretsmanager:..."
rotation_enabled = true
rotation_lambda_arn = "arn:aws:lambda:..."
```

## Step 5: Verify Secrets Created (5 minutes)

```bash
# List secrets
aws secretsmanager list-secrets \
  --region us-east-1 \
  --query 'SecretList[?contains(Name, `ananta`)].{Name:Name,RotationEnabled:RotationEnabled}' \
  --output table

# Get secret value (verify format)
aws secretsmanager get-secret-value \
  --secret-id "ananta/dev/control-plane-db" \
  --region us-east-1 \
  --query 'SecretString' \
  --output text | jq
```

**Expected output**:
```json
{
  "host": "dev-control-plane.abc123.us-east-1.rds.amazonaws.com",
  "port": 5432,
  "dbname": "arc_saas",
  "username": "postgres",
  "password": "your-current-password",
  "engine": "postgres",
  "connection_string": "postgresql://postgres:your-current-password@..."
}
```

## Step 6: Test Manual Rotation (15 minutes)

**Important**: Test rotation on ONE secret first before enabling for all.

```bash
# Trigger rotation for control plane DB
aws secretsmanager rotate-secret \
  --secret-id "ananta/dev/control-plane-db" \
  --region us-east-1

# Watch Lambda logs
aws logs tail /aws/lambda/dev-secrets-rotation \
  --follow \
  --region us-east-1
```

**Look for these log messages**:
```
[ROTATION] Starting rotation for event: ...
[CREATE_SECRET] Created new secret version with AWSPENDING stage
[SET_SECRET] Successfully set new password in database
[TEST_SECRET] Successfully tested new secret
[FINISH_SECRET] Rotation complete
```

## Step 7: Verify Database Connection (5 minutes)

Test that the new password works:

```bash
# Get new password
NEW_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id "ananta/dev/control-plane-db" \
  --region us-east-1 \
  --query 'SecretString' \
  --output text | jq -r '.password')

# Test connection
psql -h dev-control-plane.abc123.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d arc_saas \
     -c "SELECT version();"
# Enter $NEW_PASSWORD when prompted
```

**Success indicators**:
- psql connects successfully
- Query returns PostgreSQL version
- No authentication errors

## Step 8: Update Applications (20 minutes)

### Update ECS Task Definitions

Before rotation, applications must read from Secrets Manager instead of environment variables.

**Update task definition**:
```json
{
  "family": "tenant-management-service",
  "taskRoleArn": "arn:aws:iam::123456789012:role/dev-ecs-task-role",
  "containerDefinitions": [
    {
      "name": "tenant-management-service",
      "image": "tenant-management-service:latest",
      "secrets": [
        {
          "name": "DB_HOST",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:ananta/dev/control-plane-db:host::"
        },
        {
          "name": "DB_PORT",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:ananta/dev/control-plane-db:port::"
        },
        {
          "name": "DB_NAME",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:ananta/dev/control-plane-db:dbname::"
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

### Attach IAM Policy

```bash
# Attach secrets access policy to ECS task role
aws iam attach-role-policy \
  --role-name dev-ecs-task-role \
  --policy-arn $(terraform output -raw secrets_access_policy_arn)
```

### Deploy Updated Application

```bash
# Update ECS service with new task definition
aws ecs update-service \
  --cluster dev-cluster \
  --service tenant-management-service \
  --task-definition tenant-management-service:NEW_REVISION \
  --force-new-deployment \
  --region us-east-1

# Wait for deployment
aws ecs wait services-stable \
  --cluster dev-cluster \
  --services tenant-management-service \
  --region us-east-1
```

## Step 9: Set Up Monitoring (10 minutes)

### Create SNS Topic for Alerts

```bash
# Create topic
aws sns create-topic \
  --name dev-secrets-rotation-alerts \
  --region us-east-1

# Subscribe email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:dev-secrets-rotation-alerts \
  --protocol email \
  --notification-endpoint devops@example.com \
  --region us-east-1

# Confirm subscription via email
```

### Create CloudWatch Alarms

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

## Step 10: Document and Train (15 minutes)

- [ ] Update team runbooks with rotation procedures
- [ ] Document emergency rollback procedure
- [ ] Share CloudWatch Logs dashboard link
- [ ] Schedule quarterly rotation testing
- [ ] Add rotation status to monitoring dashboards

## What's Next?

### For Development Environment:
- Monitor rotation for 1 week
- Test application behavior after rotation
- Verify no connection errors
- Document any issues

### For Staging Environment:
- Repeat steps 2-9 for staging
- Test with staging workload
- Verify zero downtime during rotation

### For Production Environment:
- Plan rotation during maintenance window
- Have rollback plan ready
- Monitor closely for first 3 rotations
- Consider shorter rotation interval (7-14 days initially)

## Common Issues and Solutions

### Issue: Lambda can't connect to RDS

**Solution**:
```bash
# Verify security group allows Lambda
aws ec2 describe-security-groups \
  --group-ids sg-rds-xxxxx \
  --query 'SecurityGroups[0].IpPermissions' \
  --region us-east-1

# Add Lambda security group to RDS
aws ec2 authorize-security-group-ingress \
  --group-id sg-rds-xxxxx \
  --protocol tcp \
  --port 5432 \
  --source-group sg-lambda-xxxxx \
  --region us-east-1
```

### Issue: Rotation timeout

**Solution**: Check Lambda VPC configuration has NAT gateway access.

```bash
# Verify NAT gateway route
aws ec2 describe-route-tables \
  --filters "Name=association.subnet-id,Values=subnet-private-1" \
  --query 'RouteTables[0].Routes' \
  --region us-east-1
```

### Issue: psycopg2 import error

**Solution**: Rebuild Lambda layer.

```bash
cd lambda
./build-layer.sh
cd ../../../environments/dev
terraform apply -target=module.secrets.aws_lambda_layer_version.psycopg2
```

## Quick Reference Commands

```bash
# Check rotation status
aws secretsmanager describe-secret \
  --secret-id "ananta/dev/control-plane-db" \
  --query '{Rotation:RotationEnabled,Next:NextRotationDate}'

# View logs
aws logs tail /aws/lambda/dev-secrets-rotation --follow

# Manual rotation
aws secretsmanager rotate-secret \
  --secret-id "ananta/dev/control-plane-db"

# Get current password
aws secretsmanager get-secret-value \
  --secret-id "ananta/dev/control-plane-db" \
  --query 'SecretString' --output text | jq -r '.password'
```

## Success Criteria

You've successfully implemented secrets rotation when:

- [ ] All 7 secrets created in Secrets Manager
- [ ] Lambda function deployed and accessible
- [ ] Manual rotation completes successfully
- [ ] Database connection works with new password
- [ ] Applications read secrets from Secrets Manager
- [ ] CloudWatch alarms configured and working
- [ ] Team trained on rotation procedures
- [ ] Rollback procedure tested and documented

## Estimated Time

**Total implementation time**: ~90 minutes

- Build layer: 5 min
- Configure Terraform: 10 min
- Deploy infrastructure: 10 min
- Test rotation: 15 min
- Update applications: 20 min
- Set up monitoring: 10 min
- Documentation: 15 min
- Buffer for troubleshooting: 15 min

## Need Help?

See these resources:
- `README.md` - Complete module documentation
- `DEPLOYMENT.md` - Detailed deployment checklist
- `QUICK_REFERENCE.md` - Command-line reference
- `IMPLEMENTATION_SUMMARY.md` - Technical overview

---

**Ready to start? Begin with Step 1!**
