# Skeleton Presets - Quick Reference

One-page cheat sheet for all skeleton components.

## Import

```tsx
import {
  Skeleton,                  // Base component
  TextSkeleton,
  AvatarSkeleton,
  CardSkeleton,
  TableRowSkeleton,
  ListItemSkeleton,
  StatSkeleton,
  FormFieldSkeleton,
  ButtonSkeleton,
  ImageSkeleton,
  BadgeSkeleton,
  ChartSkeleton,
  SkeletonGroup,
  NavbarSkeleton,
  ProfileHeaderSkeleton,
} from '@/components/ui/skeleton-presets';

// Or use barrel export
import { TextSkeleton, CardSkeleton } from '@/components/ui';
```

## Common Props

All components support these props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `animation` | `'pulse' \| 'wave' \| 'none'` | `'pulse'` | Animation type |
| `className` | `string` | - | Additional CSS classes |

## Animation Types

| Type | Use Case | Performance |
|------|----------|-------------|
| `pulse` | Default, subtle | Best |
| `wave` | Prominent loading states | Good (GPU-accelerated) |
| `none` | Static placeholder | Best |

## Component Reference

### TextSkeleton

```tsx
<TextSkeleton lines={3} animation="wave" lastLineWidth="75%" />
```

**Props:** `lines?`, `lastLineWidth?`, `animation?`, `className?`

---

### AvatarSkeleton

```tsx
<AvatarSkeleton size="lg" animation="wave" />
```

**Props:** `size?: 'sm' | 'md' | 'lg' | 'xl'`, `animation?`, `className?`

**Sizes:** sm=32px, md=40px, lg=48px, xl=64px

---

### CardSkeleton

```tsx
<CardSkeleton hasFooter animation="wave" />
```

**Props:** `hasFooter?`, `animation?`, `className?`

---

### TableRowSkeleton

```tsx
<TableRowSkeleton columns={6} animation="wave" />
```

**Props:** `columns?` (default: 4), `animation?`, `className?`

---

### ListItemSkeleton

```tsx
<ListItemSkeleton hasAvatar hasAction animation="wave" />
```

**Props:** `hasAvatar?`, `hasAction?`, `animation?`, `className?`

---

### StatSkeleton

```tsx
<StatSkeleton showTrend animation="wave" />
```

**Props:** `showTrend?`, `animation?`, `className?`

---

### FormFieldSkeleton

```tsx
<FormFieldSkeleton hasLabel fieldType="textarea" animation="wave" />
```

**Props:** `hasLabel?`, `fieldType?: 'input' | 'textarea' | 'select'`, `animation?`, `className?`

---

### ButtonSkeleton

```tsx
<ButtonSkeleton size="lg" animation="wave" />
```

**Props:** `size?: 'sm' | 'default' | 'lg'`, `animation?`, `className?`

**Sizes:** sm=h-8 w-20, default=h-10 w-24, lg=h-12 w-32

---

### ImageSkeleton

```tsx
<ImageSkeleton aspectRatio="16/9" animation="wave" />
```

**Props:** `aspectRatio?: '1/1' | '16/9' | '4/3' | '21/9' | string`, `animation?`, `className?`

---

### BadgeSkeleton

```tsx
<BadgeSkeleton animation="wave" />
```

**Props:** `animation?`, `className?`

---

### ChartSkeleton

```tsx
<ChartSkeleton variant="bar" animation="wave" />
```

**Props:** `variant?: 'bar' | 'line' | 'pie' | 'area'`, `animation?`, `className?`

---

### NavbarSkeleton

```tsx
<NavbarSkeleton animation="wave" />
```

**Props:** `animation?`, `className?`

---

### ProfileHeaderSkeleton

```tsx
<ProfileHeaderSkeleton animation="wave" />
```

**Props:** `animation?`, `className?`

---

### SkeletonGroup

```tsx
<SkeletonGroup stagger={100} className="space-y-3">
  <ListItemSkeleton animation="wave" />
  <ListItemSkeleton animation="wave" />
</SkeletonGroup>
```

**Props:** `stagger?` (delay in ms), `pauseOutOfView?`, `children`, `className?`

---

## Common Patterns

### Loading List

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

### Loading Grid

```tsx
{isLoading ? (
  <SkeletonGroup stagger={100} className="grid grid-cols-3 gap-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <CardSkeleton key={i} hasFooter animation="wave" />
    ))}
  </SkeletonGroup>
) : (
  items.map(item => <Card key={item.id} {...item} />)
)}
```

### Loading Table

```tsx
<Table>
  <TableBody>
    {isLoading ? (
      Array.from({ length: 10 }).map((_, i) => (
        <TableRowSkeleton key={i} columns={5} animation="wave" />
      ))
    ) : (
      data.map(row => <TableRow key={row.id} {...row} />)
    )}
  </TableBody>
</Table>
```

### Loading Form

```tsx
{isLoading ? (
  <div className="space-y-4">
    <FormFieldSkeleton hasLabel animation="wave" />
    <FormFieldSkeleton hasLabel fieldType="select" animation="wave" />
    <FormFieldSkeleton hasLabel fieldType="textarea" animation="wave" />
    <div className="flex justify-end gap-2">
      <ButtonSkeleton />
      <ButtonSkeleton />
    </div>
  </div>
) : (
  <Form data={formData} />
)}
```

### Loading Dashboard

```tsx
{isLoading ? (
  <div className="space-y-6">
    <div className="grid grid-cols-4 gap-4">
      <StatSkeleton showTrend animation="wave" />
      <StatSkeleton showTrend animation="wave" />
      <StatSkeleton showTrend animation="wave" />
      <StatSkeleton showTrend animation="wave" />
    </div>
    <SkeletonGroup stagger={100} className="grid grid-cols-3 gap-4">
      <CardSkeleton hasFooter animation="wave" />
      <CardSkeleton hasFooter animation="wave" />
      <CardSkeleton hasFooter animation="wave" />
    </SkeletonGroup>
  </div>
) : (
  <Dashboard data={dashboardData} />
)}
```

---

## Best Practices

1. **Match layout:** Skeleton dimensions should match final content
2. **Use wave sparingly:** Reserve for prominent content
3. **Show expected count:** Match skeleton count to expected items
4. **Add stagger:** Use SkeletonGroup for list/grid animations
5. **Respect motion:** Wave animation auto-respects prefers-reduced-motion
6. **Maintain semantics:** Keep proper HTML structure with skeletons

---

## Accessibility

- All skeletons include `role="status"` and `aria-label`
- Wave animation respects `prefers-reduced-motion`
- No keyboard focus issues
- Screen reader compatible

---

## Performance

- Pure CSS animations (GPU-accelerated)
- No JavaScript overhead
- Minimal re-renders
- Optimized for all themes

---

## Theme Support

All skeletons automatically adapt to:
- Light theme
- Mid-light theme
- Dark theme (enhanced visibility)
- Mid-dark theme (enhanced visibility)

---

## Related Files

- **Implementation:** `src/components/ui/skeleton-presets.tsx`
- **Base component:** `src/components/ui/skeleton.tsx`
- **Storybook:** `src/components/ui/skeleton-presets.stories.tsx`
- **Examples:** `src/components/ui/skeleton-presets-examples.tsx`
- **Full guide:** `src/components/ui/SKELETON_PRESETS_GUIDE.md`
- **Domain skeletons:** `src/components/skeletons/` (BOM-specific)

---

## Storybook

View all components in Storybook:
```bash
npm run storybook
# Navigate to UI > Skeleton Presets
```

Local URL: http://localhost:27250/?path=/docs/ui-skeleton-presets
