# Novu Notification Center Setup Guide

## Step 1: Install Dependencies

```bash
cd arc-saas/apps/customer-portal

# Using Bun (recommended)
bun add @novu/notification-center

# OR using npm
npm install @novu/notification-center
```

## Step 2: Configure Environment Variables

Copy the values from `.env.example` to your `.env` file:

```env
VITE_NOVU_APP_IDENTIFIER=6931905380e6f7e26e0ddaad
VITE_NOVU_API_URL=http://localhost:13100
VITE_NOVU_WS_URL=http://localhost:13101
```

## Step 3: Start Novu Services

Ensure the Novu API and WebSocket services are running. From the ARC-SaaS root:

```bash
# Start Novu services (if not already running)
docker-compose up -d novu-api novu-ws
```

## Step 4: Start Customer Portal

```bash
cd arc-saas/apps/customer-portal
bun run dev
# or
npm run dev
```

## Step 5: Verify Integration

1. Navigate to `http://localhost:27100`
2. Log in to the customer portal
3. Look for the bell icon in the top header (between theme selector and tenant selector)
4. The bell should render without errors

## Testing Notifications

### Via Novu Dashboard

1. Open Novu dashboard (typically at `http://localhost:13200`)
2. Navigate to "Workflows"
3. Select one of the configured workflows:
   - `user-invitation`
   - `tenant-welcome`
   - `payment-failed`
   - `subscription-created`
   - `trial-ending-soon`
4. Trigger a test notification for your user ID
5. The bell icon should show a badge with the unread count
6. Click the bell to see the notification in the popover

### Via API

```bash
# Send a test notification
curl -X POST http://localhost:13100/v1/events/trigger \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey YOUR_NOVU_API_KEY" \
  -d '{
    "name": "tenant-welcome",
    "to": {
      "subscriberId": "USER_ID_FROM_KEYCLOAK"
    },
    "payload": {
      "tenantName": "Test Tenant",
      "message": "Welcome to the platform!"
    }
  }'
```

## Troubleshooting

### Bell Icon Not Showing

- Check browser console for errors
- Verify `@novu/notification-center` package is installed
- Ensure user is authenticated (check `AuthContext`)

### No Notifications Appearing

- Verify Novu API is running: `curl http://localhost:13100/v1/health`
- Check WebSocket connection: `curl http://localhost:13101`
- Verify subscriber ID matches user ID in Novu dashboard
- Check network tab for WebSocket connection

### Package Installation Errors

If you encounter issues with `@novu/notification-center`:

```bash
# Clear cache and reinstall
rm -rf node_modules bun.lockb
bun install

# Or with npm
rm -rf node_modules package-lock.json
npm install
```

## Integration Details

### Components Created

1. `src/components/notifications/NotificationCenter.tsx` - Main Novu wrapper
2. `src/components/notifications/NotificationBell.tsx` - Bell icon with badge
3. `src/components/notifications/index.ts` - Exports
4. `src/contexts/NotificationContext.tsx` - Context provider (optional, for future use)

### Files Modified

1. `src/components/layout/Layout.tsx` - Added notification bell to header
2. `.env.example` - Added Novu configuration variables
3. `src/components/ui/popover.tsx` - Created (Radix UI popover component)

### How It Works

1. **Authentication**: When user logs in, their ID is extracted from the Keycloak JWT
2. **Subscriber Registration**: User ID is used as `subscriberId` in Novu
3. **Real-time Updates**: WebSocket connection at port 13101 pushes notifications
4. **UI Integration**: Bell icon in header shows unread count and opens popover

### User ID Mapping

The integration uses `user.id` from `AuthContext` as the Novu subscriber ID:

```typescript
// In AuthContext, user.id comes from JWT:
{
  id: string;           // From idTokenPayload.sub (Keycloak subject)
  email: string;
  name: string;
  role: AppRole;
  tenantId?: string;
  accessToken: string;
}
```

Ensure that subscribers in Novu are created with matching IDs (typically done via backend when users are created).

## Next Steps

### Backend Integration

To automatically create Novu subscribers when users register:

1. Add Novu SDK to tenant-management-service
2. Create subscriber on user creation/invitation
3. Set user metadata (email, name, tenant)

### Custom Notification Templates

1. Create custom workflows in Novu dashboard
2. Design email/in-app templates
3. Configure delivery channels (email, in-app, SMS)

### Advanced Features

- **Notification Preferences**: Use Novu's preference center
- **Action Buttons**: Add CTAs to notifications
- **Deep Linking**: Link notifications to specific pages
- **Read Receipts**: Track notification engagement
