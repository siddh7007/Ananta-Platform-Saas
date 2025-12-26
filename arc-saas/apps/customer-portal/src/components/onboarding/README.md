# Onboarding Components

First-time user onboarding flow for the CBP customer portal (electronics BOM management tool).

## Features

- **Auto-start for new users**: Automatically starts after 1 second delay for first-time users
- **Spotlight effect**: Highlights target elements with customizable padding
- **Intelligent positioning**: Tooltip positions itself to avoid viewport edges
- **Progress indicator**: Shows current step with animated dots
- **Keyboard navigation**: Arrow keys, Enter, and Escape support
- **Accessibility**: ARIA labels, focus management, screen reader support
- **Reduced motion**: Respects `prefers-reduced-motion` setting
- **Persistent state**: Uses localStorage to track completion
- **Customizable**: Can be restarted from settings, custom steps supported

## Installation

All files are already created in `src/components/onboarding/`:

- `OnboardingProvider.tsx` - Context provider for state management
- `OnboardingOverlay.tsx` - UI component with spotlight and tooltip
- `index.ts` - Barrel export

## Integration

### 1. Wrap App with OnboardingProvider

Update `src/App.tsx`:

```tsx
import { OnboardingProvider, OnboardingOverlay } from '@/components/onboarding';

function App() {
  return (
    <OnboardingProvider>
      <AuthProvider>
        <RefineAppInner />
      </AuthProvider>
      <OnboardingOverlay />
    </OnboardingProvider>
  );
}
```

### 2. Add Data Attributes to Target Elements

Add `data-onboarding` attributes to elements you want to highlight:

**BOM Upload Button** (`src/pages/boms/BomList.tsx`):
```tsx
<Button data-onboarding="bom-upload-button" onClick={handleUpload}>
  Upload BOM
</Button>
```

**Enrichment Status** (`src/components/bom/EnrichmentProgress.tsx`):
```tsx
<div data-onboarding="enrichment-status" className="...">
  {/* Enrichment status display */}
</div>
```

**Component Search** (`src/components/shared/GlobalSearch.tsx` or search page):
```tsx
<Input
  data-onboarding="component-search"
  placeholder="Search components..."
/>
```

**Compare Button** (`src/pages/components/ComponentList.tsx`):
```tsx
<Button data-onboarding="compare-button" onClick={handleCompare}>
  Compare Selected
</Button>
```

### 3. Add Reset Option in Settings

Update `src/pages/settings/preferences.tsx`:

```tsx
import { useOnboarding } from '@/components/onboarding';

export function PreferencesPage() {
  const { hasCompletedOnboarding, resetOnboarding, startOnboarding } = useOnboarding();

  return (
    <div className="space-y-6">
      {/* Other settings... */}

      <div className="space-y-2">
        <h3 className="text-lg font-medium">Onboarding Tour</h3>
        <p className="text-sm text-muted-foreground">
          {hasCompletedOnboarding
            ? 'You have completed the onboarding tour.'
            : 'The onboarding tour helps you get started with CBP.'}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            resetOnboarding();
            startOnboarding();
          }}
        >
          {hasCompletedOnboarding ? 'Restart Tour' : 'Start Tour'}
        </Button>
      </div>
    </div>
  );
}
```

## Usage

### Basic Usage

The onboarding flow starts automatically for new users. No additional code required.

### Programmatic Control

```tsx
import { useOnboarding } from '@/components/onboarding';

function MyComponent() {
  const {
    isActive,
    currentStep,
    startOnboarding,
    stopOnboarding,
    skipOnboarding,
    completeOnboarding,
    resetOnboarding,
    hasCompletedOnboarding,
  } = useOnboarding();

  return (
    <div>
      <button onClick={startOnboarding}>Start Tour</button>
      <button onClick={resetOnboarding}>Reset Tour</button>
      {hasCompletedOnboarding && <p>You've completed the tour!</p>}
    </div>
  );
}
```

### Custom Steps

You can provide custom steps to the OnboardingProvider:

```tsx
import { OnboardingProvider, OnboardingStep } from '@/components/onboarding';

const customSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Welcome to our app!',
    position: 'center',
  },
  {
    id: 'feature1',
    title: 'Feature 1',
    description: 'This is feature 1',
    targetSelector: '[data-onboarding="feature1"]',
    position: 'bottom',
    spotlightPadding: 12,
  },
];

<OnboardingProvider steps={customSteps}>
  <App />
</OnboardingProvider>
```

## Default Onboarding Steps

1. **Welcome to CBP** - Center modal introduction
2. **Upload Your First BOM** - Highlights upload button
3. **Automatic Enrichment** - Shows enrichment status
4. **Component Search** - Demonstrates search functionality
5. **Compare Components** - Explains comparison feature
6. **You're All Set** - Completion message

## Keyboard Navigation

- **Arrow Right / Enter**: Next step
- **Arrow Left**: Previous step
- **Escape**: Skip onboarding

## Accessibility

- ARIA labels and descriptions
- Keyboard navigation support
- Focus management (tooltip receives focus)
- Screen reader announcements
- Respects `prefers-reduced-motion`

## localStorage Key

Completion state is stored in: `cbp-onboarding-completed`

To manually clear: `localStorage.removeItem('cbp-onboarding-completed')`

## Styling

The component uses Tailwind CSS and shadcn/ui components. It automatically adapts to your theme (light/dark mode).

## Testing

```tsx
import { render, screen } from '@testing-library/react';
import { OnboardingProvider } from '@/components/onboarding';

test('onboarding starts automatically for new users', () => {
  localStorage.removeItem('cbp-onboarding-completed');

  render(
    <OnboardingProvider autoStartDelay={0}>
      <div>App content</div>
    </OnboardingProvider>
  );

  // Wait for onboarding to start
  expect(screen.getByText('Welcome to CBP')).toBeInTheDocument();
});
```

## Troubleshooting

### Onboarding doesn't start
- Check localStorage: `localStorage.getItem('cbp-onboarding-completed')`
- Clear it: `localStorage.removeItem('cbp-onboarding-completed')`
- Refresh the page

### Target element not highlighted
- Verify the element has the correct `data-onboarding` attribute
- Check if the element is rendered when the step appears
- Ensure the selector matches: `[data-onboarding="your-target"]`

### Tooltip appears in wrong position
- Increase `spotlightPadding` in step definition
- Change `position` prop ('top', 'bottom', 'left', 'right', 'center')
- Ensure target element is visible in viewport

## Future Enhancements

Potential improvements for future iterations:

- [ ] Analytics tracking for step completion
- [ ] Video tutorials in tooltips
- [ ] Branch paths based on user role
- [ ] Interactive challenges (e.g., "Upload a BOM to continue")
- [ ] Celebrate completion with confetti animation
- [ ] Multi-step tooltips with carousel
- [ ] Contextual help mode (always available, not just onboarding)
