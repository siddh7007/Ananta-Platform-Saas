# SSE Integration Test Plan - BomUpload.tsx

## Pre-requisites

### Services Running
```bash
# 1. Start CNS Service (port 27200)
cd app-plane
docker-compose up -d cns-service

# 2. Verify CNS Service is healthy
curl http://localhost:27200/health

# 3. Start Customer Portal (port 27100)
cd arc-saas/apps/customer-portal
bun run dev
```

### Test Data
Prepare test BOM files:
- `test-valid.csv` - 10 valid MPNs (e.g., STM32F407VGT6)
- `test-mixed.csv` - 5 valid + 5 invalid MPNs
- `test-large.csv` - 100+ MPNs for long enrichment

## Test Scenarios

### Test 1: Happy Path - Real-Time Enrichment
**Steps:**
1. Navigate to http://localhost:27100/boms/upload
2. Upload `test-valid.csv`
3. Preview data → Map columns (MPN required)
4. Configure: Enable "Auto-enrich", Level: "Standard"
5. Review summary → Click "Upload BOM"
6. Observe upload flow:
   - **Uploading** step: Progress bar fills
   - **Processing** step: Shows file analysis (2s)
   - **Enriching** step: Shows real SSE progress

**Expected Results:**
- See current MPN being processed
- Progress updates in real-time (0% → 100%)
- Item count: enriched/total updates live
- Estimated time remaining displays
- Connection status shows "connected"
- On completion → Transitions to "Results" step
- Results show enrichment statistics

### Test 2: Error Handling - Invalid MPNs
**Steps:**
1. Upload `test-mixed.csv`
2. Complete wizard → Start enrichment
3. Watch enrichment progress

**Expected Results:**
- Progress continues even with invalid MPNs
- "Failed items" count shows failures
- Final results show both enriched and failed counts
- No crash or SSE disconnect
- Can view BOM with partial enrichment

### Test 3: Connection Resilience
**Steps:**
1. Upload BOM and start enrichment
2. While enriching (at ~30% progress):
   - Stop CNS service: `docker-compose stop cns-service`
3. Wait 10 seconds
4. Restart CNS: `docker-compose start cns-service`

**Expected Results:**
- Connection status changes to "error" or "connecting"
- Browser auto-reconnects when service is back
- Progress resumes from where it left off
- No data loss or duplicate processing

### Test 4: Auto-Enrich Disabled
**Steps:**
1. Upload BOM
2. In "Configure Options" step:
   - Uncheck "Auto-enrich components"
3. Complete upload

**Expected Results:**
- Uploading → Processing → **Skip Enriching** → Results
- SSE hook does NOT connect
- Results show raw BOM data (no enrichment)
- No SSE errors in console

### Test 5: Session Persistence
**Steps:**
1. Start BOM upload
2. Get to "Map Columns" step
3. Refresh page (F5)

**Expected Results:**
- See "Resume Previous Upload" prompt
- Shows previous file name
- Can re-upload same file to resume
- Or click "Start Fresh" to clear

### Test 6: Large BOM Performance
**Steps:**
1. Upload `test-large.csv` (100+ items)
2. Start enrichment
3. Monitor browser console for errors

**Expected Results:**
- Progress updates smoothly (not laggy)
- Estimated time remaining is reasonable
- No console errors about event flooding
- Memory usage stays stable
- Can view BOM even while enriching continues

### Test 7: Network Timeout
**Steps:**
1. Upload BOM and start enrichment
2. While enriching:
   - Use browser DevTools → Network tab
   - Throttle connection to "Offline"
3. Wait 30 seconds
4. Re-enable network

**Expected Results:**
- Shows connection error immediately
- Provides retry/view BOM options
- Can navigate away without crash
- Browser attempts reconnection when online

### Test 8: Cancel Enrichment
**Steps:**
1. Upload BOM and start enrichment
2. While at 50% progress:
   - Click "Back to BOMs" or browser back button

**Expected Results:**
- SSE connection closes cleanly
- No memory leaks (check DevTools)
- No console errors about dangling connections
- Can start new upload without issues

## Browser Console Checks

### Expected SSE Logs
```
[SSE] Connecting to enrichment stream for BOM {bomId}
[SSE] Connection opened successfully
[SSE] Received connected event
[SSE] Progress update: { enriched: 5, total: 10, percent: 50 }
[SSE] Enrichment completed for BOM {bomId}
[SSE] Stream ended: enrichment completed
[SSE] Disconnected from enrichment stream
```

### Check for Errors
Look for these in console (should NOT appear):
- ❌ "process is not defined" (workflow sandbox issue)
- ❌ "EventSource failed" (connection issues)
- ❌ "Maximum update depth exceeded" (React render loop)
- ❌ Memory leak warnings

## API Verification

### Verify SSE Endpoint
```bash
# Test SSE endpoint directly
curl -N -H "Authorization: Bearer {jwt_token}" \
  http://localhost:27200/api/enrichment/stream/{bom_id}

# Expected output:
event: connected
data: {"event_type":"connected","bom_id":"..."}

event: progress
data: {"event_type":"progress","state":{"percent_complete":10,...}}
```

### Check BOM Status
```bash
# After enrichment completes
curl http://localhost:27200/api/boms/{bom_id}

# Should show:
{
  "status": "completed",
  "enriched_items": 10,
  "total_items": 10,
  "enrichment_progress": 100
}
```

## Performance Metrics

### Target Benchmarks
| Metric | Target | Measured |
|--------|--------|----------|
| SSE connection time | < 500ms | ____ms |
| Progress update frequency | ~1-2/sec | ____/sec |
| Memory growth | < 10MB | ____MB |
| Time to first progress | < 2s | ____s |
| Event processing lag | < 100ms | ____ms |

### Measuring Tools
- Chrome DevTools → Performance tab
- Network tab → EventStream inspection
- Memory profiler → Heap snapshots

## Regression Checks

### Ensure Existing Features Still Work
- [ ] Column mapping templates load
- [ ] File parsing detects headers correctly
- [ ] Validation errors show properly
- [ ] Project context persists
- [ ] "View BOM" navigation works
- [ ] Multiple file upload (sequential)

## Sign-Off Criteria

✅ All 8 test scenarios pass
✅ No console errors during normal flow
✅ SSE connects and disconnects cleanly
✅ Performance metrics meet targets
✅ UI remains responsive during enrichment
✅ Error states have recovery paths
✅ Session persistence works correctly
✅ Memory usage is stable (no leaks)

## Known Issues / Limitations

- SSE requires JWT token in query parameter (EventSource limitation)
- Browser auto-reconnects may cause duplicate processing (needs idempotency)
- Estimated time remaining may fluctuate initially (improves over time)
- Connection status transitions may show briefly during reconnect

## Rollback Plan

If SSE integration causes issues:

1. Revert changes to BomUpload.tsx
2. Restore fake progress simulation
3. Keep EnrichmentProgress component for future use
4. Re-enable SSE after fixing issues

```bash
# Rollback command
git checkout HEAD~1 -- arc-saas/apps/customer-portal/src/pages/boms/BomUpload.tsx
```
