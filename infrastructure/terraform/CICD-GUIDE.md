# Terraform CI/CD Pipeline Guide

## Overview

The Ananta Platform SaaS infrastructure uses a comprehensive, production-grade CI/CD pipeline for Terraform deployments with built-in security scanning, cost estimation, drift detection, and automated rollback capabilities.

## Workflows

### 1. Main Terraform Workflow (`.github/workflows/terraform.yml`)

**Triggers:**
- Pull requests to `main`/`master`
- Push to `main`/`master` (auto-applies to dev)
- Manual workflow dispatch

**Pipeline Stages:**

#### Stage 1: Validation
```
Format Check → Validate → Security Scan → Cost Estimation
                                ↓
                          Plan (Dev/Staging/Prod)
                                ↓
                          Apply (with approval)
                                ↓
                          Rollback (on failure)
```

#### Key Features

**Security Scanning (HARDENED)**
- `tfsec`: Blocks staging/prod deployments on MEDIUM+ vulnerabilities
- `Checkov`: Framework compliance scanning
- Soft-fail enabled only for dev/PR environments
- Security scan results posted to PRs
- Baseline files for accepted risks

**Cost Estimation (Infracost)**
- Automatic cost breakdown on every PR
- Posted as PR comment for review
- Tracks cost changes across environments
- Requires `INFRACOST_API_KEY` secret

**State Backup & Rollback**
- Automatic state backup before every apply
- Stored in S3 with timestamp: `s3://{bucket}/ananta-platform/{env}/backups/terraform.tfstate.{timestamp}`
- Automatic rollback on apply failure
- Manual rollback support via workflow dispatch

**Lock Timeout Protection**
- All terraform commands use `-lock-timeout=300s` (5 minutes)
- Prevents hung workflows from lock contention
- DynamoDB state locking enforced

### 2. Drift Detection Workflow (`.github/workflows/terraform-drift.yml`)

**Triggers:**
- Scheduled: Every 6 hours (`0 */6 * * *`)
- Manual workflow dispatch

**What it Does:**
1. Runs `terraform plan -detailed-exitcode` on all environments
2. Detects infrastructure drift (exit code 2)
3. Creates GitHub issues on drift detection
4. Labels issues by environment and severity:
   - Dev: `drift`, `infrastructure`, `dev`
   - Staging: `drift`, `infrastructure`, `staging`, `priority:high`
   - Prod: `drift`, `infrastructure`, `production`, `priority:critical`

**Drift Detection Logic:**
```bash
Exit Code 0: No drift detected
Exit Code 2: Drift detected (creates issue)
Exit Code 1: Error (fails workflow)
```

**GitHub Issue Auto-Creation:**
- Includes full terraform plan output
- Links to workflow run
- Auto-assigns to `@devops-team` for production
- Includes remediation checklist

### 3. Module Testing Workflow (`.github/workflows/terraform-module-test.yml`)

**Triggers:**
- Pull requests modifying `infrastructure/terraform/modules/**`
- Push to `main`/`master`
- Manual workflow dispatch

**Test Stages:**

#### Module Validation
- Validates syntax of all modules
- Checks for required files (`README.md`, `variables.tf`, `outputs.tf`)
- Ensures documentation completeness

#### Security Scanning
- `tfsec` on modules (HIGH+ severity)
- `Checkov` framework compliance
- No soft-fail - blocks on security issues

#### Terratest Integration Tests
- Go-based integration tests
- Tests module functionality in real AWS environment
- Runs in dev environment with automatic cleanup
- Parallel test execution (4 concurrent tests)
- 30-minute timeout

#### Documentation Generation
- Auto-generates module documentation
- Uses `terraform-docs`
- Comments on PR if docs are outdated

#### Complexity Analysis
- Counts resources, data sources, variables, outputs
- Calculates lines of code per module
- Posts complexity report to PR
- Helps identify overly complex modules

## Environment Strategy

| Environment | Trigger | Approval Required | Security Scan | Auto-Apply |
|-------------|---------|-------------------|---------------|------------|
| **Dev** | PR creation, merge to main | No | Soft-fail | Yes (on merge) |
| **Staging** | Merge to main | Yes (manual) | Hard-fail | No |
| **Prod** | Manual dispatch only | Yes (manual) | Hard-fail | No |

## Required GitHub Secrets

### AWS OIDC Authentication
- `AWS_ROLE_ARN_DEV`: IAM role ARN for dev environment
- `AWS_ROLE_ARN_STAGING`: IAM role ARN for staging environment
- `AWS_ROLE_ARN_PROD`: IAM role ARN for prod environment

### Terraform State
- `TF_STATE_BUCKET`: S3 bucket name for remote state
- `TF_LOCK_TABLE`: DynamoDB table name for state locking

### Cost Estimation
- `INFRACOST_API_KEY`: Infracost API key (get from https://www.infracost.io/)

### Optional
- `SLACK_WEBHOOK_URL`: For Slack notifications on drift/failures

## GitHub Environment Configuration

Set up GitHub environments with protection rules:

### Dev Environment
- No protection rules (auto-deploys)
- Secrets: `AWS_ROLE_ARN_DEV`

### Staging Environment
- Required reviewers: 1 DevOps team member
- Secrets: `AWS_ROLE_ARN_STAGING`

### Prod Environment
- Required reviewers: 2 DevOps team members
- Deployment branches: `main` only
- Secrets: `AWS_ROLE_ARN_PROD`

## Security Baseline Files

### `.tfsec-baseline.json`
```json
{
  "baseline_info": {
    "created_at": "2025-12-21",
    "description": "Accepted tfsec findings",
    "version": "1.0.0"
  },
  "excluded_checks": [
    "aws-s3-enable-versioning"
  ]
}
```

### `.checkov-baseline.json`
```json
{
  "baseline_info": {
    "created_at": "2025-12-21",
    "description": "Accepted Checkov findings",
    "version": "1.0.0"
  },
  "skip_checks": [
    "CKV_AWS_19"
  ]
}
```

**When to Add to Baseline:**
1. Document the risk acceptance decision
2. Get approval from security team
3. Add check ID to baseline file
4. Commit with clear justification

## Usage Examples

### Deploying to Dev (Automatic)
```bash
# 1. Create PR with terraform changes
git checkout -b feature/new-infrastructure
# ... make changes ...
git commit -m "Add new VPC module"
git push origin feature/new-infrastructure

# 2. Create PR - workflow runs automatically:
#    - Format check
#    - Validation
#    - Security scan
#    - Cost estimation
#    - Plan (dev)
#    - Posts results to PR

# 3. Merge PR - auto-applies to dev
```

### Deploying to Staging (Manual)
```bash
# 1. Merge to main first (deploys to dev)

# 2. Go to GitHub Actions → Terraform workflow
# 3. Click "Run workflow"
# 4. Select:
#    - Environment: staging
#    - Action: plan
# 5. Review plan output
# 6. Run again with Action: apply
# 7. Approve deployment in GitHub UI
```

### Deploying to Production (Manual + Multi-Approval)
```bash
# 1. Test in staging first

# 2. Go to GitHub Actions → Terraform workflow
# 3. Click "Run workflow"
# 4. Select:
#    - Environment: prod
#    - Action: plan
# 5. Review plan output carefully
# 6. Run again with Action: apply
# 7. Get approval from 2 DevOps team members
# 8. Deployment executes
```

### Checking for Drift
```bash
# Manual drift check
# GitHub Actions → Terraform Drift Detection → Run workflow
# Select environment: all (or specific)

# Check scheduled drift detection results
# GitHub Issues → filter by label: drift

# Fix drift
git checkout -b fix/infrastructure-drift
# Update terraform to match actual state OR
# Run terraform apply to restore desired state
```

### Rollback After Failed Apply
```bash
# Automatic rollback happens on failure

# Manual rollback (if needed):
# 1. Find backup in S3:
aws s3 ls s3://{bucket}/ananta-platform/{env}/backups/

# 2. Restore specific backup:
aws s3 cp \
  s3://{bucket}/ananta-platform/{env}/backups/terraform.tfstate.20231221-143022 \
  s3://{bucket}/ananta-platform/{env}/terraform.tfstate

# 3. Verify state:
terraform init
terraform plan
```

### Running Module Tests Locally
```bash
cd infrastructure/terraform/test

# Install dependencies
go mod tidy

# Run all tests
go test -v -timeout 30m

# Run specific test
go test -v -timeout 30m -run TestTerraformBasicExample

# Run tests in parallel
go test -v -timeout 30m -parallel 4
```

## Monitoring & Alerts

### GitHub Actions Notifications
- Failed workflows send email to committer
- Failed prod deploys create high-priority issues

### Drift Detection Alerts
- Creates GitHub issue on drift detection
- Runs every 6 hours
- Production drift creates critical priority issues

### Cost Monitoring
- Infracost posts cost changes to every PR
- Review cost increases before merging
- Set up Infracost budget alerts in their dashboard

## Best Practices

### 1. Always Test in Dev First
```bash
# GOOD: Test in dev, promote to staging, then prod
PR → Dev (auto) → Staging (manual) → Prod (manual + approval)

# BAD: Direct prod changes
❌ Manual prod deployment without testing
```

### 2. Review Security Scan Results
```bash
# Check PR comments for security findings
# Fix MEDIUM+ findings before merging
# Document any accepted risks in baseline files
```

### 3. Monitor Cost Changes
```bash
# Review Infracost comment on every PR
# Question unexpected cost increases
# Optimize resources before merging
```

### 4. Keep State Backups
```bash
# State is automatically backed up before every apply
# Verify backups exist:
aws s3 ls s3://{bucket}/ananta-platform/{env}/backups/

# Keep backups for 90 days minimum
```

### 5. Handle Drift Promptly
```bash
# Check drift detection issues weekly
# Fix drift within 24 hours for prod
# Document reasons for expected drift
```

### 6. Lock Timeout Best Practices
```bash
# If you encounter lock timeouts:
# 1. Check for stuck workflows in GitHub Actions
# 2. Verify DynamoDB lock table is healthy
# 3. Check if another team member is running terraform
# 4. Wait for lock timeout (5 minutes) before retrying
```

## Troubleshooting

### Issue: Security Scan Blocks Deployment
```bash
# 1. Review security findings in workflow logs
# 2. Fix the security issues in code
# 3. If false positive, add to baseline:
#    - Get security team approval
#    - Document in .tfsec-baseline.json or .checkov-baseline.json
#    - Commit baseline update
```

### Issue: Cost Estimate Too High
```bash
# 1. Review Infracost PR comment
# 2. Identify expensive resources
# 3. Optimize:
#    - Use smaller instance types
#    - Enable autoscaling
#    - Use reserved instances
#    - Remove unnecessary resources
```

### Issue: Terraform Lock Timeout
```bash
# 1. Check DynamoDB lock table:
aws dynamodb scan --table-name {LOCK_TABLE}

# 2. Force unlock (DANGEROUS - use carefully):
terraform force-unlock {LOCK_ID}

# 3. Wait for automatic timeout (5 minutes)
```

### Issue: Drift Detected in Production
```bash
# 1. Review drift detection issue
# 2. Determine cause:
#    - Manual changes via console? → Revert or update terraform
#    - Autoscaling changes? → Update terraform to match
#    - Expected operational changes? → Document and close
# 3. Apply fix within 24 hours
```

### Issue: Apply Failed, Rollback Didn't Work
```bash
# 1. Check workflow logs for rollback errors
# 2. Manually restore from backup:
aws s3 ls s3://{bucket}/ananta-platform/{env}/backups/
aws s3 cp s3://{bucket}/ananta-platform/{env}/backups/{latest} \
  s3://{bucket}/ananta-platform/{env}/terraform.tfstate

# 3. Verify state integrity:
terraform init
terraform plan

# 4. Fix underlying issue before retrying
```

## CI/CD Pipeline Metrics

Track these metrics for pipeline health:

- **Deployment Frequency**: Target 5-10 deploys/week to dev
- **Lead Time**: PR creation to prod deployment < 2 days
- **Change Failure Rate**: < 15% of deployments require rollback
- **Mean Time to Recovery**: < 1 hour for failed deployments
- **Security Scan Pass Rate**: > 95% of PRs pass security scans
- **Drift Detection Rate**: < 5% of drift checks find issues

## Future Enhancements

### Planned Improvements
- [ ] Slack notifications for drift and failures
- [ ] Automatic remediation for common drift scenarios
- [ ] Integration with Terraform Cloud for remote runs
- [ ] Policy-as-code enforcement with OPA/Sentinel
- [ ] Automated compliance reporting
- [ ] Multi-region deployment support
- [ ] Blue/green infrastructure deployments
- [ ] Automated testing in ephemeral environments

## Support

For issues with CI/CD pipeline:
1. Check GitHub Actions workflow logs
2. Review this guide for troubleshooting steps
3. Contact DevOps team via Slack: #devops-support
4. Create issue in this repo with label: `cicd-pipeline`

## References

- [Terraform Best Practices](https://www.terraform-best-practices.com/)
- [Terratest Documentation](https://terratest.gruntwork.io/)
- [Infracost Documentation](https://www.infracost.io/docs/)
- [tfsec Documentation](https://aquasecurity.github.io/tfsec/)
- [Checkov Documentation](https://www.checkov.io/)
