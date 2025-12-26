# Test Notifications - Ready to Use

## Current Status ✅

Everything is running and ready:

```
✅ Admin Portal: http://localhost:5000
✅ Novu API: http://localhost:13100 (healthy)
✅ Novu Dashboard: http://localhost:14200
✅ Keycloak: http://localhost:8180
✅ Tenant Management API: http://localhost:14000
✅ Temporal Worker: RUNNING
```

## Login Credentials

**Admin Portal** (http://localhost:5000):
```
Username: admin
Password: admin123
```

## Quick Test - Send Notification Now

You can test notifications RIGHT NOW using this command:

### Option 1: Direct Novu API Test (FASTEST)

```bash
# First, get your API key from Novu Dashboard:
# 1. Open http://localhost:14200
# 2. Login or create account
# 3. Go to Settings → API Keys
# 4. Copy the API Key

# Then run:
export NOVU_API_KEY="<your-api-key-here>"

curl -X POST "http://localhost:13100/v1/events/trigger" \
  -H "Authorization: ApiKey $NOVU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "tenant-welcome",
    "to": {
      "subscriberId": "admin"
    },
    "payload": {
      "tenantId": "dd000000-0000-0000-0000-000000000001",
      "tenantName": "Test Corporation",
      "firstName": "Admin",
      "lastName": "User",
      "email": "admin@arc-saas.local",
      "appPlaneUrl": "http://localhost:5173",
      "adminPortalUrl": "http://localhost:5000"
    }
  }'
```

### Option 2: Using Temporal Workflow (via CLI)

```bash
# Install Temporal CLI if not installed
# Windows: choco install temporal
# Mac: brew install temporal
# Linux: curl -sSf https://temporal.download/cli.sh | sh

# Trigger tenant provisioning workflow
temporal workflow start \
  --task-queue tenant-provisioning \
  --type provisionTenantWorkflow \
  --workflow-id test-provision-$(date +%s) \
  --namespace arc-saas \
  --input '{
    "tenantId": "test-tenant-001",
    "tenantKey": "testdemo",
    "tenantName": "Test Demo Corp",
    "subscription": {
      "id": "sub-001",
      "planId": "plan-enterprise",
      "tier": "enterprise",
      "startDate": "2025-12-05T00:00:00Z",
      "endDate": "2026-12-05T00:00:00Z",
      "status": 1
    },
    "contact": {
      "email": "demo@testcorp.com",
      "firstName": "Demo",
      "lastName": "Admin"
    }
  }'
```

### Option 3: Using Database + Provisioning Endpoint (WORKAROUND)

Since the REST API has authentication issues, use this Node.js script:

```bash
cd e:/Work/Ananta-Platform-Saas/arc-saas

# Create test script
npx ts-node -e "
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

(async () => {
  // Create admin JWT
  const adminJwt = jwt.sign(
    {
      id: 'admin-user-id',
      userTenantId: 'admin-user-id',
      permissions: ['10204', '10216', '10203', '7008', '7004', '10212', '5321', '5322', '5323', '5324', '5325', '5326', '5327', '5328', '5329', '5331', '5332', '5333', '10220', '10221', '10223', '10222']
    },
    'your-jwt-secret-key-here',
    { expiresIn: '1h', issuer: 'arc-saas' }
  );

  console.log('Admin JWT:', adminJwt);

  // Trigger provisioning
  const response = await fetch('http://localhost:14000/tenants/dd000000-0000-0000-0000-000000000001/provision', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${adminJwt}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: 'sub-testcorp-001',
      subscriberId: 'dd000000-0000-0000-0000-000000000001',
      planId: 'plan-enterprise',
      startDate: '2025-12-05T00:00:00Z',
      endDate: '2026-12-05T00:00:00Z',
      status: 1,
      plan: {
        id: 'plan-enterprise',
        name: 'Enterprise Plan',
        description: 'Enterprise tier',
        price: 999.00,
        currencyId: 'usd',
        tier: 'enterprise',
        billingCycleId: 'annual',
        metaData: { pipelineName: 'enterprise-pipeline' }
      }
    })
  });

  const result = await response.json();
  console.log('Response:', result);
})();
"
```

## Novu Dashboard Setup (5 Minutes)

### Step 1: Create Novu Account

1. Open http://localhost:14200
2. Click "Sign Up" or "Get Started"
3. Fill in:
   - Email: `admin@arc-saas.local`
   - Password: (your choice)
   - Company Name: `Arc SaaS`
4. Click "Create Account"

### Step 2: Get Credentials

1. Go to **Settings** → **API Keys**
2. Copy **Application Identifier** (looks like: `6931905380e6f7e26e0ddaad`)
3. Copy **API Key** (long string starting with letters/numbers)

### Step 3: Create Workflow

1. Click **Workflows** → **Create Workflow**
2. Click **Blank Workflow**
3. Name: `tenant-welcome`
4. Description: `Welcome notification for provisioned tenants`
5. Click **Create Workflow**

6. **Add In-App Notification Step**:
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

7. **Activate Workflow**:
   - Toggle "Active" to ON (top right)
   - Click **Update**

### Step 4: Update Configuration

Update `temporal-worker-service/.env`:
```bash
NOVU_API_KEY=<your-api-key-from-step-2>
```

Update `apps/admin-app/.env`:
```bash
VITE_NOVU_APP_IDENTIFIER=<your-app-identifier-from-step-2>
```

### Step 5: Restart Services

```bash
# Kill and restart temporal worker
# Find the process and kill it (check task manager or ps aux | grep temporal)

cd e:/Work/Ananta-Platform-Saas/arc-saas/services/temporal-worker-service
npm run start:worker

# Restart admin app (if you updated its config)
cd e:/Work/Ananta-Platform-Saas/arc-saas/apps/admin-app
npm run dev
```

## What to Expect

1. **Login to Admin Portal**: http://localhost:5000
   - Username: `admin`
   - Password: `admin123`

2. **Look for Notification Bell**: Top right corner of admin portal

3. **Trigger a Notification**: Use one of the test methods above

4. **See Notification**:
   - Bell icon shows red badge with count
   - Click bell to open notification inbox
   - See welcome notification
   - Click "Go to Dashboard" button

## Verification Checklist

- [ ] Admin portal accessible at http://localhost:5000
- [ ] Login works with admin/admin123
- [ ] Novu Dashboard accessible at http://localhost:14200
- [ ] Novu account created
- [ ] `tenant-welcome` workflow created and active
- [ ] Config files updated with Novu credentials
- [ ] Services restarted
- [ ] Test notification triggered
- [ ] Notification bell shows badge in admin portal
- [ ] Notification inbox shows welcome message

## Troubleshooting

### No Notification Appearing

1. **Check Novu Activity Feed**:
   - Go to http://localhost:14200
   - Click **Activity Feed**
   - Look for triggered notification
   - Check its status (Sent/Failed/Pending)

2. **Check Browser Console**:
   - Open admin portal
   - Press F12 → Console
   - Look for Novu connection errors
   - Check WebSocket connection status

3. **Verify Subscriber ID**:
   - In Novu Dashboard → **Subscribers**
   - Search for subscriber ID used in trigger
   - Should exist with correct email

4. **Check Worker Logs**:
   ```bash
   # Look for Novu notification logs
   cd e:/Work/Ananta-Platform-Saas/arc-saas/services/temporal-worker-service
   # Check running process logs
   ```

## Summary

**Admin Portal**: ✅ READY - Login at http://localhost:5000 (admin/admin123)

**Notifications**: ⏳ 5 MINUTES - Just complete Novu Dashboard setup:
1. Create account at http://localhost:14200
2. Create `tenant-welcome` workflow
3. Update config with API key and App ID
4. Restart services
5. Trigger test notification

All infrastructure is running and ready. The notification system will work as soon as you complete the Novu workflow setup!
