# Customer Portal Security Documentation

**Version:** 1.0
**Last Updated:** December 2024

## Overview

This document outlines security decisions, configurations, and best practices for the Ananta Customer Portal (CBP). Security is implemented through multiple layers including Content Security Policy (CSP), secure authentication flows, and proper API isolation.

---

## Token Storage Strategy

### Decision: localStorage with strict CSP

**Why localStorage?**
- Industry standard for SPAs (React, Angular, Vue apps all use this)
- Required by `oidc-client-ts` for PKCE token storage
- Enables cross-tab session synchronization (BroadcastChannel)
- Simpler architecture than Backend-for-Frontend (BFF) pattern

**Security Mitigation:**
- **CSP headers prevent XSS** - Without XSS, localStorage cannot be accessed by malicious scripts
- **script-src 'self'** - Only scripts from our origin can execute
- **No eval/inline scripts** - Reduces attack surface

**Comparison with Admin-App:**
| Aspect | Customer Portal | Admin-App |
|--------|-----------------|-----------|
| Token Storage | OIDC library only | OIDC + custom keys |
| Custom Keys | None | `arc_admin_token`, etc. |
| Approach | Cleaner, single source | Legacy duplication |

**Verdict:** Customer Portal's approach is preferred - rely on OIDC library storage only.

### Alternative Considered: BFF Pattern

The Backend-for-Frontend pattern was considered but rejected for MVP:
- Adds infrastructure complexity (dedicated auth proxy service)
- Increases latency (extra hop for all API calls)
- Not necessary when CSP is properly enforced
- Can be added later if requirements change

---

## Content Security Policy (CSP)

### Implementation Locations

1. **`index.html` meta tag** - Primary CSP definition
2. **`vite.config.ts` headers** - Dev server CSP enforcement
3. **Production nginx** - Should mirror these policies

### Current CSP Directives

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self'
  http://localhost:14000
  http://localhost:27200
  http://localhost:27810
  http://localhost:8180
  ws://localhost:27100;
frame-src 'self' http://localhost:8180;
form-action 'self' http://localhost:8180;
base-uri 'self';
object-src 'none';
```

### Directive Explanations

| Directive | Value | Purpose |
|-----------|-------|---------|
| `default-src` | 'self' | Fallback for unspecified directives |
| `script-src` | 'self' | Only allow scripts from same origin (XSS protection) |
| `style-src` | 'self' 'unsafe-inline' | Allow inline styles (required for many UI libs) |
| `img-src` | 'self' data: https: | Allow images from self, data URIs, and HTTPS |
| `font-src` | 'self' data: | Allow fonts from self and data URIs |
| `connect-src` | (see list) | API endpoints, Keycloak, WebSocket |
| `frame-src` | 'self' localhost:8180 | Allow Keycloak iframes (silent refresh) |
| `form-action` | 'self' localhost:8180 | Allow form submissions to Keycloak |
| `base-uri` | 'self' | Prevent base tag injection attacks |
| `object-src` | 'none' | Block Flash/plugins (obsolete but good practice) |

### Production CSP Configuration

For production, update connect-src to use actual domains:

```
connect-src 'self'
  https://api.ananta.com
  https://auth.ananta.com
  wss://cbp.ananta.com;
frame-src 'self' https://auth.ananta.com;
form-action 'self' https://auth.ananta.com;
```

### Additional Security Headers

Configured in `vite.config.ts` for dev server:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | nosniff | Prevent MIME sniffing attacks |
| `X-Frame-Options` | SAMEORIGIN | Prevent clickjacking |
| `Referrer-Policy` | strict-origin-when-cross-origin | Control referrer information |

---

## Authentication Security

### OIDC Configuration

- **Protocol:** OpenID Connect with PKCE
- **Token Type:** JWT (RS256 signature)
- **Library:** `oidc-client-ts`
- **Silent Renewal:** Enabled (`automaticSilentRenew: true`)

### Token Validation

The portal validates tokens on the frontend for:
- **Audience (`aud`):** Must include `cbp-frontend` or `cns-api`
- **Expiration (`exp`):** With 60-second buffer before expiry

Backend services perform additional validation:
- JWKS signature verification
- Issuer validation
- Tenant context enforcement

### Session Management

- **Cross-tab sync:** BroadcastChannel API for session changes
- **Logout:** Revokes tokens via Keycloak end_session_endpoint
- **Idle timeout:** Configurable via Keycloak realm settings

---

## API Security

### Request Headers

All API requests include:
| Header | Value | Purpose |
|--------|-------|---------|
| `Authorization` | Bearer {token} | JWT authentication |
| `X-Tenant-Id` | {uuid} | Multi-tenant isolation |
| `X-Request-Id` | {uuid} | Request tracing |
| `X-Correlation-Id` | {uuid} | Cross-service correlation |

### Tenant Isolation

- All data queries are scoped by `tenant_id`
- Backend enforces tenant context from JWT claims
- Super admins can access cross-tenant data (logged)

### Circuit Breaker

The data providers implement circuit breaker pattern:
- **Failure threshold:** 5 failures before open
- **Cooldown:** 30 seconds before retry
- **Retry policy:** Exponential backoff (500ms, 1s, 2s)

---

## Observability (OpenTelemetry)

### Overview

The Customer Portal uses OpenTelemetry for distributed tracing, enabling end-to-end request visibility across frontend and backend services.

### Configuration

Environment variables for telemetry:

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_OTEL_ENABLED` | `true` | Enable/disable telemetry |
| `VITE_OTEL_EXPORTER_ENDPOINT` | `http://localhost:4318/v1/traces` | OTLP collector endpoint |
| `VITE_SERVICE_NAME` | `cbp-frontend` | Service name in traces |
| `VITE_APP_VERSION` | `1.0.0` | Version tag for traces |

### Trace Propagation

Traces are automatically propagated to backend services via the `traceparent` header (W3C Trace Context format). The following endpoints receive trace context:

- Platform API (`VITE_PLATFORM_API_URL`)
- CNS API (`VITE_CNS_API_URL`)
- Supabase API (`VITE_SUPABASE_API_URL`)

### Custom Spans

Use the telemetry helpers for custom instrumentation:

```typescript
import { withSpan, addSpanEvent, setSpanAttributes } from '@/lib/telemetry';

// Async operation with automatic error handling
await withSpan('bom.upload', async (span) => {
  span.setAttribute('bom.filename', file.name);
  span.setAttribute('bom.size', file.size);
  await uploadBom(file);
}, { 'user.action': 'upload' });

// Add events to current span
addSpanEvent('validation.complete', { items: 42 });

// Set attributes on current span
setSpanAttributes({ 'enrichment.status': 'processing' });
```

### Ignored URLs

These patterns are excluded from tracing:
- `/health`, `/metrics` endpoints
- Hot module reload (`*.hot-update.*`)
- Vite dev server (`@vite`, `sockjs-node`)
- Static assets (`favicon.ico`)

### Collector Setup

The Customer Portal uses the **shared arc-saas Jaeger instance** - no separate collector needed.

**Arc-SaaS Jaeger** (already running via `docker-compose up`):
- Container: `arc-saas-jaeger`
- OTLP HTTP: `http://localhost:4318` (used by frontend)
- Jaeger UDP: `localhost:6832` (used by backend services)
- UI: http://localhost:16686

```bash
# Start the shared observability stack (from arc-saas root)
docker-compose up -d jaeger
```

All services export to the same Jaeger instance:
| Service | Exporter | Endpoint |
|---------|----------|----------|
| cbp-frontend | OTLP HTTP | localhost:4318 |
| tenant-management-service | Jaeger UDP | localhost:6832 |
| temporal-worker-service | Jaeger UDP | localhost:6832 |
| subscription-service | Jaeger UDP | localhost:6832 |

View correlated traces at: http://localhost:16686

---

## Open Security Gaps

### Completed (December 2024)

1. **Audience Validation in Auth Flow** - FIXED
   - Added `validateAudience()` call in `AuthContext.tsx` `mapOidcUser()`
   - Tokens without valid `aud` claim are rejected with `INVALID_AUDIENCE` error

2. **Component Catalog Auth** - FIXED
   - Routed all component requests through CNS service (`cnsApi`)
   - CNS validates Keycloak JWTs properly (PostgREST used incompatible secret)

### Low Priority

1. **No MFA Setup UI**
   - Keycloak supports MFA but portal doesn't expose setup
   - Users must configure MFA directly in Keycloak

2. **Rate Limit Handling**
   - No handling of `Retry-After` headers from backend
   - Should add graceful rate limit UX

---

## Security Checklist for Production

- [ ] Update CSP `connect-src` with production domains
- [ ] Configure nginx with CSP and security headers
- [ ] Enable HTTPS-only with HSTS
- [ ] Set secure cookie flags in Keycloak
- [ ] Enable audit logging for auth events
- [ ] Configure intrusion detection alerts
- [ ] Set up Sentry for error monitoring (add DSN)
- [ ] Verify Supabase proxy validates tokens
- [ ] Add audience validation to auth flow
- [ ] Configure rate limiting at gateway level

---

## References

- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [oidc-client-ts Security Best Practices](https://github.com/authts/oidc-client-ts)
- [CBP Integration Technical Spec v5.4](../../../docs/CBP-INTEGRATION-TECHNICAL-SPEC.md)
