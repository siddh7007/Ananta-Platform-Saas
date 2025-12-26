# Quick Start: Tenant Provisioning with Temporal Workflows

## ✅ System Status

All services are running and operational:

```
✅ PostgreSQL (port 5432)
✅ Temporal Server (port 7233) - SELF-HOSTED
✅ Keycloak (port 8080)
✅ Redis (port 6379)
✅ tenant-management-service (port 14000)
✅ temporal-worker-service (RUNNING)
```

## 🔧 Configuration

### Key Settings

```bash
# tenant-management-service
PORT=14000
HOST=127.0.0.1
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=arc-saas

# temporal-worker-service
TEMPORAL_CLOUD_ENABLED=false  # Using self-hosted Temporal
KEYCLOAK_ENABLED=true
NOVU_ENABLED=true
```

## 📝 Tenant Provisioning Flow

### 1. Create Lead

```bash
curl -X POST http://127.0.0.1:14000/leads \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@newcompany.com",
    "firstName": "John",
    "lastName": "Doe",
    "companyName": "New Company Inc",
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
  "key": "validation-token-abc123",
  "id": "lead-uuid-here"
}
```

### 2. Verify Lead

```bash
curl -X POST http://127.0.0.1:14000/leads/{LEAD_ID}/verify \
  -H "Authorization: Bearer {VALIDATION_TOKEN}"
```

**Response**:
```json
{
  "id": "lead-uuid-here",
  "token": "jwt-token-for-tenant-creation"
}
```

### 3. Create Tenant

```bash
curl -X POST http://127.0.0.1:14000/leads/{LEAD_ID}/tenants \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "newcompany",
    "domains": ["newcompany.com"]
  }'
```

**Response**:
```json
{
  "id": "tenant-uuid",
  "key": "newcompany",
  "name": "New Company Inc",
  "status": "PENDING_PROVISION",
  "domains": ["newcompany.com"],
  "contacts": [...]
}
```

### 4. Trigger Provisioning

```bash
curl -X POST http://127.0.0.1:14000/tenants/{TENANT_ID}/provision \
  -H "Authorization: Bearer {ADMIN_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "sub-uuid",
    "subscriberId": "{TENANT_ID}",
    "planId": "plan-uuid",
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2026-01-01T00:00:00Z",
    "status": 1,
    "plan": {
      "id": "plan-uuid",
      "name": "Enterprise Plan",
      "description": "Enterprise tier",
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

## 🔍 Monitoring

### Check Workflow Status

```bash
# Using Temporal CLI
temporal workflow list --namespace arc-saas --task-queue tenant-provisioning

# Describe specific workflow
temporal workflow describe --workflow-id provision-tenant-{TENANT_ID} --namespace arc-saas
```

### Check Temporal Worker Logs

```bash
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/temporal-worker-service
npm run start:worker

# Look for:
# - "Connected to Temporal namespace: arc-saas"
# - "Worker state: RUNNING"
# - "Provisioning workflow started"
# - "Creating IdP organization"
# - "Creating admin user"
```

### Check Keycloak

```
URL: http://localhost:8080
Username: admin
Password: admin

Look for:
- New realm: tenant-{key}
- New client: {key}-app
- New admin user: {adminEmail}
```

### Check Novu (if enabled)

```
URL: http://localhost:3000 (if self-hosted)

Look for:
- New subscriber: tenant-{tenantId}-{sanitized_email}
- Workflow trigger: tenant-welcome
- Transaction ID in logs
```

## 🎯 What Happens During Provisioning

The Temporal workflow executes these steps:

1. **Update Status** → Set tenant status to `PROVISIONING`
2. **Create IdP** → Create Keycloak realm `tenant-{key}`
3. **Create Admin User** → Create user in Keycloak with realm-admin role
4. **Provision Database** → Create PostgreSQL schema for tenant
5. **Provision Storage** → Create S3/MinIO bucket (if configured)
6. **Provision Infrastructure** → Run Terraform (if configured)
7. **Deploy Application** → Deploy application plane
8. **Configure DNS** → Set up domain routing
9. **Create Resources** → Record all resources in database
10. **Activate Tenant** → Set status to `ACTIVE`
11. **Send Notification** → Send welcome email via Novu

**Duration**: 10-20 seconds (without infrastructure provisioning)

## 🔐 Keycloak Resources Created

For tenant with key "newcompany":

```
Realm: tenant-newcompany
  ├── Client: newcompany-app
  │   ├── Protocol: openid-connect
  │   ├── Redirect URIs: https://newcompany.com/*
  │   ├── Web Origins: https://newcompany.com
  │   └── PKCE: S256
  └── User: admin@newcompany.com
      ├── Email: admin@newcompany.com
      ├── First Name: John
      ├── Last Name: Doe
      ├── Enabled: true
      ├── Roles: realm-admin
      └── Attributes:
          ├── tenantId: {tenant-uuid}
          └── role: admin
```

## 📧 Novu Notifications

### Welcome Email

Triggered after successful provisioning:

```
Template: tenant-welcome
Subscriber: tenant-{tenantId}-admin_newcompany_com
Payload:
  - tenantId
  - tenantName
  - firstName
  - lastName
  - appPlaneUrl
  - adminPortalUrl
  - loginUrl
  - supportEmail
```

### Provisioning Failed Email

Triggered if provisioning fails:

```
Template: tenant-provisioning-failed
Subscriber: tenant-{tenantId}-admin_newcompany_com
Payload:
  - tenantId
  - tenantName
  - firstName
  - error
  - failedStep
  - supportEmail
```

## ⚠️ SAGA Compensation

If any step fails, automatic rollback occurs:

| Failed Step | Compensation Actions |
|------------|---------------------|
| IdP Organization | None (nothing created yet) |
| Admin User | Delete IdP realm |
| Database Schema | Delete IdP + Drop schema |
| Storage Bucket | Delete IdP + Drop schema + Delete bucket |
| Infrastructure | Full rollback + Terraform destroy |
| Deploy | Rollback all + Delete infrastructure |
| DNS | Rollback all previous steps |

## 🐛 Troubleshooting

### Issue: Workflow Not Starting

```bash
# Check worker connection
tail -f temporal-worker-service/logs/worker.log | grep "Connected to Temporal"

# Verify namespace exists
temporal operator namespace list

# Create namespace if missing
temporal operator namespace create arc-saas
```

### Issue: IdP Organization Failed

```bash
# Check Keycloak is accessible
curl http://localhost:8080

# Check credentials in .env
KEYCLOAK_ADMIN_USERNAME=admin
KEYCLOAK_ADMIN_PASSWORD=admin
```

### Issue: Novu Notification Not Sent

```bash
# Check if Novu is enabled
grep NOVU_ENABLED temporal-worker-service/.env

# Check worker logs
tail -f temporal-worker-service/logs/worker.log | grep -i novu

# If disabled, notifications are skipped (workflow continues)
```

### Issue: 401 Unauthorized

```bash
# JWT token expired (15-minute expiration)
# Get new token by re-verifying lead

# Wrong lead ID in token
# Ensure lead ID in URL matches ID in JWT token
```

## 📚 Additional Documentation

- **[TEST-TENANT-PROVISIONING.md](TEST-TENANT-PROVISIONING.md)** - Complete testing guide
- **[TEMPORAL-INTEGRATION-SUMMARY.md](TEMPORAL-INTEGRATION-SUMMARY.md)** - Detailed implementation summary

## 🚀 Service Commands

```bash
# Start tenant-management-service
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/tenant-management-service
npm run start

# Start temporal-worker-service
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/temporal-worker-service
npm run start:worker

# Check service health
curl http://127.0.0.1:14000/ping

# Check Docker containers
docker ps --filter "name=arc-saas"
```

## ✅ Verification Checklist

After triggering provisioning:

- [ ] Workflow appears in Temporal UI (http://localhost:8080)
- [ ] Worker logs show "Provisioning workflow started"
- [ ] Keycloak has new realm `tenant-{key}`
- [ ] Keycloak has new client `{key}-app`
- [ ] Keycloak has new admin user
- [ ] Database has tenant record with status `ACTIVE`
- [ ] Database has resource records for realm and client
- [ ] Novu shows new subscriber (if enabled)
- [ ] Novu shows workflow trigger (if enabled)

## 🎓 Key Concepts

### Self-Hosted Temporal

We are using **self-hosted Temporal Server**, NOT Temporal Cloud:

```bash
TEMPORAL_CLOUD_ENABLED=false
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=arc-saas
```

### Idempotency

Workflow IDs ensure idempotent provisioning:

```
Workflow ID: provision-tenant-{TENANT_ID}
```

Attempting to start the same workflow twice will return the existing workflow handle.

### Tier Normalization

Subscription plan tiers are normalized to deployment architectures:

```
enterprise → silo (dedicated infrastructure)
standard → pooled (shared infrastructure)
hybrid → bridge (mixed infrastructure)
```

### Resource Tracking

All provisioned resources are tracked in the database:

```sql
SELECT * FROM resources WHERE tenant_id = '{TENANT_ID}';

-- Example results:
-- keycloak_realm: tenant-newcompany
-- keycloak_client: newcompany-app
-- keycloak_admin_user: admin@newcompany.com
-- database_schema: tenant_newcompany
-- storage_bucket: tenant-newcompany-files
```

## 📊 Expected Timeline

| Phase | Duration |
|-------|----------|
| Lead Creation | < 500ms |
| Lead Verification | < 200ms |
| Tenant Creation | < 1s |
| Workflow Start | < 2s |
| IdP Organization | 5-10s |
| Admin User Creation | 2-5s |
| Database Schema | 2-5s |
| Storage Bucket | 2-5s |
| **Total (no infra)** | **10-20s** |
| Infrastructure (optional) | 5-30min |
| **Total (with infra)** | **5-30min** |

## 🎉 Success Criteria

Tenant provisioning is successful when:

1. ✅ Workflow status is `COMPLETED`
2. ✅ Tenant status is `ACTIVE`
3. ✅ Keycloak realm exists with client and admin user
4. ✅ Database has tenant and resource records
5. ✅ Admin user can log in to tenant realm
6. ✅ Welcome email sent (if Novu enabled)
7. ✅ No compensation activities executed

## 📞 Support

For issues or questions:

- Check worker logs: `temporal-worker-service/logs/`
- Check service logs: `tenant-management-service/logs/`
- Review Temporal UI: http://localhost:8080
- Review Keycloak: http://localhost:8080 (admin/admin)
- Review documentation: `TEST-TENANT-PROVISIONING.md`
