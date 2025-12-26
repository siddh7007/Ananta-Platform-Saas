# Rate Limiting Middleware

## Overview

The CNS service implements comprehensive rate limiting to protect against brute force attacks and API abuse. The rate limiting middleware provides:

- **Admin Token Protection**: Strict limits (10 requests/minute) for admin token endpoints
- **Authenticated Request Limits**: Standard limits (100 requests/minute) for authenticated API calls
- **IP Whitelisting**: Optional IP restrictions for admin token usage
- **Constant-Time Token Comparison**: Protection against timing attacks
- **Redis-Backed Storage**: Distributed rate limiting across multiple workers/nodes
- **Graceful Degradation**: Fallback to in-memory storage if Redis unavailable

## Architecture

### Rate Limiting Tiers

| Tier | Rate Limit | Window | Use Case |
|------|-----------|--------|----------|
| Admin Token | 10 requests | 60 seconds | Admin endpoints (`/api/admin/*`) |
| Authenticated | 100 requests | 60 seconds | Regular API calls with auth headers |
| Unauthenticated | Not rate limited | - | Public endpoints (health checks, docs) |

### Middleware Order

The rate limiting middleware is applied **BEFORE** authentication middleware to:
1. Reduce load by rejecting rate-limited requests early
2. Prevent expensive authentication operations for attackers
3. Protect the auth system itself from abuse

Middleware stack order:
```
1. ErrorHandling (CRITICAL-7)
2. DualDatabaseRouting (CRITICAL-4)
3. InputValidation (CRITICAL-6)
4. RateLimiting ← YOU ARE HERE
5. Authentication (APP-LAYER-RLS)
6. CORS
7. RequestLogging
8. CorrelationID
```

## Configuration

### Environment Variables

```bash
# Admin API Token (required for admin endpoints)
ADMIN_API_TOKEN=your-secret-admin-token-here

# Admin Token IP Whitelist (optional, comma-separated)
# When set, admin tokens can ONLY be used from these IPs
ADMIN_TOKEN_ALLOWED_IPS=192.168.1.100,10.0.0.50

# Proxy Configuration (for correct IP extraction)
# Set to number of trusted proxy hops
TRUSTED_PROXY_COUNT=0  # 0=direct, 1=nginx, 2=CDN+LB
```

### Redis Configuration

Rate limiting uses the existing Redis configuration:

```bash
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379/0
```

If Redis is unavailable, the middleware automatically falls back to in-memory storage (NOT recommended for production with multiple workers).

## Security Features

### 1. Constant-Time Token Comparison

Admin tokens are validated using `secrets.compare_digest()` to prevent timing attacks:

```python
# SECURE: Constant-time comparison
if secrets.compare_digest(provided_token, expected_token):
    return True

# INSECURE: Standard comparison (vulnerable to timing attacks)
if provided_token == expected_token:  # DON'T DO THIS
    return True
```

**Why this matters**: Timing attacks can leak information about the token by measuring how long comparisons take. Constant-time comparison prevents this.

### 2. IP Whitelisting

When `ADMIN_TOKEN_ALLOWED_IPS` is set, admin tokens can only be used from whitelisted IP addresses:

```bash
# Allow admin token from specific IPs only
ADMIN_TOKEN_ALLOWED_IPS=192.168.1.100,10.0.0.50,203.0.113.25
```

**Use case**: Restrict admin token usage to office IPs, VPN endpoints, or specific CI/CD servers.

### 3. Proxy-Aware IP Extraction

The middleware correctly extracts client IPs even when behind proxies/load balancers:

```python
# IP extraction priority:
1. X-Real-IP header (set by proxy, most trusted)
2. X-Forwarded-For (with trusted proxy count)
3. Direct client IP (fallback)
```

**Configuration**:
- `TRUSTED_PROXY_COUNT=0`: No proxies, use direct IP (most secure)
- `TRUSTED_PROXY_COUNT=1`: Single reverse proxy (nginx)
- `TRUSTED_PROXY_COUNT=2`: CDN + load balancer

**Security note**: Setting `TRUSTED_PROXY_COUNT` incorrectly can allow IP spoofing. Only trust proxies you control.

## Usage Examples

### Admin Token Request

```bash
# Using Authorization header (recommended)
curl -H "Authorization: Bearer your-admin-token" \
     http://localhost:27200/api/admin/default-token

# Using X-Admin-Token header (alternative)
curl -H "X-Admin-Token: your-admin-token" \
     http://localhost:27200/api/admin/bulk/upload
```

**Rate limit**: 10 requests per minute per IP

### Authenticated API Request

```bash
# Any request with authentication
curl -H "Authorization: Bearer your-jwt-token" \
     http://localhost:27200/api/boms
```

**Rate limit**: 100 requests per minute per IP

### Rate Limit Response

When rate limit is exceeded, you'll receive a `429 Too Many Requests` response:

```json
{
  "detail": "Admin token rate limit exceeded. Please try again later."
}
```

**Headers**:
- `Retry-After: 60` - Number of seconds to wait before retrying

## Testing Rate Limits

### Manual Testing

```bash
# Test admin token rate limit (should fail after 10 requests)
for i in {1..15}; do
  echo "Request $i:"
  curl -H "Authorization: Bearer your-admin-token" \
       http://localhost:27200/api/admin/default-token
  sleep 1
done
```

### Automated Testing

```bash
# Run rate limit tests
cd app-plane/services/cns-service
pytest tests/test_rate_limit.py -v
```

## Monitoring

### Logs

Rate limit events are logged at WARNING level:

```
[RateLimit] Admin token rate limit exceeded: ip=192.168.1.100 path=/api/admin/default-token count=11 limit=10
[RateLimit] Authenticated rate limit exceeded: ip=10.0.0.50 path=/api/boms count=101 limit=100
[RateLimit] IP not whitelisted for admin token: 203.0.113.100 (allowed IPs: 192.168.1.100, 10.0.0.50)
```

### Metrics

Rate limit metrics can be tracked via Prometheus (future enhancement):

```
cns_rate_limit_exceeded_total{tier="admin_token"} 15
cns_rate_limit_exceeded_total{tier="authenticated"} 3
```

## Troubleshooting

### Issue: Rate limits triggering too often

**Symptoms**: Legitimate users getting 429 responses

**Solutions**:
1. Increase rate limits in `rate_limit.py` (adjust `ADMIN_TOKEN_RATE_LIMIT` or `AUTHENTICATED_RATE_LIMIT`)
2. Check if multiple users share the same public IP (NAT/proxy)
3. Verify `TRUSTED_PROXY_COUNT` is configured correctly

### Issue: Admin token works locally but not in production

**Symptoms**: 403 responses in production

**Solutions**:
1. Check if `ADMIN_TOKEN_ALLOWED_IPS` is set
2. Verify your production IP is in the whitelist
3. Check logs for "IP not whitelisted" messages

### Issue: Rate limiting not working (no 429 responses)

**Symptoms**: Requests never get rate limited

**Solutions**:
1. Check if Redis is connected: Look for "Using Redis for distributed rate limiting" in logs
2. Verify middleware is registered: Look for "Rate limiting middleware registered" in startup logs
3. Ensure request paths are not in `RATE_LIMIT_EXEMPT_PATHS`

### Issue: Different workers have separate rate limits

**Symptoms**: Can make 100 requests to worker 1, then 100 more to worker 2

**Solutions**:
1. Ensure Redis is enabled and connected
2. Check Redis logs for connection issues
3. If Redis unavailable, in-memory fallback is per-worker (known limitation)

## Production Recommendations

### Required Configuration

```bash
# Production environment
ENVIRONMENT=production

# Admin token (use strong random token)
ADMIN_API_TOKEN=$(openssl rand -hex 32)

# IP whitelist (restrict admin access)
ADMIN_TOKEN_ALLOWED_IPS=203.0.113.50,198.51.100.25

# Proxy settings (if behind load balancer)
TRUSTED_PROXY_COUNT=1

# Redis (required for distributed rate limiting)
REDIS_ENABLED=true
REDIS_URL=redis://redis:6379/0
```

### Security Checklist

- [ ] Strong random admin token generated (`openssl rand -hex 32`)
- [ ] Admin token stored in secrets manager (not committed to git)
- [ ] IP whitelist configured for admin token
- [ ] Redis enabled for distributed rate limiting
- [ ] `TRUSTED_PROXY_COUNT` matches your infrastructure
- [ ] Rate limit logs monitored for abuse patterns
- [ ] Alerts configured for excessive 429 responses

## Future Enhancements

### Planned Features

1. **Per-User Rate Limits**: Track limits by user ID instead of just IP
2. **Dynamic Rate Limits**: Adjust limits based on user plan/tier
3. **Rate Limit Headers**: Include `X-RateLimit-Remaining` headers
4. **Metrics Export**: Prometheus metrics for rate limit violations
5. **Circuit Breaker**: Temporarily block IPs with excessive violations
6. **Allowlist/Blocklist**: Permanent IP allowlists and blocklists

### Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Redis-backed storage | ✅ Complete | With in-memory fallback |
| Admin token limits | ✅ Complete | 10/min |
| Authenticated limits | ✅ Complete | 100/min |
| IP whitelisting | ✅ Complete | Optional |
| Constant-time comparison | ✅ Complete | Timing attack protection |
| Per-user limits | 🔄 Planned | Track by user_id |
| Rate limit headers | 🔄 Planned | X-RateLimit-* headers |
| Metrics export | 🔄 Planned | Prometheus integration |

## Related Documentation

- [Authentication Middleware](./AUTHENTICATION.md)
- [Security Best Practices](./SECURITY.md)
- [Deployment Guide](./DEPLOYMENT.md)
