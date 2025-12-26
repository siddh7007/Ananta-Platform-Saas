# Cloud-Agnostic Infrastructure Architecture

## Overview

The Ananta Platform infrastructure is designed to be **cloud-platform agnostic**, supporting deployment across:
- **AWS** (Amazon Web Services)
- **Azure** (Microsoft Azure)
- **GCP** (Google Cloud Platform)
- **Kubernetes** (Self-managed or any managed K8s)

## Architecture Principles

### 1. Provider Abstraction Pattern

Each infrastructure component has a **unified interface** with **provider-specific implementations**:

```
modules/
├── database/
│   ├── interface.tf      # Common variables & outputs
│   ├── aws/              # AWS RDS implementation
│   ├── azure/            # Azure Database for PostgreSQL
│   ├── gcp/              # Cloud SQL implementation
│   └── kubernetes/       # CloudNativePG/Zalando operator
├── cache/
│   ├── interface.tf
│   ├── aws/              # ElastiCache Redis
│   ├── azure/            # Azure Cache for Redis
│   ├── gcp/              # Memorystore
│   └── kubernetes/       # Redis Operator
└── ...
```

### 2. Service Mapping

| Component | AWS | Azure | GCP | Kubernetes |
|-----------|-----|-------|-----|------------|
| **Compute** | ECS Fargate | AKS | GKE Autopilot | Any K8s |
| **Database** | RDS PostgreSQL | Azure Database | Cloud SQL | CloudNativePG |
| **Cache** | ElastiCache | Azure Cache | Memorystore | Redis Operator |
| **Storage** | S3 | Blob Storage | GCS | MinIO/Rook-Ceph |
| **Secrets** | Secrets Manager | Key Vault | Secret Manager | External Secrets |
| **Message Queue** | Amazon MQ | Service Bus | Pub/Sub | RabbitMQ Operator |
| **Container Registry** | ECR | ACR | Artifact Registry | Harbor |
| **DNS/Discovery** | Cloud Map | Private DNS | Cloud DNS | CoreDNS |
| **Load Balancer** | ALB | App Gateway | Cloud Load Balancer | Ingress-NGINX |
| **Monitoring** | CloudWatch | Monitor | Cloud Monitoring | Prometheus Stack |
| **Logging** | CloudWatch Logs | Log Analytics | Cloud Logging | Loki |
| **Tracing** | X-Ray | App Insights | Cloud Trace | Jaeger |

## Module Structure

### Provider Selection

```hcl
# variables.tf (root)
variable "cloud_provider" {
  description = "Target cloud provider"
  type        = string
  validation {
    condition     = contains(["aws", "azure", "gcp", "kubernetes"], var.cloud_provider)
    error_message = "Must be one of: aws, azure, gcp, kubernetes"
  }
}
```

### Unified Interface Example (Database)

```hcl
# modules/database/main.tf
module "database" {
  source = "./${var.cloud_provider}"

  # Common interface
  name_prefix         = var.name_prefix
  environment         = var.environment
  engine_version      = var.engine_version
  instance_size       = var.instance_size  # Normalized sizes: small, medium, large
  storage_gb          = var.storage_gb
  high_availability   = var.high_availability
  backup_retention    = var.backup_retention

  # Provider-specific config passed through
  provider_config     = var.provider_config
}

# Unified outputs
output "endpoint" {
  value = module.database.endpoint
}

output "port" {
  value = module.database.port
}

output "connection_string" {
  value     = module.database.connection_string
  sensitive = true
}
```

## Instance Size Normalization

Abstract cloud-specific instance types into normalized sizes:

| Normalized | AWS | Azure | GCP |
|------------|-----|-------|-----|
| `micro` | db.t3.micro | B1ms | db-f1-micro |
| `small` | db.t3.small | B2s | db-g1-small |
| `medium` | db.r6g.medium | GP_Gen5_2 | db-custom-2-4096 |
| `large` | db.r6g.large | GP_Gen5_4 | db-custom-4-8192 |
| `xlarge` | db.r6g.xlarge | GP_Gen5_8 | db-custom-8-16384 |

## Kubernetes-First Approach

For maximum portability, deploy stateful services on Kubernetes using operators:

### Recommended Operators

| Service | Operator | Helm Chart |
|---------|----------|------------|
| PostgreSQL | CloudNativePG | `cnpg/cloudnative-pg` |
| Redis | Spotahome Redis Operator | `spotahome/redis-operator` |
| RabbitMQ | RabbitMQ Cluster Operator | `bitnami/rabbitmq-cluster-operator` |
| Secrets | External Secrets Operator | `external-secrets/external-secrets` |
| Monitoring | Prometheus Operator | `prometheus-community/kube-prometheus-stack` |
| Logging | Loki Stack | `grafana/loki-stack` |
| Tracing | Jaeger Operator | `jaegertracing/jaeger-operator` |

### Helm Values Structure

```yaml
# values-common.yaml (shared across all clouds)
postgresql:
  enabled: true
  replicas: 2
  storage: 50Gi

redis:
  enabled: true
  replicas: 3

# values-aws.yaml (AWS-specific overrides)
postgresql:
  storageClass: gp3

# values-azure.yaml
postgresql:
  storageClass: managed-premium

# values-gcp.yaml
postgresql:
  storageClass: pd-ssd
```

## Environment Configuration

### AWS Example
```hcl
# environments/aws-prod.tfvars
cloud_provider = "aws"
aws_region     = "us-east-1"

provider_config = {
  vpc_cidr = "10.0.0.0/16"

  database = {
    instance_class    = "db.r6g.large"
    multi_az          = true
    storage_encrypted = true
  }

  cache = {
    node_type = "cache.r6g.large"
    num_nodes = 3
  }
}
```

### Azure Example
```hcl
# environments/azure-prod.tfvars
cloud_provider = "azure"
azure_region   = "eastus"

provider_config = {
  resource_group = "ananta-prod-rg"

  database = {
    sku_name = "GP_Gen5_4"
    geo_redundant_backup = true
  }

  cache = {
    sku_name = "Premium"
    capacity = 1
  }
}
```

### GCP Example
```hcl
# environments/gcp-prod.tfvars
cloud_provider = "gcp"
gcp_region     = "us-central1"
gcp_project    = "ananta-prod-123456"

provider_config = {
  database = {
    tier = "db-custom-4-8192"
    availability_type = "REGIONAL"
  }

  cache = {
    tier = "STANDARD_HA"
    memory_size_gb = 5
  }
}
```

### Kubernetes Example
```hcl
# environments/k8s-prod.tfvars
cloud_provider = "kubernetes"

provider_config = {
  kubeconfig_path = "~/.kube/config"
  namespace       = "ananta-prod"

  database = {
    storage_class = "fast-ssd"
    replicas      = 3
  }

  cache = {
    storage_class = "fast-ssd"
    replicas      = 3
  }
}
```

## Migration Path

### Phase 1: Abstraction Layer (Current)
- Create unified interfaces for all modules
- Implement AWS-specific modules (existing)
- Add provider selection logic

### Phase 2: Azure Support
- Implement Azure provider modules
- Test parity with AWS deployment
- Document Azure-specific considerations

### Phase 3: GCP Support
- Implement GCP provider modules
- Test parity with AWS/Azure
- Document GCP-specific considerations

### Phase 4: Kubernetes-Native
- Implement Kubernetes operator-based modules
- Support any conformant K8s cluster
- Maximum portability achieved

## Testing Multi-Cloud

```bash
# Validate all providers
for provider in aws azure gcp kubernetes; do
  terraform validate -var="cloud_provider=$provider"
done

# Plan for specific provider
terraform plan \
  -var-file="environments/${PROVIDER}-${ENV}.tfvars" \
  -out="${PROVIDER}-${ENV}.tfplan"
```

## Cost Comparison (Estimated Monthly - Production)

| Component | AWS | Azure | GCP | K8s (Self-Managed) |
|-----------|-----|-------|-----|---------------------|
| Database (HA) | $400 | $350 | $320 | $200 |
| Cache (3 nodes) | $300 | $280 | $250 | $150 |
| Compute (3 services) | $200 | $180 | $160 | $300 |
| Storage (100GB) | $25 | $22 | $20 | $15 |
| Networking | $100 | $90 | $80 | $50 |
| Monitoring | $50 | $40 | $30 | $0 (self-hosted) |
| **Total** | **$1,075** | **$962** | **$860** | **$715** |

## Decision Matrix

| Factor | AWS | Azure | GCP | K8s |
|--------|-----|-------|-----|-----|
| Ease of Setup | High | Medium | Medium | Low |
| Operational Overhead | Low | Low | Low | High |
| Cost | $$$$ | $$$ | $$ | $ |
| Portability | Low | Low | Low | High |
| Vendor Lock-in | High | High | High | None |
| Enterprise Support | Excellent | Excellent | Good | Varies |

## Recommendations

1. **Start with AWS** - Current implementation, mature ecosystem
2. **Add Azure next** - Large enterprise demand, good PostgreSQL support
3. **Add GCP** - Cost-effective, strong Kubernetes integration
4. **Kubernetes-native last** - Maximum flexibility, highest complexity

## Files Structure

```
infrastructure/terraform/
├── main.tf                    # Root module with provider selection
├── variables.tf               # Common variables including cloud_provider
├── outputs.tf                 # Unified outputs
├── providers.tf               # Multi-provider configuration
├── environments/
│   ├── aws-dev.tfvars
│   ├── aws-staging.tfvars
│   ├── aws-prod.tfvars
│   ├── azure-dev.tfvars
│   ├── azure-prod.tfvars
│   ├── gcp-dev.tfvars
│   ├── gcp-prod.tfvars
│   └── k8s-prod.tfvars
└── modules/
    ├── database/
    │   ├── main.tf            # Provider selector
    │   ├── variables.tf       # Unified interface
    │   ├── outputs.tf         # Unified outputs
    │   ├── aws/
    │   ├── azure/
    │   ├── gcp/
    │   └── kubernetes/
    ├── cache/
    │   └── ... (same structure)
    ├── storage/
    │   └── ... (same structure)
    ├── compute/
    │   └── ... (same structure)
    └── ...
```
