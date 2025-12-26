# Tablet Optimization - Integration Steps

This guide provides step-by-step instructions to integrate tablet-optimized layouts into the CBP application.

## Prerequisites

- Node.js 20+ or Bun 1.1+
- Existing customer-portal codebase
- Material-UI already installed

## Step 1: Install Dependencies

```bash
cd app-plane/services/customer-portal

# Install Tailwind CSS and dependencies
npm install -D tailwindcss@latest postcss@latest autoprefixer@latest

# Or with Bun
bun add -D tailwindcss postcss autoprefixer
```

## Step 2: Verify Configuration Files

The following files have been created:

- ✅ `tailwind.config.js` - Tailwind configuration with tablet breakpoints
- ✅ `postcss.config.js` - PostCSS configuration
- ✅ `src/styles/tablet.css` - Tablet-specific CSS classes

## Step 3: Import Tablet Styles

Add the tablet CSS to your main entry point:

**Option A: In `src/main.tsx`**
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tablet.css'; // Add this line

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Option B: In `src/App.tsx`**
```tsx
import './styles/tablet.css'; // Add at top of imports
```

## Step 4: Add Tailwind Directives

Create or update `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Then import it in `src/main.tsx`:
```tsx
import './index.css';
import './styles/tablet.css';
```

## Step 5: Update HTML Meta Tag (Important for Safe Areas)

Update `index.html` to support safe area insets:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <!-- Note: viewport-fit=cover enables safe-area-inset-* -->
    <title>CBP - Customer Business Portal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## Step 6: Convert BOM List Page

Update your BOM list page to use responsive table:

**Before:**
```tsx
// pages/BOMs.tsx
import { DataGrid } from '@mui/x-data-grid';

export function BOMsPage() {
  return (
    <DataGrid
      rows={boms}
      columns={columns}
      onRowClick={(params) => navigate(`/boms/${params.id}`)}
    />
  );
}
```

**After:**
```tsx
// pages/BOMs.tsx
import { ResponsiveTable } from '@/components/layout';
import { BOMCard } from '@/components/shared';

export function BOMsPage() {
  return (
    <ResponsiveTable
      rows={boms}
      columns={columns}
      onRowClick={(row) => navigate(`/boms/${row.id}`)}
      renderCard={(row) => (
        <BOMCard
          data={row}
          onView={() => navigate(`/boms/${row.id}`)}
          onEnrich={() => handleEnrich(row.id)}
          onExport={() => handleExport(row.id)}
          onDelete={() => handleDelete(row.id)}
          showSwipeActions
        />
      )}
    />
  );
}
```

## Step 7: Add Touch Targets to Action Buttons

Replace small IconButtons with TouchTarget:

**Before:**
```tsx
<IconButton onClick={handleDelete}>
  <DeleteIcon />
</IconButton>
```

**After:**
```tsx
import { TouchTarget } from '@/components/shared';

<TouchTarget onClick={handleDelete} size="md" ariaLabel="Delete item">
  <DeleteIcon />
</TouchTarget>
```

## Step 8: Implement Tablet Navigation (Optional)

If you want to use the adaptive sidebar navigation:

```tsx
// App.tsx or Layout.tsx
import { TabletNavigation } from '@/components/layout';
import { Dashboard, Inventory, Settings } from '@mui/icons-material';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <Dashboard />, path: '/' },
  { id: 'boms', label: 'BOMs', icon: <Inventory />, path: '/boms' },
  { id: 'settings', label: 'Settings', icon: <Settings />, path: '/settings' },
];

export function Layout() {
  const navigate = useNavigate();

  return (
    <>
      <TabletNavigation
        items={navItems}
        activeId="dashboard"
        onNavigate={(item) => navigate(item.path!)}
        logo={<Logo />}
      />
      <main>
        <Outlet />
      </main>
    </>
  );
}
```

## Step 9: Test on Tablet Devices

### Chrome DevTools Testing
1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select "iPad Pro" from device dropdown
4. Test both portrait and landscape orientations
5. Enable touch simulation

### Real Device Testing
1. Connect iPad to same network
2. Start dev server: `npm run dev`
3. Note the local IP (e.g., `http://192.168.1.100:5173`)
4. Open in Safari on iPad
5. Test swipe gestures, touch targets, orientation changes

## Step 10: Verify Accessibility

Run these checks:

### VoiceOver Testing (iOS)
1. Settings > Accessibility > VoiceOver > On
2. Navigate with swipe gestures
3. Verify all buttons announce correctly
4. Test swipe actions are announced

### Keyboard Testing
1. Connect keyboard to iPad
2. Tab through all interactive elements
3. Verify focus indicators are visible
4. Test Escape key closes drawers/modals

## Troubleshooting

### Tailwind classes not working
**Solution:** Ensure `index.css` with Tailwind directives is imported in `main.tsx`

```tsx
// main.tsx
import './index.css'; // Must come first
import './styles/tablet.css';
```

### Swipe gestures not responding
**Solution:** Check touch-action CSS property:
```css
.swipeable-card {
  touch-action: pan-y; /* Allows vertical scroll, enables horizontal swipe */
}
```

### Cards not reflowing on orientation change
**Solution:** Verify orientation hook is working:
```tsx
import { useOrientation } from '@/hooks';

const { isPortrait } = useOrientation();
console.log('Orientation:', isPortrait ? 'portrait' : 'landscape');
```

### Touch targets too small
**Solution:** Use TouchTarget wrapper or add CSS classes:
```tsx
<button className="touch-target">Click me</button>
```

## Rollback Plan

If you need to rollback tablet optimizations:

1. Remove tablet CSS import:
```tsx
// main.tsx
// import './styles/tablet.css'; // Comment out
```

2. Revert to original table components:
```tsx
// Replace ResponsiveTable with DataGrid
<DataGrid rows={rows} columns={columns} />
```

3. Remove Tailwind if not used elsewhere:
```bash
npm uninstall tailwindcss postcss autoprefixer
rm tailwind.config.js postcss.config.js
```

## Performance Monitoring

After integration, monitor these metrics:

- **Tablet Usage:** Should increase from 8% to 25%
- **Orientation Change:** Should complete in <100ms
- **Touch Target Success Rate:** Should be >95%
- **Swipe Gesture Response:** Should be <16ms (60fps)

Use browser Performance API to measure:

```tsx
const startTime = performance.now();
// Orientation change or interaction
const duration = performance.now() - startTime;
console.log(`Operation took ${duration}ms`);
```

## Next Steps

After basic integration:

1. **Add swipe actions to all list views**
   - Component list
   - Alert list
   - Project list

2. **Implement tablet-specific features**
   - Pinch-to-zoom for charts
   - Long-press context menus
   - Drag-and-drop reordering

3. **Optimize performance**
   - Virtual scrolling for long lists
   - Lazy loading for card grids
   - Image optimization for thumbnails

4. **Test on real devices**
   - iPad Mini (smallest supported)
   - iPad Pro 11" (primary target)
   - iPad Pro 12.9" (largest tablet)

## Support

For questions or issues:
1. Check `TABLET_OPTIMIZATION.md` for detailed documentation
2. Review component source code in `src/components/layout/` and `src/components/shared/`
3. Test on actual iPad device
4. Contact development team

## Checklist

Use this checklist to track integration progress:

- [ ] Step 1: Installed Tailwind dependencies
- [ ] Step 2: Verified config files exist
- [ ] Step 3: Imported tablet.css
- [ ] Step 4: Added Tailwind directives
- [ ] Step 5: Updated HTML meta tag
- [ ] Step 6: Converted BOM list page
- [ ] Step 7: Updated action buttons with TouchTarget
- [ ] Step 8: Implemented tablet navigation (optional)
- [ ] Step 9: Tested on tablet devices
- [ ] Step 10: Verified accessibility
- [ ] Monitoring tablet usage metrics
- [ ] All touch targets ≥48px
- [ ] No horizontal scroll on tablet
- [ ] Swipe gestures working
- [ ] Orientation changes smooth
