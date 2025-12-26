# Secrets Management Module

Terraform module for managing AWS Secrets Manager secrets with automatic rotation for the Ananta Platform SaaS.

## Features

- Centralized secret storage for all database credentials
- Automated secret rotation for PostgreSQL databases
- KMS encryption support
- VPC-aware rotation Lambda
- CloudWatch logging and monitoring
- IAM policies for ECS task access
- Recovery window configuration

## Secrets Managed

| Secret | Description | Rotation Supported |
|--------|-------------|-------------------|
| `control-plane-db` | Control plane PostgreSQL credentials | Yes |
| `app-plane-db` | App plane (Supabase) PostgreSQL credentials | Yes |
| `components-db` | Components-V2 PostgreSQL credentials | Yes |
| `redis` | Redis connection details | No |
| `keycloak` | Keycloak admin credentials | No (auto-generated) |
| `jwt` | JWT signing secret | No (auto-generated) |
| `api-keys` | External API keys (Novu, Stripe, etc.) | No |

## Usage

### Basic Usage (Rotation Disabled)

```hcl
module "secrets" {
  source = "../../modules/secrets"

  name_prefix             = "dev"
  secrets_manager_prefix  = "ananta"

  # Control Plane Database
  control_plane_db_host     = module.rds.control_plane_endpoint
  control_plane_db_port     = 5432
  control_plane_db_name     = "arc_saas"
  control_plane_db_password = var.control_plane_db_password

  # App Plane Database
  app_plane_db_host     = module.rds.app_plane_endpoint
  app_plane_db_port     = 5432
  app_plane_db_name     = "postgres"
  app_plane_db_password = var.app_plane_db_password

  # Components Database
  components_db_host     = module.rds.components_endpoint
  components_db_port     = 5432
  components_db_name     = "components_v2"
  components_db_password = var.components_db_password

  # Redis
  redis_endpoint = module.elasticache.redis_endpoint
  redis_port     = 6379

  # External API keys (optional)
  novu_api_key       = var.novu_api_key
  stripe_api_key     = var.stripe_api_key
  openai_api_key     = var.openai_api_key
  anthropic_api_key  = var.anthropic_api_key
  digikey_client_id  = var.digikey_client_id
  digikey_client_secret = var.digikey_client_secret
  mouser_api_key     = var.mouser_api_key

  tags = local.common_tags
}
```

### With Automatic Rotation Enabled

```hcl
module "secrets" {
  source = "../../modules/secrets"

  name_prefix             = "prod"
  secrets_manager_prefix  = "ananta"

  # Enable rotation
  enable_rotation = true
  rotation_days   = 30
  aws_region      = "us-east-1"

  # VPC configuration for rotation Lambda
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids
  rds_security_group_ids = [
    module.rds.control_plane_security_group_id,
    module.rds.app_plane_security_group_id,
    module.rds.components_security_group_id
  ]

  # RDS instance ARNs for IAM policies
  rds_instance_arns = [
    module.rds.control_plane_arn,
    module.rds.app_plane_arn,
    module.rds.components_arn
  ]

  # KMS key for encryption
  kms_key_arn = module.kms.secrets_key_arn

  # Database credentials
  control_plane_db_host     = module.rds.control_plane_endpoint
  control_plane_db_port     = 5432
  control_plane_db_name     = "arc_saas"
  control_plane_db_password = var.control_plane_db_password

  app_plane_db_host     = module.rds.app_plane_endpoint
  app_plane_db_port     = 5432
  app_plane_db_name     = "postgres"
  app_plane_db_password = var.app_plane_db_password

  components_db_host     = module.rds.components_endpoint
  components_db_port     = 5432
  components_db_name     = "components_v2"
  components_db_password = var.components_db_password

  redis_endpoint = module.elasticache.redis_endpoint
  redis_port     = 6379

  tags = local.common_tags
}
```

## Prerequisites for Rotation

Before enabling rotation, ensure:

1. **Docker installed** - Required to build the psycopg2 Lambda layer
2. **Build the Lambda layer**:
   ```bash
   # Linux/Mac
   cd modules/secrets/lambda
   ./build-layer.sh

   # Windows
   cd modules/secrets/lambda
   .\build-layer.ps1
   ```

3. **VPC configured** - Lambda needs network access to RDS
4. **Security groups** - Allow Lambda SG to access RDS on port 5432
5. **NAT Gateway** - Lambda in private subnet needs internet access for Secrets Manager API

## Rotation Process

The rotation Lambda implements AWS Secrets Manager's 4-step rotation:

### Step 1: createSecret
- Retrieves current database credentials
- Generates new 32-character password using `GetRandomPassword`
- Stores new version with `AWSPENDING` stage

### Step 2: setSecret
- Connects to database with current password
- Executes `ALTER USER postgres WITH PASSWORD 'new_password'`
- Validates password change succeeded

### Step 3: testSecret
- Connects to database with new password
- Executes test query `SELECT 1`
- Ensures new credentials work

### Step 4: finishSecret
- Moves `AWSCURRENT` stage to new version
- Previous version becomes `AWSPREVIOUS`

### Automatic Schedule
- Rotation triggers every N days (configurable)
- Default: 30 days
- Can be manually triggered anytime

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| name_prefix | Prefix for resource names | string | - | yes |
| secrets_manager_prefix | Prefix for secret names | string | "ananta" | no |
| control_plane_db_host | Control plane DB host | string | - | yes |
| control_plane_db_port | Control plane DB port | number | 5432 | no |
| control_plane_db_name | Control plane DB name | string | - | yes |
| control_plane_db_password | Control plane DB password | string | "" | yes |
| app_plane_db_host | App plane DB host | string | - | yes |
| app_plane_db_port | App plane DB port | number | 5432 | no |
| app_plane_db_name | App plane DB name | string | - | yes |
| app_plane_db_password | App plane DB password | string | "" | yes |
| components_db_host | Components DB host | string | - | yes |
| components_db_port | Components DB port | number | 5432 | no |
| components_db_name | Components DB name | string | - | yes |
| components_db_password | Components DB password | string | "" | yes |
| redis_endpoint | Redis endpoint | string | - | yes |
| redis_port | Redis port | number | 6379 | no |
| enable_rotation | Enable automatic secret rotation | bool | false | no |
| rotation_days | Days between rotations | number | 30 | no |
| recovery_window_days | Secret recovery window | number | 7 | no |
| vpc_id | VPC ID for rotation Lambda | string | "" | no |
| subnet_ids | Subnet IDs for rotation Lambda | list(string) | [] | no |
| rds_security_group_ids | RDS security group IDs | list(string) | [] | no |
| rds_instance_arns | RDS instance ARNs | list(string) | [] | no |
| kms_key_arn | KMS key ARN for encryption | string | "" | no |
| aws_region | AWS region | string | "us-east-1" | no |
| novu_api_key | Novu API key | string | "" | no |
| stripe_api_key | Stripe API key | string | "" | no |
| openai_api_key | OpenAI API key | string | "" | no |
| anthropic_api_key | Anthropic API key | string | "" | no |
| digikey_client_id | DigiKey client ID | string | "" | no |
| digikey_client_secret | DigiKey client secret | string | "" | no |
| mouser_api_key | Mouser API key | string | "" | no |
| tags | Resource tags | map(string) | {} | no |

## Outputs

| Name | Description |
|------|-------------|
| control_plane_db_secret_arn | Control plane DB secret ARN |
| control_plane_db_secret_name | Control plane DB secret name |
| app_plane_db_secret_arn | App plane DB secret ARN |
| app_plane_db_secret_name | App plane DB secret name |
| components_db_secret_arn | Components DB secret ARN |
| components_db_secret_name | Components DB secret name |
| redis_secret_arn | Redis secret ARN |
| redis_secret_name | Redis secret name |
| keycloak_secret_arn | Keycloak secret ARN |
| keycloak_secret_name | Keycloak secret name |
| jwt_secret_arn | JWT secret ARN |
| jwt_secret_name | JWT secret name |
| api_keys_secret_arn | API keys secret ARN |
| api_keys_secret_name | API keys secret name |
| secrets_access_policy_arn | IAM policy ARN for secrets access |
| all_secret_arns | List of all secret ARNs |
| rotation_lambda_arn | Rotation Lambda ARN (if enabled) |
| rotation_lambda_name | Rotation Lambda name (if enabled) |
| rotation_enabled | Whether rotation is enabled |
| rotation_schedule_days | Days between rotations |

## Accessing Secrets in ECS Tasks

### Attach IAM Policy

```hcl
resource "aws_iam_role_policy_attachment" "ecs_secrets" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = module.secrets.secrets_access_policy_arn
}
```

### Reference in ECS Task Definition

```hcl
resource "aws_ecs_task_definition" "app" {
  container_definitions = jsonencode([
    {
      name  = "app"
      image = "my-app:latest"
      secrets = [
        {
          name      = "DB_HOST"
          valueFrom = "${module.secrets.control_plane_db_secret_arn}:host::"
        },
        {
          name      = "DB_PASSWORD"
          valueFrom = "${module.secrets.control_plane_db_secret_arn}:password::"
        }
      ]
    }
  ])
}
```

## Manual Operations

### Trigger Rotation Manually

```bash
aws secretsmanager rotate-secret \
  --secret-id "ananta/prod/control-plane-db" \
  --region us-east-1
```

### Check Rotation Status

```bash
aws secretsmanager describe-secret \
  --secret-id "ananta/prod/control-plane-db" \
  --region us-east-1 \
  --query 'RotationEnabled'
```

### View Secret Value

```bash
aws secretsmanager get-secret-value \
  --secret-id "ananta/prod/control-plane-db" \
  --region us-east-1 \
  --query 'SecretString' \
  --output text | jq
```

### View Rotation Logs

```bash
aws logs tail /aws/lambda/prod-secrets-rotation \
  --follow \
  --region us-east-1
```

## Monitoring

### CloudWatch Metrics

The rotation Lambda emits these metrics:

- **Invocations** - Total rotation attempts
- **Errors** - Failed rotations
- **Duration** - Time to complete rotation

### Recommended Alarms

```hcl
resource "aws_cloudwatch_metric_alarm" "rotation_failures" {
  alarm_name          = "${var.name_prefix}-secrets-rotation-failures"
  alarm_description   = "Alert on secret rotation failures"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanThreshold"

  dimensions = {
    FunctionName = module.secrets.rotation_lambda_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}
```

## Troubleshooting

### Rotation Fails - Cannot Connect to Database

**Symptoms**: `setSecret` or `testSecret` step fails with connection timeout

**Causes**:
- Lambda security group not allowed in RDS security group
- Lambda in public subnet without internet gateway
- Lambda in private subnet without NAT gateway
- Incorrect VPC/subnet configuration

**Solutions**:
1. Verify Lambda security group is allowed on RDS port 5432
2. Deploy Lambda in private subnets with NAT gateway
3. Check VPC route tables have routes to NAT gateway
4. Verify RDS endpoint is resolvable from Lambda VPC

### Rotation Fails - Import Error psycopg2

**Symptoms**: Lambda fails with `ModuleNotFoundError: No module named 'psycopg2'`

**Cause**: Lambda layer not built or not compatible with Python 3.11

**Solution**:
```bash
cd modules/secrets/lambda
./build-layer.sh  # or .\build-layer.ps1 on Windows
terraform apply
```

### Rotation Succeeds but Applications Still Use Old Password

**Symptoms**: Applications can't connect after rotation

**Cause**: Applications not reading latest secret version

**Solution**: Ensure applications:
1. Read from Secrets Manager (not hardcoded)
2. Retrieve secrets on each connection (or cache with TTL)
3. Use `AWSCURRENT` version stage
4. Implement retry logic for transient failures

### Secret Deleted Accidentally

**Recovery**: Secrets have a 7-day recovery window (configurable)

```bash
# Restore deleted secret
aws secretsmanager restore-secret \
  --secret-id "ananta/prod/control-plane-db" \
  --region us-east-1
```

## Security Best Practices

1. **Enable KMS Encryption**: Use customer-managed KMS key for encryption at rest
2. **Least Privilege**: Grant only necessary permissions to IAM roles
3. **VPC Isolation**: Deploy rotation Lambda in private subnets
4. **Audit Logging**: Enable CloudTrail for Secrets Manager API calls
5. **Regular Rotation**: Keep rotation_days at 30 or less
6. **Recovery Window**: Maintain 7-day recovery window for accidental deletions
7. **Secret Complexity**: Generated passwords are 32 characters with high entropy
8. **Access Monitoring**: Set up CloudWatch alarms for secret access patterns

## Cost Considerations

### Secrets Manager Costs
- **Secret storage**: $0.40/secret/month
- **API calls**: $0.05 per 10,000 API calls
- **This module**: ~$2.80/month for 7 secrets (without rotation)

### Rotation Costs
- **Lambda invocations**: ~$0.20/month per secret (30-day rotation)
- **CloudWatch Logs**: ~$0.50/month
- **Total with rotation**: ~$4.50/month

### Cost Optimization
- Reduce rotation frequency for non-production environments
- Use CloudWatch Logs retention to control log storage costs
- Batch secret retrievals in applications to reduce API calls

## References

- [AWS Secrets Manager Rotation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)
- [Lambda VPC Networking](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html)
- [PostgreSQL ALTER USER](https://www.postgresql.org/docs/current/sql-alteruser.html)
- [Terraform AWS Provider - Secrets Manager](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/secretsmanager_secret)
