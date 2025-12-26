# Temporal Integration Plan for ARC SaaS

> **Status: IMPLEMENTED** ✅
>
> The Temporal integration has been implemented. See `services/temporal-worker-service/` for the complete implementation.

## Overview

Replace the current message-bus-based orchestrator with Temporal for reliable, durable workflow execution with built-in state management, retries, and saga compensation.

---

## Current Architecture

```
Tenant Mgmt Service                    Orchestrator Service
       │                                      │
       │ publish(TENANT_PROVISIONING)         │
       └──────► EventBridge/SQS ──────────────┼──► @consumer handler
                                              │         │
                                              │    BuilderService.startJob()
                                              │         │
                                              │    External CI/CD (Jenkins/CodeBuild)
                                              │         │
       ◄──────────────────────────────────────┼─────────┘
       POST /webhook (callback)               │
```

**Problems:**
- No built-in state management
- No automatic retries with backoff
- No saga/compensation on failure
- No workflow visibility
- BuilderService is a stub (must implement manually)

---

## Proposed Architecture with Temporal

```
┌─────────────────────────┐
│ Tenant Mgmt Service     │
│                         │
│ ProvisioningService     │──────► Temporal Client
│                         │        (start workflow)
└─────────────────────────┘
                                    │
                                    ▼
                          ┌─────────────────────┐
                          │   Temporal Server   │
                          │   (Cloud or Self)   │
                          └─────────┬───────────┘
                                    │
                                    ▼
                          ┌─────────────────────────────────┐
                          │     Temporal Worker Service     │
                          │  (NEW - replaces orchestrator)  │
                          │                                 │
                          │  Workflows:                     │
                          │  ├─ provisionTenantWorkflow     │
                          │  ├─ deprovisionTenantWorkflow   │
                          │  └─ deployTenantWorkflow        │
                          │                                 │
                          │  Activities:                    │
                          │  ├─ createIdPOrganization       │
                          │  ├─ provisionInfrastructure     │
                          │  ├─ deployApplication           │
                          │  ├─ updateTenantStatus          │
                          │  ├─ sendNotificationEmail       │
                          │  ├─ createResources             │
                          │  └─ rollback* (compensation)    │
                          └─────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Create Temporal Worker Service

**New service:** `services/temporal-worker-service/`

```
temporal-worker-service/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts                    # Worker entry point
│   ├── client.ts                   # Temporal client factory
│   ├── worker.ts                   # Worker configuration
│   ├── workflows/
│   │   ├── index.ts
│   │   ├── provision-tenant.workflow.ts
│   │   ├── deprovision-tenant.workflow.ts
│   │   └── deploy-tenant.workflow.ts
│   ├── activities/
│   │   ├── index.ts
│   │   ├── idp.activities.ts       # Auth0/Keycloak operations
│   │   ├── infrastructure.activities.ts  # Terraform/Pulumi
│   │   ├── deployment.activities.ts      # App deployment
│   │   ├── tenant.activities.ts    # Tenant status updates
│   │   ├── notification.activities.ts    # Email sending
│   │   └── resource.activities.ts  # Resource creation
│   ├── types/
│   │   ├── index.ts
│   │   ├── workflow-input.types.ts
│   │   └── activity-result.types.ts
│   └── config/
│       └── temporal.config.ts
└── Dockerfile
```

### Phase 2: Define Workflow Types & Inputs

**File:** `src/types/workflow-input.types.ts`

```typescript
export interface TenantProvisioningInput {
  tenantId: string;
  tenantKey: string;
  tenantName: string;
  domains: string[];
  contacts: Contact[];
  subscription: {
    id: string;
    planId: string;
    tier: 'silo' | 'pooled' | 'bridge';
    startDate: string;
    endDate: string;
  };
  idpConfig?: {
    provider: 'auth0' | 'keycloak';
    // provider-specific config
  };
}

export interface ProvisioningResult {
  success: boolean;
  tenantId: string;
  appPlaneUrl?: string;
  resources?: ResourceData[];
  idpOrganizationId?: string;
  error?: string;
}
```

### Phase 3: Implement Workflows

**File:** `src/workflows/provision-tenant.workflow.ts`

```typescript
import {
  proxyActivities,
  sleep,
  ApplicationFailure,
  defineSignal,
  defineQuery,
  setHandler
} from '@temporalio/workflow';
import type * as activities from '../activities';
import { TenantProvisioningInput, ProvisioningResult } from '../types';

// Activity proxies with retry configuration
const idpActivities = proxyActivities<typeof activities.idp>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '10s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
    nonRetryableErrorTypes: ['InvalidCredentialsError'],
  },
});

const infraActivities = proxyActivities<typeof activities.infrastructure>({
  startToCloseTimeout: '30 minutes',  // Infrastructure can take time
  heartbeatTimeout: '2 minutes',
  retry: {
    initialInterval: '30s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

const deployActivities = proxyActivities<typeof activities.deployment>({
  startToCloseTimeout: '15 minutes',
  heartbeatTimeout: '1 minute',
  retry: {
    initialInterval: '15s',
    backoffCoefficient: 2,
    maximumAttempts: 5,
  },
});

const tenantActivities = proxyActivities<typeof activities.tenant>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 5 },
});

const notificationActivities = proxyActivities<typeof activities.notification>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 3 },
});

// Signals for external events
export const provisioningCancelledSignal = defineSignal('provisioningCancelled');

// Queries for status
export const getProvisioningStatusQuery = defineQuery<ProvisioningStatus>('getStatus');

interface ProvisioningStatus {
  step: string;
  progress: number;
  details?: string;
}

export async function provisionTenantWorkflow(
  input: TenantProvisioningInput
): Promise<ProvisioningResult> {
  let status: ProvisioningStatus = { step: 'initializing', progress: 0 };
  let cancelled = false;

  // Compensation tracking
  let idpCreated = false;
  let infraProvisioned = false;
  let appDeployed = false;

  // Set up signal and query handlers
  setHandler(provisioningCancelledSignal, () => { cancelled = true; });
  setHandler(getProvisioningStatusQuery, () => status);

  try {
    // Step 1: Update tenant status to PROVISIONING
    status = { step: 'updating_status', progress: 5 };
    await tenantActivities.updateTenantStatus(input.tenantId, 'PROVISIONING');

    if (cancelled) throw ApplicationFailure.nonRetryable('Provisioning cancelled');

    // Step 2: Create IdP Organization (if configured)
    let idpResult = null;
    if (input.idpConfig) {
      status = { step: 'creating_idp_organization', progress: 15 };
      idpResult = await idpActivities.createIdPOrganization({
        tenantId: input.tenantId,
        tenantName: input.tenantName,
        provider: input.idpConfig.provider,
        domains: input.domains,
        adminContact: input.contacts[0],
      });
      idpCreated = true;
    }

    if (cancelled) throw ApplicationFailure.nonRetryable('Provisioning cancelled');

    // Step 3: Provision Infrastructure based on tier
    status = { step: 'provisioning_infrastructure', progress: 30 };
    const infraResult = await infraActivities.provisionInfrastructure({
      tenantId: input.tenantId,
      tenantKey: input.tenantKey,
      tier: input.subscription.tier,
      idpOrganizationId: idpResult?.organizationId,
    });
    infraProvisioned = true;

    if (cancelled) throw ApplicationFailure.nonRetryable('Provisioning cancelled');

    // Step 4: Deploy Application
    status = { step: 'deploying_application', progress: 60 };
    const deployResult = await deployActivities.deployApplication({
      tenantId: input.tenantId,
      tenantKey: input.tenantKey,
      tier: input.subscription.tier,
      infrastructureOutputs: infraResult.outputs,
    });
    appDeployed = true;

    // Step 5: Create resource records
    status = { step: 'creating_resources', progress: 80 };
    await tenantActivities.createResources(input.tenantId, {
      infrastructure: infraResult.resources,
      deployment: deployResult.resources,
    });

    // Step 6: Update tenant to ACTIVE
    status = { step: 'activating_tenant', progress: 90 };
    await tenantActivities.updateTenantStatus(input.tenantId, 'ACTIVE');

    // Step 7: Send welcome notification
    status = { step: 'sending_notification', progress: 95 };
    await notificationActivities.sendWelcomeEmail({
      tenantId: input.tenantId,
      contacts: input.contacts,
      appPlaneUrl: deployResult.appPlaneUrl,
    });

    status = { step: 'completed', progress: 100 };

    return {
      success: true,
      tenantId: input.tenantId,
      appPlaneUrl: deployResult.appPlaneUrl,
      resources: [...infraResult.resources, ...deployResult.resources],
      idpOrganizationId: idpResult?.organizationId,
    };

  } catch (error) {
    // SAGA COMPENSATION - Rollback in reverse order
    status = { step: 'compensation', progress: 0, details: 'Rolling back...' };

    if (appDeployed) {
      try {
        await deployActivities.rollbackDeployment(input.tenantId);
      } catch (rollbackError) {
        // Log but continue compensation
      }
    }

    if (infraProvisioned) {
      try {
        await infraActivities.rollbackInfrastructure(input.tenantId);
      } catch (rollbackError) {
        // Log but continue compensation
      }
    }

    if (idpCreated) {
      try {
        await idpActivities.rollbackIdPOrganization(input.tenantId);
      } catch (rollbackError) {
        // Log but continue compensation
      }
    }

    // Update tenant status to FAILED
    await tenantActivities.updateTenantStatus(input.tenantId, 'PROVISIONFAILED');

    // Notify about failure
    await notificationActivities.sendProvisioningFailedEmail({
      tenantId: input.tenantId,
      contacts: input.contacts,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      tenantId: input.tenantId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

### Phase 4: Implement Activities

**File:** `src/activities/infrastructure.activities.ts`

```typescript
import { Context } from '@temporalio/activity';

export interface ProvisionInfraInput {
  tenantId: string;
  tenantKey: string;
  tier: 'silo' | 'pooled' | 'bridge';
  idpOrganizationId?: string;
}

export interface InfraResult {
  outputs: Record<string, string>;
  resources: ResourceData[];
}

export async function provisionInfrastructure(
  input: ProvisionInfraInput
): Promise<InfraResult> {
  const ctx = Context.current();

  // Heartbeat to show progress (for long-running operations)
  const heartbeat = setInterval(() => {
    ctx.heartbeat('provisioning in progress');
  }, 30000);

  try {
    // Implementation depends on your IaC tool:
    // - Terraform via Terraform Cloud API
    // - Pulumi via Pulumi Automation API
    // - AWS CDK via CodeBuild
    // - Direct AWS SDK calls

    // Example: Trigger Terraform Cloud run
    const tfResponse = await triggerTerraformRun({
      workspaceId: getWorkspaceForTier(input.tier),
      variables: {
        tenant_id: input.tenantId,
        tenant_key: input.tenantKey,
        idp_org_id: input.idpOrganizationId,
      },
    });

    // Poll for completion (with heartbeats)
    const result = await waitForTerraformCompletion(tfResponse.runId, ctx);

    return {
      outputs: result.outputs,
      resources: result.resources,
    };
  } finally {
    clearInterval(heartbeat);
  }
}

export async function rollbackInfrastructure(tenantId: string): Promise<void> {
  // Trigger Terraform destroy or cleanup
  await triggerTerraformDestroy(tenantId);
}
```

**File:** `src/activities/idp.activities.ts`

```typescript
import { Auth0ManagementClient } from 'auth0';
import KeycloakAdminClient from '@keycloak/keycloak-admin-client';

export interface CreateIdPInput {
  tenantId: string;
  tenantName: string;
  provider: 'auth0' | 'keycloak';
  domains: string[];
  adminContact: Contact;
}

export interface IdPResult {
  organizationId: string;
  clientId: string;
  adminUserId: string;
}

export async function createIdPOrganization(input: CreateIdPInput): Promise<IdPResult> {
  if (input.provider === 'auth0') {
    return createAuth0Organization(input);
  } else {
    return createKeycloakRealm(input);
  }
}

async function createAuth0Organization(input: CreateIdPInput): Promise<IdPResult> {
  const auth0 = new Auth0ManagementClient({
    domain: process.env.AUTH0_DOMAIN!,
    clientId: process.env.AUTH0_CLIENT_ID!,
    clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  });

  // Create organization
  const org = await auth0.organizations.create({
    name: input.tenantId,
    display_name: input.tenantName,
  });

  // Create application for tenant
  const client = await auth0.clients.create({
    name: `${input.tenantName} App`,
    app_type: 'spa',
    // ... other config
  });

  // Create admin user
  const user = await auth0.users.create({
    email: input.adminContact.email,
    connection: 'Username-Password-Authentication',
    // ... other config
  });

  // Add user to organization as admin
  await auth0.organizations.addMembers(org.id, {
    members: [user.user_id],
  });

  return {
    organizationId: org.id,
    clientId: client.client_id,
    adminUserId: user.user_id,
  };
}

export async function rollbackIdPOrganization(tenantId: string): Promise<void> {
  // Delete Auth0 org or Keycloak realm
}
```

### Phase 5: Modify Tenant Management Service

**Changes to:** `services/tenant-management-service/`

1. **Add Temporal client dependency**

```json
// package.json additions
{
  "dependencies": {
    "@temporalio/client": "^1.11.0"
  }
}
```

2. **Create Temporal client provider**

**New file:** `src/providers/temporal-client.provider.ts`

```typescript
import { Provider, inject } from '@loopback/core';
import { Client, Connection } from '@temporalio/client';

export class TemporalClientProvider implements Provider<Client> {
  private client: Client | null = null;

  constructor(
    @inject('temporal.config')
    private config: TemporalConfig,
  ) {}

  async value(): Promise<Client> {
    if (!this.client) {
      const connection = await Connection.connect({
        address: this.config.address,
        tls: this.config.tls,
      });

      this.client = new Client({
        connection,
        namespace: this.config.namespace,
      });
    }
    return this.client;
  }
}
```

3. **Modify ProvisioningService**

**File:** `src/services/provisioning.service.ts`

```typescript
import { inject } from '@loopback/core';
import { Client } from '@temporalio/client';
import { provisionTenantWorkflow } from '@arc-saas/temporal-worker-service';

@injectable({scope: BindingScope.TRANSIENT})
export class ProvisioningService<T extends SubscriptionDTO> {
  constructor(
    @inject('temporal.client')
    private temporalClient: Client,
    @inject('repositories.TenantRepository')
    private tenantRepository: TenantRepository,
    // ... other injections
  ) {}

  async provisionTenant(
    tenant: TenantWithRelations,
    subscription: T,
  ): Promise<string> {
    // Start Temporal workflow (replaces event publishing)
    const handle = await this.temporalClient.workflow.start(
      provisionTenantWorkflow,
      {
        taskQueue: 'tenant-provisioning',
        workflowId: `provision-tenant-${tenant.id}`,
        args: [{
          tenantId: tenant.id,
          tenantKey: tenant.key,
          tenantName: tenant.name,
          domains: tenant.domains,
          contacts: tenant.contacts,
          subscription: {
            id: subscription.id,
            planId: subscription.planId,
            tier: subscription.plan?.tier as 'silo' | 'pooled' | 'bridge',
            startDate: subscription.startDate,
            endDate: subscription.endDate,
          },
        }],
      }
    );

    // Return workflow ID for tracking
    return handle.workflowId;
  }

  async getProvisioningStatus(workflowId: string): Promise<ProvisioningStatus> {
    const handle = this.temporalClient.workflow.getHandle(workflowId);
    return handle.query(getProvisioningStatusQuery);
  }

  async cancelProvisioning(workflowId: string): Promise<void> {
    const handle = this.temporalClient.workflow.getHandle(workflowId);
    await handle.signal(provisioningCancelledSignal);
  }
}
```

4. **Add status endpoint to controller**

**File:** `src/controllers/tenant.controller.ts`

```typescript
@get('/tenants/{id}/provisioning-status')
async getProvisioningStatus(
  @param.path.string('id') id: string,
): Promise<ProvisioningStatus> {
  const workflowId = `provision-tenant-${id}`;
  return this.provisioningService.getProvisioningStatus(workflowId);
}

@post('/tenants/{id}/cancel-provisioning')
async cancelProvisioning(
  @param.path.string('id') id: string,
): Promise<void> {
  const workflowId = `provision-tenant-${id}`;
  await this.provisioningService.cancelProvisioning(workflowId);
}
```

### Phase 6: Remove/Deprecate Old Components

1. **Remove from tenant-management-service:**
   - `EventConnector` (no longer needed)
   - `WebhookController` (replaced by Temporal activities)
   - `WebhookVerifierInterceptor` (no longer needed)
   - `ProvisioningWebhookHandler` (logic moved to activities)

2. **Deprecate orchestrator-service:**
   - Keep for backward compatibility or remove entirely
   - Replace with `temporal-worker-service`

### Phase 7: Configuration & Environment

**File:** `temporal-worker-service/.env.example`

```env
# Temporal Configuration
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=arc-saas
TEMPORAL_TASK_QUEUE=tenant-provisioning

# For Temporal Cloud
TEMPORAL_CLOUD_ENABLED=false
TEMPORAL_CLOUD_NAMESPACE=your-namespace.a]
TEMPORAL_CLOUD_API_KEY=your-api-key

# Worker Configuration
TEMPORAL_WORKER_MAX_CONCURRENT_ACTIVITIES=10
TEMPORAL_WORKER_MAX_CONCURRENT_WORKFLOWS=50

# Database (for activities that need DB access)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_DATABASE=tenant_management
DB_SCHEMA=main

# Auth0 Configuration (for IdP activities)
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=xxx
AUTH0_CLIENT_SECRET=xxx

# Keycloak Configuration (alternative)
KEYCLOAK_URL=https://keycloak.example.com
KEYCLOAK_REALM=master
KEYCLOAK_CLIENT_ID=admin-cli
KEYCLOAK_CLIENT_SECRET=xxx

# Terraform Cloud (for infrastructure activities)
TF_CLOUD_TOKEN=xxx
TF_CLOUD_ORG=your-org
TF_WORKSPACE_SILO=tenant-silo-workspace
TF_WORKSPACE_POOLED=tenant-pooled-workspace

# AWS (for notifications)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
SES_FROM_EMAIL=noreply@example.com
```

---

## Migration Strategy

### Step 1: Deploy Temporal Infrastructure
- Option A: Use Temporal Cloud (recommended for production)
- Option B: Self-host Temporal Server (Docker Compose for dev)

### Step 2: Deploy Worker Service
- Deploy `temporal-worker-service` alongside existing services
- Workers connect to Temporal Server and poll for tasks

### Step 3: Update Tenant Management Service
- Add Temporal client
- Modify ProvisioningService to start workflows
- Add status/cancel endpoints

### Step 4: Feature Flag Migration
- Use feature flag to route new provisioning requests to Temporal
- Existing in-flight requests continue through old path
- Gradually increase Temporal traffic

### Step 5: Remove Old Components
- Once all requests use Temporal, remove:
  - EventConnector
  - Webhook components
  - orchestrator-service (or keep deprecated)

---

## Files to Create

| File | Purpose |
|------|---------|
| `services/temporal-worker-service/package.json` | Worker service dependencies |
| `services/temporal-worker-service/src/index.ts` | Worker entry point |
| `services/temporal-worker-service/src/worker.ts` | Worker configuration |
| `services/temporal-worker-service/src/client.ts` | Temporal client factory |
| `services/temporal-worker-service/src/workflows/provision-tenant.workflow.ts` | Main provisioning workflow |
| `services/temporal-worker-service/src/workflows/deprovision-tenant.workflow.ts` | Deprovisioning workflow |
| `services/temporal-worker-service/src/activities/idp.activities.ts` | IdP operations |
| `services/temporal-worker-service/src/activities/infrastructure.activities.ts` | Infrastructure provisioning |
| `services/temporal-worker-service/src/activities/deployment.activities.ts` | App deployment |
| `services/temporal-worker-service/src/activities/tenant.activities.ts` | Tenant DB operations |
| `services/temporal-worker-service/src/activities/notification.activities.ts` | Email notifications |
| `services/temporal-worker-service/src/types/workflow-input.types.ts` | TypeScript types |
| `services/temporal-worker-service/Dockerfile` | Container build |

## Files to Modify

| File | Changes |
|------|---------|
| `services/tenant-management-service/package.json` | Add @temporalio/client |
| `services/tenant-management-service/src/services/provisioning.service.ts` | Use Temporal client |
| `services/tenant-management-service/src/controllers/tenant.controller.ts` | Add status endpoints |
| `services/tenant-management-service/src/application.ts` | Add Temporal bindings |
| `lerna.json` | Add temporal-worker-service to workspaces |

## Files to Remove (After Migration)

| File | Reason |
|------|--------|
| `services/tenant-management-service/src/services/event-connector/` | Replaced by Temporal |
| `services/tenant-management-service/src/controllers/webhook/` | Replaced by activities |
| `services/tenant-management-service/src/interceptors/webhook-verifier.interceptor.ts` | No longer needed |
| `services/orchestrator-service/` | Replaced by temporal-worker-service |

---

## Benefits After Migration

| Aspect | Before | After |
|--------|--------|-------|
| **State Management** | None | Durable, persistent |
| **Retries** | Manual | Automatic with backoff |
| **Rollback** | None | Saga compensation |
| **Visibility** | None | Temporal UI dashboard |
| **Long Operations** | Webhook callbacks | Native support |
| **Debugging** | Log diving | Workflow history |
| **Testing** | Integration only | Time-skipping unit tests |
| **Scaling** | Manual | Worker auto-scaling |

---

## Estimated Effort

| Phase | Description | Complexity |
|-------|-------------|------------|
| 1 | Create worker service structure | Low |
| 2 | Define types | Low |
| 3 | Implement workflows | Medium |
| 4 | Implement activities | High |
| 5 | Modify tenant service | Medium |
| 6 | Remove old components | Low |
| 7 | Configuration | Low |

---

## Questions to Clarify

1. **Temporal Hosting**: Temporal Cloud or self-hosted?
2. **Infrastructure Tool**: Terraform Cloud, Pulumi, AWS CDK, or direct SDK?
3. **IdP Priority**: Auth0, Keycloak, or both?
4. **Keep orchestrator-service?**: Full removal or deprecation?
