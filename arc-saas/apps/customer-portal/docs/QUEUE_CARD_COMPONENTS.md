# Queue Card Components

Documentation for BOM upload tracking components in the Customer Portal.

## Overview

The Queue Card components provide a visual way to track BOM upload and enrichment job status. These components are designed to show:

- Real-time progress of upload/enrichment jobs
- Time estimates and duration
- Quick actions (view, cancel, retry)
- Visual status indicators with accessibility support

## Components

### 1. QueueCard

Individual card displaying a single upload job's status.

**Location:** `src/components/bom/QueueCard.tsx`

**Props:**

```typescript
interface QueueCardProps {
  bomId: string;                      // Unique BOM identifier
  fileName: string;                   // Display name of uploaded file
  status: BomStatus;                  // Current job status
  progress: number;                   // Progress percentage (0-100)
  totalItems: number;                 // Total line items in BOM
  processedItems: number;             // Number of items processed
  startedAt?: Date;                   // When job started
  estimatedCompletion?: Date;         // ETA for completion
  onViewDetails?: () => void;         // Handler to view BOM details
  onCancel?: () => void;              // Handler to cancel job
  onRetry?: () => void;               // Handler to retry failed job
  className?: string;                 // Additional CSS classes
}
```

**Status Values:**

| Status | Badge Color | Shows Cancel | Shows Retry | Shows View |
|--------|-------------|--------------|-------------|------------|
| `pending` | Warning (amber) | No | No | No |
| `analyzing` | Warning (amber) | Yes | No | No |
| `processing` | Info (blue) | Yes | No | No |
| `enriching` | Info (blue) | Yes | No | No |
| `mapping_pending` | Warning (amber) | No | No | No |
| `completed` | Success (green) | No | No | Yes |
| `failed` | Destructive (red) | No | Yes | Yes |
| `cancelled` | Outline (gray) | No | No | No |

**Features:**

- Color-coded status badges with icons
- Animated spinner for active statuses
- Progress bar for in-progress jobs
- Time information (started, ETA, duration)
- Conditional action buttons based on status
- Responsive layout
- Accessibility labels and keyboard support

**Example Usage:**

```tsx
import { QueueCard } from '@/components/bom';

<QueueCard
  bomId="bom-123"
  fileName="resistors-bom.csv"
  status="enriching"
  progress={65}
  totalItems={100}
  processedItems={65}
  startedAt={new Date(Date.now() - 5 * 60 * 1000)}
  estimatedCompletion={new Date(Date.now() + 2 * 60 * 1000)}
  onViewDetails={() => navigate(`/boms/bom-123`)}
  onCancel={() => cancelJob('bom-123')}
/>
```

---

### 2. QueueCardList

List container for multiple queue cards with filtering.

**Location:** `src/components/bom/QueueCardList.tsx`

**Props:**

```typescript
interface QueueCardListProps {
  jobs: QueueJob[];                   // Array of upload jobs
  loading?: boolean;                  // Show loading skeletons
  onViewDetails?: (bomId: string) => void;
  onCancel?: (bomId: string) => void;
  onRetry?: (bomId: string) => void;
  className?: string;
  emptyMessage?: string;              // Custom empty state message
  showFilters?: boolean;              // Show status filter dropdown
  defaultStatusFilters?: BomStatus[]; // Pre-selected filters
}

interface QueueJob {
  bomId: string;
  fileName: string;
  status: BomStatus;
  progress: number;
  totalItems: number;
  processedItems: number;
  startedAt?: Date;
  estimatedCompletion?: Date;
}
```

**Features:**

- Multi-select status filtering via dropdown
- Active filter badges with click-to-remove
- Job count display
- Empty state for no jobs
- Filtered empty state with clear filters action
- Status counts in filter dropdown
- Loading state with skeletons
- Keyboard accessible

**Example Usage:**

```tsx
import { QueueCardList } from '@/components/bom';

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
  // ... more jobs
];

<QueueCardList
  jobs={jobs}
  loading={isLoading}
  onViewDetails={(id) => navigate(`/boms/${id}`)}
  onCancel={(id) => cancelEnrichment(id)}
  onRetry={(id) => retryEnrichment(id)}
  showFilters={true}
/>
```

---

### 3. QueueCardSkeleton

Loading placeholder for queue cards.

**Location:** `src/components/bom/QueueCardSkeleton.tsx`

**Props:**

```typescript
interface QueueCardSkeletonProps {
  className?: string;
  showFooter?: boolean;  // Show footer action skeleton
}
```

**Example Usage:**

```tsx
import { QueueCardSkeleton } from '@/components/bom';

// Show 3 loading skeletons
{isLoading && (
  <>
    <QueueCardSkeleton />
    <QueueCardSkeleton />
    <QueueCardSkeleton />
  </>
)}
```

---

## Integration Patterns

### 1. Static Job List

Display a known list of jobs without real-time updates.

```tsx
function UploadHistoryPage() {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['bom-history'],
    queryFn: fetchBomHistory,
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

### 2. Real-time Updates with Polling

Poll for job updates every few seconds.

```tsx
function ActiveJobsPage() {
  const { data: jobs } = useQuery({
    queryKey: ['active-bom-jobs'],
    queryFn: fetchActiveJobs,
    refetchInterval: 5000, // Poll every 5 seconds
  });

  return (
    <QueueCardList
      jobs={jobs || []}
      showFilters={true}
      defaultStatusFilters={['enriching', 'processing']}
      onCancel={cancelJob}
    />
  );
}
```

### 3. Real-time Updates with SSE

Use Server-Sent Events for real-time progress.

```tsx
function JobQueuePage() {
  const [jobs, setJobs] = useState<QueueJob[]>([]);

  // SSE connection for real-time updates
  useEffect(() => {
    const eventSource = new EventSource('/api/bom-queue/stream');

    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setJobs((prev) =>
        prev.map((job) =>
          job.bomId === update.bomId
            ? { ...job, ...update }
            : job
        )
      );
    };

    return () => eventSource.close();
  }, []);

  return <QueueCardList jobs={jobs} />;
}
```

### 4. Combined with Upload Flow

Show queue after file upload.

```tsx
function BomUploadPage() {
  const [currentView, setCurrentView] = useState<'upload' | 'queue'>('upload');
  const [jobs, setJobs] = useState<QueueJob[]>([]);

  const handleUploadComplete = (result: BomUploadResult) => {
    // Add new job to queue
    setJobs((prev) => [
      {
        bomId: result.bomId,
        fileName: result.name,
        status: result.status,
        progress: 0,
        totalItems: result.lineCount,
        processedItems: 0,
        startedAt: new Date(),
      },
      ...prev,
    ]);
    setCurrentView('queue');
  };

  return (
    <div>
      {currentView === 'upload' && (
        <BomUploadForm onComplete={handleUploadComplete} />
      )}
      {currentView === 'queue' && (
        <QueueCardList
          jobs={jobs}
          onViewDetails={(id) => navigate(`/boms/${id}`)}
        />
      )}
    </div>
  );
}
```

---

## Styling

### Color Palette

Status colors follow a color-blind safe palette:

| Status Type | Background | Border | Text | Icon |
|-------------|------------|--------|------|------|
| Success | Emerald 50/950 | Emerald 200/800 | Emerald 700/300 | CheckCircle2 |
| Warning | Amber 50/950 | Amber 200/800 | Amber 700/300 | AlertTriangle |
| Error | Red 50/950 | Red 200/800 | Red 700/300 | XCircle |
| Info | Blue 50/950 | Blue 200/800 | Blue 700/300 | Info |
| Pending | Slate 50/950 | Slate 200/800 | Slate 700/300 | Clock |
| Processing | Purple 50/950 | Purple 200/800 | Purple 700/300 | Loader2 |

All colors pass WCAG 4.5:1 contrast requirements.

### Customization

Add custom classes via the `className` prop:

```tsx
<QueueCard
  {...props}
  className="border-2 shadow-lg"
/>
```

---

## Accessibility

### Screen Reader Support

- ARIA labels on all interactive elements
- ARIA live regions for status updates
- Progress bars with aria-label showing percentage
- Semantic HTML structure

### Keyboard Navigation

- All buttons are keyboard accessible
- Tab order follows logical flow
- Enter/Space activate buttons
- Filter dropdown is keyboard navigable

### Visual Indicators

- Status conveyed through BOTH color AND icon
- High contrast text
- Focus indicators on interactive elements
- Animations can be disabled via prefers-reduced-motion

---

## Testing

### Unit Tests

```tsx
import { render, screen } from '@testing-library/react';
import { QueueCard } from '@/components/bom';

test('renders enriching status', () => {
  render(
    <QueueCard
      bomId="test-1"
      fileName="test.csv"
      status="enriching"
      progress={50}
      totalItems={100}
      processedItems={50}
    />
  );

  expect(screen.getByText('Enriching')).toBeInTheDocument();
  expect(screen.getByText('50 of 100 items')).toBeInTheDocument();
});
```

### Integration Tests

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { QueueCardList } from '@/components/bom';

test('filters jobs by status', () => {
  const jobs = [
    { bomId: '1', fileName: 'test1.csv', status: 'enriching', ... },
    { bomId: '2', fileName: 'test2.csv', status: 'completed', ... },
  ];

  render(<QueueCardList jobs={jobs} showFilters />);

  // Open filter dropdown
  fireEvent.click(screen.getByText('Filter'));

  // Select only enriching
  fireEvent.click(screen.getByText('Enriching'));

  // Should show 1 job
  expect(screen.getByText('1 job')).toBeInTheDocument();
});
```

---

## API Integration

### Expected API Response

```typescript
// GET /api/boms/queue
{
  "jobs": [
    {
      "bom_id": "bom-123",
      "file_name": "resistors.csv",
      "status": "enriching",
      "progress": 65,
      "total_items": 100,
      "processed_items": 65,
      "started_at": "2025-12-16T10:30:00Z",
      "estimated_completion": "2025-12-16T10:35:00Z"
    }
  ]
}
```

### Data Mapping

```tsx
// Transform API response to QueueJob format
const mapApiJobToQueueJob = (apiJob: ApiJob): QueueJob => ({
  bomId: apiJob.bom_id,
  fileName: apiJob.file_name,
  status: normalizeBomStatus(apiJob.status),
  progress: apiJob.progress,
  totalItems: apiJob.total_items,
  processedItems: apiJob.processed_items,
  startedAt: apiJob.started_at ? new Date(apiJob.started_at) : undefined,
  estimatedCompletion: apiJob.estimated_completion
    ? new Date(apiJob.estimated_completion)
    : undefined,
});
```

---

## Performance Considerations

1. **Virtualization**: For lists > 50 items, consider using `react-virtual` or `react-window`
2. **Memoization**: Wrap handlers with `useCallback` to prevent re-renders
3. **Polling Interval**: Use 5-10 seconds for polling, not faster
4. **SSE Throttling**: Throttle SSE updates to max 1 per second per job
5. **Filtering**: Client-side filtering is fine for < 100 jobs, otherwise filter server-side

---

## Future Enhancements

- [ ] Bulk actions (cancel multiple, retry multiple)
- [ ] Sorting (by status, date, progress)
- [ ] Search/filter by filename
- [ ] Export queue to CSV
- [ ] Notification when job completes
- [ ] Job history with completed/failed archive
- [ ] Estimated cost per job
- [ ] Pause/resume functionality

---

## Related Components

- **EnrichmentProgress**: Shows detailed enrichment progress within BOM detail page
- **BomTable**: Displays BOM line items after enrichment completes
- **ActivityLog**: Shows audit trail for BOM operations
- **DeleteBomDialog**: Confirmation dialog for BOM deletion

---

## Support

For issues or questions, see:
- Component source code: `src/components/bom/Queue*.tsx`
- Example usage: `src/components/bom/QueueCardExample.tsx`
- Type definitions: `src/types/bom.ts`
- Status utilities: `src/lib/bom-status.ts`
