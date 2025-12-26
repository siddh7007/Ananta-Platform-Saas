# ECR Module

Terraform module for creating and managing Amazon Elastic Container Registry (ECR) repositories for the Ananta Platform SaaS services.

## Features

- **Automated Image Scanning**: Vulnerability scanning on every push using AWS ECR's built-in scanner
- **KMS Encryption**: Encrypt container images at rest using AWS KMS
- **Lifecycle Policies**: Automatic cleanup of old images to reduce storage costs
- **Cross-Account Access**: Optional policies for multi-account architectures
- **CI/CD Integration**: Repository policies for GitHub Actions OIDC roles
- **Multi-Region Replication**: Optional disaster recovery replication
- **CloudWatch Alarms**: Alerts for critical vulnerabilities
- **SSM Parameter Store**: Automatic storage of ECR URIs for easy reference

## Repository Organization

The module creates two sets of repositories:

### Control Plane Services
- `tenant-management-service` - Main tenant/subscription API
- `temporal-worker-service` - Temporal workflow workers
- `subscription-service` - Subscription management
- `orchestrator-service` - Workflow orchestration
- `admin-app` - Admin portal frontend
- `customer-portal` - Customer-facing portal

### App Plane Services
- `cns-service` - Component normalization service
- `cns-dashboard` - CNS admin UI
- `backend` - App plane backend API
- `customer-portal-app` - Customer portal app
- `backstage-portal` - Developer portal
- `dashboard` - Unified dashboard
- `audit-logger` - Audit logging service
- `middleware-api` - Middleware API gateway
- `novu-consumer` - Novu notification consumer

## Usage

### Basic Usage

```hcl
module "ecr" {
  source = "../../modules/ecr"

  name_prefix = "ananta"
  environment = "dev"

  kms_key_arn = module.kms.key_arn

  tags = {
    Environment = "dev"
    Project     = "ananta-platform"
    ManagedBy   = "terraform"
  }
}
```

### Production Configuration

```hcl
module "ecr" {
  source = "../../modules/ecr"

  name_prefix = "ananta"
  environment = "prod"

  # Security
  image_tag_mutability = "IMMUTABLE"
  scan_on_push         = true
  encryption_type      = "KMS"
  kms_key_arn          = module.kms.key_arn

  # Lifecycle policies
  keep_tagged_images_count = 20
  keep_dev_images_count    = 5
  untagged_image_days      = 3
  keep_any_images_count    = 100

  # Cross-account access for staging/prod isolation
  allow_pull_accounts = [
    "arn:aws:iam::123456789012:root"  # Staging account
  ]

  # CI/CD access
  cicd_role_arns = [
    "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/github-actions-ecr-push"
  ]

  # Disaster recovery
  enable_replication  = true
  replication_region  = "us-west-2"

  # Monitoring
  enable_vulnerability_alarms     = true
  critical_vulnerability_threshold = 0
  alarm_sns_topic_arns            = [module.monitoring.security_alerts_topic_arn]

  tags = {
    Environment = "prod"
    Project     = "ananta-platform"
    ManagedBy   = "terraform"
    CostCenter  = "platform-ops"
  }
}
```

### Multi-Environment Setup

```hcl
# Development
module "ecr_dev" {
  source = "../../modules/ecr"

  name_prefix              = "ananta"
  environment              = "dev"
  image_tag_mutability     = "MUTABLE"  # Allow overwriting tags in dev
  keep_tagged_images_count = 5
  kms_key_arn              = module.kms_dev.key_arn

  tags = local.dev_tags
}

# Production
module "ecr_prod" {
  source = "../../modules/ecr"

  name_prefix              = "ananta"
  environment              = "prod"
  image_tag_mutability     = "IMMUTABLE"  # Prevent tag overwrites
  keep_tagged_images_count = 30
  enable_replication       = true
  kms_key_arn              = module.kms_prod.key_arn

  tags = local.prod_tags
}
```

## Lifecycle Policy Logic

The module implements a four-tier cleanup strategy:

1. **Production Images** (Priority 1): Keep last N tagged production images (`prod-*`, `v*`)
2. **Development Images** (Priority 2): Keep last N dev/staging images (`dev-*`, `staging-*`, `test-*`)
3. **Untagged Images** (Priority 3): Remove untagged images older than N days
4. **Total Image Cap** (Priority 4): Keep only N total images across all categories

Example lifecycle behavior with defaults:
- Keep last 10 production releases (`v1.0.0`, `prod-2024-01-15`)
- Keep last 5 dev/staging builds
- Remove untagged images after 7 days
- Cap total images at 50

## Cross-Account Access

For multi-account setups (e.g., separate dev/staging/prod accounts):

```hcl
module "ecr" {
  source = "../../modules/ecr"

  # ... other config ...

  allow_pull_accounts = [
    "arn:aws:iam::111111111111:root",  # Dev account
    "arn:aws:iam::222222222222:root",  # Staging account
    "arn:aws:iam::333333333333:root",  # Prod account
  ]

  cicd_role_arns = [
    "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/github-actions-ecr"
  ]
}
```

## Integration with ECS

```hcl
module "ecr" {
  source = "../../modules/ecr"
  # ... config ...
}

module "ecs" {
  source = "../../modules/ecs"

  # Use ECR repository URLs from module outputs
  container_image = "${module.ecr.control_plane_repository_urls["tenant-management-service"]}:latest"

  # ... other ECS config ...
}
```

## SSM Parameter Integration

The module automatically creates SSM parameters for all repository URIs:

```bash
# Retrieve ECR URI from SSM
aws ssm get-parameter --name /dev/ecr/control-plane/tenant-management-service/uri --query 'Parameter.Value' --output text

# Use in scripts
IMAGE_URI=$(aws ssm get-parameter --name /dev/ecr/control-plane/admin-app/uri --query 'Parameter.Value' --output text)
docker pull $IMAGE_URI:latest
```

## Monitoring and Alerts

### Vulnerability Scanning

Every image pushed to ECR is automatically scanned for vulnerabilities. Critical findings trigger CloudWatch alarms.

```hcl
module "ecr" {
  source = "../../modules/ecr"

  enable_vulnerability_alarms      = true
  critical_vulnerability_threshold = 0  # Alert on ANY critical CVE
  alarm_sns_topic_arns             = [aws_sns_topic.security_alerts.arn]

  # ... other config ...
}
```

### CloudWatch Metrics

Available metrics:
- `CriticalVulnerabilityCount` - Number of critical CVEs
- `HighVulnerabilityCount` - Number of high-severity CVEs
- `MediumVulnerabilityCount` - Number of medium-severity CVEs

## GitHub Actions Integration

The ECR module works seamlessly with the `docker-build.yml` GitHub Actions workflow:

```yaml
# .github/workflows/docker-build.yml automatically:
# 1. Builds images for changed services
# 2. Scans with Trivy, Grype, and Hadolint
# 3. Pushes to ECR (on main branch)
# 4. Triggers ECR's built-in scanner
```

To enable GitHub Actions push access:

```hcl
module "ecr" {
  source = "../../modules/ecr"

  cicd_role_arns = [
    "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/github-actions-ecr-push"
  ]

  # ... other config ...
}
```

## Cost Optimization

### Storage Costs

ECR charges $0.10/GB/month for private repository storage. Lifecycle policies significantly reduce costs:

| Scenario | Without Policies | With Policies | Monthly Savings |
|----------|------------------|---------------|-----------------|
| 10 repos, 50 images each @ 500MB | $250/mo | $75/mo | $175/mo (70%) |
| 20 repos, 100 images each @ 300MB | $600/mo | $120/mo | $480/mo (80%) |

### Recommended Settings by Environment

| Environment | Tagged Images | Untagged Days | Max Total |
|-------------|---------------|---------------|-----------|
| Development | 5 | 3 | 20 |
| Staging | 10 | 7 | 50 |
| Production | 30 | 7 | 100 |

## Security Best Practices

1. **Always Enable Scan on Push**: Catches vulnerabilities before deployment
2. **Use Immutable Tags in Production**: Prevents accidental overwrites
3. **Enable KMS Encryption**: Protects images at rest
4. **Set Up Vulnerability Alarms**: Get notified of critical CVEs immediately
5. **Limit Cross-Account Access**: Only grant pull access to necessary accounts
6. **Use OIDC for CI/CD**: Avoid long-lived AWS credentials in GitHub

## Disaster Recovery

Enable multi-region replication for high-availability:

```hcl
module "ecr" {
  source = "../../modules/ecr"

  enable_replication = true
  replication_region = "us-west-2"  # DR region

  # ... other config ...
}
```

Replication is asynchronous and typically completes within minutes.

## Troubleshooting

### Image Scan Failures

```bash
# Check scan status
aws ecr describe-image-scan-findings \
  --repository-name ananta-control-plane-tenant-management-service \
  --image-id imageTag=latest

# Re-trigger scan
aws ecr start-image-scan \
  --repository-name ananta-control-plane-tenant-management-service \
  --image-id imageTag=latest
```

### Permission Issues

```bash
# Verify repository policy
aws ecr get-repository-policy \
  --repository-name ananta-control-plane-tenant-management-service

# Test pull access
docker pull <account-id>.dkr.ecr.us-east-1.amazonaws.com/ananta-control-plane-tenant-management-service:latest
```

### Lifecycle Policy Issues

```bash
# View lifecycle policy
aws ecr get-lifecycle-policy \
  --repository-name ananta-control-plane-tenant-management-service

# Preview lifecycle policy action (dry run)
aws ecr start-lifecycle-policy-preview \
  --repository-name ananta-control-plane-tenant-management-service \
  --lifecycle-policy-text "file://policy.json"
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| name_prefix | Prefix for resource naming | `string` | `"ananta"` | no |
| environment | Environment name (dev, staging, prod) | `string` | n/a | yes |
| control_plane_services | List of control plane services | `list(string)` | See variables.tf | no |
| app_plane_services | List of app plane services | `list(string)` | See variables.tf | no |
| image_tag_mutability | Image tag mutability (MUTABLE or IMMUTABLE) | `string` | `"IMMUTABLE"` | no |
| scan_on_push | Enable image scanning on push | `bool` | `true` | no |
| encryption_type | Encryption type (AES256 or KMS) | `string` | `"KMS"` | no |
| kms_key_arn | ARN of KMS key for encryption | `string` | `null` | yes (if KMS) |
| keep_tagged_images_count | Number of tagged production images to retain | `number` | `10` | no |
| keep_dev_images_count | Number of dev/staging images to retain | `number` | `5` | no |
| untagged_image_days | Days to retain untagged images | `number` | `7` | no |
| keep_any_images_count | Maximum total images to retain | `number` | `50` | no |
| allow_pull_accounts | AWS account ARNs allowed to pull images | `list(string)` | `null` | no |
| cicd_role_arns | CI/CD role ARNs allowed to push images | `list(string)` | `null` | no |
| enable_replication | Enable cross-region replication | `bool` | `false` | no |
| replication_region | Target region for replication | `string` | `"us-west-2"` | no |
| enable_vulnerability_alarms | Enable CloudWatch alarms for vulnerabilities | `bool` | `true` | no |
| critical_vulnerability_threshold | Threshold for critical CVE alarm | `number` | `0` | no |
| alarm_sns_topic_arns | SNS topic ARNs for alarms | `list(string)` | `[]` | no |

## Outputs

| Name | Description |
|------|-------------|
| control_plane_repository_urls | Map of control plane service names to ECR URLs |
| app_plane_repository_urls | Map of app plane service names to ECR URLs |
| all_repository_urls | Combined map of all repository URLs |
| registry_id | ECR registry ID (AWS account ID) |
| registry_url | Base ECR registry URL |
| docker_login_command | Command to authenticate Docker with ECR |

See `outputs.tf` for complete list of outputs.

## Examples

See `examples/` directory for:
- `basic/` - Minimal ECR setup for development
- `production/` - Production-ready configuration with all features
- `multi-account/` - Cross-account setup for isolated environments

## References

- [AWS ECR Documentation](https://docs.aws.amazon.com/ecr/)
- [ECR Lifecycle Policies](https://docs.aws.amazon.com/AmazonECR/latest/userguide/LifecyclePolicies.html)
- [ECR Image Scanning](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning.html)
- [GitHub Actions OIDC with AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
