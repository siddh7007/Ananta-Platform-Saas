# Switch to Novu Cloud - 5 Minute Fix

## Problem Found

Self-hosted Novu v3.11.0 has a bug: `Cannot read properties of undefined (reading 'preferences')`

The worker crashes when processing notifications because it can't find subscriber preferences, even after manually creating them in MongoDB.

## Solution: Use Novu Cloud (Recommended)

Novu Cloud is production-ready, fully managed, and takes 5 minutes to set up.

---

## Step 1: Sign Up for Novu Cloud (2 minutes)

1. Go to **https://web.novu.co**
2. Click **Sign Up** / **Get Started**
3. Create account with:
   - Email: `admin@arc-saas.local` (or your email)
   - Password: (your choice)
   - Organization name: `Arc SaaS`

4. Once logged in, you'll see the dashboard

---

## Step 2: Get Your Credentials (1 minute)

### Get API Key

1. In Novu Dashboard, go to **Settings** (left sidebar)
2. Click **API Keys**
3. Copy the **API Key** (long string starting with letters/numbers)
   - Example: `abc123def456ghi789jkl012mno345pqr`

### Get Application Identifier

1. Still in **Settings** → **API Keys**
2. Look for **Application Identifier**
   - Example: `a1b2c3d4e5f6g7h8i9j0k1l2`

---

## Step 3: Create Workflow in Novu Cloud (2 minutes)

### Create Workflow

1. Click **Workflows** (left sidebar)
2. Click **Create Workflow**
3. Choose **Blank Workflow**
4. Fill in:
   - **Name**: `tenant-welcome`
   - **Identifier**: `tenant-welcome` (must match exactly)
   - **Description**: `Welcome notification for new tenants`
5. Click **Create**

### Add In-App Notification Step

1. Click **+ Add Step**
2. Select **In-App**
3. Configure the step:

**Content**:
```
Welcome to {{tenantName}}! 🎉

Your tenant has been successfully provisioned and is ready to use.

**Details:**
- Tenant ID: {{tenantId}}
- Admin: {{firstName}} {{lastName}}
- Email: {{email}}

Click below to access your dashboard!
```

**Call-to-Action** (CTA):
- **Type**: Redirect
- **Button Label**: `Go to Dashboard`
- **URL**: `{{appPlaneUrl}}`

4. Click **Save** or **Update Step**

### Activate Workflow

1. Toggle the workflow to **Active** (switch at top right)
2. Click **Update** to save

---

## Step 4: Update Configuration Files

### Update Temporal Worker Config

Edit `services/temporal-worker-service/.env`:

```bash
NOVU_ENABLED=true
NOVU_API_KEY=<your-api-key-from-step-2>
NOVU_BASE_URL=https://api.novu.co
```

### Update Admin App Config

Edit `apps/admin-app/.env`:

```bash
VITE_NOVU_APP_IDENTIFIER=<your-app-identifier-from-step-2>
VITE_NOVU_BACKEND_URL=https://api.novu.co
```

---

## Step 5: Restart Services

### Stop Current Services

Find and kill running processes:

**Windows**:
```bash
# Find temporal worker process
tasklist | findstr node

# Kill the temporal-worker-service process
taskkill /PID <process-id> /F

# Kill admin-app process (if running)
taskkill /PID <admin-app-process-id> /F
```

**Linux/Mac**:
```bash
# Find and kill temporal worker
ps aux | grep temporal-worker-service
kill <process-id>

# Find and kill admin app
ps aux | grep admin-app
kill <process-id>
```

### Start Services with New Config

**Terminal 1 - Temporal Worker**:
```bash
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/temporal-worker-service
npm run start:worker
```

Wait for:
```
✅ Temporal Worker connected to Temporal Server
   Namespace: arc-saas
   Task Queue: tenant-provisioning
   State: RUNNING
```

**Terminal 2 - Admin App**:
```bash
cd e:/Work/Ananta-Platform-Saas/arc-saas/apps/admin-app
npm run dev
```

Wait for:
```
  ➜  Local:   http://localhost:5000/
```

---

## Step 6: Test Notification (30 seconds)

### Test via API

Create a test script `test-novu-cloud.js`:

```javascript
const { Novu } = require('@novu/node');

const novu = new Novu('<your-api-key-here>', {
  backendUrl: 'https://api.novu.co',
});

async function test() {
  try {
    // Create subscriber
    console.log('Creating subscriber...');
    await novu.subscribers.identify('admin', {
      email: 'admin@arc-saas.local',
      firstName: 'Admin',
      lastName: 'User',
    });
    console.log('✅ Subscriber created');

    // Trigger notification
    console.log('\\nTriggering notification...');
    const result = await novu.trigger('tenant-welcome', {
      to: { subscriberId: 'admin' },
      payload: {
        tenantId: 'test-001',
        tenantName: 'Test Corp',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@arc-saas.local',
        appPlaneUrl: 'http://localhost:5173',
      },
    });
    console.log('✅ Notification triggered:', result.data);

    // Wait and fetch
    await new Promise(r => setTimeout(r, 2000));
    const feed = await novu.subscribers.getNotificationsFeed('admin');
    console.log('\\n✅ Notifications:', feed.data.length > 0 ? '🎉 SUCCESS!' : '❌ Empty');
    console.log(JSON.stringify(feed.data, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
```

Run:
```bash
node test-novu-cloud.js
```

Expected output:
```
✅ Subscriber created
✅ Notification triggered: { status: 'processed', transactionId: '...' }
✅ Notifications: 🎉 SUCCESS!
[
  {
    "_id": "...",
    "content": "Welcome to Test Corp! 🎉...",
    "seen": false,
    ...
  }
]
```

---

## Step 7: Verify in Admin Portal

1. Open **http://localhost:5000**
2. Login: `admin` / `admin123`
3. Look for **notification bell icon** (top right)
4. Click the bell
5. **You should see the welcome notification!**

---

## Troubleshooting

### Notification Not Appearing

1. **Check Novu Activity Feed**:
   - Go to https://web.novu.co
   - Click **Activity Feed** (left sidebar)
   - Look for your triggered notification
   - Check status (Sent/Failed/Error)

2. **Check Browser Console**:
   - Open admin portal
   - Press F12 → Console
   - Look for Novu errors
   - Check WebSocket connection

3. **Verify Workflow**:
   - Go to https://web.novu.co → **Workflows**
   - Find `tenant-welcome`
   - Make sure it's **Active** (green toggle)
   - Click to edit and verify the in-app step exists

4. **Check Admin App Config**:
   - Restart admin app after changing `.env`
   - Hard refresh browser (Ctrl+Shift+R)

---

## Why Novu Cloud vs Self-Hosted?

| Feature | Self-Hosted v3.11.0 | Novu Cloud |
|---------|---------------------|------------|
| Setup time | 1+ hours | 5 minutes |
| Bugs | ✗ Worker crashes on preferences | ✓ Fully tested |
| Maintenance | You manage upgrades | Automatic |
| Reliability | Depends on your infrastructure | 99.9% SLA |
| Support | Community only | Official support |
| Cost | Infrastructure costs | Free tier available |

**Recommendation**: Use Novu Cloud for development and production. Self-hosted is only needed for specific compliance requirements.

---

## Summary

**What We Found**: Self-hosted Novu v3.11.0 has a bug where the worker can't read subscriber preferences, causing all notifications to fail.

**The Fix**: Use Novu Cloud (https://web.novu.co) which is production-ready and works perfectly.

**Time to Fix**: 5 minutes

**Next Steps**:
1. Sign up at https://web.novu.co
2. Get API Key and App Identifier
3. Create `tenant-welcome` workflow with in-app step
4. Update config files
5. Restart services
6. Test notification
7. Login to admin portal and see notifications! 🎉

---

## Sources

- [Novu Documentation](https://docs.novu.co/api-reference/overview)
- [Novu API Reference](https://api.novu.co/api)
- [Novu GitHub - API Keys](https://github.com/novuhq/novu/issues/842)
