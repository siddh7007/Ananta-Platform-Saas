# Skeleton Loading - Quick Reference

## Import

```tsx
// Base component
import { Skeleton } from '@/components/ui/skeleton';

// Pre-built patterns
import {
  BomCardSkeleton,
  BomTableRowSkeleton,
  BomDetailSkeleton,
  ComponentCardSkeleton,
  DashboardWidgetSkeleton,
  LineItemRowSkeleton,
  SkeletonGroup,
} from '@/components/skeletons';
```

## Common Patterns

### BOM List (Table)
```tsx
{isLoading ? (
  <>
    <BomTableRowSkeleton />
    <BomTableRowSkeleton />
    <BomTableRowSkeleton />
  </>
) : (
  boms.map(bom => <BomRow key={bom.id} bom={bom} />)
)}
```

### BOM List (Grid)
```tsx
{isLoading ? (
  <>
    <BomCardSkeleton />
    <BomCardSkeleton />
    <BomCardSkeleton />
  </>
) : (
  boms.map(bom => <BomCard key={bom.id} bom={bom} />)
)}
```

### BOM Detail Page
```tsx
if (isLoading) return <BomDetailSkeleton />;
```

### Line Items Table
```tsx
{isLoading ? (
  Array.from({ length: 10 }).map((_, i) => (
    <LineItemRowSkeleton key={i} />
  ))
) : (
  lineItems.map(item => <LineItemRow key={item.id} item={item} />)
)}
```

### Component Search Results
```tsx
{isLoading ? (
  <SkeletonGroup count={8} animation="wave">
    <ComponentCardSkeleton />
  </SkeletonGroup>
) : (
  components.map(c => <ComponentCard key={c.id} component={c} />)
)}
```

### Dashboard Widgets
```tsx
{isLoading ? (
  <DashboardWidgetSkeleton variant="detailed" />
) : (
  <BomSummaryWidget data={stats} />
)}
```

## Base Component Usage

### Variants
```tsx
<Skeleton variant="text" className="h-4 w-32" />
<Skeleton variant="circular" width={48} height={48} />
<Skeleton variant="rectangular" className="h-32 w-full" />
```

### Animations
```tsx
<Skeleton animation="pulse" />  {/* Default */}
<Skeleton animation="wave" />   {/* Shimmer effect */}
<Skeleton animation="none" />   {/* Static */}
```

## Widget Variants

```tsx
<DashboardWidgetSkeleton variant="compact" />    // Minimal
<DashboardWidgetSkeleton variant="default" />    // Standard
<DashboardWidgetSkeleton variant="detailed" />   // Full breakdown
```

## Tips

- Match skeleton count to typical content (5-10 items)
- Use `wave` animation for lists (better progression feel)
- Use `pulse` (default) for cards and widgets
- Full page skeletons for detail views
- Row skeletons for tables
- Card skeletons for grids

## When to Use Which

| Content Type | Skeleton Pattern | Animation |
|--------------|------------------|-----------|
| BOM list (table) | `BomTableRowSkeleton` | pulse |
| BOM list (cards) | `BomCardSkeleton` | pulse |
| BOM detail page | `BomDetailSkeleton` | pulse |
| Line items | `LineItemRowSkeleton` (with `SkeletonGroup`) | wave |
| Component search | `ComponentCardSkeleton` (with `SkeletonGroup`) | wave |
| Dashboard stats | `DashboardWidgetSkeleton` | pulse |
| User profile | Custom pattern | pulse |

## Custom Pattern Template

```tsx
function MyComponentSkeleton() {
  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-24 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 flex-1" />
      </div>
    </div>
  );
}
```
