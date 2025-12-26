# Queue Card Quick Reference

Fast reference for using Queue Card components.

## Import

```tsx
import { QueueCard, QueueCardList, QueueCardSkeleton } from '@/components/bom';
```

---

## QueueCard - Single Job

```tsx
<QueueCard
  bomId="bom-123"
  fileName="resistors.csv"
  status="enriching"
  progress={65}
  totalItems={100}
  processedItems={65}
  startedAt={new Date()}
  estimatedCompletion={new Date(Date.now() + 120000)}
  onViewDetails={() => navigate(`/boms/bom-123`)}
  onCancel={() => cancelJob('bom-123')}
  onRetry={() => retryJob('bom-123')}
/>
```

**Key Props:**
- `status`: 'pending' | 'analyzing' | 'processing' | 'enriching' | 'mapping_pending' | 'completed' | 'failed' | 'cancelled'
- `progress`: 0-100
- Actions auto-show based on status

---

## QueueCardList - Multiple Jobs

```tsx
const jobs = [
  {
    bomId: 'bom-001',
    fileName: 'resistors.csv',
    status: 'enriching',
    progress: 75,
    totalItems: 200,
    processedItems: 150,
    startedAt: new Date(),
  },
];

<QueueCardList
  jobs={jobs}
  loading={isLoading}
  onViewDetails={(id) => navigate(`/boms/${id}`)}
  onCancel={cancelJob}
  onRetry={retryJob}
  showFilters={true}
/>
```

**Features:**
- Status filtering
- Empty states
- Loading skeletons
- Job counts

---

## QueueCardSkeleton - Loading

```tsx
{isLoading && (
  <div className="space-y-3">
    <QueueCardSkeleton />
    <QueueCardSkeleton />
    <QueueCardSkeleton />
  </div>
)}
```

---

## Status → Badge Color

| Status | Color |
|--------|-------|
| pending | Amber (warning) |
| analyzing | Amber (warning) |
| processing | Blue (info) |
| enriching | Blue (info) |
| mapping_pending | Amber (warning) |
| completed | Green (success) |
| failed | Red (destructive) |
| cancelled | Gray (outline) |

---

## Action Buttons by Status

| Status | View Details | Cancel | Retry |
|--------|--------------|--------|-------|
| pending | - | - | - |
| analyzing | - | ✓ | - |
| processing | - | ✓ | - |
| enriching | - | ✓ | - |
| mapping_pending | - | - | - |
| completed | ✓ | - | - |
| failed | ✓ | - | ✓ |
| cancelled | - | - | - |

---

## With React Query

```tsx
import { useQuery } from '@tanstack/react-query';

function JobQueuePage() {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['bom-queue'],
    queryFn: () => fetch('/api/boms/queue').then(r => r.json()),
    refetchInterval: 5000, // Poll every 5s
  });

  return (
    <QueueCardList
      jobs={jobs || []}
      loading={isLoading}
      onViewDetails={(id) => navigate(`/boms/${id}`)}
    />
  );
}
```

---

## Data Mapping from API

```tsx
// Transform API response
const mapJob = (apiJob: ApiJob): QueueJob => ({
  bomId: apiJob.bom_id,
  fileName: apiJob.file_name,
  status: apiJob.status.toLowerCase(),
  progress: apiJob.progress,
  totalItems: apiJob.total_items,
  processedItems: apiJob.processed_items,
  startedAt: new Date(apiJob.started_at),
  estimatedCompletion: new Date(apiJob.estimated_completion),
});
```

---

## Common Patterns

### Show Queue After Upload

```tsx
const [showQueue, setShowQueue] = useState(false);

// After upload completes
setShowQueue(true);

{showQueue ? (
  <QueueCardList jobs={jobs} />
) : (
  <UploadForm onComplete={() => setShowQueue(true)} />
)}
```

### Filter Active Jobs Only

```tsx
<QueueCardList
  jobs={jobs}
  defaultStatusFilters={['enriching', 'processing', 'analyzing']}
/>
```

### Auto-refresh Complete

```tsx
const { data: jobs } = useQuery({
  queryKey: ['bom-queue'],
  queryFn: fetchJobs,
  refetchInterval: (data) => {
    // Stop polling if all jobs complete
    const hasActive = data?.some(j =>
      ['enriching', 'processing', 'analyzing'].includes(j.status)
    );
    return hasActive ? 5000 : false;
  },
});
```

---

## Customization

```tsx
// Custom className
<QueueCard className="border-2 shadow-lg" {...props} />

// Custom empty message
<QueueCardList
  jobs={[]}
  emptyMessage="No active upload jobs at this time"
/>

// Hide filters
<QueueCardList jobs={jobs} showFilters={false} />
```

---

## Accessibility

- All interactive elements keyboard accessible
- Screen reader friendly
- ARIA labels on buttons
- Progress bars have aria-label
- High contrast colors
- Icons + text (not color alone)

---

## Need Help?

- Full docs: `docs/QUEUE_CARD_COMPONENTS.md`
- Examples: `src/components/bom/QueueCardExample.tsx`
- Types: `src/types/bom.ts`
- Utils: `src/lib/bom-status.ts`
