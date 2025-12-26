# ARC SaaS Temporal Worker Service

Temporal-based workflow orchestration service for tenant provisioning, deprovisioning, and deployment operations.

## Overview

This service replaces the event-based orchestrator with Temporal workflows, providing:

- **Durable Execution**: Workflows survive process restarts and failures
- **Automatic Retries**: Configurable retry policies with exponential backoff
- **Saga Compensation**: Automatic rollback on failure
- **Visibility**: Real-time workflow status via Temporal UI
- **Scalability**: Horizontal scaling of workers

## Architecture

```
┌─────────────────────────┐
│ Tenant Mgmt Service     │
│                         │
│ TemporalProvisioning    │──────► Temporal Client
│ Service                 │        (start workflow)
└─────────────────────────┘
                                    │
                                    ▼
                          ┌─────────────────────┐
                          │   Temporal Server   │
                          │   (Docker/Cloud)    │
                          └─────────┬───────────┘
                                    │
                                    ▼
                          ┌─────────────────────────────────┐
                          │     Temporal Worker Service     │
                          │                                 │
                          │  Workflows:                     │
                          │  ├─ provisionTenantWorkflow     │
                          │  └─ deprovisionTenantWorkflow   │
                          │                                 │
                          │  Activities:                    │
                          │  ├─ IdP (Auth0/Keycloak)        │
                          │  ├─ Infrastructure (Terraform)  │
                          │  ├─ Deployment (ECS)            │
                          │  ├─ Tenant (DB updates)         │
                          │  └─ Notifications (SES)         │
                          └─────────────────────────────────┘
```

## Quick Start

### 1. Start Temporal Server (Development)

```bash
# From arc-saas root directory
docker-compose -f docker-compose.temporal.yml up -d
```

Access Temporal UI at: http://localhost:8080

### 2. Create Namespace

```bash
docker exec -it temporal-admin-tools temporal operator namespace create arc-saas
```

### 3. Configure Environment

```bash
cd services/temporal-worker-service
cp .env.example .env
# Edit .env with your configuration
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Build & Run Worker

```bash
npm run build
npm start
```

## Workflows

### Provision Tenant Workflow

Orchestrates complete tenant provisioning:

1. Update tenant status to PROVISIONING
2. Create IdP organization (Auth0/Keycloak)
3. Provision infrastructure (Terraform)
4. Deploy application (ECS)
5. Configure DNS
6. Create resource records
7. Update tenant to ACTIVE
8. Send welcome notification

**Saga Compensation**: On failure, automatically rolls back:
- Deployment
- Infrastructure
- IdP organization
- Updates tenant to PROVISION_FAILED

### Deprovision Tenant Workflow

Orchestrates tenant removal:

1. Update tenant status to DEPROVISIONING
2. Notify users (optional)
3. Wait for grace period (optional)
4. Backup data (optional)
5. Remove application
6. Destroy infrastructure
7. Delete IdP organization
8. Clean up resources
9. Update tenant to DEPROVISIONED

## Activities

### IdP Activities
- `createIdPOrganization` - Create Auth0 org or Keycloak realm
- `deleteIdPOrganization` - Remove IdP organization

### Infrastructure Activities
- `provisionInfrastructure` - Run Terraform apply
- `destroyInfrastructure` - Run Terraform destroy

### Deployment Activities
- `deployApplication` - Deploy to ECS
- `rollbackDeployment` - Rollback deployment
- `removeDeployment` - Remove deployment
- `configureDns` - Configure Route53 records

### Tenant Activities
- `updateTenantStatus` - Update tenant in database
- `createResources` - Create resource records
- `deleteResources` - Delete resource records
- `getTenantDetails` - Fetch tenant information
- `backupTenantData` - Create data backup

### Notification Activities
- `sendWelcomeEmail` - Send welcome email
- `sendProvisioningFailedEmail` - Send failure notification
- `sendDeprovisioningNotification` - Send deprovisioning notice

## Configuration

### Temporal Server

| Variable | Description | Default |
|----------|-------------|---------|
| `TEMPORAL_ADDRESS` | Temporal server address | `localhost:7233` |
| `TEMPORAL_NAMESPACE` | Temporal namespace | `arc-saas` |
| `TEMPORAL_TASK_QUEUE` | Task queue name | `tenant-provisioning` |

### Worker Options

| Variable | Description | Default |
|----------|-------------|---------|
| `TEMPORAL_WORKER_MAX_CONCURRENT_ACTIVITIES` | Max concurrent activities | `10` |
| `TEMPORAL_WORKER_MAX_CONCURRENT_WORKFLOWS` | Max concurrent workflows | `50` |

### IdP Configuration

| Variable | Description |
|----------|-------------|
| `AUTH0_ENABLED` | Enable Auth0 provider |
| `AUTH0_DOMAIN` | Auth0 domain |
| `AUTH0_CLIENT_ID` | Auth0 client ID |
| `AUTH0_CLIENT_SECRET` | Auth0 client secret |
| `KEYCLOAK_ENABLED` | Enable Keycloak provider |
| `KEYCLOAK_URL` | Keycloak server URL |
| `KEYCLOAK_REALM` | Keycloak admin realm |

### Terraform Configuration

| Variable | Description |
|----------|-------------|
| `TERRAFORM_ENABLED` | Enable Terraform |
| `TF_CLOUD_ENABLED` | Use Terraform Cloud |
| `TF_CLOUD_TOKEN` | Terraform Cloud API token |
| `TF_CLOUD_ORG` | Terraform Cloud organization |

## Development

### Run Tests

```bash
npm test
```

### Watch Mode

```bash
npm run dev
```

### Lint

```bash
npm run lint
npm run lint:fix
```

## Docker

### Build Image

```bash
docker build -t arc-saas-temporal-worker .
```

### Run Container

```bash
docker run -d \
  --name temporal-worker \
  --network arc-saas-temporal \
  -e TEMPORAL_ADDRESS=temporal:7233 \
  -e TEMPORAL_NAMESPACE=arc-saas \
  arc-saas-temporal-worker
```

## Production Considerations

### Temporal Cloud

For production, consider using [Temporal Cloud](https://temporal.io/cloud):

```env
TEMPORAL_CLOUD_ENABLED=true
TEMPORAL_CLOUD_NAMESPACE=your-namespace.a]
TEMPORAL_CLOUD_API_KEY=your-api-key
```

### Scaling

- Workers can be horizontally scaled
- Each worker can handle multiple concurrent workflows and activities
- Use Kubernetes for auto-scaling based on queue depth

### Monitoring

- Temporal UI provides workflow visibility
- Integrate with OpenTelemetry for distributed tracing
- Export metrics to Prometheus/Grafana

## License

MIT
