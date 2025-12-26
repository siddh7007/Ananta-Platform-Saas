# Card Component Enhancements - CBP-P4-003

## Overview
Enhanced the Card component with elevation, hover variants, status indicators, loading states, and clickable interactions using class-variance-authority (cva).

## Implementation Details

### Files Modified
1. **card.tsx** - Enhanced Card component with new variants
2. **card.stories.tsx** - Updated Storybook stories showcasing all variants

### Files Created
1. **card.examples.tsx** - Comprehensive example page demonstrating all features

## New Features

### 1. Elevation Variants
Controls shadow depth for visual hierarchy:
- `none` - No shadow
- `flat` - shadow-sm (default)
- `raised` - shadow-md
- `floating` - shadow-lg

```tsx
<Card elevation="raised">
  <CardContent>Raised card</CardContent>
</Card>
```

### 2. Hover Variants
Interactive hover effects:
- `none` - No hover effect (default)
- `lift` - Lifts card up on hover with enhanced shadow
- `glow` - Adds primary color glow on hover
- `scale` - Slightly scales up card on hover

```tsx
<Card elevation="raised" hover="lift">
  <CardContent>Hover to see lift effect</CardContent>
</Card>
```

### 3. Clickable Interaction
Makes card appear interactive with cursor and scale feedback:

```tsx
<Card clickable hover="lift" onClick={() => navigate('/detail')}>
  <CardContent>Clickable card</CardContent>
</Card>
```

### 4. Status Indicators
Colored left border for semantic states:
- `success` - Green border
- `warning` - Yellow border
- `error` - Red border
- `info` - Blue border

```tsx
<Card status="success">
  <CardContent>Success message</CardContent>
</Card>
```

### 5. Loading State
Shows overlay with animated spinner:

```tsx
<Card loading={isLoading}>
  <CardContent>
    {!isLoading && <p>Content here</p>}
  </CardContent>
</Card>
```

## TypeScript Interface

```typescript
export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  loading?: boolean;
}

// Variant props from cva:
type CardVariants = {
  elevation?: 'none' | 'flat' | 'raised' | 'floating';
  hover?: 'none' | 'lift' | 'glow' | 'scale';
  clickable?: boolean;
  status?: 'success' | 'warning' | 'error' | 'info';
}
```

## Backward Compatibility
All existing Card usage continues to work without changes:
- Default values maintain original appearance (elevation="flat", hover="none")
- className prop still works for custom styling
- All existing Card subcomponents unchanged (CardHeader, CardTitle, etc.)

## Usage Examples

### Basic Card (Original Behavior)
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

### Interactive BOM Card
```tsx
<Card
  elevation="raised"
  hover="lift"
  clickable
  onClick={() => navigate(`/boms/${bomId}`)}
>
  <CardHeader>
    <CardTitle>PCB Assembly v2.1</CardTitle>
    <CardDescription>47 line items</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Enrichment: 92%</p>
  </CardContent>
</Card>
```

### Error Notification
```tsx
<Card elevation="raised" status="error">
  <CardHeader>
    <CardTitle>Build Failed</CardTitle>
  </CardHeader>
  <CardContent>
    <p>The build process encountered errors.</p>
  </CardContent>
  <CardFooter>
    <Button variant="destructive">View Logs</Button>
  </CardFooter>
</Card>
```

### Loading State
```tsx
<Card elevation="raised" loading={isFetching}>
  <CardHeader>
    <CardTitle>Subscription Details</CardTitle>
  </CardHeader>
  <CardContent>
    {!isFetching && <SubscriptionInfo />}
  </CardContent>
</Card>
```

### Combined Variants
```tsx
<Card
  elevation="floating"
  hover="glow"
  status="success"
  clickable
  onClick={handleClick}
>
  <CardHeader>
    <CardTitle>Project Status</CardTitle>
  </CardHeader>
  <CardContent>
    <p>All checks passed!</p>
  </CardContent>
</Card>
```

## Storybook Stories
The following stories are available in Storybook:

1. **Default** - Basic card with default settings
2. **Raised** - Raised elevation example
3. **Floating** - Floating elevation example
4. **HoverLift** - Lift hover effect
5. **HoverGlow** - Glow hover effect
6. **HoverScale** - Scale hover effect
7. **Clickable** - Clickable interaction example
8. **StatusSuccess** - Success status indicator
9. **StatusWarning** - Warning status indicator
10. **StatusError** - Error status indicator
11. **StatusInfo** - Info status indicator
12. **Loading** - Loading state overlay
13. **SubscriptionCard** - Real-world subscription example
14. **BomCard** - Real-world BOM example with hover
15. **ErrorNotification** - Real-world error card
16. **Playground** - Interactive testing environment

## Testing
Run Storybook to see all variants in action:
```bash
cd arc-saas/apps/customer-portal
bun run storybook
```

## Technical Notes

### Dependencies
- Uses `class-variance-authority` (already installed)
- No additional dependencies required

### Performance
- All variants use CSS classes only (no JavaScript)
- Transition animations use CSS `transition-all duration-200`
- Loading overlay uses absolute positioning with z-index management

### Accessibility
- Maintains semantic HTML structure
- Clickable cards automatically get cursor-pointer
- Loading state uses proper overlay technique
- All animations respect user's motion preferences

### CSS Classes Used
- Elevation: Tailwind shadow utilities
- Hover effects: Tailwind hover variants with transitions
- Status borders: Tailwind border utilities with semantic colors
- Loading overlay: Backdrop blur with animated spinner

## Related Files
- Component: `src/components/ui/card.tsx`
- Stories: `src/components/ui/card.stories.tsx`
- Examples: `src/components/ui/card.examples.tsx`
- Documentation: This file
