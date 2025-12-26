# Novu Notifications Setup - Arc SaaS

## Overview

The Arc SaaS platform uses **self-hosted Novu** for multi-channel notifications. Novu is fully integrated with the Temporal workflow to send notifications when tenants are provisioned.

## Arc-SaaS Novu Instance

### Services Running

```
âœ… arc-saas-novu-mongo   - MongoDB database (port 27017)
âœ… arc-saas-novu-redis   - Redis cache (port 6380)
âœ… arc-saas-novu-api     - Novu API (port 13100)
âœ… arc-saas-novu-worker  - Background worker
âœ… arc-saas-novu-web     - Web dashboard (port 14200)
```

### Access Points

**Novu Dashboard**: http://localhost:14200
- This is where you configure workflows, templates, and view notification history

**Novu API**: http://localhost:13100
- Used by the temporal-worker-service to send notifications
- Used by admin-app for in-app notification inbox

**Network**: `arc-saas` Docker network
- Internal service URL: `http://novu-api:3000`

## Configuration

### temporal-worker-service

Already configured in `.env`:
```bash
NOVU_ENABLED=true
NOVU_API_KEY=<your-novu-api-key>
# Uses internal Docker network URL
NOVU_BASE_URL=http://novu-api:3000
```

###admin-app

Update `.env` to use arc-saas Novu:
```bash
# Novu Configuration
VITE_NOVU_APP_IDENTIFIER=<your-novu-app-id>
VITE_NOVU_BACKEND_URL=http://localhost:13100

# API Configuration
VITE_API_BASE_URL=http://localhost:14000
VITE_API_URL=http://localhost:14000
```

## Admin Portal Notifications

The admin-app has a **NotificationInbox** component that displays real-time notifications:

### Component Location
[apps/admin-app/src/components/NotificationInbox.tsx](e:/Work/Ananta-Platform-Saas/arc-saas/apps/admin-app/src/components/NotificationInbox.tsx)

### Features
- Bell icon with unseen count badge
- Popover notification center
- Click-to-action support
- Real-time WebSocket updates
- Mark as read functionality

### Usage in Admin App

```tsx
import { NotificationInbox } from '@/components/NotificationInbox';

// In your layout or header component
<NotificationInbox
  subscriberId={user.id}
  subscriberEmail={user.email}
  onNotificationClick={(message) => {
    // Handle notification click
    console.log('Notification clicked:', message);
  }}
/>
```

## Workflow Integration

When a tenant is provisioned, the Temporal workflow sends notifications:

### 1. Welcome Email (on success)

**Workflow**: `tenant-welcome`
**Subscriber**: `tenant-{tenantId}-{sanitizedEmail}`
**Trigger**:
```typescript
await novu.trigger('tenant-welcome', {
  to: {
    subscriberId: `tenant-${tenantId}-${sanitizedEmail}`,
    email: adminEmail,
  },
  payload: {
    tenantId,
    tenantName,
    firstName,
    lastName,
    appPlaneUrl,
    adminPortalUrl,
    loginUrl,
    supportEmail
  }
});
```

### 2. Provisioning Failed Email (on error)

**Workflow**: `tenant-provisioning-failed`
**Subscriber**: `tenant-{tenantId}-{sanitizedEmail}`
**Trigger**:
```typescript
await novu.trigger('tenant-provisioning-failed', {
  to: {
    subscriberId: `tenant-${tenantId}-${sanitizedEmail}`,
    email: adminEmail,
  },
  payload: {
    tenantId,
    tenantName,
    firstName,
    error,
    failedStep,
    supportEmail
  }
});
```

## Setting Up Notification Workflows

### Step 1: Access Novu Dashboard

1. Open http://localhost:14200
2. Create an account or sign in
3. Note the App Identifier (shown in dashboard)

### Step 2: Create Workflow Template

1. Go to **Workflows** â†’ **Create Workflow**
2. Select **In-App** notification channel
3. Add workflow name: `tenant-welcome`
4. Design the template:

```markdown
**Welcome to {{tenantName}}!**

Hi {{firstName}} {{lastName}},

Your tenant has been successfully provisioned!

**App URL**: {{appPlaneUrl}}
**Admin Portal**: {{adminPortalUrl}}
**Login URL**: {{loginUrl}}

Need help? Contact us at {{supportEmail}}
```

5. Add **Email** channel (optional)
6. Save workflow

### Step 3: Get App Identifier

1. Go to **Settings** â†’ **API Keys**
2. Copy the **App Identifier** (looks like: `<your-novu-app-id>`)
3. Copy the **API Key** (looks like: `<your-novu-api-key>`)

### Step 4: Update Configuration

Update `temporal-worker-service/.env`:
```bash
NOVU_API_KEY=<your-api-key-from-dashboard>
```

Update `admin-app/.env`:
```bash
VITE_NOVU_APP_IDENTIFIER=<your-app-identifier>
```

## Testing Notifications

### Manual Test from Novu Dashboard

1. Go to http://localhost:14200
2. Navigate to **Workflows** â†’ `tenant-welcome`
3. Click **Test Workflow**
4. Enter subscriber ID: `test-user-123`
5. Enter payload:
```json
{
  "tenantId": "test-tenant-id",
  "tenantName": "Test Corp",
  "firstName": "John",
  "lastName": "Doe",
  "appPlaneUrl": "https://testcorp.example.com",
  "adminPortalUrl": "https://admin.example.com",
  "loginUrl": "https://testcorp.example.com/login",
  "supportEmail": "support@example.com"
}
```
6. Click **Send Test**

### Test from Temporal Workflow

When you successfully provision a tenant (using the workaround), the workflow will automatically:
1. Create subscriber in Novu
2. Trigger `tenant-welcome` workflow
3. Send notification to subscriber

You can then view the notification in:
- **Novu Dashboard**: http://localhost:14200 â†’ **Activity Feed**
- **Admin App**: Notification bell icon (when admin app is running)

## Starting the Admin App

To see notifications in the admin portal:

```bash
cd e:/Work/Ananta-Platform-Saas/arc-saas/apps/admin-app

# Install dependencies (if not already installed)
npm install

# Start development server
npm run dev
```

The admin app will start on http://localhost:5173 (or next available port).

## Troubleshooting

### Notifications Not Appearing

1. **Check Novu API is accessible**:
```bash
curl http://localhost:13100/v1/health-check
# Should return: {"status":"ok"}
```

2. **Check subscriber exists**:
- Go to Novu Dashboard â†’ Subscribers
- Search for `tenant-{tenantId}-{email}`
- If not found, subscriber creation failed

3. **Check workflow exists**:
- Go to Novu Dashboard â†’ Workflows
- Ensure `tenant-welcome` workflow is created and active

4. **Check worker logs**:
```bash
cd e:/Work/Ananta-Platform-Saas/arc-saas/services/temporal-worker-service
npm run start:worker

# Look for:
# "Novu notification sent successfully"
# Or error messages about Novu
```

5. **Check activity feed**:
- Go to Novu Dashboard â†’ Activity Feed
- See all triggered notifications and their status

### Admin App Not Showing Notifications

1. **Check Novu configuration**:
```bash
cat apps/admin-app/.env | grep NOVU
# Should show:
# VITE_NOVU_APP_IDENTIFIER=<your-novu-app-id>
# VITE_NOVU_BACKEND_URL=http://localhost:13100
```

2. **Check browser console**:
- Open admin app in browser
- Press F12 â†’ Console
- Look for Novu connection errors

3. **Check subscriber ID**:
- The admin app must pass the correct `subscriberId`
- Should match the subscriber created in Novu

4. **Check network**:
```bash
# From admin app
curl http://localhost:13100/v1/health-check
```

## Current Status

### âœ… What's Working

- Self-hosted Novu instance running on arc-saas network
- Novu API accessible at http://localhost:13100
- Novu Dashboard accessible at http://localhost:14200
- temporal-worker-service configured to use Novu
- NotificationInbox component implemented in admin-app

### â³ What Needs Setup

- [ ] Create Novu account in dashboard (http://localhost:14200)
- [ ] Create `tenant-welcome` workflow template
- [ ] Create `tenant-provisioning-failed` workflow template
- [ ] Update admin-app .env with correct app identifier
- [ ] Start admin-app to test notification inbox
- [ ] Test end-to-end notification flow with tenant provisioning

## Next Steps

1. **Access Novu Dashboard**:
   ```
   http://localhost:14200
   ```
   - Create account
   - Note App Identifier and API Key

2. **Create Workflow Templates**:
   - `tenant-welcome` (in-app + email)
   - `tenant-provisioning-failed` (in-app + email)

3. **Update Configuration**:
   - Update `apps/admin-app/.env` with App Identifier
   - Verify `services/temporal-worker-service/.env` has API Key

4. **Start Admin App**:
   ```bash
   cd apps/admin-app
   npm run dev
   ```

5. **Test Tenant Provisioning**:
   - Create tenant (using database workaround)
   - Trigger provisioning
   - Check Novu Dashboard â†’ Activity Feed
   - Check Admin App â†’ Notification Bell

## Summary

**Yes, the admin portal CAN show notifications right now**, but you need to:

1. âœ… Novu is running (DONE)
2. âœ… NotificationInbox component exists (DONE)
3. â³ Create workflow templates in Novu Dashboard (TODO)
4. â³ Update admin-app configuration (TODO)
5. â³ Start the admin-app (TODO)
6. â³ Test with actual tenant provisioning (TODO)

Once you complete the TODO items above, notifications will appear in the admin portal in real-time when tenants are provisioned!

---

**Novu Dashboard**: http://localhost:14200
**Admin App** (after starting): http://localhost:5173
**API Documentation**: https://docs.novu.co
