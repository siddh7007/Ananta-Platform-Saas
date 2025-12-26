# Workflow Failure Scenarios and Remediation Guide

This document describes common failure scenarios in Temporal workflows for tenant provisioning/deprovisioning
and provides step-by-step remediation procedures.

> **NOTE**: All workflow operational endpoints (restart, cancel, terminate) are **FULLY IMPLEMENTED**
> in `workflow.controller.ts` lines 419-807. See [Remediation Commands](#remediation-commands) for usage.

## Table of Contents

1. [Overview](#overview)
2. [Monitoring Workflows](#monitoring-workflows)
3. [Provisioning Workflow Failures](#provisioning-workflow-failures)
4. [Deprovisioning Workflow Failures](#deprovisioning-workflow-failures)
5. [Common Activity Failures](#common-activity-failures)
6. [Remediation Commands](#remediation-commands)
7. [Emergency Procedures](#emergency-procedures)

---

## Overview

### Workflow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Tenant Provisioning Workflow                  │
├─────────────────────────────────────────────────────────────────┤
│ Step 1: updateTenantStatus (PROVISIONING)                       │
│ Step 2: createIdPOrganization (Keycloak)                        │
│ Step 3: createKeycloakUser (Admin user)                         │
│ Step 4: provisionTenantSchema (PostgreSQL)                      │
│ Step 5: provisionTenantStorage (S3/MinIO)                       │
│ Step 6: provisionInfrastructure (Terraform - silo only)         │
│ Step 7: deployApplication (Kubernetes/Docker)                    │
│ Step 8: configureDns (DNS records - silo only)                  │
│ Step 9: createResources (Record resources in DB)                │
│ Step 10: activateTenant (Set status ACTIVE)                     │
│ Step 11: createBillingCustomer (Stripe)                         │
│ Step 12: createSubscription (Create billing subscription)        │
│ Step 13: sendWelcomeEmail (Novu)                                │
│ Step 14: notifyAppPlane (Webhook to App Plane)                  │
└─────────────────────────────────────────────────────────────────┘
```

### Saga Compensation Pattern

The provisioning workflow implements the **Saga pattern** for rollback. When a step fails,
previously completed steps are automatically compensated in reverse order:

```
FAILURE at Step 6 (Infrastructure) triggers:
  → Rollback Step 5: deprovisionTenantStorage
  → Rollback Step 4: deprovisionTenantSchema
  → Rollback Step 3: deleteKeycloakUser
  → Rollback Step 2: deleteIdPOrganization
  → Rollback Step 1: updateTenantStatus (PROVISION_FAILED)
```

---

## Monitoring Workflows

### Check Workflow Status via API

```bash
# Get all workflows
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:14000/workflows"

# Get specific workflow
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:14000/workflows/provision-tenant-{tenantId}"

# Get workflow by tenant ID
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:14000/workflows?tenantId={tenantId}"
```

### Check via Temporal UI

1. Open http://localhost:27021 (Temporal UI)
2. Select `arc-saas` namespace
3. Search for workflow by ID or filter by status

### Check via Temporal CLI

```bash
# List all running workflows
docker exec arc-saas-temporal temporal workflow list \
  --namespace arc-saas \
  --address temporal:7233

# Show workflow details
docker exec arc-saas-temporal temporal workflow show \
  --namespace arc-saas \
  --workflow-id "provision-tenant-{tenantId}" \
  --address temporal:7233

# Get workflow history (events)
docker exec arc-saas-temporal temporal workflow show \
  --namespace arc-saas \
  --workflow-id "provision-tenant-{tenantId}" \
  --address temporal:7233 \
  --output json
```

---

## Provisioning Workflow Failures

### Failure: IdP Organization Creation (Step 2)

**Symptoms:**
- Workflow status: `PROVISION_FAILED`
- Error contains: "Failed to create IdP organization" or "Keycloak" errors

**Causes:**
- Keycloak service unavailable
- Invalid Keycloak admin credentials
- Realm doesn't exist
- Network connectivity issues

**Remediation:**

1. **Verify Keycloak connectivity:**
   ```bash
   curl http://localhost:8180/auth/realms/master
   ```

2. **Check Keycloak admin credentials:**
   ```bash
   # Get token to verify credentials work
   curl -X POST http://localhost:8180/auth/realms/master/protocol/openid-connect/token \
     -d "username=admin" \
     -d "password=admin" \
     -d "grant_type=password" \
     -d "client_id=admin-cli"
   ```

3. **Restart workflow:**
   ```bash
   curl -X POST -H "Authorization: Bearer $JWT_TOKEN" \
     "http://localhost:14000/workflows/provision-tenant-{tenantId}/restart" \
     -H "Content-Type: application/json" \
     -d '{"reason": "Keycloak connectivity restored"}'
   ```

---

### Failure: Database Schema Provisioning (Step 4)

**Symptoms:**
- Error contains: "Failed to provision tenant schema"
- Error contains: "function create_tenant_schema does not exist"

**Causes:**
- PostgreSQL connection failure
- Missing `create_tenant_schema` function
- Duplicate schema name (tenant key already used)

**Remediation:**

1. **Verify PostgreSQL connectivity:**
   ```bash
   docker exec -it arc-saas-postgres psql -U postgres -d arc_saas -c "SELECT 1"
   ```

2. **Check if schema function exists:**
   ```bash
   docker exec -it arc-saas-postgres psql -U postgres -d arc_saas -c "
     SELECT routine_name FROM information_schema.routines
     WHERE routine_name = 'create_tenant_schema'
   "
   ```

3. **If function missing, apply init script:**
   ```bash
   docker exec -i arc-saas-postgres psql -U postgres -d arc_saas \
     < arc-saas/docker/init-db/01-init-schemas.sql
   ```

4. **Check for duplicate schema:**
   ```bash
   docker exec -it arc-saas-postgres psql -U postgres -d arc_saas -c "
     SELECT schema_name FROM information_schema.schemata
     WHERE schema_name LIKE 'tenant_%'
   "
   ```

5. **If schema exists but tenant failed, drop orphan schema:**
   ```bash
   docker exec -it arc-saas-postgres psql -U postgres -d arc_saas -c "
     DROP SCHEMA IF EXISTS tenant_{tenantKey} CASCADE
   "
   ```

6. **Restart workflow:**
   ```bash
   curl -X POST -H "Authorization: Bearer $JWT_TOKEN" \
     "http://localhost:14000/workflows/provision-tenant-{tenantId}/restart"
   ```

---

### Failure: Storage Provisioning (Step 5)

**Symptoms:**
- Error contains: "Failed to provision tenant storage"
- S3/MinIO bucket errors

**Causes:**
- MinIO/S3 service unavailable
- Invalid credentials
- Bucket already exists with different owner

**Remediation:**

1. **Verify MinIO connectivity:**
   ```bash
   curl http://localhost:9001/minio/health/ready
   ```

2. **Check if bucket exists:**
   ```bash
   docker exec arc-saas-minio mc ls local/ | grep tenant-{tenantKey}
   ```

3. **Delete orphan bucket if exists:**
   ```bash
   docker exec arc-saas-minio mc rb --force local/tenant-{tenantKey}
   ```

4. **Restart workflow**

---

### Failure: Infrastructure Provisioning (Step 6 - Silo Only)

**Symptoms:**
- Error contains: "Terraform" or "Infrastructure provisioning failed"
- Long-running workflow (> 30 minutes)

**Causes:**
- Terraform Cloud API unavailable
- Invalid Terraform API token
- AWS/Cloud credentials expired
- Resource quota exceeded

**Remediation:**

1. **Check Terraform Cloud workspace status:**
   - Log into Terraform Cloud
   - Navigate to workspace: `tenant-{tenantKey}`
   - Check run history

2. **If Terraform run failed:**
   - Review error in Terraform Cloud UI
   - Fix underlying infrastructure issue
   - Restart workflow

3. **If stuck in pending:**
   ```bash
   # Cancel the workflow
   curl -X POST -H "Authorization: Bearer $JWT_TOKEN" \
     "http://localhost:14000/workflows/provision-tenant-{tenantId}/cancel" \
     -d '{"reason": "Terraform stuck"}'
   ```

4. **Clean up partial infrastructure:**
   ```bash
   # In Terraform Cloud, manually trigger destroy
   # Or via CLI:
   terraform destroy -target=module.tenant_{tenantKey}
   ```

---

### Failure: Billing Customer Creation (Step 11)

**Symptoms:**
- Error contains: "Failed to create billing customer" or "Stripe"
- Tenant is ACTIVE but billing not set up

**Causes:**
- Stripe API unavailable
- Invalid Stripe API key
- Customer with email already exists

**Remediation:**

1. **Check Stripe Dashboard:**
   - Search for customer by tenant email
   - If exists, link manually

2. **Verify Stripe API key:**
   ```bash
   curl https://api.stripe.com/v1/customers \
     -u sk_test_your_key:
   ```

3. **Create customer manually if needed:**
   ```bash
   curl https://api.stripe.com/v1/customers \
     -u sk_test_your_key: \
     -d "email={tenant_email}" \
     -d "name={tenant_name}" \
     -d "metadata[tenantId]={tenantId}"
   ```

4. **Update tenant with Stripe customer ID:**
   ```sql
   UPDATE tenant_management.tenants
   SET metadata = metadata || '{"stripeCustomerId": "cus_xxx"}'::jsonb
   WHERE id = '{tenantId}';
   ```

---

## Deprovisioning Workflow Failures

### Failure: Application Removal (Step 5)

**Symptoms:**
- Error contains: "Failed to remove deployment"
- Kubernetes/Docker errors

**Remediation:**

1. **Check deployment exists:**
   ```bash
   kubectl get deployments -n tenant-{tenantKey}
   # or for Docker
   docker ps | grep tenant-{tenantKey}
   ```

2. **Force delete deployment:**
   ```bash
   kubectl delete namespace tenant-{tenantKey} --grace-period=0 --force
   # or
   docker rm -f tenant-{tenantKey}
   ```

3. **Restart deprovisioning workflow**

---

### Failure: Infrastructure Destruction (Step 6)

**Symptoms:**
- Error contains: "Terraform destroy failed"
- Resources still exist in cloud

**Remediation:**

1. **Check Terraform Cloud for destroy run status**

2. **If resources stuck, force destroy:**
   ```bash
   # Delete Terraform state to allow clean retry
   terraform state rm module.tenant_{tenantKey}
   ```

3. **Manually delete cloud resources:**
   - Delete VPC/networking
   - Delete databases
   - Delete storage buckets
   - Delete compute instances

4. **Update tenant status to allow retry:**
   ```sql
   UPDATE tenant_management.tenants
   SET status = 4, -- DEPROVISIONING
       metadata = metadata || '{"requiresManualCleanup": false}'::jsonb
   WHERE id = '{tenantId}';
   ```

---

## Common Activity Failures

### Database Connection Failures

**All database-related activities may fail with:**
- "Connection refused"
- "ECONNREFUSED"
- "Connection timeout"

**Remediation:**

1. **Check PostgreSQL status:**
   ```bash
   docker ps | grep postgres
   docker logs arc-saas-postgres --tail 50
   ```

2. **Restart PostgreSQL if needed:**
   ```bash
   docker restart arc-saas-postgres
   ```

3. **Temporal will automatically retry** - wait for retries to complete

---

### Keycloak Connection Failures

**Symptoms:**
- "ECONNREFUSED" to port 8180
- "401 Unauthorized"
- "realm not found"

**Remediation:**

1. **Check Keycloak status:**
   ```bash
   docker ps | grep keycloak
   docker logs arc-saas-keycloak --tail 50
   ```

2. **Verify realm exists:**
   ```bash
   curl http://localhost:8180/auth/realms/ananta-saas
   ```

3. **Restart Keycloak if needed:**
   ```bash
   docker restart arc-saas-keycloak
   # Wait 30-60 seconds for startup
   ```

---

### Notification Failures (Non-Critical)

**Symptoms:**
- Error contains: "Failed to send notification" or "Novu"
- Workflow completes but welcome email not sent

**Note:** Notification failures are non-blocking. The workflow continues.

**Remediation:**

1. **Manually trigger notification:**
   ```bash
   curl -X POST "http://localhost:14000/notifications/send" \
     -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "type": "welcome",
       "tenantId": "{tenantId}",
       "recipients": ["admin@tenant.com"]
     }'
   ```

---

## Remediation Commands

### Restart a Failed Workflow

```bash
# Via API
curl -X POST -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:14000/workflows/{workflowId}/restart" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Manual restart after remediation"}'
```

### Cancel a Running Workflow

```bash
# Via API (graceful)
curl -X POST -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:14000/workflows/{workflowId}/cancel" \
  -d '{"reason": "Manual cancellation"}'

# Via Temporal CLI (immediate)
docker exec arc-saas-temporal temporal workflow cancel \
  --namespace arc-saas \
  --workflow-id "{workflowId}" \
  --address temporal:7233
```

### Terminate a Stuck Workflow (Force)

```bash
# Via API
curl -X POST -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:14000/workflows/{workflowId}/terminate" \
  -d '{"reason": "Force termination - stuck workflow"}'

# Via Temporal CLI
docker exec arc-saas-temporal temporal workflow terminate \
  --namespace arc-saas \
  --workflow-id "{workflowId}" \
  --reason "Manual termination" \
  --address temporal:7233
```

### Reset Tenant Status for Retry

```sql
-- Reset to allow new provisioning attempt
UPDATE tenant_management.tenants
SET status = 1, -- PENDING_PROVISION
    modified_on = NOW(),
    metadata = metadata - 'provisioningError' - 'failedAt'
WHERE id = '{tenantId}';
```

---

## Emergency Procedures

### Complete System Failure Recovery

If all workflows are stuck/failed:

1. **Stop Temporal worker:**
   ```bash
   docker stop arc-saas-temporal-worker
   ```

2. **Check Temporal server:**
   ```bash
   docker logs arc-saas-temporal --tail 100
   ```

3. **Restart Temporal stack:**
   ```bash
   docker restart arc-saas-temporal
   sleep 30
   docker restart arc-saas-temporal-worker
   ```

4. **Verify workflows resume:**
   ```bash
   docker exec arc-saas-temporal temporal workflow list \
     --namespace arc-saas \
     --address temporal:7233
   ```

### Mass Workflow Termination

If many workflows need termination:

```bash
# List all running workflows
docker exec arc-saas-temporal temporal workflow list \
  --namespace arc-saas \
  --query "ExecutionStatus = 'Running'" \
  --address temporal:7233 \
  -o json | jq -r '.[].execution.workflowId' > running_workflows.txt

# Terminate each (review list first!)
while read wfid; do
  docker exec arc-saas-temporal temporal workflow terminate \
    --namespace arc-saas \
    --workflow-id "$wfid" \
    --reason "Mass termination - emergency" \
    --address temporal:7233
done < running_workflows.txt
```

### Database Consistency Check

After failures, verify data consistency:

```sql
-- Find tenants with mismatched status
SELECT t.id, t.key, t.status, t.metadata->>'lastStatusUpdate'
FROM tenant_management.tenants t
WHERE (t.status = 2 AND t.metadata->>'provisioningError' IS NOT NULL)  -- PROVISIONING but has error
   OR (t.status = 0 AND t.metadata->>'schemaName' IS NULL);  -- ACTIVE but no schema

-- Find orphan schemas (schema exists but tenant doesn't)
SELECT schema_name
FROM information_schema.schemata s
WHERE s.schema_name LIKE 'tenant_%'
  AND NOT EXISTS (
    SELECT 1 FROM tenant_management.tenants t
    WHERE t.key = REPLACE(s.schema_name, 'tenant_', '')
  );
```

---

## Log Markers Reference

When troubleshooting, search logs for these markers:

| Marker | Meaning |
|--------|---------|
| `[FLOW_START]` | Workflow started |
| `[FLOW_STEP]` | Step started |
| `[FLOW_COMPLETE]` | Workflow completed successfully |
| `[FLOW_FAIL]` | Workflow failed |
| `[FLOW_ROLLBACK]` | Saga compensation started |
| `[FLOW_SIGNAL]` | Signal received (cancel, etc.) |
| `[FLOW_QUERY]` | Status query handled |

Example log search:
```bash
docker logs arc-saas-temporal-worker 2>&1 | grep "FLOW_FAIL"
```

---

## Support Contacts

For issues not covered in this guide:
1. Check Temporal documentation: https://docs.temporal.io/
2. Review workflow code in `temporal-worker-service/src/workflows/`
3. Check activity implementations in `temporal-worker-service/src/activities/`
