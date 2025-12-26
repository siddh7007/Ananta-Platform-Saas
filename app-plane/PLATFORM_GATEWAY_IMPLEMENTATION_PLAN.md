# Platform Gateway Client - Implementation Plan

**Date**: 2025-12-18
**Priority**: HIGH (P1)
**Addresses**: Security vulnerability + N-P1-5 requirement

---

## 🎯 Objective

Replace Supabase PostgREST provider with a secure, multi-tenant-aware platform gateway client that:
1. Uses **user JWT tokens only** (no admin token in frontend)
2. Enforces **tenant isolation** via backend API
3. Normalizes **API responses** to `{data, total}` format
4. Provides **reusable hooks** for React Admin + custom pages
5. Maps **error codes** to friendly messages

---

## 📐 Architecture

### Before (Current - Insecure)
```
┌─────────────────────────────────────────────────────────┐
│  React Admin (Refine)                                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Supabase Provider (ra-data-simple-rest)           │  │
│  │ - Uses admin token from localStorage             │  │
│  │ - Direct PostgREST calls                          │  │
│  │ - No tenant validation                            │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Supabase PostgREST API                                 │
│  - Row-Level Security (RLS) policies                    │
│  - Direct database access                               │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  PostgreSQL Database                                    │
└─────────────────────────────────────────────────────────┘
```

**Problems**:
- ❌ Admin token in localStorage (extractable via DevTools)
- ❌ RLS policies can be bypassed if misconfigured
- ❌ No centralized tenant validation
- ❌ No error code mapping

### After (Proposed - Secure)
```
┌─────────────────────────────────────────────────────────┐
│  React Admin + Custom Pages                             │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Platform Gateway Client                           │  │
│  │ ┌─────────────────────────────────────────────┐   │  │
│  │ │ Axios Instance                              │   │  │
│  │ │ - Request Interceptor:                      │   │  │
│  │ │   * Add Keycloak JWT (from auth context)   │   │  │
│  │ │   * Add X-Organization-ID (from tenant ctx) │   │  │
│  │ │   * Add X-Request-ID (correlation)          │   │  │
│  │ │ - Response Interceptor:                     │   │  │
│  │ │   * Normalize {data, total}                 │   │  │
│  │ │   * Map error codes to messages             │   │  │
│  │ │   * Handle 401 → logout                     │   │  │
│  │ └─────────────────────────────────────────────┘   │  │
│  │                                                     │  │
│  │ ┌─────────────────────────────────────────────┐   │  │
│  │ │ Data Provider (for React Admin)             │   │  │
│  │ │ - getList, getOne, create, update, delete   │   │  │
│  │ │ - Uses gateway client internally            │   │  │
│  │ └─────────────────────────────────────────────┘   │  │
│  │                                                     │  │
│  │ ┌─────────────────────────────────────────────┐   │  │
│  │ │ Custom Hooks (for custom pages)             │   │  │
│  │ │ - useBoms, useBulkUploads, useWorkspaces    │   │  │
│  │ │ - Uses gateway client internally            │   │  │
│  │ └─────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  CNS Service API (FastAPI)                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Auth Middleware                                   │  │
│  │ - Validate JWT signature                         │  │
│  │ - Extract user roles                             │  │
│  │ - Validate organization_id matches JWT           │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ RBAC Enforcement                                  │  │
│  │ - @require_role(Role.ADMIN) decorators           │  │
│  │ - Tenant isolation at query level               │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Business Logic                                    │  │
│  │ - BOM management, enrichment, workflows          │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  PostgreSQL Database                                    │
│  - Queries filtered by organization_id                  │
└─────────────────────────────────────────────────────────┘
```

**Benefits**:
- ✅ User JWT only (validated by backend)
- ✅ Tenant isolation enforced at API layer
- ✅ Centralized error handling
- ✅ Reusable across React Admin + custom pages

---

## 📦 Implementation Phases

### Phase 1: Core Gateway Client (Week 1)

**Files to Create**:

#### 1.1 Axios Instance with Interceptors
**File**: `dashboard/src/lib/platform-gateway.ts`

```typescript
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getKeycloakToken, isTokenExpired, refreshToken } from '@/lib/keycloak-utils';
import { getTenantId } from '@/contexts/TenantContext';
import { ErrorCode, mapErrorToMessage } from '@/lib/error-mapping';

// Base configuration
const API_BASE_URL = import.meta.env.VITE_CNS_API_URL || 'http://localhost:27200';

export const platformGateway: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================
// REQUEST INTERCEPTOR - Add Auth & Tenant Headers
// ============================================
platformGateway.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // 1. Get Keycloak token
    let token = getKeycloakToken();

    // 2. Refresh if expired (within 60 seconds)
    if (token && isTokenExpired(token, 60)) {
      console.log('[Gateway] Token expiring soon, refreshing...');
      token = await refreshToken();
    }

    if (!token) {
      console.error('[Gateway] No auth token available');
      throw new Error('Authentication required');
    }

    // 3. Add Authorization header
    config.headers.Authorization = `Bearer ${token}`;

    // 4. Add tenant/organization ID from context
    const tenantId = getTenantId();
    if (tenantId) {
      config.headers['X-Organization-ID'] = tenantId;
      config.headers['X-Tenant-Id'] = tenantId; // Backwards compat
    }

    // 5. Add correlation ID for distributed tracing
    const requestId = generateRequestId();
    config.headers['X-Request-Id'] = requestId;

    // 6. Add request timing metadata
    (config as any).metadata = {
      startTime: performance.now(),
      requestId,
    };

    console.log(`[Gateway] ${config.method?.toUpperCase()} ${config.url} [${requestId}]`);

    return config;
  },
  (error) => {
    console.error('[Gateway] Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// ============================================
// RESPONSE INTERCEPTOR - Normalize & Error Handling
// ============================================
platformGateway.interceptors.response.use(
  (response) => {
    // Calculate request duration
    const duration = (response.config as any).metadata?.startTime
      ? Math.round(performance.now() - (response.config as any).metadata.startTime)
      : undefined;

    console.log(
      `[Gateway] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url} (${duration}ms)`
    );

    // Normalize response to {data, total} format
    if (response.data) {
      response.data = normalizeResponse(response.data);
    }

    return response;
  },
  async (error: AxiosError) => {
    // Calculate request duration for failed requests
    const duration = (error.config as any)?.metadata?.startTime
      ? Math.round(performance.now() - (error.config as any).metadata.startTime)
      : undefined;

    const status = error.response?.status;
    const method = error.config?.method?.toUpperCase();
    const url = error.config?.url;

    console.error(`[Gateway] ${status} ${method} ${url} (${duration}ms)`);

    // Handle 401 - Token expired or invalid
    if (status === 401) {
      console.warn('[Gateway] 401 Unauthorized - redirecting to login');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Handle 403 - Forbidden (insufficient permissions)
    if (status === 403) {
      console.warn('[Gateway] 403 Forbidden - access denied');
      // Could show toast notification here
    }

    // Map error code to friendly message
    const errorCode = extractErrorCode(error);
    const friendlyMessage = mapErrorToMessage(errorCode);

    // Enhance error with friendly message
    (error as any).friendlyMessage = friendlyMessage;
    (error as any).errorCode = errorCode;

    return Promise.reject(error);
  }
);

// ============================================
// RESPONSE NORMALIZATION
// ============================================
function normalizeResponse(data: any): any {
  // Already normalized
  if (data && typeof data === 'object' && 'data' in data && 'total' in data) {
    return data;
  }

  // Array response - wrap in {data, total}
  if (Array.isArray(data)) {
    return {
      data,
      total: data.length,
    };
  }

  // Paginated response from CNS API
  if (data && typeof data === 'object' && 'items' in data && 'total' in data) {
    return {
      data: data.items,
      total: data.total,
    };
  }

  // Single object - wrap in {data}
  if (data && typeof data === 'object') {
    return {
      data,
      total: 1,
    };
  }

  return data;
}

// ============================================
// ERROR CODE EXTRACTION
// ============================================
function extractErrorCode(error: AxiosError): ErrorCode {
  const responseData = error.response?.data as any;

  // Check for error_code field
  if (responseData?.error_code) {
    return responseData.error_code as ErrorCode;
  }

  // Check for code field
  if (responseData?.code) {
    return responseData.code as ErrorCode;
  }

  // Fallback to HTTP status code
  const status = error.response?.status;
  switch (status) {
    case 400: return 'VALIDATION_ERROR';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 429: return 'RATE_LIMIT_EXCEEDED';
    case 500: return 'INTERNAL_SERVER_ERROR';
    case 503: return 'SERVICE_UNAVAILABLE';
    default: return 'UNKNOWN_ERROR';
  }
}

// ============================================
// UTILITIES
// ============================================
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `cbp-${timestamp}-${random}`;
}
```

#### 1.2 Error Code Mapping (N-P1-5 Requirement)
**File**: `dashboard/src/lib/error-mapping.ts`

```typescript
export type ErrorCode =
  // Authentication & Authorization
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'TOKEN_EXPIRED'
  | 'INVALID_TOKEN'

  // Validation
  | 'VALIDATION_ERROR'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_FORMAT'
  | 'INVALID_UUID'

  // Resource Errors
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'CONFLICT'

  // Business Logic
  | 'BOM_PROCESSING_FAILED'
  | 'ENRICHMENT_FAILED'
  | 'UPLOAD_FAILED'
  | 'WORKSPACE_NOT_FOUND'
  | 'PROJECT_NOT_FOUND'

  // Rate Limiting
  | 'RATE_LIMIT_EXCEEDED'
  | 'TOO_MANY_REQUESTS'

  // Server Errors
  | 'INTERNAL_SERVER_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'DATABASE_ERROR'

  // Network
  | 'NETWORK_ERROR'
  | 'TIMEOUT'

  // Unknown
  | 'UNKNOWN_ERROR';

// User-friendly error messages
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // Authentication & Authorization
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  INVALID_TOKEN: 'Invalid authentication token. Please log in again.',

  // Validation
  VALIDATION_ERROR: 'Please check your input and try again.',
  MISSING_REQUIRED_FIELD: 'Please fill in all required fields.',
  INVALID_FORMAT: 'The format is invalid. Please check your input.',
  INVALID_UUID: 'Invalid ID format. Please try again.',

  // Resource Errors
  NOT_FOUND: 'The requested resource was not found.',
  ALREADY_EXISTS: 'This resource already exists. Please use a different name.',
  CONFLICT: 'This operation conflicts with existing data.',

  // Business Logic
  BOM_PROCESSING_FAILED: 'Failed to process BOM file. Please check the file format and try again.',
  ENRICHMENT_FAILED: 'Component enrichment failed. Please try again or contact support.',
  UPLOAD_FAILED: 'File upload failed. Please check your internet connection and try again.',
  WORKSPACE_NOT_FOUND: 'Workspace not found. Please select a valid workspace.',
  PROJECT_NOT_FOUND: 'Project not found. Please select a valid project.',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',
  TOO_MANY_REQUESTS: 'You are sending requests too quickly. Please slow down.',

  // Server Errors
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred. Please try again or contact support.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',
  DATABASE_ERROR: 'A database error occurred. Please try again or contact support.',

  // Network
  NETWORK_ERROR: 'Network error. Please check your internet connection and try again.',
  TIMEOUT: 'Request timed out. Please try again.',

  // Unknown
  UNKNOWN_ERROR: 'An unknown error occurred. Please try again or contact support.',
};

export function mapErrorToMessage(errorCode: ErrorCode): string {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.UNKNOWN_ERROR;
}

// Helper for specific error details
export function getErrorDetails(error: any): {
  code: ErrorCode;
  message: string;
  details?: string;
} {
  const code: ErrorCode = error.errorCode || 'UNKNOWN_ERROR';
  const message = mapErrorToMessage(code);
  const details = error.response?.data?.detail || error.message;

  return { code, message, details };
}
```

#### 1.3 Keycloak Token Utilities
**File**: `dashboard/src/lib/keycloak-utils.ts`

```typescript
import { env } from '@/config/env';

const OIDC_KEY = `oidc.user:${env.keycloak.url}/realms/${env.keycloak.realm}:${env.keycloak.clientId}`;

export function getKeycloakToken(): string | null {
  try {
    const oidcData = localStorage.getItem(OIDC_KEY);
    if (oidcData) {
      const parsed = JSON.parse(oidcData);
      return parsed.access_token || null;
    }
  } catch (error) {
    console.error('[Keycloak] Error reading token:', error);
  }
  return null;
}

export function isTokenExpired(token: string, bufferSeconds: number = 0): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    return now >= (exp - bufferSeconds * 1000);
  } catch (error) {
    console.error('[Keycloak] Error parsing token:', error);
    return true; // Assume expired if can't parse
  }
}

export async function refreshToken(): Promise<string | null> {
  // Keycloak refresh logic - triggers Keycloak library to refresh
  // This is handled by the oidc-react library automatically
  // For now, just re-read from storage
  return getKeycloakToken();
}
```

---

### Phase 2: React Admin Data Provider (Week 1)

**File**: `dashboard/src/providers/platform-data-provider.ts`

```typescript
import { DataProvider } from 'react-admin';
import { platformGateway } from '@/lib/platform-gateway';
import { getErrorDetails } from '@/lib/error-mapping';

export const platformDataProvider: DataProvider = {
  // ============================================
  // GET LIST - Fetch multiple records with pagination/filtering
  // ============================================
  getList: async (resource, params) => {
    const { page, perPage } = params.pagination;
    const { field, order } = params.sort;
    const filter = params.filter;

    // Build query params
    const query = {
      _start: (page - 1) * perPage,
      _end: page * perPage,
      _sort: field,
      _order: order,
      ...filter,
    };

    try {
      const response = await platformGateway.get(`/${resource}`, { params: query });

      // Response already normalized by interceptor
      const { data, total } = response.data;

      return {
        data,
        total: total || data.length,
      };
    } catch (error: any) {
      const errorDetails = getErrorDetails(error);
      throw new Error(errorDetails.message);
    }
  },

  // ============================================
  // GET ONE - Fetch single record
  // ============================================
  getOne: async (resource, params) => {
    try {
      const response = await platformGateway.get(`/${resource}/${params.id}`);
      return { data: response.data.data };
    } catch (error: any) {
      const errorDetails = getErrorDetails(error);
      throw new Error(errorDetails.message);
    }
  },

  // ============================================
  // GET MANY - Fetch multiple records by IDs
  // ============================================
  getMany: async (resource, params) => {
    const query = {
      id: params.ids,
    };

    try {
      const response = await platformGateway.get(`/${resource}`, { params: query });
      return { data: response.data.data };
    } catch (error: any) {
      const errorDetails = getErrorDetails(error);
      throw new Error(errorDetails.message);
    }
  },

  // ============================================
  // GET MANY REFERENCE - Fetch related records
  // ============================================
  getManyReference: async (resource, params) => {
    const { page, perPage } = params.pagination;
    const { field, order } = params.sort;
    const filter = params.filter;

    const query = {
      _start: (page - 1) * perPage,
      _end: page * perPage,
      _sort: field,
      _order: order,
      [params.target]: params.id,
      ...filter,
    };

    try {
      const response = await platformGateway.get(`/${resource}`, { params: query });
      const { data, total } = response.data;

      return {
        data,
        total: total || data.length,
      };
    } catch (error: any) {
      const errorDetails = getErrorDetails(error);
      throw new Error(errorDetails.message);
    }
  },

  // ============================================
  // CREATE - Create new record
  // ============================================
  create: async (resource, params) => {
    try {
      const response = await platformGateway.post(`/${resource}`, params.data);
      return { data: response.data.data };
    } catch (error: any) {
      const errorDetails = getErrorDetails(error);
      throw new Error(errorDetails.message);
    }
  },

  // ============================================
  // UPDATE - Update existing record
  // ============================================
  update: async (resource, params) => {
    try {
      const response = await platformGateway.put(`/${resource}/${params.id}`, params.data);
      return { data: response.data.data };
    } catch (error: any) {
      const errorDetails = getErrorDetails(error);
      throw new Error(errorDetails.message);
    }
  },

  // ============================================
  // UPDATE MANY - Update multiple records
  // ============================================
  updateMany: async (resource, params) => {
    try {
      const responses = await Promise.all(
        params.ids.map(id =>
          platformGateway.put(`/${resource}/${id}`, params.data)
        )
      );
      return { data: params.ids };
    } catch (error: any) {
      const errorDetails = getErrorDetails(error);
      throw new Error(errorDetails.message);
    }
  },

  // ============================================
  // DELETE - Delete record
  // ============================================
  delete: async (resource, params) => {
    try {
      const response = await platformGateway.delete(`/${resource}/${params.id}`);
      return { data: response.data.data };
    } catch (error: any) {
      const errorDetails = getErrorDetails(error);
      throw new Error(errorDetails.message);
    }
  },

  // ============================================
  // DELETE MANY - Delete multiple records
  // ============================================
  deleteMany: async (resource, params) => {
    try {
      await Promise.all(
        params.ids.map(id => platformGateway.delete(`/${resource}/${id}`))
      );
      return { data: params.ids };
    } catch (error: any) {
      const errorDetails = getErrorDetails(error);
      throw new Error(errorDetails.message);
    }
  },
};
```

---

### Phase 3: Custom Hooks for Non-React Admin Pages (Week 2)

**File**: `dashboard/src/hooks/useBoms.ts`

```typescript
import { useState, useEffect } from 'react';
import { platformGateway } from '@/lib/platform-gateway';
import { getErrorDetails } from '@/lib/error-mapping';

export interface BOM {
  id: string;
  filename: string;
  component_count: number;
  enriched_count: number;
  enrichment_status: string;
  created_at: string;
  // ... other fields
}

export interface UseBomsFetchOptions {
  workspaceId?: string;
  projectId?: string;
  status?: string;
  page?: number;
  perPage?: number;
}

export function useBoms(options: UseBomsFetchOptions = {}) {
  const [boms, setBoms] = useState<BOM[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBoms();
  }, [options.workspaceId, options.projectId, options.status, options.page]);

  const fetchBoms = async () => {
    setLoading(true);
    setError(null);

    try {
      const params: any = {
        _start: ((options.page || 1) - 1) * (options.perPage || 10),
        _end: (options.page || 1) * (options.perPage || 10),
      };

      if (options.workspaceId) params.workspace_id = options.workspaceId;
      if (options.projectId) params.project_id = options.projectId;
      if (options.status) params.status = options.status;

      const response = await platformGateway.get('/boms', { params });
      const { data, total } = response.data;

      setBoms(data);
      setTotal(total);
    } catch (err: any) {
      const errorDetails = getErrorDetails(err);
      setError(errorDetails.message);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => fetchBoms();

  return {
    boms,
    total,
    loading,
    error,
    refresh,
  };
}
```

**File**: `dashboard/src/hooks/useBulkUploads.ts`

```typescript
import { useState, useEffect } from 'react';
import { platformGateway } from '@/lib/platform-gateway';

export interface BulkUpload {
  id: string;
  filename: string;
  status: string;
  created_at: string;
  // ... other fields
}

export function useBulkUploads() {
  const [uploads, setUploads] = useState<BulkUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUploads = async () => {
    setLoading(true);
    try {
      const response = await platformGateway.get('/bulk-uploads');
      setUploads(response.data.data);
    } catch (err: any) {
      setError(err.friendlyMessage || 'Failed to fetch uploads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  return { uploads, loading, error, refresh: fetchUploads };
}
```

---

## 🔧 Migration Strategy

### Step 1: Deploy Platform Gateway (No Breaking Changes)

1. Add `platform-gateway.ts`, `error-mapping.ts`, `keycloak-utils.ts`
2. Deploy dashboard with both providers active
3. Test gateway client independently

### Step 2: Add Platform Data Provider (Parallel)

1. Add `platform-data-provider.ts`
2. Keep Supabase provider as fallback
3. Feature flag to switch between providers

```typescript
// App.tsx
const dataProvider = import.meta.env.VITE_USE_PLATFORM_GATEWAY === 'true'
  ? platformDataProvider
  : supabaseDataProvider;
```

### Step 3: Migrate Custom Hooks (Gradual)

1. Create custom hooks (useBoms, useBulkUploads, etc.)
2. Update custom pages one by one
3. Test each migration thoroughly

### Step 4: Remove Supabase Provider (Final)

1. Verify all pages work with platform gateway
2. Remove Supabase provider code
3. Remove admin token bootstrap logic

---

## ✅ Acceptance Criteria

- [ ] Platform gateway client created with interceptors
- [ ] Error code mapping implemented (N-P1-5 requirement)
- [ ] User JWT token used for all requests
- [ ] Tenant ID added to all requests via X-Organization-ID
- [ ] Responses normalized to {data, total} format
- [ ] 401 errors trigger automatic logout
- [ ] React Admin data provider using gateway client
- [ ] Custom hooks (useBoms, useBulkUploads) created
- [ ] Documentation updated
- [ ] Zero admin token references in frontend code

---

## 📝 Testing Plan

### Unit Tests
```typescript
// platform-gateway.test.ts
describe('Platform Gateway', () => {
  test('adds JWT token to request headers', async () => {
    // Mock Keycloak token
    // Call gateway
    // Verify Authorization header
  });

  test('adds tenant ID to request headers', async () => {
    // Mock tenant context
    // Call gateway
    // Verify X-Organization-ID header
  });

  test('normalizes array response to {data, total}', () => {
    // Test response interceptor
  });

  test('handles 401 by redirecting to login', async () => {
    // Mock 401 response
    // Verify window.location.href = '/login'
  });
});
```

### Integration Tests
```typescript
// useBoms.test.ts
describe('useBoms hook', () => {
  test('fetches BOMs with workspace filter', async () => {
    // Render hook with workspaceId
    // Wait for data
    // Verify API called with correct params
  });

  test('displays error message on failure', async () => {
    // Mock API error
    // Verify friendly error message shown
  });
});
```

---

## 🎯 Success Metrics

- **Security**: Zero admin tokens in frontend code
- **Performance**: <100ms overhead from gateway interceptors
- **Error Handling**: 100% error codes mapped to friendly messages
- **Reusability**: Custom hooks used in React Admin + custom pages
- **Compliance**: All requests include tenant ID for multi-tenant isolation

---

**Priority**: HIGH (P1)
**Estimated Effort**: 2 weeks
**Dependencies**: Keycloak auth provider, tenant context
