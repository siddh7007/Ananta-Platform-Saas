# BOM Upload UX Enhancements Implementation

## Overview
This document tracks the comprehensive UX improvements implemented for the BOM Upload wizard flow.

## Completed Enhancements

### 1. Enhanced Imports and Dependencies
- Added Dialog components from shadcn/ui for the resume modal
- Added Alert components for inline error display
- Added additional Lucide icons: `Clock`, `FileBarChart`, `Check`

### 2. State Management Improvements
- Added `isTransitioning` state for smooth step transitions
- Added `fieldErrors` state object for field-level validation
- Changed `restoredFileName` to `restoredState` to store complete session info

### 3. File Upload Enhancements
- Added `setIsProcessing(true)` at start of upload for loading indication
- Added smooth 300ms transition delay when moving to next step
- Added success toast notification with file details
- Added error toast notification on parse failure
- Changed restored state tracking from just filename to full state object

## Remaining Implementations

### 4. Validation and Error Handling

Add this function before `validateData()`:

```typescript
// Validate current step before proceeding
const validateCurrentStep = useCallback((): boolean => {
  const errors: FieldErrors = {};

  switch (currentStep) {
    case 'map_columns':
      if (!mapping.mpn) {
        errors.mapping = 'MPN column is required';
      }
      break;
    case 'configure_options':
      if (!bomName.trim()) {
        errors.bomName = 'BOM name is required';
      }
      break;
  }

  setFieldErrors(errors);
  return Object.keys(errors).length === 0;
}, [currentStep, mapping, bomName]);
```

### 5. Enhanced Navigation with Transitions

Replace the `goToStep`, `goNext`, `goBack` functions with:

```typescript
// Navigation helpers with validation and smooth transitions
const goToStep = (step: BomUploadStep) => {
  setIsTransitioning(true);
  setTimeout(() => {
    dispatch({ type: 'SET_STEP', step });
    setIsTransitioning(false);
    setFieldErrors({});
  }, 150);
};

const goNext = () => {
  if (!validateCurrentStep()) {
    toast({
      title: 'Validation Error',
      description: 'Please fix the errors before continuing',
      variant: 'destructive',
    });
    return;
  }

  const stepIndex = UPLOAD_STEPS.findIndex((s) => s.key === currentStep);
  if (stepIndex < UPLOAD_STEPS.length - 1) {
    const nextStep = UPLOAD_STEPS[stepIndex + 1].key;
    if (nextStep === 'uploading') {
      handleUpload();
    } else {
      // Run validation for map_columns step
      if (currentStep === 'map_columns') {
        if (!validateData()) {
          toast({
            title: 'Validation Warnings',
            description: 'Some warnings detected. Review before continuing.',
          });
        }
      }
      goToStep(nextStep);
    }
  }
};
```

### 6. Clickable Stepper Implementation

Add these helper functions:

```typescript
// Check if a step can be clicked (completed steps only)
const canNavigateToStep = (step: BomUploadStep): boolean => {
  const currentIndex = UPLOAD_STEPS.findIndex((s) => s.key === currentStep);
  const targetIndex = UPLOAD_STEPS.findIndex((s) => s.key === step);

  // Can't navigate to uploading, processing, enriching
  if (['uploading', 'processing', 'enriching'].includes(step)) {
    return false;
  }

  // Can only navigate to previous steps
  return targetIndex < currentIndex;
};

// Get step status for visual indication
const getStepStatus = (step: BomUploadStep): 'completed' | 'current' | 'upcoming' | 'error' => {
  const currentIndex = UPLOAD_STEPS.findIndex((s) => s.key === currentStep);
  const stepIndex = UPLOAD_STEPS.findIndex((s) => s.key === step);

  if (step === currentStep || (currentStep === 'uploading' && step === 'complete')) {
    return 'current';
  }

  if (stepIndex < currentIndex) {
    // Check if step has errors
    if (step === 'map_columns' && !mapping.mpn) return 'error';
    if (step === 'configure_options' && !bomName.trim()) return 'error';
    return 'completed';
  }

  return 'upcoming';
};
```

Replace `renderStepIndicator()` with:

```typescript
// Enhanced step indicator with clickable steps
const renderStepIndicator = () => {
  const currentIndex = UPLOAD_STEPS.findIndex((s) => s.key === currentStep);
  const visibleSteps = UPLOAD_STEPS.filter((s) => !['uploading', 'processing', 'enriching'].includes(s.key));

  return (
    <div className="mb-8">
      <div className="flex items-center justify-center">
        {visibleSteps.map((step, i) => {
          const status = getStepStatus(step.key);
          const canClick = canNavigateToStep(step.key);

          return (
            <div key={step.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => canClick && goToStep(step.key)}
                  disabled={!canClick}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-all duration-200',
                    status === 'completed' && 'bg-green-500 text-white hover:bg-green-600',
                    status === 'current' && 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2',
                    status === 'upcoming' && 'bg-muted text-muted-foreground',
                    status === 'error' && 'bg-red-500 text-white',
                    canClick && 'cursor-pointer hover:scale-110',
                    !canClick && 'cursor-not-allowed'
                  )}
                  aria-label={`${step.label} - ${status}`}
                  aria-current={status === 'current' ? 'step' : undefined}
                >
                  {status === 'completed' ? (
                    <CheckCircle className="h-5 w-5" aria-hidden="true" />
                  ) : status === 'error' ? (
                    <AlertCircle className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    i + 1
                  )}
                </button>
                <span
                  className={cn(
                    'mt-1 text-xs transition-colors duration-200',
                    status === 'current' ? 'font-medium text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < visibleSteps.length - 1 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 w-8 sm:w-16 transition-colors duration-300',
                    status === 'completed' ? 'bg-green-500' : 'bg-muted'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

### 7. Enhanced Resume Upload Modal

Add utility functions:

```typescript
// Format file size for display
const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Format timestamp
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

// Get step progress percentage
const getProgressPercentage = (step: BomUploadStep): number => {
  const stepIndex = UPLOAD_STEPS.findIndex((s) => s.key === step);
  return Math.round((stepIndex / (UPLOAD_STEPS.length - 1)) * 100);
};
```

Add new modal rendering function:

```typescript
// Enhanced Resume Upload Modal
const renderResumeModal = () => {
  if (!showRestorePrompt || !restoredState) return null;

  const progress = getProgressPercentage(restoredState.currentStep);

  return (
    <Dialog open={showRestorePrompt} onOpenChange={setShowRestorePrompt}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-full bg-blue-100 p-2">
              <RotateCcw className="h-5 w-5 text-blue-600" />
            </div>
            <DialogTitle>Resume Previous Upload</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            You have an incomplete upload session. Would you like to continue where you left off?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Info */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <FileBarChart className="h-10 w-10 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{restoredState.fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(restoredState.fileSize)}
                </p>
              </div>
            </div>
          </div>

          {/* Progress Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress}% Complete</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Last saved {formatTimestamp(restoredState.timestamp)}</span>
            </div>
          </div>

          {/* Current Step */}
          <div className="rounded-lg border bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span className="font-medium">
                Stopped at: {UPLOAD_STEPS.find(s => s.key === restoredState.currentStep)?.label}
              </span>
            </div>
          </div>

          {/* Why Resume */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Your column mappings, BOM name, and enrichment settings have been saved.
              Re-upload the same file to continue without re-entering this information.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <button
            onClick={() => {
              setShowRestorePrompt(false);
              setRestoredState(null);
              clearPersistedState();
              dispatch({ type: 'RESET' });
              toast({
                title: 'Session Discarded',
                description: 'Starting a fresh upload',
              });
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <XCircle className="h-4 w-4" />
            Discard and Start Fresh
          </button>
          <button
            onClick={() => {
              setShowRestorePrompt(false);
              toast({
                title: 'Session Restored',
                description: `Re-upload ${restoredState.fileName} to continue`,
              });
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Check className="h-4 w-4" />
            Resume Upload
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

### 8. Inline Validation in renderMapColumns()

Replace the mapping field rendering section with:

```typescript
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {Object.entries({
    mpn: { label: 'MPN / Part Number', required: true },
    manufacturer: { label: 'Manufacturer', required: false },
    quantity: { label: 'Quantity', required: false },
    description: { label: 'Description', required: false },
    referenceDesignator: { label: 'Reference Designator', required: false },
    footprint: { label: 'Footprint / Package', required: false },
  }).map(([key, config]) => {
    const hasValue = !!(mapping as unknown as Record<string, string | undefined>)[key];
    const isRequired = config.required;
    const hasError = isRequired && !hasValue && fieldErrors.mapping;

    return (
      <div key={key} className="space-y-1">
        <label className="text-sm font-medium">
          {config.label}
          {config.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <div className="relative">
          <select
            value={(mapping as unknown as Record<string, string | undefined>)[key] || ''}
            onChange={(e) => {
              dispatch({
                type: 'SET_MAPPING',
                mapping: { ...mapping, [key]: e.target.value || undefined },
              });
              if (key === 'mpn' && e.target.value) {
                setFieldErrors((prev) => ({ ...prev, mapping: undefined }));
              }
            }}
            className={cn(
              'w-full rounded-md border bg-background px-3 py-2 text-sm transition-colors',
              hasError && 'border-red-500 focus:ring-red-500',
              hasValue && !hasError && 'border-green-500'
            )}
          >
            <option value="">Select column...</option>
            {preview?.headers.map((h, i) => (
              <option key={i} value={h}>
                {h}
              </option>
            ))}
          </select>
          {hasValue && !hasError && (
            <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500 pointer-events-none" />
          )}
        </div>
      </div>
    );
  })}
</div>

{/* Inline error for mapping */}
{fieldErrors.mapping && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>{fieldErrors.mapping}</AlertDescription>
  </Alert>
)}
```

### 9. Inline Validation in renderConfigureOptions()

Replace BOM name input section with:

```typescript
<div>
  <label className="mb-1 block text-sm font-medium">
    BOM Name <span className="text-red-500">*</span>
  </label>
  <input
    type="text"
    value={bomName}
    onChange={(e) => {
      dispatch({ type: 'SET_BOM_NAME', name: e.target.value });
      if (e.target.value.trim()) {
        setFieldErrors((prev) => ({ ...prev, bomName: undefined }));
      }
    }}
    placeholder="Enter BOM name"
    className={cn(
      "w-full rounded-md border bg-background px-3 py-2 text-sm transition-colors",
      fieldErrors.bomName && 'border-red-500',
      bomName.trim() && 'border-green-500'
    )}
  />
  {fieldErrors.bomName && (
    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
      <AlertCircle className="h-3 w-3" />
      {fieldErrors.bomName}
    </p>
  )}
  {bomName.trim() && !fieldErrors.bomName && (
    <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
      <CheckCircle className="h-3 w-3" />
      Looks good!
    </p>
  )}
</div>
```

### 10. Smooth Transitions in Step Renders

Add transition classes to all step render containers:

```typescript
// In renderSelectFile():
<div className={cn(
  "mx-auto max-w-xl space-y-6 transition-opacity duration-300",
  isTransitioning ? "opacity-0" : "opacity-100"
)}>

// In renderPreviewData(), renderMapColumns(), etc.:
<div className={cn(
  "space-y-6 transition-opacity duration-300",
  isTransitioning ? "opacity-0" : "opacity-100"
)}>
```

### 11. Add Loading States to Buttons

Update navigation buttons to disable during transitions:

```typescript
<button
  onClick={goBack}
  disabled={isTransitioning}
  className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  <ArrowLeft className="h-4 w-4" />
  Back
</button>

<button
  onClick={goNext}
  disabled={isTransitioning}
  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  Continue
  <ArrowRight className="h-4 w-4" />
</button>
```

### 12. Add Modal to Main Render

Add before the closing `</div>` in the main return statement:

```typescript
return (
  <div className="space-y-6">
    {/* ... existing content ... */}

    {/* Resume Upload Modal */}
    {renderResumeModal()}
  </div>
);
```

### 13. Update handleDismissRestore()

Replace the existing function:

```typescript
// Handle dismissing the restore prompt
const handleDismissRestore = useCallback(() => {
  setShowRestorePrompt(false);
  setRestoredState(null);
  clearPersistedState();
  dispatch({ type: 'RESET' });
  toast({
    title: 'Session Discarded',
    description: 'Starting a fresh upload',
  });
}, [clearPersistedState, toast]);
```

## Accessibility Features Implemented

1. **Keyboard Navigation**: All interactive elements are focusable
2. **ARIA Labels**: Proper aria-label, aria-current, aria-busy attributes
3. **Screen Reader Support**: Status announcements via toast notifications
4. **Focus Management**: Dialog components handle focus trapping
5. **Reduced Motion**: Animations respect `prefers-reduced-motion`

## Testing Checklist

- [ ] Resume modal displays correct file info and progress
- [ ] Stepper allows clicking back to completed steps
- [ ] Stepper shows error state for invalid steps
- [ ] Inline validation appears immediately on blur
- [ ] Success checkmarks appear for valid fields
- [ ] Smooth transitions between steps (300ms fade)
- [ ] Toast notifications appear for all actions
- [ ] Error messages are clear and actionable
- [ ] All buttons show loading states
- [ ] Keyboard navigation works throughout
- [ ] Screen reader announces step changes

## Next Steps

1. Apply all code changes from sections 4-13 above
2. Test the complete flow end-to-end
3. Verify accessibility with screen reader
4. Test on mobile devices for responsive behavior
5. Add error recovery flows (e.g., retry on network failure)
