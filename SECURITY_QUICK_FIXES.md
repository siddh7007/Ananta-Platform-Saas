# Security Quick Fixes - Immediate Actions Required

**Priority:** CRITICAL
**Timeline:** 7 days
**Status:** Action Required

---

## 1. JWT Signature Verification (CRITICAL)

### Issue
JWT signatures not verified in development mode, allowing forged tokens.

### Files to Fix
- `e:\Work\Ananta-Platform-Saas\arc-saas\services\tenant-management-service\src\providers\bearer-token-verifier.provider.ts`

### Fix
```typescript
// Replace lines 101-109 with:
export class BearerTokenVerifierProvider
  implements Provider<VerifyFunction.BearerFn<IAuthUserWithPermissions>>
{
  value(): VerifyFunction.BearerFn<IAuthUserWithPermissions> {
    return async (token: string): Promise<IAuthUserWithPermissions | null> => {
      const jwtSecret = process.env.JWT_SECRET;
      const keycloakUrl = process.env.KEYCLOAK_URL;
      const keycloakRealm = process.env.KEYCLOAK_REALM;

      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }

      // Determine if this is a Keycloak token (starts with 'ey' and has 3 parts)
      const parts = token.split('.');
      const isKeycloakToken = parts.length === 3 && parts[0].startsWith('ey');

      if (isKeycloakToken && keycloakUrl && keycloakRealm) {
        // Keycloak RS256 token - MUST verify signature
        try {
          const jwksUrl = `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/certs`;
          const jwksClient = new PyJWKClient(jwksUrl);
          const signingKey = jwksClient.get_signing_key_from_jwt(token);

          const decoded = verify(token, signingKey.key, {
            algorithms: ['RS256'],
            issuer: `${keycloakUrl}/realms/${keycloakRealm}`,
          }) as TokenPayload;

          // Extract permissions and return user
          return this.extractUserFromToken(decoded);
        } catch (error) {
          console.error('Keycloak token verification failed:', error);
          return null;
        }
      } else {
        // Symmetric HS256 token (for testing only)
        try {
          const decoded = verify(token, jwtSecret, {
            algorithms: ['HS256'],
            issuer: process.env.JWT_ISSUER || 'arc-saas',
          }) as TokenPayload;

          return this.extractUserFromToken(decoded);
        } catch (error) {
          console.error('JWT verification failed:', error);
          return null;
        }
      }
    };
  }

  private extractUserFromToken(decoded: TokenPayload): IAuthUserWithPermissions {
    const userId = decoded.sub ?? decoded.id ?? '';
    let permissions: string[] = decoded.permissions || [];

    // Extract from Keycloak roles
    if (permissions.length === 0 && decoded.realm_access?.roles) {
      for (const role of decoded.realm_access.roles) {
        const rolePermissions = KEYCLOAK_ROLE_TO_PERMISSIONS[role];
        if (rolePermissions) {
          permissions = [...permissions, ...rolePermissions];
        }
      }
    }

    // Remove duplicates
    permissions = [...new Set(permissions)];

    // REMOVE: Auto-elevation in development
    // SECURITY: Require explicit role assignment

    const tenantId = decoded.tenantId ?? decoded.userTenantId ?? userId;
    return {
      id: userId,
      username: userId,
      userTenantId: tenantId,
      tenantId: tenantId,
      permissions,
    };
  }
}
```

### Dependencies
```bash
cd arc-saas/services/tenant-management-service
npm install jwks-rsa
```

---

## 2. Remove Hardcoded Secrets (CRITICAL)

### Issue
Secrets hardcoded in docker-compose.yml files, committed to repository.

### Files to Fix
- `e:\Work\Ananta-Platform-Saas\arc-saas\docker-compose.yml`
- `e:\Work\Ananta-Platform-Saas\app-plane\docker-compose.yml`

### Fix

#### Step 1: Create .env file (NOT committed to git)
```bash
# arc-saas/.env (ADD TO .gitignore)
JWT_SECRET=$(openssl rand -base64 32)
MINIO_ROOT_USER=admin-$(openssl rand -hex 4)
MINIO_ROOT_PASSWORD=$(openssl rand -base64 24)
NOVU_SECRET_KEY=$(openssl rand -base64 32)
STORE_ENCRYPTION_KEY=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 16)
REDIS_PASSWORD=$(openssl rand -base64 16)
```

#### Step 2: Update docker-compose.yml
```yaml
# Replace hardcoded values with env vars:
services:
  tenant-management-service:
    environment:
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET required}
      JWT_ISSUER: ${JWT_ISSUER:-http://localhost:8180/realms/ananta-saas}

  minio:
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:?MINIO_ROOT_USER required}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD required}

  novu-api:
    environment:
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET required}
      NOVU_SECRET_KEY: ${NOVU_SECRET_KEY:?NOVU_SECRET_KEY required}
      STORE_ENCRYPTION_KEY: ${STORE_ENCRYPTION_KEY:?STORE_ENCRYPTION_KEY required}
```

#### Step 3: Update .gitignore
```bash
# Add to .gitignore
.env
.env.local
.env.production
*.pem
*.key
secrets/
```

#### Step 4: Generate secrets
```bash
# Run this script to generate secure secrets
cd arc-saas
cat > generate-secrets.sh << 'EOF'
#!/bin/bash
echo "# Generated secrets - DO NOT COMMIT" > .env
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
echo "MINIO_ROOT_USER=admin-$(openssl rand -hex 4)" >> .env
echo "MINIO_ROOT_PASSWORD=$(openssl rand -base64 24)" >> .env
echo "NOVU_SECRET_KEY=$(openssl rand -base64 32)" >> .env
echo "STORE_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
echo "POSTGRES_PASSWORD=$(openssl rand -base64 16)" >> .env
echo "REDIS_PASSWORD=$(openssl rand -base64 16)" >> .env
echo "" >> .env
echo "# Keycloak" >> .env
echo "KEYCLOAK_ADMIN_PASSWORD=$(openssl rand -base64 16)" >> .env
echo "Secrets generated in .env"
EOF
chmod +x generate-secrets.sh
./generate-secrets.sh
```

---

## 3. Add Rate Limiting to All Endpoints (HIGH)

### Issue
Most API endpoints lack rate limiting, vulnerable to brute force and DoS.

### Files to Fix
- `e:\Work\Ananta-Platform-Saas\arc-saas\services\tenant-management-service\src\application.ts`

### Fix

#### Step 1: Configure global rate limiting
```typescript
// Add to application.ts constructor
import {RateLimitSecurityBindings, RateLimitMetadata} from 'loopback4-ratelimiter';

// In constructor, after components:
this.bind(RateLimitSecurityBindings.CONFIG).to({
  type: RateLimitMetadata.REDIS,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  max: 100, // Default 100 requests
  windowMs: 60000, // Per minute
  keyGenerator: (req: Request) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    const user = (req as any).user;
    return user?.id || req.ip || 'anonymous';
  },
});

// Apply rate limiting middleware globally
this.middleware(RateLimitActionMiddleware);
```

#### Step 2: Add per-endpoint rate limiting
```typescript
// In critical controllers (auth, tenant creation, etc.)
import {ratelimit} from 'loopback4-ratelimiter';

export class TenantController {
  @ratelimit(true, {
    max: 10,  // 10 tenant creations per hour
    windowMs: 3600000,
  })
  @post('/tenants')
  async create(...) { }

  @ratelimit(true, {
    max: 5,  // 5 login attempts per 5 minutes
    windowMs: 300000,
  })
  @post('/auth/login')
  async login(...) { }
}
```

---

## 4. Add UUID Validation (HIGH)

### Issue
Controllers accept string IDs without format validation, causing database errors.

### Files to Fix
- All controllers in `arc-saas/services/tenant-management-service/src/controllers/`

### Fix

#### Step 1: Create validation decorator
```typescript
// src/decorators/validate-uuid.decorator.ts
import {HttpErrors} from '@loopback/rest';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUUID(id: string, fieldName: string = 'id'): void {
  if (!UUID_REGEX.test(id)) {
    throw new HttpErrors.BadRequest(`Invalid ${fieldName} format. Must be a valid UUID.`);
  }
}

// Create param decorator
export function ValidatedUUID(name: string = 'id') {
  return function (target: any, propertyKey: string, parameterIndex: number) {
    const existingDecorators = Reflect.getMetadata('design:paramtypes', target, propertyKey) || [];
    existingDecorators[parameterIndex] = {validate: validateUUID, name};
    Reflect.defineMetadata('design:paramtypes', existingDecorators, target, propertyKey);
  };
}
```

#### Step 2: Apply to controllers
```typescript
// Update all controllers
import {validateUUID} from '../decorators/validate-uuid.decorator';

export class TenantController {
  @get('/tenants/{id}')
  async findById(
    @param.path.string('id') id: string,
  ): Promise<Tenant> {
    validateUUID(id, 'tenant ID');  // Add this line
    return this.tenantRepository.findById(id);
  }
}
```

---

## 5. CNS Service JWT Verification (MEDIUM)

### Issue
CNS service has optional JWT signature verification, may be disabled in production.

### Files to Fix
- `e:\Work\Ananta-Platform-Saas\app-plane\services\cns-service\app\auth\dependencies.py`
- `e:\Work\Ananta-Platform-Saas\app-plane\services\cns-service\app\config.py`

### Fix

#### Step 1: Update config to default to verification
```python
# app/config.py
class Settings(BaseSettings):
    # SECURITY: Always verify JWT signatures by default
    AUTH0_VERIFY_SIGNATURE: bool = True  # Changed from False
    AUTH0_DOMAIN: Optional[str] = None
    AUTH0_AUDIENCE: Optional[str] = None

    # Add startup validation
    @validator('AUTH0_VERIFY_SIGNATURE', always=True)
    def validate_signature_verification(cls, v, values):
        if not v and os.getenv('NODE_ENV') == 'production':
            raise ValueError(
                "AUTH0_VERIFY_SIGNATURE cannot be False in production. "
                "Set AUTH0_VERIFY_SIGNATURE=true"
            )
        if not v:
            logger.warning(
                "JWT signature verification is DISABLED. "
                "This should only be used in local development."
            )
        return v
```

#### Step 2: Add startup check
```python
# app/main.py
@app.on_event("startup")
async def startup_validation():
    settings = get_settings()

    # Verify critical security settings
    if not settings.AUTH0_VERIFY_SIGNATURE:
        logger.warning(
            "[SECURITY WARNING] JWT signature verification is disabled! "
            "Tokens are not cryptographically verified."
        )

    if settings.AUTH0_VERIFY_SIGNATURE and not settings.AUTH0_DOMAIN:
        raise ValueError(
            "AUTH0_DOMAIN is required when AUTH0_VERIFY_SIGNATURE=true"
        )
```

---

## 6. Security Headers Middleware (MEDIUM)

### Issue
API responses lack security headers (X-Content-Type-Options, X-Frame-Options, etc.)

### Files to Create
- `e:\Work\Ananta-Platform-Saas\arc-saas\services\tenant-management-service\src\middleware\security-headers.middleware.ts`

### Fix

#### Step 1: Create middleware
```typescript
// src/middleware/security-headers.middleware.ts
import {
  Middleware,
  MiddlewareContext,
  Provider,
  inject,
  ValueOrPromise,
} from '@loopback/core';
import {RequestContext} from '@loopback/rest';

export class SecurityHeadersMiddleware implements Provider<Middleware> {
  constructor() {}

  value(): Middleware {
    return async (ctx: MiddlewareContext, next: () => ValueOrPromise<void>) => {
      await next();

      const requestCtx = ctx as RequestContext;
      const response = requestCtx.response;

      if (!response) return;

      // Set security headers
      response.set('X-Content-Type-Options', 'nosniff');
      response.set('X-Frame-Options', 'DENY');
      response.set('X-XSS-Protection', '1; mode=block');
      response.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      response.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

      // HSTS only in production
      if (process.env.NODE_ENV === 'production') {
        response.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }

      // Basic CSP (adjust as needed)
      response.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; object-src 'none';"
      );
    };
  }
}
```

#### Step 2: Register in application
```typescript
// src/application.ts
import {SecurityHeadersMiddleware} from './middleware/security-headers.middleware';

export class TenantMgmtServiceApplication extends BootMixin(
  RepositoryMixin(RestApplication),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // Add security headers middleware (runs for all requests)
    this.middleware(SecurityHeadersMiddleware);

    // ... rest of constructor
  }
}
```

---

## 7. Container Security - Run as Non-Root (MEDIUM)

### Issue
Docker containers run as root user, increasing attack surface.

### Files to Fix
- `e:\Work\Ananta-Platform-Saas\arc-saas\services\tenant-management-service\Dockerfile`
- `e:\Work\Ananta-Platform-Saas\app-plane\services\cns-service\Dockerfile`

### Fix

#### Update Dockerfile (Node.js services)
```dockerfile
FROM node:20-alpine

# Create non-root user
RUN addgroup -g 1001 appuser && \
    adduser -u 1001 -G appuser -s /bin/sh -D appuser

WORKDIR /app

# Copy package files as root
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code and change ownership
COPY --chown=appuser:appuser . .

# Build application
RUN npm run build

# Switch to non-root user
USER appuser

# Expose port and run
EXPOSE 14000
CMD ["node", "dist/index.js"]
```

#### Update Dockerfile (Python services)
```dockerfile
FROM python:3.11-slim

# Create non-root user
RUN groupadd -g 1001 appuser && \
    useradd -u 1001 -g appuser -m -s /bin/bash appuser

WORKDIR /app

# Copy requirements as root
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and change ownership
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Expose port and run
EXPOSE 27200
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "27200"]
```

---

## 8. Add CORS Configuration (MEDIUM)

### Issue
CORS not explicitly configured, may allow unauthorized origins.

### Files to Fix
- `e:\Work\Ananta-Platform-Saas\arc-saas\services\tenant-management-service\src\application.ts`

### Fix
```typescript
// In application.ts constructor
this.bind('rest.cors').to({
  origin: (process.env.CORS_ORIGINS || 'http://localhost:27555').split(','),
  credentials: true,
  maxAge: 86400,  // 24 hours
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Lead-Token',
    'X-Organization-ID',
    'X-Workspace-ID',
    'X-User-Email',
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page',
    'X-Per-Page',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
  ],
});
```

#### Add to .env.example
```bash
# CORS Configuration (comma-separated origins)
CORS_ORIGINS=http://localhost:27555,http://localhost:27100,http://localhost:3000
```

---

## 9. Verification Checklist

After applying all fixes, verify:

```bash
# 1. JWT verification is working
curl -H "Authorization: Bearer invalid-token" http://localhost:14000/tenants
# Expected: 401 Unauthorized

# 2. Secrets are not hardcoded
grep -r "your-jwt-secret-change-in-production" arc-saas/
# Expected: No results

# 3. Rate limiting is active
for i in {1..150}; do curl http://localhost:14000/ping; done
# Expected: 429 Too Many Requests after 100 requests

# 4. UUID validation works
curl http://localhost:14000/tenants/invalid-id
# Expected: 400 Bad Request "Invalid ID format"

# 5. Security headers are set
curl -I http://localhost:14000/ping | grep -i "x-content-type-options"
# Expected: X-Content-Type-Options: nosniff

# 6. CORS is configured
curl -H "Origin: http://evil.com" http://localhost:14000/ping
# Expected: No Access-Control-Allow-Origin header

# 7. Containers run as non-root
docker inspect arc-saas-tenant-mgmt | grep -i "User"
# Expected: "User": "1001" or "appuser"
```

---

## 10. Deployment Steps

### Step 1: Development Environment
```bash
# 1. Backup current setup
cd e:\Work\Ananta-Platform-Saas
git checkout -b security-fixes

# 2. Apply fixes from this document

# 3. Generate new secrets
cd arc-saas
./generate-secrets.sh

# 4. Restart services
docker-compose down
docker-compose up --build -d

# 5. Run verification tests
./scripts/verify-security.sh
```

### Step 2: Production Deployment
```bash
# 1. Generate production secrets (use KMS/Vault)
# 2. Update environment-specific .env files
# 3. Deploy with zero-downtime strategy
# 4. Monitor logs for authentication errors
# 5. Run security smoke tests
```

---

## Support

If you encounter issues applying these fixes:
1. Check logs: `docker-compose logs -f tenant-management-service`
2. Review full security audit: `SECURITY_AUDIT_REPORT.md`
3. Contact: platform-security@ananta.com

**Remember:** Security is a continuous process, not a one-time fix!
