# Skeleton Presets - Migration Guide

Quick guide for migrating from manual skeleton implementations to the new preset components.

## Quick Start

### Before (Manual Implementation)

```tsx
{isLoading ? (
  <div className="animate-pulse space-y-2">
    <div className="h-4 bg-muted rounded w-3/4"></div>
    <div className="h-4 bg-muted rounded w-1/2"></div>
  </div>
) : (
  <p>{content}</p>
)}
```

### After (Using Presets)

```tsx
import { TextSkeleton } from '@/components/ui';

{isLoading ? (
  <TextSkeleton lines={2} animation="wave" />
) : (
  <p>{content}</p>
)}
```

---

## Common Patterns

### 1. Text Content

**Old:**
```tsx
<div className="animate-pulse space-y-3">
  <div className="h-4 bg-muted rounded"></div>
  <div className="h-4 bg-muted rounded"></div>
  <div className="h-4 bg-muted rounded w-3/4"></div>
</div>
```

**New:**
```tsx
<TextSkeleton lines={3} lastLineWidth="75%" animation="wave" />
```

---

### 2. Avatar/Profile Picture

**Old:**
```tsx
<div className="rounded-full h-10 w-10 bg-muted animate-pulse"></div>
```

**New:**
```tsx
<AvatarSkeleton size="md" animation="pulse" />
```

---

### 3. Card Layout

**Old:**
```tsx
<div className="border rounded-lg p-4 space-y-3">
  <div className="animate-pulse space-y-2">
    <div className="h-5 bg-muted rounded w-3/4"></div>
    <div className="h-4 bg-muted rounded w-1/2"></div>
  </div>
  <div className="animate-pulse space-y-2">
    <div className="h-4 bg-muted rounded"></div>
    <div className="h-4 bg-muted rounded"></div>
    <div className="h-4 bg-muted rounded w-4/5"></div>
  </div>
</div>
```

**New:**
```tsx
<CardSkeleton hasFooter animation="wave" />
```

---

### 4. Table Rows

**Old:**
```tsx
<tr className="border-b">
  <td className="p-4"><div className="h-4 bg-muted rounded animate-pulse w-32"></div></td>
  <td className="p-4"><div className="h-4 bg-muted rounded animate-pulse w-24"></div></td>
  <td className="p-4"><div className="h-4 bg-muted rounded animate-pulse w-28"></div></td>
  <td className="p-4"><div className="h-4 bg-muted rounded animate-pulse w-20"></div></td>
</tr>
```

**New:**
```tsx
<TableRowSkeleton columns={4} animation="wave" />
```

---

### 5. List Items

**Old:**
```tsx
<div className="flex items-center gap-3 border rounded-lg p-3">
  <div className="rounded-full h-10 w-10 bg-muted animate-pulse"></div>
  <div className="flex-1 space-y-2">
    <div className="h-4 bg-muted rounded animate-pulse w-48"></div>
    <div className="h-3 bg-muted rounded animate-pulse w-32"></div>
  </div>
  <div className="h-9 w-20 bg-muted rounded animate-pulse"></div>
</div>
```

**New:**
```tsx
<ListItemSkeleton hasAvatar hasAction animation="wave" />
```

---

### 6. Dashboard Stats

**Old:**
```tsx
<div className="border rounded-lg p-4">
  <div className="animate-pulse space-y-2">
    <div className="h-3 bg-muted rounded w-20"></div>
    <div className="h-8 bg-muted rounded w-24"></div>
  </div>
</div>
```

**New:**
```tsx
<StatSkeleton showTrend animation="wave" />
```

---

### 7. Form Fields

**Old:**
```tsx
<div className="space-y-2">
  <div className="h-4 bg-muted rounded w-24 animate-pulse"></div>
  <div className="h-10 bg-muted rounded w-full animate-pulse"></div>
</div>
```

**New:**
```tsx
<FormFieldSkeleton hasLabel fieldType="input" animation="wave" />
```

---

### 8. Multiple Items (List/Grid)

**Old:**
```tsx
{isLoading ? (
  <div className="space-y-3">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="animate-pulse">
        <div className="flex items-center gap-3">
          <div className="rounded-full h-10 w-10 bg-muted"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-48"></div>
            <div className="h-3 bg-muted rounded w-32"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
) : (
  items.map(item => <ListItem key={item.id} {...item} />)
)}
```

**New:**
```tsx
{isLoading ? (
  <SkeletonGroup stagger={80} className="space-y-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <ListItemSkeleton key={i} animation="wave" />
    ))}
  </SkeletonGroup>
) : (
  items.map(item => <ListItem key={item.id} {...item} />)
)}
```

---

## Benefits of Migration

### 1. Less Code
- **Before:** 10-20 lines of manual div elements
- **After:** 1-2 lines with preset component

### 2. Better Consistency
- All loading states look uniform
- Matches actual component layouts
- Easier to maintain

### 3. Improved Accessibility
- Automatic ARIA labels
- Screen reader compatible
- Reduced motion support

### 4. Better Performance
- Optimized animations
- Theme-aware styling
- GPU-accelerated

### 5. Easier Maintenance
- Single source of truth
- Update once, apply everywhere
- Type-safe props

---

## Migration Checklist

### Step 1: Identify Manual Skeletons
Search codebase for:
```bash
# Find manual skeleton implementations
grep -r "animate-pulse" src/
grep -r "bg-muted.*rounded" src/
```

### Step 2: Choose Appropriate Preset
Match the layout to available presets:
- Text → `TextSkeleton`
- Avatar → `AvatarSkeleton`
- Card → `CardSkeleton`
- Table → `TableRowSkeleton`
- List → `ListItemSkeleton`
- Stats → `StatSkeleton`
- Forms → `FormFieldSkeleton`

### Step 3: Replace Implementation
1. Import preset component
2. Replace manual div structure
3. Add appropriate props
4. Test visually

### Step 4: Add Animation (Optional)
For prominent content, add wave animation:
```tsx
<CardSkeleton animation="wave" />
```

### Step 5: Test
- Visual check in browser
- Test with different themes
- Verify reduced motion
- Check screen reader

---

## Animation Decision Guide

### Use `pulse` (default) for:
- Secondary content
- Background data
- Non-critical loading states
- Subtle placeholders

### Use `wave` (shimmer) for:
- Primary content
- Main page sections
- Dashboard widgets
- Prominent features

### Use `none` for:
- Performance-critical pages
- Many simultaneous skeletons (100+)
- Reduced motion preference
- Static placeholders

---

## Complete Migration Example

### Before - Dashboard Page

```tsx
function DashboardPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="animate-pulse space-y-2">
                <div className="h-3 bg-muted rounded w-20"></div>
                <div className="h-8 bg-muted rounded w-24"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Cards */}
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="animate-pulse space-y-2">
                <div className="h-5 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </div>
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <DashboardContent data={data} />;
}
```

### After - Dashboard Page

```tsx
import { StatSkeleton, CardSkeleton, SkeletonGroup } from '@/components/ui';

function DashboardPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatSkeleton showTrend animation="wave" />
          <StatSkeleton showTrend animation="wave" />
          <StatSkeleton showTrend animation="wave" />
          <StatSkeleton showTrend animation="wave" />
        </div>

        {/* Cards with stagger */}
        <SkeletonGroup stagger={100} className="grid grid-cols-3 gap-6">
          <CardSkeleton hasFooter animation="wave" />
          <CardSkeleton hasFooter animation="wave" />
          <CardSkeleton hasFooter animation="wave" />
        </SkeletonGroup>
      </div>
    );
  }

  return <DashboardContent data={data} />;
}
```

**Improvements:**
- 50% less code
- Better animation (wave with stagger)
- Consistent styling
- Type-safe props
- Accessible by default

---

## Troubleshooting

### Issue: Skeleton doesn't match content size

**Solution:** Use className to override dimensions
```tsx
<TextSkeleton lines={1} className="w-64 h-8" />
```

### Issue: Animation too fast/slow

**Solution:** Currently fixed at 1.5s. For custom timing, use base Skeleton component
```tsx
<Skeleton animation="wave" className="h-4 w-32" />
```

### Issue: Wrong number of skeleton items

**Solution:** Use expected count from pagination
```tsx
const expectedCount = pageSize || 10;
Array.from({ length: expectedCount }).map((_, i) => ...)
```

### Issue: Skeleton flashing on quick loads

**Solution:** Add minimum display time
```tsx
const [showSkeleton, setShowSkeleton] = useState(false);

useEffect(() => {
  if (isLoading) {
    const timer = setTimeout(() => setShowSkeleton(true), 200);
    return () => clearTimeout(timer);
  }
  setShowSkeleton(false);
}, [isLoading]);
```

---

## Need Custom Skeleton?

For unique layouts not covered by presets, use the base `Skeleton` component:

```tsx
import { Skeleton } from '@/components/ui/skeleton';

<div className="custom-layout">
  <Skeleton className="h-6 w-48" animation="wave" />
  <Skeleton variant="circular" width={60} height={60} />
  <Skeleton className="h-4 w-full" animation="wave" />
</div>
```

Or create a domain-specific skeleton in `src/components/skeletons/`:

```tsx
// src/components/skeletons/my-custom-skeleton.tsx
export function MyCustomSkeleton() {
  return (
    <div className="custom-structure">
      {/* Your custom skeleton layout */}
    </div>
  );
}
```

---

## Resources

- **Full Guide:** `src/components/ui/SKELETON_PRESETS_GUIDE.md`
- **Quick Reference:** `src/components/ui/SKELETON_QUICK_REFERENCE.md`
- **Examples:** `src/components/ui/skeleton-presets-examples.tsx`
- **Storybook:** http://localhost:27250/?path=/docs/ui-skeleton-presets

---

## Support

Questions? Check:
1. Quick Reference guide
2. Storybook examples
3. Implementation examples in codebase
4. Contact frontend team
