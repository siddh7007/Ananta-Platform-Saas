# Quick Setup: Novu Notifications & Admin Portal

## Current Status ✅

All services are running and ready:

```
✅ Novu API: http://localhost:13100 (healthy)
✅ Novu Dashboard: http://localhost:14200
✅ Admin App: http://localhost:5000
✅ tenant-management-service: http://localhost:14000
✅ temporal-worker-service: RUNNING
```

## Step 1: Set Up Novu Dashboard (5 minutes)

### 1.1 Create Account

1. Open **http://localhost:14200** in your browser
2. Click "Sign Up" or "Get Started"
3. Fill in:
   - Email: `admin@arc-saas.local`
   - Password: (your choice)
   - Company Name: `Arc SaaS`
4. Click "Create Account"
5. You'll be redirected to the Novu Dashboard

### 1.2 Get Application Identifier

1. In the Novu Dashboard, click your profile (bottom left)
2. Go to **Settings** → **API Keys**
3. Copy the **Application Identifier** (looks like: `675198f58b9a65c8a5d55bb3`)
4. Copy the **API Key** (starts with a long string)
5. **Save these values** - you'll need them

### 1.3 Update Configuration

Update `temporal-worker-service/.env` with your API key:

```bash
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/temporal-worker-service

# Edit .env file
NOVU_API_KEY=<paste-your-api-key-here>
```

Update `admin-app/.env` with your app identifier:

```bash
cd e:/Work/Ananta-Platform-Saas/arc-saas/apps/admin-app

# Edit .env file
VITE_NOVU_APP_IDENTIFIER=<paste-your-app-identifier-here>
```

### 1.4 Create Notification Workflows

#### Workflow 1: tenant-welcome

1. In Novu Dashboard, click **Workflows** → **Create Workflow**
2. Click **Blank Workflow**
3. Workflow Name: `tenant-welcome`
4. Description: `Welcome notification for newly provisioned tenants`
5. Click **Create Workflow**

6. Add **In-App** notification step:
   - Click **+ Add Step** → **In-App**
   - **Content**:
     ```
     Welcome to {{tenantName}}! 🎉

     Your tenant has been successfully provisioned and is ready to use.

     **Details:**
     - Tenant ID: {{tenantId}}
     - Admin: {{firstName}} {{lastName}}
     - App URL: {{appPlaneUrl}}
     - Admin Portal: {{adminPortalUrl}}

     Click below to get started!
     ```
   - **Call-to-Action**:
     - Label: `Go to Dashboard`
     - URL: `{{appPlaneUrl}}`
   - Click **Save**

7. **Activate the workflow**:
   - Toggle "Active" to ON (top right)
   - Click **Update**

#### Workflow 2: tenant-provisioning-failed

1. Click **Workflows** → **Create Workflow**
2. Click **Blank Workflow**
3. Workflow Name: `tenant-provisioning-failed`
4. Description: `Error notification when tenant provisioning fails`
5. Click **Create Workflow**

6. Add **In-App** notification step:
   - Click **+ Add Step** → **In-App**
   - **Content**:
     ```
     ⚠️ Tenant Provisioning Failed

     Unfortunately, provisioning for {{tenantName}} failed.

     **Error Details:**
     {{error}}

     **Failed at step:** {{failedStep}}

     Please contact support for assistance.
     ```
   - **Call-to-Action**:
     - Label: `Contact Support`
     - URL: `mailto:{{supportEmail}}`
   - Click **Save**

7. **Activate the workflow**:
   - Toggle "Active" to ON
   - Click **Update**

## Step 2: Restart Services (1 minute)

After updating the configuration, restart the temporal worker:

```bash
# Find and kill the existing worker process
# (Check task manager or ps aux | grep temporal)

# Restart it
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/temporal-worker-service
npm run start:worker
```

If you updated the admin app config, restart it:

```bash
# Kill the existing process and restart
cd e:/Work/Ananta-Platform-Saas/arc-saas/apps/admin-app
npm run dev
```

## Step 3: Test with Tenant Provisioning

### Option A: Create Tenant via Database (Recommended)

```bash
# Create tenant directly in database
docker exec arc-saas-postgres psql -U postgres -d arc_saas <<SQL
BEGIN;

INSERT INTO main.tenants (id, key, name, status, created_on, modified_on)
VALUES (
  'bb000000-0000-0000-0000-000000000001',
  'democorp',
  'Demo Corporation',
  1,  -- PENDING_PROVISION
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO main.contacts (
  id, tenant_id, email, first_name, last_name, is_primary, created_on
)
VALUES (
  gen_random_uuid(),
  'bb000000-0000-0000-0000-000000000001',
  'admin@democorp.com',
  'Demo',
  'Admin',
  true,
  NOW()
)
ON CONFLICT DO NOTHING;

COMMIT;
SQL

# Generate admin JWT (valid for 1 hour)
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/tenant-management-service
ADMIN_JWT=$(node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({id: 'admin', userTenantId: 'admin', permissions: ['10216']}, 'your-jwt-secret-key-here', {expiresIn: '1h', issuer: 'arc-saas'}));")

# Trigger provisioning
curl -X POST "http://localhost:14000/tenants/bb000000-0000-0000-0000-000000000001/provision" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "sub-democorp-001",
    "subscriberId": "bb000000-0000-0000-0000-000000000001",
    "planId": "plan-enterprise",
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2026-01-01T00:00:00Z",
    "status": 1,
    "plan": {
      "id": "plan-enterprise",
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

### Option B: Use Temporal CLI

```bash
temporal workflow start \
  --task-queue tenant-provisioning \
  --type provisionTenantWorkflow \
  --workflow-id provision-tenant-bb000000-0000-0000-0000-000000000001 \
  --namespace arc-saas \
  --input '{
    "tenantId": "bb000000-0000-0000-0000-000000000001",
    "tenantKey": "democorp",
    "tenantName": "Demo Corporation",
    "subscription": {
      "planId": "plan-enterprise",
      "tier": "enterprise"
    },
    "contact": {
      "email": "admin@democorp.com",
      "firstName": "Demo",
      "lastName": "Admin"
    }
  }'
```

## Step 4: View Notifications

### In Admin Portal

1. Open **http://localhost:5000**
2. Look for the **notification bell icon** (top right)
3. You should see a **red badge** with the number of unread notifications
4. Click the bell icon to open the notification inbox
5. You should see the "Welcome to Demo Corporation!" notification

### In Novu Dashboard

1. Open **http://localhost:14200**
2. Go to **Activity Feed**
3. You should see the triggered notification with status "Sent"
4. Click on it to see details

### Check Temporal Workflow

```bash
# List workflows
temporal workflow list --namespace arc-saas

# Describe the workflow
temporal workflow describe \
  --workflow-id provision-tenant-bb000000-0000-0000-0000-000000000001 \
  --namespace arc-saas

# Should show status: COMPLETED
```

### Check Keycloak

1. Open **http://localhost:8080**
2. Login: `admin` / `admin`
3. Look for realm: **tenant-democorp**
4. Check users: **admin@democorp.com** should exist

## Troubleshooting

### Notification Not Appearing in Admin Portal

1. **Check browser console** (F12):
   - Look for Novu connection errors
   - Check WebSocket connection status

2. **Verify subscriber ID**:
   - In Novu Dashboard → Subscribers
   - Search for subscriber ID used in notification trigger
   - Should match: `tenant-{tenantId}-{sanitizedEmail}`

3. **Check Novu Activity Feed**:
   - Go to Novu Dashboard → Activity Feed
   - Look for the notification
   - Check its status (Sent/Failed/Pending)

4. **Verify admin app config**:
   ```bash
   cd e:/Work/Ananta-Platform-Saas/arc-saas/apps/admin-app
   cat .env | grep NOVU
   # Should show correct App Identifier and Backend URL
   ```

### Workflow Not Starting

1. **Check worker logs**:
   ```bash
   # Look for "Connected to Temporal" and "Worker state: RUNNING"
   ```

2. **Check Temporal namespace**:
   ```bash
   temporal operator namespace describe arc-saas
   ```

3. **Check tenant status**:
   ```sql
   docker exec arc-saas-postgres psql -U postgres -d arc_saas \
     -c "SELECT id, key, status FROM main.tenants WHERE key = 'democorp';"
   # Status should be 2 (ACTIVE) after successful provisioning
   ```

### Novu API Errors

1. **Check API health**:
   ```bash
   curl http://localhost:13100/v1/health-check
   # Should return {"status":"ok"}
   ```

2. **Verify API key**:
   - Make sure API key in `.env` matches Novu Dashboard
   - API key should not have extra spaces or quotes

3. **Check logs**:
   ```bash
   docker logs arc-saas-novu-api
   ```

## Success Criteria ✅

You know everything is working when:

- [ ] Novu Dashboard is accessible (http://localhost:14200)
- [ ] Admin app is accessible (http://localhost:5000)
- [ ] Notification workflows are created and active
- [ ] Temporal workflow completes successfully
- [ ] Keycloak realm is created (tenant-democorp)
- [ ] Notification appears in Novu Activity Feed
- [ ] **Notification bell in admin app shows badge**
- [ ] **Clicking bell shows the welcome notification**
- [ ] Clicking notification CTA navigates to tenant URL

## What to Expect

When you successfully provision a tenant:

1. **Immediate** (< 1 second):
   - Temporal workflow starts
   - Tenant status → PROVISIONING

2. **Within 10-20 seconds**:
   - Keycloak realm created
   - Admin user created
   - Resources tracked in database
   - Tenant status → ACTIVE
   - **Novu notification triggered**

3. **Real-time notification**:
   - Admin portal bell icon updates (red badge appears)
   - Notification appears in inbox
   - WebSocket delivers notification instantly

4. **Persistent notification**:
   - Notification stays in inbox until read
   - Unread count persists across page refreshes
   - Can be viewed in Novu Dashboard → Activity Feed

## Summary

You're now ready to see notifications in the admin portal! Just:

1. ✅ Set up Novu workflows in dashboard (http://localhost:14200)
2. ✅ Update configuration with your App Identifier and API Key
3. ✅ Restart services to pick up new config
4. ✅ Provision a tenant (use database method)
5. ✅ Open admin portal (http://localhost:5000)
6. ✅ Watch for notification bell badge!

The infrastructure is ready, workflows are implemented, and the admin portal is running. You'll see notifications as soon as you provision a tenant!

---

**Quick Links**:
- Novu Dashboard: http://localhost:14200
- Admin Portal: http://localhost:5000
- Tenant Management API: http://localhost:14000
- Temporal UI: http://localhost:8088
- Keycloak: http://localhost:8080
