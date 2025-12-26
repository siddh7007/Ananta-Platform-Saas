# BOM Workflow Hooks Implementation Summary

## Overview

Implemented comprehensive React hooks for managing BOM upload and processing workflows with Temporal integration in the Customer Business Portal.

## Deliverables

### 1. New Service Methods (`bom.service.ts`)

Added 7 new API service methods:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `getWorkflowStatus` | `GET /bom/workflow/{bom_id}/status` | Get Temporal workflow status |
| `getProcessingStatus` | `GET /bom/workflow/{bom_id}/processing-status` | Get detailed processing status with stages |
| `pauseWorkflow` | `POST /bom/workflow/{bom_id}/pause` | Pause running workflow |
| `resumeWorkflow` | `POST /bom/workflow/{bom_id}/resume` | Resume paused workflow |
| `cancelWorkflow` | `POST /bom/workflow/{bom_id}/cancel` | Cancel workflow |
| `restartWorkflow` | `POST /bom/workflow/{bom_id}/restart` | Restart workflow from beginning |
| `listProcessingJobs` | `GET /bom/workflow/jobs` | List all processing jobs for organization |

**File**: `arc-saas/apps/customer-portal/src/services/bom.service.ts`

### 2. Hook: useWorkflowStatus

**Purpose**: Manage Temporal workflow status and control operations.

**Features**:
- Polls workflow status at configurable intervals (default: 2s)
- Provides pause/resume/cancel operations
- Auto-stops polling when workflow reaches terminal state
- Error handling with retry logic
- Real-time progress tracking

**Key Methods**:
```typescript
const {
  workflowStatus,      // Current workflow state
  pause,               // Pause workflow
  resume,              // Resume workflow
  cancel,              // Cancel workflow
  progressPercent,     // 0-100 progress
  canPause,            // Can perform pause
  canResume,           // Can perform resume
  canCancel,           // Can perform cancel
} = useWorkflowStatus(bomId, options);
```

**File**: `arc-saas/apps/customer-portal/src/hooks/useWorkflowStatus.ts`

### 3. Hook: useProcessingQueue

**Purpose**: Track processing queue across entire organization.

**Features**:
- Lists all processing jobs with filtering
- Calculates queue position (1-indexed)
- Estimates wait time based on avg processing time
- Categorizes jobs by status (running, paused, completed, etc.)
- Auto-refreshes at configurable intervals (default: 5s)

**Key Methods**:
```typescript
const {
  queue,                    // All jobs in queue
  runningJobs,              // Currently running
  pausedJobs,               // Paused jobs
  getJobPosition,           // Get queue position for BOM
  getEstimatedWaitTime,     // Estimate wait time (seconds)
  queueLength,              // Active jobs count
  avgProcessingTime,        // Avg time per job
} = useProcessingQueue(options);
```

**File**: `arc-saas/apps/customer-portal/src/hooks/useProcessingQueue.ts`

### 4. Hook: useBomUploadStatus

**Purpose**: Unified interface combining all processing phases.

**Features**:
- Combines SSE (enrichment), Temporal (workflow), and API (status)
- Tracks 5 processing phases with weighted progress
- Overall progress calculation (0-100%)
- Stage breakdown with per-stage progress
- Phase change detection and callbacks
- Unified control operations

**Processing Phases** (with progress weights):
1. **Upload** (0-10%) - File upload to server
2. **Parsing** (10-20%) - File parsing and validation
3. **Enrichment** (20-80%) - Component enrichment via Temporal
4. **Risk Analysis** (80-95%) - Risk scoring and health grade
5. **Complete** (95-100%) - Finalization

**Key Methods**:
```typescript
const {
  overallProgress,      // 0-100 weighted progress
  currentPhase,         // Current phase name
  status,               // Overall status
  stages,               // Stage breakdown
  processingStatus,     // Detailed processing info
  enrichmentProgress,   // Real-time SSE updates
  workflowStatus,       // Temporal workflow state
  pause,                // Pause processing
  resume,               // Resume processing
  cancel,               // Cancel processing
  totalItems,           // Total BOM items
  enrichedItems,        // Enriched count
  healthGrade,          // BOM health grade
} = useBomUploadStatus(bomId, options);
```

**File**: `arc-saas/apps/customer-portal/src/hooks/useBomUploadStatus.ts`

### 5. Exports Added to Index

Updated `hooks/index.ts` to export all new hooks and types.

**File**: `arc-saas/apps/customer-portal/src/hooks/index.ts`

### 6. Documentation

Comprehensive documentation with:
- Hook usage examples
- API reference tables
- Common patterns (Queue Cards, Multi-Phase Progress, SSE)
- Error handling strategies
- Performance optimization tips
- Troubleshooting guide

**File**: `arc-saas/apps/customer-portal/src/hooks/README-WORKFLOW-HOOKS.md`

## Integration Points

### CNS Service API Endpoints

All hooks integrate with existing CNS Service endpoints:

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/bom/workflow/{bom_id}/status` | ✅ Verified | Lines 281-368 in bom_workflow.py |
| `GET /api/bom/workflow/{bom_id}/processing-status` | ✅ Verified | Lines 467-580 in bom_workflow.py |
| `POST /api/bom/workflow/{bom_id}/pause` | ✅ Verified | Lines 583-638 in bom_workflow.py |
| `POST /api/bom/workflow/{bom_id}/resume` | ✅ Verified | Lines 641-695 in bom_workflow.py |
| `POST /api/bom/workflow/{bom_id}/cancel` | ✅ Verified | Lines 371-426 in bom_workflow.py |
| `POST /api/bom/workflow/{bom_id}/restart` | ✅ Verified | Lines 817-924 in bom_workflow.py |
| `GET /api/bom/workflow/jobs` | ✅ Verified | Lines 723-814 in bom_workflow.py |
| `GET /api/enrichment/stream/{bom_id}` | ✅ Existing | useEnrichmentSSE.ts already uses this |

### Existing Hooks Integration

The new hooks work alongside existing hooks:

- **`useEnrichmentSSE`** - Already implemented, used by `useBomUploadStatus` for real-time enrichment updates
- **`useProcessingStatus`** - Existing alternative, new hooks provide superset functionality
- **`useProcessingJobs`** - Similar to `useProcessingQueue`, but new hook adds queue position/wait time

## Usage Examples

### Example 1: Queue Card with Controls

```tsx
import { useBomUploadStatus, useProcessingQueue } from '@/hooks';

function QueueCard({ bomId }) {
  const {
    overallProgress,
    status,
    pause,
    resume,
    cancel,
    canPause,
    canResume,
  } = useBomUploadStatus(bomId);

  const { getJobPosition, getEstimatedWaitTime } = useProcessingQueue();

  return (
    <Card>
      <ProgressBar value={overallProgress} />
      <div>Status: {status}</div>
      <div>Position: #{getJobPosition(bomId)}</div>
      <div>Wait: {formatTime(getEstimatedWaitTime(bomId))}</div>
      {canPause && <Button onClick={pause}>Pause</Button>}
      {canResume && <Button onClick={resume}>Resume</Button>}
    </Card>
  );
}
```

### Example 2: Multi-Phase Progress

```tsx
function PhaseProgress({ bomId }) {
  const { stages, currentPhase } = useBomUploadStatus(bomId);

  return (
    <div className="flex gap-2">
      {Object.entries(stages || {}).map(([name, stage]) => (
        <div key={name} className={name === currentPhase ? 'active' : ''}>
          <div>{name}</div>
          <ProgressBar value={stage.progress} />
        </div>
      ))}
    </div>
  );
}
```

### Example 3: Organization-Wide Queue Dashboard

```tsx
function QueueDashboard() {
  const {
    runningJobs,
    pausedJobs,
    queueLength,
    avgProcessingTime,
  } = useProcessingQueue();

  return (
    <div>
      <h2>Processing Queue ({queueLength} active)</h2>
      <div>Running: {runningJobs.length}</div>
      <div>Paused: {pausedJobs.length}</div>
      <div>Avg Time: {Math.round(avgProcessingTime / 60)} min</div>

      <ul>
        {runningJobs.map(job => (
          <li key={job.bomId}>
            {job.bomName} - {job.overallProgress}%
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## TypeScript Types

All hooks are fully typed with comprehensive interfaces:

### WorkflowStatusResponse
```typescript
interface WorkflowStatusResponse {
  jobId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress?: {
    totalItems: number;
    enrichedItems: number;
    failedItems: number;
    pendingItems: number;
    percentComplete: number;
  };
}
```

### ProcessingStatusResponse
```typescript
interface ProcessingStatusResponse {
  bomId: string;
  organizationId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentStage: string;
  stages: Record<string, ProcessingStageInfo>;
  totalItems: number;
  enrichedItems: number;
  failedItems: number;
  riskScoredItems: number;
  healthGrade?: string;
  averageRiskScore?: number;
  // ... more fields
}
```

### ProcessingJobListItem
```typescript
interface ProcessingJobListItem {
  bomId: string;
  bomName?: string;
  workflowId: string;
  status: string;
  currentStage: string;
  overallProgress: number;
  totalItems: number;
  enrichedItems: number;
  failedItems: number;
  healthGrade?: string;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  // ... more fields
}
```

## Error Handling

All hooks provide comprehensive error handling:

1. **Network errors**: Caught and exposed via `error` property
2. **API errors**: Logged and passed to `onError` callback
3. **Retry logic**: `retry()` method available for SSE reconnection
4. **Error callbacks**: `onError` option for custom error handling

```typescript
const { error, retry } = useBomUploadStatus(bomId, {
  onError: (err) => {
    toast.error(err);
    logError('Processing error', { bomId, error: err });
  },
});

if (error) {
  return <ErrorAlert error={error} onRetry={retry} />;
}
```

## Performance Optimizations

1. **Configurable polling**: Adjust intervals based on needs
2. **Auto-stop polling**: Stops when workflow reaches terminal state
3. **SSE for enrichment**: More efficient than polling for real-time updates
4. **Cleanup on unmount**: All timers/connections cleaned up properly
5. **Memoization**: Uses `useMemo` for expensive calculations

## Testing Recommendations

### Unit Tests

```typescript
// Test workflow control
it('pauses workflow', async () => {
  const { result } = renderHook(() => useWorkflowStatus('bom-123'));
  await result.current.pause();
  expect(result.current.workflowStatus?.status).toBe('paused');
});

// Test queue calculations
it('calculates queue position', () => {
  const { result } = renderHook(() => useProcessingQueue());
  const position = result.current.getJobPosition('bom-123');
  expect(position).toBeGreaterThan(0);
});
```

### Integration Tests

```typescript
// Test full workflow
it('tracks complete workflow lifecycle', async () => {
  const { result } = renderHook(() => useBomUploadStatus('bom-123'));

  // Wait for upload phase
  await waitFor(() => expect(result.current.currentPhase).toBe('upload'));

  // Progress through phases
  await waitFor(() => expect(result.current.currentPhase).toBe('enrichment'));
  await waitFor(() => expect(result.current.isComplete).toBe(true));
});
```

## Architecture Benefits

1. **Separation of Concerns**: Each hook has single responsibility
2. **Composability**: Hooks can be used independently or combined
3. **Reusability**: Hooks work across multiple UI components
4. **Type Safety**: Full TypeScript support with comprehensive types
5. **Error Resilience**: Robust error handling throughout
6. **Performance**: Optimized polling and cleanup

## Next Steps

### Recommended UI Components to Build

1. **QueueCard Component** - Show BOM in queue with controls
2. **PhaseProgressBar Component** - Multi-stage progress visualization
3. **QueueDashboard Component** - Organization-wide queue view
4. **WorkflowControls Component** - Pause/resume/cancel buttons
5. **StatusBadge Component** - Status indicator with color coding

### Future Enhancements

1. **WebSocket fallback** - If SSE fails, fall back to WebSocket
2. **Offline queue** - Cache queue state for offline viewing
3. **Notifications** - Push notifications for workflow events
4. **Analytics** - Track workflow performance metrics
5. **Batch operations** - Pause/resume/cancel multiple BOMs

## Files Changed

| File | Status | Lines Changed |
|------|--------|---------------|
| `src/services/bom.service.ts` | Modified | +160 |
| `src/hooks/useWorkflowStatus.ts` | Created | +322 |
| `src/hooks/useProcessingQueue.ts` | Created | +240 |
| `src/hooks/useBomUploadStatus.ts` | Created | +373 |
| `src/hooks/index.ts` | Modified | +20 |
| `src/hooks/README-WORKFLOW-HOOKS.md` | Created | +800 |

**Total**: 6 files, ~1,915 lines of code/documentation

## Testing Checklist

- [ ] Verify workflow status polling starts/stops correctly
- [ ] Test pause/resume/cancel operations
- [ ] Verify queue position calculation
- [ ] Test estimated wait time calculation
- [ ] Verify overall progress calculation (weighted phases)
- [ ] Test SSE connection/reconnection
- [ ] Verify error handling and retry logic
- [ ] Test cleanup on unmount (no memory leaks)
- [ ] Verify TypeScript types compile correctly
- [ ] Test with multiple BOMs in queue

## Deployment Notes

1. **Environment Variables**: Ensure `VITE_CNS_API_URL` is set correctly
2. **Temporal**: Verify Temporal service is running (port 27020)
3. **CNS Service**: Ensure CNS service is running (port 27200)
4. **RabbitMQ**: Required for pause/resume signals (port 27672)
5. **Redis**: Required for workflow locking (port 27012)

## Support

For issues:
1. Check CNS service logs: `docker logs app-plane-cns-service`
2. Check Temporal UI: http://localhost:27021
3. Review browser console for client-side errors
4. Check network tab for API call failures
