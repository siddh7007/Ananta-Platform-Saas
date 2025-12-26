# SSE Enrichment Stream Testing Guide

## Overview

The CNS Service provides a **Server-Sent Events (SSE)** endpoint for real-time BOM enrichment progress updates. This endpoint is already implemented and working.

## Endpoint Details

### URL
```
GET /api/enrichment/stream/{bom_id}
```

### Full URL (Local Development)
```
http://localhost:27200/api/enrichment/stream/{bom_id}?token={jwt_or_admin_token}
```

### Authentication

Since EventSource doesn't support custom headers, authentication is done via **query parameter**:

- **JWT Token**: Pass Auth0 or Supabase JWT as `?token=eyJ...`
- **Admin Token**: Pass static admin token (for testing)

### CORS Configuration

The endpoint is properly configured for SSE/EventSource with:
- `Access-Control-Allow-Origin`: Configured via CORS settings
- `Access-Control-Allow-Credentials`: true (if enabled)
- `Access-Control-Expose-Headers`: All headers exposed
- `Cache-Control: no-cache`
- `Connection: keep-alive`
- `X-Accel-Buffering: no` (prevents nginx buffering)

## Event Types

The endpoint emits the following SSE events:

### 1. connected
Sent immediately after connection is established.

```json
event: connected
data: {
  "type": "connected",
  "bom_id": "123e4567-e89b-12d3-a456-426614174000",
  "message": "Stream connected"
}
```

### 2. enrichment.started
Sent when enrichment workflow begins.

```json
event: enrichment.started
data: {
  "event_id": "uuid",
  "event_type": "enrichment.started",
  "bom_id": "123e4567-e89b-12d3-a456-426614174000",
  "organization_id": "org-uuid",
  "project_id": "project-uuid",
  "source": "customer",
  "workflow_id": "workflow-uuid",
  "workflow_run_id": "run-uuid",
  "state": {
    "status": "enriching",
    "total_items": 100,
    "enriched_items": 0,
    "failed_items": 0,
    "not_found_items": 0,
    "pending_items": 100,
    "percent_complete": 0.0,
    "started_at": "2025-12-16T14:30:00Z"
  },
  "payload": {
    "config": {
      "batch_size": 10,
      "suppliers": ["mouser", "digikey", "element14"]
    }
  },
  "created_at": "2025-12-16T14:30:00Z"
}
```

### 3. enrichment.progress
Sent periodically during enrichment (after each batch).

```json
event: progress
data: {
  "event_id": "uuid",
  "event_type": "progress",
  "bom_id": "123e4567-e89b-12d3-a456-426614174000",
  "organization_id": "org-uuid",
  "state": {
    "status": "enriching",
    "total_items": 100,
    "enriched_items": 45,
    "failed_items": 2,
    "not_found_items": 0,
    "pending_items": 53,
    "current_batch": 5,
    "total_batches": 10,
    "percent_complete": 45.0,
    "last_update": "2025-12-16T14:32:30Z"
  },
  "payload": {
    "batch": {
      "batch_number": 5,
      "batch_size": 10,
      "completed": 10
    }
  },
  "created_at": "2025-12-16T14:32:30Z"
}
```

### 4. enrichment.completed
Sent when enrichment finishes successfully.

```json
event: enrichment.completed
data: {
  "event_id": "uuid",
  "event_type": "enrichment.completed",
  "bom_id": "123e4567-e89b-12d3-a456-426614174000",
  "state": {
    "status": "completed",
    "total_items": 100,
    "enriched_items": 95,
    "failed_items": 5,
    "percent_complete": 100.0,
    "completed_at": "2025-12-16T14:35:00Z"
  },
  "created_at": "2025-12-16T14:35:00Z"
}
```

### 5. enrichment.failed
Sent if enrichment workflow fails.

```json
event: enrichment.failed
data: {
  "event_id": "uuid",
  "event_type": "enrichment.failed",
  "bom_id": "123e4567-e89b-12d3-a456-426614174000",
  "error": "Rate limit exceeded",
  "message": "Supplier API rate limit exceeded. Retry after 60 seconds.",
  "created_at": "2025-12-16T14:33:00Z"
}
```

### 6. stream_end
Sent after completion/failure to signal stream termination.

```json
event: stream_end
data: {
  "type": "stream_end",
  "reason": "enrichment.completed"
}
```

### 7. error
Sent if there's a server-side error (Redis connection, etc.).

```json
event: error
data: {
  "type": "error",
  "message": "Redis connection error"
}
```

### 8. keepalive
Sent every 30 seconds to prevent connection timeout.

```
: keepalive
```

## Testing with curl

### Basic Test (No Authentication - Will Fail)
```bash
curl -N http://localhost:27200/api/enrichment/stream/123e4567-e89b-12d3-a456-426614174000
```

Expected: `401 Unauthorized` (missing token)

### With Admin Token (For Testing)
```bash
# Set your admin token (from .env or config)
ADMIN_TOKEN="your-admin-token-here"

# Connect to stream
curl -N "http://localhost:27200/api/enrichment/stream/123e4567-e89b-12d3-a456-426614174000?token=${ADMIN_TOKEN}"
```

Expected output:
```
event: connected
data: {"type":"connected","bom_id":"123e4567-e89b-12d3-a456-426614174000","message":"Stream connected"}

: keepalive

event: progress
data: {"event_type":"progress","bom_id":"...","state":{...}}

...
```

### With JWT Token
```bash
# Get JWT from Auth0 or Supabase login
JWT_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."

# Connect to stream
curl -N "http://localhost:27200/api/enrichment/stream/123e4567-e89b-12d3-a456-426614174000?token=${JWT_TOKEN}"
```

## Testing with JavaScript (EventSource)

### Browser Console Test
```javascript
const bomId = '123e4567-e89b-12d3-a456-426614174000';
const token = 'your-jwt-token'; // Get from localStorage or auth context

const eventSource = new EventSource(
  `http://localhost:27200/api/enrichment/stream/${bomId}?token=${token}`
);

// Connection opened
eventSource.onopen = () => {
  console.log('[SSE] Connected');
};

// Listen for 'connected' event
eventSource.addEventListener('connected', (e) => {
  console.log('[SSE] Connected event:', JSON.parse(e.data));
});

// Listen for 'progress' events
eventSource.addEventListener('progress', (e) => {
  const data = JSON.parse(e.data);
  console.log('[SSE] Progress:', data.state.percent_complete + '%');
  console.log('  Enriched:', data.state.enriched_items, '/', data.state.total_items);
});

// Listen for 'enrichment.completed'
eventSource.addEventListener('enrichment.completed', (e) => {
  const data = JSON.parse(e.data);
  console.log('[SSE] Enrichment completed!', data);
  eventSource.close();
});

// Listen for 'enrichment.failed'
eventSource.addEventListener('enrichment.failed', (e) => {
  const data = JSON.parse(e.data);
  console.error('[SSE] Enrichment failed:', data.error);
  eventSource.close();
});

// Connection errors
eventSource.onerror = (err) => {
  console.error('[SSE] Error:', err);
  if (eventSource.readyState === EventSource.CLOSED) {
    console.log('[SSE] Connection closed');
  }
};
```

## Testing with Python

### Install Dependencies
```bash
pip install sseclient-py requests
```

### Test Script
```python
#!/usr/bin/env python3
import requests
from sseclient import SSEClient

# Configuration
CNS_API_URL = "http://localhost:27200"
BOM_ID = "123e4567-e89b-12d3-a456-426614174000"
TOKEN = "your-jwt-or-admin-token"

# Connect to SSE stream
url = f"{CNS_API_URL}/api/enrichment/stream/{BOM_ID}?token={TOKEN}"
response = requests.get(url, stream=True, timeout=300)

if response.status_code != 200:
    print(f"Error: {response.status_code} - {response.text}")
    exit(1)

print(f"Connected to enrichment stream for BOM: {BOM_ID}")

# Parse SSE events
client = SSEClient(response)
for event in client.events():
    print(f"\nEvent: {event.event}")
    print(f"Data: {event.data}")

    # Parse JSON data
    import json
    try:
        data = json.loads(event.data)

        if event.event == 'progress':
            state = data.get('state', {})
            print(f"  Progress: {state.get('enriched_items')}/{state.get('total_items')} ({state.get('percent_complete')}%)")

        elif event.event == 'enrichment.completed':
            print("  Enrichment completed!")
            break

        elif event.event == 'enrichment.failed':
            print(f"  Enrichment failed: {data.get('error')}")
            break

    except json.JSONDecodeError:
        pass
```

## Redis Pub/Sub Architecture

The SSE endpoint subscribes to Redis Pub/Sub for event distribution:

### Channel Pattern
```
enrichment:{bom_id}
```

Example: `enrichment:123e4567-e89b-12d3-a456-426614174000`

### Event Publishing
Events are published by the Temporal workflow activity `publish_enrichment_event`:

1. **Workflow** calls `publish_enrichment_event` activity
2. **Activity** publishes to Redis channel `enrichment:{bom_id}`
3. **SSE Endpoint** listens on Redis channel and streams to connected clients
4. **Frontend** receives events via EventSource

### Dual-Channel Publishing
All events are published to BOTH:
1. **Redis Pub/Sub** - Real-time SSE streaming
2. **Supabase `enrichment_events` table** - Historical persistence

## Verifying the Implementation

### 1. Check Endpoint Registration
```bash
# Check if enrichment_stream router is registered
cd /app-plane/services/cns-service
grep -n "enrichment_stream" app/api/__init__.py
```

Expected output:
```
15:from app.api import enrichment_stream
68:api_router.include_router(enrichment_stream.router, tags=["Enrichment Stream"])
```

### 2. Check Redis Connection
```bash
# Inside CNS service container or with redis-cli
docker exec -it app-plane-redis redis-cli ping
```

Expected: `PONG`

### 3. Test Health Endpoint
```bash
curl http://localhost:27200/api/enrichment/health
```

Expected:
```json
{
  "status": "healthy",
  "redis": "connected"
}
```

### 4. Verify CORS Preflight
```bash
curl -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  http://localhost:27200/api/enrichment/stream/test-id
```

Expected: `200 OK` with CORS headers

## Troubleshooting

### Issue: 401 Unauthorized
**Cause**: Missing or invalid token
**Solution**: Pass valid JWT or admin token via `?token=` query parameter

### Issue: 503 Service Unavailable
**Cause**: Redis not connected
**Solution**:
1. Check Redis is running: `docker ps | grep redis`
2. Check Redis URL in .env: `REDIS_URL=redis://localhost:27012/0`
3. Restart CNS service

### Issue: No events received
**Cause**: No enrichment workflow running OR wrong BOM ID
**Solution**:
1. Start an enrichment workflow first
2. Verify BOM ID is correct
3. Check Temporal workflow logs

### Issue: Connection closes immediately
**Cause**: CORS error OR authentication failure
**Solution**:
1. Check browser console for CORS errors
2. Verify token is valid
3. Check CNS service logs

### Issue: Keepalive not working
**Cause**: Nginx or proxy buffering
**Solution**: SSE endpoint sets `X-Accel-Buffering: no` header - ensure proxy respects it

## Frontend Integration (React)

The Customer Portal already has a hook for this:

```typescript
import { useEnrichmentSSE } from '@/hooks/useEnrichmentSSE';

function BomEnrichmentProgress({ bomId }: { bomId: string }) {
  const {
    progress,
    progressPercent,
    isComplete,
    isFailed,
    error,
    connectionStatus,
    retry,
  } = useEnrichmentSSE(bomId, {
    onComplete: () => {
      console.log('Enrichment completed!');
      // Refetch BOM data
    },
    onError: (err) => {
      console.error('Enrichment error:', err);
    },
  });

  if (connectionStatus === 'connecting') {
    return <div>Connecting to enrichment stream...</div>;
  }

  if (error) {
    return (
      <div>
        Error: {error}
        <button onClick={retry}>Retry</button>
      </div>
    );
  }

  if (!progress) {
    return <div>Waiting for enrichment to start...</div>;
  }

  return (
    <div>
      <h3>Enrichment Progress</h3>
      <progress value={progressPercent} max={100} />
      <p>{progressPercent}% complete</p>
      <p>
        Enriched: {progress.enriched_items} / {progress.total_items}
      </p>
      {progress.failed_items > 0 && (
        <p>Failed: {progress.failed_items}</p>
      )}
      {isComplete && <p>Enrichment completed!</p>}
    </div>
  );
}
```

## Environment Variables

Required in `.env`:

```bash
# Redis (required for SSE)
REDIS_URL=redis://localhost:27012/0

# CNS Service Port
CNS_PORT=8000  # Internal port (mapped to 27200 externally)

# CORS Configuration
CORS_ORIGINS=["http://localhost:3000", "http://localhost:27100"]
CORS_ALLOW_CREDENTIALS=true
```

## Summary

The SSE enrichment stream endpoint is **already implemented** and functional:

- **Location**: `app/api/enrichment_stream.py`
- **Endpoint**: `GET /api/enrichment/stream/{bom_id}?token={jwt}`
- **Events**: connected, progress, enrichment.started, enrichment.completed, enrichment.failed, stream_end, error
- **Backend**: Redis Pub/Sub + Temporal workflow integration
- **Frontend**: React hook `useEnrichmentSSE` ready to use

No additional implementation needed - just test and verify!
