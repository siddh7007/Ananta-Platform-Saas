# Multi-Cloud Deployment Guide

## Overview

ARC-SaaS is designed to be **cloud-agnostic**, supporting deployment to:
- **AWS** (EKS, RDS, ElastiCache, Secrets Manager)
- **GCP** (GKE, Cloud SQL, Memorystore, Secret Manager)
- **Oracle Cloud** (OKE, OCI Database, OCI Cache, OCI Vault)
- **Vanilla Kubernetes** (any K8s cluster with external databases)

This guide explains the architecture decisions and how to deploy to any provider.

---

## Architecture Principles

### 1. No Hardcoded Cloud IDs
All cloud-specific identifiers are injected via:
- Terraform variables
- Helm values files
- Environment variables
- Kubernetes Secrets

**Never commit:**
- AWS ARNs (`arn:aws:...`)
- GCP Project IDs (`projects/my-project/...`)
- Oracle OCIDs (`ocid1.compartment...`)

### 2. Provider-Neutral Secrets Strategy
Secrets are managed via the External Secrets Operator pattern:

```yaml
# All services reference secrets by name, not value
secrets:
  database:
    existingSecret: "arc-saas-database-credentials"
    keys:
      host: DB_HOST
      password: DB_PASSWORD
```

The secret store (AWS Secrets Manager, GCP Secret Manager, Vault, etc.) is configured at the cluster level, not in application code.

### 3. Environment-Specific Configuration
Three values files control deployment:
- `values.dev.yaml` - Development (minimal resources, Kubernetes secrets)
- `values.staging.yaml` - Staging (HA, external secrets, ingress)
- `values.prod.yaml` - Production (full HA, security hardening)

---

## Quick Start

### Prerequisites
1. Kubernetes cluster (any provider)
2. External Secrets Operator installed
3. Helm 3.x
4. Terraform 1.5+

### Deploy to Development
```bash
# 1. Create secrets in Kubernetes
kubectl create secret generic arc-saas-database-credentials \
  --from-literal=DB_HOST=postgres \
  --from-literal=DB_PORT=5432 \
  --from-literal=DB_USER=postgres \
  --from-literal=DB_PASSWORD=your-password \
  --from-literal=DB_DATABASE=arc_saas

# 2. Deploy with Helm
helm upgrade --install arc-saas ./infrastructure/helm/charts/tenant-management-service \
  -f ./infrastructure/helm/values/values.dev.yaml \
  --namespace arc-saas \
  --create-namespace
```

---

## Provider-Specific Setup

### AWS (EKS)

#### 1. Infrastructure Setup
```bash
cd infrastructure/terraform/environments/prod

terraform init
terraform plan -var="cloud_provider=aws" -var="aws_region=us-east-1"
terraform apply
```

#### 2. Configure Secret Store
```yaml
# ClusterSecretStore for AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: arc-saas-secret-store
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      role: arn:aws:iam::ACCOUNT:role/external-secrets-role
```

#### 3. Create Secrets in AWS
```bash
aws secretsmanager create-secret \
  --name arc-saas/database \
  --secret-string '{"host":"rds-endpoint","port":"5432","username":"admin","password":"xxx","database":"arc_saas"}'
```

#### 4. Deploy
```bash
helm upgrade --install arc-saas ./infrastructure/helm/charts/tenant-management-service \
  -f ./infrastructure/helm/values/values.prod.yaml \
  --set global.cloudProvider=aws \
  --namespace arc-saas
```

---

### GCP (GKE)

#### 1. Infrastructure Setup
```bash
cd infrastructure/terraform/environments/prod

terraform init
terraform plan -var="cloud_provider=gcp" -var="gcp_project=my-project" -var="gcp_region=us-central1"
terraform apply
```

#### 2. Configure Secret Store
```yaml
# ClusterSecretStore for GCP Secret Manager
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: arc-saas-secret-store
spec:
  provider:
    gcpsm:
      projectID: my-project
      auth:
        workloadIdentity:
          clusterLocation: us-central1
          clusterName: arc-saas-prod
          serviceAccountRef:
            name: external-secrets-sa
```

#### 3. Create Secrets in GCP
```bash
echo -n '{"host":"cloudsql-ip","port":"5432","username":"admin","password":"xxx","database":"arc_saas"}' | \
  gcloud secrets create arc-saas-database --data-file=-
```

#### 4. Deploy
```bash
helm upgrade --install arc-saas ./infrastructure/helm/charts/tenant-management-service \
  -f ./infrastructure/helm/values/values.prod.yaml \
  --set global.cloudProvider=gcp \
  --namespace arc-saas
```

---

### Oracle Cloud (OKE)

#### 1. Infrastructure Setup
```bash
cd infrastructure/terraform/environments/prod

terraform init
terraform plan -var="cloud_provider=oracle" -var="oracle_region=us-phoenix-1"
terraform apply
```

#### 2. Configure Secret Store
```yaml
# ClusterSecretStore for OCI Vault
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: arc-saas-secret-store
spec:
  provider:
    oracle:
      vault: ocid1.vault.oc1...
      region: us-phoenix-1
      principalType: InstancePrincipal
```

#### 3. Create Secrets in OCI Vault
```bash
oci vault secret create-base64 \
  --compartment-id ocid1.compartment... \
  --secret-name arc-saas-database \
  --vault-id ocid1.vault... \
  --key-id ocid1.key... \
  --secret-content-content "$(echo '{"host":"db-ip","port":"5432",...}' | base64)"
```

#### 4. Deploy
```bash
helm upgrade --install arc-saas ./infrastructure/helm/charts/tenant-management-service \
  -f ./infrastructure/helm/values/values.prod.yaml \
  --set global.cloudProvider=oracle \
  --namespace arc-saas
```

---

### HashiCorp Vault (Any Provider)

#### 1. Configure Secret Store
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: arc-saas-secret-store
spec:
  provider:
    vault:
      server: https://vault.example.com:8200
      path: secret
      version: v2
      auth:
        kubernetes:
          mountPath: kubernetes
          role: arc-saas-prod
```

#### 2. Create Secrets in Vault
```bash
vault kv put secret/arc-saas/database \
  host=db.example.com \
  port=5432 \
  username=admin \
  password=xxx \
  database=arc_saas
```

---

## CI/CD Integration

### GitHub Actions

The deployment workflow supports all providers:

```yaml
# Trigger deployment
gh workflow run deploy.yml \
  -f environment=prod \
  -f cloud_provider=aws \
  -f version=v1.0.0
```

### Required Secrets by Provider

| Provider | Required Secrets |
|----------|-----------------|
| AWS | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| GCP | `GCP_SA_KEY` (service account JSON) |
| Oracle | `OCI_USER_OCID`, `OCI_FINGERPRINT`, `OCI_TENANCY_OCID`, `OCI_PRIVATE_KEY` |
| Kubernetes | `KUBECONFIG` (base64 encoded) |

### Required Variables by Provider

| Provider | Required Variables |
|----------|-------------------|
| AWS | `AWS_REGION`, `CONTAINER_REGISTRY` |
| GCP | `GCP_REGION`, `GCP_PROJECT` |
| Oracle | `OCI_REGION`, `OCI_TENANCY` |
| Kubernetes | `CONTAINER_REGISTRY` |

---

## Managed Services Mapping

| Service | AWS | GCP | Oracle | Kubernetes |
|---------|-----|-----|--------|------------|
| Kubernetes | EKS | GKE | OKE | Any K8s |
| PostgreSQL | RDS | Cloud SQL | OCI Database | Self-hosted/Crunchy |
| Redis | ElastiCache | Memorystore | OCI Cache | Self-hosted |
| Secrets | Secrets Manager | Secret Manager | OCI Vault | Vault/K8s Secrets |
| Storage | S3 | Cloud Storage | Object Storage | MinIO |
| Identity | Cognito | Cloud Identity | OCI IAM | Keycloak |

---

## Switching Providers

To migrate from one provider to another:

1. **Export data** from current databases
2. **Update Terraform variables** to new provider
3. **Run Terraform** to create new infrastructure
4. **Migrate secrets** to new secret store
5. **Import data** to new databases
6. **Update DNS** to point to new endpoints
7. **Deploy application** with new provider settings

---

## Troubleshooting

### Secrets Not Syncing
```bash
# Check ExternalSecret status
kubectl get externalsecret -n arc-saas

# Check events
kubectl describe externalsecret arc-saas-database -n arc-saas

# Verify SecretStore connection
kubectl get clustersecretstore arc-saas-secret-store -o yaml
```

### Pod Can't Access Database
```bash
# Check secret exists
kubectl get secret arc-saas-database-credentials -n arc-saas -o yaml

# Verify env vars in pod
kubectl exec -it <pod> -n arc-saas -- env | grep DB_

# Test connectivity
kubectl exec -it <pod> -n arc-saas -- nc -zv $DB_HOST $DB_PORT
```

### Helm Deployment Fails
```bash
# Check Helm release status
helm list -n arc-saas

# View release history
helm history arc-saas -n arc-saas

# Debug template rendering
helm template arc-saas ./infrastructure/helm/charts/tenant-management-service \
  -f ./infrastructure/helm/values/values.dev.yaml \
  --debug
```

---

## Security Considerations

### Production Checklist

- [ ] External Secrets Operator installed
- [ ] ClusterSecretStore configured
- [ ] Network policies enabled
- [ ] Pod security standards enforced
- [ ] TLS certificates configured
- [ ] Ingress rate limiting enabled
- [ ] RBAC properly configured
- [ ] Audit logging enabled
- [ ] Backup strategy implemented
- [ ] Monitoring and alerting configured

### Never in Production

- Kubernetes Secrets as primary secret store (use External Secrets)
- Default passwords
- Self-signed certificates for external traffic
- `latest` image tags
- Single replica deployments
- Disabled health probes
