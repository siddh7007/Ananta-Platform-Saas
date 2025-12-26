# CNS Dashboard Type Definitions

This directory contains centralized TypeScript type definitions for the CNS Dashboard application.

## Usage

All types are exported from `index.ts`, so you can import them directly:

```typescript
import {
  // API Types
  ApiResponse,
  ApiError,
  AdminRecord,
  GetListResult,

  // Auth Types
  KeycloakTokenPayload,
  Auth0User,
  UserIdentity,

  // BOM Types
  BOM,
  BOMLineItem,
  BOMStatus,
  BOMWorkflowEvent,

  // Enrichment Types
  EnrichmentPipelineResult,
  PipelineStepResult,
  EnrichmentProgressEvent,

  // Original shared types
  ComponentBase,
  EnrichedComponent,
  QualityQueueItem,
} from '@/types';
```

## Type Categories

### 1. API Types (`api.ts`)

HTTP client and React Admin data provider types.

**Common Use Cases**:
```typescript
// API response wrapper
const response: ApiResponse<BOM[]> = await fetchBOMs();

// Error handling
catch (error) {
  const apiError = error as ApiError;
  console.error(apiError.detail);
}

// Data provider methods
const result: GetListResult<AdminRecord> = await dataProvider.getList(...);
```

### 2. Auth Types (`auth.ts`)

Authentication and authorization structures.

**Common Use Cases**:
```typescript
// Decode Keycloak JWT
import { jwtDecode } from 'jwt-decode';
const payload: KeycloakTokenPayload = jwtDecode(token);
const roles = payload.realm_access?.roles ?? [];

// Auth0 user profile
const user: Auth0User = {
  sub: 'auth0|123',
  email: 'user@example.com',
  name: 'John Doe',
};

// User identity for app
const identity: UserIdentity = {
  id: user.sub,
  fullName: user.name,
  email: user.email,
};
```

### 3. BOM Types (`bom.ts`)

Bill of Materials data structures.

**Common Use Cases**:
```typescript
// BOM record
const bom: BOM = {
  id: 'uuid',
  name: 'Product v1.0',
  organization_id: 'org-123',
  source: 'staff',
  status: 'enriching',
  total_items: 100,
  enriched_items: 75,
  percent_complete: 75,
  created_at: new Date().toISOString(),
  // ...
};

// Line item with enrichment
const lineItem: BOMLineItem = {
  id: 'uuid',
  bom_id: bom.id,
  line_number: 1,
  manufacturer_part_number: 'MPN-123',
  manufacturer: 'Texas Instruments',
  quantity: 10,
  enrichment_status: 'enriched',
  quality_score: 95,
  // ...
};

// SSE workflow event
const handleEvent = (event: BOMWorkflowEvent) => {
  if (event.type === 'progress') {
    console.log(`Progress: ${event.progress?.percent}%`);
  }
};
```

### 4. Enrichment Types (`enrichment.ts`)

Enrichment pipeline and process types.

**Common Use Cases**:
```typescript
// Pipeline result
const result: EnrichmentPipelineResult = {
  mpn: 'MPN-123',
  manufacturer: 'TI',
  status: 'success',
  steps: [
    {
      step: 'normalization',
      status: 'success',
      duration_ms: 150,
      timestamp: new Date().toISOString(),
    },
    {
      step: 'supplier_api',
      status: 'success',
      duration_ms: 2500,
      timestamp: new Date().toISOString(),
    },
  ],
  quality_score: 95,
  // ...
};

// SSE progress event
const handleProgress = (event: EnrichmentProgressEvent) => {
  switch (event.type) {
    case 'step_start':
      console.log(`Starting ${event.step}`);
      break;
    case 'step_complete':
      console.log(`Completed ${event.step}`);
      break;
    case 'error':
      console.error(`Error: ${event.error}`);
      break;
  }
};
```

## Type Guards

Use type guards for runtime type checking:

```typescript
// Check if error is ApiError
function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'detail' in error &&
    typeof (error as ApiError).detail === 'string'
  );
}

// Check if response is valid
function isValidResponse<T>(data: unknown): data is ApiResponse<T> {
  return (
    typeof data === 'object' &&
    data !== null &&
    'data' in data
  );
}

// Usage
try {
  const response = await fetch('/api/boms');
  const json = await response.json();

  if (isValidResponse<BOM[]>(json)) {
    setBoms(json.data);
  }
} catch (error) {
  if (isApiError(error)) {
    showError(error.detail);
  } else {
    showError('Unknown error');
  }
}
```

## Generic Types

Use generics for flexible, type-safe code:

```typescript
// Generic API fetch
async function fetchResource<T>(url: string): Promise<ApiResponse<T>> {
  const response = await fetch(url);
  return response.json();
}

// Usage
const bomResponse = await fetchResource<BOM[]>('/api/boms');
const lineItemResponse = await fetchResource<BOMLineItem[]>('/api/line-items');
```

## Event Handler Types

Use proper React event types:

```typescript
// Input change
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value);
};

// Button click
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
  submitForm();
};

// Select change
const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
  setOption(e.target.value);
};

// Form submit
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  // ...
};
```

## Migration Guide

### Replacing `any` with proper types

**Before**:
```typescript
const data: any = await response.json();
const handleEvent = (e: any) => { ... };
catch (error: any) { ... }
```

**After**:
```typescript
const data: ApiResponse<BOM[]> = await response.json();
const handleEvent = (e: React.MouseEvent<HTMLButtonElement>) => { ... };
catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
}
```

### Using `unknown` instead of `any`

When you truly don't know the type, use `unknown`:

```typescript
// Bad
function process(data: any) {
  return data.property; // No type checking
}

// Good
function process(data: unknown) {
  if (typeof data === 'object' && data !== null && 'property' in data) {
    return (data as { property: string }).property;
  }
  throw new Error('Invalid data');
}
```

## Best Practices

1. **Always import types from `@/types`**, not relative paths
2. **Use type guards** for runtime validation of unknown data
3. **Prefer interfaces over types** for object shapes (easier to extend)
4. **Use enums or union types** for known sets of values (e.g., `BOMStatus`)
5. **Document complex types** with JSDoc comments
6. **Create specific types** rather than using `Record<string, unknown>`
7. **Use generics** for reusable, type-safe utilities

## Contributing

When adding new types:

1. **Determine the category** (api, auth, bom, enrichment, or new category)
2. **Add JSDoc comments** explaining the purpose
3. **Export from `index.ts`** for easy importing
4. **Update this README** with usage examples
5. **Add type guards** if runtime validation is needed

## References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [React Admin TypeScript Docs](https://marmelab.com/react-admin/TypeScript.html)
