# Novu Notification Center Integration Summary

## Overview

Integrated Novu notification center into the Customer Portal (CBP) to provide real-time notifications to users.

## Files Created

### 1. Components

| File | Purpose |
|------|---------|
| `src/components/ui/popover.tsx` | Radix UI popover component (required for notification center) |
| `src/components/notifications/NotificationCenter.tsx` | Main Novu wrapper component |
| `src/components/notifications/NotificationBell.tsx` | Bell icon with unread count badge |
| `src/components/notifications/index.ts` | Component exports |
| `src/components/notifications/README.md` | Component documentation |

### 2. Context

| File | Purpose |
|------|---------|
| `src/contexts/NotificationContext.tsx` | Optional context provider for future extensions |

### 3. Documentation

| File | Purpose |
|------|---------|
| `NOVU_SETUP.md` | Step-by-step setup guide |
| `NOVU_INTEGRATION_SUMMARY.md` | This summary document |

## Files Modified

| File | Changes |
|------|---------|
| `src/components/layout/Layout.tsx` | Added NotificationCenter component to header |
| `.env.example` | Added Novu configuration variables |

## Required Installation

**CRITICAL**: The `@novu/notification-center` package is **NOT YET INSTALLED**.

You must install it before the application will run:

```bash
cd arc-saas/apps/customer-portal
bun add @novu/notification-center
# or
npm install @novu/notification-center
```

## Environment Variables Added

```env
# Novu Notification Configuration
VITE_NOVU_APP_IDENTIFIER=6931905380e6f7e26e0ddaad
VITE_NOVU_API_URL=http://localhost:13100
VITE_NOVU_WS_URL=http://localhost:13101
```

## How It Works

### Architecture

```
User logs in → AuthContext provides user.id
                    ↓
        Layout.tsx renders NotificationCenter
                    ↓
        NotificationCenter creates NovuProvider
                    ↓
        subscriberId = user.id (from Keycloak JWT)
                    ↓
        Novu connects via WebSocket (port 13101)
                    ↓
        Bell icon shows unread count badge
                    ↓
        Click bell → Popover shows notification list
```

### User Authentication Flow

1. User authenticates via Keycloak (OIDC)
2. JWT token contains `sub` claim (user ID)
3. `AuthContext` extracts user ID: `idTokenPayload.sub`
4. `NotificationCenter` uses `user.id` as Novu `subscriberId`
5. Novu matches notifications to this subscriber ID

### Notification Delivery

1. Backend triggers notification via Novu API
2. Novu sends notification to subscriber (matched by user ID)
3. WebSocket pushes notification to browser
4. Bell icon updates with unread count
5. User clicks bell to view notification

## UI Integration

### Header Layout (Left to Right)

```
[Menu] ... [NotificationBell] [ThemeSelector] [TenantSelector] [UserAvatar]
```

The notification bell:
- Shows between menu and theme selector
- Displays badge with unread count (e.g., "3")
- Badge is red (`variant="destructive"`)
- Badge shows "99+" if count exceeds 99
- Only renders when user is authenticated

### Styling

- Uses existing Tailwind/Radix theme
- Matches other header icons (same size, spacing)
- Badge uses primary/destructive color scheme
- Popover width: 384px (w-96)
- Aligns to right edge (`align="end"`)

## Testing the Integration

### 1. Install Package

```bash
cd arc-saas/apps/customer-portal
bun add @novu/notification-center
```

### 2. Configure Environment

Copy `.env.example` to `.env` and ensure Novu variables are set.

### 3. Start Services

```bash
# Ensure Novu is running
docker-compose up -d novu-api novu-ws

# Start customer portal
bun run dev
```

### 4. Visual Verification

Navigate to `http://localhost:27100` and log in. You should see:

- ✅ Bell icon in header (between theme selector and tenant selector)
- ✅ No console errors
- ✅ Bell icon clickable
- ✅ WebSocket connection established (check Network tab)

### 5. Send Test Notification

Via Novu dashboard or API:

```bash
curl -X POST http://localhost:13100/v1/events/trigger \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey YOUR_API_KEY" \
  -d '{
    "name": "tenant-welcome",
    "to": {
      "subscriberId": "USER_ID_FROM_JWT"
    },
    "payload": {
      "message": "Test notification"
    }
  }'
```

Expected result:
- ✅ Badge appears on bell icon with count
- ✅ Clicking bell shows notification in popover
- ✅ Notification details are visible

## Available Notification Triggers

Configured in Novu:

| Trigger ID | Description | Use Case |
|------------|-------------|----------|
| `user-invitation` | User invited to team | Team management |
| `tenant-welcome` | New tenant welcome | Onboarding |
| `payment-failed` | Payment failure | Billing alerts |
| `subscription-created` | Subscription created | Subscription management |
| `trial-ending-soon` | Trial ending reminder | Retention |

## Backend Integration Requirements

For notifications to work end-to-end, the backend must:

1. **Create Novu Subscribers**: When users are created/invited
   ```typescript
   await novu.subscribers.identify(user.id, {
     email: user.email,
     firstName: user.firstName,
     lastName: user.lastName,
     data: { tenantId: user.tenantId }
   });
   ```

2. **Trigger Notifications**: When events occur
   ```typescript
   await novu.trigger('user-invitation', {
     to: { subscriberId: invitedUser.id },
     payload: {
       inviterName: currentUser.name,
       tenantName: tenant.name
     }
   });
   ```

## Future Enhancements

### Short Term
- [ ] Add notification preferences UI
- [ ] Implement notification action buttons
- [ ] Add deep linking (click notification → navigate to related page)
- [ ] Track notification read/unread state

### Medium Term
- [ ] Custom notification templates
- [ ] Email delivery channel
- [ ] SMS/Push notifications
- [ ] Notification grouping

### Long Term
- [ ] Multi-channel delivery orchestration
- [ ] Advanced filtering and search
- [ ] Notification analytics dashboard
- [ ] Per-tenant notification customization

## Troubleshooting

### Bell Icon Not Appearing

**Symptom**: No bell icon in header

**Causes**:
1. `@novu/notification-center` not installed
2. User not authenticated
3. Import error in Layout.tsx

**Solution**:
```bash
# Check package is installed
bun list | grep novu

# Check for TypeScript errors
bun run type-check

# Check browser console for errors
```

### Notifications Not Showing

**Symptom**: Bell appears but no notifications

**Causes**:
1. Novu API not running
2. WebSocket connection failed
3. Subscriber not created in Novu
4. User ID mismatch

**Solution**:
```bash
# Verify Novu API
curl http://localhost:13100/v1/health

# Check subscriber exists (via Novu dashboard)
# Verify user.id in browser console matches Novu subscriber ID
```

### Build Errors

**Symptom**: TypeScript compilation errors

**Causes**:
1. Missing type definitions
2. Package version conflicts

**Solution**:
```bash
# Reinstall dependencies
rm -rf node_modules bun.lockb
bun install

# Check for peer dependency warnings
bun install --verbose
```

## Security Considerations

1. **Subscriber ID**: Uses Keycloak user ID (from JWT `sub` claim)
2. **Authentication**: Only shows notifications to authenticated users
3. **Authorization**: Backend must ensure users only receive their own notifications
4. **WebSocket**: Novu handles WebSocket authentication via subscriber ID
5. **XSS Prevention**: React sanitizes notification content by default

## Performance Notes

- **Initial Load**: Fetches notifications on mount (~100ms)
- **WebSocket**: Real-time updates via persistent connection
- **Caching**: Novu caches notifications client-side
- **Lazy Loading**: Notification list paginates automatically
- **Bundle Size**: `@novu/notification-center` adds ~150KB (gzipped)

## Compliance & Privacy

- Notifications stored in Novu (review data retention policy)
- User can manage notification preferences via Novu preference center
- Email notifications subject to email provider terms
- Consider GDPR/privacy requirements for notification content

## Support & Resources

- **Novu Docs**: https://docs.novu.co
- **React Component Docs**: https://docs.novu.co/notification-center/client/react/get-started
- **API Reference**: https://docs.novu.co/api/overview
- **Discord Community**: https://discord.gg/novu

## Summary

✅ **Completed**:
- Created all notification components
- Integrated into Layout header
- Added environment configuration
- Documented setup and usage

⚠️ **Pending**:
- Install `@novu/notification-center` package
- Configure backend to create Novu subscribers
- Set up notification workflows in Novu dashboard
- Test end-to-end notification delivery
