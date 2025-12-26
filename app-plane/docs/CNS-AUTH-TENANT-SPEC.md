# CNS Service Authentication & Tenant ID Specification

**Version:** 1.0.0
**Last Updated:** 2025-12-14
**Status:** Production Specification

## Overview

This document defines the authentication and tenant isolation requirements for the Component Normalization Service (CNS) when integrating with the Customer Business Portal (CBP) frontend and other clients.

## Table of Contents

1. [X-Tenant-Id Header Specification](#x-tenant-id-header-specification)
2. [Gateway Path Alignment](#gateway-path-alignment)
3. [Keycloak JWT Audience Validation](#keycloak-jwt-audience-validation)
4. [Header vs. Token Claim Validation](#header-vs-token-claim-validation)
5. [VPN/IP-Allowlisted Ingress Rules](#vpnip-allowlisted-ingress-rules)
6. [Implementation Checklist](#implementation-checklist)

---

## X-Tenant-Id Header Specification

### Requirement

The `X-Tenant-Id` header **MUST** contain the **platform UUID** assigned by the Control Plane tenant management service, **NOT** the organization ID from the App Plane Supabase database.

### UUID Format

- **Type**: UUID v4
- **Format**: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` (8-4-4-4-12 hex digits)
- **Example**: `1d07c925-48ba-4b4e-b28f-665041a012ca`

### Source of Truth

| System | Field | Purpose |
|--------|-------|---------|
| **Control Plane** (`arc_saas` DB) | `tenants.id` | Primary tenant UUID - **USE THIS** |
| App Plane (Supabase DB) | `organizations.id` | Internal organization ID - do NOT use for X-Tenant-Id |

### Mapping

The `organizations.control_plane_tenant_id` column in the Supabase `organizations` table stores the Control Plane tenant UUID. This is the value that **MUST** be used for the `X-Tenant-Id` header.

```sql
-- Supabase organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_plane_tenant_id UUID NOT NULL UNIQUE, -- ← USE THIS for X-Tenant-Id
  name TEXT NOT NULL,
  ...
);
```

### Frontend Implementation

```typescript
// ✅ CORRECT - Use control_plane_tenant_id
const tenantId = currentOrganization.control_plane_tenant_id;
headers['X-Tenant-Id'] = tenantId;

// ❌ WRONG - Do not use organization.id
const tenantId = currentOrganization.id; // This is App Plane internal ID
```

### Backend Validation

CNS service **MUST** validate that:
1. `X-Tenant-Id` header is present on all authenticated requests (except public paths)
2. Value is a valid UUID v4
3. Tenant UUID exists in Control Plane (optional check via /tenants/{id}/verify endpoint)

```python
# CNS auth middleware validation
def validate_tenant_id(tenant_id: str) -> bool:
    """Validate X-Tenant-Id header value."""
    # 1. Check UUID format
    try:
        uuid.UUID(tenant_id, version=4)
    except ValueError:
        logger.warning(f"Invalid X-Tenant-Id format: {tenant_id}")
        return False

    # 2. Optional: Verify tenant exists in Control Plane
    # response = httpx.get(f"{CONTROL_PLANE_URL}/tenants/{tenant_id}/verify")
    # return response.status_code == 200

    return True
```

### Error Responses

| Status | Error | Reason |
|--------|-------|--------|
| 400 | `MISSING_TENANT_ID` | `X-Tenant-Id` header not provided |
| 400 | `INVALID_TENANT_ID_FORMAT` | Value is not a valid UUID v4 |
| 403 | `TENANT_NOT_FOUND` | Tenant UUID does not exist in Control Plane |
| 403 | `TENANT_INACTIVE` | Tenant subscription is inactive/suspended |

---

## Gateway Path Alignment

### Current State (Misalignment)

| Component | Path Used | Port |
|-----------|-----------|------|
| Customer Portal (CBP) | `http://localhost:27200/catalog/categories` | 27200 (direct) |
| Backstage Portal | `/api/cns/catalog/categories` | Via gateway |
| CNS Dashboard | `http://localhost:27200` | 27200 (direct) |
| Services Table (docs) | `/cns/...` | Documented path |

**Problem**: Inconsistent paths lead to confusion, CORS issues, and routing errors.

### Standardized Path Specification

#### Development (Local)

| Client | Base URL | Example |
|--------|----------|---------|
| Customer Portal (CBP) | `http://localhost:27200` | `http://localhost:27200/catalog/categories` |
| Backstage Portal | `http://localhost:27200` | `http://localhost:27200/catalog/categories` |
| CNS Dashboard | `http://localhost:27200` | `http://localhost:27200/admin/mapping-gaps` |

**Rationale**: Direct connection in development for faster iteration, easier debugging.

#### Production (Gateway-Routed)

| Client | Base URL | Example |
|--------|----------|---------|
| Customer Portal (CBP) | `https://api.ananta.com/cns` | `https://api.ananta.com/cns/catalog/categories` |
| Backstage Portal | `https://api.ananta.com/cns` | `https://api.ananta.com/cns/catalog/categories` |
| CNS Dashboard | `https://api.ananta.com/cns` | `https://api.ananta.com/cns/admin/mapping-gaps` |

**Rationale**: Unified gateway in production for:
- Centralized SSL termination
- Rate limiting and DDoS protection
- Authentication/authorization enforcement
- Load balancing and service discovery

### Environment Variable Configuration

```bash
# Customer Portal (.env)
VITE_CNS_API_URL=http://localhost:27200              # Local dev
# VITE_CNS_API_URL=https://api.ananta.com/cns        # Production

# Backstage Portal (.env)
VITE_CNS_API_URL=http://localhost:27200              # Local dev
# VITE_CNS_API_URL=https://api.ananta.com/cns        # Production

# CNS Dashboard (.env)
VITE_CNS_API_URL=http://localhost:27200              # Local dev
# VITE_CNS_API_URL=https://api.ananta.com/cns        # Production
```

### Gateway Configuration (nginx/Traefik)

```nginx
# API Gateway - Production

location /cns/ {
    # Strip /cns prefix before forwarding to CNS service
    rewrite ^/cns(.*)$ $1 break;

    proxy_pass http://cns-service:27200;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Forward auth headers
    proxy_set_header Authorization $http_authorization;
    proxy_set_header X-Tenant-Id $http_x_tenant_id;

    # CORS headers (if not handled by CNS service)
    add_header Access-Control-Allow-Origin $http_origin;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
    add_header Access-Control-Allow-Headers "Authorization, X-Tenant-Id, Content-Type";
}
```

---

## Keycloak JWT Audience Validation

### Requirement

CNS service **SHOULD** validate that Keycloak JWT tokens include `cns-api` in the `aud` (audience) claim. However, this validation must be **optional** to support Keycloak clients that don't set audience.

### Token Audience Claim

#### Expected Token Structure

```json
{
  "iss": "http://localhost:8180/realms/ananta-saas",
  "sub": "1d07c925-48ba-4b4e-b28f-665041a012ca",
  "aud": ["cns-api", "account"],  // ← Should include cns-api
  "exp": 1765740748,
  "iat": 1765737148,
  "realm_access": {
    "roles": ["admin", "engineer"]
  }
}
```

#### Keycloak Client Configuration

To add `cns-api` to audience claim:

1. **Keycloak Admin Console** → Clients → `cbp-frontend`
2. **Mappers** → Create Protocol Mapper
   - **Mapper Type**: Audience
   - **Name**: `cns-api-audience`
   - **Included Client Audience**: `cns-api` (or create new client)
   - **Add to access token**: ON

**Alternative**: Create dedicated `cns-api` client and add it as an audience mapper to all relevant clients.

### CNS Middleware Validation Logic

```python
# app/middleware/auth_middleware.py

# Verify audience (if configured and present in token)
if auth0_audience:  # auth0_audience = "cns-api" from env
    aud = payload.get("aud")
    if aud is not None:  # Only validate if token has an audience claim
        # aud can be string or array
        if isinstance(aud, list):
            if auth0_audience not in aud:
                logger.warning(f"[AuthMiddleware] Audience mismatch: {aud}")
                return None
        elif aud != auth0_audience:
            logger.warning(f"[AuthMiddleware] Audience mismatch: {aud}")
            return None
    else:
        # Keycloak admin-cli and some other clients don't set audience
        logger.debug("[AuthMiddleware] Token has no audience claim, skipping validation")
```

**Behavior**:
- ✅ If `aud` claim present and includes `cns-api` → Accept
- ✅ If `aud` claim absent (e.g., admin-cli tokens) → Accept with warning
- ❌ If `aud` claim present but doesn't include `cns-api` → Reject

### Environment Configuration

```bash
# CNS Service (.env)
AUTH0_AUDIENCE=cns-api           # Required audience in JWT tokens
AUTH0_AUDIENCE_REQUIRED=false    # Optional - allow tokens without aud claim
```

### Rollout Strategy

**Phase 1** (Current):
- `AUTH0_AUDIENCE_REQUIRED=false` - Log warnings but accept tokens without audience

**Phase 2** (After Keycloak mappers configured):
- Monitor logs for tokens without `cns-api` audience
- Update Keycloak client mappers to add `cns-api` audience

**Phase 3** (Production Hardening):
- `AUTH0_AUDIENCE_REQUIRED=true` - Reject tokens without `cns-api` audience
- Update error messages to guide users to re-authenticate

---

## Header vs. Token Claim Validation

### Tenant ID Source Priority

CNS middleware validates tenant context from multiple sources with this priority:

| Priority | Source | Header/Claim | Used For |
|----------|--------|--------------|----------|
| 1 | HTTP Header | `X-Tenant-Id` | **Primary tenant isolation** |
| 2 | JWT Claim | `tenantId` or `organization_id` | Fallback/validation |
| 3 | Database Lookup | User's default organization | Last resort (staff users) |

### Validation Logic

```python
# app/middleware/auth_middleware.py

async def extract_tenant_id(request: Request, jwt_payload: dict) -> Optional[str]:
    """
    Extract tenant ID with fallback priority:
    1. X-Tenant-Id header (primary)
    2. JWT tenantId claim (fallback)
    3. User's default organization (staff/admin only)
    """
    # Priority 1: X-Tenant-Id header
    tenant_id = request.headers.get("X-Tenant-Id")
    if tenant_id:
        if not validate_tenant_id(tenant_id):
            raise AuthContextError(
                AuthErrorCode.INVALID_TENANT_ID,
                "X-Tenant-Id header contains invalid UUID"
            )
        logger.debug(f"[AuthMiddleware] Tenant ID from header: {tenant_id}")
        return tenant_id

    # Priority 2: JWT tenantId claim
    tenant_id = jwt_payload.get("tenantId") or jwt_payload.get("organization_id")
    if tenant_id:
        if not validate_tenant_id(tenant_id):
            logger.warning(f"[AuthMiddleware] Invalid tenantId in JWT: {tenant_id}")
            return None
        logger.debug(f"[AuthMiddleware] Tenant ID from JWT: {tenant_id}")
        return tenant_id

    # Priority 3: User's default organization (staff/super_admin only)
    user_role = jwt_payload.get("role") or extract_role_from_jwt(jwt_payload)
    if user_role in ["super_admin", "platform_admin"]:
        # Staff users can operate without tenant context for multi-tenant operations
        logger.debug("[AuthMiddleware] Staff user without tenant context (allowed)")
        return None

    # Customer users MUST provide tenant ID
    logger.warning(
        f"[AuthMiddleware] Missing tenant ID for user: "
        f"sub={jwt_payload.get('sub')}"
    )
    return None
```

### Cross-Validation (Defense in Depth)

When both header and JWT claim are present, CNS **SHOULD** validate they match:

```python
# Optional: Cross-validate header vs. JWT claim
header_tenant_id = request.headers.get("X-Tenant-Id")
jwt_tenant_id = jwt_payload.get("tenantId")

if header_tenant_id and jwt_tenant_id:
    if header_tenant_id != jwt_tenant_id:
        logger.warning(
            f"[AuthMiddleware] Tenant ID mismatch: "
            f"header={header_tenant_id} jwt={jwt_tenant_id}"
        )
        # SECURITY: Prefer header (explicitly set by client)
        # But log for investigation
        # Could optionally reject request in strict mode
```

### Staff/Admin Multi-Tenant Access

Super admins and platform staff need to access multiple tenants without re-authentication:

```python
def can_access_tenant(user_role: str, user_tenant_id: Optional[str], requested_tenant_id: str) -> bool:
    """Check if user can access the requested tenant."""
    # Super admins can access any tenant
    if user_role in ["super_admin", "platform_admin"]:
        return True

    # Regular users can only access their own tenant
    return user_tenant_id == requested_tenant_id
```

---

## VPN/IP-Allowlisted Ingress Rules

### Security Model

CNS service operates in two security modes based on environment:

| Environment | Access Method | Requirements |
|-------------|---------------|--------------|
| **Development** (localhost) | Direct access | No restrictions |
| **Staging** (internal VPN) | VPN + JWT auth | IP allowlist + JWT validation |
| **Production** (internet) | API Gateway + JWT auth | Public access with strict JWT validation |

### Network-Level Access Control

#### Development (No Restrictions)

```yaml
# docker-compose.yml
services:
  cns-service:
    ports:
      - "27200:27200"  # Exposed to localhost only
    environment:
      - ENVIRONMENT=development
      - REQUIRE_VPN=false
```

#### Staging (VPN + IP Allowlist)

```nginx
# API Gateway - Staging

# IP Allowlist for CNS service
geo $cns_allowed {
    default 0;
    10.0.0.0/8 1;           # Internal VPN range
    172.16.0.0/12 1;        # Docker network
    192.168.1.0/24 1;       # Office network
}

location /cns/ {
    # Block requests from non-allowed IPs
    if ($cns_allowed = 0) {
        return 403 "Access denied - VPN required";
    }

    proxy_pass http://cns-service:27200;
    # ... (rest of proxy config)
}
```

#### Production (Public Gateway + Strict JWT)

```nginx
# API Gateway - Production

location /cns/ {
    # Rate limiting
    limit_req zone=api_limit burst=20 nodelay;

    # DDoS protection
    limit_conn addr 10;

    # JWT validation (can be done by gateway or service)
    # auth_request /api/auth/validate;

    proxy_pass http://cns-service:27200;
    # ... (rest of proxy config)
}
```

### CNS Service IP Validation (Optional)

For defense in depth, CNS can also validate source IP:

```python
# app/middleware/auth_middleware.py

ALLOWED_IP_RANGES = [
    "10.0.0.0/8",       # Internal VPN
    "172.16.0.0/12",    # Docker network
    "192.168.1.0/24",   # Office network
]

def is_allowed_ip(client_ip: str) -> bool:
    """Check if client IP is in allowed ranges (VPN mode)."""
    import ipaddress

    if not settings.REQUIRE_VPN:
        return True  # VPN not required in development

    try:
        client = ipaddress.ip_address(client_ip)
        for range_str in ALLOWED_IP_RANGES:
            network = ipaddress.ip_network(range_str)
            if client in network:
                return True
        return False
    except ValueError:
        logger.error(f"Invalid IP address: {client_ip}")
        return False
```

### Cutover Step 5: VPN/IP Ingress Rules

When migrating from development to staging/production:

1. **Week -2 (Pre-Cutover)**:
   - Deploy API gateway in staging environment
   - Configure IP allowlist for internal VPN range
   - Test frontend → gateway → CNS connectivity

2. **Week -1 (Testing)**:
   - Validate JWT authentication through gateway
   - Test tenant isolation with X-Tenant-Id header
   - Load test with production-like traffic

3. **Cutover Day**:
   - Update frontend `VITE_CNS_API_URL` to use gateway URL
   - Enable IP allowlist on gateway (if VPN mode)
   - Monitor logs for authentication failures

4. **Week +1 (Post-Cutover)**:
   - Review access logs for blocked IPs
   - Adjust IP allowlist if needed
   - Enable strict audience validation (`AUTH0_AUDIENCE_REQUIRED=true`)

---

## Implementation Checklist

### Frontend (Customer Portal, Backstage Portal)

- [ ] Use `control_plane_tenant_id` for `X-Tenant-Id` header (not `organization.id`)
- [ ] Configure `VITE_CNS_API_URL` environment variable
- [ ] Inject `X-Tenant-Id` header in all CNS API requests
- [ ] Handle 400/403 tenant ID errors gracefully
- [ ] Update error messages to guide users to re-authenticate

### Backend (CNS Service)

- [ ] Validate `X-Tenant-Id` header format (UUID v4)
- [ ] Implement tenant ID extraction with fallback priority (header → JWT → default)
- [ ] Add optional audience validation (`cns-api` in JWT `aud` claim)
- [ ] Cross-validate header vs. JWT claim tenant IDs
- [ ] Support staff/admin multi-tenant access
- [ ] Add IP allowlist validation (if VPN mode enabled)

### Keycloak Configuration

- [ ] Add `cns-api` audience mapper to `cbp-frontend` client
- [ ] Add `cns-api` audience mapper to `backstage-portal` client
- [ ] Add `tenantId` claim mapper with `control_plane_tenant_id` value
- [ ] Test JWT token structure with `aud` and `tenantId` claims

### Infrastructure (API Gateway)

- [ ] Configure `/cns/` path routing to CNS service
- [ ] Add CORS headers for allowed origins
- [ ] Implement rate limiting and DDoS protection
- [ ] Set up IP allowlist for staging/VPN mode
- [ ] Configure SSL termination and HTTP→HTTPS redirect

### Documentation

- [ ] Update API documentation with X-Tenant-Id header requirement
- [ ] Document error codes for missing/invalid tenant IDs
- [ ] Add examples of correct JWT token structure
- [ ] Create troubleshooting guide for 401/403 errors
- [ ] Update deployment runbook with cutover steps

### Testing

- [ ] Test with valid `X-Tenant-Id` header (200 OK)
- [ ] Test with missing `X-Tenant-Id` header (400 Bad Request)
- [ ] Test with invalid UUID format (400 Bad Request)
- [ ] Test with wrong tenant ID (403 Forbidden)
- [ ] Test JWT without `aud` claim (should pass if `AUTH0_AUDIENCE_REQUIRED=false`)
- [ ] Test JWT with `aud=["cns-api"]` (should pass)
- [ ] Test JWT with `aud=["other-service"]` (should fail)
- [ ] Test staff user without `X-Tenant-Id` (should pass for multi-tenant operations)

---

## References

### Related Documentation

- [App Plane README](../README.md) - Overall architecture
- [CNS Service README](../services/cns-service/README.md) - CNS service documentation
- [Auth Middleware](../services/cns-service/app/middleware/auth_middleware.py) - Implementation reference
- [Authorization](../services/cns-service/app/core/authorization.py) - RBAC implementation

### External References

- [JWT RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519) - JWT specification
- [Keycloak Documentation](https://www.keycloak.org/docs/latest/) - Keycloak SSO
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/) - FastAPI auth patterns

---

**Document Status**: Complete
**Review Status**: Pending review by Platform Team
**Next Review**: Before production cutover
