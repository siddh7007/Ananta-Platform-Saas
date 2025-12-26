# BOM Upload & Workflow Hooks

Comprehensive React hooks for managing BOM upload, processing, and Temporal workflow integration in the Customer Business Portal.

## Overview

These hooks provide a complete solution for tracking and controlling BOM processing workflows from upload through enrichment to completion.

### Hooks

1. **`useWorkflowStatus`** - Temporal workflow status and control (pause/resume/cancel)
2. **`useProcessingQueue`** - Organization-wide processing queue management
3. **`useBomUploadStatus`** - Unified status combining all processing phases

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    useBomUploadStatus                        │
│                   (Unified Interface)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │useEnrichmentSSE │  │useWorkflowStatus │  │ Processing │ │
│  │   (Real-time)   │  │ (Temporal Poll)  │  │   Status   │ │
│  └─────────────────┘  └──────────────────┘  └────────────┘ │
│                                                              │
│  Upload → Parse → Enrich → Risk → Complete                  │
│   0-10%   10-20%  20-80%   80-95%  95-100%                  │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

These hooks integrate with CNS Service endpoints:

- `GET /api/bom/workflow/{bom_id}/status` - Workflow status
- `GET /api/bom/workflow/{bom_id}/processing-status` - Detailed processing status
- `POST /api/bom/workflow/{bom_id}/pause` - Pause workflow
- `POST /api/bom/workflow/{bom_id}/resume` - Resume workflow
- `POST /api/bom/workflow/{bom_id}/cancel` - Cancel workflow
- `POST /api/bom/workflow/{bom_id}/restart` - Restart workflow
- `GET /api/bom/workflow/jobs` - List all processing jobs
- `GET /api/enrichment/stream/{bom_id}` - SSE stream for enrichment

## Hook Usage

### 1. useWorkflowStatus

Tracks Temporal workflow status and provides control operations.

```tsx
import { useWorkflowStatus } from '@/hooks';

function BomWorkflowControls({ bomId }: { bomId: string }) {
  const {
    workflowStatus,
    isLoading,
    error,
    pause,
    resume,
    cancel,
    canPause,
    canResume,
    canCancel,
    progressPercent,
  } = useWorkflowStatus(bomId, {
    enabled: true,
    pollInterval: 2000, // Poll every 2 seconds
    onComplete: () => console.log('Workflow completed'),
    onError: (err) => console.error('Workflow error:', err),
  });

  if (isLoading) return <div>Loading workflow status...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h3>Workflow Status: {workflowStatus?.status}</h3>
      <ProgressBar value={progressPercent} />

      {canPause && <Button onClick={pause}>Pause</Button>}
      {canResume && <Button onClick={resume}>Resume</Button>}
      {canCancel && <Button onClick={cancel}>Cancel</Button>}
    </div>
  );
}
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable/disable polling |
| `pollInterval` | `number` | `2000` | Poll interval in milliseconds |
| `onStatusChange` | `(status) => void` | - | Callback on status change |
| `onComplete` | `() => void` | - | Callback on completion |
| `onError` | `(error) => void` | - | Callback on error |

#### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `workflowStatus` | `WorkflowStatusResponse \| null` | Current workflow status |
| `isLoading` | `boolean` | Loading state |
| `error` | `string \| null` | Error message |
| `pause` | `() => Promise<void>` | Pause workflow |
| `resume` | `() => Promise<void>` | Resume workflow |
| `cancel` | `() => Promise<void>` | Cancel workflow |
| `isPending` | `boolean` | Workflow is pending |
| `isRunning` | `boolean` | Workflow is running |
| `isPaused` | `boolean` | Workflow is paused |
| `isCompleted` | `boolean` | Workflow completed |
| `isFailed` | `boolean` | Workflow failed |
| `canPause` | `boolean` | Can pause workflow |
| `canResume` | `boolean` | Can resume workflow |
| `canCancel` | `boolean` | Can cancel workflow |
| `progressPercent` | `number` | Progress percentage (0-100) |

---

### 2. useProcessingQueue

Manages organization-wide processing queue with queue position and estimated times.

```tsx
import { useProcessingQueue } from '@/hooks';

function ProcessingQueueDashboard() {
  const {
    queue,
    isLoading,
    error,
    refetch,
    runningJobs,
    pausedJobs,
    completedJobs,
    queueLength,
    avgProcessingTime,
    getJobPosition,
    getEstimatedWaitTime,
  } = useProcessingQueue({
    enabled: true,
    pollInterval: 5000,
    statusFilter: 'running', // Optional: filter by status
  });

  const myBomId = 'some-bom-id';
  const position = getJobPosition(myBomId);
  const waitTime = getEstimatedWaitTime(myBomId);

  return (
    <div>
      <h2>Processing Queue ({queueLength} jobs)</h2>

      <div>Running: {runningJobs.length}</div>
      <div>Paused: {pausedJobs.length}</div>
      <div>Completed: {completedJobs.length}</div>

      {position && (
        <div>
          Your BOM is #{position} in queue
          {waitTime && ` (Est. ${Math.round(waitTime / 60)} min)`}
        </div>
      )}

      <ul>
        {queue?.jobs.map(job => (
          <li key={job.bomId}>
            {job.bomName} - {job.status} ({job.overallProgress}%)
          </li>
        ))}
      </ul>
    </div>
  );
}
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable/disable polling |
| `pollInterval` | `number` | `5000` | Poll interval in milliseconds |
| `statusFilter` | `string` | - | Filter by status (running, paused, etc.) |
| `onQueueUpdate` | `(queue) => void` | - | Callback on queue update |
| `onError` | `(error) => void` | - | Callback on error |

#### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `queue` | `ProcessingJobListResponse \| null` | Full queue data |
| `isLoading` | `boolean` | Loading state |
| `error` | `string \| null` | Error message |
| `refetch` | `() => Promise<void>` | Manually refetch queue |
| `setStatusFilter` | `(status?) => void` | Change status filter |
| `totalJobs` | `number` | Total jobs in queue |
| `runningJobs` | `ProcessingJobListItem[]` | Running jobs |
| `pausedJobs` | `ProcessingJobListItem[]` | Paused jobs |
| `completedJobs` | `ProcessingJobListItem[]` | Completed jobs |
| `failedJobs` | `ProcessingJobListItem[]` | Failed jobs |
| `pendingJobs` | `ProcessingJobListItem[]` | Pending jobs |
| `queueLength` | `number` | Active jobs (running + pending) |
| `avgProcessingTime` | `number` | Average processing time (seconds) |
| `getJobPosition` | `(bomId) => number \| null` | Get queue position (1-indexed) |
| `getEstimatedWaitTime` | `(bomId) => number \| null` | Estimated wait time (seconds) |

---

### 3. useBomUploadStatus

Unified hook combining upload, enrichment, and analysis status.

```tsx
import { useBomUploadStatus } from '@/hooks';

function BomUploadPage({ bomId }: { bomId: string }) {
  const {
    overallProgress,
    currentPhase,
    status,
    stages,
    isComplete,
    error,
    pause,
    resume,
    cancel,
    canPause,
    canResume,
    totalItems,
    enrichedItems,
    failedItems,
    healthGrade,
  } = useBomUploadStatus(bomId, {
    enableSSE: true, // Use SSE for real-time enrichment updates
    enableWorkflowPolling: true, // Poll Temporal workflow status
    pollInterval: 2000,
    onComplete: () => {
      console.log('BOM processing complete!');
      navigate('/boms');
    },
    onError: (err) => toast.error(err),
    onPhaseChange: (phase) => console.log('Phase changed:', phase),
  });

  return (
    <div>
      <h2>BOM Upload Progress</h2>

      {/* Overall Progress */}
      <ProgressBar value={overallProgress} />
      <div>{Math.round(overallProgress)}% Complete</div>

      {/* Current Phase */}
      <div>Current Phase: {currentPhase}</div>
      <div>Status: {status}</div>

      {/* Stage Breakdown */}
      {stages && (
        <div>
          {Object.entries(stages).map(([name, stage]) => (
            <div key={name}>
              <div>{name}: {stage.status}</div>
              <ProgressBar value={stage.progress} />
            </div>
          ))}
        </div>
      )}

      {/* Metrics */}
      <div>
        <div>Total Items: {totalItems}</div>
        <div>Enriched: {enrichedItems}</div>
        <div>Failed: {failedItems}</div>
        {healthGrade && <div>Health Grade: {healthGrade}</div>}
      </div>

      {/* Controls */}
      {canPause && <Button onClick={pause}>Pause</Button>}
      {canResume && <Button onClick={resume}>Resume</Button>}

      {/* Completion */}
      {isComplete && (
        <div>
          <h3>Processing Complete!</h3>
          <Link to={`/boms/${bomId}`}>View BOM</Link>
        </div>
      )}

      {/* Error */}
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableSSE` | `boolean` | `true` | Enable SSE for enrichment progress |
| `enableWorkflowPolling` | `boolean` | `true` | Enable Temporal workflow polling |
| `pollInterval` | `number` | `2000` | Workflow poll interval (ms) |
| `onComplete` | `() => void` | - | Callback on completion |
| `onError` | `(error) => void` | - | Callback on error |
| `onPhaseChange` | `(phase) => void` | - | Callback on phase change |

#### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `overallProgress` | `number` | Overall progress (0-100) |
| `currentPhase` | `BomProcessingPhase` | Current processing phase |
| `status` | `string` | Overall status |
| `isComplete` | `boolean` | Processing complete |
| `error` | `string \| null` | Error message |
| `processingStatus` | `ProcessingStatusResponse \| null` | Detailed processing status |
| `enrichmentProgress` | `EnrichmentProgressState \| null` | Real-time enrichment progress |
| `workflowStatus` | `WorkflowStatusResponse \| null` | Temporal workflow status |
| `stages` | `Record<string, ProcessingStageInfo> \| null` | Stage breakdown |
| `currentStage` | `string` | Current stage name |
| `pause` | `() => Promise<void>` | Pause processing |
| `resume` | `() => Promise<void>` | Resume processing |
| `cancel` | `() => Promise<void>` | Cancel processing |
| `retry` | `() => void` | Retry connection/status |
| `refetch` | `() => Promise<void>` | Refetch all status |
| `isLoading` | `boolean` | Loading state |
| `isPaused` | `boolean` | Processing is paused |
| `canPause` | `boolean` | Can pause |
| `canResume` | `boolean` | Can resume |
| `canCancel` | `boolean` | Can cancel |
| `totalItems` | `number` | Total BOM line items |
| `enrichedItems` | `number` | Enriched items count |
| `failedItems` | `number` | Failed items count |
| `riskScoredItems` | `number` | Risk-scored items count |
| `healthGrade` | `string \| null` | Overall health grade |

#### Processing Phases

The hook tracks five distinct phases:

1. **`upload`** (0-10%) - File upload to server
2. **`parsing`** (10-20%) - File parsing and validation
3. **`enrichment`** (20-80%) - Component enrichment via Temporal
4. **`risk_analysis`** (80-95%) - Risk scoring and health grade
5. **`complete`** (95-100%) - Finalization

---

## Common Patterns

### Pattern 1: Queue Card with Controls

Show BOM in queue with pause/resume/cancel buttons:

```tsx
function QueueCard({ bomId }: { bomId: string }) {
  const {
    overallProgress,
    status,
    pause,
    resume,
    cancel,
    canPause,
    canResume,
    canCancel,
  } = useBomUploadStatus(bomId);

  const {
    getJobPosition,
    getEstimatedWaitTime,
  } = useProcessingQueue();

  const position = getJobPosition(bomId);
  const waitTime = getEstimatedWaitTime(bomId);

  return (
    <Card>
      <ProgressBar value={overallProgress} />
      <div>Status: {status}</div>

      {position && <div>Queue Position: #{position}</div>}
      {waitTime && <div>Est. Wait: {formatTime(waitTime)}</div>}

      <ButtonGroup>
        {canPause && <Button onClick={pause}>Pause</Button>}
        {canResume && <Button onClick={resume}>Resume</Button>}
        {canCancel && <Button onClick={cancel}>Cancel</Button>}
      </ButtonGroup>
    </Card>
  );
}
```

### Pattern 2: Multi-Phase Progress Display

Show progress broken down by phase:

```tsx
function PhaseProgressBar({ bomId }: { bomId: string }) {
  const { stages } = useBomUploadStatus(bomId);

  const phaseLabels = {
    raw_upload: 'Upload',
    parsing: 'Parse',
    enrichment: 'Enrich',
    risk_analysis: 'Risk',
    complete: 'Done',
  };

  return (
    <div className="flex gap-2">
      {Object.entries(stages || {}).map(([name, stage]) => (
        <div key={name} className="flex-1">
          <div>{phaseLabels[name]}</div>
          <ProgressBar value={stage.progress} />
          <div className="text-xs">{stage.status}</div>
        </div>
      ))}
    </div>
  );
}
```

### Pattern 3: Real-Time SSE Updates

Combine SSE and workflow polling for comprehensive tracking:

```tsx
function EnrichmentMonitor({ bomId }: { bomId: string }) {
  const {
    enrichmentProgress, // From SSE
    workflowStatus,     // From Temporal
    processingStatus,   // From API
  } = useBomUploadStatus(bomId, {
    enableSSE: true,
    enableWorkflowPolling: true,
  });

  return (
    <div>
      {/* Real-time item updates from SSE */}
      {enrichmentProgress?.currentItem && (
        <div>
          Processing: {enrichmentProgress.currentItem.mpn}
          Status: {enrichmentProgress.currentItem.status}
        </div>
      )}

      {/* Workflow state from Temporal */}
      <div>Workflow: {workflowStatus?.status}</div>

      {/* Overall processing status */}
      <div>Stage: {processingStatus?.currentStage}</div>
    </div>
  );
}
```

---

## Error Handling

All hooks provide error states and callbacks:

```tsx
const { error, retry } = useBomUploadStatus(bomId, {
  onError: (err) => {
    toast.error(err);
    logError('BOM processing error', { bomId, error: err });
  },
});

if (error) {
  return (
    <Alert variant="error">
      <div>{error}</div>
      <Button onClick={retry}>Retry</Button>
    </Alert>
  );
}
```

---

## Testing

Example test setup:

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { useWorkflowStatus } from './useWorkflowStatus';

describe('useWorkflowStatus', () => {
  it('polls workflow status', async () => {
    const { result } = renderHook(() =>
      useWorkflowStatus('bom-123', { pollInterval: 1000 })
    );

    await waitFor(() => {
      expect(result.current.workflowStatus).not.toBeNull();
    });

    expect(result.current.workflowStatus?.status).toBe('running');
  });

  it('pauses workflow', async () => {
    const { result } = renderHook(() => useWorkflowStatus('bom-123'));

    await result.current.pause();

    expect(result.current.workflowStatus?.status).toBe('paused');
  });
});
```

---

## Performance Considerations

### Polling Intervals

- **Workflow Status**: 2 seconds (default)
- **Processing Queue**: 5 seconds (default)
- **SSE**: Real-time (no polling needed)

### Optimization Tips

1. **Disable when not visible**: Set `enabled: false` when component unmounted
2. **Increase poll intervals**: For background monitoring, use 10-30 seconds
3. **Use SSE for enrichment**: More efficient than polling for real-time updates
4. **Batch queue requests**: Use single `useProcessingQueue` for organization-wide view

```tsx
// Optimize polling based on visibility
const isVisible = useDocumentVisibility();
const { workflowStatus } = useWorkflowStatus(bomId, {
  enabled: isVisible,
  pollInterval: isVisible ? 2000 : 30000,
});
```

---

## Troubleshooting

### Issue: Workflow status not updating

**Solution**: Check Temporal connectivity and verify workflow is running:
```tsx
const { workflowStatus, error } = useWorkflowStatus(bomId);
if (error) {
  console.error('Workflow error:', error);
  // Check CNS service logs and Temporal UI
}
```

### Issue: SSE connection drops

**Solution**: Use retry mechanism:
```tsx
const {
  connectionStatus,
  retry,
} = useBomUploadStatus(bomId);

if (connectionStatus === 'error') {
  // Auto-retry after 5 seconds
  setTimeout(retry, 5000);
}
```

### Issue: Queue position incorrect

**Solution**: Ensure organization_id is set correctly:
```tsx
import { assertTenantContext } from '@/lib/axios';

try {
  assertTenantContext(); // Throws if no tenant selected
  const queue = useProcessingQueue();
} catch (err) {
  // Prompt user to select organization
}
```

---

## Related Documentation

- [CNS Service API](../../app-plane/services/cns-service/README.md)
- [Temporal Workflows](../../app-plane/services/cns-service/app/workflows/README.md)
- [BOM Upload Flow](./UPLOAD-FLOW.md)
- [SSE Implementation](./useEnrichmentSSE.ts)

---

## Support

For issues or questions:
1. Check CNS service logs: `docker logs app-plane-cns-service`
2. Check Temporal UI: http://localhost:27021
3. Review network requests in browser DevTools
4. Contact platform team
