# Rate Limiting Quick Reference

## TL;DR

Rate limiting is ACTIVE on CNS service:
- Admin token endpoints: **10 requests/minute**
- Authenticated endpoints: **100 requests/minute**
- Health checks: **Not rate limited**

## Configuration (Environment Variables)

```bash
# Required
ADMIN_API_TOKEN=your-secret-token-here

# Optional
ADMIN_TOKEN_ALLOWED_IPS=192.168.1.100,10.0.0.50  # Comma-separated
TRUSTED_PROXY_COUNT=0  # 0=direct, 1=nginx, 2=CDN+LB

# Redis (recommended for production)
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379/0
```

## Quick Test

```bash
# Test admin token rate limit (should fail after 10 requests)
for i in {1..15}; do
  echo "Request $i:"
  curl -w "Status: %{http_code}\n" \
       -H "Authorization: Bearer $ADMIN_API_TOKEN" \
       http://localhost:27200/api/admin/default-token
done
```

## Rate Limit Response

```json
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "detail": "Admin token rate limit exceeded. Please try again later."
}
```

## Logs to Watch

```
[RateLimit] Middleware initialized: admin_token_limit=10/min authenticated_limit=100/min
[RateLimit] Admin token rate limit exceeded: ip=192.168.1.100 count=11
[RateLimit] IP not whitelisted: 203.0.113.100
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Getting 429 too fast | Check if Redis connected, verify IP not shared (NAT) |
| Admin token not working | Check IP whitelist, verify token matches config |
| Rate limiting not working | Check logs for "middleware registered" message |

## File Locations

- Implementation: `e:\Work\Ananta-Platform-Saas\app-plane\services\cns-service\app\middleware\rate_limit.py`
- Tests: `e:\Work\Ananta-Platform-Saas\app-plane\services\cns-service\tests\test_rate_limit.py`
- Full docs: `e:\Work\Ananta-Platform-Saas\app-plane\services\cns-service\docs\RATE_LIMITING.md`

## Quick Commands

```bash
# Check if rate limiting is active
docker logs app-plane-cns-service | grep -i "rate limit"

# Monitor rate limit violations
docker logs -f app-plane-cns-service | grep "rate limit exceeded"

# Test from Python
import requests
response = requests.get(
    "http://localhost:27200/api/admin/default-token",
    headers={"Authorization": f"Bearer {admin_token}"}
)
print(f"Status: {response.status_code}")
print(f"Retry-After: {response.headers.get('Retry-After')}")
```

## Production Checklist

- [ ] Strong admin token generated (`openssl rand -hex 32`)
- [ ] Admin token in secrets manager (not in git)
- [ ] IP whitelist configured (if needed)
- [ ] Redis enabled and connected
- [ ] `TRUSTED_PROXY_COUNT` matches infrastructure
- [ ] Logs monitored for violations
- [ ] Alerts set up for excessive 429s

## Support

- Full documentation: `docs/RATE_LIMITING.md`
- Integration guide: `docs/RATE_LIMITING_INTEGRATION.md`
- Run tests: `pytest tests/test_rate_limit.py -v`
