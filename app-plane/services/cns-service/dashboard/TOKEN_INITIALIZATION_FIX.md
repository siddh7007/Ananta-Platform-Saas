# Admin Token Initialization Race Condition Fix

## Problem Statement

The CNS Dashboard had a race condition where the app would start rendering and making API calls before the admin token was properly initialized. This caused intermittent 401 errors on page load, especially visible in the Enrichment Monitor and other polling components.

### Symptoms
- Random 401 errors on initial page load
- Components polling APIs before authentication ready
- Inconsistent behavior between page refreshes
- No user feedback when connection problems occur

## Solution Overview

The fix implements a three-layer approach:

1. **Blocking Token Initialization** - App waits for token before rendering
2. **Failure Tracking & Notifications** - Polling hook tracks failures and notifies users
3. **Connection Status UI** - Visual indicators show connection health

## Changes Made

### 1. App.tsx - Token Initialization Blocking

**File**: `src/App.tsx`

**Changes**:
- Added `tokenReady` and `initError` state to both Auth0App and KeycloakApp
- Block rendering until `ensureDefaultAdminToken()` completes
- Show loading screen with accessibility attributes during initialization
- Display warning banner if token initialization fails (degraded mode)
- App still renders with degraded functionality to allow recovery

**Key Code**:
```typescript
const [tokenReady, setTokenReady] = React.useState(false);
const [initError, setInitError] = React.useState<string | null>(null);

useEffect(() => {
  ensureDefaultAdminToken()
    .then(() => {
      console.log('[App] Admin token initialized successfully');
      setTokenReady(true);
    })
    .catch((err: Error) => {
      console.error('[App] Failed to initialize admin token:', err);
      setInitError(err.message || 'Failed to initialize admin token');
      setTokenReady(true); // Still show app with degraded functionality
    });
}, []);

if (!tokenReady) {
  return <LoadingScreen />;
}
```

### 2. useEnrichmentPolling.ts - Failure Tracking

**File**: `src/hooks/useEnrichmentPolling.ts`

**Changes**:
- Added `failureCount`, `lastUpdate`, `isConnected` state tracking
- Increments failure count on each error
- Marks as disconnected after 3 consecutive failures
- Resets failure tracking on successful fetch
- Returns connection health metadata to consumers

**New Return Values**:
```typescript
interface UseEnrichmentPollingReturn {
  // Existing...
  state: EnrichmentState | null;
  isPolling: boolean;
  error: Error | null;

  // New connection health tracking
  failureCount: number;        // Consecutive failures
  lastUpdate: Date | null;     // Timestamp of last success
  isConnected: boolean;        // Healthy connection (< 3 failures)
}
```

**Error Handling**:
```typescript
catch (err) {
  const newCount = failureCount + 1;
  setFailureCount(newCount);

  if (newCount >= 3) {
    setIsConnected(false);
    // Consumer will show notification via isConnected state
  }

  console.error(`[CNS Polling] Error (attempt ${newCount}):`, err);
  setError(err instanceof Error ? err : new Error('Failed to fetch enrichment status'));
}
```

### 3. ConnectionStatusBadge.tsx - Visual Indicator

**File**: `src/components/shared/ConnectionStatusBadge.tsx` (NEW)

**Features**:
- Live indicator with pulsing animation when connected
- "Connection Lost" badge when disconnected
- Tooltip shows failure count and "last updated" timestamp
- Accessible with ARIA labels
- Two size variants (small, medium)

**Usage**:
```typescript
<ConnectionStatusBadge
  isConnected={isConnected}
  failureCount={failureCount}
  lastUpdate={lastUpdate}
  isPolling={isPolling}
/>
```

### 4. EnrichmentStatusMonitor.tsx - Example Implementation

**File**: `src/components/shared/EnrichmentStatusMonitor.tsx` (NEW)

**Features**:
- Combines polling hook with ConnectionStatusBadge
- Shows progress bar during enrichment
- Displays error alerts when disconnected
- Demonstrates best practices for using the enhanced hook

**Usage**:
```typescript
<EnrichmentStatusMonitor
  bomId="123-456"
  showConnectionStatus={true}
  showProgress={true}
  onError={(err, count) => {
    console.error(`Connection failed ${count} times:`, err);
  }}
  onCompleted={(state) => {
    console.log('Enrichment completed!', state);
  }}
/>
```

### 5. LoadingState.tsx - Enhanced Loading UI

**File**: `src/components/shared/LoadingState.tsx`

**Changes**:
- Added `fullScreen` prop for app-level loading overlays
- Added `subtitle` prop for additional context
- Enhanced accessibility with `role="status"` and `aria-live`
- Full-screen variant creates fixed overlay with high z-index

**Usage**:
```typescript
// App initialization
<PageLoading
  fullScreen
  message="Initializing dashboard..."
  subtitle="Setting up authentication and connecting to services"
/>

// Page-level loading
<PageLoading
  message="Loading enrichment status..."
  fullHeight={true}
/>
```

## Files Created

1. `src/components/shared/ConnectionStatusBadge.tsx` - Connection status UI component
2. `src/components/shared/EnrichmentStatusMonitor.tsx` - Example polling implementation
3. `TOKEN_INITIALIZATION_FIX.md` - This documentation

## Files Modified

1. `src/App.tsx` - Token initialization blocking (lines 1, 288-391, 397-485)
2. `src/hooks/useEnrichmentPolling.ts` - Failure tracking (lines 42-58, 75-84, 161-213, 260-270)
3. `src/components/shared/LoadingState.tsx` - Enhanced loading UI (lines 23-89)

## Testing Instructions

### 1. Test Token Initialization

**Scenario**: Verify app waits for token before rendering

```bash
# 1. Clear localStorage
# Open browser DevTools → Application → Storage → Clear site data

# 2. Start dashboard
cd app-plane/services/cns-service/dashboard
bun run dev

# 3. Open http://localhost:27810
# Expected: See "Initializing dashboard..." screen briefly
# Then: Normal dashboard loads after token ready
```

**Verify**:
- No 401 errors in console during initial load
- Console shows: `[App] Admin token initialized successfully`
- Loading screen displays with spinner and message

### 2. Test Token Initialization Failure

**Scenario**: Verify graceful degradation when token fetch fails

```bash
# 1. Stop CNS API service (to simulate token endpoint failure)
docker stop app-plane-cns-service

# 2. Clear localStorage and refresh dashboard
# Expected: See warning banner at top:
# "Warning: Dashboard initialized with limited functionality: ..."

# 3. Restart CNS API
docker start app-plane-cns-service
```

**Verify**:
- App still renders (not stuck on loading)
- Warning banner shows clear error message
- Suggests user refresh the page

### 3. Test Polling Failure Tracking

**Scenario**: Verify connection status badge and error notifications

```bash
# 1. Start dashboard and navigate to Enrichment Monitor or BOM Upload
# 2. Ensure enrichment is running (upload a BOM)
# 3. Verify "Live" badge shows with pulsing animation
# 4. Stop CNS API while enrichment is running:
docker stop app-plane-cns-service

# Expected after ~6 seconds (3 failures @ 2s interval):
# - Badge changes to "Connection Lost" (red)
# - Error alert appears: "Unable to fetch enrichment status..."
# - Tooltip shows failure count and "Last updated: X minutes ago"

# 5. Restart CNS API:
docker start app-plane-cns-service

# Expected within 2 seconds:
# - Badge returns to "Live" (green with pulse)
# - Error alert disappears
# - "Last updated" timestamp refreshes
```

**Verify**:
- Failure count increments correctly (check tooltip)
- Only ONE notification shown (not spamming every 2 seconds)
- Connection auto-recovers when API returns

### 4. Test Full Integration

**Scenario**: End-to-end BOM upload with enrichment monitoring

```bash
# 1. Start all App Plane services
cd app-plane
docker-compose up -d

# 2. Navigate to CNS Dashboard → BOM Upload
http://localhost:27810/bom-upload

# 3. Upload a CSV with 50+ rows
# 4. Watch enrichment progress with connection status

# Expected:
# - "Live" badge pulses during enrichment
# - Progress bar updates every 2 seconds
# - If API hiccups (network issues), badge turns red
# - Auto-recovers when connection restored
# - Completes successfully with 100% progress
```

**Verify in DevTools Console**:
```
[App] Admin token initialized successfully
[CNS Polling] Starting polling for BOM xxx-xxx-xxx
[CNS Polling] Status: enriching (10/50 enriched, 40 pending)
[CNS Polling] Status: enriching (25/50 enriched, 25 pending)
[CNS Polling] Enrichment completed
```

### 5. Test Accessibility

**Scenario**: Verify screen reader compatibility

```bash
# Use browser's accessibility inspector (Chrome DevTools → Accessibility)

# 1. Check loading screen:
# - Has role="status"
# - Has aria-live="polite"
# - Has aria-label="Initializing dashboard"

# 2. Check ConnectionStatusBadge:
# - Has aria-label="Connection status: connected" (or disconnected)
# - Tooltip has proper focus behavior

# 3. Check error alerts:
# - Have role="alert"
# - Have aria-live="polite"
```

**Verify**:
- All interactive elements are keyboard accessible
- Screen reader announces status changes
- Loading states are properly conveyed

## Backward Compatibility

All changes are **backward compatible**:

1. **useEnrichmentPolling** - Existing usage still works, new properties are optional
2. **PageLoading** - New props are optional, defaults match old behavior
3. **App.tsx** - Only internal changes, no API changes

**Existing consumers**: No code changes required, but they can optionally use new features:

```typescript
// Before (still works)
const { state, isPolling } = useEnrichmentPolling({ bomId });

// After (enhanced, but optional)
const { state, isPolling, isConnected, failureCount, lastUpdate } = useEnrichmentPolling({ bomId });
```

## Performance Impact

- **Token initialization**: Adds ~100-300ms on initial page load (one-time HTTP request)
- **Polling**: No change to polling interval or request frequency
- **UI rendering**: Negligible - connection status badge is lightweight

## Security Considerations

- Token is still stored in localStorage (existing behavior, unchanged)
- No new security risks introduced
- Error messages don't expose sensitive information
- Admin token remains required for all API calls

## Future Enhancements

Potential improvements for future iterations:

1. **Retry Logic**: Add exponential backoff for polling failures
2. **Offline Mode**: Detect network offline and show appropriate UI
3. **Token Refresh**: Auto-refresh admin token before expiration
4. **Telemetry**: Track connection health metrics for monitoring
5. **User Preferences**: Allow users to disable/configure polling

## Troubleshooting

### Issue: Still seeing 401 errors on load

**Solution**:
```bash
# 1. Hard refresh to clear cache
Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

# 2. Clear application data
DevTools → Application → Storage → Clear site data

# 3. Verify admin token is set
localStorage.getItem('cns_admin_api_token')
# Should return a JWT token string

# 4. Check CNS API is running
curl http://localhost:27800/api/health
# Should return 200 OK
```

### Issue: Connection status always shows "Connection Lost"

**Check**:
1. CNS API is running: `docker ps | grep cns-service`
2. CORS is configured: Check CNS API logs for CORS errors
3. Admin token is valid: Check network tab for 401 responses
4. Polling is enabled: Check `enabled` prop is not `false`

### Issue: Loading screen never disappears

**Debug**:
```javascript
// Open browser console and check:
console.log('Token ready:', tokenReady);
console.log('Init error:', initError);

// If stuck, check network tab for /admin/default-token request
// - Should return 200 with { token: "..." }
// - If 404, ensure CNS_ADMIN_TOKEN env var is set
```

## Related Files

- `src/utils/adminToken.ts` - Token fetching logic
- `src/config/api.ts` - API configuration and token headers
- `src/contexts/NotificationContext.tsx` - Global notification system
- `src/hooks/useEnrichmentPolling.ts` - Polling hook

## Migration Guide

If you have existing components using `useEnrichmentPolling`:

### Step 1: Add NotificationProvider (if needed)

```typescript
import { useNotification } from '@/contexts/NotificationContext';

const { showError } = useNotification();
```

### Step 2: Update polling hook usage

```typescript
// Before
const { state, error } = useEnrichmentPolling({ bomId });

// After (with connection monitoring)
const {
  state,
  error,
  isConnected,
  failureCount,
  lastUpdate
} = useEnrichmentPolling({ bomId });

// Show notification when disconnected
useEffect(() => {
  if (!isConnected && failureCount >= 3) {
    showError('Unable to fetch enrichment status. Please check your connection.');
  }
}, [isConnected, failureCount, showError]);
```

### Step 3: Add connection status badge (optional)

```typescript
import { ConnectionStatusBadge } from '@/components/shared/ConnectionStatusBadge';

// In your component render:
<ConnectionStatusBadge
  isConnected={isConnected}
  failureCount={failureCount}
  lastUpdate={lastUpdate}
  isPolling={isPolling}
/>
```

## Summary

This fix ensures reliable app initialization and provides clear user feedback when connectivity issues occur. The three-layer approach (blocking init, failure tracking, visual indicators) creates a robust and user-friendly experience while maintaining backward compatibility.

**Key Improvements**:
- No more 401 errors on initial load
- Clear visual feedback during connection issues
- Automatic recovery when connection restored
- Accessible UI for all users
- Zero breaking changes for existing code
