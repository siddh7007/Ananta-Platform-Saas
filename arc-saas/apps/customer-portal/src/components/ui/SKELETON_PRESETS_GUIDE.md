# Skeleton Presets Guide

Complete documentation for skeleton loading components in the CBP customer portal.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Available Presets](#available-presets)
- [Animation Types](#animation-types)
- [Accessibility](#accessibility)
- [Theme Support](#theme-support)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)

---

## Overview

Skeleton presets provide ready-to-use loading placeholders that match common UI patterns throughout the application. These components create smooth loading experiences by visually aligning with the final rendered content.

### File Structure

```
src/components/ui/
├── skeleton.tsx              # Base skeleton component
├── skeleton-presets.tsx      # General-purpose presets (NEW)
├── skeleton-presets.stories.tsx  # Storybook documentation (NEW)
└── index.ts                  # Barrel exports (NEW)

src/components/skeletons/
├── index.tsx                 # Domain-specific skeletons (BOM, Components, etc.)
└── README.md                 # Domain skeleton documentation
```

### When to Use Which

- **Base Skeleton** (`skeleton.tsx`): Custom layouts, one-off cases
- **General Presets** (`skeleton-presets.tsx`): Common UI patterns (cards, lists, forms)
- **Domain Skeletons** (`skeletons/`): BOM-specific, component catalog patterns

---

## Features

### Shimmer/Wave Animation

Enhanced CSS-based shimmer animation with:
- Smooth gradient sweep (1.5s duration)
- Theme-aware colors (adapts to light/dark themes)
- GPU-accelerated performance
- Automatic reduced-motion support

```css
/* Defined in globals.css */
.animate-shimmer {
  background: linear-gradient(
    90deg,
    hsl(var(--muted)) 0%,
    hsl(var(--muted-foreground) / 0.1) 50%,
    hsl(var(--muted)) 100%
  );
  animation: shimmer 1.5s ease-in-out infinite;
}
```

### Accessibility

All skeleton components include:
- `role="status"` for screen readers
- `aria-label` describing loading state
- `aria-busy="true"` on base skeleton
- Semantic HTML structure
- Keyboard navigation preservation

### Performance

- Pure CSS animations (no JavaScript)
- GPU-accelerated transforms
- Reduced motion support
- Optional viewport-based pausing (SkeletonGroup)

---

## Available Presets

### TextSkeleton

Multiple lines of text placeholder for paragraphs and descriptions.

**Props:**
- `lines?: number` - Number of lines (default: 3)
- `animation?: 'pulse' | 'wave' | 'none'` - Animation type (default: 'pulse')
- `lastLineWidth?: string` - Width of last line (default: '75%')
- `className?: string` - Additional CSS classes

**Usage:**
```tsx
// Article content loading
{isLoading ? (
  <TextSkeleton lines={5} animation="wave" />
) : (
  <p>{article.content}</p>
)}

// Short description
<TextSkeleton lines={2} lastLineWidth="60%" />
```

---

### AvatarSkeleton

Circular avatar placeholder for user profile pictures.

**Props:**
- `size?: 'sm' | 'md' | 'lg' | 'xl'` - Predefined size (default: 'md')
  - sm: 32px
  - md: 40px
  - lg: 48px
  - xl: 64px
- `animation?: 'pulse' | 'wave' | 'none'`
- `className?: string`

**Usage:**
```tsx
// User profile header
<div className="flex items-center gap-3">
  {isLoading ? (
    <AvatarSkeleton size="lg" />
  ) : (
    <Avatar src={user.avatar} alt={user.name} />
  )}
</div>
```

---

### CardSkeleton

Standard card layout with header, body, and optional footer.

**Props:**
- `hasFooter?: boolean` - Include footer section (default: false)
- `animation?: 'pulse' | 'wave' | 'none'`
- `className?: string`

**Usage:**
```tsx
// Product cards grid
<div className="grid grid-cols-3 gap-4">
  {isLoading ? (
    Array.from({ length: 6 }).map((_, i) => (
      <CardSkeleton key={i} hasFooter animation="wave" />
    ))
  ) : (
    products.map(p => <ProductCard key={p.id} product={p} />)
  )}
</div>
```

---

### TableRowSkeleton

Generic table row with configurable columns.

**Props:**
- `columns?: number` - Number of columns (default: 4)
- `animation?: 'pulse' | 'wave' | 'none'`
- `className?: string`

**Usage:**
```tsx
<Table>
  <TableBody>
    {isLoading ? (
      Array.from({ length: 10 }).map((_, i) => (
        <TableRowSkeleton key={i} columns={6} animation="wave" />
      ))
    ) : (
      data.map(row => <TableRow key={row.id} {...row} />)
    )}
  </TableBody>
</Table>
```

---

### ListItemSkeleton

List item with optional avatar and action button.

**Props:**
- `hasAvatar?: boolean` - Show avatar placeholder (default: true)
- `hasAction?: boolean` - Show action button (default: true)
- `animation?: 'pulse' | 'wave' | 'none'`
- `className?: string`

**Usage:**
```tsx
// User list
<div className="space-y-2">
  {isLoading ? (
    Array.from({ length: 5 }).map((_, i) => (
      <ListItemSkeleton key={i} hasAvatar hasAction />
    ))
  ) : (
    users.map(user => <UserListItem key={user.id} user={user} />)
  )}
</div>
```

---

### StatSkeleton

Statistic/KPI card for dashboard metrics.

**Props:**
- `showTrend?: boolean` - Include trend indicator (default: false)
- `animation?: 'pulse' | 'wave' | 'none'`
- `className?: string`

**Usage:**
```tsx
// Dashboard stats
<div className="grid grid-cols-4 gap-4">
  {isLoading ? (
    <>
      <StatSkeleton showTrend />
      <StatSkeleton showTrend />
      <StatSkeleton showTrend />
      <StatSkeleton showTrend />
    </>
  ) : (
    stats.map(stat => <StatCard key={stat.id} {...stat} />)
  )}
</div>
```

---

### FormFieldSkeleton

Form input field with optional label.

**Props:**
- `hasLabel?: boolean` - Show label placeholder (default: true)
- `fieldType?: 'input' | 'textarea' | 'select'` - Field type (default: 'input')
- `animation?: 'pulse' | 'wave' | 'none'`
- `className?: string`

**Usage:**
```tsx
// Loading form
<form>
  {isLoading ? (
    <>
      <FormFieldSkeleton hasLabel />
      <FormFieldSkeleton hasLabel fieldType="textarea" />
      <FormFieldSkeleton hasLabel fieldType="select" />
    </>
  ) : (
    <FormFields data={formData} />
  )}
</form>
```

---

### ButtonSkeleton

Action button placeholder.

**Props:**
- `size?: 'sm' | 'default' | 'lg'` - Button size
  - sm: h-8 w-20
  - default: h-10 w-24
  - lg: h-12 w-32
- `animation?: 'pulse' | 'wave' | 'none'`
- `className?: string`

**Usage:**
```tsx
<div className="flex gap-2">
  {isLoading ? (
    <>
      <ButtonSkeleton size="default" />
      <ButtonSkeleton size="sm" />
    </>
  ) : (
    <>
      <Button>Submit</Button>
      <Button size="sm">Cancel</Button>
    </>
  )}
</div>
```

---

### ImageSkeleton

Image placeholder with aspect ratio support.

**Props:**
- `aspectRatio?: '1/1' | '16/9' | '4/3' | '21/9' | string` - Aspect ratio (default: '16/9')
- `animation?: 'pulse' | 'wave' | 'none'`
- `className?: string`

**Usage:**
```tsx
// Product image
{isLoading ? (
  <ImageSkeleton aspectRatio="1/1" className="w-full" />
) : (
  <img src={product.image} alt={product.name} />
)}

// Banner
<ImageSkeleton aspectRatio="21/9" animation="wave" />
```

---

### BadgeSkeleton

Badge/tag placeholder.

**Props:**
- `animation?: 'pulse' | 'wave' | 'none'`
- `className?: string`

**Usage:**
```tsx
<div className="flex gap-2">
  {isLoading ? (
    <>
      <BadgeSkeleton />
      <BadgeSkeleton />
      <BadgeSkeleton />
    </>
  ) : (
    tags.map(tag => <Badge key={tag}>{tag}</Badge>)
  )}
</div>
```

---

### ChartSkeleton

Chart/graph placeholder for data visualizations.

**Props:**
- `variant?: 'bar' | 'line' | 'pie' | 'area'` - Chart type (default: 'bar')
- `animation?: 'pulse' | 'wave' | 'none'`
- `className?: string`

**Usage:**
```tsx
{isLoading ? (
  <ChartSkeleton variant="bar" animation="wave" />
) : (
  <BarChart data={chartData} />
)}
```

---

### NavbarSkeleton

Navigation bar placeholder.

**Props:**
- `animation?: 'pulse' | 'wave' | 'none'`
- `className?: string`

**Usage:**
```tsx
{isLoading ? <NavbarSkeleton /> : <Navbar items={navItems} />}
```

---

### ProfileHeaderSkeleton

User profile header with avatar, name, and bio.

**Props:**
- `animation?: 'pulse' | 'wave' | 'none'`
- `className?: string`

**Usage:**
```tsx
{isLoading ? <ProfileHeaderSkeleton /> : <ProfileHeader user={user} />}
```

---

### SkeletonGroup

Container for rendering multiple skeletons with staggered animation.

**Props:**
- `children: React.ReactNode` - Skeleton components to render
- `stagger?: number` - Delay in ms between animations (default: 0)
- `pauseOutOfView?: boolean` - Pause when out of viewport (default: false)
- `className?: string`

**Usage:**
```tsx
// Staggered list animation
<SkeletonGroup stagger={100} className="space-y-3">
  <ListItemSkeleton animation="wave" />
  <ListItemSkeleton animation="wave" />
  <ListItemSkeleton animation="wave" />
</SkeletonGroup>

// Card grid with stagger
<SkeletonGroup stagger={150} className="grid grid-cols-3 gap-4">
  <CardSkeleton animation="wave" />
  <CardSkeleton animation="wave" />
  <CardSkeleton animation="wave" />
</SkeletonGroup>
```

---

## Animation Types

### Pulse (Default)

Smooth opacity fade in/out. Best for most use cases.

```tsx
<CardSkeleton animation="pulse" />
```

### Wave (Shimmer)

Gradient sweep animation. Best for prominent loading states.

```tsx
<CardSkeleton animation="wave" />
```

**Performance notes:**
- GPU-accelerated
- Auto-adapts to theme
- Respects `prefers-reduced-motion`

### None

Static placeholder with no animation.

```tsx
<CardSkeleton animation="none" />
```

---

## Accessibility

### Screen Reader Support

All presets include proper ARIA labels:

```tsx
<div role="status" aria-label="Loading text content">
  <TextSkeleton lines={3} />
</div>
```

### Reduced Motion

Automatically respects user preferences:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-shimmer {
    animation: none;
    background: hsl(var(--muted));
  }
}
```

Users with reduced motion preferences see static placeholders or subtle pulse instead of wave animation.

### Keyboard Navigation

Skeleton components don't interfere with keyboard focus or tab order. When real content loads, focus management is preserved.

---

## Theme Support

All skeletons automatically adapt to the current theme:

### Light Themes (light, mid-light)
- Subtle gradient (10% opacity)
- Faster animation speed

### Dark Themes (dark, mid-dark)
- Stronger gradient (15% opacity)
- Same animation speed
- Enhanced visibility

```css
/* Auto-applied in globals.css */
[data-theme="dark"] .animate-shimmer,
[data-theme="mid-dark"] .animate-shimmer {
  background: linear-gradient(
    90deg,
    hsl(var(--muted)) 0%,
    hsl(var(--muted-foreground) / 0.15) 50%,
    hsl(var(--muted)) 100%
  );
}
```

---

## Usage Examples

### Dashboard Page

```tsx
function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <NavbarSkeleton animation="wave" />

        <div className="p-6">
          <TextSkeleton lines={1} className="w-1/3 mb-4" />
          <div className="grid grid-cols-4 gap-4">
            <StatSkeleton showTrend animation="wave" />
            <StatSkeleton showTrend animation="wave" />
            <StatSkeleton showTrend animation="wave" />
            <StatSkeleton showTrend animation="wave" />
          </div>
        </div>

        <div className="p-6">
          <SkeletonGroup stagger={100} className="grid grid-cols-3 gap-4">
            <CardSkeleton hasFooter animation="wave" />
            <CardSkeleton hasFooter animation="wave" />
            <CardSkeleton hasFooter animation="wave" />
          </SkeletonGroup>
        </div>
      </div>
    );
  }

  return <DashboardContent data={stats} />;
}
```

### Data Table

```tsx
function DataTable() {
  const { data, isLoading } = useTableData();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <TableRowSkeleton key={i} columns={4} animation="wave" />
          ))
        ) : (
          data.map(row => (
            <TableRow key={row.id}>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>{row.date}</TableCell>
              <TableCell>{row.actions}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
```

### User Profile

```tsx
function UserProfile({ userId }) {
  const { data: user, isLoading } = useUser(userId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <ProfileHeaderSkeleton animation="wave" />

        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <TextSkeleton lines={1} className="w-1/3" />
            </CardHeader>
            <CardContent>
              <TextSkeleton lines={5} animation="wave" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <TextSkeleton lines={1} className="w-1/3" />
            </CardHeader>
            <CardContent className="space-y-3">
              <ListItemSkeleton hasAvatar animation="wave" />
              <ListItemSkeleton hasAvatar animation="wave" />
              <ListItemSkeleton hasAvatar animation="wave" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return <UserProfileContent user={user} />;
}
```

### Form Loading

```tsx
function SettingsForm() {
  const { data: settings, isLoading } = useSettings();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <TextSkeleton lines={1} className="w-1/4" />
        </CardHeader>
        <CardContent className="space-y-4">
          <FormFieldSkeleton hasLabel animation="wave" />
          <FormFieldSkeleton hasLabel fieldType="textarea" animation="wave" />
          <FormFieldSkeleton hasLabel fieldType="select" animation="wave" />
          <div className="flex justify-end gap-2">
            <ButtonSkeleton />
            <ButtonSkeleton />
          </div>
        </CardContent>
      </Card>
    );
  }

  return <SettingsFormContent settings={settings} />;
}
```

---

## Best Practices

### 1. Match Final Layout

Ensure skeleton dimensions match the actual content:

```tsx
// BAD - Generic placeholder
{isLoading ? <div className="h-20 bg-muted" /> : <UserCard user={user} />}

// GOOD - Matches actual layout
{isLoading ? (
  <ListItemSkeleton hasAvatar hasAction />
) : (
  <UserCard user={user} />
)}
```

### 2. Use Wave Animation Sparingly

Reserve wave animation for prominent loading states:

```tsx
// Primary content - use wave
<CardSkeleton animation="wave" />

// Secondary content - use pulse
<BadgeSkeleton animation="pulse" />
```

### 3. Consistent Count

Show the same number of skeletons as expected items:

```tsx
// BAD - Always shows 3
{isLoading ? (
  Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
) : (
  items.map(item => <Card key={item.id} {...item} />)
)}

// GOOD - Shows expected count
const expectedCount = pageSize || 10;
{isLoading ? (
  Array.from({ length: expectedCount }).map((_, i) => <CardSkeleton key={i} />)
) : (
  items.map(item => <Card key={item.id} {...item} />)
)}
```

### 4. Avoid Skeleton Flashing

Add minimum loading delay to prevent quick flashes:

```tsx
const [showSkeleton, setShowSkeleton] = useState(false);

useEffect(() => {
  if (isLoading) {
    const timer = setTimeout(() => setShowSkeleton(true), 200);
    return () => clearTimeout(timer);
  }
  setShowSkeleton(false);
}, [isLoading]);

return showSkeleton ? <CardSkeleton /> : <Card data={data} />;
```

### 5. Semantic HTML

Maintain semantic structure even with skeletons:

```tsx
// GOOD - Preserves table structure
<Table>
  <TableBody>
    {isLoading ? (
      <TableRowSkeleton columns={4} />
    ) : (
      <TableRow>...</TableRow>
    )}
  </TableBody>
</Table>
```

### 6. Responsive Skeletons

Adapt skeleton count to viewport size:

```tsx
const skeletonCount = useBreakpointValue({ base: 2, md: 4, lg: 6 });

return (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {isLoading ? (
      Array.from({ length: skeletonCount }).map((_, i) => (
        <CardSkeleton key={i} animation="wave" />
      ))
    ) : (
      items.map(item => <Card key={item.id} {...item} />)
    )}
  </div>
);
```

### 7. Combine with Error States

Handle loading, error, and empty states:

```tsx
function DataList() {
  const { data, isLoading, error } = useData();

  if (isLoading) {
    return <SkeletonGroup stagger={100}>
      {Array.from({ length: 5 }).map((_, i) => (
        <ListItemSkeleton key={i} animation="wave" />
      ))}
    </SkeletonGroup>;
  }

  if (error) {
    return <ErrorMessage error={error} />;
  }

  if (!data.length) {
    return <EmptyState />;
  }

  return <List items={data} />;
}
```

---

## Performance Optimization

### 1. Use CSS Animations Only

All animations use pure CSS (no JavaScript):
- GPU-accelerated
- No re-renders
- Minimal CPU usage

### 2. Stagger for Perception of Speed

Use `SkeletonGroup` with stagger to create perception of progressive loading:

```tsx
<SkeletonGroup stagger={50} className="space-y-2">
  {items.map((_, i) => <ListItemSkeleton key={i} animation="wave" />)}
</SkeletonGroup>
```

### 3. Lazy Load Below Fold

Don't render skeletons for content below the fold:

```tsx
const isInView = useInView(ref);

return (
  <div ref={ref}>
    {isInView && isLoading ? <CardSkeleton /> : null}
  </div>
);
```

---

## Migration from Old Patterns

### Before (Manual Skeletons)

```tsx
{isLoading ? (
  <div className="animate-pulse space-y-2">
    <div className="h-4 bg-muted rounded w-3/4"></div>
    <div className="h-4 bg-muted rounded w-1/2"></div>
  </div>
) : (
  <Content />
)}
```

### After (Using Presets)

```tsx
{isLoading ? (
  <TextSkeleton lines={2} animation="wave" />
) : (
  <Content />
)}
```

---

## Related Documentation

- [Base Skeleton Component](./skeleton.tsx)
- [Domain-Specific Skeletons](../skeletons/README.md)
- [Storybook Examples](./skeleton-presets.stories.tsx)
- [Theme System](../../styles/globals.css)

---

## Support

For questions or issues:
1. Check [Storybook documentation](http://localhost:27250/?path=/docs/ui-skeleton-presets)
2. Review [existing skeletons](../skeletons/)
3. Contact the frontend team
