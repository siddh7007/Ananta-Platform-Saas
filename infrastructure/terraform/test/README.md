# Terraform Module Tests

This directory contains Terratest-based infrastructure tests for all Terraform modules.

## Overview

The test suite validates:
- Module syntax and configuration
- Plan-only validation (no real resources)
- Integration tests (with actual cloud resources)
- Cross-cloud compatibility

## Test Structure

```
test/
├── go.mod                    # Go module definition
├── go.sum                    # Dependency checksums
├── test_helpers.go           # Common utilities
├── network_test.go           # Network module tests
├── database_test.go          # Database module tests
├── compute_test.go           # Compute module tests
├── cache_secrets_test.go     # Cache and secrets tests
└── README.md                 # This file
```

## Prerequisites

- Go 1.21+
- Terraform 1.5+
- Cloud credentials configured:
  - AWS: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
  - GCP: `GOOGLE_APPLICATION_CREDENTIALS`, `GCP_PROJECT_ID`
  - Azure: `ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`, `ARM_TENANT_ID`

## Running Tests

### Quick Start

```bash
cd infrastructure/terraform/test

# Install dependencies
go mod download

# Run all tests (plan-only, no real resources)
go test -v -timeout 30m

# Run specific test
go test -v -run TestAWSNetworkModulePlanOnly

# Run with real resources (requires cleanup)
go test -v -timeout 60m -tags=integration
```

### Environment Variables

```bash
# Required for all tests
export TF_VAR_name_prefix="test"

# AWS tests
export AWS_DEFAULT_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="xxx"
export AWS_SECRET_ACCESS_KEY="xxx"

# GCP tests
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"

# Azure tests
export ARM_SUBSCRIPTION_ID="xxx"
export ARM_CLIENT_ID="xxx"
export ARM_CLIENT_SECRET="xxx"
export ARM_TENANT_ID="xxx"
```

## Test Categories

### Plan-Only Tests
These tests only run `terraform plan` - no real resources are created.

```bash
go test -v -run "PlanOnly"
```

### Integration Tests
These create real cloud resources and require cleanup.

```bash
# Run with explicit tag
go test -v -tags=integration -run "Integration"

# Clean up on failure
terraform destroy -auto-approve
```

### Cloud-Specific Tests

```bash
# AWS only
go test -v -run "AWS"

# GCP only
go test -v -run "GCP"

# Azure only
go test -v -run "Azure"

# Kubernetes only
go test -v -run "Kubernetes"
```

## Test Functions

### test_helpers.go

| Function | Description |
|----------|-------------|
| `NewTestConfig(t)` | Creates test configuration with unique ID |
| `GetModulePath(root, name)` | Resolves module path |
| `CreateAWSNetworkOptions(t, config, path, vars)` | Creates AWS network test options |
| `CreateGCPNetworkOptions(t, config, path, vars)` | Creates GCP network test options |
| `CreateDatabaseOptions(t, config, provider, path, vars)` | Creates database test options |
| `CreateComputeOptions(t, config, provider, path, vars)` | Creates compute test options |
| `CreateCacheOptions(t, config, provider, path, vars)` | Creates cache test options |
| `CreateSecretsOptions(t, config, provider, path, vars)` | Creates secrets test options |
| `ValidateOutputNotEmpty(t, options, outputName)` | Validates output is not empty |

### Example Test

```go
func TestAWSNetworkModulePlanOnly(t *testing.T) {
    t.Parallel()

    config := NewTestConfig(t)
    modulePath := GetModulePath(config.ModulesRootDir, "network/aws")

    vars := map[string]interface{}{
        "name_prefix":        fmt.Sprintf("%s-%s", TestPrefix, config.UniqueID),
        "vpc_cidr":          "10.0.0.0/16",
        "availability_zones": []string{"us-east-1a", "us-east-1b"},
        // ... more variables
    }

    options := CreateAWSNetworkOptions(t, config, modulePath, vars)

    terraform.Init(t, options)
    planOutput := terraform.Plan(t, options)

    assert.Contains(t, planOutput, "aws_vpc.main")
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Terraform Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      - uses: hashicorp/setup-terraform@v3

      - name: Run Tests
        run: |
          cd infrastructure/terraform/test
          go test -v -timeout 30m
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          GCP_PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
```

## Best Practices

1. **Always use `t.Parallel()`** for independent tests
2. **Use unique prefixes** to avoid naming conflicts
3. **Clean up resources** even on test failure
4. **Skip tests** when credentials are missing
5. **Use plan-only** for quick validation
6. **Tag integration tests** separately

## Troubleshooting

### Tests timeout
```bash
# Increase timeout
go test -v -timeout 60m
```

### Credential issues
```bash
# Verify credentials
aws sts get-caller-identity
gcloud auth list
az account show
```

### Module not found
```bash
# Verify module path
ls -la ../modules/network/aws
```

### Cleanup failed resources
```bash
# List resources with test prefix
aws ec2 describe-vpcs --filters "Name=tag:Name,Values=ananta-test-*"

# Manual cleanup
terraform destroy -auto-approve
```

## Related

- [Terraform Modules](../modules/README.md)
- [Infracost](../../infracost/README.md)
- [GitOps](../../gitops/README.md)
