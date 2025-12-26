# CBP UI Component Analysis - BOM Upload & Related Pages

**Date**: 2025-12-16
**Scope**: Comparison of Old CBP (app-plane/services/customer-portal) vs New CBP (arc-saas/apps/customer-portal)

---

## Executive Summary

Two distinct CBP implementations exist:

| Aspect | Old CBP (MUI + React Admin) | New CBP (shadcn/ui + Refine) |
|--------|----------------------------|------------------------------|
| **Location** | `app-plane/services/customer-portal/` | `arc-saas/apps/customer-portal/` |
| **UI Framework** | Material-UI (MUI) v5 | shadcn/ui (Radix + Tailwind) |
| **Admin Framework** | React Admin | Refine.dev |
| **Component Style** | Class-based MUI sx prop | Tailwind utility classes |
| **Icons** | @mui/icons-material | lucide-react |
| **State Management** | Callbacks + local state | useReducer + Context |
| **File Size (Main)** | ~800 lines | 1,638 lines |

---

## 1. Old CBP Components (MUI-Based)

### 1.1 BOMUploadWorkflow.tsx (Main Orchestrator)
**Path**: `app-plane/services/customer-portal/src/bom/BOMUploadWorkflow.tsx`

**Architecture**:
- Unified single-page flow (no route changes)
- Multi-file queue management
- Feature flags: `USE_BOM_SNAPSHOTS`, `USE_SCOPED_UPLOAD`
- Callback-heavy prop drilling

**Key Patterns**:
```typescript
// Feature flag pattern
const USE_SCOPED_UPLOAD = true; // Toggle for project-scoped upload

// Callback-driven architecture
onFilesAdded, onMappingChange, onConfirmMappings, onStartEnrichment, onRetry, onSkip, onViewDetails, onRemove
```

---

### 1.2 BOMDropzone.tsx (File Upload)
**Path**: `app-plane/services/customer-portal/src/bom/intake/BOMDropzone.tsx`

**MUI Patterns**:
```typescript
// Border color based on state
sx={{
  borderColor: filesInQueue > 0
    ? 'success.main'
    : isDragActive
      ? 'primary.main'
      : 'divider',
  backgroundColor: filesInQueue > 0
    ? 'success.50'
    : isDragActive
      ? 'action.hover'
      : 'background.paper',
}}
```

**Features**:
- `react-dropzone` library integration
- Status-driven UI (empty → files selected → processing)
- Color transitions on drag activity
- 2px dashed border styling

**Props Interface**:
```typescript
interface BOMDropzoneProps {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
  filesInQueue?: number;
  totalRows?: number;
}
```

---

### 1.3 MobileBOMDropzone.tsx (Touch-Optimized)
**Path**: `app-plane/services/customer-portal/src/components/mobile/MobileBOMDropzone.tsx`

**Mobile-Specific Features**:
- 64px minimum touch targets
- Dialog-based file picker (not drag-drop on mobile)
- Camera capture option (future OCR)
- File size validation (50MB limit)
- `useMediaQuery` for breakpoint detection

---

### 1.4 BOMQueueItem.tsx (Queue Card)
**Path**: `app-plane/services/customer-portal/src/bom/intake/BOMQueueItem.tsx`

**Status Lifecycle**:
```
pending → parsing → uploading → mapping → confirming → saving → completed
                                                              → error
```

**Features**:
- Download original file (local or S3)
- Remove from queue (pending only)
- Linear progress bar
- Inline BOMColumnMapper
- Success state with enrichment prompts
- Error display with retry button

---

### 1.5 BOMColumnMapper.tsx (Column Mapping)
**Path**: `app-plane/services/customer-portal/src/bom/intake/BOMColumnMapper.tsx`

**Target Fields**:
```typescript
const TARGET_FIELDS = [
  'ignore',
  'manufacturer_part_number',  // Required
  'manufacturer',
  'quantity',
  'reference_designator',
  'description'
];
```

**Validation**:
- MPN field required
- Duplicate mapping detection
- Validation alerts

**UI Pattern**:
- Table: File Column | Sample Data | Maps To | Status
- Dropdown selector for target
- Success icon on complete

---

### 1.6 SmartColumnMapper.tsx (Modern Version)
**Path**: `app-plane/services/customer-portal/src/components/bom/SmartColumnMapper.tsx`

**Framework**: Radix UI + Tailwind (hybrid)

**Features**:
- AI-powered auto-detection
- Confidence badges (90%+ → "Accept All")
- Template support for saving/reusing
- Alternative suggestions per column

**UI Components**:
- `grid grid-cols-12 gap-4`
- Radix `Select` component
- Lucide icons (ChevronDown, Check, X, Sparkles)
- Custom ConfidenceBadge
- AIReasoningTooltip

---

### 1.7 EnrichmentProgressBar.tsx
**Path**: `app-plane/services/customer-portal/src/components/bom/enrichment/EnrichmentProgressBar.tsx`

**Stats Display**:
- Total items (Pending)
- Enriched items (✓)
- Failed/not found (✗)
- Success rate percentage

**Color Coding**:
```typescript
const successRate = enriched / total;
const color = successRate > 0.9 ? 'green'
            : successRate > 0.7 ? 'orange'
            : 'red';
```

---

### 1.8 EnrichmentQueueItem.tsx
**Path**: `app-plane/services/customer-portal/src/bom/intake/EnrichmentQueueItem.tsx`

**Status Icons**:
| Status | Icon | Color |
|--------|------|-------|
| pending | Hourglass | gray |
| enriching | CircularProgress | blue |
| enriched | CheckCircle | green |
| failed | Error | red |
| not_found | SearchOff | orange |

---

### 1.9 BOMWorkflowStepper.tsx
**Path**: `app-plane/services/customer-portal/src/bom/intake/BOMWorkflowStepper.tsx`

**7-Step Workflow**:
1. Select Files
2. Upload & Parse
3. Map Columns
4. Save BOM
5. Enrich Components
6. Risk Analysis
7. Complete

---

### 1.10 AnalysisQueueCard.tsx
**Path**: `app-plane/services/customer-portal/src/bom/intake/AnalysisQueueCard.tsx`

**Risk Analysis Display**:
- High-risk components (top 5, risk_score >= 60)
- Alerts by severity (critical → high → low)
- Fetches from Supabase tables

---

## 2. New CBP Components (shadcn/ui-Based)

### 2.1 BomUpload.tsx (Main Component)
**Path**: `arc-saas/apps/customer-portal/src/pages/boms/BomUpload.tsx`

**Size**: 1,638 lines (monolithic)

**State Management**:
```typescript
// useReducer with 16 state fields
type Action =
  | { type: 'SET_STEP'; step: BomUploadStep }
  | { type: 'SET_FILE'; file: File; preview: BomFilePreview; mapping: BomColumnMapping; name: string }
  | { type: 'SET_MAPPING'; mapping: BomColumnMapping }
  // ... 9 more action types
  | { type: 'RESTORE'; state: PersistedBomUploadState; preview: BomFilePreview | null }
  | { type: 'RESET' };
```

**10-Step Flow**:
1. `select_file` - Dropzone with restore prompt
2. `preview_data` - First 10 rows table
3. `map_columns` - Template selector + dropdowns
4. `configure_options` - Name, description, enrichment
5. `review_summary` - Summary with project banner
6. `uploading` - Progress bar (0-100%)
7. `processing` - Animated analysis steps
8. `enriching` - Queue card with SSE
9. `results` - Success metrics, health grade
10. `complete` - Final confirmation

**Inline Render Functions** (10 total, ~909 lines):
- `renderSelectFile()` - 59 lines
- `renderPreviewData()` - 83 lines
- `renderMapColumns()` - 119 lines
- `renderConfigureOptions()` - 127 lines
- `renderReviewSummary()` - 105 lines
- `renderUploading()` - 16 lines
- `renderProcessing()` - 25 lines
- `renderEnriching()` - 190 lines
- `renderResults()` - 130 lines
- `renderStepIndicator()` - 55 lines

---

### 2.2 ProcessingQueueView.tsx
**Path**: `arc-saas/apps/customer-portal/src/components/bom/ProcessingQueueView.tsx`

**Size**: 351 lines

**5-Stage Pipeline Visualization**:
```
RAW_UPLOAD → PARSING → ENRICHMENT → RISK_ANALYSIS → COMPLETE
```

**Features**:
- Stage cards with icon, badge, progress
- Connection lines between stages
- SSE integration
- Current item display (MPN)
- Connection status indicator

**Styling**:
```typescript
// Stage-specific colors
const stageColors = {
  raw_upload: 'blue',
  parsing: 'purple',
  enrichment: 'amber',
  risk_analysis: 'orange',
  complete: 'green'
};
```

---

### 2.3 EnrichmentProgress.tsx
**Path**: `arc-saas/apps/customer-portal/src/components/bom/EnrichmentProgress.tsx`

**Size**: 136 lines

**Dual Mode**:
- Static: From BOM status
- SSE: Real-time updates

**ARIA Support**:
```tsx
<div aria-live="polite" role="status">
  {/* Progress announcements */}
</div>
```

---

### 2.4 QueueCard.tsx
**Path**: `arc-saas/apps/customer-portal/src/components/bom/QueueCard.tsx`

**Size**: 212 lines

**Status Types** (9):
```typescript
type BomStatus =
  | 'pending'
  | 'uploading'
  | 'processing'
  | 'enriching'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'cancelled'
  | 'partial';
```

---

### 2.5 Template Management Components

**ColumnMappingTemplateSelector.tsx** (186 lines):
- Dropdown with default marker
- Last used timestamp
- Field count display

**SaveTemplateDialog.tsx** (171 lines):
- Auto-generated name + timestamp
- Mapping preview
- "Set as default" checkbox

**ManageTemplatesDialog.tsx** (288 lines):
- ScrollArea for long lists
- Inline editing (Enter/Escape)
- Set default, Rename, Delete
- Confirmation dialogs

---

### 2.6 Custom Hooks

**useEnrichmentSSE.ts** (302 lines):
- EventSource SSE connection
- Polling fallback (5s interval)
- Connection status tracking
- Auto-reconnect
- Keepalive handling

**useProcessingStatus.ts** (419 lines):
- Temporal workflow status
- Pause/Resume/Cancel actions
- Stage progress tracking
- Error handling

**useBomUploadPersistence.ts** (274 lines):
- sessionStorage sync
- 30-minute expiry
- Preview data separate storage
- Debounced save (500ms)

---

## 3. Component Comparison Matrix

### 3.1 File Upload Components

| Feature | Old CBP (MUI) | New CBP (shadcn) |
|---------|---------------|------------------|
| Drag-drop | react-dropzone | react-dropzone |
| Mobile support | MobileBOMDropzone | Not implemented |
| Touch targets | 64px | Standard |
| File queue | Visual list | Badge count |
| Progress | Linear bar | Linear bar |
| Styling | MUI sx prop | Tailwind cn() |

---

### 3.2 Column Mapping Components

| Feature | Old CBP | New CBP |
|---------|---------|---------|
| Auto-detection | SmartColumnMapper | bomParser.ts |
| Confidence badge | Yes | No |
| AI reasoning | AIReasoningTooltip | No |
| Templates | Yes | Yes |
| Alternative suggestions | Yes | No |
| Preview rows | 3 samples | 5 rows |

---

### 3.3 Progress Components

| Feature | Old CBP | New CBP |
|---------|---------|---------|
| Enrichment display | EnrichmentQueueItem | ProcessingQueueView |
| Stage pipeline | 7 steps | 5 stages |
| Real-time | Polling | SSE + fallback |
| Pause/Resume | No | Yes (Temporal) |
| Risk analysis | AnalysisQueueCard | Inline in results |

---

### 3.4 State Management

| Aspect | Old CBP | New CBP |
|--------|---------|---------|
| Pattern | Callbacks | useReducer |
| Persistence | None | sessionStorage |
| Recovery | None | Restore prompt |
| Actions | 15+ callbacks | 12 action types |

---

## 4. Reusable Patterns to Port

### From Old CBP → New CBP:

1. **MobileBOMDropzone Pattern**
   - 64px touch targets
   - Dialog-based picker on mobile
   - File size validation

2. **SmartColumnMapper Features**
   - Confidence badges
   - AI reasoning tooltips
   - Alternative suggestions

3. **AnalysisQueueCard**
   - High-risk component highlighting
   - Alert severity grouping

4. **Status Utilities**
   - `getStatusColor()`, `getStatusIcon()`, `getStatusText()`
   - Centralized status management

5. **Theme Configuration**
   - `workflowStatusColors`
   - `riskColors`
   - `qualityColors`

---

## 5. Architecture Recommendations

### 5.1 Component Extraction (New CBP)

Extract from BomUpload.tsx (1,638 lines → ~800 lines):

```
src/pages/boms/steps/
├── FileUploadStep.tsx       (~60 lines)
├── DataPreviewStep.tsx      (~80 lines)
├── ColumnMappingStep.tsx    (~120 lines)
├── OptionsConfigStep.tsx    (~130 lines)
├── ReviewSummaryStep.tsx    (~100 lines)
├── ProcessingStep.tsx       (~200 lines)
└── ResultsStep.tsx          (~130 lines)
```

---

### 5.2 Port from Old CBP

```
src/components/bom/
├── ConfidenceBadge.tsx        # From SmartColumnMapper
├── AIReasoningTooltip.tsx     # From SmartColumnMapper
├── RiskAnalysisCard.tsx       # From AnalysisQueueCard
├── MobileDropzone.tsx         # From MobileBOMDropzone
└── StatusUtilities.ts         # From BOMUploadStatus
```

---

### 5.3 Shared UI Components

Create shared component library:

```
src/components/shared/
├── StepIndicator.tsx          # Wizard progress
├── ProcessingChecklist.tsx    # Animated checklist
├── ProgressCard.tsx           # Generic progress card
├── StatusBadge.tsx            # Unified status display
└── FileDropzone.tsx           # Unified dropzone
```

---

## 6. Theme Alignment

### Current New CBP Theme Colors:

```css
/* Tailwind utilities */
--primary: hsl(222.2 47.4% 11.2%);
--success: hsl(142 76% 36%);       /* green-600 */
--warning: hsl(38 92% 50%);        /* amber-500 */
--destructive: hsl(0 84% 60%);     /* red-500 */
```

### Status Color Mapping:

```typescript
export const statusColors = {
  pending: 'text-gray-500 bg-gray-100',
  uploading: 'text-blue-600 bg-blue-100',
  processing: 'text-purple-600 bg-purple-100',
  enriching: 'text-amber-600 bg-amber-100',
  completed: 'text-green-600 bg-green-100',
  failed: 'text-red-600 bg-red-100',
  paused: 'text-yellow-600 bg-yellow-100',
};
```

---

## 7. Migration Path

### Phase 1: Extract Steps (Week 1)
- Create step components from inline render functions
- Keep state in parent, pass as props

### Phase 2: Port Features (Week 2)
- Add confidence badges from old CBP
- Implement mobile dropzone
- Add risk analysis card

### Phase 3: Unify Patterns (Week 3)
- Create shared component library
- Align status management
- Standardize theme colors

### Phase 4: Polish (Week 4)
- Add accessibility improvements
- Implement code splitting
- Performance optimization

---

## Appendix: File Reference

### Old CBP (MUI) Files:
```
app-plane/services/customer-portal/src/
├── bom/
│   ├── BOMUploadWorkflow.tsx
│   ├── intake/
│   │   ├── BOMDropzone.tsx
│   │   ├── BOMQueueItem.tsx
│   │   ├── BOMColumnMapper.tsx
│   │   ├── BOMWorkflowStepper.tsx
│   │   ├── BOMUploadStatus.tsx
│   │   ├── BOMUploadComplete.tsx
│   │   ├── EnrichmentQueueItem.tsx
│   │   ├── EnrichmentQueueSection.tsx
│   │   └── AnalysisQueueCard.tsx
│   └── Old/ (deprecated)
├── components/
│   ├── bom/
│   │   ├── SmartColumnMapper.tsx
│   │   ├── MappingRow.tsx
│   │   ├── ConfidenceBadge.tsx
│   │   └── enrichment/EnrichmentProgressBar.tsx
│   └── mobile/MobileBOMDropzone.tsx
└── theme/index.ts
```

### New CBP (shadcn) Files:
```
arc-saas/apps/customer-portal/src/
├── pages/boms/
│   ├── BomUpload.tsx (1,638 lines)
│   └── BomList.tsx (465 lines)
├── components/bom/
│   ├── ProcessingQueueView.tsx (351 lines)
│   ├── EnrichmentProgress.tsx (136 lines)
│   ├── QueueCard.tsx (212 lines)
│   ├── ColumnMappingTemplateSelector.tsx (186 lines)
│   ├── SaveTemplateDialog.tsx (171 lines)
│   └── ManageTemplatesDialog.tsx (288 lines)
├── hooks/
│   ├── useEnrichmentSSE.ts (302 lines)
│   ├── useProcessingStatus.ts (419 lines)
│   └── useBomUploadPersistence.ts (274 lines)
└── types/bom.ts (336 lines)
```

---

**Document Version**: 1.0
**Last Updated**: 2025-12-16
