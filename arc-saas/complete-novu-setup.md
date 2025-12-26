# Complete Novu Setup - Final Steps

## Current Status ✅

All infrastructure is ready:
- ✅ Novu API: http://localhost:13100 (healthy)
- ✅ Novu Dashboard: http://localhost:14200
- ✅ Admin Portal: http://localhost:5000
- ✅ All services running

## Steps to Complete (Follow in Order)

### Step 1: Access Novu Dashboard & Get Credentials

1. **Open Novu Dashboard**: http://localhost:14200

2. **Create Account** (first time only):
   - Click "Sign Up"
   - Enter email: `admin@arc-saas.local`
   - Enter password: (your choice)
   - Click "Create Account"

3. **Get Your Credentials**:
   - After logging in, click your profile icon (bottom left)
   - Go to **Settings** → **API Keys**
   - You'll see:
     - **Application Identifier**: (e.g., `675198f58b9a65c8a5d55bb3`)
     - **API Key**: (long string starting with letters/numbers)
   - **IMPORTANT**: Copy both values and save them

### Step 2: Create Notification Workflows

#### Create Workflow 1: tenant-welcome

1. In Novu Dashboard, click **Workflows** (left sidebar)
2. Click **Create Workflow** button
3. Select **Blank Workflow**
4. Fill in:
   - **Name**: `tenant-welcome`
   - **Identifier**: `tenant-welcome` (auto-filled)
   - **Description**: `Welcome notification for newly provisioned tenants`
5. Click **Create Workflow**

6. **Add In-App Notification Step**:
   - Click **+ Add Step**
   - Select **In-App**
   - In the editor, paste this content:
   ```
   Welcome to {{tenantName}}! 🎉

   Your tenant has been successfully provisioned and is ready to use.

   **Account Details:**
   - Tenant ID: {{tenantId}}
   - Admin: {{firstName}} {{lastName}}
   - Email: {{email}}

   **Access Your Tenant:**
   - App URL: {{appPlaneUrl}}
   - Admin Portal: {{adminPortalUrl}}

   Click the button below to get started!
   ```

7. **Add Call-to-Action Button**:
   - Scroll down to **Action** section
   - Toggle **Add action** to ON
   - **Primary Action**:
     - Label: `Go to Dashboard`
     - URL: `{{appPlaneUrl}}`
   - Click **Update Step**

8. **Activate the workflow**:
   - At the top of the page, toggle **Active** to ON
   - Click **Update** (if prompted)

#### Create Workflow 2: tenant-provisioning-failed

1. Click **Workflows** → **Create Workflow**
2. Select **Blank Workflow**
3. Fill in:
   - **Name**: `tenant-provisioning-failed`
   - **Identifier**: `tenant-provisioning-failed`
   - **Description**: `Error notification when tenant provisioning fails`
4. Click **Create Workflow**

5. **Add In-App Notification Step**:
   - Click **+ Add Step** → **In-App**
   - Paste this content:
   ```
   ⚠️ Tenant Provisioning Failed

   Unfortunately, provisioning for {{tenantName}} encountered an error.

   **Error Information:**
   - Failed at step: {{failedStep}}
   - Error message: {{error}}

   Our support team has been notified. Please contact support if you need immediate assistance.
   ```

6. **Add Call-to-Action**:
   - **Primary Action**:
     - Label: `Contact Support`
     - URL: `mailto:support@arc-saas.local`
   - Click **Update Step**

7. **Activate**:
   - Toggle **Active** to ON
   - Click **Update**

### Step 3: Update Configuration Files

Now that you have your Novu credentials, update the config files:

#### Update temporal-worker-service

```bash
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/temporal-worker-service
```

Edit `.env` file and update:
```bash
NOVU_API_KEY=<paste-your-api-key-here>
```

Save the file.

#### Update admin-app

```bash
cd e:/Work/Ananta-Platform-Saas/arc-saas/apps/admin-app
```

Edit `.env` file and update:
```bash
VITE_NOVU_APP_IDENTIFIER=<paste-your-app-identifier-here>
```

Save the file.

### Step 4: Restart Services

After updating configuration, restart the affected services:

```bash
# Restart temporal worker
# Kill the existing process (check task manager or use pkill)
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/temporal-worker-service
npm run start:worker

# Restart admin app
# Kill the existing process
cd e:/Work/Ananta-Platform-Saas/arc-saas/apps/admin-app
npm run dev
```

### Step 5: Provision a Test Tenant

Now let's provision a tenant to test notifications:

```bash
# Step 5.1: Create tenant in database
docker exec arc-saas-postgres psql -U postgres -d arc_saas <<SQL
BEGIN;

INSERT INTO main.tenants (id, key, name, status, created_on, modified_on)
VALUES (
  'cc000000-0000-0000-0000-000000000001',
  'democorp',
  'Demo Corporation',
  1,  -- PENDING_PROVISION
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET status = 1;

INSERT INTO main.contacts (
  id, tenant_id, email, first_name, last_name, is_primary, created_on
)
VALUES (
  gen_random_uuid(),
  'cc000000-0000-0000-0000-000000000001',
  'admin@democorp.com',
  'Demo',
  'Admin',
  true,
  NOW()
)
ON CONFLICT DO NOTHING;

COMMIT;
SQL

# Step 5.2: Generate admin JWT
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/tenant-management-service
ADMIN_JWT=$(node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({id: 'admin', userTenantId: 'admin', permissions: ['10216']}, 'your-jwt-secret-key-here', {expiresIn: '1h', issuer: 'arc-saas'}));")

echo "JWT Token: $ADMIN_JWT"

# Step 5.3: Trigger provisioning
curl -v -X POST "http://localhost:14000/tenants/cc000000-0000-0000-0000-000000000001/provision" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "sub-democorp-001",
    "subscriberId": "cc000000-0000-0000-0000-000000000001",
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

### Step 6: Watch the Notification! 🔔

1. **Open Admin Portal**: http://localhost:5000

2. **Look for the notification bell** (top right corner of the page)

3. **Within 10-20 seconds** after provisioning starts:
   - The bell icon will show a **red badge** with number "1"
   - This means you have 1 unread notification!

4. **Click the bell icon**:
   - A popover will open
   - You'll see the "Welcome to Demo Corporation!" notification
   - With all the tenant details
   - And a "Go to Dashboard" button

5. **Verify in Novu Dashboard**:
   - Go to http://localhost:14200
   - Click **Activity Feed** (left sidebar)
   - You should see the notification event with status "Sent"

### Step 7: Verify Everything Worked

Check all the pieces:

```bash
# Check Temporal workflow
temporal workflow list --namespace arc-saas --query "WorkflowId='provision-tenant-cc000000-0000-0000-0000-000000000001'"

# Check tenant status
docker exec arc-saas-postgres psql -U postgres -d arc_saas \
  -c "SELECT id, key, name, status FROM main.tenants WHERE key = 'democorp';"
# Status should be 2 (ACTIVE)

# Check Keycloak realm
curl -s http://localhost:8180/realms/tenant-democorp/.well-known/openid-configuration | jq -r '.issuer'
# Should return: http://localhost:8180/realms/tenant-democorp
```

## Troubleshooting

### Notification Not Appearing

**Check Novu Activity Feed**:
1. Go to http://localhost:14200 → Activity Feed
2. Look for the notification
3. Check its status (Sent/Failed/Pending)
4. Click on it to see details and any errors

**Check Browser Console**:
1. Open admin portal: http://localhost:5000
2. Press F12 to open Developer Tools
3. Go to Console tab
4. Look for any Novu-related errors

**Check Worker Logs**:
```bash
# Look for Novu-related log messages
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/temporal-worker-service
# Check the terminal where worker is running
# Look for: "Novu notification sent successfully" or error messages
```

**Verify Subscriber Created**:
1. Go to Novu Dashboard → Subscribers
2. Search for: `tenant-cc000000-0000-0000-0000-000000000001`
3. If not found, subscriber creation failed

### Workflow Not Starting

**Check tenant-management-service logs**:
```bash
# Look for errors in the service logs
```

**Verify tenant exists**:
```bash
docker exec arc-saas-postgres psql -U postgres -d arc_saas \
  -c "SELECT * FROM main.tenants WHERE id = 'cc000000-0000-0000-0000-000000000001';"
```

## Success Checklist ✅

- [ ] Novu Dashboard account created
- [ ] App Identifier and API Key obtained
- [ ] `tenant-welcome` workflow created and activated
- [ ] `tenant-provisioning-failed` workflow created and activated
- [ ] temporal-worker-service `.env` updated with API Key
- [ ] admin-app `.env` updated with App Identifier
- [ ] Services restarted
- [ ] Tenant provisioned successfully
- [ ] Temporal workflow completed (status: COMPLETED)
- [ ] Keycloak realm created (tenant-democorp)
- [ ] **Notification bell shows red badge in admin portal**
- [ ] **Notification appears in popover when bell is clicked**
- [ ] Notification visible in Novu Activity Feed

## What You Should See

### In Admin Portal (http://localhost:5000)

```
┌─────────────────────────────────────┐
│  Arc SaaS Admin Portal              │
│                                  🔔¹│  ← Red badge with "1"
└─────────────────────────────────────┘
```

When you click the bell:

```
┌─────────────────────────────────┐
│ Notifications                   │
├─────────────────────────────────┤
│ 🎉 Welcome to Demo Corporation! │
│                                 │
│ Your tenant has been success... │
│ • Tenant ID: cc00000...        │
│ • Admin: Demo Admin            │
│                                 │
│ [Go to Dashboard]              │
│                                 │
│ 2 minutes ago                  │
└─────────────────────────────────┘
```

### In Novu Activity Feed

You'll see an entry like:
```
tenant-welcome
Sent to: tenant-cc000000-0000-0000-0000-000000000001-admin_democorp_com
Status: ✅ Sent
Time: Just now
```

## Summary

Once you complete these steps, you'll have:
1. ✅ Working notification system
2. ✅ Real-time in-app notifications
3. ✅ Visual notification bell with badge
4. ✅ Complete tenant provisioning with notifications
5. ✅ Full observability via Novu Dashboard

The system is production-ready for sending notifications whenever tenants are provisioned!

---

**Need Help?**
- Novu Documentation: https://docs.novu.co
- Novu Dashboard: http://localhost:14200
- Admin Portal: http://localhost:5000
