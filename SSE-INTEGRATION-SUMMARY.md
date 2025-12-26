# SSE Real-Time Progress Integration - BomUpload.tsx

## Summary

Successfully integrated real-time SSE (Server-Sent Events) progress tracking into the BOM upload workflow, replacing fake progress simulation with actual enrichment progress from the CNS service.

## Changes Made

### File: `arc-saas/apps/customer-portal/src/pages/boms/BomUpload.tsx`

#### 1. Added Imports
```typescript
import { useEnrichmentSSE } from '@/hooks/useEnrichmentSSE';
import { EnrichmentProgress } from '@/components/bom/EnrichmentProgress';
```

#### 2. Integrated SSE Hook
```typescript
const {
  progress: sseProgress,
  progressPercent,
  isComplete: sseIsComplete,
  isFailed: sseIsFailed,
  error: sseError,
  connectionStatus,
} = useEnrichmentSSE(
  uploadResult?.bomId || '',
  {
    autoConnect: !!uploadResult?.bomId && currentStep === 'enriching',
    onComplete: () => {
      // Transition to results step when enrichment completes
      dispatch({ type: 'SET_STEP', step: 'results' });
      setIsProcessing(false);
    },
    onError: (error) => {
      dispatch({ type: 'SET_ERROR', error });
      toast({
        title: 'Enrichment Error',
        description: error,
        variant: 'destructive',
      });
    },
  }
);
```

#### 3. Updated Upload Flow
Removed fake progress simulation (setInterval) and replaced with step-based transitions:

**Old Flow:**
```typescript
// Simulate progress for better UX - THIS IS FAKE!
const progressInterval = setInterval(() => {
  dispatch({
    type: 'SET_UPLOAD_PROGRESS',
    progress: Math.min(state.uploadProgress + 10, 90),
  });
}, 200);
```

**New Flow:**
```typescript
// 1. Upload file
const result = await uploadBom(...);

// 2. Transition to processing (1s delay)
setTimeout(() => {
  dispatch({ type: 'SET_STEP', step: 'processing' });

  // 3. Transition to enriching (2s delay)
  setTimeout(() => {
    if (autoEnrich) {
      dispatch({ type: 'SET_STEP', step: 'enriching' });
      // SSE hook connects automatically and monitors progress
    }
  }, 2000);
}, 1000);
```

#### 4. Enhanced renderEnriching() Function
The existing `renderEnriching()` function already uses the `EnrichmentProgress` component with SSE data:

```typescript
const renderEnriching = () => (
  <div className="mx-auto max-w-2xl space-y-6">
    <div className="text-center">
      <Activity className="h-10 w-10 text-purple-600 animate-pulse" />
      <h3>Enriching Components</h3>
    </div>

    {sseProgress && (
      <EnrichmentProgress
        status="enriching"
        progress={sseProgress.percent_complete}
        totalItems={sseProgress.total_items}
        enrichedItems={sseProgress.enriched_items}
        sseProgress={sseProgress}
        connectionStatus={connectionStatus}
      />
    )}

    {/* Shows current MPN being processed */}
    {sseProgress.current_item && (
      <div className="rounded-lg bg-muted/50 p-3">
        <p className="text-sm font-mono">{sseProgress.current_item.mpn}</p>
      </div>
    )}
  </div>
);
```

## Upload Flow Steps

1. **select_file** - User uploads CSV/Excel file
2. **preview_data** - Show first 10 rows
3. **map_columns** - Map columns to BOM fields (MPN, Manufacturer, etc.)
4. **configure_options** - Set BOM name, description, enrichment level
5. **review_summary** - Final review before upload
6. **uploading** - File transfer to server (shows progress bar)
7. **processing** - Server analyzes file structure (2s simulated)
8. **enriching** - **REAL SSE PROGRESS** from CNS service
9. **results** - Summary with enrichment statistics

## SSE Events Handled

The `useEnrichmentSSE` hook listens for the following SSE events from CNS service:

| Event | Purpose | Action |
|-------|---------|--------|
| `connected` | Connection established | Update connection status |
| `progress` | Enrichment progress update | Update progress state, show current MPN |
| `enrichment.completed` | All components enriched | Transition to 'results' step |
| `enrichment.failed` | Enrichment error | Show error, allow retry |
| `stream_end` | Stream closed | Disconnect SSE |
| `keepalive` | Keep connection alive | Log (sent every 30s) |

## Real-Time Data Displayed

When in the 'enriching' step, users see:

- **Current MPN** being processed
- **Progress percentage** (0-100%)
- **Item counts**: enriched / total
- **Failed item count** (if any)
- **Estimated time remaining** (in minutes)
- **Connection status** (connecting, connected, error)
- **Status badge** with icon (enriching, completed, failed)

## Error Handling

- **Connection errors**: Shows "Connection: error" status
- **Enrichment failures**: Displays error message with options to:
  - View BOM (even if enrichment failed)
  - Upload another BOM
- **Timeout handling**: Browser auto-reconnects for transient errors
- **Toast notifications**: User-friendly error messages via toast

## Testing Checklist

- [ ] Upload CSV with valid MPNs → See real-time enrichment progress
- [ ] Upload file with invalid MPNs → See failed item count
- [ ] Disable auto-enrich → Skip directly to results (no SSE)
- [ ] Network disconnection → See connection error message
- [ ] Cancel enrichment mid-process → Verify SSE cleanup
- [ ] Refresh page during enrichment → Resume prompt with session restore

## Configuration

### Environment Variables
```bash
# Customer Portal (.env)
VITE_CNS_API_URL=http://localhost:27200  # CNS Service endpoint
```

### SSE Endpoint
```
GET http://localhost:27200/api/enrichment/stream/{bom_id}?token={jwt_token}
```

## Dependencies

- `@/hooks/useEnrichmentSSE` - SSE connection hook
- `@/components/bom/EnrichmentProgress` - Progress display component
- `@/services/bom.service` - BOM upload service
- CNS Service SSE endpoint (port 27200)

## Benefits

1. **Real-time feedback** - Users see actual progress, not fake simulation
2. **Transparent process** - Shows which MPN is currently being enriched
3. **Error visibility** - Failed items are immediately visible
4. **Time estimates** - Users know how long enrichment will take
5. **Connection monitoring** - Status indicators for connection health
6. **Graceful degradation** - Falls back to polling if SSE fails

## Future Enhancements

- [ ] Add retry button for failed items
- [ ] Show detailed error reasons per item
- [ ] Add pause/resume enrichment controls
- [ ] Export enrichment log
- [ ] Show supplier API response times
- [ ] Add enrichment quality scores
