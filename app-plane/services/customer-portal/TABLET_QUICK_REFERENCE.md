# Tablet Optimization - Quick Reference

One-page reference for common tablet optimization patterns.

## Import Paths

```tsx
// Hooks
import {
  useOrientation,
  useIsTablet,
  useTouchDevice,
  useSwipeActions,
  useTabletNavigation,
  useSafeAreaInsets,
} from '@/hooks';

// Layout Components
import {
  ResponsiveContainer,
  ResponsiveTable,
  TabletNavigation,
} from '@/components/layout';

// Shared Components
import {
  SwipeableCard,
  TouchTarget,
  BOMCard,
} from '@/components/shared';
```

## Common Patterns

### 1. Convert Table to Card Grid

```tsx
// Before: Desktop-only table
<DataGrid rows={rows} columns={columns} />

// After: Responsive table/cards
<ResponsiveTable
  rows={rows}
  columns={columns}
  renderCard={(row) => <BOMCard data={row} />}
/>
```

### 2. Touch-Friendly Buttons

```tsx
// Before: Small button
<IconButton onClick={handleClick}>
  <DeleteIcon />
</IconButton>

// After: 48px minimum touch target
<TouchTarget onClick={handleClick} size="md" ariaLabel="Delete">
  <DeleteIcon />
</TouchTarget>
```

### 3. Swipe Actions on Cards

```tsx
<SwipeableCard
  swipeConfig={{
    leftActions: [{ label: 'Delete', onAction: handleDelete }],
    rightActions: [{ label: 'Archive', onAction: handleArchive }],
  }}
>
  <CardContent />
</SwipeableCard>
```

### 4. Orientation-Aware Layout

```tsx
const { isPortrait } = useOrientation();

return isPortrait ? <StackedLayout /> : <SideBySideLayout />;
```

### 5. Device-Specific Rendering

```tsx
const { isTablet, isMobile, isDesktop } = useTouchDevice();

if (isTablet) return <TabletView />;
if (isMobile) return <MobileView />;
return <DesktopView />;
```

### 6. Safe Area Padding (Notch)

```tsx
const insets = useSafeAreaInsets();

<Box sx={{ paddingTop: `${insets.top}px` }}>
  Content below notch
</Box>

// Or use CSS class
<div className="safe-area-top">Content</div>
```

## CSS Classes

### Touch Targets
```css
.touch-target       /* 48x48px (recommended) */
.touch-target-sm    /* 44x44px (iOS minimum) */
.touch-target-lg    /* 56x56px (comfortable) */
```

### Layouts
```css
.tablet-container      /* Responsive max-width */
.tablet-card-grid      /* Auto-responsive grid */
.tablet-scroll         /* Smooth momentum scrolling */
```

### Orientation
```css
.hide-portrait         /* Hide in portrait */
.hide-landscape        /* Hide in landscape */
```

### Safe Areas
```css
.safe-area-top         /* Notch padding */
.safe-area-bottom      /* Home indicator padding */
.safe-area-all         /* All edges */
```

## Breakpoints

```javascript
// Tailwind breakpoints
sm:   640px   // Mobile landscape
md:   768px   // Tablet portrait (iPad Mini)
lg:   1024px  // Tablet landscape (iPad Pro 11")
xl:   1280px  // Desktop / iPad Pro 12.9" landscape
2xl:  1536px  // Large desktop
```

## Touch Target Sizes

| Size | Pixels | Use Case |
|------|--------|----------|
| sm   | 44x44  | iOS minimum (compact UI) |
| md   | 48x48  | Recommended (default) |
| lg   | 56x56  | Comfortable (primary actions) |

## Testing Shortcuts

### Chrome DevTools
```
1. F12 - Open DevTools
2. Ctrl+Shift+M - Toggle device toolbar
3. Select "iPad Pro"
4. Test portrait/landscape
5. Enable touch simulation
```

### Quick Device Checks
```tsx
// In component
const { isTablet } = useIsTablet();
console.log('Is tablet:', isTablet);

// Check orientation
const { isPortrait } = useOrientation();
console.log('Portrait:', isPortrait);
```

## Swipe Gesture Config

```tsx
const swipeConfig = {
  leftActions: [
    {
      label: 'Delete',
      icon: <DeleteIcon />,
      color: '#d32f2f',
      onAction: async () => {
        await deleteItem();
      },
    },
  ],
  rightActions: [
    {
      label: 'Archive',
      icon: <ArchiveIcon />,
      color: '#2e7d32',
      onAction: async () => {
        await archiveItem();
      },
    },
  ],
  threshold: 80,        // Min swipe distance (default: 80px)
  snapThreshold: 50,    // Snap distance (default: 50px)
};
```

## Navigation Items

```tsx
const navItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <DashboardIcon />,
    path: '/',
  },
  {
    id: 'boms',
    label: 'BOMs',
    icon: <InventoryIcon />,
    path: '/boms',
    badge: 3,              // Show notification badge
  },
  {
    id: 'divider1',
    divider: true,         // Render divider
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <SettingsIcon />,
    onClick: () => openSettings(),  // Custom handler
  },
];
```

## Grid Column Config

```tsx
// Card grid behavior
.tablet-card-grid {
  // Mobile: 1 column
  // Tablet Portrait: 1 column
  // Tablet Landscape: 2 columns
  // Desktop: 3 columns
}

// Custom grid
<Box sx={{
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',                    // Mobile: 1 col
    md: '1fr',                    // Tablet portrait: 1 col
    lg: 'repeat(2, 1fr)',         // Tablet landscape: 2 cols
    xl: 'repeat(3, 1fr)',         // Desktop: 3 cols
  },
  gap: 2,
}} />
```

## Accessibility Checklist

- [ ] Touch targets ≥48px
- [ ] aria-label on interactive elements
- [ ] Focus visible on keyboard nav
- [ ] VoiceOver announces actions
- [ ] Color contrast ≥4.5:1
- [ ] Reduced motion support
- [ ] Keyboard accessible (Tab, Enter, Escape)

## Performance Tips

```tsx
// Use RAF for smooth animations
const animate = () => {
  requestAnimationFrame(() => {
    // Update animation
  });
};

// Debounce resize handlers
useEffect(() => {
  let timeoutId: number;
  const handleResize = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      // Handle resize
    }, 100);
  };
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);

// Lazy load cards in long lists
import { Virtuoso } from 'react-virtuoso';

<Virtuoso
  data={items}
  itemContent={(index, item) => <BOMCard data={item} />}
/>
```

## Common Mistakes

### ❌ Don't Do This
```tsx
// Hard-coded sizes
<button style={{ width: '30px', height: '30px' }}>X</button>

// No touch support check
if (window.innerWidth < 768) { /* mobile */ }

// Missing aria-label
<IconButton onClick={handleDelete}>
  <DeleteIcon />
</IconButton>
```

### ✅ Do This Instead
```tsx
// Use TouchTarget with proper size
<TouchTarget onClick={handleDelete} size="md" ariaLabel="Delete item">
  <DeleteIcon />
</TouchTarget>

// Use hooks for device detection
const { isTablet } = useIsTablet();

// Always add aria-label
<IconButton onClick={handleDelete} aria-label="Delete item">
  <DeleteIcon />
</IconButton>
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Swipe not working | Add `touch-action: pan-y` CSS |
| Layout not reflowing | Check orientation hook is firing |
| Touch targets too small | Wrap in `<TouchTarget>` |
| Tailwind classes not working | Import `./index.css` in main.tsx |
| Cards overlapping | Use `tablet-card-grid` class |
| Sidebar not closing | Check `data-tablet-sidebar` attribute |

## Links

- Full Documentation: `TABLET_OPTIMIZATION.md`
- Integration Guide: `INTEGRATION_STEPS.md`
- File List: `TABLET_FILES_SUMMARY.md`
- Example Page: `src/pages/examples/TabletOptimizedBOMList.tsx`

---

**Pro Tip:** Always test on real iPad devices. DevTools emulation is good for layout, but gestures and performance differ on actual hardware.
