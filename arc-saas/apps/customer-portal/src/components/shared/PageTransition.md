# PageTransition Component

Production-ready page transition system with smooth 60fps animations, accessibility support, and zero layout shifts.

## Features

- **Hardware-accelerated animations** using CSS transforms
- **Multiple animation variants**: fade, slide-up, slide-left, slide-right, scale
- **Respects user preferences** with `prefers-reduced-motion` support
- **Zero layout shifts** during transitions
- **Theme-aware** with subtle visual adjustments
- **TypeScript first** with full type safety
- **Lightweight** - pure CSS, no heavy animation libraries
- **React Router compatible** for seamless navigation

## Installation

The component is already exported from `@/components/shared`:

```tsx
import { PageTransition, usePageTransition, PAGE_TRANSITIONS } from '@/components/shared';
```

The CSS is automatically imported in `main.tsx`.

## Basic Usage

### Simple Fade Transition

```tsx
import { PageTransition } from '@/components/shared';

function MyPage() {
  return (
    <PageTransition variant="fade">
      <div>
        <h1>Page Content</h1>
        <p>This content will fade in smoothly</p>
      </div>
    </PageTransition>
  );
}
```

### Route-Based Transitions

Use with React Router to trigger transitions on route changes:

```tsx
import { useLocation } from 'react-router-dom';
import { PageTransition } from '@/components/shared';

function PageLayout() {
  const location = useLocation();

  return (
    <PageTransition
      variant="slide-left"
      duration="normal"
      transitionKey={location.pathname}
    >
      <div className="page-content">
        {/* Your page content */}
      </div>
    </PageTransition>
  );
}
```

### Pre-built Transition Presets

Use the `PAGE_TRANSITIONS` constant for common patterns:

```tsx
import { PageTransition, PAGE_TRANSITIONS } from '@/components/shared';

// Forward navigation (slide from right)
<PageTransition {...PAGE_TRANSITIONS.forward} transitionKey={path}>
  {children}
</PageTransition>

// Back navigation (slide from left)
<PageTransition {...PAGE_TRANSITIONS.back} transitionKey={path}>
  {children}
</PageTransition>

// Subtle fade
<PageTransition {...PAGE_TRANSITIONS.subtle} transitionKey={path}>
  {children}
</PageTransition>

// Dramatic slide-up
<PageTransition {...PAGE_TRANSITIONS.dramatic} transitionKey={path}>
  {children}
</PageTransition>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | required | Content to animate |
| `variant` | `AnimationVariant` | `'fade'` | Animation type |
| `duration` | `AnimationDuration` | `'normal'` | Speed preset |
| `className` | `string` | - | Additional CSS classes |
| `transitionKey` | `string` | - | Unique key to trigger re-animation |
| `onTransitionComplete` | `(state) => void` | - | Callback when transition completes |
| `disabled` | `boolean` | `false` | Disable animations |

## Animation Variants

### Fade
Simple opacity transition - cleanest, most universal.

```tsx
<PageTransition variant="fade">
  {content}
</PageTransition>
```

### Slide Up
Slides in from bottom - great for modals and overlays.

```tsx
<PageTransition variant="slide-up">
  {content}
</PageTransition>
```

### Slide Left
Slides in from right - use for forward navigation.

```tsx
<PageTransition variant="slide-left">
  {content}
</PageTransition>
```

### Slide Right
Slides in from left - use for back navigation.

```tsx
<PageTransition variant="slide-right">
  {content}
</PageTransition>
```

### Scale
Scales up from center with fade - dramatic, attention-grabbing.

```tsx
<PageTransition variant="scale">
  {content}
</PageTransition>
```

### None
No animation - instant transition.

```tsx
<PageTransition variant="none">
  {content}
</PageTransition>
```

## Duration Presets

| Duration | Milliseconds | Use Case |
|----------|--------------|----------|
| `fast` | 150ms | Quick, subtle transitions |
| `normal` | 200ms | Standard, balanced feel |
| `slow` | 300ms | Dramatic, noticeable transitions |

```tsx
<PageTransition variant="fade" duration="fast">
  {/* Quick fade */}
</PageTransition>

<PageTransition variant="slide-up" duration="slow">
  {/* Slow, dramatic slide */}
</PageTransition>
```

## Advanced Usage

### usePageTransition Hook

Programmatically trigger transitions without using the component:

```tsx
import { usePageTransition } from '@/components/shared';

function NavigationButton() {
  const { state, isTransitioning, triggerTransition } = usePageTransition();

  const handleNavigate = () => {
    triggerTransition(() => {
      // This callback runs after exit animation
      navigate('/new-page');
    }, 'normal');
  };

  return (
    <button onClick={handleNavigate} disabled={isTransitioning}>
      {isTransitioning ? 'Transitioning...' : 'Navigate'}
    </button>
  );
}
```

### Transition State Callback

React to transition lifecycle events:

```tsx
<PageTransition
  variant="fade"
  onTransitionComplete={(state) => {
    console.log('Transition state:', state);
    // States: 'entering', 'entered', 'exiting', 'exited'

    if (state === 'entered') {
      // Trigger analytics, focus management, etc.
    }
  }}
>
  {content}
</PageTransition>
```

### Conditional Animations

Disable animations based on conditions:

```tsx
import { useMediaQuery } from '@/hooks/useMediaQuery';

function AdaptiveTransition({ children }) {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <PageTransition
      variant={isMobile ? 'fade' : 'slide-left'}
      disabled={prefersReducedMotion}
    >
      {children}
    </PageTransition>
  );
}
```

### Custom Styling

Add custom classes while preserving transitions:

```tsx
<PageTransition
  variant="fade"
  className="min-h-screen flex items-center justify-center"
>
  {content}
</PageTransition>
```

### Navigation History Detection

Detect forward/backward navigation and apply appropriate animations:

```tsx
import { useNavigationType } from 'react-router-dom';

function SmartTransition({ children }) {
  const navigationType = useNavigationType();

  const variant = navigationType === 'POP'
    ? 'slide-right'  // Back navigation
    : 'slide-left';   // Forward navigation

  return (
    <PageTransition variant={variant}>
      {children}
    </PageTransition>
  );
}
```

## Integration Examples

### With React Router Layout

```tsx
// App.tsx
import { Outlet, useLocation } from 'react-router-dom';
import { PageTransition } from '@/components/shared';

function RootLayout() {
  const location = useLocation();

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <PageTransition
          variant="fade"
          duration="fast"
          transitionKey={location.pathname}
        >
          <Outlet />
        </PageTransition>
      </main>
    </div>
  );
}
```

### With Suspense Boundaries

```tsx
import { Suspense } from 'react';
import { PageTransition, PageLoading } from '@/components/shared';

function AsyncPage() {
  return (
    <PageTransition variant="fade">
      <Suspense fallback={<PageLoading />}>
        <LazyLoadedComponent />
      </Suspense>
    </PageTransition>
  );
}
```

### Nested Transitions

```tsx
function ParentPage() {
  return (
    <PageTransition variant="fade" duration="normal">
      <div>
        <Header />
        <PageTransition variant="slide-up" duration="fast">
          <Content />
        </PageTransition>
      </div>
    </PageTransition>
  );
}
```

## Accessibility

### Reduced Motion Support

The component automatically respects `prefers-reduced-motion: reduce`:

- All transform animations are disabled
- Only opacity transitions remain (fast, 100ms)
- Ensures usability for users with vestibular disorders

```css
@media (prefers-reduced-motion: reduce) {
  .page-transition {
    transition: opacity 100ms linear !important;
    transform: none !important;
  }
}
```

### Focus Management

Manage focus after transitions complete:

```tsx
<PageTransition
  variant="fade"
  onTransitionComplete={(state) => {
    if (state === 'entered') {
      // Focus first heading
      document.querySelector('h1')?.focus();
    }
  }}
>
  <h1 tabIndex={-1}>Page Title</h1>
</PageTransition>
```

### Screen Reader Announcements

Use ARIA live regions to announce page changes:

```tsx
function AccessibleTransition({ children, pageName }) {
  return (
    <>
      <div aria-live="polite" className="sr-only">
        Navigated to {pageName}
      </div>
      <PageTransition variant="fade">
        {children}
      </PageTransition>
    </>
  );
}
```

## Performance

### Hardware Acceleration

All animations use GPU-accelerated properties:
- `transform` (translateX, translateY, scale)
- `opacity`

**Never animating:**
- `width`, `height` (causes layout recalculation)
- `top`, `left`, `right`, `bottom` (causes paint)
- `margin`, `padding` (causes layout)

### Resource Optimization

```css
/* will-change is applied during transitions only */
.page-transition-entering,
.page-transition-exiting {
  will-change: transform, opacity;
}

/* Removed after transition completes */
.page-transition-entered {
  will-change: auto;
}
```

### Paint Containment

```css
.page-transition-entering,
.page-transition-exiting {
  contain: layout style paint;
}
```

## Debugging

### Visual Debug Mode

Enable debug mode to visualize transition states:

```tsx
// In your root layout
function App() {
  const isDebug = import.meta.env.DEV;

  return (
    <div data-debug-transitions={isDebug ? '' : undefined}>
      <Routes />
    </div>
  );
}
```

This will add colored outlines:
- Orange: Entering
- Green: Entered
- Red: Exiting
- Gray: Exited

### Log Transition States

```tsx
<PageTransition
  variant="fade"
  onTransitionComplete={(state) => {
    console.log('[Transition]', {
      state,
      timestamp: Date.now(),
      path: location.pathname,
    });
  }}
>
  {content}
</PageTransition>
```

## Browser Support

Works in all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS 14+, Android Chrome)

Graceful degradation for older browsers:
- Transitions still work, may be less smooth
- Reduced motion respected via media query

## Best Practices

### 1. Use Appropriate Variants

```tsx
// Modal dialogs
<PageTransition variant="scale" duration="fast">

// Forward navigation
<PageTransition variant="slide-left" duration="normal">

// Back navigation
<PageTransition variant="slide-right" duration="normal">

// Subtle updates
<PageTransition variant="fade" duration="fast">

// Hero sections
<PageTransition variant="slide-up" duration="slow">
```

### 2. Match Navigation Direction

```tsx
const variant = isGoingBack ? 'slide-right' : 'slide-left';
```

### 3. Keep Transitions Fast

```tsx
// Good: Fast, unobtrusive
<PageTransition variant="fade" duration="fast">

// Bad: Too slow, feels sluggish
<PageTransition variant="scale" duration="slow">
```

### 4. Provide Transition Keys

```tsx
// Good: Triggers transition on route change
<PageTransition transitionKey={location.pathname}>

// Bad: Never re-triggers
<PageTransition>
```

### 5. Avoid Nested Same Variants

```tsx
// Bad: Conflicting animations
<PageTransition variant="fade">
  <PageTransition variant="fade">

// Good: Different variants for hierarchy
<PageTransition variant="fade">
  <PageTransition variant="slide-up">
```

## Troubleshooting

### Transitions Not Triggering

**Problem**: Content appears instantly without animation.

**Solution**: Ensure you're passing a `transitionKey` prop:
```tsx
<PageTransition transitionKey={location.pathname}>
```

### Flickering During Transition

**Problem**: Content flickers or jumps.

**Solution**: Add `position: relative` to parent container:
```tsx
<div className="relative">
  <PageTransition>
```

### Layout Shifts

**Problem**: Page jumps during animation.

**Solution**: Ensure container has fixed dimensions:
```tsx
<div className="min-h-screen">
  <PageTransition>
```

### Animations Too Fast/Slow

**Problem**: Default timing doesn't feel right.

**Solution**: Adjust duration preset:
```tsx
// Too fast? Use normal or slow
<PageTransition duration="normal">

// Too slow? Use fast
<PageTransition duration="fast">
```

## TypeScript Types

```typescript
// Animation variant options
type AnimationVariant =
  | 'fade'
  | 'slide-up'
  | 'slide-left'
  | 'slide-right'
  | 'scale'
  | 'none';

// Duration presets
type AnimationDuration = 'fast' | 'normal' | 'slow';

// Transition state machine
type TransitionState = 'entering' | 'entered' | 'exiting' | 'exited';

// Component props
interface PageTransitionProps {
  children: React.ReactNode;
  variant?: AnimationVariant;
  duration?: AnimationDuration;
  className?: string;
  transitionKey?: string;
  onTransitionComplete?: (state: TransitionState) => void;
  disabled?: boolean;
}

// Hook return type
interface UsePageTransitionReturn {
  state: TransitionState;
  isTransitioning: boolean;
  triggerTransition: (callback?: () => void, duration?: AnimationDuration) => void;
}
```

## Related Components

- `LoadingSpinner` - For loading states during transitions
- `PageLoading` - Full-page loading overlay
- `ErrorBoundary` - Catch errors during page transitions
- `Suspense` - Handle async component loading

## License

Part of the Ananta Platform CBP Customer Portal.
