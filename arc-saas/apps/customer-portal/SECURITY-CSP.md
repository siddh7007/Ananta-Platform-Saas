# Content Security Policy (CSP) Implementation

## Overview

This document describes the nonce-based Content Security Policy implementation for the Customer Portal (CBP) frontend, which addresses multiple security vulnerabilities.

## Security Fixes

| Vulnerability | Status | Fix |
|---------------|--------|-----|
| **VULN-001** | FIXED | Removed `unsafe-inline` from script-src, using nonces |
| **VULN-002** | FIXED | Initialized CSP reporter in main.tsx |
| **VULN-003** | FIXED | Removed meta CSP tag (conflicts with headers) |
| **VULN-004** | FIXED | Removed Function() constructor from error-tracking.ts |
| **VULN-005** | FIXED | Restricted img-src to specific domains instead of `https:` |
| **VULN-006** | FIXED | All inline scripts/styles require nonces |

## Architecture

### Development Mode (Vite Dev Server)

```
┌─────────────────────────────────────────────────────────────┐
│ Vite Plugin (cspNoncePlugin)                                │
│ - Generates random nonce per build session                  │
│ - Injects nonce into <script> and <style> tags              │
│ - Updates index.html at build time                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Vite Dev Server Headers (vite.config.ts)                    │
│ - CSP with 'unsafe-eval' (required for HMR)                 │
│ - 'unsafe-inline' for styles (Tailwind CSS-in-JS)           │
│ - X-Content-Type-Options: nosniff                           │
│ - X-Frame-Options: SAMEORIGIN                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                      │
│ - Executes scripts with matching nonce                      │
│ - CSP reporter captures violations                          │
└─────────────────────────────────────────────────────────────┘
```

### Production Mode (Nginx)

```
┌─────────────────────────────────────────────────────────────┐
│ Nginx Request Handler                                        │
│ - Generates unique nonce per request ($request_id)          │
│ - Sets CSP header with 'nonce-$csp_nonce'                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Nginx sub_filter Module                                     │
│ - Replaces {{CSP_NONCE}} placeholder with actual nonce      │
│ - Updates HTML on-the-fly before sending to browser         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                      │
│ - Validates nonce matches CSP header                        │
│ - Executes only scripts/styles with matching nonce          │
│ - CSP reporter sends violations to monitoring               │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. Vite Plugin (Development)

**File**: `vite.config.ts`

```typescript
function cspNoncePlugin(): Plugin {
  const devNonce = crypto.randomBytes(16).toString('base64');

  return {
    name: 'csp-nonce',
    transformIndexHtml: {
      order: 'pre',
      handler(html: string) {
        const nonce = process.env.NODE_ENV === 'development'
          ? devNonce
          : '{{CSP_NONCE}}';

        return html
          .replace(/<script(?!.*nonce=)/g, `<script nonce="${nonce}"`)
          .replace(/<style(?!.*nonce=)/g, `<style nonce="${nonce}"`);
      },
    },
  };
}
```

**How it works**:
- Generates a random nonce per build session
- Injects `nonce="..."` attribute into all `<script>` and `<style>` tags
- For production builds, uses `{{CSP_NONCE}}` placeholder (replaced by nginx)

### 2. CSP Configuration

**File**: `src/lib/security/csp.ts`

```typescript
export const getCSPConfig = (nonce?: string): CSPConfig => {
  const scriptSrc = [
    "'self'",
    ...(nonce ? [`'nonce-${nonce}'`] : []),
    ...(isDev ? ["'unsafe-eval'"] : []), // Vite HMR only
  ];

  const styleSrc = [
    "'self'",
    ...(nonce ? [`'nonce-${nonce}'`] : []),
    "'unsafe-inline'", // Required for Tailwind CSS-in-JS
    'https://fonts.googleapis.com',
  ];

  // VULN-005 FIXED: Restricted img-src
  const imgSrc = [
    "'self'",
    'data:',
    'blob:',
    'https://*.ananta.com',
  ];

  return { defaultSrc: ["'self'"], scriptSrc, styleSrc, imgSrc, ... };
};
```

### 3. CSP Violation Reporter

**File**: `src/lib/security/csp-reporter.ts`

```typescript
export function setupCSPReporter(): void {
  document.addEventListener('securitypolicyviolation', (event) => {
    const violation = {
      documentURI: event.documentURI,
      blockedURI: event.blockedURI,
      violatedDirective: event.violatedDirective,
      originalPolicy: event.originalPolicy,
      disposition: event.disposition,
      timestamp: Date.now(),
    };

    // Log in development
    if (import.meta.env.DEV) {
      console.warn('[CSP Violation]', violation);
    }

    // Report to monitoring in production
    if (!import.meta.env.DEV && import.meta.env.VITE_CSP_REPORT_URL) {
      fetch(import.meta.env.VITE_CSP_REPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'csp-report': violation }),
      }).catch(() => {});
    }
  });
}
```

**Initialization**: Called in `src/main.tsx` before React renders.

### 4. Nginx Configuration (Production)

**File**: `nginx/security-headers.conf`

```nginx
# Generate CSP nonce from request_id (unique per request)
map $request_id $csp_nonce {
    default $request_id;
}

add_header Content-Security-Policy "
    default-src 'self';
    script-src 'self' 'nonce-$csp_nonce';
    style-src 'self' 'nonce-$csp_nonce' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' data: blob: https://*.ananta.com;
    font-src 'self' https://fonts.gstatic.com data:;
    connect-src 'self' https://api.ananta.com https://auth.ananta.com https://*.sentry.io wss://cbp.ananta.com;
    frame-src 'self' https://auth.ananta.com;
    form-action 'self' https://auth.ananta.com;
    base-uri 'self';
    object-src 'none';
    worker-src 'self' blob:;
    frame-ancestors 'none';
    upgrade-insecure-requests;
" always;
```

**File**: `nginx/nginx.conf`

```nginx
# Enable sub_filter for CSP nonce injection
sub_filter_once off;
sub_filter '{{CSP_NONCE}}' '$csp_nonce';
```

**How it works**:
1. Nginx generates unique nonce per request using `$request_id`
2. CSP header includes `'nonce-$csp_nonce'`
3. `sub_filter` replaces `{{CSP_NONCE}}` in HTML with actual nonce value
4. Browser validates nonce matches between HTML and CSP header

### 5. Error Tracking Fix (VULN-004)

**File**: `src/lib/error-tracking.ts`

**Before** (required `unsafe-eval`):
```typescript
const importFn = new Function('moduleName', 'return import(moduleName)');
sentryModule = await importFn('@sentry/react');
```

**After** (no `unsafe-eval` needed):
```typescript
sentryModule = await import('@sentry/react');
```

**Why**: The `Function()` constructor is equivalent to `eval()` and requires `unsafe-eval` in CSP. Direct dynamic imports are CSP-safe.

## Testing

### Development Testing

1. Start dev server:
   ```bash
   cd arc-saas/apps/customer-portal
   bun run dev
   ```

2. Open browser DevTools (F12) → Console

3. Check for CSP violations:
   ```
   [CSP Violation] { blockedURI: "...", violatedDirective: "...", ... }
   ```

4. Verify inline scripts have nonces:
   ```bash
   curl http://localhost:27100 | grep 'nonce='
   ```

### Production Testing

1. Build production bundle:
   ```bash
   bun run build
   ```

2. Verify placeholder in built HTML:
   ```bash
   grep '{{CSP_NONCE}}' dist/index.html
   ```

3. Test with nginx:
   ```bash
   docker-compose up -d customer-portal
   ```

4. Verify nonce injection:
   ```bash
   curl https://cbp.ananta.com | grep 'nonce='
   ```

5. Check CSP header:
   ```bash
   curl -I https://cbp.ananta.com | grep -i content-security-policy
   ```

### Security Testing

1. **XSS Injection Test**:
   ```javascript
   // Try injecting script (should be blocked)
   document.body.innerHTML += '<script>alert("XSS")</script>';
   ```
   Expected: CSP violation, script not executed

2. **Inline Script Test**:
   ```javascript
   // Try creating inline script without nonce (should be blocked)
   const script = document.createElement('script');
   script.textContent = 'console.log("test")';
   document.body.appendChild(script);
   ```
   Expected: CSP violation, script not executed

3. **External Script Test**:
   ```javascript
   // Try loading external script from unauthorized domain (should be blocked)
   const script = document.createElement('script');
   script.src = 'https://evil.com/malicious.js';
   document.body.appendChild(script);
   ```
   Expected: CSP violation, script not loaded

## Browser Compatibility

| Browser | CSP Nonces | Notes |
|---------|------------|-------|
| Chrome 60+ | YES | Full support |
| Firefox 55+ | YES | Full support |
| Safari 11+ | YES | Full support |
| Edge 79+ | YES | Full support (Chromium) |
| IE 11 | NO | CSP ignored (graceful degradation) |

## Monitoring

### CSP Violation Reports

**Environment Variables**:
```bash
# Optional: Enable CSP violation reporting
VITE_CSP_REPORT_URL=https://api.ananta.com/csp-reports
```

**Report Format**:
```json
{
  "csp-report": {
    "documentURI": "https://cbp.ananta.com/",
    "blockedURI": "https://evil.com/script.js",
    "violatedDirective": "script-src",
    "originalPolicy": "script-src 'self' 'nonce-abc123'",
    "disposition": "enforce",
    "timestamp": 1702345678901
  }
}
```

### Logging

**Development**: CSP violations logged to browser console
**Production**: CSP violations sent to `VITE_CSP_REPORT_URL` endpoint

## Troubleshooting

### Issue: Scripts not executing

**Symptoms**: Inline scripts fail silently, blank page

**Diagnosis**:
```javascript
// Check for CSP violations in console
window.addEventListener('securitypolicyviolation', console.error);
```

**Solutions**:
1. Verify nonce attributes present in HTML: `grep 'nonce=' dist/index.html`
2. Check CSP header matches nonce values
3. Ensure Vite plugin is loaded: Check vite.config.ts plugins array
4. Check nginx sub_filter is enabled: `nginx -T | grep sub_filter`

### Issue: Nonce mismatch in production

**Symptoms**: Scripts have nonce but still blocked

**Diagnosis**:
```bash
# Check if placeholder is replaced
curl https://cbp.ananta.com | grep '{{CSP_NONCE}}'
# Should be empty - if not, sub_filter isn't working

# Check nginx CSP header
curl -I https://cbp.ananta.com | grep -i content-security-policy
# Should contain 'nonce-XXXXX' with actual value, not '$csp_nonce'
```

**Solutions**:
1. Enable nginx sub_filter module: `--with-http_sub_module`
2. Check sub_filter directive in nginx.conf
3. Verify map directive defines $csp_nonce
4. Check nginx error logs: `docker logs app-plane-customer-portal`

### Issue: Tailwind styles not applied

**Symptoms**: Unstyled content, CSP violations for inline styles

**Diagnosis**: Check for `style-src` violations in console

**Solutions**:
1. Verify `'unsafe-inline'` is in `style-src` (required for Tailwind)
2. Check nonce is added to inline `<style>` tags
3. Consider extracting Tailwind to external CSS (future improvement)

### Issue: Vite HMR not working in dev

**Symptoms**: Hot reload fails, require full page refresh

**Diagnosis**: Check for `script-src 'unsafe-eval'` violations

**Solutions**:
1. Ensure dev CSP includes `'unsafe-eval'` in script-src
2. Check vite.config.ts server.headers configuration
3. Verify NODE_ENV=development

## Future Improvements

1. **Remove style unsafe-inline**:
   - Extract Tailwind to external CSS file
   - Use CSS-in-JS with nonce support
   - Target: Remove `'unsafe-inline'` from style-src

2. **Subresource Integrity (SRI)**:
   - Add integrity hashes to external scripts
   - Implement SRI validation in build process

3. **Trusted Types**:
   - Enable Trusted Types CSP directive
   - Migrate DOM manipulation to Trusted Types API

4. **Report-Only Mode**:
   - Add Content-Security-Policy-Report-Only header for testing
   - Monitor violations before enforcing strict policy

5. **Per-Environment CSP**:
   - Stricter production CSP (no unsafe-eval)
   - More permissive staging CSP for debugging

## References

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [CSP Nonces Best Practices](https://web.dev/strict-csp/)
- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
