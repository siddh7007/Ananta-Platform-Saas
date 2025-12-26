# SSE Enrichment Stream - Quick Reference

## Endpoint

```
GET /api/enrichment/stream/{bom_id}?token={jwt_or_admin_token}
```

**Full URL**: `http://localhost:27200/api/enrichment/stream/{bom_id}?token={token}`

## Quick Tests

### 1. Health Check (No Auth Required)
```bash
curl http://localhost:27200/api/enrichment/health
```

Expected:
```json
{"status": "healthy", "redis": "connected"}
```

### 2. Browser Test
```bash
# Open test page in browser
open test-sse-enrichment.html

# OR serve with Python
python -m http.server 8080
# Then open: http://localhost:8080/test-sse-enrichment.html
```

### 3. curl Test
```bash
# Replace with your BOM ID and token
curl -N "http://localhost:27200/api/enrichment/stream/{bom_id}?token={token}"
```

### 4. Python Test
```bash
# Install dependencies first
pip install requests sseclient-py

# Run test
python test-sse-enrichment.py {bom_id} --token {token}
```

### 5. Bash Test
```bash
chmod +x test-sse-enrichment.sh
./test-sse-enrichment.sh {bom_id} {token}
```

## Frontend Usage

```typescript
import { useEnrichmentSSE } from '@/hooks/useEnrichmentSSE';

const {
  progress,           // EnrichmentProgressState | null
  progressPercent,    // number (0-100)
  isComplete,         // boolean
  isFailed,           // boolean
  error,              // string | null
  connectionStatus,   // 'disconnected' | 'connecting' | 'connected' | 'error'
  connect,            // () => void
  disconnect,         // () => void
  retry,              // () => void
} = useEnrichmentSSE(bomId, {
  onProgress: (state) => console.log('Progress:', state.percent_complete),
  onComplete: (event) => console.log('Complete!', event),
  onError: (err) => console.error('Error:', err),
});

// Display progress
<progress value={progressPercent} max={100} />
<p>{progress?.enriched_items} / {progress?.total_items}</p>
```

## Event Types

| Event | Data |
|-------|------|
| `connected` | Connection confirmation |
| `enrichment.started` | Initial state with total_items |
| `progress` | Progress update with percent_complete |
| `enrichment.completed` | Final state with results |
| `enrichment.failed` | Error details |
| `stream_end` | Stream termination signal |
| `error` | Server-side error |
| `keepalive` | Every 30s (comment, no data) |

## Progress State Fields

```typescript
{
  total_items: number;           // Total items in BOM
  enriched_items: number;        // Successfully enriched
  failed_items: number;          // Failed enrichment
  pending_items: number;         // Not yet processed
  percent_complete: number;      // 0-100
  current_batch?: number;        // Current batch number
  total_batches?: number;        // Total batches
  status: string;                // 'enriching' | 'completed' | 'failed'
  started_at?: string;           // ISO timestamp
  completed_at?: string;         // ISO timestamp
  last_update?: string;          // ISO timestamp
}
```

## Architecture

```
Temporal Workflow → publish_enrichment_event Activity
                         ↓
                    Redis Pub/Sub (channel: enrichment:{bom_id})
                         ↓
                    SSE Endpoint (subscribes to channel)
                         ↓
                    EventSource (browser) OR Python SSEClient
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Pass token via `?token=` query param |
| 503 Service Unavailable | Check Redis: `docker ps \| grep redis` |
| No events received | Verify enrichment workflow is running |
| Connection closes | Check CORS settings and token validity |
| Keepalive not working | Check for nginx buffering (`X-Accel-Buffering: no`) |

## Files

| File | Purpose |
|------|---------|
| `app/api/enrichment_stream.py` | SSE endpoint implementation |
| `app/workflows/bom_enrichment.py` | Event publishing in workflow |
| `test-sse-enrichment.py` | Python test script |
| `test-sse-enrichment.sh` | Bash test script |
| `test-sse-enrichment.html` | Browser test page |
| `TEST_SSE_ENRICHMENT.md` | Comprehensive testing guide |
| `SSE_IMPLEMENTATION_SUMMARY.md` | Full implementation details |

## Configuration

```bash
# .env
REDIS_URL=redis://localhost:27012/0
CNS_PORT=8000  # Internal (27200 external)
CORS_ORIGINS=["http://localhost:3000"]
CORS_ALLOW_CREDENTIALS=true
```

## Status

**ALREADY IMPLEMENTED** - No additional work needed.

All requirements met:
- [x] SSE endpoint at `/api/enrichment/stream/{bom_id}`
- [x] Real-time progress events
- [x] CORS support for EventSource
- [x] Authentication via query parameter
- [x] Keepalive mechanism
- [x] Frontend React hook
- [x] Testing tools and documentation
