# Rate Limiting Architecture - Comparison

## Overview

The CNS service now has TWO rate limiting implementations that work together:

1. **Middleware Rate Limiter** (NEW) - Global protection at middleware level
2. **Endpoint Rate Limiter** (EXISTING) - Fine-grained per-endpoint control

Both are complementary and serve different purposes.

## Comparison

| Feature | Middleware Rate Limiter | Endpoint Rate Limiter |
|---------|------------------------|----------------------|
| **File** | `app/middleware/rate_limit.py` | `app/utils/rate_limiter.py` |
| **Scope** | Global (all requests) | Per-endpoint (decorator-based) |
| **Layer** | Middleware (before routing) | Route handler (after routing) |
| **Purpose** | Brute force protection | API quota management |
| **Configuration** | Global settings | Per-endpoint parameters |
| **Admin Token** | 10/min (strict) | Custom per endpoint |
| **Authenticated** | 100/min (standard) | Custom per endpoint |
| **IP Whitelisting** | Yes | No |
| **Constant-Time Comparison** | Yes | No |
| **Use Case** | Security (attack prevention) | Business logic (fair usage) |

## When to Use Each

### Use Middleware Rate Limiter For:

✅ **Protecting against attacks**
- Brute force attempts on admin tokens
- General API abuse/flooding
- Distributed denial of service (DDoS) mitigation

✅ **Global policies**
- Platform-wide rate limits
- Security-first rate limiting
- Early rejection (before expensive operations)

### Use Endpoint Rate Limiter For:

✅ **Business logic constraints**
- Per-user API quotas (e.g., 1000 requests/day)
- Expensive operation throttling (e.g., ML inference)
- Fair usage policies for different tiers

✅ **Fine-grained control**
- Different limits per endpoint
- User-specific rate limits
- Custom rate limit logic

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Incoming Request                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         MIDDLEWARE RATE LIMITER (NEW - Global)              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Purpose: Security & Brute Force Protection         │    │
│  │ Scope: ALL requests                                │    │
│  │ Limits: 10/min (admin), 100/min (auth)            │    │
│  │ Check: IP-based, admin token validation           │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     Authentication                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     Route Matching                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│       ENDPOINT RATE LIMITER (EXISTING - Per-Endpoint)       │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Purpose: Business Logic & Fair Usage              │    │
│  │ Scope: Specific endpoints (decorator)             │    │
│  │ Limits: Custom per endpoint                       │    │
│  │ Check: User-based, token-based                    │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     Route Handler                           │
└─────────────────────────────────────────────────────────────┘
```

## Examples

### Example 1: Admin Token Endpoint

An admin endpoint might use BOTH rate limiters:

```python
from fastapi import APIRouter, Depends
from app.utils.rate_limiter import rate_limit_admin_endpoints

router = APIRouter()

@router.get("/api/admin/sensitive-operation")
@rate_limit_admin_endpoints  # Endpoint limiter: 60/min per user
async def sensitive_operation():
    """
    This endpoint is protected by:
    1. Middleware limiter: 10/min per IP (admin token)
    2. Endpoint limiter: 60/min per user (decorator)

    Both must pass for request to succeed.
    """
    return {"status": "ok"}
```

**Flow**:
1. Request arrives with admin token
2. Middleware checks: 10/min per IP ← **Security layer**
3. Authentication validates token
4. Route matches
5. Decorator checks: 60/min per user ← **Business layer**
6. Handler executes

### Example 2: Supplier API Rate Limiting

Supplier API clients use the existing `RateLimiter` class:

```python
from app.utils.rate_limiter import RateLimiter

rate_limiter = RateLimiter()

# Rate limit supplier API calls (e.g., DigiKey: 1000/day)
if not rate_limiter.check_rate_limit(
    identifier=f"digikey:{component_mpn}",
    max_requests=1000,
    window_seconds=86400  # 24 hours
):
    raise HTTPException(429, "DigiKey API quota exceeded")

# Call supplier API
response = await digikey_client.search(mpn)
```

**Purpose**: Business logic (stay within supplier API quotas), not security.

### Example 3: Authenticated User Quotas

Different rate limits for different user tiers:

```python
from app.utils.rate_limiter import RateLimiter

rate_limiter = RateLimiter()

# Check user's API quota based on their plan
limits = {
    "free": 100,      # 100 requests/day
    "basic": 1000,    # 1000 requests/day
    "premium": 10000  # 10000 requests/day
}

user_limit = limits.get(user.plan, 100)

if not rate_limiter.check_rate_limit(
    identifier=f"user:{user.id}",
    max_requests=user_limit,
    window_seconds=86400
):
    raise HTTPException(429, "Daily API quota exceeded for your plan")
```

**Purpose**: Fair usage policy, NOT security.

## Migration Notes

### No Breaking Changes

The new middleware rate limiter does NOT replace the existing endpoint rate limiter. Both work together:

- **Existing decorators continue to work**: `@rate_limit_admin_endpoints` still functions
- **Existing supplier rate limiting continues**: `RateLimiter` class still used
- **No code changes required**: Existing endpoints unaffected

### Enhanced Protection

The middleware adds an ADDITIONAL security layer:

**Before**:
```
Request → Auth → Endpoint Limiter → Handler
```

**After**:
```
Request → Middleware Limiter → Auth → Endpoint Limiter → Handler
         └─ NEW LAYER                └─ EXISTING
```

## Best Practices

### Use Middleware Limiter For:

1. **Admin token protection** (already configured: 10/min)
2. **General API protection** (already configured: 100/min for authenticated)
3. **IP-based brute force prevention**

### Use Endpoint Limiter For:

1. **User quota management** (e.g., free vs paid plans)
2. **Expensive operation throttling** (e.g., ML inference, bulk exports)
3. **Per-endpoint custom limits** (e.g., 10/min for search, 1/min for exports)
4. **Supplier API quota management** (e.g., DigiKey 1000/day)

### Combine Both For:

1. **Critical admin endpoints**: Global 10/min (middleware) + 60/min per user (decorator)
2. **Public APIs**: Global 100/min (middleware) + custom per-endpoint (decorator)
3. **Tiered access**: Global limit (security) + plan-based limit (business)

## Configuration

### Middleware Limiter (Global)

Configured via environment variables:

```bash
# .env
ADMIN_API_TOKEN=your-token-here
ADMIN_TOKEN_ALLOWED_IPS=192.168.1.100,10.0.0.50  # Optional
TRUSTED_PROXY_COUNT=0
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379/0
```

Limits hardcoded in `app/middleware/rate_limit.py`:
- `ADMIN_TOKEN_RATE_LIMIT = 10` (requests per minute)
- `AUTHENTICATED_RATE_LIMIT = 100` (requests per minute)

### Endpoint Limiter (Per-Endpoint)

Configured via decorator parameters:

```python
@rate_limit_admin_endpoints  # Uses default limits
# OR
@rate_limiter.check_rate_limit(
    identifier="custom-key",
    max_requests=60,
    window_seconds=60
)
```

## Summary

| Aspect | Middleware Limiter | Endpoint Limiter |
|--------|-------------------|------------------|
| **Purpose** | Security | Business Logic |
| **When** | Every request | Specific endpoints |
| **What** | IP + admin token | User ID, custom keys |
| **Why** | Prevent attacks | Fair usage |
| **How** | Automatic | Decorator/manual |
| **Limits** | Global (10/100) | Custom per endpoint |
| **Configuration** | Environment vars | Code/decorators |

**Key Takeaway**: Both work together. Middleware provides baseline security, endpoint limiter provides business logic control.
