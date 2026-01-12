# ArgoCD Module - Testing Guide

## Prerequisites

### Required Tools

```bash
# Terraform
terraform version  # >= 1.0

# Kubernetes CLI
kubectl version --client

# ArgoCD CLI (optional but recommended)
argocd version --client

# Helm (for manual testing)
helm version
```

### Kubernetes Cluster

Test with one of:
- kind (Kubernetes in Docker)
- minikube
- k3s/k3d
- Cloud cluster (GKE, EKS, AKS)

## Quick Start Testing

### 1. Setup Test Environment

```bash
# Create kind cluster
cat <<EOF | kind create cluster --name argocd-test --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  extraPortMappings:
  - containerPort: 30080
    hostPort: 8080
    protocol: TCP
EOF

# Verify cluster
kubectl cluster-info
```

### 2. Create Test Configuration

Create `test/main.tf`:

```hcl
provider "kubernetes" {
  config_path = "~/.kube/config"
}

provider "helm" {
  kubernetes {
    config_path = "~/.kube/config"
  }
}

module "argocd" {
  source = "../"

  namespace      = "argocd"
  argocd_version = "5.51.6"

  # Service configuration for testing
  service_type = "NodePort"

  # Git repository (replace with your test repo)
  git_repo_url = "https://github.com/argoproj/argocd-example-apps"

  # Simple test environment
  environments = [
    {
      name      = "test"
      namespace = "argocd-test"
      repo_path = "guestbook"
    }
  ]

  # Automated sync for testing
  sync_policy_automated = true
  sync_policy_prune     = true
  sync_policy_self_heal = true
}

output "admin_password" {
  value     = module.argocd.argocd_initial_admin_password
  sensitive = true
}

output "server_url" {
  value = module.argocd.argocd_server_url
}
```

### 3. Run Terraform

```bash
cd test

# Initialize
terraform init

# Plan
terraform plan

# Apply
terraform apply -auto-approve

# Get admin password
terraform output -raw admin_password
```

### 4. Access ArgoCD

```bash
# Port-forward to ArgoCD server
kubectl port-forward svc/argocd-server -n argocd 8080:443 &

# Get admin password
ADMIN_PASSWORD=$(terraform output -raw admin_password)

# Login via CLI
argocd login localhost:8080 \
  --username admin \
  --password "$ADMIN_PASSWORD" \
  --insecure

# Or open browser
open https://localhost:8080
# Username: admin
# Password: <from terraform output>
```

### 5. Verify Deployment

```bash
# Check ArgoCD pods
kubectl get pods -n argocd

# Expected output:
# argocd-application-controller-0
# argocd-applicationset-controller-*
# argocd-dex-server-* (if enabled)
# argocd-notifications-controller-* (if enabled)
# argocd-redis-*
# argocd-repo-server-*
# argocd-server-*

# Check ArgoCD Project
kubectl get appproject -n argocd

# Check ApplicationSet
kubectl get applicationset -n argocd

# Check generated Applications
kubectl get applications -n argocd
```

### 6. Test Application Sync

```bash
# List applications
argocd app list

# Get application details
argocd app get ananta-platform-test

# Check sync status
argocd app get ananta-platform-test --show-operation

# Manual sync (if not auto-synced)
argocd app sync ananta-platform-test

# Watch sync progress
argocd app wait ananta-platform-test
```

### 7. Verify Application Deployment

```bash
# Check namespace created by ApplicationSet
kubectl get ns argocd-test

# Check resources deployed by ArgoCD
kubectl get all -n argocd-test

# Check application health
argocd app get ananta-platform-test --refresh
```

## Test Scenarios

### Test 1: Basic Deployment (ClusterIP)

**Objective**: Verify minimal installation

```hcl
module "argocd_basic" {
  source = "../"

  namespace    = "argocd-basic"
  service_type = "ClusterIP"
  git_repo_url = "https://github.com/argoproj/argocd-example-apps"

  create_project        = false
  create_applicationset = false
}
```

**Validation**:
```bash
kubectl get pods -n argocd-basic
kubectl get svc argocd-server -n argocd-basic
```

### Test 2: High Availability Mode

**Objective**: Verify HA deployment with multiple replicas

```hcl
module "argocd_ha" {
  source = "../"

  namespace  = "argocd-ha"
  ha_enabled = true
  git_repo_url = "https://github.com/argoproj/argocd-example-apps"
}
```

**Validation**:
```bash
# Verify replica counts
kubectl get deployment argocd-server -n argocd-ha -o jsonpath='{.spec.replicas}'  # Should be 3
kubectl get statefulset argocd-application-controller -n argocd-ha -o jsonpath='{.spec.replicas}'  # Should be 3

# Check Redis HA
kubectl get pods -n argocd-ha | grep redis
```

### Test 3: Multi-Environment ApplicationSet

**Objective**: Verify ApplicationSet generates multiple applications

```hcl
module "argocd_multi_env" {
  source = "../"

  namespace    = "argocd-multi"
  git_repo_url = "https://github.com/argoproj/argocd-example-apps"

  environments = [
    {
      name      = "dev"
      namespace = "app-dev"
      repo_path = "guestbook"
    },
    {
      name      = "staging"
      namespace = "app-staging"
      repo_path = "guestbook"
    },
    {
      name      = "prod"
      namespace = "app-prod"
      repo_path = "guestbook"
    }
  ]
}
```

**Validation**:
```bash
# Check generated applications
argocd app list | grep ananta-platform

# Should see:
# ananta-platform-dev
# ananta-platform-staging
# ananta-platform-prod

# Verify each application
argocd app get ananta-platform-dev
argocd app get ananta-platform-staging
argocd app get ananta-platform-prod
```

### Test 4: HTTPS Git Authentication

**Objective**: Verify Git credentials work

```hcl
module "argocd_https" {
  source = "../"

  namespace    = "argocd-https"
  git_repo_url = "https://github.com/your-private-org/private-repo"
  git_username = var.git_username
  git_password = var.git_token
}
```

**Validation**:
```bash
# Check repository secret created
kubectl get secret -n argocd-https | grep repo-creds

# Verify repository connection in ArgoCD
argocd repo list
```

### Test 5: SSH Git Authentication

**Objective**: Verify SSH key authentication

```hcl
module "argocd_ssh" {
  source = "../"

  namespace           = "argocd-ssh"
  git_repo_url        = "git@github.com:your-org/private-repo.git"
  git_ssh_private_key = file("~/.ssh/argocd_deploy_key")
}
```

**Validation**:
```bash
# Check SSH secret created
kubectl get secret -n argocd-ssh | grep repo-creds

# Verify repository connection
argocd repo list
```

### Test 6: Ingress Configuration

**Objective**: Verify Ingress setup

```hcl
module "argocd_ingress" {
  source = "../"

  namespace      = "argocd-ingress"
  create_ingress = true
  ingress_host   = "argocd.test.local"
  git_repo_url   = "https://github.com/argoproj/argocd-example-apps"
}
```

**Validation**:
```bash
# Check Ingress created
kubectl get ingress -n argocd-ingress

# Test DNS (add to /etc/hosts first)
echo "127.0.0.1 argocd.test.local" | sudo tee -a /etc/hosts
curl -k https://argocd.test.local
```

### Test 7: Sync Policy Testing

**Objective**: Verify automated sync, prune, and self-heal

```hcl
module "argocd_sync" {
  source = "../"

  namespace    = "argocd-sync"
  git_repo_url = "https://github.com/argoproj/argocd-example-apps"

  sync_policy_automated = true
  sync_policy_prune     = true
  sync_policy_self_heal = true

  environments = [
    {
      name      = "test"
      namespace = "sync-test"
      repo_path = "guestbook"
    }
  ]
}
```

**Test Steps**:
```bash
# 1. Initial sync (should happen automatically)
kubectl get all -n sync-test

# 2. Test self-heal: manually change a resource
kubectl scale deployment guestbook-ui -n sync-test --replicas=5

# 3. Watch ArgoCD revert the change (within reconciliation period)
watch kubectl get deployment guestbook-ui -n sync-test

# 4. Verify replica count reverted to Git value
```

## Validation Checklist

### Deployment Validation

- [ ] All ArgoCD pods are running
- [ ] No pods in CrashLoopBackOff
- [ ] Services created successfully
- [ ] Secrets created (admin, repo credentials)
- [ ] ConfigMaps created

### ArgoCD Project Validation

- [ ] AppProject CR created
- [ ] Source repos configured
- [ ] Destinations configured
- [ ] Resource whitelists applied

### ApplicationSet Validation

- [ ] ApplicationSet CR created
- [ ] Application CRs generated for each environment
- [ ] Applications show correct source/destination
- [ ] Applications sync successfully

### Sync Policy Validation

- [ ] Automated sync working
- [ ] Prune removes deleted resources
- [ ] Self-heal reverts manual changes
- [ ] Sync retry on failures

### Security Validation

- [ ] Admin password set/generated
- [ ] Git credentials stored securely
- [ ] RBAC policies applied
- [ ] TLS enabled (if configured)

## Performance Testing

### Load Test ApplicationSet

```bash
# Create many environments
environments = [
  for i in range(50) : {
    name      = "env-${i}"
    namespace = "app-${i}"
    repo_path = "guestbook"
  }
]

# Monitor controller performance
kubectl top pods -n argocd
kubectl logs -f deploy/argocd-application-controller -n argocd
```

### Monitor Reconciliation Time

```bash
# Check ArgoCD metrics
kubectl port-forward svc/argocd-metrics -n argocd 8082:8082 &

# Query Prometheus metrics
curl http://localhost:8082/metrics | grep argocd_app_reconcile
```

## Troubleshooting Tests

### Test: CRD Not Ready

```bash
# Simulate CRD delay
terraform apply  # May fail on first try

# Solution: Wait and retry
sleep 30
terraform apply  # Should succeed
```

### Test: Git Authentication Failure

```bash
# Check ArgoCD logs
kubectl logs -f deploy/argocd-repo-server -n argocd

# Look for:
# "authentication failed"
# "permission denied"
```

### Test: Sync Failure

```bash
# Get application details
argocd app get <app-name> --show-operation

# Check logs
argocd app logs <app-name>

# Manual sync with debug
argocd app sync <app-name> --prune --dry-run
```

## Cleanup

```bash
# Destroy Terraform resources
terraform destroy -auto-approve

# Or manually delete namespace
kubectl delete namespace argocd

# Delete kind cluster (if used)
kind delete cluster --name argocd-test

# Remove hosts entry
sudo sed -i '' '/argocd.test.local/d' /etc/hosts
```

## Continuous Testing

### GitHub Actions Workflow

```yaml
name: ArgoCD Module Test

on:
  pull_request:
    paths:
      - 'infrastructure/terraform/modules/argocd/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2

      - name: Setup kind
        uses: helm/kind-action@v1.5.0

      - name: Terraform Init
        run: |
          cd infrastructure/terraform/modules/argocd/kubernetes/test
          terraform init

      - name: Terraform Validate
        run: terraform validate

      - name: Terraform Plan
        run: terraform plan

      - name: Terraform Apply
        run: terraform apply -auto-approve

      - name: Wait for ArgoCD
        run: |
          kubectl wait --for=condition=ready pod \
            -l app.kubernetes.io/name=argocd-server \
            -n argocd --timeout=300s

      - name: Run Tests
        run: |
          kubectl get pods -n argocd
          kubectl get applications -n argocd

      - name: Cleanup
        if: always()
        run: terraform destroy -auto-approve
```

## Test Results Documentation

Record test results in:

```
tests/
├── results/
│   ├── basic-test.log
│   ├── ha-test.log
│   ├── multi-env-test.log
│   └── ingress-test.log
└── reports/
    └── test-summary.md
```

## References

- [ArgoCD Testing Guide](https://argo-cd.readthedocs.io/en/stable/developer-guide/test-e2e/)
- [Terraform Testing](https://www.terraform.io/docs/language/modules/testing-experiment.html)
- [kind Quick Start](https://kind.sigs.k8s.io/docs/user/quick-start/)
