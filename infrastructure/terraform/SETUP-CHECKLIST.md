# CI/CD Pipeline Setup Checklist

Quick checklist for setting up the enhanced Terraform CI/CD pipeline.

## Prerequisites

### 1. AWS OIDC Setup
- [ ] Create OIDC provider in AWS IAM
- [ ] Create IAM roles for each environment:
  - [ ] `ananta-platform-github-dev-role`
  - [ ] `ananta-platform-github-staging-role`
  - [ ] `ananta-platform-github-prod-role`
- [ ] Attach appropriate policies to roles
- [ ] Note down role ARNs

### 2. S3 State Bucket Setup
- [ ] Create S3 bucket for Terraform state
- [ ] Enable versioning on bucket
- [ ] Enable encryption (AES-256 or KMS)
- [ ] Create `backups/` prefix structure:
  ```
  ananta-platform/
    ├── dev/
    │   ├── terraform.tfstate
    │   └── backups/
    ├── staging/
    │   ├── terraform.tfstate
    │   └── backups/
    └── prod/
        ├── terraform.tfstate
        └── backups/
  ```
- [ ] Set lifecycle policy to keep backups for 90 days

### 3. DynamoDB Lock Table
- [ ] Create DynamoDB table for state locking
- [ ] Table name: `ananta-platform-terraform-locks`
- [ ] Primary key: `LockID` (String)
- [ ] Enable point-in-time recovery

### 4. Infracost Account
- [ ] Sign up at https://www.infracost.io/
- [ ] Generate API key
- [ ] Save API key securely

## GitHub Configuration

### 1. Repository Secrets
Add these secrets in GitHub repository settings → Secrets and variables → Actions:

- [ ] `AWS_ROLE_ARN_DEV`: `arn:aws:iam::{account-id}:role/ananta-platform-github-dev-role`
- [ ] `AWS_ROLE_ARN_STAGING`: `arn:aws:iam::{account-id}:role/ananta-platform-github-staging-role`
- [ ] `AWS_ROLE_ARN_PROD`: `arn:aws:iam::{account-id}:role/ananta-platform-github-prod-role`
- [ ] `TF_STATE_BUCKET`: `your-terraform-state-bucket-name`
- [ ] `TF_LOCK_TABLE`: `ananta-platform-terraform-locks`
- [ ] `INFRACOST_API_KEY`: `ico-xxxxxxxxxxxxxxxxxxxxx`

### 2. GitHub Environments
Create three environments in GitHub repository settings → Environments:

#### Dev Environment
- [ ] Create environment: `dev`
- [ ] Protection rules:
  - [ ] No required reviewers
  - [ ] Allow all branches
- [ ] Environment secrets:
  - [ ] No additional secrets needed (uses repository secrets)

#### Staging Environment
- [ ] Create environment: `staging`
- [ ] Protection rules:
  - [ ] Required reviewers: 1
  - [ ] Allowed branches: `main`
- [ ] Environment secrets:
  - [ ] No additional secrets needed (uses repository secrets)

#### Prod Environment
- [ ] Create environment: `prod`
- [ ] Protection rules:
  - [ ] Required reviewers: 2
  - [ ] Allowed branches: `main` only
  - [ ] Wait timer: 5 minutes (optional)
- [ ] Environment secrets:
  - [ ] No additional secrets needed (uses repository secrets)

### 3. Branch Protection (Optional but Recommended)
- [ ] Enable branch protection for `main`
- [ ] Require pull request reviews: 1
- [ ] Require status checks: `Format Check`, `Validate`, `Security Scan`
- [ ] Require branches to be up to date
- [ ] Dismiss stale reviews on push

## Validation Steps

### 1. Test AWS OIDC Authentication
```bash
# Run this workflow manually to test AWS authentication
gh workflow run terraform.yml -f environment=dev -f action=plan
```
- [ ] Verify workflow completes successfully
- [ ] Check AWS authentication step passes
- [ ] Verify Terraform init connects to S3 backend

### 2. Test Security Scanning
```bash
# Create a test PR with intentional security issue
# Example: Add an S3 bucket without encryption
```
- [ ] Verify tfsec detects the issue
- [ ] Verify Checkov detects the issue
- [ ] Verify PR comment shows security findings
- [ ] Verify soft_fail allows PR scan to pass

### 3. Test Cost Estimation
```bash
# Create a test PR with infrastructure changes
# Example: Add a small EC2 instance
```
- [ ] Verify Infracost runs successfully
- [ ] Verify cost estimate posted to PR comment
- [ ] Verify cost breakdown is visible

### 4. Test Drift Detection
```bash
# Run drift detection manually
gh workflow run terraform-drift.yml -f environment=dev
```
- [ ] Verify drift check completes
- [ ] Make a manual change in AWS console
- [ ] Run drift detection again
- [ ] Verify GitHub issue is created

### 5. Test Module Validation
```bash
# Create a test PR modifying a module
# Or run workflow manually
gh workflow run terraform-module-test.yml
```
- [ ] Verify module validation passes
- [ ] Verify security scanning runs
- [ ] Verify documentation check passes
- [ ] Verify complexity analysis runs

### 6. Test Deployment Flow (Dev)
```bash
# Create test PR with minor change
git checkout -b test/cicd-validation
echo "# Test change" >> README.md
git commit -am "Test: Validate CI/CD pipeline"
git push origin test/cicd-validation
# Create PR
```
- [ ] Verify all checks pass
- [ ] Merge PR
- [ ] Verify auto-deploy to dev triggers
- [ ] Verify state backup is created
- [ ] Check S3 for backup file

### 7. Test Rollback Mechanism
```bash
# This is more advanced - only test in dev
# Create a terraform change that will fail during apply
# Example: Reference a non-existent variable
```
- [ ] Verify apply fails
- [ ] Verify rollback job triggers
- [ ] Verify state is restored
- [ ] Verify rollback completion message

## Team Training

### Required Training Sessions
- [ ] Overview of new CI/CD pipeline (30 min)
- [ ] Walkthrough of deployment workflow (30 min)
- [ ] Security baseline management (20 min)
- [ ] Drift detection response (20 min)
- [ ] Rollback procedures (20 min)
- [ ] Hands-on practice session (60 min)

### Documentation Review
- [ ] Team reviews CICD-GUIDE.md
- [ ] Team understands deployment flow
- [ ] Team knows how to respond to drift
- [ ] Team understands security baseline process

## Go-Live Checklist

### Pre-Production
- [ ] All validation tests passed
- [ ] Team training completed
- [ ] Documentation reviewed
- [ ] Secrets configured correctly
- [ ] Environments set up properly
- [ ] Test deployment to dev successful

### Production Cutover
- [ ] Announce CI/CD pipeline activation
- [ ] Monitor first deployment closely
- [ ] Document any issues
- [ ] Collect team feedback

### Post-Production
- [ ] Monitor drift detection issues
- [ ] Review security scan results
- [ ] Track cost estimation accuracy
- [ ] Schedule 30-day review
- [ ] Optimize based on feedback

## Troubleshooting Common Issues

### Issue: AWS Authentication Fails
**Symptoms:** "Error: Could not assume role"

**Solution:**
1. Verify OIDC provider exists in AWS
2. Check IAM role trust policy includes GitHub
3. Verify role ARN in GitHub secrets is correct
4. Check role has necessary permissions

### Issue: Terraform State Lock Errors
**Symptoms:** "Error acquiring state lock"

**Solution:**
1. Verify DynamoDB table exists
2. Check table name in GitHub secrets
3. Wait for lock timeout (5 minutes)
4. If stuck, force unlock: `terraform force-unlock {lock-id}`

### Issue: Infracost API Key Invalid
**Symptoms:** "Error: Invalid API key"

**Solution:**
1. Verify API key in GitHub secrets
2. Check key hasn't expired
3. Regenerate key from Infracost dashboard
4. Update GitHub secret

### Issue: Security Scan False Positives
**Symptoms:** "Security check failed but finding is not applicable"

**Solution:**
1. Review the security finding
2. Get approval from security team
3. Add check ID to `.tfsec-baseline.json` or `.checkov-baseline.json`
4. Document reason in baseline file
5. Commit baseline update

## Monitoring & Alerts

### Set Up Monitoring For
- [ ] Failed workflow runs (GitHub notifications)
- [ ] Drift detection issues (GitHub issues)
- [ ] Security scan failures (PR comments)
- [ ] Cost increases > 20% (manual review)

### Weekly Reviews
- [ ] Review drift detection issues
- [ ] Review security scan trends
- [ ] Review cost estimation accuracy
- [ ] Review failed deployments

### Monthly Reviews
- [ ] Update security baselines
- [ ] Review and close stale drift issues
- [ ] Optimize workflow performance
- [ ] Update documentation as needed

## Success Metrics

Track these metrics for first 30 days:

- [ ] Deployment frequency (target: 5-10/week)
- [ ] Deployment success rate (target: >85%)
- [ ] Security scan pass rate (target: >95%)
- [ ] Drift detection false positive rate (target: <10%)
- [ ] Mean time to deployment (target: <15 min)
- [ ] Mean time to recovery (target: <1 hour)

## Support

### Internal Support
- Slack: #devops-support
- Email: devops-team@ananta.com
- On-call: PagerDuty rotation

### External Resources
- Terraform: https://www.terraform.io/docs
- GitHub Actions: https://docs.github.com/actions
- Infracost: https://www.infracost.io/docs
- Terratest: https://terratest.gruntwork.io/

## Sign-Off

### Setup Completion
- [ ] DevOps Lead: ___________________ Date: ___________
- [ ] Security Team: ___________________ Date: ___________
- [ ] Engineering Manager: ___________________ Date: ___________

### Go-Live Approval
- [ ] CTO/VP Engineering: ___________________ Date: ___________

---

**Setup Guide Version:** 1.0.0
**Last Updated:** 2025-12-21
**Next Review:** 2026-01-21
