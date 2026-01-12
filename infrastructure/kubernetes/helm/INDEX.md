# Ananta Platform Helm Charts - Complete Index

## Quick Links

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Main documentation and usage guide |
| [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) | Detailed deployment instructions |
| [INSTALLATION-CHECKLIST.md](INSTALLATION-CHECKLIST.md) | Step-by-step installation checklist |
| [HELM-CHARTS-SUMMARY.md](HELM-CHARTS-SUMMARY.md) | Complete summary of all charts |
| [validate-charts.sh](validate-charts.sh) | Chart validation script |
| [quick-install.sh](quick-install.sh) | Quick installation script |

## Directory Structure (15 Charts)

```
helm/
├── Control Plane (5 charts)
│   ├── tenant-management-service/
│   ├── temporal-worker-service/
│   ├── subscription-service/
│   ├── orchestrator-service/
│   └── admin-app/
│
├── App Plane (7 charts)
│   ├── cns-service/
│   ├── cns-dashboard/
│   ├── customer-portal/
│   ├── backstage-portal/
│   ├── audit-logger/
│   ├── middleware-api/
│   └── novu-consumer/
│
└── Infrastructure (3 charts)
    ├── temporal/
    ├── novu/
    └── supabase/
```

## Quick Start

### 1. Prerequisites
```bash
# Install required tools
- kubectl 1.25+
- helm 3.10+
- nginx-ingress-controller
- cert-manager
```

### 2. Create Secrets
```bash
# See INSTALLATION-CHECKLIST.md for complete secret creation guide
kubectl create secret generic tenant-management-secrets \
  --namespace ananta-dev \
  --from-literal=db-user=postgres \
  --from-literal=db-password=<PASSWORD>
```

### 3. Deploy Services
```bash
# Option 1: Use quick install script
./quick-install.sh dev

# Option 2: Manual Helm install
helm install tenant-management-service ./tenant-management-service \
  --namespace ananta-dev \
  --values ./tenant-management-service/values-dev.yaml \
  --set image.tag=v1.0.0

# Option 3: ArgoCD GitOps (recommended)
kubectl apply -k ../../gitops/argocd/applications/
```

## Service Endpoints (Development)

| Service | URL | Port |
|---------|-----|------|
| Tenant Management API | https://api-dev.ananta.local | 14000 |
| Admin App | https://admin-dev.ananta.local | 80 |
| CNS Service | https://cns-dev.ananta.local | 27200 |
| Customer Portal | https://portal-dev.ananta.local | 27100 |
| Temporal UI | https://temporal-dev.ananta.local | 8080 |

## Common Operations

### Deploy Single Service
```bash
helm install <service-name> ./<service-name> \
  --namespace ananta-dev \
  --values ./<service-name>/values-dev.yaml \
  --set image.tag=v1.0.0
```

### Upgrade Service
```bash
helm upgrade <service-name> ./<service-name> \
  --namespace ananta-dev \
  --values ./<service-name>/values-dev.yaml \
  --set image.tag=v1.0.1
```

### Rollback Service
```bash
helm rollback <service-name> 1 --namespace ananta-dev
```

### Check Status
```bash
kubectl get pods -n ananta-dev
kubectl get svc -n ananta-dev
kubectl get ingress -n ananta-dev
```

### View Logs
```bash
kubectl logs -n ananta-dev deployment/<service-name> --tail=100 -f
```

### Port Forward
```bash
kubectl port-forward -n ananta-dev svc/<service-name> <local-port>:<service-port>
```

## Validation

Run validation before deployment:
```bash
./validate-charts.sh
```

## Support

- GitHub: https://github.com/your-org/ananta-platform-saas
- Docs: https://docs.ananta-platform.io
- Slack: #platform-support

## Statistics

- Total Charts: 15
- Total Files: 214+ (YAML, templates, scripts)
- Environments: 3 (dev, staging, prod)
- Services: 15 microservices
- Documentation: 5 comprehensive guides
