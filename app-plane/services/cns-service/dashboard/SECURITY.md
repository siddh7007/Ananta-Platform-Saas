# CNS Dashboard Security Guide

This document outlines the security configuration, known limitations, and best practices for the CNS Dashboard.

## Security Architecture Overview

The CNS Dashboard uses a dual-authentication model:

1. **UI Authentication**: Auth0 or Keycloak SSO authenticates users at the UI level
2. **API Authorization**: A static admin token (`VITE_CNS_ADMIN_TOKEN`) authorizes API calls

### Known Limitation

The current architecture has a documented security trade-off:

- Auth0/Keycloak authenticates users to access the dashboard UI
- API calls use a static admin token (not the user's Auth0 token)
- This means the CNS API does not validate individual user identity

**Residual Risk**: Anyone who discovers `VITE_CNS_ADMIN_TOKEN` can call the CNS API directly.

**Mitigation**:
- CNS Dashboard is an internal staff tool, not customer-facing
- Network-level restrictions should limit API access
- Enable `AUTH0_ENABLED=true` on CNS backend for full token validation (requires additional configuration)

## Security Features Implemented

### 1. Content Security Policy (CSP)

Located in `index.html`, the CSP restricts:

```
default-src 'self'                              - Only same-origin by default
script-src 'self' 'unsafe-inline' ...           - Scripts from self, Auth0, and Keycloak
style-src 'self' 'unsafe-inline' ...            - Styles from self and Google Fonts
connect-src 'self' http://localhost:* ws://...  - API and WebSocket connections
frame-src 'self' https://*.auth0.com http://... - Auth0 and Keycloak iframes allowed
object-src 'none'                               - No plugins allowed
worker-src 'self' blob:                         - Web Workers from self
frame-ancestors 'self'                          - Prevent clickjacking
```

**Full CSP Directives**:
- `default-src 'self'`
- `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.auth0.com http://localhost:8180`
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
- `font-src 'self' https://fonts.gstatic.com data:`
- `img-src 'self' data: blob: https:`
- `connect-src 'self' http://localhost:* ws://localhost:* https://*.auth0.com wss://*.auth0.com`
- `frame-src 'self' https://*.auth0.com http://localhost:8180`
- `object-src 'none'`
- `worker-src 'self' blob:`
- `base-uri 'self'`
- `form-action 'self' http://localhost:8180`
- `frame-ancestors 'self'`

**Note**: `http://localhost:8180` is added for Keycloak SSO in development. For production, replace with your Keycloak domain (e.g., `https://keycloak.example.com`).

### 2. Session Timeout

Automatic logout after inactivity, configurable via environment variables:

| Variable | Default | Range | Description |
|----------|---------|-------|-------------|
| `VITE_SESSION_TIMEOUT_ENABLED` | `true` | - | Enable/disable session timeout |
| `VITE_SESSION_TIMEOUT_MINUTES` | `30` | 5-480 | Minutes before logout (OWASP: 15-30 min) |
| `VITE_SESSION_WARNING_MINUTES` | `5` | 1-60 | Warning before logout |

**Features**:
- Cross-tab synchronization via BroadcastChannel API
- localStorage fallback for browsers without BroadcastChannel
- Activity detection (mouse, keyboard, touch, scroll, click)
- Warning notification before logout (uses custom NotificationContext)
- Automatic token cleanup on timeout (removes `cns_admin_api_token`)
- Visibility change detection (checks timeout when tab becomes visible)
- Configuration validation with range checks and warnings

**Architecture**:
```
SessionTimeoutProvider (React Component)
    └── useSessionTimeout (React Hook)
            └── createSessionTimeout (Vanilla JS utility)
                    ├── BroadcastChannel (cross-tab sync)
                    ├── localStorage (persistence)
                    └── Event listeners (activity detection)
```

### 3. Security Headers (Development)

The Vite dev server adds these headers via custom plugin (`vite.config.ts`):

- `X-Content-Type-Options: nosniff` - Prevent MIME sniffing
- `X-Frame-Options: SAMEORIGIN` - Prevent clickjacking
- `X-XSS-Protection: 1; mode=block` - Legacy XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` - Limit referrer info
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()` - Disable sensitive APIs

### 4. CORS Restrictions

Development server CORS is restricted to known origins:
- `http://localhost:27710` (Dashboard dev server)
- `http://localhost:27500` (Traefik gateway)
- `http://localhost:27800` (CNS API)

### 5. Token Management

On session timeout or logout, the following are cleared:
- `localStorage['cns_last_activity']` - Session activity tracking
- `localStorage['cns_admin_api_token']` - Admin API token

## Component Hierarchy

The session timeout must be placed correctly in the React component tree:

```tsx
<TenantProvider>
  <NotificationProvider>        {/* Required for warning notifications */}
    <SessionTimeoutProvider>    {/* Uses NotificationContext, NOT react-admin */}
      <Admin>                   {/* React Admin - provides QueryClient */}
        {/* App content */}
      </Admin>
    </SessionTimeoutProvider>
  </NotificationProvider>
</TenantProvider>
```

**CRITICAL Architectural Decision**:
- SessionTimeoutProvider is placed **OUTSIDE** the `<Admin>` component
- This means it **CANNOT use** React Admin's `useLogout()` hook (which requires `QueryClient` context)
- Instead, `useSessionTimeout` performs direct token cleanup and `window.location.href = '/login'` redirect
- This approach is intentional: session timeout needs to work even if React Admin fails to initialize

**Why not move SessionTimeoutProvider inside Admin?**
- Session timeout should work regardless of React Admin's state
- If Admin crashes or fails to render, timeout should still enforce logout
- Placing it outside ensures session security is independent of the main app

**Logout Mechanism**:
1. `clearSessionStorage()` - removes activity tracking
2. `localStorage.removeItem('cns_admin_api_token')` - clears API token
3. `sessionStorage.clear()` - clears all session data
4. `window.location.href = '/login'` - forces full page redirect to login

**Important**: SessionTimeoutProvider uses `useNotification()` from the custom NotificationContext (not react-admin's `useNotify()`), allowing it to work outside the Admin context initialization.

## Production Security Checklist

When deploying to production:

### Required

- [ ] Configure CSP headers in nginx/reverse proxy (not just meta tags)
- [ ] Set `VITE_SESSION_TIMEOUT_ENABLED=true`
- [ ] Use HTTPS for all connections
- [ ] Rotate `VITE_CNS_ADMIN_TOKEN` regularly
- [ ] Restrict network access to CNS API endpoints
- [ ] Enable `AUTH0_ENABLED=true` on CNS backend (optional but recommended)
- [ ] Remove `'unsafe-eval'` from CSP if not using eval-based libraries
- [ ] Update CSP `connect-src` to production API domains (remove localhost)

### Nginx Configuration Example

```nginx
server {
    listen 443 ssl http2;
    server_name cns-dashboard.example.com;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;

    # CSP - adjust domains as needed for production
    add_header Content-Security-Policy "
        default-src 'self';
        script-src 'self' 'unsafe-inline' https://*.auth0.com;
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        font-src 'self' https://fonts.gstatic.com;
        img-src 'self' data: blob: https:;
        connect-src 'self' https://api.cns.example.com https://*.auth0.com wss://*.auth0.com;
        frame-src https://*.auth0.com;
        object-src 'none';
        worker-src 'self' blob:;
        base-uri 'self';
        form-action 'self';
        frame-ancestors 'self';
    " always;

    # HSTS (HTTPS only)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
}
```

## Environment Variables Reference

### Security-Related Variables

| Variable | Required | Default | Range | Description |
|----------|----------|---------|-------|-------------|
| `VITE_CNS_ADMIN_TOKEN` | Yes | - | - | Admin API token for CNS service |
| `VITE_SESSION_TIMEOUT_ENABLED` | No | `true` | - | Enable session timeout |
| `VITE_SESSION_TIMEOUT_MINUTES` | No | `30` | 5-480 | Timeout duration in minutes |
| `VITE_SESSION_WARNING_MINUTES` | No | `5` | 1-60 | Warning before timeout |
| `VITE_AUTH0_DOMAIN` | If Auth0 | - | - | Auth0 tenant domain |
| `VITE_AUTH0_CLIENT_ID` | If Auth0 | - | - | Auth0 application client ID |
| `VITE_AUTH0_AUDIENCE` | If Auth0 | - | - | Auth0 API audience |

### Configuration Validation

The SessionTimeoutProvider validates configuration on startup:

- **Range validation**: Values outside valid ranges revert to defaults with console warning
- **Warning < Timeout**: Warning time is automatically adjusted if >= timeout
- **DEV logging**: Configuration is logged to console in development mode

Example console output:
```
[SessionTimeout] Configuration: { enabled: true, timeoutMinutes: 30, warningMinutes: 5 }
[SessionTimeout] Session timeout monitoring started
```

### Token Storage

Tokens are stored in:
- `localStorage['cns_admin_api_token']` - Admin API token (synced from build-time env)
- `localStorage['cns_last_activity']` - Last activity timestamp (for cross-tab sync)
- Auth0 SDK internal storage - User authentication tokens

**Note**: The admin token is intentionally stored in localStorage for private browsing mode compatibility. The CSP, session timeout, and automatic cleanup provide additional protection.

## Files Reference

| File | Purpose |
|------|---------|
| `index.html` | CSP meta tags, security headers |
| `vite.config.ts` | Security headers plugin, CORS config |
| `src/lib/sessionTimeout.ts` | Core timeout utility (vanilla JS) |
| `src/hooks/useSessionTimeout.ts` | React hook for timeout |
| `src/components/SessionTimeoutProvider.tsx` | React provider component |
| `.env.example` | Environment variable documentation |

## Vulnerability Disclosure

If you discover a security vulnerability, please report it to the security team. Do not create public issues for security vulnerabilities.

## Changelog

| Date | Change |
|------|--------|
| 2024-12-14 | Initial security implementation |
| 2024-12-14 | Added CSP headers with full directive set |
| 2024-12-14 | Added session timeout with cross-tab sync |
| 2024-12-14 | Added security headers Vite plugin |
| 2024-12-14 | Code review fixes: |
| | - Fixed NotificationContext usage (CRITICAL) |
| | - Added WebSocket to CSP for Vite HMR (CRITICAL) |
| | - Added env variable range validation (CRITICAL) |
| | - Added admin token cleanup on logout (CRITICAL) |
| | - Added worker-src to CSP |
| | - Added start() guard for duplicate calls |
| | - Standardized console log prefixes |
| | - Added configuration validation and logging |
| 2024-12-15 | Fixed QueryClient error (CRITICAL): |
| | - Removed `useLogout` from useSessionTimeout hook |
| | - useLogout requires QueryClient context from Admin |
| | - SessionTimeoutProvider is outside Admin (by design) |
| | - Now uses direct `window.location.href = '/login'` |
| | - Added sessionStorage.clear() for full cleanup |
| | - Updated documentation with architectural rationale |
| 2024-12-15 | Added Keycloak support to CSP: |
| | - Added `http://localhost:8180` to frame-src for Keycloak SSO |
| | - Added `http://localhost:8180` to script-src for Keycloak scripts |
| | - Added `http://localhost:8180` to form-action for login form submission |
| | - Updated documentation with production note |
