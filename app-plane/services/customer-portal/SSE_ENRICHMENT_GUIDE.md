# SSE Enrichment Progress System

Complete guide to the real-time BOM enrichment progress system using Server-Sent Events (SSE).

## Overview

The SSE enrichment system provides real-time updates for BOM component enrichment progress. It replaces polling with efficient server-push notifications and includes automatic fallback to polling if SSE is unavailable.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   React UI      │  SSE    │  CNS Service     │  Redis  │  Temporal       │
│   Components    │◄────────│  FastAPI         │◄────────│  Workflows      │
│                 │         │  /api/enrichment │         │                 │
└─────────────────┘         │  /stream/{bomId} │         └─────────────────┘
        │                   └──────────────────┘
        │ Fallback                   │
        │ (Auto)                     │
        ▼                            ▼
┌─────────────────┐         ┌──────────────────┐
│   Polling       │  REST   │  Supabase DB     │
│   Hook          │◄────────│  enrichment_     │
│                 │         │  events table    │
└─────────────────┘         └──────────────────┘
```

## File Structure

```
customer-portal/src/
├── hooks/
│   ├── useEnrichmentStream.ts           # Primary SSE hook (NEW - recommended)
│   ├── useEnrichmentProgress.ts         # Legacy Supabase Realtime hook
│   └── useEnrichmentPolling.ts          # Polling fallback hook
├── services/
│   ├── enrichment-stream.service.ts     # SSE connection manager (NEW)
│   └── sseManager.ts                    # Legacy EventSource manager
└── components/
    └── bom/
        └── enrichment/                  # New SSE-based components
            ├── EnrichmentProgressBar.tsx        # Animated progress bar
            ├── EnrichmentStageIndicator.tsx     # Current stage display
            ├── EnrichmentStats.tsx              # Detailed statistics
            ├── EnrichmentMonitorPanel.tsx       # All-in-one panel
            └── index.ts
```

## Quick Start

### Basic Usage

```tsx
import { useEnrichmentStream } from '../hooks/useEnrichmentStream';
import { EnrichmentMonitorPanel } from '../components/bom/enrichment';

function BOMEnrichmentView({ bomId }: { bomId: string }) {
  return (
    <EnrichmentMonitorPanel
      bomId={bomId}
      filename="my-bom.csv"
      onComplete={(state) => console.log('Enrichment complete!', state)}
    />
  );
}
```

### Using the Hook Directly

```tsx
import { useEnrichmentStream } from '../hooks/useEnrichmentStream';

function CustomProgress({ bomId }: { bomId: string }) {
  const {
    state,
    components,
    isConnected,
    isPolling,
    error,
    reconnect,
  } = useEnrichmentStream({
    bomId,
    enabled: true,
    onProgress: (state) => console.log('Progress:', state.percent_complete),
    onComponentCompleted: (comp) => console.log('Component done:', comp.mpn),
    onComplete: (state) => console.log('All done!', state),
  });

  if (!state) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h3>Enrichment Progress</h3>
      <p>Status: {state.status}</p>
      <p>Progress: {state.percent_complete}%</p>
      <p>Enriched: {state.enriched_items} / {state.total_items}</p>
      <p>Connection: {isConnected ? 'SSE' : isPolling ? 'Polling' : 'Disconnected'}</p>
      {error && <button onClick={reconnect}>Reconnect</button>}
    </div>
  );
}
```

## Hook API

### `useEnrichmentStream(options)`

Primary hook for SSE-based enrichment progress.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `bomId` | `string` | (required) | BOM ID to track |
| `enabled` | `boolean` | `true` | Enable/disable streaming |
| `onStarted` | `(state) => void` | - | Called when enrichment starts |
| `onProgress` | `(state) => void` | - | Called on progress updates |
| `onComponentCompleted` | `(comp) => void` | - | Called when component enriched |
| `onComponentFailed` | `(comp) => void` | - | Called when component fails |
| `onComplete` | `(state) => void` | - | Called when enrichment completes |
| `onError` | `(error) => void` | - | Called on errors |
| `pollFallbackAfter` | `number` | `3` | Retry attempts before polling |
| `pollInterval` | `number` | `3000` | Polling interval (ms) |

#### Returns

| Property | Type | Description |
|----------|------|-------------|
| `state` | `EnrichmentState \| null` | Current enrichment state |
| `components` | `ComponentProgress[]` | Recent component updates (last 50) |
| `isConnected` | `boolean` | SSE connection active |
| `isPolling` | `boolean` | Using polling fallback |
| `error` | `Error \| null` | Connection/enrichment error |
| `latestEvent` | `EnrichmentEvent \| null` | Most recent event |
| `reconnect` | `() => void` | Manual reconnection |
| `retryCount` | `number` | Current retry attempt |

## Components

### `<EnrichmentMonitorPanel />`

All-in-one enrichment monitoring panel with SSE support.

```tsx
<EnrichmentMonitorPanel
  bomId="abc-123"
  filename="my-bom.csv"
  enabled={true}
  showStats={true}
  showComponentFeed={true}
  showStage={true}
  onComplete={(state) => handleComplete(state)}
  onError={(error) => handleError(error)}
/>
```

### `<EnrichmentProgressBar />`

Animated progress bar with statistics.

```tsx
<EnrichmentProgressBar
  state={enrichmentState}
  showStats={true}
  height={12}
  animated={true}
/>
```

### `<EnrichmentStageIndicator />`

Current enrichment stage display.

```tsx
<EnrichmentStageIndicator
  state={enrichmentState}
  showBatchProgress={true}
  compact={false}
/>
```

### `<EnrichmentStats />`

Detailed statistics and metrics.

```tsx
<EnrichmentStats
  state={enrichmentState}
  showTiming={true}
  showQuality={true}
  variant="detailed" // or "compact"
/>
```

## Data Types

### `EnrichmentState`

```typescript
interface EnrichmentState {
  status: 'idle' | 'connecting' | 'enriching' | 'completed' | 'failed' | 'paused' | 'stopped';
  total_items: number;
  enriched_items: number;
  failed_items: number;
  not_found_items?: number;
  pending_items: number;
  percent_complete: number;
  current_stage?: string;           // e.g., 'fetching', 'normalizing'
  current_batch?: number;
  total_batches?: number;
  started_at?: string;              // ISO timestamp
  completed_at?: string;
  failed_at?: string;
  error_message?: string;
}
```

### `ComponentProgress`

```typescript
interface ComponentProgress {
  line_item_id: string;
  mpn: string;
  manufacturer: string;
  status: 'pending' | 'enriching' | 'enriched' | 'failed' | 'not_found';
  enrichment_data?: {
    supplier?: string;
    price?: number;
    stock?: number;
    datasheet_url?: string;
    lifecycle_status?: string;
    category?: string;
  };
  error_message?: string;
  updated_at: string;
}
```

### `EnrichmentEvent`

```typescript
interface EnrichmentEvent {
  event_id: string;
  event_type: 'enrichment.started' | 'enrichment.progress' |
              'enrichment.component.completed' | 'enrichment.component.failed' |
              'enrichment.completed' | 'enrichment.error';
  bom_id: string;
  organization_id: string;
  project_id?: string;
  state: EnrichmentState;
  component?: ComponentProgress;
  payload: Record<string, any>;
  created_at: string;
}
```

## Server-Side Setup

### CNS API SSE Endpoint

The CNS service must expose the SSE endpoint:

```python
# services/cns-service/api/routes/enrichment.py

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse
import asyncio

router = APIRouter()

@router.get("/enrichment/stream/{bom_id}")
async def stream_enrichment_progress(
    bom_id: str,
    request: Request,
    token: str = Query(None),
):
    """
    SSE endpoint for real-time enrichment progress.
    """
    async def event_generator():
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(f"enrichment:{bom_id}")

        try:
            # Send connected event
            yield {
                "event": "connected",
                "data": json.dumps({"bom_id": bom_id}),
            }

            # Stream events from Redis
            async for message in pubsub.listen():
                if message["type"] == "message":
                    event_data = json.loads(message["data"])
                    yield {
                        "event": event_data.get("event_type", "message"),
                        "data": message["data"],
                    }

                    # Close stream on completion/failure
                    if event_data.get("event_type") in ["enrichment.completed", "enrichment.error"]:
                        break

        finally:
            await pubsub.unsubscribe(f"enrichment:{bom_id}")

    return EventSourceResponse(event_generator())
```

### Event Publishing

Temporal workflows publish events to Redis:

```python
# Publish enrichment event to Redis
await redis_client.publish(
    f"enrichment:{bom_id}",
    json.dumps({
        "event_id": str(uuid.uuid4()),
        "event_type": "enrichment.progress",
        "bom_id": bom_id,
        "organization_id": org_id,
        "state": {
            "status": "enriching",
            "total_items": 100,
            "enriched_items": 50,
            "failed_items": 2,
            "pending_items": 48,
            "percent_complete": 52.0,
        },
        "created_at": datetime.utcnow().isoformat(),
    })
)
```

## Migration Guide

### From Polling to SSE

Replace existing polling hooks with the new SSE hook:

**Before (Polling):**
```tsx
import { useEnrichmentPolling } from '../hooks/useEnrichmentPolling';

const { state, isPolling, refresh } = useEnrichmentPolling({
  bomId,
  pollInterval: 3000,
  onProgress: handleProgress,
});
```

**After (SSE):**
```tsx
import { useEnrichmentStream } from '../hooks/useEnrichmentStream';

const { state, isConnected, isPolling, reconnect } = useEnrichmentStream({
  bomId,
  onProgress: handleProgress,
  // Automatic fallback to polling after 3 SSE failures
});
```

### From Supabase Realtime to SSE

Replace Supabase Realtime subscriptions:

**Before (Supabase Realtime):**
```tsx
import { useEnrichmentProgress } from '../hooks/useEnrichmentProgress';

const { state, isConnected, latestEvent } = useEnrichmentProgress({
  bomId,
  onCompleted: handleComplete,
});
```

**After (SSE):**
```tsx
import { useEnrichmentStream } from '../hooks/useEnrichmentStream';

const { state, isConnected, isPolling, latestEvent } = useEnrichmentStream({
  bomId,
  onComplete: handleComplete,
  // Note: SSE hook uses 'onComplete' instead of 'onCompleted'
});
```

## Best Practices

### 1. Connection Management

- Let the hook handle reconnections automatically
- Use manual `reconnect()` only for user-triggered retries
- Monitor `retryCount` to show connection issues to users

### 2. Fallback Strategy

- The hook automatically falls back to polling after failed SSE attempts
- Default: 3 SSE retries before polling (configurable via `pollFallbackAfter`)
- Polling continues until enrichment completes or connection is restored

### 3. Performance

- SSE is more efficient than polling (server-push vs client-pull)
- Use `enabled={false}` to pause streaming when component is hidden
- Close connections automatically on unmount

### 4. Error Handling

```tsx
const { error, isPolling, reconnect } = useEnrichmentStream({
  bomId,
  onError: (err) => {
    console.error('Enrichment error:', err);
    // Show user-friendly message
    if (err.message.includes('connection')) {
      notify('Connection lost. Retrying...', { type: 'warning' });
    }
  },
});

// Show connection status to users
{error && !isPolling && (
  <Alert severity="warning" action={<Button onClick={reconnect}>Retry</Button>}>
    Connection lost. {isPolling ? 'Using polling mode.' : 'Click retry to reconnect.'}
  </Alert>
)}
```

### 5. Component Feed

- The hook tracks last 50 component updates
- Use for real-time activity feed in UI
- Auto-scrolls to latest enriching component

## Troubleshooting

### SSE Not Connecting

1. **Check CORS**: Ensure CNS API allows EventSource requests
2. **Verify Auth Token**: Token passed as query param (`?token=...`)
3. **Check Network**: Some proxies/firewalls block SSE
4. **Browser Support**: EventSource supported in all modern browsers

### Automatic Polling Fallback

If you see "Polling Mode" status:
- SSE connection failed after max retries
- System automatically switched to polling
- Enrichment continues normally, just less efficient
- Check browser console for SSE errors

### Events Not Received

1. **Check Redis**: Ensure events published to correct channel (`enrichment:{bomId}`)
2. **Verify BOM ID**: Must match between workflow and UI
3. **Check Event Format**: Ensure JSON matches `EnrichmentEvent` interface
4. **Database Lag**: Initial state fetched from Supabase, ensure DB updated

### Memory Leaks

- Hook automatically cleans up on unmount
- Connection closed when enrichment completes
- Use `enabled={false}` to pause streaming without unmounting

## Example Integrations

### BOM Upload Workflow

```tsx
// In BOMUploadWorkflow.tsx
import { EnrichmentMonitorPanel } from '../components/bom/enrichment';

{enrichmentPhase === 'enriching' && enrichingBomId && (
  <EnrichmentMonitorPanel
    bomId={enrichingBomId}
    filename={enrichingFilename}
    onComplete={(state) => {
      setEnrichmentPhase('enriched');
      setEnrichedResults({
        enriched: state.enriched_items,
        failed: state.failed_items,
        total: state.total_items,
      });
      notify('Enrichment complete!', { type: 'success' });
    }}
  />
)}
```

### BOM Detail Page

```tsx
// In BOMDetailView.tsx or BOMEnrichment.tsx
import { useEnrichmentStream } from '../hooks/useEnrichmentStream';
import { EnrichmentProgressBar, EnrichmentStats } from '../components/bom/enrichment';

function BOMDetailWithEnrichment({ bomId }: { bomId: string }) {
  const { state, isConnected } = useEnrichmentStream({ bomId });

  return (
    <Box>
      {state?.status === 'enriching' && (
        <>
          <EnrichmentProgressBar state={state} />
          <EnrichmentStats state={state} variant="compact" />
        </>
      )}
      {/* Rest of BOM details */}
    </Box>
  );
}
```

## Testing

### Unit Tests

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { useEnrichmentStream } from '../hooks/useEnrichmentStream';

test('connects and receives progress events', async () => {
  const { result } = renderHook(() => useEnrichmentStream({
    bomId: 'test-bom-123',
  }));

  await waitFor(() => {
    expect(result.current.isConnected).toBe(true);
  });

  // Simulate SSE event
  // ... test event handling
});
```

### Integration Tests

```tsx
test('falls back to polling on SSE failure', async () => {
  // Mock SSE failure
  global.EventSource = class {
    addEventListener() {
      setTimeout(() => this.onerror(new Error('Connection failed')), 100);
    }
  };

  const { result } = renderHook(() => useEnrichmentStream({
    bomId: 'test-bom',
    pollFallbackAfter: 1,
  }));

  await waitFor(() => {
    expect(result.current.isPolling).toBe(true);
  });
});
```

## Performance Metrics

### SSE vs Polling Comparison

| Metric | SSE | Polling (3s interval) |
|--------|-----|----------------------|
| Latency | <100ms | 0-3000ms (avg 1500ms) |
| Server Load | Low (1 connection) | High (1 req/3s) |
| Network | Efficient (push) | Wasteful (poll) |
| Battery Impact | Low | Medium-High |

### Resource Usage

- SSE connection: ~1KB/event
- Polling: ~5KB/request (headers + body)
- For 100-component BOM: SSE saves ~95% bandwidth

## Future Enhancements

- [ ] WebSocket support for bidirectional communication
- [ ] Binary event encoding (Protocol Buffers)
- [ ] Multi-BOM streaming (single connection)
- [ ] Offline queue for events during disconnection
- [ ] Service Worker integration for background updates

## Support

For issues or questions:
1. Check browser console for SSE errors
2. Verify CNS API `/api/enrichment/stream/{bomId}` endpoint
3. Check Redis Pub/Sub channel: `enrichment:{bomId}`
4. Review Temporal workflow event publishing
5. Test with polling mode to isolate SSE issues

---

Last Updated: 2025-12-15
Version: 1.0.0
