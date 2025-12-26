# SSE Enrichment Integration Guide

## Overview

The Customer Portal uses Server-Sent Events (SSE) to receive real-time enrichment progress updates from the CNS backend. This provides a seamless user experience with live progress tracking during BOM enrichment.

## Architecture

```
Frontend (React)               CNS Backend (FastAPI)           Redis Pub/Sub
----------------               ---------------------           -------------
useEnrichmentSSE Hook    ->    /api/enrichment/stream/:id  ->  enrichment:bom:{id}
     |                              |                               |
     |-- EventSource                |-- SSE Stream                  |
     |-- Progress State             |-- Redis Subscribe            |
     |-- UI Updates                 |-- Event Formatting           |
     |                              |                               |
BomDetail Page           <-    SSE Events              <-    enrichment_worker
```

## Backend Endpoint

**URL**: `GET /api/enrichment/stream/{bom_id}?token={jwt_token}`

**Authentication**: JWT token passed as query parameter (EventSource doesn't support custom headers)

**Event Types**:
- `connected` - Initial connection confirmation
- `enrichment.started` - Enrichment process initiated
- `progress` - Progress updates with current state
- `enrichment.completed` - Enrichment finished successfully
- `enrichment.failed` - Enrichment encountered errors
- `stream_end` - Connection closing
- `keepalive` - Heartbeat (every 30s)

## Frontend Hook: useEnrichmentSSE

### Location
`src/hooks/useEnrichmentSSE.ts`

### Usage Example

```typescript
import { useEnrichmentSSE } from '@/hooks/useEnrichmentSSE';

const {
  progress,           // Current progress state
  progressPercent,    // Progress percentage (0-100)
  isComplete,         // Enrichment completed flag
  isFailed,           // Enrichment failed flag
  error,              // Error message if any
  isProcessing,       // Currently processing flag
  connectionStatus,   // SSE connection status
  connect,            // Manual connect function
  disconnect,         // Manual disconnect function
  retry,              // Retry connection
} = useEnrichmentSSE(bomId, {
  autoConnect: true,  // Auto-connect on mount
  onProgress: (state) => {
    console.log('Progress:', state.percent_complete);
  },
  onComplete: (event) => {
    console.log('Completed:', event);
    refetchBom();  // Refresh BOM data
  },
  onError: (error) => {
    console.error('Error:', error);
  },
});
```

### Progress State Structure

```typescript
interface EnrichmentProgressState {
  bom_id: string;
  total_items: number;
  processed_items: number;
  enriched_items: number;
  error_items: number;
  percent_complete: number;
  current_item?: {
    mpn: string;
    status: 'processing' | 'enriched' | 'error';
    message?: string;
  };
  estimated_time_remaining?: number;  // seconds
}
```

## BomDetail Page Integration

### Location
`src/pages/boms/BomDetail.tsx`

### Key Features

1. **Conditional Connection**: Only connects when enrichment is manually initiated
2. **Progress Banner**: Shows real-time progress with animated UI
3. **Automatic Refresh**: Refetches BOM data on completion
4. **Error Handling**: Displays notifications for failures
5. **Connection Status**: Shows connection state in UI

### UI Components

#### Enrichment Button
```typescript
{canEnrich && !sseIsProcessing && needsReEnrichment && (
  <Button onClick={() => setShowEnrichConfirm(true)}>
    <Sparkles className="h-4 w-4 mr-2" />
    Re-Enrich
  </Button>
)}
```

#### Progress Banner
```typescript
{sseIsProcessing && sseProgress && (
  <Card className="border-blue-200 bg-blue-50">
    <CardContent className="py-4">
      <Loader2 className="animate-spin" />
      <Progress value={sseProgress.percent_complete} />
      {sseProgress.enriched_items} / {sseProgress.total_items} enriched
    </CardContent>
  </Card>
)}
```

## Configuration

### Environment Variables

```bash
# .env file
VITE_CNS_API_URL=http://localhost:27200
```

**IMPORTANT**: Do NOT include `/api` in the base URL. The hook appends `/api/enrichment/stream/{bom_id}` automatically.

### Backend Configuration

The CNS service must have:
- Redis connection for pub/sub
- SSE endpoint enabled
- Auth middleware configured for query param tokens

## Debugging

### Console Logs

The hook provides comprehensive console logging:

```
[SSE] Connecting to enrichment stream: { bomId, url, baseUrl }
[SSE] Connection opened successfully: { bomId }
[SSE] Received connected event: { ... }
[SSE] Progress update: { enriched, total, percent, current }
[SSE] Enrichment completed: { bomId, data }
[SSE] Stream ended: { bomId, reason }
```

### Browser DevTools

1. Open Network tab
2. Filter by "stream"
3. Look for `/api/enrichment/stream/{bom_id}` request
4. Check EventStream tab for SSE messages

### Common Issues

#### 1. Double `/api` in URL
**Symptom**: 404 error on SSE connection
**Cause**: `VITE_CNS_API_URL=http://localhost:27200/api` (incorrect)
**Fix**: Remove `/api` from env var: `VITE_CNS_API_URL=http://localhost:27200`

#### 2. Missing Token
**Symptom**: 401 Unauthorized
**Cause**: User not authenticated or token expired
**Fix**: Check AuthContext, ensure user is logged in

#### 3. CORS Issues
**Symptom**: CORS error in console
**Cause**: CNS backend not configured for browser origin
**Fix**: Add `http://localhost:27555` to CORS allowed origins in CNS config

#### 4. Connection Timeout
**Symptom**: Connection closes after 60s with no events
**Cause**: No keepalive events from backend
**Fix**: Ensure Redis pub/sub is working and enrichment worker is running

## Testing

### Manual Test

1. Navigate to a BOM detail page
2. Click "Re-Enrich" button
3. Open browser console
4. Watch for SSE log messages
5. Verify progress banner updates in real-time

### Python Test Script

```bash
cd app-plane/services/cns-service
python test-sse-enrichment.py <bom_id> <jwt_token>
```

This script connects to the SSE endpoint and prints all events.

## Best Practices

1. **Auto-Connect Only When Needed**: Set `autoConnect: false` and connect manually when enrichment starts
2. **Cleanup on Unmount**: Hook handles cleanup automatically via useEffect
3. **Reconnection**: Native EventSource handles reconnection for transient errors
4. **Error Recovery**: Provide retry button in UI for user-initiated reconnection
5. **Loading States**: Show connection status (connecting, connected, error) in UI
6. **Graceful Degradation**: Fall back to polling if SSE fails repeatedly

## Security Considerations

1. **JWT Validation**: Backend validates JWT on every connection
2. **Tenant Isolation**: Backend ensures user can only access their own BOMs
3. **Token Expiry**: Connection closes when token expires; refresh token and reconnect
4. **Rate Limiting**: Backend may rate-limit SSE connections per user/tenant

## Future Enhancements

1. **Reconnection Backoff**: Implement exponential backoff for repeated failures
2. **Multiple BOMs**: Support simultaneous tracking of multiple BOM enrichments
3. **Offline Support**: Queue enrichment requests and sync when online
4. **Push Notifications**: Browser notifications when enrichment completes in background tab
5. **Analytics**: Track SSE connection quality and user engagement metrics

## References

- [Server-Sent Events Spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [EventSource MDN](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [CNS Backend SSE Implementation](../../../app-plane/services/cns-service/app/api/enrichment_stream.py)
