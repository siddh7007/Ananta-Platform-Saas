# CSP Implementation - Quick Reference Card

## TL;DR
Implemented nonce-based Content Security Policy to prevent XSS attacks. All inline scripts now require cryptographic nonces. No breaking changes to functionality.

## Files Changed (7)

| File | Change |
|------|--------|
| `vite.config.ts` | Added CSP nonce plugin |
| `src/lib/security/csp.ts` | Removed unsafe-inline, added nonce support |
| `src/main.tsx` | Initialize CSP reporter |
| `src/lib/error-tracking.ts` | Removed Function() constructor |
| `index.html` | Removed inline CSP meta tag |
| `nginx/security-headers.conf` | Nonce-based CSP headers |
| `nginx/nginx.conf` | sub_filter for nonce injection |

## Quick Test

```bash
# 1. Validate implementation
node scripts/validate-csp.js

# 2. Test development
bun run dev
# Open http://localhost:27100 and check console for CSP violations

# 3. Test production build
bun run build
grep '{{CSP_NONCE}}' dist/index.html  # Should find placeholder

# 4. Deploy and verify
curl https://cbp.ananta.com | grep 'nonce='  # Should see nonce attributes
curl -I https://cbp.ananta.com | grep -i content-security-policy  # Check header
```

## What Changed

### Before (Insecure)
```html
<!-- Allowed ANY inline script (XSS vulnerability) -->
<meta http-equiv="Content-Security-Policy"
      content="script-src 'self' 'unsafe-inline'">

<script>
  // This executes - INSECURE
  console.log('XSS possible');
</script>
```

### After (Secure)
```html
<!-- Only scripts with matching nonce can execute -->
<!-- CSP header: script-src 'self' 'nonce-abc123' -->

<script nonce="abc123">
  // This executes - nonce matches ✅
  console.log('Secure');
</script>

<script>
  // This is BLOCKED - no nonce ❌
  console.log('XSS prevented');
</script>
```

## How Nonces Work

```
Request 1:
┌─────────────────────────────────────┐
│ Nginx: nonce = xyz789               │
│ Header: script-src 'nonce-xyz789'   │
│ HTML: <script nonce="xyz789">       │
│ Browser: ✅ Nonce matches, execute  │
└─────────────────────────────────────┘

Request 2:
┌─────────────────────────────────────┐
│ Nginx: nonce = abc123 (NEW!)        │
│ Header: script-src 'nonce-abc123'   │
│ HTML: <script nonce="abc123">       │
│ Browser: ✅ Nonce matches, execute  │
└─────────────────────────────────────┘

Attacker injects: <script>alert('XSS')</script>
┌─────────────────────────────────────┐
│ No nonce attribute                  │
│ Browser: ❌ CSP violation, block    │
└─────────────────────────────────────┘
```

## Deployment Checklist

### Pre-Deployment
- [ ] Validation passes: `node scripts/validate-csp.js`
- [ ] Dev server works: `bun run dev`
- [ ] Production build succeeds: `bun run build`
- [ ] Placeholder present: `grep '{{CSP_NONCE}}' dist/index.html`

### Nginx Configuration
```bash
# 1. Copy security headers
cp nginx/security-headers.conf /etc/nginx/conf.d/

# 2. Update nginx.conf - Add these lines in server block:
#    sub_filter_once off;
#    sub_filter '{{CSP_NONCE}}' '$csp_nonce';

# 3. Test config
nginx -t

# 4. Reload
nginx -s reload
```

### Post-Deployment
- [ ] Nonce in HTML: `curl https://cbp.ananta.com | grep 'nonce='`
- [ ] CSP header present: `curl -I https://cbp.ananta.com | grep -i csp`
- [ ] No placeholder: `curl https://cbp.ananta.com | grep '{{CSP_NONCE}}'` (should be empty)
- [ ] App works in browser
- [ ] No CSP violations in console

## Troubleshooting

### Scripts not executing
```bash
# Check nonce in HTML
curl https://cbp.ananta.com | grep '<script nonce='

# Check CSP header
curl -I https://cbp.ananta.com | grep 'nonce-'

# Check browser console
# Look for: "Refused to execute inline script because it violates CSP"
```

**Fix**: Ensure nginx sub_filter is enabled and configured correctly.

### Nonce mismatch
```bash
# Verify placeholder is replaced
curl https://cbp.ananta.com | grep '{{CSP_NONCE}}'
# Should return nothing - if it finds {{CSP_NONCE}}, sub_filter isn't working
```

**Fix**: Check nginx has `--with-http_sub_module` enabled.

### Blank page
**Cause**: CSP blocking all scripts
**Fix**: Check browser console for CSP violations, verify nonces match

## Rollback

### Quick (Nginx Only)
```nginx
# In security-headers.conf, add unsafe-inline temporarily:
script-src 'self' 'unsafe-inline' 'nonce-$csp_nonce';

# Reload
nginx -s reload
```

### Full (Code)
```bash
git checkout <previous-commit> -- arc-saas/apps/customer-portal
bun run build
```

## Security Test

```javascript
// In browser console - all should be BLOCKED:

// 1. Inline script injection
document.body.innerHTML += '<script>alert("XSS")</script>';
// Expected: CSP violation

// 2. Inline event handler
const div = document.createElement('div');
div.onclick = () => alert('test');
// Expected: Event fires (onclick in JS is allowed)

// 3. External unauthorized script
const script = document.createElement('script');
script.src = 'https://evil.com/hack.js';
document.body.appendChild(script);
// Expected: CSP violation, script not loaded
```

## Monitoring

### Development
CSP violations logged to browser console:
```
[CSP Violation] {
  blockedURI: "https://evil.com/script.js",
  violatedDirective: "script-src",
  ...
}
```

### Production
Set environment variable for reporting:
```bash
VITE_CSP_REPORT_URL=https://api.ananta.com/csp-reports
```

Violations sent as POST to endpoint.

## Documentation

- **Full Guide**: `SECURITY-CSP.md`
- **Summary**: `CSP-IMPLEMENTATION-SUMMARY.md`
- **Completion**: `IMPLEMENTATION-COMPLETE.md`
- **This Card**: `CSP-QUICK-REFERENCE.md`

## Key Commands

```bash
# Validate
node scripts/validate-csp.js

# Dev test
bun run dev

# Production build
bun run build

# Check placeholder
grep '{{CSP_NONCE}}' dist/index.html

# Verify deployment
curl https://cbp.ananta.com | grep 'nonce='

# Check header
curl -I https://cbp.ananta.com | grep -i content-security-policy
```

## Status

✅ Implementation Complete
✅ Validation Passed
✅ Documentation Complete
🔄 Awaiting Deployment

---

**Need Help?** See `SECURITY-CSP.md` → Troubleshooting
