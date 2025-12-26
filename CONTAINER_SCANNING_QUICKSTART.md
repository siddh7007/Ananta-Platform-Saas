# Container Security Scanning - Quick Start Guide

Get the Ananta Platform container security pipeline up and running in 30 minutes.

## Prerequisites

- AWS Account with admin access
- GitHub repository access
- Terraform 1.5+
- AWS CLI 2.0+
- GitHub CLI (optional)

## Step-by-Step Setup

### 1. Clone Repository and Navigate to Infrastructure

```bash
git clone https://github.com/your-org/ananta-platform-saas.git
cd ananta-platform-saas/infrastructure/terraform
```

### 2. Configure AWS Credentials

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: us-east-1
```

### 3. Create OIDC Provider (One-time setup)

```bash
# Navigate to dev environment
cd environments/dev

# Initialize Terraform
terraform init

# Create OIDC provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 4. Deploy ECR Module

Add to your `environments/dev/main.tf`:

```hcl
module "ecr" {
  source = "../../modules/ecr"

  name_prefix = "ananta"
  environment = "dev"

  # Use existing KMS key or create new one
  kms_key_arn = module.kms.key_arn

  # Basic configuration for dev
  scan_on_push         = true
  image_tag_mutability = "MUTABLE"

  tags = local.common_tags
}
```

Apply the configuration:

```bash
terraform plan
terraform apply
```

### 5. Create GitHub Actions IAM Role

Create `github-actions-oidc.tf`:

```hcl
resource "aws_iam_role" "github_actions" {
  name = "github-actions-ecr-push-dev"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
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
          "token.actions.githubusercontent.com:sub" = "repo:your-org/ananta-platform-saas:*"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_actions_ecr" {
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
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
        Resource = "arn:aws:ecr:us-east-1:*:repository/ananta-*"
      }
    ]
  })
}

output "github_actions_role_arn" {
  value = aws_iam_role.github_actions.arn
}
```

Apply:

```bash
terraform apply
```

### 6. Configure GitHub Secrets

Get the role ARN:

```bash
terraform output github_actions_role_arn
```

Add to GitHub:

```bash
# Using GitHub CLI
gh secret set AWS_ROLE_ARN_DEV -b "arn:aws:iam::123456789012:role/github-actions-ecr-push-dev"

# Or via GitHub UI
# Repository → Settings → Secrets → Actions → New repository secret
# Name: AWS_ROLE_ARN_DEV
# Value: <paste role ARN>
```

### 7. Verify Workflow File

The workflow file `.github/workflows/docker-build.yml` should already exist. Verify it references the correct secrets:

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN_DEV }}
    aws-region: us-east-1
```

### 8. Test the Pipeline

Trigger a test build:

```bash
# Make a small change to any Dockerfile
echo "# Test" >> arc-saas/services/tenant-management-service/Dockerfile

# Commit and push
git add .
git commit -m "test: trigger container security scan"
git push origin main
```

Watch the workflow:

```bash
# Using GitHub CLI
gh run watch

# Or check GitHub UI
# Repository → Actions → Docker Build and Security Scan
```

### 9. Review Scan Results

Check the GitHub Security tab:

1. Go to repository on GitHub
2. Click **Security** tab
3. Click **Code scanning alerts**
4. Filter by tool: Trivy, Grype, Hadolint

### 10. Verify ECR Images

Check that images were pushed to ECR:

```bash
# List ECR repositories
aws ecr describe-repositories --query 'repositories[].repositoryName' --output table

# List images in a repository
aws ecr list-images \
  --repository-name ananta-control-plane-tenant-management-service \
  --query 'imageIds[].imageTag' \
  --output table

# View scan results
aws ecr describe-image-scan-findings \
  --repository-name ananta-control-plane-tenant-management-service \
  --image-id imageTag=latest
```

## Quick Tests

### Test 1: Local Dockerfile Scan

```bash
# Navigate to project root
cd /path/to/ananta-platform-saas

# Scan a Dockerfile
./scripts/scan-container.sh \
  -t hadolint \
  -d arc-saas/services/tenant-management-service/Dockerfile
```

### Test 2: Local Image Scan

```bash
# Build an image locally
docker build -t test-image:latest \
  arc-saas/services/tenant-management-service/

# Scan with all tools
./scripts/scan-container.sh test-image:latest
```

### Test 3: Manual Workflow Trigger

```bash
# Trigger workflow via GitHub CLI
gh workflow run docker-build.yml

# Or via GitHub UI
# Actions → Docker Build and Security Scan → Run workflow
```

## Troubleshooting

### Issue: "OIDC provider not found"

**Fix:**
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### Issue: "Not authorized to perform sts:AssumeRoleWithWebIdentity"

**Fix:** Update trust policy in IAM role to match your repository:
```bash
# Check current trust policy
aws iam get-role --role-name github-actions-ecr-push-dev \
  --query 'Role.AssumeRolePolicyDocument'

# Verify "sub" matches: repo:YOUR-ORG/YOUR-REPO:*
```

### Issue: "Repository does not exist"

**Fix:** Create ECR repositories:
```bash
cd infrastructure/terraform/environments/dev
terraform apply -target=module.ecr
```

### Issue: Workflow fails with permission errors

**Fix:** Verify role has ECR push permissions:
```bash
aws iam get-role-policy \
  --role-name github-actions-ecr-push-dev \
  --policy-name ecr-push-policy
```

## Next Steps

1. **Review scan results** in GitHub Security tab
2. **Triage vulnerabilities** based on severity
3. **Update dependencies** to patch high/critical CVEs
4. **Configure alerts** for critical vulnerabilities
5. **Set up staging/prod** environments following the same process

## Daily Workflow

Once set up, the pipeline runs automatically:

1. Developer pushes code → Workflow triggers
2. Changed services detected → Images built
3. Security scans run → Results uploaded
4. If main branch → Images pushed to ECR
5. Team reviews findings → Patches applied as needed

## Key Files Reference

| File | Purpose |
|------|---------|
| `.github/workflows/docker-build.yml` | Main CI/CD pipeline |
| `infrastructure/terraform/modules/ecr/` | ECR infrastructure |
| `.hadolint.yaml` | Dockerfile linting rules |
| `.trivyignore` | Vulnerability exceptions |
| `scripts/scan-container.sh` | Local testing script |

## Documentation

- **Full Guide**: `docs/CONTAINER_SECURITY.md`
- **GitHub Setup**: `docs/GITHUB_ACTIONS_SETUP.md`
- **ECR Module**: `infrastructure/terraform/modules/ecr/README.md`

## Support

- **DevOps Team**: devops@ananta-platform.com
- **GitHub Issues**: Create an issue in the repository
- **Slack**: #platform-security channel

---

**Estimated Setup Time**: 30 minutes
**Prerequisites Met**: 5 minutes
**Terraform Apply**: 10 minutes
**GitHub Configuration**: 5 minutes
**Testing**: 10 minutes
