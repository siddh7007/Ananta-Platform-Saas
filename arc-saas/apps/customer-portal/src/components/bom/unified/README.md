# Unified BOM Upload Components

This directory contains the **unified BOM upload UI** with a vertical stepper design that provides a better visual workflow compared to the old horizontal stepper approach.

## Design

The unified upload page follows the design from the reference screenshot:

```
┌────────────────┬─────────────────────────────────────┐
│ Vertical       │ Project Selector                    │
│ Stepper        ├─────────────────────────────────────┤
│                │ Upload Queue Card                   │
│ 1. Files       │  - File upload progress             │
│ 2. Upload      │  - 4-column status grid             │
│ 3. Processing  ├─────────────────────────────────────┤
│ 4. Enrichment  │ Enrichment Queue Card (progressive) │
│ 5. Analysis    │  - Component queue list             │
│ 6. Complete    │  - Success rate                     │
│ 7. Summary     ├─────────────────────────────────────┤
│                │ Analysis Queue Card (progressive)   │
│                │  - Risk analysis status             │
│                ├─────────────────────────────────────┤
│                │ Complete Summary Card (final)       │
│                │  - 3-column stats layout            │
└────────────────┴─────────────────────────────────────┘
```

## Components

### BomUploadUnified

Main component that combines vertical stepper with progressive queue cards.

**Usage:**

```tsx
import { BomUploadUnified } from '@/components/bom/unified';

function MyPage() {
  return (
    <BomUploadUnified
      projectId="proj-123"
      projectName="My Project"
      onComplete={(bomId) => {
        console.log('Upload complete:', bomId);
        navigate(`/boms/${bomId}`);
      }}
    />
  );
}
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `projectId` | `string?` | Optional project ID (uses localStorage if not provided) |
| `projectName` | `string?` | Optional project name |
| `onComplete` | `(bomId: string) => void` | Callback when upload/processing completes |
| `className` | `string?` | Optional className for root container |

**Features:**

- Auto-scroll to active step as workflow progresses
- Pause/resume processing at any point
- Navigate back to completed steps
- Real-time progress via SSE
- Temporal workflow integration
- Project context management

### UnifiedQueueCards

Renders the progressive queue cards on the right side, reusing the existing `ProcessingQueueView` component for consistency.

**Usage:**

```tsx
import { UnifiedQueueCards } from '@/components/bom/unified';

function MyQueueView() {
  return (
    <UnifiedQueueCards
      bomId="bom-123"
      fileName="my_bom.csv"
      currentStage="enrichment"
      totalComponents={150}
      enrichedCount={75}
      failedCount={5}
      componentQueue={componentQueue}
      riskAnalysis={riskAnalysis}
      componentStatus={componentStatus}
      alertsCount={3}
      onViewBomDetails={() => navigate('/boms/bom-123')}
      onViewRiskDashboard={() => navigate('/boms/bom-123/risk')}
      onViewAlerts={() => navigate('/boms/bom-123/alerts')}
      onUploadAnother={() => reset()}
    />
  );
}
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `bomId` | `string` | BOM ID for tracking |
| `fileName` | `string` | File name being processed |
| `currentStage` | `ProcessingStage` | Current workflow stage |
| `totalComponents` | `number` | Total components in BOM |
| `enrichedCount` | `number` | Enriched components count |
| `failedCount` | `number` | Failed enrichment count |
| `componentQueue` | `ComponentQueueItem[]?` | Component queue items |
| `riskAnalysis` | `RiskAnalysisData?` | Risk analysis data |
| `componentStatus` | `ComponentStatusBreakdown?` | Component status breakdown |
| `alertsCount` | `number?` | Number of alerts |
| `isPaused` | `boolean?` | Whether processing is paused |
| `onPause` | `() => void` | Pause handler |
| `onResume` | `() => void` | Resume handler |
| `onViewBomDetails` | `() => void` | View BOM details handler |
| `onViewRiskDashboard` | `() => void` | View risk dashboard handler |
| `onViewAlerts` | `() => void` | View alerts handler |
| `onUploadAnother` | `() => void` | Upload another BOM handler |
| `onCancel` | `() => void` | Cancel processing handler |

## Stepper Components

Located in `../stepper/`:

### VerticalStepper

Vertical stepper showing workflow steps on the left sidebar.

**Usage:**

```tsx
import { VerticalStepper, WorkflowStep } from '@/components/bom/stepper';

const steps: WorkflowStep[] = [
  {
    id: 'step1',
    title: 'Step 1',
    description: 'Description',
    icon: FileText,
    status: 'complete',
  },
  {
    id: 'step2',
    title: 'Step 2',
    description: 'Description',
    icon: Upload,
    status: 'active',
  },
  // ...
];

function MyStepper() {
  return (
    <VerticalStepper
      currentStepId="step2"
      steps={steps}
      onStepClick={(stepId) => console.log('Clicked:', stepId)}
      allowNavigateBack={true}
      autoScroll={true}
    />
  );
}
```

### StepIndicator

Individual step indicator with icon, title, and status.

**Status Types:**

- `pending` - Step not yet started (gray)
- `active` - Step currently in progress (blue, spinner icon)
- `complete` - Step finished successfully (green, checkmark icon)
- `error` - Step failed (red, X icon)
- `skipped` - Step was skipped (gray, dashed)

## Integration with Existing Code

The unified upload components leverage existing infrastructure:

### Hooks Used

- `useProcessingStatus` - Real-time BOM processing status via SSE
- `useEnrichmentSSE` - Legacy SSE enrichment progress (fallback)
- `useTenant` - Tenant/organization context
- `useToast` - Toast notifications

### Components Reused

- `ProcessingQueueView` - Queue card rendering (Upload/Enrichment/Analysis/Complete)
- All shadcn/ui components (`Card`, `Badge`, `Progress`, `Button`, etc.)

### Services Used

- `uploadBom()` from `@/services/bom.service` - File upload
- `parseBOMFile()` from `@/utils/bomParser` - CSV/Excel parsing

## Workflow States

The workflow progresses through these stages:

1. **files_selected** - User selects a BOM file
2. **upload_queue** - File is uploaded to server (raw_upload stage)
3. **processing** - File is parsed and validated (parsing stage)
4. **enrichment_queue** - Components are enriched (enrichment stage)
5. **analysis_queue** - Risk analysis runs (risk_analysis stage)
6. **complete** - All processing complete
7. **summary** - Final results display

## Auto-Scroll Behavior

The stepper auto-scrolls to the active step when:

- Step status changes to `active`
- User navigates to a different step
- Workflow progresses to next stage

Implemented using:

```tsx
useEffect(() => {
  if (autoScroll && activeStepRef.current) {
    activeStepRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }
}, [currentStepId, autoScroll]);
```

## Pause/Resume

Processing can be paused and resumed at any time:

- **Pause**: Calls `/bom/workflow/${bomId}/pause` endpoint
- **Resume**: Calls `/bom/workflow/${bomId}/resume` endpoint
- **Visual indicator**: Step shows as `pending` when paused

## Navigation

Users can navigate back to completed steps to review:

- Clickable when `allowNavigateBack={true}`
- Only `complete` and `active` steps are clickable
- `onClick` handler called with step ID

## Error Handling

Errors are shown:

- In step indicator (red border, X icon)
- In error alert at top of content area
- Via toast notifications
- Step status changes to `error`

## Responsive Design

- **Desktop**: Side-by-side layout (stepper left, content right)
- **Mobile**: Stacked layout (stepper top, content bottom)
- Uses Tailwind's `lg:grid-cols-[280px_1fr]` for responsive grid

## Testing

Example test cases:

```tsx
describe('BomUploadUnified', () => {
  it('shows file selection on mount', () => {
    render(<BomUploadUnified />);
    expect(screen.getByText(/Upload Your BOM/i)).toBeInTheDocument();
  });

  it('progresses to upload queue after file selected', async () => {
    const { user } = render(<BomUploadUnified />);
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });

    const input = screen.getByLabelText(/upload/i);
    await user.upload(input, file);

    expect(screen.getByText(/Upload Queue/i)).toHaveClass('active');
  });

  it('calls onComplete when processing finishes', async () => {
    const onComplete = jest.fn();
    render(<BomUploadUnified onComplete={onComplete} />);

    // ... simulate upload and processing

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith('bom-123');
    });
  });
});
```

## Migration from Old BomUpload.tsx

To migrate from the old horizontal stepper BomUpload.tsx:

1. Replace route:
   ```tsx
   // Old
   <Route path="/boms/upload" element={<BomUploadPage />} />

   // New
   <Route path="/boms/upload" element={<BomUploadUnifiedPage />} />
   ```

2. Update navigation links:
   ```tsx
   // Old
   navigate('/boms/upload');

   // New (same)
   navigate('/boms/upload');
   ```

3. Remove old imports:
   ```tsx
   // Remove these
   import { BomUploadPage } from '@/pages/boms/BomUpload';
   ```

4. Add new imports:
   ```tsx
   import { BomUploadUnified } from '@/components/bom/unified';
   ```

## Future Enhancements

Planned improvements:

- [ ] Drag and drop reordering of queue items
- [ ] Bulk pause/resume for multiple uploads
- [ ] Parallel processing of multiple files
- [ ] Export workflow timeline as PDF
- [ ] Workflow templates (pre-configured enrichment settings)
- [ ] Step-by-step tutorial overlay
- [ ] Keyboard shortcuts for navigation
- [ ] Undo/redo for step navigation

## Related Files

- `../stepper/VerticalStepper.tsx` - Vertical stepper component
- `../stepper/StepIndicator.tsx` - Individual step indicator
- `../ProcessingQueueView.tsx` - Queue card view (reused)
- `../../hooks/useProcessingStatus.ts` - Processing status hook
- `../../hooks/useEnrichmentSSE.ts` - SSE enrichment hook
- `../../pages/boms/BomUploadUnifiedPage.tsx` - Page wrapper

## Support

For issues or questions, see:

- Component storybook stories (when added)
- Integration tests in `__tests__/`
- Original design reference: `C:\Users\siddh\Downloads\Screenshot 2025-12-07...`
