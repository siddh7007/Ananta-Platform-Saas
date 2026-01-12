# Infracost Configuration

Cost estimation and policy enforcement for Ananta Platform infrastructure.

## Overview

Infracost provides:
- Cloud cost estimation for Terraform
- Cost diff on pull requests
- Policy-based cost governance
- Usage-based projections

## Structure

```
infracost/
├── infracost.yml           # Main configuration
├── infracost-ci.yml        # CI/CD settings
├── policies/
│   └── cost-policy.rego    # OPA/Rego cost policies
├── usage/
│   ├── dev.yml             # Dev environment usage
│   ├── staging.yml         # Staging usage
│   └── prod.yml            # Production usage
└── README.md               # This file
```

## Quick Start

### Prerequisites

```bash
# Install Infracost
brew install infracost  # macOS
# or
curl -fsSL https://raw.githubusercontent.com/infracost/infracost/master/scripts/install.sh | sh

# Register for API key
infracost auth login
```

### Basic Usage

```bash
cd infrastructure

# Estimate costs for all projects
infracost breakdown --config-file infracost/infracost.yml

# Show cost diff
infracost diff --config-file infracost/infracost.yml

# Generate HTML report
infracost breakdown --config-file infracost/infracost.yml --format html > report.html
```

## Configuration

### infracost.yml

The main configuration file defines projects and usage files:

```yaml
version: 0.1

projects:
  - path: ../terraform/environments/dev
    name: ananta-dev
    usage_file: usage/dev.yml

  - path: ../terraform/environments/staging
    name: ananta-staging
    usage_file: usage/staging.yml

  - path: ../terraform/environments/prod
    name: ananta-prod
    usage_file: usage/prod.yml
```

### Usage Files

Usage files provide estimated resource consumption for accurate cost projections:

```yaml
version: 0.1

resource_usage:
  aws_nat_gateway.main:
    monthly_data_processed_gb: 100

  aws_db_instance.control_plane:
    monthly_standard_io_requests: 2000000

  google_container_cluster.main:
    monthly_egress_data_transfer_gb:
      same_continent: 500
      worldwide: 100
```

## Cost Policies

The `policies/cost-policy.rego` file defines cost governance rules using OPA/Rego.

### Budget Limits

```rego
budget_limits := {
    "dev": 500,
    "staging": 2000,
    "prod": 10000
}
```

### Resource Type Limits

```rego
resource_type_limits := {
    "aws_db_instance": 500,
    "aws_elasticache_replication_group": 200,
    "google_container_cluster": 2000
}
```

### Policy Enforcement

```bash
# Run policy checks
infracost breakdown --config-file infracost/infracost.yml --format json | \
  infracost output --format json | \
  opa eval -d infracost/policies/cost-policy.rego -i - "data.infracost.deny"
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Infracost
on: [pull_request]

jobs:
  infracost:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Infracost
        uses: infracost/actions/setup@v2
        with:
          api-key: ${{ secrets.INFRACOST_API_KEY }}

      - name: Run Infracost
        run: |
          infracost breakdown \
            --config-file infrastructure/infracost/infracost.yml \
            --format json \
            --out-file infracost.json

      - name: Post PR Comment
        uses: infracost/actions/comment@v1
        with:
          path: infracost.json
          behavior: update
```

### GitLab CI

```yaml
infracost:
  image: infracost/infracost:ci-latest
  script:
    - infracost breakdown --config-file infrastructure/infracost/infracost.yml
  only:
    - merge_requests
```

## Reports

### Terminal Output

```bash
infracost breakdown --config-file infracost/infracost.yml
```

### JSON Output

```bash
infracost breakdown --config-file infracost/infracost.yml --format json > costs.json
```

### HTML Report

```bash
infracost breakdown --config-file infracost/infracost.yml --format html > report.html
```

### Slack Notification

```bash
infracost breakdown --config-file infracost/infracost.yml --format slack-message | \
  curl -X POST -H 'Content-type: application/json' \
    --data @- \
    $SLACK_WEBHOOK_URL
```

## Cost Breakdown by Environment

### Development (~$500/month)
- Single NAT Gateway
- Small RDS instances
- Minimal ElastiCache
- Single-zone deployments

### Staging (~$2,000/month)
- Multi-AZ database
- Medium ElastiCache
- Standard compute
- Increased storage

### Production (~$10,000/month)
- Multi-region deployments
- Large RDS with replicas
- Premium ElastiCache
- High-availability compute
- Enterprise support

## Best Practices

1. **Update usage files** with real metrics monthly
2. **Review cost diffs** on every pull request
3. **Set alerts** for budget thresholds
4. **Use reserved instances** for predictable workloads
5. **Right-size resources** based on actual usage

## Troubleshooting

### API key issues
```bash
infracost auth login
```

### Module not found
```bash
cd infrastructure/terraform/environments/dev
terraform init
```

### Usage file syntax
```bash
# Validate YAML
infracost breakdown --usage-file infracost/usage/dev.yml --path ../terraform/modules/network
```

## Related

- [Terraform Tests](../terraform/test/README.md)
- [GitOps](../gitops/README.md)
- [Infracost Docs](https://www.infracost.io/docs/)
