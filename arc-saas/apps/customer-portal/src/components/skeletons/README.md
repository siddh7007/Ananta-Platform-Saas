# Skeleton Loading States - CBP-P3-009

Comprehensive skeleton loading components for the Ananta Customer Portal.

## Overview

This module provides pre-built skeleton components that match the actual content layouts in the application. Using proper skeleton loading states improves perceived performance and provides a better user experience during data fetching.

## Features

- **Multiple Variants**: Text, circular, and rectangular skeletons
- **Animation Options**: Pulse (default), wave/shimmer, or no animation
- **Pre-built Patterns**: Ready-to-use skeletons for common layouts
- **Customizable**: Width, height, and className props for flexibility
- **Accessible**: Proper ARIA attributes (role="status", aria-busy, aria-label)
- **Smooth Animations**: Tailwind-based animations that match the design system

## Base Skeleton Component

### Props

```typescript
interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';  // Shape variant
  width?: string | number;                         // CSS width
  height?: string | number;                        // CSS height
  animation?: 'pulse' | 'wave' | 'none';          // Animation type
  className?: string;                              // Additional classes
}
```

### Basic Usage

```tsx
import { Skeleton } from '@/components/ui/skeleton';

// Text skeleton
<Skeleton className="h-4 w-32" />

// Circular avatar
<Skeleton variant="circular" width={48} height={48} />

// Wave animation
<Skeleton animation="wave" className="h-20 w-full" />

// No animation
<Skeleton animation="none" className="h-8 w-24" />
```

## Pre-built Skeleton Patterns

### BomCardSkeleton

Matches BOM card layout used in grid views.

```tsx
import { BomCardSkeleton } from '@/components/skeletons';

<div className="grid grid-cols-3 gap-4">
  {isLoading ? (
    <>
      <BomCardSkeleton />
      <BomCardSkeleton />
      <BomCardSkeleton />
    </>
  ) : (
    boms.map(bom => <BomCard key={bom.id} bom={bom} />)
  )}
</div>
```

### BomTableRowSkeleton

Matches table row layout for BOM lists.

```tsx
import { BomTableRowSkeleton } from '@/components/skeletons';

<Table>
  <TableBody>
    {isLoading ? (
      <>
        <BomTableRowSkeleton />
        <BomTableRowSkeleton />
        <BomTableRowSkeleton />
      </>
    ) : (
      boms.map(bom => <BomRow key={bom.id} bom={bom} />)
    )}
  </TableBody>
</Table>
```

### BomDetailSkeleton

Full page skeleton for BOM detail view.

```tsx
import { BomDetailSkeleton } from '@/components/skeletons';

function BomDetailPage() {
  const { data: bom, isLoading } = useBom(bomId);

  if (isLoading) return <BomDetailSkeleton />;

  return <BomDetailView bom={bom} />;
}
```

### LineItemRowSkeleton

Single line item row in BOM detail table.

```tsx
import { LineItemRowSkeleton } from '@/components/skeletons';

<TableBody>
  {isLoading ? (
    Array.from({ length: 5 }).map((_, i) => (
      <LineItemRowSkeleton key={i} />
    ))
  ) : (
    lineItems.map(item => <LineItemRow key={item.id} item={item} />)
  )}
</TableBody>
```

### ComponentCardSkeleton

Matches component search result card.

```tsx
import { ComponentCardSkeleton } from '@/components/skeletons';

<div className="space-y-3">
  {isLoading ? (
    Array.from({ length: 8 }).map((_, i) => (
      <ComponentCardSkeleton key={i} />
    ))
  ) : (
    components.map(c => <ComponentCard key={c.id} component={c} />)
  )}
</div>
```

### DashboardWidgetSkeleton

Matches dashboard widget/card layouts with multiple variants.

```tsx
import { DashboardWidgetSkeleton } from '@/components/skeletons';

// Compact variant
<DashboardWidgetSkeleton variant="compact" />

// Default variant
<DashboardWidgetSkeleton variant="default" />

// Detailed variant
<DashboardWidgetSkeleton variant="detailed" />
```

### SkeletonGroup

Utility component for rendering multiple skeletons with staggered animations.

```tsx
import { SkeletonGroup, BomCardSkeleton } from '@/components/skeletons';

<SkeletonGroup count={5} animation="wave">
  <BomCardSkeleton />
</SkeletonGroup>
```

## Animation Types

### Pulse (Default)

Smooth opacity pulsing animation. Best for general loading states.

```tsx
<Skeleton animation="pulse" className="h-4 w-32" />
```

### Wave/Shimmer

Left-to-right shimmer effect. Great for list items to show progression.

```tsx
<Skeleton animation="wave" className="h-4 w-32" />
```

### None

No animation. Useful when you want static placeholders.

```tsx
<Skeleton animation="none" className="h-4 w-32" />
```

## Creating Custom Skeletons

Match your component's layout structure:

```tsx
function UserProfileSkeleton() {
  return (
    <div className="rounded-lg border p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={64} height={64} />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-4 w-16 mx-auto" />
            <Skeleton className="h-6 w-12 mx-auto" />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 flex-1" />
      </div>
    </div>
  );
}
```

## Best Practices

### 1. Match Content Layout

Skeletons should mirror the actual content structure:

```tsx
// Good - matches actual layout
<div className="space-y-2">
  <Skeleton className="h-6 w-48" /> {/* Title */}
  <Skeleton className="h-4 w-32" /> {/* Subtitle */}
</div>

// Bad - doesn't match layout
<Skeleton className="h-20 w-full" />
```

### 2. Use Pre-built Patterns

Leverage existing skeleton patterns instead of creating custom ones:

```tsx
// Good - reuse pattern
<BomCardSkeleton />

// Less good - recreate skeleton
<Card>
  <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
  {/* ... */}
</Card>
```

### 3. Consistent Count

Show same number of skeletons as typical content:

```tsx
// Good - realistic count
{isLoading && (
  <>
    <BomCardSkeleton />
    <BomCardSkeleton />
    <BomCardSkeleton />
  </>
)}

// Bad - too few or too many
{isLoading && <BomCardSkeleton />}
```

### 4. Animation Choice

- **Pulse**: Default for most cases
- **Wave**: Lists and sequential content
- **None**: Static layouts or nested skeletons

```tsx
// List with wave animation
<SkeletonGroup count={8} animation="wave">
  <ComponentCardSkeleton />
</SkeletonGroup>

// Card grid with pulse (default)
<>
  <BomCardSkeleton />
  <BomCardSkeleton />
</>
```

### 5. Accessibility

Skeletons automatically include proper ARIA attributes:

```tsx
// Automatically includes:
// role="status"
// aria-busy="true"
// aria-label="Loading..."
<Skeleton className="h-4 w-32" />
```

## Tailwind Configuration

The shimmer/wave animation is configured in `tailwind.config.js`:

```javascript
keyframes: {
  shimmer: {
    '0%': { backgroundPosition: '-1000px 0' },
    '100%': { backgroundPosition: '1000px 0' }
  }
},
animation: {
  shimmer: 'shimmer 2s infinite linear'
}
```

## File Structure

```
src/components/skeletons/
├── index.tsx                 # All skeleton patterns (export)
├── skeleton-examples.tsx     # Usage examples
└── README.md                 # This file

src/components/ui/
└── skeleton.tsx              # Base Skeleton component

src/components/shared/
└── ListSkeletons.tsx         # Legacy list skeletons (compatible)
```

## Migration from Legacy Skeletons

Existing components using `BomListSkeleton` from `@/components/shared` continue to work. New components should use patterns from `@/components/skeletons`:

```tsx
// Legacy (still works)
import { BomListSkeleton } from '@/components/shared';

// New (recommended)
import { BomTableRowSkeleton } from '@/components/skeletons';
```

## Examples

See `skeleton-examples.tsx` for interactive examples of all skeleton patterns.

## Related

- **CBP-P3-009**: Skeleton Loading States specification
- `src/components/ui/skeleton.tsx`: Base component
- `src/components/shared/ListSkeletons.tsx`: Legacy skeletons
