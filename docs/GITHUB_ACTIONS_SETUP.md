# GitHub Actions Setup Guide

Complete guide for configuring GitHub Actions for the Ananta Platform container security pipeline.

## Table of Contents

1. [Overview](#overview)
2. [AWS OIDC Configuration](#aws-oidc-configuration)
3. [Required Secrets](#required-secrets)
4. [IAM Roles and Policies](#iam-roles-and-policies)
5. [Testing the Setup](#testing-the-setup)
6. [Troubleshooting](#troubleshooting)

## Overview

The Ananta Platform uses **GitHub Actions OIDC** (OpenID Connect) for secure, keyless authentication with AWS. This eliminates the need for long-lived AWS credentials stored in GitHub Secrets.

### Benefits of OIDC

- **No long-lived credentials**: No access keys to rotate or leak
- **Scoped permissions**: Different roles for different environments
- **Automatic credential rotation**: Temporary credentials expire after 1 hour
- **Audit trail**: CloudTrail logs all AssumeRole operations
- **Principle of least privilege**: Fine-grained IAM policies per workflow

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Actions Workflow                      │
└──────────────────┬──────────────────────────────────────────────┘
                   │ 1. Request token from GitHub OIDC provider
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│              GitHub OIDC Provider (token.actions.githubusercontent.com)              │
└──────────────────┬──────────────────────────────────────────────┘
                   │ 2. Return JWT token with repository claims
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                 AWS IAM OIDC Identity Provider                   │
│              (Verifies token signature and claims)               │
└──────────────────┬──────────────────────────────────────────────┘
                   │ 3. Validate token + AssumeRoleWithWebIdentity
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    IAM Role (github-actions-ecr-push)                    │
│                  (Grants ECR push permissions)                   │
└──────────────────┬──────────────────────────────────────────────┘
                   │ 4. Return temporary AWS credentials
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                GitHub Actions (Push to ECR)                      │
└─────────────────────────────────────────────────────────────────┘
```

## AWS OIDC Configuration

### Step 1: Create OIDC Identity Provider in AWS

Run this **once per AWS account**:

```bash
# Option A: AWS Console
# 1. Go to IAM → Identity providers → Add provider
# 2. Provider type: OpenID Connect
# 3. Provider URL: https://token.actions.githubusercontent.com
# 4. Audience: sts.amazonaws.com
# 5. Click "Add provider"

# Option B: AWS CLI
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Option C: Terraform (recommended)
# See infrastructure/terraform/modules/ecr/examples/production/main.tf
```

**Thumbprint verification**:
```bash
# The thumbprint above is GitHub's current certificate thumbprint
# To verify/update:
echo | openssl s_client -servername token.actions.githubusercontent.com \
  -connect token.actions.githubusercontent.com:443 2>/dev/null | \
  openssl x509 -fingerprint -noout | \
  sed 's/://g' | \
  awk -F= '{print tolower($2)}'
```

### Step 2: Create IAM Roles

Create separate roles for each environment (dev, staging, prod):

#### Development Environment Role

```hcl
# Terraform: infrastructure/terraform/modules/iam/github-actions.tf

resource "aws_iam_role" "github_actions_dev" {
  name = "github-actions-ecr-push-dev"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            # Replace with your GitHub organization and repository
            "token.actions.githubusercontent.com:sub" = "repo:your-org/ananta-platform-saas:*"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "github-actions-ecr-push-dev"
    Environment = "dev"
  }
}
```

#### Production Environment Role (More Restrictive)

```hcl
resource "aws_iam_role" "github_actions_prod" {
  name = "github-actions-ecr-push-prod"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            # Only allow main branch in production
            "token.actions.githubusercontent.com:sub" = "repo:your-org/ananta-platform-saas:ref:refs/heads/main"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "github-actions-ecr-push-prod"
    Environment = "prod"
  }
}
```

### Step 3: Attach IAM Policies

#### ECR Push Policy

```hcl
resource "aws_iam_role_policy" "github_actions_ecr_push" {
  name = "ecr-push-policy"
  role = aws_iam_role.github_actions_dev.id  # Repeat for staging/prod

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GetAuthorizationToken"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowPushPull"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "arn:aws:ecr:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:repository/ananta-*"
      },
      {
        Sid    = "AllowDescribeImages"
        Effect = "Allow"
        Action = [
          "ecr:DescribeImages",
          "ecr:DescribeRepositories",
          "ecr:ListImages"
        ]
        Resource = "arn:aws:ecr:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:repository/ananta-*"
      }
    ]
  })
}
```

### Step 4: Apply Terraform Configuration

```bash
cd infrastructure/terraform/environments/dev

# Initialize Terraform
terraform init

# Plan changes
terraform plan -out=tfplan

# Apply (creates OIDC provider + IAM roles)
terraform apply tfplan

# Get role ARNs for GitHub Secrets
terraform output github_actions_role_arn_dev
terraform output github_actions_role_arn_staging
terraform output github_actions_role_arn_prod
```

## Required Secrets

Configure these secrets in your GitHub repository:

### Navigate to GitHub Repository Settings

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

### Add the Following Secrets

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `AWS_ROLE_ARN_DEV` | IAM role ARN for dev environment | `arn:aws:iam::123456789012:role/github-actions-ecr-push-dev` |
| `AWS_ROLE_ARN_STAGING` | IAM role ARN for staging environment | `arn:aws:iam::123456789012:role/github-actions-ecr-push-staging` |
| `AWS_ROLE_ARN_PROD` | IAM role ARN for production environment | `arn:aws:iam::987654321098:role/github-actions-ecr-push-prod` |

### Retrieve Role ARNs

```bash
# Via Terraform output
cd infrastructure/terraform/environments/dev
terraform output github_actions_role_arn_dev

# Via AWS CLI
aws iam get-role --role-name github-actions-ecr-push-dev \
  --query 'Role.Arn' --output text
```

### Using GitHub CLI

```bash
# Install GitHub CLI: https://cli.github.com/

# Set secrets
gh secret set AWS_ROLE_ARN_DEV -b "arn:aws:iam::123456789012:role/github-actions-ecr-push-dev"
gh secret set AWS_ROLE_ARN_STAGING -b "arn:aws:iam::123456789012:role/github-actions-ecr-push-staging"
gh secret set AWS_ROLE_ARN_PROD -b "arn:aws:iam::987654321098:role/github-actions-ecr-push-prod"

# Verify
gh secret list
```

## IAM Roles and Policies

### Principle of Least Privilege

Each environment has a separate IAM role with specific permissions:

| Environment | Branch Restriction | ECR Repositories | Max Session Duration |
|-------------|-------------------|------------------|----------------------|
| Development | Any branch | `ananta-*` | 1 hour |
| Staging | `main`, `staging` | `ananta-*` | 1 hour |
| Production | `main` only | `ananta-*` (prod tags only) | 1 hour |

### Trust Policy Example

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:your-org/ananta-platform-saas:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

### Permission Policy Example

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAuthToken",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Sid": "ECRPushPull",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "arn:aws:ecr:us-east-1:123456789012:repository/ananta-*"
    }
  ]
}
```

## Testing the Setup

### Test 1: Verify OIDC Provider

```bash
aws iam list-open-id-connect-providers

# Expected output:
# {
#     "OpenIDConnectProviderList": [
#         {
#             "Arn": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
#         }
#     ]
# }
```

### Test 2: Verify IAM Role

```bash
aws iam get-role --role-name github-actions-ecr-push-dev

# Check trust policy allows GitHub Actions
aws iam get-role --role-name github-actions-ecr-push-dev \
  --query 'Role.AssumeRolePolicyDocument' \
  --output json | jq
```

### Test 3: Trigger Workflow Manually

```bash
# Via GitHub CLI
gh workflow run docker-build.yml

# Via GitHub UI
# 1. Go to Actions tab
# 2. Select "Docker Build and Security Scan"
# 3. Click "Run workflow"
# 4. Select environment (dev)
# 5. Click "Run workflow"
```

### Test 4: Check Workflow Logs

```bash
# List recent workflow runs
gh run list --workflow=docker-build.yml

# View logs for specific run
gh run view <run-id> --log
```

### Expected Successful Output

```
Run Configure AWS credentials
Assuming role: arn:aws:iam::123456789012:role/github-actions-ecr-push-dev
Successfully assumed role!
AWS credentials configured successfully
```

## Troubleshooting

### Error: "Not authorized to perform sts:AssumeRoleWithWebIdentity"

**Cause**: Trust policy doesn't allow your repository/branch.

**Fix**: Update trust policy condition:

```bash
# Check current trust policy
aws iam get-role --role-name github-actions-ecr-push-dev \
  --query 'Role.AssumeRolePolicyDocument.Statement[0].Condition'

# Verify repository name matches exactly
# Format: repo:your-org/your-repo:ref:refs/heads/main
```

### Error: "OpenIDConnect provider not found"

**Cause**: OIDC provider not created in AWS account.

**Fix**: Create OIDC provider (see Step 1).

### Error: "Access denied" during ECR push

**Cause**: IAM role lacks ECR push permissions.

**Fix**: Verify IAM policy:

```bash
# List policies attached to role
aws iam list-role-policies --role-name github-actions-ecr-push-dev

# Get policy document
aws iam get-role-policy \
  --role-name github-actions-ecr-push-dev \
  --policy-name ecr-push-policy
```

### Error: "Repository does not exist"

**Cause**: ECR repository not created.

**Fix**: Create ECR repositories via Terraform:

```bash
cd infrastructure/terraform/environments/dev
terraform apply -target=module.ecr
```

### Debug Mode

Enable debug logging in GitHub Actions:

1. Go to repository **Settings** → **Secrets**
2. Add secret: `ACTIONS_STEP_DEBUG` = `true`
3. Re-run workflow
4. Check logs for detailed AWS SDK output

### Verify Temporary Credentials

Add this step to your workflow for debugging:

```yaml
- name: Debug AWS credentials
  run: |
    echo "AWS Account ID:"
    aws sts get-caller-identity
    echo "Session expiry:"
    aws sts get-caller-identity --query 'Account' --output text
```

## Security Best Practices

### 1. Separate Roles Per Environment

Never reuse the same role across environments:

```
✅ GOOD
- github-actions-ecr-push-dev
- github-actions-ecr-push-staging
- github-actions-ecr-push-prod

❌ BAD
- github-actions-ecr-push (shared across all environments)
```

### 2. Restrict by Branch

Production roles should only allow main branch:

```json
"Condition": {
  "StringEquals": {
    "token.actions.githubusercontent.com:sub": "repo:org/repo:ref:refs/heads/main"
  }
}
```

### 3. Rotate Thumbprints

GitHub's certificate thumbprint may change. Automate checks:

```bash
# Add to cron job or monitoring
./scripts/check-github-oidc-thumbprint.sh
```

### 4. Monitor AssumeRole Calls

Set up CloudWatch alarms for suspicious activity:

```hcl
resource "aws_cloudwatch_log_metric_filter" "assume_role_failures" {
  name           = "github-actions-assume-role-failures"
  log_group_name = "/aws/cloudtrail/events"

  pattern = <<PATTERN
{
  ($.eventName = "AssumeRoleWithWebIdentity") &&
  ($.errorCode = "AccessDenied")
}
PATTERN

  metric_transformation {
    name      = "AssumeRoleFailures"
    namespace = "GitHubActions"
    value     = "1"
  }
}
```

### 5. Use Environment Secrets (GitHub Environments)

For additional protection, use GitHub Environments:

1. Create environment: **Settings** → **Environments** → **New environment**
2. Name: `production`
3. Add protection rules:
   - Required reviewers (e.g., 2 approvals)
   - Deployment branches: `main` only
4. Add environment secrets:
   - `AWS_ROLE_ARN` (scoped to production environment)

Update workflow:

```yaml
jobs:
  deploy-prod:
    runs-on: ubuntu-latest
    environment: production  # Requires approval
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}  # Environment secret
```

## Additional Resources

- [GitHub Actions OIDC with AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS IAM OIDC Identity Providers](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
- [AWS ECR IAM Policies](https://docs.aws.amazon.com/AmazonECR/latest/userguide/security_iam_id-based-policy-examples.html)
- [GitHub Secrets Management](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

## Quick Reference

### GitHub CLI Commands

```bash
# List secrets
gh secret list

# Set secret
gh secret set SECRET_NAME -b "value"

# Delete secret
gh secret delete SECRET_NAME

# List workflow runs
gh run list --workflow=docker-build.yml --limit 5

# View workflow logs
gh run view --log

# Trigger workflow
gh workflow run docker-build.yml
```

### AWS CLI Commands

```bash
# List OIDC providers
aws iam list-open-id-connect-providers

# Get role details
aws iam get-role --role-name <role-name>

# Test role assumption (requires valid OIDC token)
aws sts assume-role-with-web-identity \
  --role-arn arn:aws:iam::123456789012:role/github-actions-ecr-push-dev \
  --role-session-name github-actions-test \
  --web-identity-token <token>

# List ECR repositories
aws ecr describe-repositories --query 'repositories[].repositoryName'
```

### Terraform Commands

```bash
# Initialize
terraform init

# Plan (review changes)
terraform plan

# Apply
terraform apply

# Output role ARNs
terraform output github_actions_role_arn_dev
```
