# Cross-Tab Session Sync - Test Plan

## Overview
The AuthContext now supports cross-tab logout synchronization using BroadcastChannel API.

## Changes Made

### File: `src/contexts/AuthContext.tsx`

1. **Added BroadcastChannel listener** (lines 184-210):
   - Creates a `BroadcastChannel` named `cbp-auth-sync`
   - Listens for `LOGOUT` events from other tabs
   - Clears user state (`setUser(null)`) when logout event received
   - Includes browser compatibility check (Safari < 15.4 doesn't support BroadcastChannel)
   - Properly cleans up channel on component unmount

2. **Enhanced logout function** (lines 221-236):
   - Broadcasts `{ type: 'LOGOUT' }` message to all other tabs BEFORE signing out
   - Creates temporary channel, sends message, and closes it
   - Maintains existing `userManager.signoutRedirect()` behavior

## How to Test Cross-Tab Sync

### Prerequisites
- Customer Portal running on http://localhost:27100
- Valid Keycloak user credentials
- Modern browser (Chrome, Firefox, Edge, Safari 15.4+)

### Test Steps

1. **Open Two Tabs**:
   ```
   Tab 1: http://localhost:27100
   Tab 2: http://localhost:27100
   ```

2. **Login in Both Tabs**:
   - Navigate to the login page in both tabs
   - Login with the same user credentials
   - Verify both tabs show authenticated state (user dashboard/home page)

3. **Open Browser DevTools Console**:
   - Open DevTools (F12) in BOTH tabs
   - Switch to Console tab in both
   - You'll see `[Auth]` log messages

4. **Logout from Tab 1**:
   - Click the logout button in Tab 1
   - Watch the console output

5. **Expected Behavior**:

   **Tab 1 Console:**
   ```
   (Logout button clicked)
   Broadcasting logout to other tabs...
   ```

   **Tab 2 Console:**
   ```
   [Auth] Logout event received from another tab
   ```

   **Tab 2 UI:**
   - User state should clear immediately
   - Should redirect to login page (or show logged-out state)
   - Should NOT require manual logout

6. **Verify Clean State**:
   - Both tabs should show logged-out state
   - No stale user information should remain
   - Both tabs should redirect to login or show public pages

### Browser Compatibility Testing

**Supported Browsers:**
- Chrome 54+
- Firefox 38+
- Edge 79+
- Safari 15.4+
- Opera 41+

**Unsupported Browsers (graceful degradation):**
- Safari < 15.4
- IE 11 (not supported by React 18 anyway)

**Expected behavior in unsupported browsers:**
- Console warning: `[Auth] BroadcastChannel not supported - cross-tab logout sync disabled`
- Logout in one tab does NOT sync to other tabs
- Each tab must logout independently
- No errors or crashes - app continues to function normally

### Edge Cases to Test

1. **Three or more tabs**:
   - Open 3+ tabs with the same app
   - Logout from any one tab
   - Verify ALL other tabs sync immediately

2. **Rapid logout/login**:
   - Login in Tab 1
   - Immediately logout
   - Check that Tab 2 doesn't show inconsistent state

3. **Network interruption**:
   - Disconnect network
   - Logout in Tab 1
   - Verify Tab 2 still syncs (BroadcastChannel works offline)

4. **Private/Incognito windows**:
   - BroadcastChannel does NOT sync between normal and incognito windows
   - This is expected browser behavior
   - Each window group should sync independently

## Technical Details

### BroadcastChannel API
- **Channel Name**: `cbp-auth-sync`
- **Message Format**: `{ type: 'LOGOUT' }`
- **Scope**: Same origin (protocol + domain + port)
- **Performance**: Near-instant (< 1ms latency)
- **Storage**: No storage - messages are ephemeral

### Security Considerations
- BroadcastChannel only works within same origin
- No cross-origin leakage possible
- Message validation checks `event.data?.type === 'LOGOUT'`
- No sensitive data transmitted (only logout signal)

### Integration with oidc-client-ts
- Token storage/refresh handled by oidc-client-ts via localStorage
- localStorage changes already trigger storage events across tabs
- BroadcastChannel adds explicit logout coordination
- Ensures UI state syncs immediately (not just token state)

## Rollback Plan

If issues arise, revert to previous implementation by removing:
1. The BroadcastChannel useEffect (lines 184-210)
2. The broadcast logic in logout function (lines 223-229)

The app will still function normally with oidc-client-ts built-in localStorage sync.
