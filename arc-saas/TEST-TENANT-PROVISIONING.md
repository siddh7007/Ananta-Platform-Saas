# Temporal Workflow Integration - Tenant Provisioning Test Guide

## Overview

This document provides a complete testing guide for the Temporal workflow-based tenant provisioning system in Arc SaaS, including admin user creation in Keycloak and Novu notifications.

## Architecture

- **tenant-management-service**: REST API (port 14000) for tenant CRUD operations
- **temporal-worker-service**: Temporal worker executing provisioning workflows
- **Self-Hosted Temporal Server**: Workflow orchestration (port 7233)
- **Keycloak**: Identity provider for tenant isolation
- **Novu**: Multi-channel notification platform
- **PostgreSQL**: Database with tenant schema isolation

## Prerequisites

### 1. Running Services

```bash
# Check Docker containers
docker ps

# Required containers:
# - arc-saas-postgres
# - arc-saas-temporal-postgres
# - arc-saas-temporal
# - arc-saas-keycloak
# - arc-saas-redis

# Start tenant-management-service
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/tenant-management-service
npm run start

# Start temporal-worker-service
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/temporal-worker-service
npm run start:worker
```

### 2. Configuration Files

#### temporal-worker-service/.env

```bash
# Temporal Configuration (Self-Hosted)
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=arc-saas
TEMPORAL_TASK_QUEUE=tenant-provisioning
TEMPORAL_CLOUD_ENABLED=false

# Keycloak Configuration
KEYCLOAK_ENABLED=true
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=master
KEYCLOAK_ADMIN_CLIENT_ID=admin-cli
KEYCLOAK_ADMIN_USERNAME=admin
KEYCLOAK_ADMIN_PASSWORD=admin

# Novu Configuration (Self-Hosted)
NOVU_ENABLED=true
NOVU_API_KEY=your-novu-api-key
NOVU_BACKEND_URL=http://localhost:3000
NOVU_SUPPORT_EMAIL=support@example.com
NOVU_TEMPLATE_WELCOME=tenant-welcome
NOVU_TEMPLATE_PROVISIONING_FAILED=tenant-provisioning-failed
NOVU_TEMPLATE_DEPROVISIONING=tenant-deprovisioning

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_DATABASE=tenant_management
DB_SCHEMA=main

# Observability
ENABLE_TRACING=1
SERVICE_NAME=temporal-worker-service
OPENTELEMETRY_HOST=localhost
OPENTELEMETRY_PORT=6832
```

#### tenant-management-service/.env

```bash
PORT=14000
HOST=127.0.0.1
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=arc-saas
TEMPORAL_TASK_QUEUE=tenant-provisioning
JWT_SECRET=your-jwt-secret-key-here
JWT_ISSUER=arc-saas
```

## Tenant Provisioning Flow

### Step 1: Create a Lead

**Endpoint**: `POST http://127.0.0.1:14000/leads`

**Purpose**: Register interest in the platform (no auth required)

```bash
curl -X POST http://127.0.0.1:14000/leads \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@testcorp5.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "companyName": "TestCorp5 Inc",
    "address": {
      "country": "US",
      "address": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94102"
    }
  }'
```

**Response**:
```json
{
  "key": "validation-token-here",
  "id": "lead-uuid-here"
}
```

### Step 2: Verify Lead

**Endpoint**: `POST http://127.0.0.1:14000/leads/{id}/verify`

**Purpose**: Validate email ownership

```bash
curl -X POST http://127.0.0.1:14000/leads/{LEAD_ID}/verify \
  -H "Authorization: Bearer {VALIDATION_TOKEN}" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "token": "jwt-token-for-tenant-creation"
}
```

### Step 3: Create Tenant

**Endpoint**: `POST http://127.0.0.1:14000/leads/{id}/tenants`

**Purpose**: Create tenant record (status: PENDING_PROVISION)

```bash
curl -X POST http://127.0.0.1:14000/leads/{LEAD_ID}/tenants \
  -H "Authorization: Bearer {JWT_FROM_VERIFY}" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "testcorp5",
    "name": "TestCorp5 Inc",
    "domains": ["testcorp5.com"],
    "contact": {
      "email": "admin@testcorp5.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "isPrimary": true
    }
  }'
```

**Response**:
```json
{
  "id": "tenant-uuid",
  "key": "testcorp5",
  "name": "TestCorp5 Inc",
  "status": "PENDING_PROVISION",
  "domains": ["testcorp5.com"],
  "contacts": [
    {
      "email": "admin@testcorp5.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "isPrimary": true
    }
  ]
}
```

### Step 4: Trigger Provisioning

**Endpoint**: `POST http://127.0.0.1:14000/tenants/{id}/provision`

**Purpose**: Start Temporal workflow for tenant provisioning

```bash
curl -X POST http://127.0.0.1:14000/tenants/{TENANT_ID}/provision \
  -H "Authorization: Bearer {ADMIN_JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "subscription-uuid",
    "subscriberId": "tenant-uuid",
    "planId": "plan-uuid",
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2026-01-01T00:00:00Z",
    "status": 1,
    "plan": {
      "id": "plan-uuid",
      "name": "Enterprise Plan",
      "description": "Enterprise tier with dedicated infrastructure",
      "price": 999.00,
      "currencyId": "usd",
      "tier": "enterprise",
      "billingCycleId": "annual",
      "metaData": {
        "pipelineName": "enterprise-pipeline"
      }
    }
  }'
```

## Temporal Workflow Execution

### Workflow Steps

1. **Update Status** → `PROVISIONING`
2. **Create IdP Organization** → Keycloak realm `tenant-{key}`
3. **Create Admin User** → User in Keycloak realm
4. **Provision Database Schema** → PostgreSQL schema
5. **Provision Storage** → S3/MinIO bucket
6. **Provision Infrastructure** → Terraform (optional)
7. **Deploy Application** → Application plane
8. **Configure DNS** → Domain configuration
9. **Create Resource Records** → Database tracking
10. **Activate Tenant** → Status `ACTIVE`
11. **Send Welcome Notification** → Novu email

### Monitoring Workflow

```bash
# View workflow in Temporal UI
# Open: http://localhost:8080 (Temporal Web UI)

# Search for workflow ID: provision-tenant-{TENANT_ID}

# Or use Temporal CLI
temporal workflow list --namespace arc-saas --task-queue tenant-provisioning
temporal workflow describe --workflow-id provision-tenant-{TENANT_ID} --namespace arc-saas
```

## Verification Steps

### 1. Check Temporal Worker Logs

```bash
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/temporal-worker-service
npm run start:worker

# Look for:
# - "Provisioning workflow started"
# - "Creating IdP organization"
# - "Creating admin user"
# - "Sending welcome email"
```

### 2. Verify Keycloak Realm Creation

```bash
# Access Keycloak Admin Console
# URL: http://localhost:8080
# Username: admin
# Password: admin

# Check for new realm: tenant-testcorp5
# Verify client: testcorp5-app
# Verify admin user: admin@testcorp5.com
```

### 3. Verify Admin User in Keycloak

Using Keycloak Admin API:

```bash
# Get admin token
ADMIN_TOKEN=$(curl -X POST http://localhost:8080/realms/master/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin" \
  -d "password=admin" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  | jq -r '.access_token')

# List users in tenant realm
curl -X GET "http://localhost:8080/admin/realms/tenant-testcorp5/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq
```

Expected output:
```json
[
  {
    "id": "user-uuid",
    "username": "admin@testcorp5.com",
    "email": "admin@testcorp5.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "enabled": true,
    "emailVerified": false,
    "attributes": {
      "tenantId": ["tenant-uuid"],
      "role": ["admin"]
    }
  }
]
```

### 4. Verify Novu Notification

If Novu is enabled and configured:

```bash
# Check Novu dashboard
# URL: http://localhost:3000 (if self-hosted)

# Look for:
# - Subscriber created: tenant-{TENANT_ID}-admin_testcorp5_com
# - Workflow triggered: tenant-welcome
# - Transaction ID in logs
```

### 5. Check Tenant Status

```bash
curl -X GET http://127.0.0.1:14000/tenants/{TENANT_ID} \
  -H "Authorization: Bearer {ADMIN_JWT_TOKEN}"
```

Expected response:
```json
{
  "id": "tenant-uuid",
  "key": "testcorp5",
  "name": "TestCorp5 Inc",
  "status": "ACTIVE",
  "domains": ["testcorp5.com"],
  "contacts": [...],
  "resources": [
    {
      "type": "keycloak_realm",
      "identifier": "tenant-testcorp5"
    },
    {
      "type": "keycloak_client",
      "identifier": "testcorp5-app"
    },
    {
      "type": "database_schema",
      "identifier": "tenant_testcorp5"
    }
  ]
}
```

## Troubleshooting

### Issue: Workflow Not Starting

**Check**:
1. Temporal worker is connected: Look for "Worker state: RUNNING" in logs
2. Task queue matches: `tenant-provisioning` in both services
3. Namespace exists: `arc-saas` in Temporal

```bash
temporal operator namespace list
temporal operator namespace create arc-saas
```

### Issue: IdP Organization Creation Failed

**Check**:
1. Keycloak is accessible: `curl http://localhost:8080`
2. Admin credentials are correct
3. Check worker logs for Keycloak errors

### Issue: Novu Notification Not Sent

**Check**:
1. NOVU_ENABLED=true in .env
2. NOVU_API_KEY is valid
3. NOVU_BACKEND_URL is accessible
4. Template IDs exist in Novu dashboard

**Graceful Degradation**:
- If Novu is disabled, notifications are skipped (workflow continues)
- Check logs for: "Novu not enabled, skipping notification"

### Issue: 401 Unauthorized on /tenants/{id}/provision

**Check**:
1. JWT token is valid and not expired
2. User has `ProvisionTenant` permission
3. Token issuer matches JWT_ISSUER in .env

## SAGA Compensation

If any step fails, the workflow automatically compensates (rolls back):

### Compensation Actions

1. **IdP Failure** → No compensation needed (nothing created)
2. **Database Failure** → Delete IdP organization
3. **Storage Failure** → Delete IdP organization + Drop database schema
4. **Infrastructure Failure** → Delete IdP + Drop schema + Delete bucket
5. **Deploy Failure** → Full rollback + Terraform destroy
6. **DNS Failure** → Rollback all previous steps

### Example: Failed Provisioning

```bash
# Tenant status will be: PROVISION_FAILED
# Compensation executed: true
# Resources cleaned up automatically

# Check workflow history in Temporal UI for compensation activities
```

## Performance Metrics

### Expected Durations

- **Lead Creation**: < 500ms
- **Lead Verification**: < 200ms
- **Tenant Creation**: < 1s
- **Workflow Start**: < 2s
- **IdP Organization**: 5-10s
- **Database Schema**: 2-5s
- **Storage Bucket**: 2-5s
- **Infrastructure** (if enabled): 5-30min
- **Total (without infrastructure)**: 10-20s
- **Total (with infrastructure)**: 5-30min

## Complete Test Script

```bash
#!/bin/bash

# Configuration
BASE_URL="http://127.0.0.1:14000"
LEAD_EMAIL="admin@testcorp5.com"
COMPANY_NAME="TestCorp5 Inc"
TENANT_KEY="testcorp5"

echo "=== Step 1: Create Lead ==="
LEAD_RESPONSE=$(curl -s -X POST $BASE_URL/leads \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$LEAD_EMAIL\",
    \"firstName\": \"Jane\",
    \"lastName\": \"Doe\",
    \"companyName\": \"$COMPANY_NAME\",
    \"address\": {
      \"country\": \"US\",
      \"address\": \"123 Main St\",
      \"city\": \"San Francisco\",
      \"state\": \"CA\",
      \"zip\": \"94102\"
    }
  }")

LEAD_ID=$(echo $LEAD_RESPONSE | jq -r '.id')
VALIDATION_TOKEN=$(echo $LEAD_RESPONSE | jq -r '.key')

echo "Lead ID: $LEAD_ID"
echo "Validation Token: $VALIDATION_TOKEN"

echo ""
echo "=== Step 2: Verify Lead ==="
VERIFY_RESPONSE=$(curl -s -X POST $BASE_URL/leads/$LEAD_ID/verify \
  -H "Authorization: Bearer $VALIDATION_TOKEN" \
  -H "Content-Type: application/json")

JWT_TOKEN=$(echo $VERIFY_RESPONSE | jq -r '.token')
echo "JWT Token: $JWT_TOKEN"

echo ""
echo "=== Step 3: Create Tenant ==="
TENANT_RESPONSE=$(curl -s -X POST $BASE_URL/leads/$LEAD_ID/tenants \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"key\": \"$TENANT_KEY\",
    \"name\": \"$COMPANY_NAME\",
    \"domains\": [\"testcorp5.com\"],
    \"contact\": {
      \"email\": \"$LEAD_EMAIL\",
      \"firstName\": \"Jane\",
      \"lastName\": \"Doe\",
      \"isPrimary\": true
    }
  }")

TENANT_ID=$(echo $TENANT_RESPONSE | jq -r '.id')
echo "Tenant ID: $TENANT_ID"
echo "Tenant Status: $(echo $TENANT_RESPONSE | jq -r '.status')"

echo ""
echo "=== Step 4: Trigger Provisioning ==="
# Note: This requires admin JWT token with ProvisionTenant permission
# For testing, you may need to create a proper admin token

PROVISION_RESPONSE=$(curl -s -X POST $BASE_URL/tenants/$TENANT_ID/provision \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"sub-$(uuidgen)\",
    \"subscriberId\": \"$TENANT_ID\",
    \"planId\": \"plan-$(uuidgen)\",
    \"startDate\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"endDate\": \"$(date -u -d '+1 year' +%Y-%m-%dT%H:%M:%SZ)\",
    \"status\": 1,
    \"plan\": {
      \"id\": \"plan-$(uuidgen)\",
      \"name\": \"Enterprise Plan\",
      \"description\": \"Enterprise tier\",
      \"price\": 999.00,
      \"currencyId\": \"usd\",
      \"tier\": \"enterprise\",
      \"billingCycleId\": \"annual\",
      \"metaData\": {
        \"pipelineName\": \"enterprise-pipeline\"
      }
    }
  }")

echo "Provisioning Response: $PROVISION_RESPONSE"

echo ""
echo "=== Monitoring Workflow ==="
echo "Workflow ID: provision-tenant-$TENANT_ID"
echo "Check Temporal UI: http://localhost:8080"
echo "Check Worker Logs for provisioning progress"

echo ""
echo "=== Wait for Completion (10-20 seconds) ==="
sleep 15

echo ""
echo "=== Step 5: Verify Tenant Status ==="
FINAL_STATUS=$(curl -s -X GET $BASE_URL/tenants/$TENANT_ID \
  -H "Authorization: Bearer $JWT_TOKEN")

echo $FINAL_STATUS | jq

echo ""
echo "=== Verification Checklist ==="
echo "1. Tenant status should be: ACTIVE"
echo "2. Check Keycloak for realm: tenant-$TENANT_KEY"
echo "3. Check Keycloak for admin user: $LEAD_EMAIL"
echo "4. Check Temporal UI for workflow completion"
echo "5. If Novu enabled, check for welcome email notification"
```

## Summary

This integration provides:

1. ✅ **Durable Workflows**: Temporal handles retries and failures automatically
2. ✅ **SAGA Compensation**: Automatic rollback on failures
3. ✅ **IdP Integration**: Keycloak realm and user creation
4. ✅ **Notifications**: Novu multi-channel notifications
5. ✅ **Observability**: OpenTelemetry tracing and logging
6. ✅ **Status Tracking**: Real-time workflow progress queries
7. ✅ **Type Safety**: TypeScript error fixes ensure reliable execution

## Next Steps

1. Configure Novu templates in Novu dashboard
2. Set up SMTP for Novu email delivery
3. Configure Terraform for infrastructure provisioning
4. Set up monitoring and alerting for workflows
5. Implement workflow cancellation UI
6. Add webhook notifications for workflow completion
