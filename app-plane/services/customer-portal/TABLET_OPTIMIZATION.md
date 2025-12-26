# Tablet Optimization Guide

This document describes the tablet-optimized components and patterns for the CBP (Customer Business Portal) application, targeting iPad users.

## Overview

The tablet optimization provides native iPad experiences with:
- Responsive layouts that adapt to portrait/landscape
- Touch-friendly 48px minimum touch targets
- Swipe gestures for common actions
- Optimized for iPad Pro 11" and 12.9"

**Target:** Increase tablet usage from 8% to 25% (Sarah's iPad workflow)

## Architecture

### CSS Framework
- **Tailwind CSS** with custom tablet breakpoints
- **Material-UI (MUI)** for component primitives
- Custom CSS for tablet-specific interactions

### Breakpoints
```javascript
screens: {
  'sm': '640px',      // Mobile landscape
  'md': '768px',      // Tablet portrait (iPad Mini)
  'lg': '1024px',     // Tablet landscape (iPad Pro 11")
  'xl': '1280px',     // Desktop / iPad Pro 12.9" landscape
  '2xl': '1536px',    // Large desktop
  // Custom
  'tablet': '768px',
  'tablet-lg': '1024px',
}
```

## Components

### Layout Components

#### ResponsiveContainer
Switches between desktop, tablet, and mobile layouts based on device type.

```tsx
import { ResponsiveContainer } from '@/components/layout';

<ResponsiveContainer
  desktopLayout={<DesktopTable />}
  tabletLayout={<TabletCardGrid />}
  mobileLayout={<MobileList />}
/>
```

#### ResponsiveTable
Automatically switches between DataGrid table (desktop) and card grid (tablet/mobile).

```tsx
import { ResponsiveTable } from '@/components/layout';

<ResponsiveTable
  rows={bomData}
  columns={columnDefs}
  onRowClick={handleRowClick}
  renderCard={(row) => <BOMCard data={row} />}
/>
```

Behavior:
- **Desktop:** Traditional DataGrid table
- **Tablet Landscape:** 2-column card grid
- **Tablet Portrait:** 1-column card grid
- **Mobile:** Full-width cards

#### TabletNavigation
Adaptive navigation sidebar.

```tsx
import { TabletNavigation } from '@/components/layout';

<TabletNavigation
  items={navItems}
  activeId="dashboard"
  onNavigate={handleNavigate}
  logo={<Logo />}
/>
```

Behavior:
- **Portrait:** Hamburger menu with overlay drawer
- **Landscape:** Slim sidebar (icons only, expand on hover)

### Shared Components

#### SwipeableCard
Card with swipe gesture support for quick actions.

```tsx
import { SwipeableCard } from '@/components/shared';

<SwipeableCard
  swipeConfig={{
    leftActions: [
      { label: 'Delete', icon: <DeleteIcon />, onAction: handleDelete }
    ],
    rightActions: [
      { label: 'Archive', icon: <ArchiveIcon />, onAction: handleArchive }
    ],
  }}
  onClick={handleView}
>
  <BOMCardContent data={bom} />
</SwipeableCard>
```

Gestures:
- **Swipe left:** Show left actions (destructive actions)
- **Swipe right:** Show right actions (archive, mark as read)

#### TouchTarget
Ensures minimum touch target size for accessibility.

```tsx
import { TouchTarget } from '@/components/shared';

<TouchTarget onClick={handleClick} size="md" ariaLabel="Delete item">
  <DeleteIcon />
</TouchTarget>
```

Sizes:
- `sm`: 44x44px (iOS minimum)
- `md`: 48x48px (recommended)
- `lg`: 56x56px (comfortable)

#### BOMCard
Tablet-optimized card for BOM list items.

```tsx
import { BOMCard } from '@/components/shared';

<BOMCard
  data={bomData}
  onView={handleView}
  onEnrich={handleEnrich}
  onExport={handleExport}
  onDelete={handleDelete}
  showSwipeActions
/>
```

Features:
- Risk level indicator
- Enrichment progress bar
- Last updated timestamp
- Quick action buttons
- Swipe-to-delete/archive

## Hooks

### useOrientation
Detects device orientation (portrait/landscape).

```tsx
import { useOrientation, useIsPortrait } from '@/hooks';

const { orientation, isPortrait, isLandscape } = useOrientation();

if (isPortrait) {
  return <PortraitLayout />;
}
return <LandscapeLayout />;
```

### useTouchDevice
Detects device type and touch capabilities.

```tsx
import { useTouchDevice, useIsTablet } from '@/hooks';

const { isTouchDevice, isTablet, supportsHover } = useTouchDevice();

if (isTablet) {
  return <TabletLayout />;
}
```

### useSafeAreaInsets
Gets safe area insets for devices with notches.

```tsx
import { useSafeAreaInsets } from '@/hooks';

const insets = useSafeAreaInsets();

<div style={{ paddingTop: insets.top }}>
  Content below notch
</div>
```

### useTabletNavigation
Manages tablet navigation state.

```tsx
import { useTabletNavigation } from '@/hooks';

const nav = useTabletNavigation();

<button onClick={nav.toggle}>Menu</button>
<Sidebar isOpen={nav.isOpen} isExpanded={nav.isExpanded} />
```

### useSwipeActions
Handles swipe gestures for card actions.

```tsx
import { useSwipeActions } from '@/hooks';

const { swipeState, handlers, reset } = useSwipeActions({
  leftActions: [{ label: 'Delete', onAction: handleDelete }],
  rightActions: [{ label: 'Archive', onAction: handleArchive }],
});

<div {...handlers} style={{ transform: `translateX(${swipeState.offset}px)` }}>
  Card content
</div>
```

## CSS Classes

### Touch-Friendly Interactions
```css
.tablet-scroll          /* Smooth scrolling with momentum */
.tablet-no-select       /* Prevent text selection */
.touch-target           /* 48x48px minimum touch target */
.touch-target-sm        /* 44x44px touch target */
.touch-target-lg        /* 56x56px touch target */
```

### Safe Area Support
```css
.safe-area-top          /* Padding for notch */
.safe-area-bottom       /* Padding for home indicator */
.safe-area-left         /* Padding for left edge */
.safe-area-right        /* Padding for right edge */
.safe-area-all          /* Padding for all edges */
```

### Layout Utilities
```css
.tablet-container       /* Responsive container */
.tablet-card-grid       /* Responsive card grid */
.tablet-scroll-container /* Scrollable container */
```

### Orientation-Specific
```css
.hide-portrait          /* Hide in portrait mode */
.hide-landscape         /* Hide in landscape mode */
.full-width-portrait    /* Full width in portrait */
.sidebar-landscape      /* Show sidebar in landscape */
```

### Swipe Gestures
```css
.swipeable-card         /* Card with swipe support */
.swipe-actions          /* Swipe action buttons */
.swipe-actions-left     /* Left swipe actions */
.swipe-actions-right    /* Right swipe actions */
```

## Integration Steps

### 1. Install Tailwind CSS
```bash
cd app-plane/services/customer-portal
npm install -D tailwindcss postcss autoprefixer
```

### 2. Import Tablet Styles
Add to `src/main.tsx` or `src/App.tsx`:
```tsx
import './styles/tablet.css';
```

### 3. Update Existing Pages
Convert existing table views to use ResponsiveTable:

**Before:**
```tsx
<DataGrid rows={rows} columns={columns} />
```

**After:**
```tsx
<ResponsiveTable
  rows={rows}
  columns={columns}
  renderCard={(row) => <BOMCard data={row} />}
/>
```

### 4. Add Swipe Actions
Wrap cards in SwipeableCard:

```tsx
<SwipeableCard
  swipeConfig={{
    leftActions: [{ label: 'Delete', onAction: handleDelete }],
    rightActions: [{ label: 'Archive', onAction: handleArchive }],
  }}
>
  <BOMCard data={bom} />
</SwipeableCard>
```

### 5. Ensure Touch Targets
Replace small buttons with TouchTarget:

```tsx
// Before
<IconButton onClick={handleDelete}>
  <DeleteIcon />
</IconButton>

// After
<TouchTarget onClick={handleDelete} ariaLabel="Delete">
  <DeleteIcon />
</TouchTarget>
```

## Testing

### Device Testing Matrix
| Device | Orientation | Resolution | Test Focus |
|--------|-------------|------------|------------|
| iPad Mini | Portrait | 768x1024 | Minimum size, card layout |
| iPad Mini | Landscape | 1024x768 | 2-column grid |
| iPad Pro 11" | Portrait | 834x1194 | Primary target |
| iPad Pro 11" | Landscape | 1194x834 | Full experience |
| iPad Pro 12.9" | Portrait | 1024x1366 | Large tablet |
| iPad Pro 12.9" | Landscape | 1366x1024 | Near-desktop |

### Test Checklist
- [ ] No horizontal scroll on any view
- [ ] All touch targets ≥48px
- [ ] Swipe gestures work smoothly
- [ ] Orientation change reflows instantly (<100ms)
- [ ] VoiceOver announces swipe actions
- [ ] Reduced motion disables animations
- [ ] Text scaling doesn't break layout
- [ ] Hover states work with trackpad

### Manual Testing
```bash
# Start dev server
npm run dev

# Open in browser
# 1. Open DevTools (F12)
# 2. Toggle device toolbar (Ctrl+Shift+M)
# 3. Select "iPad Pro" or "iPad Mini"
# 4. Test portrait and landscape
# 5. Enable touch simulation
```

### Automated Tests
```bash
# Run unit tests
npm test

# Run specific hook tests
npm test useOrientation
npm test useTouchDevice
npm test useSwipeActions
```

## Performance

### Optimization Tips
1. **Use RAF for animations:** All swipe animations use `requestAnimationFrame`
2. **Avoid layout thrashing:** Batch DOM reads and writes
3. **Lazy load cards:** Use virtual scrolling for long lists
4. **Debounce resize handlers:** Orientation changes are debounced
5. **Reduce motion:** Respect `prefers-reduced-motion` media query

### Metrics
- **Initial load:** <3s on iPad Pro
- **Orientation change:** <100ms reflow
- **Swipe response:** <16ms (60fps)
- **Touch target accuracy:** >95% success rate

## Accessibility

### WCAG 2.1 Level AA Compliance
- ✅ Touch targets minimum 44x44px (WCAG 2.5.5)
- ✅ VoiceOver support for all interactions
- ✅ Keyboard navigation (tab, arrow keys, escape)
- ✅ Focus visible indicators (2px outline)
- ✅ Color contrast ratio ≥4.5:1
- ✅ Text resizing up to 200% without layout break
- ✅ Reduced motion support

### VoiceOver Testing
1. Enable VoiceOver: Settings > Accessibility > VoiceOver
2. Swipe right to navigate between elements
3. Double-tap to activate
4. Two-finger swipe up to read all
5. Test swipe actions are announced

## Browser Support

| Browser | Version | Notes |
|---------|---------|-------|
| Safari (iOS) | 15+ | Primary target |
| Chrome (iOS) | Latest | Uses Safari engine |
| Edge (iOS) | Latest | Uses Safari engine |
| Firefox (iOS) | Latest | Uses Safari engine |

## Known Limitations

1. **Swipe conflicts:** May conflict with browser back/forward gestures (use `touch-action: pan-y`)
2. **Hover states:** Limited on touch-only devices (use `:active` for touch feedback)
3. **Notch detection:** Safe area insets require `viewport-fit=cover` in meta tag
4. **Text selection:** Disabled on swipeable cards (prevents gesture conflicts)

## Troubleshooting

### Swipe gestures not working
- Check `touch-action: pan-y` is set
- Verify handlers are attached to correct element
- Test in actual device (not just DevTools)

### Cards not reflowing on orientation change
- Verify CSS Grid is using responsive units
- Check orientation event listeners are attached
- Test with actual rotation (not just resize)

### Touch targets too small
- Use TouchTarget wrapper component
- Check computed styles in DevTools
- Verify Tailwind classes are applied

### Navigation drawer not closing
- Check click-outside handler is attached
- Verify escape key handler is working
- Test `data-tablet-sidebar` attribute is present

## Future Enhancements

- [ ] Pinch-to-zoom for charts
- [ ] Long-press context menus
- [ ] Multi-touch gestures (two-finger pan)
- [ ] Apple Pencil support for annotations
- [ ] Split-view multitasking support
- [ ] Drag-and-drop reordering

## Resources

- [Apple Human Interface Guidelines - iPadOS](https://developer.apple.com/design/human-interface-guidelines/ios)
- [Touch Target Size Best Practices](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [CSS Touch Action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Material-UI Documentation](https://mui.com/)

## Support

For issues or questions about tablet optimization:
1. Check this documentation
2. Review component source code
3. Test on actual iPad device
4. Contact development team
