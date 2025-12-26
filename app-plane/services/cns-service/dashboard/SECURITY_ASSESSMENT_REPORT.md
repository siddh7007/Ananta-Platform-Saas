# CNS Dashboard - Authentication & Authorization Security Assessment

**Date**: 2025-12-19
**Reviewer**: Security Engineer Agent
**Scope**: CNS Dashboard (App Plane - Platform Admin Tool)
**Location**: `e:\Work\Ananta-Platform-Saas\app-plane\services\cns-service\dashboard\`

---

## Executive Summary

The CNS Dashboard implements a **dual-authentication model** with Auth0/Keycloak for UI authentication and a static admin token for API authorization. While the UI authentication is well-implemented, there are **critical security gaps** in role-based access control (RBAC), API authorization, and alignment with platform standards.

**Security Posture**: **MODERATE RISK**

### Critical Findings
1. **CRITICAL**: Static admin token used for all API calls - no user-level authorization
2. **HIGH**: No RBAC implementation - all authenticated users have full admin access
3. **HIGH**: Role hierarchy not enforced (missing 5-level hierarchy from platform)
4. **MEDIUM**: No route-level protection based on roles
5. **MEDIUM**: Token exposed in localStorage with CSP only as mitigation

### Strengths
- Well-documented security architecture (SECURITY.md)
- Session timeout with cross-tab synchronization
- CSP headers and security middleware
- Dual auth provider support (Auth0 + Keycloak)
- Comprehensive token management

---

## 1. Authentication Architecture

### Current Implementation

```
┌─────────────────────────────────────────────────────────────┐
│                    CNS Dashboard Flow                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User Login (Auth0/Keycloak)                             │
│     └─> Organization membership verified                     │
│     └─> Roles extracted from JWT                            │
│                                                              │
│  2. UI Access Granted                                        │
│     └─> localStorage: user_id, organization_id, user_role   │
│     └─> Auth0 roles stored but NOT enforced                 │
│                                                              │
│  3. API Calls (CNS Backend)                                  │
│     └─> Authorization: Bearer {STATIC_ADMIN_TOKEN}          │
│     └─> NO user-level authorization                         │
│     └─> ALL users have same API access                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Auth Providers

#### Auth0 Provider (`createAuth0AuthProvider.ts`)
**Status**: IMPLEMENTED
**Security Level**: GOOD with caveats

**Features**:
- Organization enforcement (platformOrgId check)
- Role extraction from custom claims namespace
- allowedRoles parameter for platform admin access
- Automatic token refresh
- Hybrid mode: Middleware sync + Direct JWT

**Security Concerns**:
1. **Role mapping implemented but NOT enforced**:
   ```typescript
   // Lines 181-198: deriveRoleFromAuth0Roles exists
   const deriveRoleFromAuth0Roles = (auth0Roles: string[]): string => {
     if (auth0Roles.some(r => ['platform:super_admin', 'super_admin'].includes(r))) {
       return 'super_admin';
     }
     if (auth0Roles.some(r => ['platform:admin', 'admin', 'platform:staff'].includes(r))) {
       return 'admin';
     }
     // ...but roles are only stored in localStorage, never checked
   }
   ```

2. **Global role check exists but incomplete**:
   - Lines 570-644: allowedRoles checked in checkAuth
   - Fallback to platformOrgId membership (too permissive)
   - No per-route or per-action enforcement

3. **Admin login route protection** (GOOD):
   - Lines 646-660: Verifies org_id for /admin-login
   - Forces re-authentication if missing

#### Keycloak Provider (`keycloakAuthProvider.ts`)
**Status**: IMPLEMENTED
**Security Level**: BASIC

**Features**:
- SSO across portals
- Role extraction from realm_access and resource_access
- Helper functions: `hasRole()`, `isAdmin()`, `isSuperAdmin()`

**Security Concerns**:
1. **Helper functions exist but NOT used**:
   ```typescript
   // Lines 160-178: Functions defined
   export const hasRole = async (role: string): Promise<boolean>
   export const isAdmin = async (): Promise<boolean>
   export const isSuperAdmin = async (): Promise<boolean>

   // BUT: No usage found in codebase
   ```

2. **getPermissions returns raw roles** (Line 117):
   - Returns roles array, but no component uses it for access control

---

## 2. RBAC Implementation Analysis

### Platform Standard (from CLAUDE.md)

```typescript
// Expected 5-Level Role Hierarchy
Level 5: super_admin  - Platform staff (Ananta employees)
Level 4: owner        - Organization owner
Level 3: admin        - Organization admin
Level 2: engineer     - Technical user (manage BOMs, components)
Level 1: analyst      - Read-only user

// Expected Keycloak Mappings
super_admin: ['platform:super_admin', 'platform-super-admin', 'super-admin', ...]
owner:       ['owner', 'org-owner', 'billing_admin']
admin:       ['platform:admin', 'tenant-admin', 'admin', ...]
engineer:    ['platform:engineer', 'engineer', 'staff', 'developer', ...]
analyst:     ['analyst', 'user', 'viewer', 'member']
```

### CNS Dashboard Implementation

**Status**: **MISSING** ❌

**Evidence**:
1. **No role-parser.ts equivalent**:
   ```bash
   # Expected file (from CLAUDE.md):
   arc-saas/apps/admin-app/src/lib/role-parser.ts

   # CNS Dashboard:
   grep -r "hasMinimumRole\|isSuperAdmin\|isOwner" src/
   # Result: NONE (except Keycloak helpers that aren't used)
   ```

2. **No navigation manifest**:
   - Admin-app has `src/config/navigation.ts` with role-gated resources
   - CNS Dashboard: All resources visible to ALL authenticated users

3. **No access control provider**:
   ```typescript
   // Expected (from admin-app pattern):
   <Admin accessControlProvider={accessControlProvider}>

   // CNS Dashboard (App.tsx line 134):
   <Admin
     dataProvider={dataProvider}
     authProvider={selectedAuthProvider}
     // NO accessControlProvider
   >
   ```

### Gap Analysis

| Feature | Platform Standard | CNS Dashboard | Status |
|---------|------------------|---------------|--------|
| 5-Level Hierarchy | ✅ Implemented | ❌ Missing | **GAP** |
| Role Parsing | ✅ role-parser.ts | ❌ No equivalent | **GAP** |
| Navigation Manifest | ✅ Config-driven | ❌ Hardcoded | **GAP** |
| Route Guards | ✅ Role-gated | ❌ None | **CRITICAL GAP** |
| Access Control Provider | ✅ Implemented | ❌ Missing | **GAP** |
| hasMinimumRole() | ✅ Available | ❌ Missing | **GAP** |

---

## 3. API Authorization Analysis

### Data Provider (`dataProvider.ts`)

**Status**: **CRITICAL SECURITY ISSUE** 🚨

**Current Implementation** (Lines 1-33):
```typescript
/**
 * SECURITY MODEL - KNOWN LIMITATION:
 * This data provider uses a static admin token (VITE_CNS_ADMIN_TOKEN)
 * for CNS API calls. Auth0 authenticates the UI, but API calls use
 * the admin token header, not Auth0 tokens.
 *
 * RESIDUAL RISK:
 * - Anyone who discovers VITE_CNS_ADMIN_TOKEN can call CNS API directly
 * - No server-side Auth0 token validation
 * - Relies on UI-level Auth0 enforcement only
 */
```

**Code Analysis**:
```typescript
// Lines 44-54: httpClient always uses admin token
const httpClient = (url: string, options: fetchUtils.Options = {}) => {
  const adminHeaders = getAdminAuthHeaders();
  const headers = new Headers(options.headers);

  // Add admin Authorization header if available
  if (adminHeaders && typeof adminHeaders === 'object' && 'Authorization' in adminHeaders) {
    headers.set('Authorization', String(adminHeaders.Authorization));
  }

  return fetchUtils.fetchJson(url, { ...options, headers });
};
```

**Token Management** (`config/api.ts`):
```typescript
// Lines 114-138: getAdminAuthHeaders()
export function getAdminAuthHeaders(): HeadersInit | undefined {
  // ALWAYS use admin token, NOT Auth0 token
  const envToken = normalizeToken(BUILD_TIME_ADMIN_TOKEN);
  const lsToken = localStorage.getItem('cns_admin_api_token');
  const token = lsToken ?? envToken;

  return token ? { Authorization: `Bearer ${token}` } : undefined;
}
```

### Security Issues

1. **All users share the same API token**:
   - No user-level granularity
   - Cannot audit individual actions
   - Cannot revoke access for specific users

2. **Token stored in localStorage**:
   ```typescript
   // utils/adminToken.ts: Fetches default token from API
   localStorage.setItem('cns_admin_api_token', token);
   ```
   - Vulnerable to XSS (mitigated by CSP)
   - Persists across sessions
   - Accessible to all browser scripts

3. **No multi-tenant isolation at API level**:
   - TenantContext provides organization_id for UI
   - But API calls use admin token with full access
   - Tenant filtering happens client-side only

### Mitigation Status

**Documented** (SECURITY.md lines 21-29):
```
MITIGATION OPTIONS:
1. Enable Auth0 on CNS API (set AUTH0_ENABLED=true)
2. CNS middleware supports Auth0 RS256 validation
3. Update dataProvider to use Auth0 access token

TO ENABLE DEFENSE-IN-DEPTH:
- Set AUTH0_ENABLED=true on cns-service
- CNS API will validate Auth0 tokens AND admin token
```

**Status**: NOT IMPLEMENTED (documentation only)

---

## 4. Route Protection

### Current State

**NO route-level protection implemented**

**Evidence**:
```typescript
// App.tsx lines 143-172: All routes are public
<CustomRoutes>
  <Route path="/customer/uploads" element={<CustomerUploadsList />} />
  <Route path="/quality-queue" element={<QualityQueue />} />
  <Route path="/config" element={<EnrichmentConfigPage />} />
  // ... ALL routes accessible to ANY authenticated user
</CustomRoutes>
```

### Platform Standard (from CLAUDE.md)

```typescript
// Expected pattern (admin-app):
<CustomRoutes>
  <Route
    path="/billing"
    element={<ProtectedRoute minRole="super_admin"><Billing /></ProtectedRoute>}
  />
  <Route
    path="/tenants"
    element={<ProtectedRoute minRole="admin"><Tenants /></ProtectedRoute>}
  />
</CustomRoutes>
```

**CNS Dashboard**: NO ProtectedRoute component exists

### Resource-Level Access

**Expected** (from CLAUDE.md):
```typescript
<Resource
  name="quality-queue"
  list={QualityQueue}
  options={{ minRole: 'engineer' }}  // Staff-only
/>
```

**CNS Dashboard** (App.tsx lines 174-276):
```typescript
<Resource
  name="quality-queue"
  list={QualityQueue}
  options={{ label: 'Quality Review' }}  // NO role check
/>
// All 18 resources have NO access control
```

---

## 5. Keycloak JWT Token Parsing

### Current Implementation

**Keycloak Config** (`keycloakConfig.ts` lines 122-134):
```typescript
export const getUserRoles = (): string[] => {
  const keycloak = getKeycloak();
  const token = keycloak.tokenParsed;

  if (!token) return [];

  // Get realm roles
  const realmRoles = token.realm_access?.roles || [];

  // Get resource/client roles
  const clientRoles = token.resource_access?.[keycloakConfig.clientId]?.roles || [];

  return [...realmRoles, ...clientRoles];
};
```

**Auth0 Token Parsing** (`createAuth0AuthProvider.ts` lines 277-278):
```typescript
const auth0OrgId = auth0User[`${namespace}/org_id`];
const auth0Roles = auth0User[`${namespace}/roles`] || [];
```

### Alignment Check

| Token Claim | Platform Standard | CNS Dashboard | Status |
|-------------|------------------|---------------|--------|
| realm_access.roles | ✅ Checked | ✅ Checked | ✅ ALIGNED |
| resource_access.{client}.roles | ✅ Checked | ✅ Checked | ✅ ALIGNED |
| roles | ✅ Fallback | ❌ Not checked | ⚠️ PARTIAL |
| groups | ✅ Checked (leading `/` stripped) | ❌ Not checked | ❌ GAP |

**Missing from CNS Dashboard**:
1. Direct `roles` claim (Auth0 pattern)
2. Group memberships (Keycloak groups)

---

## 6. Multi-Tenant Isolation

### TenantContext Implementation

**File**: `contexts/TenantContext.tsx`

**Features** ✅:
- Tenant ID persistence in localStorage
- Organization ID mapping (tenant_id = organization_id)
- Context provider for React components

**Security Issues** ❌:
1. **No server-side enforcement**:
   ```typescript
   // Lines 68-79: Client-side only
   const setTenantId = useCallback((newTenantId: string) => {
     setTenantIdState(newTenantId);
     localStorage.setItem(STORAGE_KEY, newTenantId);
     // NO API call to verify user has access to this tenant
   });
   ```

2. **Admin toggle removed** (Line 65):
   ```typescript
   // Super admin always has full access - adminModeAllTenants is always true
   const [adminModeAllTenants, setAdminModeAllTenantsState] = useState<boolean>(true);
   // This is CORRECT for platform staff, but bypasses isolation checks
   ```

3. **No validation of tenant access**:
   - User can manually change localStorage tenant_id
   - No verification that user belongs to organization
   - Relies on API-level RLS (which uses admin token)

### API-Level Isolation

**Supabase RLS** (assumed from context):
- CNS API should enforce organization_id filtering
- But all requests use admin token (bypasses RLS)
- Effective isolation: **NONE at API level**

---

## 7. Token Storage & Exposure

### Token Types

| Token Type | Location | Exposure Risk | Mitigation |
|------------|----------|---------------|------------|
| Auth0 JWT | localStorage (Auth0 SDK keys) | MEDIUM | CSP, session timeout |
| Keycloak JWT | Memory (Keycloak instance) | LOW | Auto-refresh, no persistence |
| CNS Admin Token | localStorage (`cns_admin_api_token`) | **HIGH** | **CSP only** |
| User Role | localStorage (`user_role`) | LOW | Client-side only |
| Organization ID | localStorage (`organization_id`) | MEDIUM | CSP, session timeout |

### Admin Token Security

**Token Initialization** (`utils/adminToken.ts`):
```typescript
// Lines 23-66: Fetches token from /admin/default-token endpoint
export const ensureDefaultAdminToken = async (): Promise<void> => {
  const response = await fetch(`${API_CONFIG.BASE_URL}/admin/default-token`);
  const payload = await response.json();
  const token = normalize(payload?.token);
  localStorage.setItem(STORAGE_KEY, token);  // STORED IN LOCALSTORAGE
}
```

**Risks**:
1. **Token in build artifacts**:
   - `VITE_CNS_ADMIN_TOKEN` in .env (committed to git if not in .gitignore)
   - Visible in browser DevTools (localStorage)
   - Accessible via document.cookie in older browsers

2. **No token rotation**:
   - Static token set at build time
   - No automatic expiration
   - No revocation mechanism

3. **XSS vulnerability**:
   - CSP mitigates but doesn't eliminate
   - One XSS = full admin access to CNS API

---

## 8. Security Headers & CSP

### Implementation

**CSP Meta Tag** (`index.html`):
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.auth0.com http://localhost:8180;
  connect-src 'self' http://localhost:* ws://localhost:* https://*.auth0.com;
  ...
">
```

**Vite Plugin** (`vite.config.ts`):
```typescript
{
  name: 'security-headers',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      // ...
    });
  }
}
```

### Assessment

**Strengths** ✅:
- Comprehensive CSP directives
- Frame-ancestors protection (clickjacking)
- X-Content-Type-Options (MIME sniffing)
- Referrer-Policy configured

**Weaknesses** ⚠️:
1. **'unsafe-eval' in script-src**:
   - Required for some libraries but risky
   - Should document which library requires it

2. **'unsafe-inline' in script-src**:
   - Weakens CSP significantly
   - Should use nonces or hashes for inline scripts

3. **Meta tag CSP only**:
   - SECURITY.md recommends nginx headers
   - Not enforced in production deployment

---

## 9. Session Management

### Session Timeout

**Implementation**: `lib/sessionTimeout.ts` + `components/SessionTimeoutProvider.tsx`

**Features** ✅:
- Cross-tab synchronization (BroadcastChannel)
- Configurable timeout (default 30 min)
- Warning before logout (5 min)
- Activity detection (mouse, keyboard, scroll)
- Visibility change detection

**Code Quality** ✅:
- Well-documented (SECURITY.md lines 60-146)
- Range validation for env vars
- Graceful fallback (localStorage if BroadcastChannel unavailable)

**Security Posture**: **EXCELLENT**

### Token Cleanup

**On Logout** (`createAuth0AuthProvider.ts` lines 505-534):
```typescript
logout: async () => {
  // Clear localStorage
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_email');
  localStorage.removeItem('organization_id');
  localStorage.removeItem('auth0_roles');
  localStorage.removeItem('auth0_access_token');
  localStorage.removeItem('auth_mode');

  // Clear Auth0 SDK cache
  keysToRemove.forEach(key => localStorage.removeItem(key));

  // Clear data provider cache
  if (onClearCache) onClearCache();
}
```

**Coverage**: **GOOD** (clears sensitive data)

**Missing**:
- No sessionStorage.clear() in Auth0 provider (exists in SessionTimeout)
- No cookie cleanup (if any exist)

---

## 10. Alignment with Platform Standards

### Comparison Matrix

| Feature | Control Plane (admin-app) | CNS Dashboard | Alignment |
|---------|---------------------------|---------------|-----------|
| **Auth Providers** |
| Keycloak Support | ✅ Implemented | ✅ Implemented | ✅ ALIGNED |
| Auth0 Support | ✅ Implemented | ✅ Implemented | ✅ ALIGNED |
| Dual Provider Support | ✅ Config-driven | ✅ Config-driven | ✅ ALIGNED |
| **Role Management** |
| 5-Level Hierarchy | ✅ Implemented | ❌ Missing | ❌ **CRITICAL GAP** |
| role-parser.ts | ✅ Exists | ❌ Missing | ❌ **GAP** |
| hasMinimumRole() | ✅ Available | ❌ Missing | ❌ **GAP** |
| Keycloak Role Mappings | ✅ Complete | ⚠️ Partial | ⚠️ **PARTIAL** |
| **Access Control** |
| Navigation Manifest | ✅ Config-driven | ❌ Hardcoded | ❌ **GAP** |
| Access Control Provider | ✅ Implemented | ❌ Missing | ❌ **CRITICAL GAP** |
| Route Guards | ✅ Role-gated | ❌ None | ❌ **CRITICAL GAP** |
| Resource-level RBAC | ✅ Per-resource minRole | ❌ All public | ❌ **CRITICAL GAP** |
| **API Authorization** |
| User Token in API Calls | ✅ JWT per user | ❌ Static admin token | ❌ **CRITICAL GAP** |
| Multi-tenant Isolation | ✅ RLS enforced | ⚠️ Client-side only | ❌ **GAP** |
| **Token Management** |
| JWT Storage | ✅ Memory/httpOnly | ⚠️ localStorage | ⚠️ **PARTIAL** |
| Token Refresh | ✅ Automatic | ✅ Automatic | ✅ ALIGNED |
| Session Timeout | ✅ Implemented | ✅ Implemented | ✅ ALIGNED |
| **Security Headers** |
| CSP | ✅ Implemented | ✅ Implemented | ✅ ALIGNED |
| Security Middleware | ✅ Implemented | ✅ Implemented | ✅ ALIGNED |

### Terminology Alignment

**Control Plane** → **App Plane** mapping: ✅ CORRECT

```typescript
// TenantContext provides both (lines 22-23):
organizationId?: string;   // App Plane (CNS API expects organization_id)
tenantId: string;          // Control Plane (for consistency)

// Usage pattern: ✅ CORRECT
const organizationId = useOrganizationId();  // For CNS API calls
const tenantId = useTenantId();              // Same value, different name
```

---

## Critical Security Vulnerabilities

### CRITICAL-1: Shared Admin Token (CVSS 8.5 - HIGH)

**Description**: All authenticated users share a single static admin token for API authorization, bypassing user-level access control.

**Impact**:
- No audit trail for individual actions
- Cannot revoke access for specific users
- All users have full admin privileges on CNS API
- Token compromise affects ALL users

**Attack Vector**:
1. Attacker gains UI access (any valid Auth0/Keycloak account)
2. Extracts admin token from localStorage via DevTools
3. Uses token to call CNS API directly (bypasses UI controls)
4. Full read/write access to all organizations' data

**Exploitation Complexity**: LOW (requires only valid login + DevTools)

**Recommendation**:
```typescript
// CURRENT (VULNERABLE):
const httpClient = (url: string, options: fetchUtils.Options = {}) => {
  const adminHeaders = getAdminAuthHeaders();  // STATIC TOKEN
  headers.set('Authorization', String(adminHeaders.Authorization));
  return fetchUtils.fetchJson(url, { ...options, headers });
};

// RECOMMENDED:
const httpClient = async (url: string, options: fetchUtils.Options = {}) => {
  const authMode = localStorage.getItem('auth_mode');

  if (authMode === 'auth0_direct') {
    const auth0Token = localStorage.getItem('auth0_access_token');
    headers.set('Authorization', `Bearer ${auth0Token}`);
  } else if (authMode === 'keycloak') {
    const keycloakToken = await getToken();
    headers.set('Authorization', `Bearer ${keycloakToken}`);
  }
  // Fallback to admin token ONLY if no user token

  return fetchUtils.fetchJson(url, { ...options, headers });
};
```

---

### CRITICAL-2: Missing RBAC Enforcement (CVSS 7.5 - HIGH)

**Description**: Role hierarchy exists in code but is never enforced. All authenticated users have full access to all features.

**Impact**:
- QualityQueue (staff-only) accessible to all users
- Configuration pages (admin-only) accessible to all users
- No separation between analyst/engineer/admin access levels
- Violates principle of least privilege

**Attack Vector**:
1. Attacker creates account with lowest privileges (analyst)
2. Logs in to CNS Dashboard
3. Navigates to /quality-queue (should be engineer+ only)
4. Full access to approve/reject component enrichments

**Exploitation Complexity**: LOW (requires only valid login)

**Recommendation**:
1. Create `src/lib/role-parser.ts` (copy from admin-app)
2. Implement `hasMinimumRole()` function
3. Add `accessControlProvider` to Admin component
4. Wrap routes in `<ProtectedRoute minRole="engineer">`

---

### HIGH-1: No Multi-Tenant Isolation at API Level (CVSS 6.5 - MEDIUM)

**Description**: Organization switching is client-side only. API uses admin token which has access to all organizations.

**Impact**:
- User can manually change localStorage organization_id
- API calls use admin token (no org filtering at API level)
- Effective cross-tenant data access possible

**Attack Vector**:
1. Attacker logs in as legitimate user of Org A
2. Opens DevTools → localStorage → organization_id = "org_B_uuid"
3. Refreshes page
4. UI now shows Org B data (if API doesn't enforce org filtering)

**Exploitation Complexity**: LOW (requires DevTools knowledge)

**Recommendation**:
- Enable AUTH0_ENABLED=true on CNS backend
- Implement organization_id validation in CNS API middleware
- Use JWT claims for organization membership verification

---

### MEDIUM-1: Token Exposure in localStorage (CVSS 5.5 - MEDIUM)

**Description**: Admin token stored in localStorage is accessible to any JavaScript code, including XSS payloads.

**Impact**:
- One XSS vulnerability = full admin token compromise
- CSP mitigates but doesn't eliminate risk
- Token persists across sessions

**Attack Vector**:
1. Attacker finds XSS vulnerability in dashboard
2. Injects script to read localStorage.getItem('cns_admin_api_token')
3. Exfiltrates token to attacker-controlled server
4. Uses token for direct API access

**Exploitation Complexity**: MEDIUM (requires finding XSS first)

**Recommendation**:
- Move to httpOnly cookies (if possible with CNS API)
- Implement token rotation (expire after 24 hours)
- Add token binding (IP address validation)
- Use Auth0/Keycloak tokens instead of static admin token

---

## Recommendations

### Priority 1: CRITICAL (Immediate Action Required)

1. **Implement User-Level API Authorization**
   - Replace static admin token with Auth0/Keycloak JWT
   - Update dataProvider to use user's access token
   - Enable AUTH0_ENABLED=true on CNS backend
   - **Timeline**: 1-2 weeks

2. **Implement RBAC Enforcement**
   - Create `src/lib/role-parser.ts` with platform role hierarchy
   - Add `accessControlProvider` to React Admin
   - Wrap routes in role-based guards
   - **Timeline**: 1 week

3. **Add Route Protection**
   - Implement ProtectedRoute component
   - Define minRole for each route/resource
   - Hide navigation items based on role
   - **Timeline**: 3-5 days

### Priority 2: HIGH (Within 1 Month)

4. **Implement Multi-Tenant Isolation at API Level**
   - Validate organization_id from JWT claims
   - Implement API middleware for org membership check
   - Add audit logging for cross-org attempts
   - **Timeline**: 1 week

5. **Token Security Hardening**
   - Implement token rotation for admin token
   - Move to httpOnly cookies (if possible)
   - Add token expiration (24 hours)
   - **Timeline**: 1 week

6. **CSP Hardening**
   - Remove 'unsafe-inline' (use nonces/hashes)
   - Document 'unsafe-eval' requirement
   - Implement nginx-level CSP headers
   - **Timeline**: 3-5 days

### Priority 3: MEDIUM (Within 2 Months)

7. **Navigation Manifest**
   - Create config/navigation.ts with role-gated resources
   - Remove hardcoded Resource definitions
   - Enable dynamic menu based on user role
   - **Timeline**: 3-5 days

8. **Audit Logging**
   - Implement user-level action logging
   - Track organization switching
   - Log all CRUD operations with user context
   - **Timeline**: 1 week

9. **Token Claims Alignment**
   - Add support for direct `roles` claim
   - Implement group membership parsing
   - Align with platform JWT structure
   - **Timeline**: 2-3 days

### Priority 4: LOW (Nice to Have)

10. **Security Documentation**
    - Update SECURITY.md with RBAC implementation
    - Add API authorization flow diagram
    - Document threat model
    - **Timeline**: 2-3 days

---

## Implementation Example: RBAC Enforcement

### Step 1: Create Role Parser

**File**: `src/lib/role-parser.ts` (copy from admin-app)

```typescript
/**
 * Role Hierarchy (from CLAUDE.md)
 */
export enum RoleLevel {
  analyst = 1,
  engineer = 2,
  admin = 3,
  owner = 4,
  super_admin = 5,
}

/**
 * Keycloak Role Mappings
 */
const ROLE_MAPPINGS: Record<string, keyof typeof RoleLevel> = {
  // Super Admin
  'platform:super_admin': 'super_admin',
  'platform-super-admin': 'super_admin',
  'super-admin': 'super_admin',
  'superadmin': 'super_admin',
  'super_admin': 'super_admin',
  'realm-admin': 'super_admin',
  'platform_admin': 'super_admin',

  // Owner
  'owner': 'owner',
  'org-owner': 'owner',
  'billing_admin': 'owner',

  // Admin
  'platform:admin': 'admin',
  'tenant-admin': 'admin',
  'admin': 'admin',
  'administrator': 'admin',

  // Engineer
  'platform:engineer': 'engineer',
  'platform:staff': 'engineer',
  'engineer': 'engineer',
  'staff': 'engineer',
  'developer': 'engineer',

  // Analyst
  'analyst': 'analyst',
  'user': 'analyst',
  'viewer': 'analyst',
  'member': 'analyst',
};

export function parseRole(keycloakRoles: string[]): keyof typeof RoleLevel {
  let highestRole: keyof typeof RoleLevel = 'analyst';
  let highestLevel = 0;

  for (const keycloakRole of keycloakRoles) {
    const mappedRole = ROLE_MAPPINGS[keycloakRole];
    if (mappedRole && RoleLevel[mappedRole] > highestLevel) {
      highestRole = mappedRole;
      highestLevel = RoleLevel[mappedRole];
    }
  }

  return highestRole;
}

export function hasMinimumRole(
  userRole: keyof typeof RoleLevel,
  requiredRole: keyof typeof RoleLevel
): boolean {
  return RoleLevel[userRole] >= RoleLevel[requiredRole];
}

// Convenience functions
export const isSuperAdmin = (role: string) => role === 'super_admin';
export const isOwner = (role: string) => RoleLevel[role as keyof typeof RoleLevel] >= RoleLevel.owner;
export const isAdmin = (role: string) => RoleLevel[role as keyof typeof RoleLevel] >= RoleLevel.admin;
export const isEngineer = (role: string) => RoleLevel[role as keyof typeof RoleLevel] >= RoleLevel.engineer;
export const isAnalyst = (role: string) => true; // All roles pass
```

### Step 2: Create Access Control Provider

**File**: `src/lib/accessControlProvider.ts`

```typescript
import { AccessControlProvider } from 'react-admin';
import { hasMinimumRole, parseRole } from './role-parser';

export const accessControlProvider: AccessControlProvider = {
  canAccess: async ({ action, resource, record }) => {
    // Get user's parsed role from localStorage
    const storedRoles = JSON.parse(localStorage.getItem('auth0_roles') || '[]');
    const userRole = parseRole(storedRoles);

    // Define resource-level access control
    const resourcePermissions: Record<string, keyof typeof RoleLevel> = {
      'quality-queue': 'engineer',      // Staff only
      'config': 'admin',                // Admin only
      'supplier-apis': 'admin',         // Admin only
      'rate-limiting': 'super_admin',   // Super admin only
      'audit-trail': 'engineer',        // Engineer+
      // Public resources (all authenticated users)
      'analytics': 'analyst',
      'bom-upload': 'analyst',
      'component-search': 'analyst',
    };

    const requiredRole = resourcePermissions[resource] || 'analyst';
    return hasMinimumRole(userRole, requiredRole);
  },
};
```

### Step 3: Add to App Component

**File**: `src/App.tsx` (modify existing)

```typescript
import { accessControlProvider } from './lib/accessControlProvider';

const AdminContent = ({ authProvider, loginPage }: { authProvider: any; loginPage: any }) => {
  const { currentTheme } = useThemeContext();

  return (
    <TenantProvider>
      <NotificationProvider>
        <SessionTimeoutProvider>
          <Admin
            dataProvider={dataProvider}
            authProvider={authProvider}
            accessControlProvider={accessControlProvider}  // ADD THIS
            dashboard={Dashboard}
            title="CNS Dashboard"
            loginPage={loginPage}
            disableTelemetry
            layout={CustomLayout}
            theme={currentTheme}
          >
            {/* Resources now respect access control */}
          </Admin>
        </SessionTimeoutProvider>
      </NotificationProvider>
    </TenantProvider>
  );
};
```

### Step 4: Create Protected Route Component

**File**: `src/components/ProtectedRoute.tsx`

```typescript
import React from 'react';
import { Navigate } from 'react-router-dom';
import { hasMinimumRole, parseRole, RoleLevel } from '../lib/role-parser';

interface ProtectedRouteProps {
  minRole: keyof typeof RoleLevel;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ minRole, children }) => {
  const storedRoles = JSON.parse(localStorage.getItem('auth0_roles') || '[]');
  const userRole = parseRole(storedRoles);

  if (!hasMinimumRole(userRole, minRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
```

### Step 5: Protect Routes

**File**: `src/App.tsx` (update routes)

```typescript
<CustomRoutes>
  {/* Staff-only features */}
  <Route
    path="/quality-queue"
    element={
      <ProtectedRoute minRole="engineer">
        <QualityQueue />
      </ProtectedRoute>
    }
  />

  {/* Admin-only features */}
  <Route
    path="/config"
    element={
      <ProtectedRoute minRole="admin">
        <EnrichmentConfigPage />
      </ProtectedRoute>
    }
  />

  {/* Public features (all authenticated users) */}
  <Route path="/analytics" element={<AnalyticsDashboard />} />
</CustomRoutes>
```

---

## Compliance & Best Practices

### OWASP Top 10 Coverage

| OWASP Risk | Status | Mitigation |
|------------|--------|-----------|
| A01: Broken Access Control | ❌ **VULNERABLE** | No RBAC enforcement |
| A02: Cryptographic Failures | ⚠️ **PARTIAL** | Tokens in localStorage |
| A03: Injection | ✅ **MITIGATED** | React DOM escaping |
| A04: Insecure Design | ❌ **VULNERABLE** | Static admin token design |
| A05: Security Misconfiguration | ⚠️ **PARTIAL** | CSP with unsafe-inline |
| A06: Vulnerable Components | ⚠️ **UNKNOWN** | No dependency scanning mentioned |
| A07: Authentication Failures | ✅ **MITIGATED** | Session timeout, MFA via Auth0 |
| A08: Software and Data Integrity | ✅ **GOOD** | SRI not used but CSP present |
| A09: Logging Failures | ❌ **GAP** | No user-level audit logs |
| A10: SSRF | ✅ **NOT APPLICABLE** | Client-side only |

### NIST Cybersecurity Framework

| Function | Category | Implementation | Status |
|----------|----------|----------------|--------|
| **Identify** | Asset Management | Services cataloged | ✅ DONE |
| | Risk Assessment | SECURITY.md documented | ✅ DONE |
| **Protect** | Access Control | Auth0/Keycloak implemented | ⚠️ PARTIAL |
| | Data Security | TLS in transit | ✅ ASSUMED |
| | Awareness | Documentation complete | ✅ DONE |
| **Detect** | Anomaly Detection | None implemented | ❌ GAP |
| | Monitoring | Gate logging only | ⚠️ PARTIAL |
| **Respond** | Incident Response | Session timeout | ✅ DONE |
| | Communications | None documented | ❌ GAP |
| **Recover** | Recovery Planning | None documented | ❌ GAP |

---

## Conclusion

The CNS Dashboard has a **solid authentication foundation** but **critical authorization gaps**. The dual-authentication model is well-implemented, but the use of a static admin token for API calls undermines the security provided by Auth0/Keycloak authentication.

### Key Takeaways

**Strengths**:
- Comprehensive authentication (Auth0 + Keycloak)
- Excellent session management
- Well-documented security architecture
- CSP and security headers implemented

**Critical Issues**:
1. **Static admin token used for ALL API calls** - No user-level authorization
2. **No RBAC enforcement** - All users have full access
3. **No route protection** - Staff-only features accessible to all
4. **Weak multi-tenant isolation** - Client-side only

### Risk Summary

| Risk Level | Count | Examples |
|------------|-------|----------|
| CRITICAL | 2 | Shared admin token, Missing RBAC |
| HIGH | 1 | No multi-tenant API isolation |
| MEDIUM | 1 | Token exposure in localStorage |
| LOW | 0 | - |

**Overall Risk Rating**: **HIGH** (requires immediate remediation)

### Next Steps

1. **Immediate** (Week 1):
   - Implement RBAC with role-parser.ts
   - Add accessControlProvider
   - Protect staff-only routes

2. **Short-term** (Week 2-4):
   - Replace admin token with user JWT
   - Enable AUTH0_ENABLED on CNS backend
   - Implement API-level multi-tenant isolation

3. **Long-term** (Month 2-3):
   - Add audit logging
   - Implement token rotation
   - CSP hardening

---

**Report Generated**: 2025-12-19
**Next Review**: After RBAC implementation (recommended 2 weeks)

