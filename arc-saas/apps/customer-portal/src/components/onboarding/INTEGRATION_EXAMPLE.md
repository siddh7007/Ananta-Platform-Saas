# Onboarding Integration Example

This document shows the exact code changes needed to integrate the onboarding flow.

## 1. Update App.tsx

**File**: `src/App.tsx`

```tsx
// Add import at the top
import { OnboardingProvider, OnboardingOverlay } from '@/components/onboarding';

// Update the App component (around line 254)
function App() {
  const AppContent = (
    <OnboardingProvider>
      <AuthProvider>
        <RefineAppInner />
      </AuthProvider>
      <OnboardingOverlay />
    </OnboardingProvider>
  );

  if (env.features.devtools) {
    return (
      <DevtoolsProvider>
        <ErrorBoundary>
          {AppContent}
          <Toaster />
        </ErrorBoundary>
        <DevtoolsPanel />
      </DevtoolsProvider>
    );
  }

  return (
    <ErrorBoundary>
      {AppContent}
      <Toaster />
    </ErrorBoundary>
  );
}
```

## 2. Update BOM List Page

**File**: `src/pages/boms/BomList.tsx`

Find the "Upload BOM" or "Create BOM" button and add the data attribute:

```tsx
<Button
  data-onboarding="bom-upload-button"  // Add this line
  onClick={() => navigate('/boms/upload')}
>
  <Upload className="h-4 w-4" />
  Upload BOM
</Button>
```

## 3. Update Enrichment Progress Component

**File**: `src/components/bom/EnrichmentProgress.tsx`

Add the data attribute to the root element:

```tsx
export function EnrichmentProgress({ status, progress }: EnrichmentProgressProps) {
  return (
    <div
      data-onboarding="enrichment-status"  // Add this line
      className="rounded-lg border p-4"
    >
      {/* Existing content */}
    </div>
  );
}
```

## 4. Update Global Search Component

**File**: `src/components/shared/GlobalSearch.tsx`

Add the data attribute to the search input:

```tsx
<Input
  data-onboarding="component-search"  // Add this line
  placeholder="Search components..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
/>
```

## 5. Update Component List/Compare View

**File**: `src/pages/components/ComponentList.tsx` or `ComponentCompareView.tsx`

Find the "Compare" button and add the data attribute:

```tsx
<Button
  data-onboarding="compare-button"  // Add this line
  onClick={handleCompare}
  disabled={selectedComponents.length < 2}
>
  Compare Selected ({selectedComponents.length})
</Button>
```

## 6. Update Settings/Preferences Page

**File**: `src/pages/settings/preferences.tsx`

Add the restart tour option:

```tsx
import { useOnboarding } from '@/components/onboarding';

export default function PreferencesPage() {
  const { hasCompletedOnboarding, resetOnboarding, startOnboarding } = useOnboarding();

  return (
    <div className="space-y-8">
      {/* Existing settings sections... */}

      {/* Add this new section */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Onboarding Tour</h3>
          <p className="text-sm text-muted-foreground">
            {hasCompletedOnboarding
              ? 'You have completed the onboarding tour. You can restart it at any time.'
              : 'The onboarding tour helps you get started with CBP features.'}
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => {
            resetOnboarding();
            startOnboarding();
          }}
        >
          {hasCompletedOnboarding ? 'Restart Tour' : 'Start Tour'}
        </Button>
      </section>
    </div>
  );
}
```

## Testing the Integration

### 1. Clear localStorage to simulate first-time user

Open browser DevTools Console and run:
```javascript
localStorage.removeItem('cbp-onboarding-completed');
```

Then refresh the page.

### 2. The onboarding should start automatically after 1 second

You should see:
1. A dark overlay appears
2. "Welcome to CBP" tooltip in the center
3. Progress dots at the bottom
4. Navigation buttons (Next, Skip)

### 3. Click "Next" to progress through steps

Each step will:
- Highlight the target element (if it exists on the page)
- Show a tooltip with description
- Update the progress dots

### 4. Test keyboard navigation

- Press **Right Arrow** or **Enter** → Next step
- Press **Left Arrow** → Previous step
- Press **Escape** → Skip tour

### 5. Complete the tour

On the last step ("You're All Set"), click "Get Started" to complete.

The tour won't show again unless you:
- Clear localStorage
- Click "Restart Tour" in Settings

## Conditional Rendering

If some target elements may not exist on certain pages, the onboarding gracefully handles missing targets by centering the tooltip.

Example: If user is on Dashboard but the step targets BOM Upload button (which is on BOM List page), the tooltip will appear centered with instructions.

## Troubleshooting

### Issue: Onboarding doesn't start

**Solution 1**: Check localStorage
```javascript
console.log(localStorage.getItem('cbp-onboarding-completed'));
// Should be null for new users, 'true' for completed
```

**Solution 2**: Check console for errors
Look for React errors or missing imports.

**Solution 3**: Verify OnboardingProvider wraps the app
Check that App.tsx has the provider and overlay components.

### Issue: Target element not highlighted

**Solution 1**: Check if element exists
```javascript
document.querySelector('[data-onboarding="bom-upload-button"]');
// Should return the element
```

**Solution 2**: Verify attribute name matches
The `data-onboarding` value in the component must match the `targetSelector` in OnboardingProvider steps.

**Solution 3**: Navigate to the correct page
If the target is on a different page, navigate there first or update the step to be page-aware.

### Issue: Tooltip in wrong position

**Solution**: Adjust step configuration
```tsx
{
  id: 'my-step',
  title: 'My Step',
  description: 'Description',
  targetSelector: '[data-onboarding="my-target"]',
  position: 'bottom', // Try: 'top', 'left', 'right', 'center'
  spotlightPadding: 12, // Increase for more spacing
}
```

## Advanced: Conditional Steps Based on Route

You can make steps route-aware by checking the current location:

```tsx
// In OnboardingProvider, pass dynamic steps based on route
import { useLocation } from 'react-router-dom';

function AppWithOnboarding() {
  const location = useLocation();

  const steps = useMemo(() => {
    const allSteps = [...ONBOARDING_STEPS];

    // Filter steps based on current route
    if (!location.pathname.includes('/boms')) {
      return allSteps.filter(step => step.id !== 'upload-bom');
    }

    return allSteps;
  }, [location.pathname]);

  return (
    <OnboardingProvider steps={steps}>
      {/* App content */}
    </OnboardingProvider>
  );
}
```

## Performance Notes

The onboarding overlay:
- Only renders when active (`isActive === true`)
- Uses MutationObserver to track DOM changes (automatically disconnects when inactive)
- Debounces position updates on resize
- Minimal re-renders thanks to React optimization (useMemo, useCallback)

Total bundle impact: ~3KB gzipped
