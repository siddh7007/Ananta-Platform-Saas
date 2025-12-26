# Quick Start Guide - Onboarding Flow

Get the onboarding flow running in 5 minutes.

## Step 1: Import Components (30 seconds)

In `src/App.tsx`, add these imports:

```tsx
import { OnboardingProvider, OnboardingOverlay } from '@/components/onboarding';
```

## Step 2: Wrap App (1 minute)

Find the `App()` function and wrap with `OnboardingProvider`:

```tsx
function App() {
  const AppContent = (
    <OnboardingProvider>  {/* Add this */}
      <AuthProvider>
        <RefineAppInner />
      </AuthProvider>
      <OnboardingOverlay />  {/* Add this */}
    </OnboardingProvider>  {/* Add this */}
  );

  // Rest of the function...
}
```

## Step 3: Add Data Attributes (3 minutes)

Add these attributes to your components:

### BOM Upload Button
**File**: `src/pages/boms/BomList.tsx`
```tsx
<Button data-onboarding="bom-upload-button">
  Upload BOM
</Button>
```

### Enrichment Status
**File**: `src/components/bom/EnrichmentProgress.tsx`
```tsx
<div data-onboarding="enrichment-status">
  {/* Enrichment UI */}
</div>
```

### Component Search
**File**: `src/components/shared/GlobalSearch.tsx`
```tsx
<Input data-onboarding="component-search" placeholder="Search..." />
```

### Compare Button
**File**: `src/pages/components/ComponentList.tsx`
```tsx
<Button data-onboarding="compare-button">
  Compare Components
</Button>
```

## Step 4: Test It (30 seconds)

1. Clear localStorage:
```javascript
localStorage.removeItem('cbp-onboarding-completed');
```

2. Refresh page

3. Onboarding starts after 1 second!

## That's It!

You should now see:
- Dark overlay appears
- "Welcome to CBP" tooltip in center
- Progress dots showing 6 steps
- Next/Skip buttons

## Navigation

- **Next**: Click button or press Right Arrow/Enter
- **Previous**: Click Back or press Left Arrow
- **Skip**: Click "Skip tour" or press Escape
- **Complete**: Click "Get Started" on final step

## Restart Tour

In Settings page, add:

```tsx
import { useOnboarding } from '@/components/onboarding';

const { resetOnboarding, startOnboarding } = useOnboarding();

<Button onClick={() => { resetOnboarding(); startOnboarding(); }}>
  Restart Tour
</Button>
```

## Troubleshooting

**Not starting?**
- Check console for errors
- Verify OnboardingProvider is above AuthProvider
- Clear localStorage and refresh

**Target not found?**
- Check `data-onboarding` attribute exists
- Verify element is rendered on page
- Navigate to page with target element

**Need help?**
See `README.md` for full documentation.

## Customization

Want different steps? Pass custom array:

```tsx
const mySteps = [
  {
    id: 'welcome',
    title: 'My Welcome',
    description: 'My description',
    position: 'center',
  },
];

<OnboardingProvider steps={mySteps}>
  <App />
</OnboardingProvider>
```

## Next Steps

- Add analytics tracking
- Customize step content
- Add video tutorials
- Create role-based flows

**Happy onboarding!**
