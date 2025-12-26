# Centralized Logging and Error Handling

## Executive Summary

The Dashboard service implements a comprehensive centralized logging and error handling system that provides structured logging, automatic error code mapping, user-friendly error messages, and seamless API integration.

**Key Components:**
- **Logger Module** (`logger.ts`): Structured logging with configurable levels, context enrichment, and API-specific log methods
- **Error Mapping** (`errorMapping.ts`): 17 error codes with user-friendly messages and validation error extraction
- **API Client** (`apiClient.ts`): Axios-based HTTP client with automatic request/response logging and correlation IDs

**Test Coverage:** 53 comprehensive test cases covering all logging and error handling scenarios

---

## Logger Module

### Overview

The logger provides structured, context-aware logging for the Dashboard service. It supports multiple log levels, automatic console output formatting, and optional remote logging integration.

**File:** `src/admin/lib/logger.ts`

### Log Levels

Four severity levels control which messages are logged:

```typescript
export enum LogLevel {
  DEBUG = 0,    // Verbose development logging
  INFO = 1,     // General informational messages
  WARN = 2,     // Recoverable errors and warnings
  ERROR = 3,    // Critical failures and exceptions
}
```

Log level filtering is threshold-based: messages at or above the configured minimum level are logged.

**Configuration:**
- Environment variable: `NEXT_PUBLIC_LOG_LEVEL` (default: `'INFO'`)
- Environment variable: `NEXT_PUBLIC_ENABLE_CONSOLE_LOGGING` (default: `true`)
- Environment variable: `NEXT_PUBLIC_ENABLE_REMOTE_LOGGING` (default: `false`)

### Structured Logging

All log entries include context information for better debugging and traceability:

```typescript
export interface LogContext {
  module?: string;           // Component name (e.g., 'API', 'Auth', 'User')
  action?: string;           // Action being performed
  userId?: string;           // Current user ID
  tenantId?: string;         // Current tenant/organization ID
  requestId?: string;        // Correlation ID for tracing
  [key: string]: unknown;    // Additional custom fields
}
```

**Example with context:**
```typescript
logInfo('Tenant created successfully', {
  module: 'TenantService',
  action: 'Create',
  tenantId: 'tenant-456',
  userId: 'user-123',
  tenantName: 'Acme Corp',
});
// Output: 2024-01-15T10:30:45.123Z INFO [TenantService] Tenant created successfully
//         { module: 'TenantService', action: 'Create', tenantId: 'tenant-456', ... }
```

### Log Entry Structure

```typescript
export interface LogEntry {
  level: LogLevel;           // Log severity level
  message: string;           // Human-readable message
  context?: LogContext;      // Structured context data
  timestamp: Date;           // ISO timestamp
  error?: Error;             // Error object if applicable
  stack?: string;            // Stack trace for errors
}
```

### Core Logging Methods

#### General Logging

```typescript
// Debug-level (verbose, development only)
logger.debug(message: string, context?: LogContext): void

// Info-level (general information)
logger.info(message: string, context?: LogContext): void

// Warning-level (recoverable errors)
logger.warn(message: string, context?: LogContext, error?: Error): void

// Error-level (critical failures)
logger.error(message: string, context?: LogContext, error?: Error): void
```

**Example:**
```typescript
const error = new Error('Database connection failed');
logError('Failed to fetch tenants', {
  module: 'TenantRepository',
  action: 'list',
  tenantId: activeTenantId,
}, error);
```

#### API Logging

```typescript
// Log outgoing API request
logger.apiRequest(method: string, url: string, context?: LogContext): void

// Log incoming API response
logger.apiResponse(
  method: string,
  url: string,
  status: number,
  duration?: number,        // Response time in milliseconds
  context?: LogContext,
): void
```

**Automatic Status-Based Levels:**
- Status >= 400: Logged as ERROR
- Status < 400: Logged as INFO

**Example:**
```typescript
logApiRequest('POST', '/api/tenants', {
  requestId: 'req_1701169445123_abc123',
  tenantId: 'tenant-456',
  hasAuth: true,
});
// Logs response after API call
logApiResponse('POST', '/api/tenants', 201, 156, {
  requestId: 'req_1701169445123_abc123',
  responseSize: 2845,
});
```

#### Specialized Logging

```typescript
// Authentication events
logger.auth(action: string, context?: LogContext): void

// User actions
logger.userAction(action: string, context?: LogContext): void

// Performance metrics
logger.performance(metric: string, value: number, context?: LogContext): void
```

**Examples:**
```typescript
// Auth event
logAuth('Login', { userId: 'user-123', method: 'keycloak' });

// User action
logUserAction('Create Tenant', {
  userId: 'user-123',
  tenantId: 'tenant-456',
  tenantName: 'Acme Corp',
});

// Performance metric
logger.performance('API Call Duration', 250, { endpoint: '/api/tenants' });
```

### Singleton Instance

The logger is exported as a singleton:

```typescript
export const logger = new Logger();

// Convenience function exports
export const logDebug = logger.debug.bind(logger);
export const logInfo = logger.info.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logError = logger.error.bind(logger);
export const logApiRequest = logger.apiRequest.bind(logger);
export const logApiResponse = logger.apiResponse.bind(logger);
export const logAuth = logger.auth.bind(logger);
export const logUserAction = logger.userAction.bind(logger);
export const logPerformance = logger.performance.bind(logger);
```

Use convenience functions for cleaner imports:
```typescript
import { logInfo, logError, logApiRequest } from '@/admin/lib/logger';

logInfo('Processing started', { module: 'TaskProcessor' });
```

### Message Formatting

Log messages are formatted with timestamp, level, module, and message:

```
2024-01-15T10:30:45.123Z INFO [API] API Request: GET /api/tenants
```

**Components:**
- **Timestamp:** ISO 8601 format (UTC)
- **Level:** LOG LEVEL in uppercase (DEBUG, INFO, WARN, ERROR)
- **Module:** `[ModuleName]` if provided in context
- **Message:** The log message

### Remote Logging Integration

Remote logging is disabled by default but can be enabled for production monitoring:

```typescript
NEXT_PUBLIC_ENABLE_REMOTE_LOGGING=true
```

**Supported integrations (template provided):**
- Sentry
- LogRocket
- DataDog

To integrate with Sentry:
```typescript
// In logger.ts logToRemote() method:
if (window.Sentry && entry.level >= LogLevel.ERROR) {
  window.Sentry.captureException(entry.error || new Error(entry.message), {
    level: LogLevel[entry.level].toLowerCase(),
    contexts: { custom: entry.context },
  });
}
```

---

## Error Mapping

### Overview

Error mapping centralizes error code definitions and user-friendly message mapping. It automatically extracts error codes from HTTP responses and provides context for developers while displaying user-friendly messages to end users.

**File:** `src/admin/lib/errorMapping.ts`

### Error Codes

17 standard error codes are defined:

```typescript
export type ErrorCode =
  | 'UNAUTHORIZED'           // 401 - Session expired or invalid token
  | 'FORBIDDEN'              // 403 - Insufficient permissions
  | 'NOT_FOUND'              // 404 - Resource not found
  | 'VALIDATION_ERROR'       // 422 - Input validation failed
  | 'CONFLICT'               // 409 - Data conflict (duplicate, etc.)
  | 'PRECONDITION_FAILED'    // 412 - Required condition not met
  | 'RATE_LIMIT_EXCEEDED'    // 429 - Too many requests
  | 'INTERNAL_SERVER_ERROR'  // 500 - Server error
  | 'SERVICE_UNAVAILABLE'    // 503 - Service temporarily down
  | 'TIMEOUT'                // 504 or ECONNABORTED - Request timeout
  | 'NETWORK_ERROR'          // No response - Network connectivity issue
  | 'TENANT_NOT_ACTIVE'      // 412 + "not active" - Tenant inactive
  | 'TENANT_KEY_INVALID'     // 422 + "key" - Invalid tenant key format
  | 'SUBSCRIPTION_EXPIRED'   // 412 + "subscription" - Subscription lapsed
  | 'PAYMENT_REQUIRED'       // 402 - Payment needed
  | 'WORKFLOW_FAILED'        // 500 + "workflow" - Workflow execution failed
  | 'UNKNOWN_ERROR'          // Unmapped error code
```

### Error Code Mapping Logic

The `extractErrorCode()` function analyzes HTTP status codes and error messages to determine the appropriate error code:

**HTTP Status Code Mapping:**

| Status | Error Code | Condition |
|--------|-----------|-----------|
| 401 | UNAUTHORIZED | Always |
| 402 | PAYMENT_REQUIRED | Always |
| 403 | FORBIDDEN | Always |
| 404 | NOT_FOUND | Always |
| 409 | CONFLICT | Always |
| 412 | PRECONDITION_FAILED | Default |
| 412 | TENANT_NOT_ACTIVE | Message contains "not active" |
| 412 | SUBSCRIPTION_EXPIRED | Message contains "subscription" |
| 422 | VALIDATION_ERROR | Default |
| 422 | TENANT_KEY_INVALID | Message contains "key" |
| 429 | RATE_LIMIT_EXCEEDED | Always |
| 500 | INTERNAL_SERVER_ERROR | Default |
| 500 | WORKFLOW_FAILED | Message contains "workflow" |
| 503 | SERVICE_UNAVAILABLE | Always |
| 504 | TIMEOUT | Always |
| ECONNABORTED | TIMEOUT | Network error code |
| ERR_NETWORK | NETWORK_ERROR | Network error code |

**Extraction from Response:**
```typescript
export function extractErrorCode(error: AxiosError): ErrorCode
```

Example:
```typescript
const error = new AxiosError('Forbidden');
error.response = {
  status: 403,
  data: {},
  headers: {},
  statusText: 'Forbidden',
  config: {} as any,
};

extractErrorCode(error); // Returns 'FORBIDDEN'
```

### User-Friendly Messages

Each error code maps to a clear, actionable user-facing message:

```typescript
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  CONFLICT: 'This action conflicts with existing data. Please verify and try again.',
  PRECONDITION_FAILED: 'A required condition was not met. Please check the status and try again.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',
  TIMEOUT: 'The request timed out. Please check your connection and try again.',
  NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection.',
  TENANT_NOT_ACTIVE: 'This tenant is not active. Please contact support.',
  TENANT_KEY_INVALID: 'Invalid tenant key. Must be 2-10 lowercase letters/numbers.',
  SUBSCRIPTION_EXPIRED: 'Your subscription has expired. Please renew to continue.',
  PAYMENT_REQUIRED: 'Payment is required to access this feature.',
  WORKFLOW_FAILED: 'The operation failed. Please try again or contact support.',
  UNKNOWN_ERROR: 'An unknown error occurred. Please try again.',
};
```

**Mapping function:**
```typescript
export function mapErrorToMessage(errorCode: ErrorCode): string
```

Example:
```typescript
mapErrorToMessage('UNAUTHORIZED');
// Returns: 'Your session has expired. Please log in again.'
```

### Validation Error Extraction

For 422 Validation Error responses, detailed field-level errors are extracted for form display:

```typescript
export interface ValidationError {
  field: string;                        // Form field name
  message: string;                      // Error message for field
  keyword?: string;                     // Validation keyword (e.g., 'maxLength', 'format')
  params?: Record<string, unknown>;     // Validation parameters (e.g., { max: 10 })
}

export function extractValidationErrors(error: AxiosError): ValidationError[]
```

**Response format expected:**
```json
{
  "error": {
    "details": [
      {
        "path": "name",
        "message": "Name is required",
        "keyword": "required"
      },
      {
        "path": "key",
        "message": "Key must be 2-10 characters",
        "keyword": "maxLength",
        "params": { "max": 10 }
      }
    ]
  }
}
```

**Extraction example:**
```typescript
const validationErrors = extractValidationErrors(axiosError);
// Returns: [
//   { field: 'name', message: 'Name is required', keyword: 'required' },
//   { field: 'key', message: 'Key must be 2-10 characters', keyword: 'maxLength', params: { max: 10 } }
// ]
```

### Enhanced Error Object

The `createEnhancedError()` function wraps Axios errors with additional metadata:

```typescript
export interface EnhancedError extends Error {
  status?: number;                      // HTTP status code
  body?: unknown;                       // Response body
  code?: ErrorCode;                     // Mapped error code
  friendlyMessage: string;              // User-friendly message
  validationErrors?: ValidationError[]; // Field-level validation errors
}

export function createEnhancedError(
  error: AxiosError,
  context?: LogContext
): EnhancedError
```

**Creation example:**
```typescript
const axiosError = new AxiosError('Bad Request');
axiosError.response = {
  status: 422,
  data: {
    error: {
      details: [{ path: 'email', message: 'Invalid format', keyword: 'format' }],
    },
  },
  headers: {},
  statusText: 'Unprocessable Entity',
  config: {} as any,
};

const enhanced = createEnhancedError(axiosError, {
  module: 'TenantForm',
  action: 'Create',
  tenantId: 'tenant-123',
});

// enhanced.code === 'VALIDATION_ERROR'
// enhanced.friendlyMessage === 'Please check your input and try again.'
// enhanced.validationErrors === [{ field: 'email', message: '...', keyword: 'format' }]
```

### Automatic Error Logging

`createEnhancedError()` automatically logs errors at appropriate levels:

- **401/403** (Auth errors): Logged as WARN
- **5xx** (Server errors): Logged as ERROR
- **Validation errors**: Logged as WARN with field names
- **Other errors**: Logged as WARN

**Log context includes:**
- `errorCode` - Mapped error code
- `status` - HTTP status
- `url` - Request URL
- `method` - HTTP method
- Additional context passed to function

### Retry Logic

The `isRetryableError()` function identifies errors that should be retried:

```typescript
export function isRetryableError(error: AxiosError): boolean
```

**Retryable errors:**
- Network errors (no response object)
- Timeout errors (ECONNABORTED, 504)
- 5xx server errors
- 429 rate limit errors

**Non-retryable errors:**
- 4xx client errors (except 429)
- 401/403 auth errors
- 422 validation errors

**Usage in retry logic:**
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryableError(error) || i === maxRetries - 1) {
        throw error;
      }
      // Exponential backoff
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## API Client Integration

### Overview

The API client (`apiClient.ts`) is an Axios-based HTTP client configured for the Dashboard service with automatic request/response logging, correlation IDs, and error handling.

**File:** `src/admin/lib/apiClient.ts`

### Configuration

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_PLATFORM_API_URL || 'http://localhost:14000';
const API_PREFIX = (process.env.NEXT_PUBLIC_PLATFORM_API_PREFIX || '/cns').replace(/\/$/, '');
const API_AUDIENCE = process.env.NEXT_PUBLIC_PLATFORM_API_AUDIENCE;

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,  // 30 second timeout
});
```

**Environment Variables:**
- `NEXT_PUBLIC_PLATFORM_API_URL` - Base URL for API (default: `http://localhost:14000`)
- `NEXT_PUBLIC_PLATFORM_API_PREFIX` - API prefix path (default: `/cns`)
- `NEXT_PUBLIC_PLATFORM_API_AUDIENCE` - OAuth audience claim (optional)

### Request Interceptor

The request interceptor (`injectAuthHeaders`) automatically adds authentication and tracing headers:

```typescript
const injectAuthHeaders = async (
  config: InternalAxiosRequestConfig,
): Promise<InternalAxiosRequestConfig>
```

**Headers added:**

| Header | Source | Purpose |
|--------|--------|---------|
| `Authorization` | Keycloak token | Bearer token authentication |
| `X-Tenant-Id` | Active tenant context | Multi-tenant isolation |
| `X-Request-Id` | Generated | Request correlation/tracing |
| `X-Api-Audience` | Environment var | OAuth audience validation |

**Correlation ID format:**
```
req_{timestamp}_{randomString}
// Example: req_1701169445123_a7k2x9m1
```

**Example injected headers:**
```typescript
{
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  'X-Tenant-Id': 'tenant-456',
  'X-Request-Id': 'req_1701169445123_abc123',
  'X-Api-Audience': 'platform-api'
}
```

**Missing token handling:**
If no authentication token is available, an error is logged:
```typescript
logError('No authentication token available', {
  module: 'ApiClient',
  action: 'injectAuthHeaders',
  url: config.url,
});
```

### Response Interceptor

The response interceptor logs successful and failed responses:

**Success path:**
- Logs response at INFO level with status, duration, and response size
- Includes correlation ID from request headers
- Returns response unchanged

**Error path:**
- Creates enhanced error using `createEnhancedError()`
- Logs error with `createEnhancedError()` which determines appropriate log level
- Includes correlation ID and error code in log context
- Returns rejected promise with enhanced error

**Duration calculation:**
Response duration is calculated from request metadata:
```typescript
const duration = requestConfig.metadata?.startTime
  ? Date.now() - requestConfig.metadata.startTime
  : undefined;
// Duration in milliseconds
```

**Request timing metadata:**
A second request interceptor adds timing metadata:
```typescript
client.interceptors.request.use(
  (config) => {
    (config as any).metadata = { startTime: Date.now() };
    return config;
  },
  (error) => Promise.reject(error),
);
```

### Resource Path Helper

The `buildResourcePath()` function constructs API resource paths:

```typescript
export const buildResourcePath = (resource: string): string
```

Automatically prepends API prefix and ensures leading slash:

```typescript
buildResourcePath('tenants');
// Returns: '/cns/tenants'

buildResourcePath('/tenants');
// Returns: '/cns/tenants'
```

### Client Export

The configured Axios instance is exported for use:

```typescript
export const apiClient = client;
```

**Usage:**
```typescript
import { apiClient, buildResourcePath } from '@/admin/lib/apiClient';

// GET request
const response = await apiClient.get(buildResourcePath('tenants'));

// POST request
const created = await apiClient.post(
  buildResourcePath('tenants'),
  { name: 'Acme Corp', key: 'acme' }
);

// Error handling with enhanced error
try {
  await apiClient.post(buildResourcePath('tenants'), data);
} catch (error) {
  // error is EnhancedError with friendlyMessage, code, validationErrors
  console.error(error.friendlyMessage);
}
```

---

## Usage Examples

### Complete Error Handling Flow

```typescript
import { apiClient, buildResourcePath } from '@/admin/lib/apiClient';
import { createEnhancedError, isRetryableError } from '@/admin/lib/errorMapping';
import { logError } from '@/admin/lib/logger';

async function createTenant(data: TenantCreateRequest) {
  try {
    const response = await apiClient.post(
      buildResourcePath('tenants'),
      data
    );
    return response.data;
  } catch (error) {
    // Error is already enhanced by apiClient response interceptor
    if (error instanceof Error && 'code' in error) {
      const enhancedError = error as EnhancedError;

      // Display friendly message to user
      showErrorNotification(enhancedError.friendlyMessage);

      // Show validation errors on form fields
      if (enhancedError.validationErrors) {
        enhancedError.validationErrors.forEach(({ field, message }) => {
          setFieldError(field, message);
        });
      }

      // Determine if we should retry
      if (isRetryableError(error as AxiosError)) {
        console.log('Error is retryable, will retry after delay');
      }
    } else {
      // Unexpected error
      logError('Unexpected error during tenant creation', {
        module: 'TenantService',
        action: 'Create',
      }, error as Error);
    }

    throw error;
  }
}
```

### Logging with Context

```typescript
import { logInfo, logError, logUserAction } from '@/admin/lib/logger';

function handleTenantDelete(tenantId: string) {
  const activeTenantId = getActiveTenantId();

  try {
    logUserAction('Delete Tenant', {
      userId: getCurrentUserId(),
      tenantId,
      initiatedFrom: '/admin/tenants',
    });

    // Delete logic
    apiClient.delete(buildResourcePath(`tenants/${tenantId}`));

    logInfo('Tenant deleted successfully', {
      module: 'TenantService',
      action: 'Delete',
      tenantId,
      deletedAt: new Date().toISOString(),
    });
  } catch (error) {
    logError('Failed to delete tenant', {
      module: 'TenantService',
      action: 'Delete',
      tenantId,
      userId: getCurrentUserId(),
    }, error as Error);

    throw error;
  }
}
```

### Custom API Call with Request Logging

```typescript
import { logApiRequest, logApiResponse } from '@/admin/lib/logger';

async function fetchTenantMetrics(tenantId: string) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  logApiRequest('GET', `/api/tenants/${tenantId}/metrics`, {
    requestId,
    tenantId,
    action: 'FetchMetrics',
  });

  const startTime = Date.now();
  try {
    const response = await apiClient.get(
      buildResourcePath(`tenants/${tenantId}/metrics`)
    );

    const duration = Date.now() - startTime;
    logApiResponse('GET', `/api/tenants/${tenantId}/metrics`, 200, duration, {
      requestId,
      tenantId,
      responseSize: JSON.stringify(response.data).length,
    });

    return response.data;
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiResponse('GET', `/api/tenants/${tenantId}/metrics`, 500, duration, {
      requestId,
      tenantId,
      errorCode: (error as any)?.code || 'UNKNOWN',
    });

    throw error;
  }
}
```

### Validation Error Handling

```typescript
import { extractValidationErrors } from '@/admin/lib/errorMapping';

function handleFormSubmit(formData: TenantFormData) {
  apiClient.post(buildResourcePath('tenants'), formData)
    .catch((error) => {
      if (error.code === 'VALIDATION_ERROR' && error.validationErrors) {
        // Display inline field errors
        error.validationErrors.forEach(({ field, message }) => {
          const fieldElement = document.querySelector(`[name="${field}"]`);
          if (fieldElement) {
            fieldElement.parentElement?.classList.add('error');
            fieldElement.parentElement?.querySelector('.error-message')
              ?.textContent = message;
          }
        });
      } else {
        // Display general error notification
        showErrorNotification(error.friendlyMessage);
      }
    });
}
```

---

## Test Coverage

### Logger Tests (16 test cases)

**File:** `src/admin/lib/__tests__/logger.test.ts`

Test categories and coverage:

| Category | Tests | Details |
|----------|-------|---------|
| **Log Levels** | 1 | Level filtering based on minimum threshold |
| **Structured Logging** | 3 | Context inclusion, timestamp formatting, level display |
| **Error Logging** | 2 | Stack traces, errors without stacks |
| **API Request Logging** | 1 | Method and URL logging with context |
| **API Response Logging** | 3 | Success (INFO), 4xx (ERROR), 5xx (ERROR) status handling |
| **Performance Logging** | 1 | Metric name and duration logging |
| **Auth Logging** | 1 | Authentication event logging |
| **User Action Logging** | 1 | User action logging with context |
| **Context Merging** | 1 | Context merging with specialized loggers |
| **TOTAL** | **16** | - |

**Key test cases:**
- `should filter logs based on minimum level` - DEBUG filtered, INFO/WARN/ERROR logged
- `should include context in log output` - Module, action, userId, tenantId
- `should format timestamp correctly` - ISO 8601 format validation
- `should log API requests with method and URL` - Request logging with correlation
- `should log successful responses as INFO` - Status < 400 logs as INFO
- `should log 4xx/5xx responses as ERROR` - Status >= 400 logs as ERROR
- `should log error with stack trace` - Stack trace extraction and logging

### Error Mapping Tests (37 test cases)

**File:** `src/admin/lib/__tests__/errorMapping.test.ts`

Test categories and coverage:

| Category | Tests | Details |
|----------|-------|---------|
| **extractErrorCode** | 18 | HTTP status codes 401-504, network errors, message-based detection |
| **mapErrorToMessage** | 6 | User-friendly message mapping for all error codes |
| **createEnhancedError** | 4 | Error wrapping, validation extraction, logging by severity |
| **extractValidationErrors** | 3 | Field-level error extraction, missing details, missing paths |
| **isRetryableError** | 6 | Network, timeout, 5xx, rate limit, 4xx, auth errors |
| **TOTAL** | **37** | - |

**Key test cases:**
- HTTP status mapping: 401/403/404/409/412/422/429/402/500/503/504
- Message-based codes: TENANT_KEY_INVALID (422 + "key"), TENANT_NOT_ACTIVE (412 + "not active"), WORKFLOW_FAILED (500 + "workflow")
- Network errors: ECONNABORTED → TIMEOUT, ERR_NETWORK → NETWORK_ERROR
- Validation errors: Extraction, field mapping, keyword/params preservation
- Retry logic: True for network/timeout/5xx/429, false for 4xx/401/403/422

**Test execution:**
```bash
npm run test -- logger.test.ts errorMapping.test.ts
# or
npm run test:watch
```

---

## Configuration Reference

### Environment Variables

**Logger Configuration:**
```bash
# Log level threshold (DEBUG, INFO, WARN, ERROR)
NEXT_PUBLIC_LOG_LEVEL=INFO

# Enable browser console output
NEXT_PUBLIC_ENABLE_CONSOLE_LOGGING=true

# Enable remote logging service integration (Sentry, LogRocket, DataDog)
NEXT_PUBLIC_ENABLE_REMOTE_LOGGING=false
```

**API Client Configuration:**
```bash
# Platform API base URL
NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:14000

# API endpoint prefix
NEXT_PUBLIC_PLATFORM_API_PREFIX=/cns

# OAuth audience claim (optional)
NEXT_PUBLIC_PLATFORM_API_AUDIENCE=platform-api
```

### Default Values

| Setting | Default | Notes |
|---------|---------|-------|
| `NEXT_PUBLIC_LOG_LEVEL` | `INFO` | Production recommended level |
| `NEXT_PUBLIC_ENABLE_CONSOLE_LOGGING` | `true` | Set to `false` to disable console |
| `NEXT_PUBLIC_ENABLE_REMOTE_LOGGING` | `false` | Enable for production monitoring |
| `NEXT_PUBLIC_PLATFORM_API_URL` | `http://localhost:14000` | Local dev default |
| `NEXT_PUBLIC_PLATFORM_API_PREFIX` | `/cns` | CNS service endpoint |
| API timeout | `30000` ms | 30 second timeout for requests |

### .env.example

```bash
# Logging
NEXT_PUBLIC_LOG_LEVEL=INFO
NEXT_PUBLIC_ENABLE_CONSOLE_LOGGING=true
NEXT_PUBLIC_ENABLE_REMOTE_LOGGING=false

# API
NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:14000
NEXT_PUBLIC_PLATFORM_API_PREFIX=/cns
NEXT_PUBLIC_PLATFORM_API_AUDIENCE=platform-api
```

---

## Implementation Notes

### Design Decisions

1. **Singleton Logger:** Logger is a singleton instance to maintain consistent configuration across the application. Methods are exported as convenience functions.

2. **Automatic Error Logging:** The API client automatically logs errors through `createEnhancedError()` which handles appropriate log level selection based on error severity.

3. **Correlation IDs:** Request correlation IDs are automatically generated for tracing request/response pairs in distributed logging scenarios.

4. **Context Enrichment:** Log context is automatically enriched with tenant/user information when available through utilities like `getActiveTenantId()` and `getCurrentUserId()`.

5. **Validation Error Details:** Validation errors (422) include field-level details for form error display, extracted from backend response structure.

6. **Retryable Error Detection:** Network errors, timeouts, and 5xx errors are marked as retryable; client errors and auth errors are not.

### Integration Points

- **Logger** → Used throughout Dashboard service for activity tracking
- **Error Mapping** → Used by API client response interceptor for error transformation
- **API Client** → Used by all services for HTTP communication with automatic logging
- **Keycloak** → Token fetched via `getToken()` for Authorization header
- **Tenant Context** → Tenant ID injected via `getActiveTenantId()` for multi-tenant isolation

### Remote Logging

Remote logging is configured but not integrated by default. To enable:

1. Set `NEXT_PUBLIC_ENABLE_REMOTE_LOGGING=true`
2. Implement integration in `logger.ts` `logToRemote()` method
3. Initialize service (e.g., `Sentry.init()`)

---

## Summary

The centralized logging and error handling system provides:

- **Structured Logging:** Context-aware, level-filtered logging with automatic formatting
- **Error Mapping:** 17 error codes with user-friendly messages and validation extraction
- **API Integration:** Automatic request/response logging with correlation IDs
- **Test Coverage:** 53 comprehensive test cases for reliability
- **Production Ready:** Configuration-driven, extensible, and remote logging capable

All components work together to provide comprehensive visibility into application behavior while presenting clear, actionable information to users when errors occur.
