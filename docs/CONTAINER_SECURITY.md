# Container Security Pipeline

Comprehensive guide to the Ananta Platform's container image security scanning and management infrastructure.

## Table of Contents

1. [Overview](#overview)
2. [Security Scanning Tools](#security-scanning-tools)
3. [GitHub Actions Workflow](#github-actions-workflow)
4. [ECR Infrastructure](#ecr-infrastructure)
5. [Security Best Practices](#security-best-practices)
6. [Vulnerability Management](#vulnerability-management)
7. [Compliance and Reporting](#compliance-and-reporting)
8. [Troubleshooting](#troubleshooting)

## Overview

The Ananta Platform implements a **defense-in-depth** security strategy for container images:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Container Security Pipeline                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. BUILD TIME                                                    │
│     ├─ Hadolint (Dockerfile linting)                             │
│     ├─ Docker Buildx (secure multi-stage builds)                 │
│     └─ Build argument validation                                 │
│                                                                   │
│  2. PRE-PUSH SCANNING                                            │
│     ├─ Trivy (OS packages + libraries)                           │
│     ├─ Grype (vulnerabilities + exploits)                        │
│     └─ SBOM generation (Syft)                                    │
│                                                                   │
│  3. POST-PUSH SCANNING                                           │
│     ├─ AWS ECR Image Scanning                                    │
│     ├─ CloudWatch vulnerability alarms                           │
│     └─ SNS notifications                                         │
│                                                                   │
│  4. RUNTIME PROTECTION                                           │
│     ├─ ECR encryption (KMS)                                      │
│     ├─ Immutable tags (production)                               │
│     └─ Cross-account access controls                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Security Scanning Tools

### 1. Hadolint - Dockerfile Linting

**Purpose**: Enforce Dockerfile best practices and prevent common misconfigurations.

**What it checks**:
- Base image security (avoid `latest` tags)
- Layer optimization (combine RUN commands)
- Secret leakage prevention
- User permissions (avoid running as root)
- Package manager cleanup
- Metadata requirements

**Example violations**:
```dockerfile
# BAD - Will fail Hadolint
FROM node:latest
RUN apt-get update
RUN apt-get install -y curl
USER root

# GOOD - Passes Hadolint
FROM node:20.10.0-alpine
RUN apk add --no-cache curl && \
    rm -rf /var/cache/apk/*
USER node
```

**Configuration**: See `.hadolint.yaml` (optional) or inline ignores:
```dockerfile
# hadolint ignore=DL3008
RUN apt-get install -y some-package
```

### 2. Trivy - Comprehensive Vulnerability Scanner

**Purpose**: Detect vulnerabilities in OS packages, application dependencies, and configuration files.

**Scan coverage**:
- OS packages (Alpine, Debian, Ubuntu, etc.)
- Language-specific libraries (npm, pip, gem, etc.)
- IaC misconfigurations (Dockerfile, Kubernetes)
- Secrets detection (API keys, passwords)

**Severity levels**:
- `CRITICAL` - Immediate action required (e.g., remote code execution)
- `HIGH` - Urgent fix needed (e.g., privilege escalation)
- `MEDIUM` - Should be addressed (e.g., information disclosure)
- `LOW` - Low risk (e.g., minor issues)

**Example output**:
```
Library: lodash
Vulnerability: CVE-2021-23337
Severity: HIGH
Installed Version: 4.17.15
Fixed Version: 4.17.21
Description: Command injection in lodash template
```

### 3. Grype - Exploit-Focused Scanner

**Purpose**: Identify known exploits and actively exploited vulnerabilities.

**Key features**:
- Exploit database integration
- CVSS scoring
- Known exploit detection
- Remediation guidance

**Comparison to Trivy**:
| Feature | Trivy | Grype |
|---------|-------|-------|
| Speed | Fast | Very Fast |
| Coverage | Broad | Deep (exploits) |
| Accuracy | High | Very High |
| Database | Multiple sources | Anchore feeds |

**Why use both?** Defense in depth - different tools may catch different vulnerabilities.

### 4. Syft - SBOM Generation

**Purpose**: Generate Software Bill of Materials (SBOM) for compliance and supply chain security.

**Output formats**:
- SPDX (JSON, TagValue)
- CycloneDX
- Syft native format

**SBOM use cases**:
- License compliance audits
- Supply chain risk assessment
- Vulnerability tracking over time
- Incident response (what's affected?)

**Example SBOM entry**:
```json
{
  "name": "express",
  "version": "4.18.2",
  "type": "npm",
  "foundBy": "javascript-package-cataloger",
  "licenses": ["MIT"],
  "cpe": "cpe:2.3:a:expressjs:express:4.18.2:*:*:*:*:*:*:*"
}
```

### 5. AWS ECR Image Scanning

**Purpose**: Native AWS scanning integrated with ECR lifecycle.

**Scanning engine**: Amazon Inspector (powered by Clair)

**Integration benefits**:
- Automatic re-scanning on new CVE publications
- CloudWatch metrics and alarms
- AWS Security Hub integration
- Automated compliance reporting

**How it works**:
1. Image pushed to ECR
2. Scan triggered automatically (`scan_on_push = true`)
3. Results available via AWS Console/API
4. CloudWatch alarm triggers if critical CVEs found
5. SNS notification sent to security team

## GitHub Actions Workflow

### Workflow Triggers

```yaml
on:
  push:
    branches: [main, master]
    paths:
      - 'arc-saas/services/**'
      - 'arc-saas/apps/**'
      - 'app-plane/services/**'
      - '**/Dockerfile'
  pull_request:
    # Same paths as push
  workflow_dispatch:
    # Manual trigger with environment selection
```

### Job Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    detect-changes                             │
│  Detects which services have Dockerfile changes               │
│  Outputs: List of changed services                            │
└──────────────────┬───────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌───────────────────┐  ┌───────────────────┐
│ build-control-    │  │ build-app-plane   │
│ plane             │  │                   │
├───────────────────┤  ├───────────────────┤
│ For each service: │  │ For each service: │
│ 1. Build image    │  │ 1. Build image    │
│ 2. Hadolint       │  │ 2. Hadolint       │
│ 3. Trivy scan     │  │ 3. Trivy scan     │
│ 4. Grype scan     │  │ 4. Grype scan     │
│ 5. Generate SBOM  │  │ 5. Generate SBOM  │
│ 6. Push to ECR    │  │ 6. Push to ECR    │
└──────────┬────────┘  └────────┬──────────┘
           │                    │
           └─────────┬──────────┘
                     ▼
         ┌───────────────────────┐
         │ security-summary      │
         │ Aggregate results     │
         │ Comment on PR         │
         └───────────────────────┘
```

### Parallel Execution

The workflow uses GitHub Actions' matrix strategy to scan services in parallel:

```yaml
strategy:
  fail-fast: false
  matrix:
    service:
      - tenant-management-service
      - temporal-worker-service
      - admin-app
      # ... up to 14 services total
```

**Build time**: ~5-10 minutes (parallel) vs. ~60 minutes (sequential)

### Caching Strategy

Docker layer caching via GitHub Actions cache:

```yaml
cache-from: type=gha,scope=${{ matrix.service }}
cache-to: type=gha,mode=max,scope=${{ matrix.service }}
```

**Cache benefits**:
- Faster builds (skip unchanged layers)
- Reduced CI costs
- Faster feedback on PRs

### Scan Result Handling

#### Pull Request Flow
- Scans run on every PR
- Results uploaded to GitHub Security tab
- Comment posted to PR with summary
- **PR not blocked** on vulnerabilities (warning only)

#### Main Branch Flow
- All scans must pass
- Images pushed to ECR only if scans succeed
- ECR's native scan runs automatically
- Critical CVEs trigger CloudWatch alarms

### Secret Management

GitHub Actions uses OIDC (OpenID Connect) to authenticate with AWS - **no long-lived credentials**:

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN_DEV }}
    aws-region: us-east-1
```

**Required GitHub Secrets**:
- `AWS_ROLE_ARN_DEV` - Development environment ECR push role
- `AWS_ROLE_ARN_STAGING` - Staging environment ECR push role
- `AWS_ROLE_ARN_PROD` - Production environment ECR push role

## ECR Infrastructure

### Repository Naming Convention

```
ananta-{plane}-{service-name}

Examples:
- ananta-control-plane-tenant-management-service
- ananta-control-plane-admin-app
- ananta-app-plane-cns-service
- ananta-app-plane-customer-portal-app
```

### Image Tagging Strategy

| Tag | Description | Use Case |
|-----|-------------|----------|
| `{git-sha}` | Commit SHA (e.g., `abc123f`) | Immutable reference to exact build |
| `latest` | Latest build from main branch | Development/testing |
| `{branch}` | Branch name (e.g., `main`) | Environment tracking |
| `v{version}` | Semantic version (e.g., `v1.2.3`) | Production releases |
| `{env}` | Environment (e.g., `prod`) | Promoted images |

**Best practice**: Always deploy using SHA tags in production, use `latest` only for local dev.

### Lifecycle Policies

Automatic cleanup to reduce storage costs:

```
Priority 1: Keep 30 production images (v*, prod-*)
Priority 2: Keep 10 dev/staging images (dev-*, staging-*)
Priority 3: Remove untagged images after 7 days
Priority 4: Cap total images at 100
```

**Cost savings example**:
- Without policies: 200 images × 500MB = 100GB = $10/month
- With policies: 40 images × 500MB = 20GB = $2/month
- **Savings**: $8/month per repository × 15 repos = **$120/month**

### Encryption

All images encrypted at rest using AWS KMS:

```hcl
encryption_configuration {
  encryption_type = "KMS"
  kms_key         = aws_kms_key.ecr.arn
}
```

**Key rotation**: Enabled automatically (365 days)

### Cross-Account Access

For multi-account setups (dev/staging/prod isolation):

```hcl
allow_pull_accounts = [
  "arn:aws:iam::111111111111:root",  # Dev account
  "arn:aws:iam::222222222222:root",  # Staging account
]
```

### Replication (Disaster Recovery)

Production repositories replicate to `us-west-2`:

```hcl
enable_replication = true
replication_region = "us-west-2"
```

**RPO (Recovery Point Objective)**: ~5 minutes (async replication)

## Security Best Practices

### 1. Base Image Selection

**Prefer Alpine Linux** for smaller attack surface:

```dockerfile
# Good - Alpine (5MB base)
FROM node:20-alpine

# Acceptable - Debian slim (50MB base)
FROM node:20-slim

# Avoid - Full Debian (200MB base)
FROM node:20
```

**Pin specific versions**:
```dockerfile
# Bad
FROM node:latest

# Good
FROM node:20.10.0-alpine3.18
```

### 2. Multi-Stage Builds

Reduce final image size and attack surface:

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Runtime stage (smaller, fewer vulnerabilities)
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
USER node
CMD ["node", "server.js"]
```

### 3. Non-Root User

**Never run containers as root**:

```dockerfile
# Create non-root user
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser

# Switch to non-root
USER appuser

# Verify
RUN whoami  # Should output: appuser
```

### 4. Minimize Layers

Combine RUN commands to reduce layers:

```dockerfile
# Bad - 3 layers
RUN apk add curl
RUN apk add jq
RUN apk add git

# Good - 1 layer
RUN apk add --no-cache curl jq git
```

### 5. Secret Management

**NEVER include secrets in images**:

```dockerfile
# BAD - Secret in image
ENV DATABASE_PASSWORD=supersecret

# GOOD - Secret at runtime
# (Use AWS Secrets Manager, SSM Parameter Store, or env vars)
```

### 6. Health Checks

Include health checks in Dockerfile:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1
```

### 7. Metadata Labels

Include OCI-compliant labels:

```dockerfile
LABEL org.opencontainers.image.title="Tenant Management Service"
LABEL org.opencontainers.image.description="Multi-tenant management API"
LABEL org.opencontainers.image.version="1.2.3"
LABEL org.opencontainers.image.vendor="Ananta Platform"
LABEL org.opencontainers.image.source="https://github.com/your-org/ananta-platform-saas"
```

## Vulnerability Management

### Severity Classification

| Severity | CVSS Score | Response Time | Action Required |
|----------|------------|---------------|-----------------|
| CRITICAL | 9.0 - 10.0 | 24 hours | Immediate patch or mitigation |
| HIGH | 7.0 - 8.9 | 7 days | Scheduled patch |
| MEDIUM | 4.0 - 6.9 | 30 days | Planned upgrade |
| LOW | 0.1 - 3.9 | 90 days | Opportunistic fix |

### Vulnerability Response Workflow

```
1. CVE DETECTED (CloudWatch Alarm)
   ↓
2. TRIAGE (Security team reviews)
   ↓
3. ASSESS IMPACT (Is it exploitable? Affected services?)
   ↓
4. PRIORITIZE (Based on severity + exploitability)
   ↓
5. REMEDIATE
   ├─ Patch available → Update dependency
   ├─ No patch → Implement workaround/mitigation
   └─ False positive → Add to ignore list
   ↓
6. VERIFY (Re-scan image)
   ↓
7. DEPLOY (Updated image to production)
   ↓
8. DOCUMENT (Update security log)
```

### Exception Management

For false positives or accepted risks:

**Trivy ignore file** (`.trivyignore`):
```
# False positive - not actually vulnerable in our use case
CVE-2021-12345

# Accepted risk - no patch available, mitigated by network policies
CVE-2022-67890
```

**Grype ignore** (inline):
```yaml
# .grype.yaml
ignore:
  - vulnerability: CVE-2021-12345
    reason: "False positive - fixed in our Alpine version"
```

### Continuous Monitoring

ECR automatically re-scans images when new CVEs are published:

```
Image pushed: 2024-01-15
Initial scan: PASSED (0 critical, 2 high)
              ↓
New CVE published: 2024-01-20 (CVE-2024-12345 - CRITICAL)
              ↓
ECR re-scans image automatically
              ↓
New scan result: FAILED (1 critical, 2 high)
              ↓
CloudWatch alarm triggered
              ↓
SNS notification → DevOps team
```

## Compliance and Reporting

### SBOM Storage

All SBOMs stored as GitHub Artifacts:

```bash
# Download SBOM from GitHub Actions
gh run download 1234567890 -n sbom-control-tenant-management-service

# View SBOM
cat sbom-tenant-management-service.spdx.json | jq '.packages[] | select(.name=="express")'
```

**Retention**: 90 days (configurable)

### Compliance Reports

Generate compliance reports from SBOM:

```bash
# License compliance check
syft packages sbom.spdx.json -o json | \
  jq '.artifacts[] | .licenses[]' | \
  sort -u

# Find GPL-licensed packages
syft packages sbom.spdx.json -o json | \
  jq '.artifacts[] | select(.licenses[] | contains("GPL"))'
```

### Audit Trail

All scan results uploaded to GitHub Security tab (Code Scanning Alerts):

1. Navigate to repository
2. Click "Security" tab
3. Click "Code scanning alerts"
4. Filter by tool: Trivy, Grype, Hadolint

### AWS Security Hub Integration

ECR scan findings automatically sent to AWS Security Hub:

```bash
# View findings via AWS CLI
aws securityhub get-findings \
  --filters 'ProductName=[{Value=Inspector,Comparison=EQUALS}]' \
  --query 'Findings[?Severity.Label==`CRITICAL`]'
```

## Troubleshooting

### Scan Failures

#### Hadolint fails with DL3008

**Error**:
```
DL3008 Pin versions in apt get install
```

**Fix**:
```dockerfile
# Before
RUN apt-get install -y curl

# After
RUN apt-get install -y curl=7.64.0-4+deb10u2
```

#### Trivy timeout

**Error**:
```
Error: failed to scan image: timeout
```

**Fix**: Increase timeout in workflow:
```yaml
- name: Run Trivy
  uses: aquasecurity/trivy-action@master
  with:
    timeout: '15m'  # Default is 5m
```

#### Grype database update failure

**Error**:
```
Error: failed to update vulnerability database
```

**Fix**: Use cached database:
```yaml
- name: Cache Grype DB
  uses: actions/cache@v4
  with:
    path: ~/.cache/grype
    key: grype-db-${{ github.run_id }}
```

### ECR Push Failures

#### Permission denied

**Error**:
```
denied: User not authorized to perform ecr:PutImage
```

**Fix**: Verify IAM role has ECR push permissions:
```bash
aws iam get-role-policy \
  --role-name github-actions-ecr-push \
  --policy-name ecr-push-policy
```

#### Image scan limit exceeded

**Error**:
```
LimitExceededException: Image scan limit reached
```

**Fix**: ECR has quotas (1000 scans/day per repository). Contact AWS Support to increase.

### Common Issues

#### Build cache not working

**Symptom**: Builds are slow despite caching being enabled

**Fix**: Check cache scope matches:
```yaml
cache-from: type=gha,scope=my-service
cache-to: type=gha,scope=my-service  # Must match!
```

#### SBOM generation fails for multi-stage builds

**Symptom**: Syft doesn't detect dependencies

**Fix**: Scan final stage explicitly:
```bash
syft <image>:latest --platform linux/amd64
```

## Additional Resources

- [Trivy Documentation](https://aquasecurity.github.io/trivy/)
- [Grype Documentation](https://github.com/anchore/grype)
- [Hadolint Rules](https://github.com/hadolint/hadolint)
- [AWS ECR Best Practices](https://docs.aws.amazon.com/AmazonECR/latest/userguide/best-practices.html)
- [SPDX Specification](https://spdx.dev/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [OWASP Container Security](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)

## Quick Reference

### Scan an image locally

```bash
# Trivy
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image my-image:latest

# Grype
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  anchore/grype:latest my-image:latest

# Syft (SBOM)
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  anchore/syft:latest my-image:latest -o spdx-json
```

### ECR CLI commands

```bash
# Login
aws ecr get-login-password | docker login --username AWS --password-stdin <registry-url>

# List repositories
aws ecr describe-repositories

# View scan results
aws ecr describe-image-scan-findings \
  --repository-name ananta-control-plane-tenant-management-service \
  --image-id imageTag=latest
```

### Generate SBOM from running container

```bash
# Export SBOM
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  anchore/syft:latest <container-id> -o spdx-json > sbom.json

# Validate SBOM
docker run --rm -v $(pwd):/sbom \
  spdx/spdx-tools-java validator /sbom/sbom.json
```
