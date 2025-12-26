# PageTransition Integration Guide

Quick start guide for implementing page transitions in the CBP Customer Portal.

## Quick Start

The PageTransition component is already set up and ready to use. Here's how to integrate it into your pages and routes.

### Step 1: Import the Component

```tsx
import { PageTransition, PAGE_TRANSITIONS } from '@/components/shared';
```

### Step 2: Wrap Your Page Content

```tsx
function DashboardPage() {
  return (
    <PageTransition variant="fade" duration="normal">
      <div className="container mx-auto py-8">
        <h1>Dashboard</h1>
        {/* Your page content */}
      </div>
    </PageTransition>
  );
}
```

### Step 3: Add Route-Based Transitions

For automatic transitions on navigation:

```tsx
import { useLocation } from 'react-router-dom';
import { PageTransition } from '@/components/shared';

function AppLayout() {
  const location = useLocation();

  return (
    <PageTransition
      variant="slide-left"
      duration="normal"
      transitionKey={location.pathname}
    >
      <Outlet />
    </PageTransition>
  );
}
```

## Integration Points

### 1. App.tsx Root Layout

Add transitions at the app level for all routes:

```tsx
// src/App.tsx
import { useLocation } from 'react-router-dom';
import { PageTransition } from '@/components/shared';

function App() {
  const location = useLocation();

  return (
    <div className="app">
      <PageTransition
        variant="fade"
        duration="fast"
        transitionKey={location.pathname}
      >
        <Routes>
          {/* Your routes */}
        </Routes>
      </PageTransition>
    </div>
  );
}
```

### 2. Main Layout Component

If you have a main layout wrapper:

```tsx
// src/layouts/MainLayout.tsx
import { Outlet, useLocation } from 'react-router-dom';
import { PageTransition } from '@/components/shared';

export function MainLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1">
        <PageTransition
          variant="slide-left"
          duration="normal"
          transitionKey={location.pathname}
        >
          <Outlet />
        </PageTransition>
      </main>
    </div>
  );
}
```

### 3. Individual Pages

Add transitions to specific pages:

```tsx
// src/pages/BOMsPage.tsx
import { PageTransition } from '@/components/shared';

export function BOMsPage() {
  return (
    <PageTransition variant="fade">
      <div>
        <h1>BOMs</h1>
        <BOMsList />
      </div>
    </PageTransition>
  );
}
```

### 4. Modal/Dialog Components

Use scale animations for overlays:

```tsx
// src/components/dialogs/CreateBOMDialog.tsx
import { PageTransition } from '@/components/shared';

export function CreateBOMDialog({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <PageTransition variant="scale" duration="fast" transitionKey={String(isOpen)}>
        <div className="bg-card rounded-lg p-6">
          {/* Dialog content */}
        </div>
      </PageTransition>
    </div>
  );
}
```

### 5. Tab Panels

Smooth transitions between tabs:

```tsx
// src/pages/settings/SettingsPage.tsx
import { useState } from 'react';
import { PageTransition } from '@/components/shared';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div>
      <TabList activeTab={activeTab} onChange={setActiveTab} />

      <PageTransition
        variant="fade"
        duration="fast"
        transitionKey={activeTab}
      >
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'team' && <TeamTab />}
        {activeTab === 'billing' && <BillingTab />}
      </PageTransition>
    </div>
  );
}
```

## Recommended Patterns

### Pattern 1: Smart Navigation Transitions

Detect forward vs. back navigation:

```tsx
import { useNavigationType, useLocation } from 'react-router-dom';
import { PageTransition } from '@/components/shared';

export function SmartLayout() {
  const location = useLocation();
  const navType = useNavigationType();

  return (
    <PageTransition
      variant={navType === 'POP' ? 'slide-right' : 'slide-left'}
      duration="normal"
      transitionKey={location.pathname}
    >
      <Outlet />
    </PageTransition>
  );
}
```

### Pattern 2: Pre-built Presets

Use semantic transition presets:

```tsx
import { PageTransition, PAGE_TRANSITIONS } from '@/components/shared';

// Forward navigation
<PageTransition {...PAGE_TRANSITIONS.forward} transitionKey={path}>
  {content}
</PageTransition>

// Back navigation
<PageTransition {...PAGE_TRANSITIONS.back} transitionKey={path}>
  {content}
</PageTransition>

// Subtle updates
<PageTransition {...PAGE_TRANSITIONS.subtle} transitionKey={path}>
  {content}
</PageTransition>
```

### Pattern 3: Conditional Animations

Disable on mobile or for accessibility:

```tsx
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { PageTransition } from '@/components/shared';

export function AdaptiveLayout() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  return (
    <PageTransition
      variant={isMobile ? 'fade' : 'slide-left'}
      duration={isMobile ? 'fast' : 'normal'}
      disabled={prefersReducedMotion}
    >
      <Outlet />
    </PageTransition>
  );
}
```

### Pattern 4: Nested Transitions

Different animations for hierarchy:

```tsx
export function NestedLayout() {
  const location = useLocation();

  return (
    <PageTransition variant="fade" transitionKey={location.pathname}>
      <div>
        <Header />
        <PageTransition variant="slide-up" duration="fast" transitionKey={location.pathname + '-content'}>
          <main>
            <Outlet />
          </main>
        </PageTransition>
      </div>
    </PageTransition>
  );
}
```

## Animation Guidelines

### When to Use Each Variant

| Variant | Use Case | Example |
|---------|----------|---------|
| `fade` | Default, subtle transitions | Dashboard, Settings |
| `slide-up` | Bottom sheets, modals | Create Dialog, Filters Panel |
| `slide-left` | Forward navigation | List → Detail View |
| `slide-right` | Back navigation | Detail → List View |
| `scale` | Attention-grabbing overlays | Alerts, Confirmation Dialogs |
| `none` | Instant updates | Real-time data, Live feeds |

### Duration Guidelines

| Duration | Milliseconds | Use Case |
|----------|--------------|----------|
| `fast` | 150ms | Quick updates, tab switches |
| `normal` | 200ms | Standard page navigation |
| `slow` | 300ms | Hero sections, onboarding |

### Best Practices

1. **Keep it fast**: Most transitions should be `fast` or `normal`
2. **Match navigation**: Use `slide-left` for forward, `slide-right` for back
3. **Consistent patterns**: Use the same transition for similar actions
4. **Accessibility first**: Always respect `prefers-reduced-motion`
5. **Don't overdo it**: Not every UI update needs a transition

## Performance Checklist

- [x] CSS transitions imported in `main.tsx`
- [x] Hardware acceleration (transform, opacity only)
- [x] Reduced motion support built-in
- [x] No layout shifts (CSS contain applied)
- [x] Cleanup on unmount
- [x] TypeScript types exported

## Troubleshooting

### Transitions Not Working

**Check 1**: Ensure CSS is imported
```tsx
// src/main.tsx
import '@/styles/transitions.css';
```

**Check 2**: Provide a transitionKey
```tsx
<PageTransition transitionKey={location.pathname}>
```

**Check 3**: Verify parent container has height
```tsx
<div className="min-h-screen">
  <PageTransition>
```

### Flickering During Transition

Add `position: relative` to parent:
```tsx
<div className="relative">
  <PageTransition>
```

### Animation Too Fast/Slow

Adjust duration:
```tsx
<PageTransition duration="fast">  // Faster
<PageTransition duration="slow">  // Slower
```

## Files Created

| File | Purpose |
|------|---------|
| `src/components/shared/PageTransition.tsx` | Main component |
| `src/styles/transitions.css` | CSS animations |
| `src/components/shared/PageTransition.md` | Full documentation |
| `src/components/shared/PageTransition.examples.tsx` | Usage examples |
| `src/components/shared/PageTransition.test.tsx` | Test suite |

## Next Steps

1. **Add to root layout**: Integrate in `App.tsx` or main layout
2. **Test navigation**: Verify transitions work on route changes
3. **Customize timing**: Adjust durations to match brand feel
4. **Add analytics**: Track page views in `onTransitionComplete`
5. **Accessibility audit**: Test with screen readers and reduced motion

## Examples in the Codebase

See `src/components/shared/PageTransition.examples.tsx` for 15+ real-world examples including:

- Basic page wrapper
- Route-based transitions
- Smart navigation detection
- Modal/dialog animations
- Async content loading
- Programmatic transitions
- Pre-built presets
- Nested transitions
- Conditional animations
- Tab transitions
- Focus management
- Multi-step wizards
- Custom styling
- Error states
- Full app layout

## Support

For questions or issues:
1. Check the documentation: `src/components/shared/PageTransition.md`
2. Review examples: `src/components/shared/PageTransition.examples.tsx`
3. Run tests: `npm test PageTransition`
4. Enable debug mode: Add `data-debug-transitions` attribute to root element

---

**Remember**: Good transitions are invisible. Users should feel smoothness, not notice the animation itself.
