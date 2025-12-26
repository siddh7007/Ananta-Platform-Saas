# useProcessingJobs Hook

React hook for fetching and managing BOM processing jobs with workflow controls.

## Overview

The `useProcessingJobs` hook provides a complete interface for:
- Fetching all processing jobs from the workflow API
- Filtering jobs by status
- Controlling workflow execution (pause, resume, cancel, restart)
- Auto-refreshing when active jobs exist
- Handling job state transitions with callbacks

## API

### Interface

```typescript
interface UseProcessingJobsResult {
  jobs: ProcessingJob[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  pauseJob: (bomId: string) => Promise<void>;
  resumeJob: (bomId: string) => Promise<void>;
  cancelJob: (bomId: string) => Promise<void>;
  restartJob: (bomId: string) => Promise<void>;
  activeJobsCount: number;
  hasActiveJobs: boolean;
}

interface ProcessingJob {
  bomId: string;
  bomName: string | null;
  workflowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentStage: string;
  overallProgress: number;
  totalItems: number;
  enrichedItems: number;
  failedItems: number;
  healthGrade: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  canRestart: boolean;
}
```

### Options

```typescript
interface UseProcessingJobsOptions {
  enabled?: boolean;                        // Enable/disable hook (default: true)
  autoRefreshInterval?: number;             // Auto-refresh interval in ms (default: 5000)
  statusFilter?: JobStatus | JobStatus[];   // Filter by status
  onJobComplete?: (job: ProcessingJob) => void;  // Callback on completion
  onJobFail?: (job: ProcessingJob) => void;      // Callback on failure
  onError?: (error: Error) => void;              // Callback on error
}
```

## Usage Examples

### Basic Usage

```typescript
import { useProcessingJobs } from '@/hooks';

function JobsList() {
  const { jobs, isLoading, error } = useProcessingJobs();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {jobs.map(job => (
        <li key={job.bomId}>
          {job.bomName} - {job.status} ({job.overallProgress}%)
        </li>
      ))}
    </ul>
  );
}
```

### Filter Active Jobs Only

```typescript
function ActiveJobs() {
  const { jobs, pauseJob, resumeJob } = useProcessingJobs({
    statusFilter: ['running', 'paused'],
    autoRefreshInterval: 3000, // Refresh every 3 seconds
  });

  return (
    <div>
      {jobs.map(job => (
        <div key={job.bomId}>
          <h3>{job.bomName}</h3>
          <p>Progress: {job.overallProgress}%</p>

          {job.canPause && (
            <button onClick={() => pauseJob(job.bomId)}>Pause</button>
          )}
          {job.canResume && (
            <button onClick={() => resumeJob(job.bomId)}>Resume</button>
          )}
        </div>
      ))}
    </div>
  );
}
```

### With Notifications

```typescript
import { useProcessingJobs } from '@/hooks';
import { toast } from '@/hooks/useToast';

function JobsWithNotifications() {
  const { jobs } = useProcessingJobs({
    onJobComplete: (job) => {
      toast.success(`BOM enrichment completed: ${job.bomName}`);
    },
    onJobFail: (job) => {
      toast.error(`BOM enrichment failed: ${job.bomName}`);
    },
    onError: (error) => {
      toast.error('Failed to load processing jobs');
    },
  });

  // ... render jobs
}
```

### Manual Refresh

```typescript
function JobsWithManualRefresh() {
  const { jobs, refresh, isLoading } = useProcessingJobs({
    autoRefreshInterval: 0, // Disable auto-refresh
  });

  return (
    <div>
      <button onClick={refresh} disabled={isLoading}>
        Refresh
      </button>
      {/* render jobs */}
    </div>
  );
}
```

### Restart Failed Jobs

```typescript
function FailedJobs() {
  const { jobs, restartJob } = useProcessingJobs({
    statusFilter: ['failed', 'cancelled'],
  });

  return (
    <div>
      {jobs.map(job => (
        <div key={job.bomId}>
          <h3>{job.bomName}</h3>
          <p>Failed Items: {job.failedItems}</p>

          {job.canRestart && (
            <button onClick={() => restartJob(job.bomId)}>
              Restart Job
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Features

### Auto-Refresh
- Automatically refreshes every 5 seconds (configurable) when active jobs exist
- Stops auto-refresh when no active jobs
- Prevents unnecessary polling

### Status Filtering
- Filter by single status: `statusFilter: 'running'`
- Filter by multiple statuses: `statusFilter: ['running', 'paused']`
- No filter returns all jobs

### Workflow Controls
- **Pause**: Available when `status === 'running'`
- **Resume**: Available when `status === 'paused'`
- **Cancel**: Available when `status` is `pending`, `running`, or `paused`
- **Restart**: Available when `status` is `failed` or `cancelled`

### State Transitions
- Detects job completion and triggers `onJobComplete` callback
- Detects job failure and triggers `onJobFail` callback
- Compares previous and current job states

### Computed Properties
Each job includes these computed boolean flags:
- `canPause`: Can the job be paused?
- `canResume`: Can the job be resumed?
- `canCancel`: Can the job be cancelled?
- `canRestart`: Can the job be restarted?

## API Endpoints

The hook calls these CNS Service endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/bom/workflow/jobs` | GET | Fetch all processing jobs |
| `/bom/workflow/{bomId}/pause` | POST | Pause a running job |
| `/bom/workflow/{bomId}/resume` | POST | Resume a paused job |
| `/bom/workflow/{bomId}/cancel` | POST | Cancel a job |
| `/bom/workflow/{bomId}/restart` | POST | Restart a failed/cancelled job |

## Related Hooks

- **`useProcessingStatus`**: Tracks a single BOM's processing status with SSE updates and stage-level details
- **`useEnrichmentSSE`**: Lower-level SSE connection for enrichment progress events
- **`useBomList`**: Fetches BOM list with status filters

## Implementation Notes

### Auto-Refresh Logic
1. Checks if any jobs have `status === 'running' || status === 'paused'`
2. If active jobs exist, starts interval timer
3. Clears timer when no active jobs remain
4. Cleans up on unmount

### Error Handling
- API errors are caught and stored in `error` state
- Error callbacks are invoked for user notification
- Failed control operations throw errors for caller to handle

### Performance
- Uses `useRef` to track mounted state (prevents setState on unmounted component)
- Uses `useCallback` for stable function references
- Minimal re-renders with proper dependency arrays

## Differences from useProcessingStatus

| Feature | useProcessingJobs | useProcessingStatus |
|---------|-------------------|---------------------|
| **Scope** | All jobs (list view) | Single BOM (detail view) |
| **Updates** | Polling (auto-refresh) | SSE (real-time) |
| **Stage Details** | No | Yes (stage-by-stage progress) |
| **Workflow Controls** | All 4 (pause/resume/cancel/restart) | 3 (pause/resume/cancel) |
| **Use Case** | Dashboard/queue view | Single BOM processing page |

## Best Practices

1. **Use status filters** to reduce data transfer and improve performance
2. **Enable auto-refresh** for active job monitoring (dashboard pages)
3. **Disable auto-refresh** when manual control is needed (detail pages)
4. **Handle errors** with `onError` callback and show user notifications
5. **Use callbacks** for state transitions (`onJobComplete`, `onJobFail`)
6. **Debounce controls** if building UI with rapid user interactions

## TypeScript Support

Full TypeScript support with:
- Strict typing for all interfaces
- Discriminated unions for job status
- Type-safe workflow control functions
- IntelliSense for all properties and methods

## See Also

- [useProcessingJobs.example.tsx](./useProcessingJobs.example.tsx) - Comprehensive usage examples
- [useProcessingStatus.ts](./useProcessingStatus.ts) - Single BOM status tracking
- [useEnrichmentSSE.ts](./useEnrichmentSSE.ts) - SSE-based enrichment progress
