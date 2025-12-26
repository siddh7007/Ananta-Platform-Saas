# SwipeableBomRow Component

## Overview

A touch-friendly row component that enables swipe-to-reveal actions for BOM (Bill of Materials) entries. Designed for mobile-first experiences with smooth animations and intuitive gestures.

## Features

- **Swipe Left**: Reveals action buttons (Share, Edit, Delete)
- **Swipe Right**: Hides action buttons
- **Smooth Animations**: Easing and snap-to-state behavior
- **Touch Optimized**: Configurable thresholds for reliable gesture detection
- **Pointer Events**: Works with both touch and mouse interactions
- **Accessible**: Keyboard navigation and screen reader support
- **Auto-close**: Closes actions after action execution or clicking outside
- **Visual Feedback**: Subtle swipe indicator when actions are hidden

## Installation

The component uses a custom `useSwipeGesture` hook as a fallback implementation. For production use, you may want to install `react-swipeable`:

```bash
bun add react-swipeable
# or
npm install react-swipeable
```

## Usage

### Basic Example

```tsx
import { SwipeableBomRow } from '@/components/bom/SwipeableBomRow';
import type { Bom } from '@/types/bom';

function BomList({ boms }: { boms: Bom[] }) {
  const handleEdit = (bom: Bom) => {
    console.log('Edit BOM:', bom.id);
  };

  const handleDelete = (bom: Bom) => {
    console.log('Delete BOM:', bom.id);
  };

  const handleShare = (bom: Bom) => {
    console.log('Share BOM:', bom.id);
  };

  return (
    <div className="divide-y">
      {boms.map((bom) => (
        <SwipeableBomRow
          key={bom.id}
          bom={bom}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onShare={handleShare}
        >
          <div className="p-4">
            <h3 className="font-medium">{bom.name}</h3>
            <p className="text-sm text-muted-foreground">
              {bom.lineCount} lines
            </p>
          </div>
        </SwipeableBomRow>
      ))}
    </div>
  );
}
```

### With Navigation

```tsx
import { useNavigate } from 'react-router-dom';

function BomList({ boms }: { boms: Bom[] }) {
  const navigate = useNavigate();

  return (
    <div className="divide-y">
      {boms.map((bom) => (
        <SwipeableBomRow
          key={bom.id}
          bom={bom}
          onEdit={(bom) => navigate(`/boms/${bom.id}/edit`)}
          onDelete={(bom) => handleDeleteBom(bom.id)}
          onShare={(bom) => handleShareBom(bom.id)}
        >
          <BomRowContent bom={bom} />
        </SwipeableBomRow>
      ))}
    </div>
  );
}
```

### Selective Actions

```tsx
// Only show Edit and Delete (no Share)
<SwipeableBomRow
  bom={bom}
  onEdit={handleEdit}
  onDelete={handleDelete}
  showShare={false}
>
  <BomContent />
</SwipeableBomRow>

// Only show Share
<SwipeableBomRow
  bom={bom}
  onShare={handleShare}
  showEdit={false}
  showDelete={false}
>
  <BomContent />
</SwipeableBomRow>
```

### Conditional Disabling

```tsx
<SwipeableBomRow
  bom={bom}
  onEdit={handleEdit}
  onDelete={handleDelete}
  disabled={isProcessing || !hasEditPermission}
>
  <BomContent />
</SwipeableBomRow>
```

## Props

### SwipeableBomRowProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `bom` | `Bom` | **required** | BOM data object |
| `children` | `ReactNode` | **required** | Content to display in the row |
| `onShare` | `(bom: Bom) => void` | `undefined` | Callback when Share button is clicked |
| `onEdit` | `(bom: Bom) => void` | `undefined` | Callback when Edit button is clicked |
| `onDelete` | `(bom: Bom) => void` | `undefined` | Callback when Delete button is clicked |
| `showShare` | `boolean` | `true` | Whether to show the Share button |
| `showEdit` | `boolean` | `true` | Whether to show the Edit button |
| `showDelete` | `boolean` | `true` | Whether to show the Delete button |
| `className` | `string` | `undefined` | Additional CSS classes for wrapper |
| `disabled` | `boolean` | `false` | Disable all swipe actions |

## Behavior

### Swipe Thresholds

- **Minimum swipe distance**: 60px (to reveal actions)
- **Snap threshold**: 120px (50% of total actions width)
  - If swiped past this point, actions snap open
  - If swiped less than this point, actions snap closed

### Action Button Dimensions

- **Width**: 80px per button
- **Total width** (3 buttons): 240px
- Buttons stack horizontally: Share (blue), Edit (amber), Delete (red)

### Auto-close Behavior

Actions automatically close when:
1. An action button is clicked
2. User clicks outside the row
3. User swipes right

### Touch vs Mouse

The component supports both:
- **Touch events**: Via `onTouchStart`, `onTouchMove`, `onTouchEnd`
- **Pointer events**: Via `onPointerDown`, `onPointerMove`, `onPointerUp`

This ensures compatibility with:
- Mobile devices (touch)
- Desktop devices (mouse drag)
- Hybrid devices (touch + mouse)

## Styling

### Default Colors

- **Share button**: Blue (`bg-blue-600`, `hover:bg-blue-700`)
- **Edit button**: Amber (`bg-amber-600`, `hover:bg-amber-700`)
- **Delete button**: Red (`bg-red-600`, `hover:bg-red-700`)
- **Disabled state**: Gray (`bg-gray-400`)

### Animations

- **Transition**: 200ms ease-out
- **Transform**: translateX (horizontal sliding)
- **Dragging**: No transition (follows pointer)
- **Snap**: Smooth transition to final state

### Customization

You can customize the wrapper appearance:

```tsx
<SwipeableBomRow
  bom={bom}
  className="rounded-lg shadow-sm hover:shadow-md"
  onEdit={handleEdit}
>
  <BomContent />
</SwipeableBomRow>
```

## Accessibility

### Keyboard Navigation

While the component is touch-optimized, action buttons are still accessible via:
- Tab navigation
- Enter/Space to activate
- Focus ring indicators

### Screen Readers

- Proper `aria-label` attributes on action buttons
- `role="group"` on the wrapper
- `aria-hidden` toggles based on reveal state

### Alternative Access

For users who cannot swipe, actions should also be available via:
- Context menu (right-click)
- Dedicated action buttons in the row
- Toolbar for bulk operations

Example:

```tsx
<SwipeableBomRow bom={bom} onEdit={handleEdit}>
  <div className="flex items-center justify-between p-4">
    <div>{bom.name}</div>
    {/* Alternative button access */}
    <div className="flex gap-2 lg:hidden">
      <Button size="sm" onClick={() => handleEdit(bom)}>
        Edit
      </Button>
    </div>
  </div>
</SwipeableBomRow>
```

## Performance Considerations

### Optimization Tips

1. **Memoize callbacks** to prevent unnecessary re-renders:
   ```tsx
   const handleEdit = useCallback((bom: Bom) => {
     // edit logic
   }, [dependencies]);
   ```

2. **Virtualize long lists** for better scroll performance:
   ```tsx
   import { useVirtualizer } from '@tanstack/react-virtual';
   ```

3. **Lazy load children** if content is heavy:
   ```tsx
   <SwipeableBomRow bom={bom}>
     {isVisible && <HeavyBomContent bom={bom} />}
   </SwipeableBomRow>
   ```

### Browser Support

- Modern browsers with Pointer Events API
- iOS Safari 13+
- Chrome/Edge 80+
- Firefox 75+

## Integration with BomList

Example integration with the existing BomList page:

```tsx
// In BomList.tsx
import { SwipeableBomRow } from '@/components/bom/SwipeableBomRow';

export function BomListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const canEdit = hasMinimumRole(user?.role, 'engineer');
  const canDelete = hasMinimumRole(user?.role, 'admin');

  return (
    <div className="space-y-4">
      {boms.map((bom) => (
        <SwipeableBomRow
          key={bom.id}
          bom={bom}
          onEdit={canEdit ? (bom) => navigate(`/boms/${bom.id}/edit`) : undefined}
          onDelete={canDelete ? handleDelete : undefined}
          onShare={(bom) => handleShare(bom.id)}
          showEdit={canEdit}
          showDelete={canDelete}
        >
          <BomCard bom={bom} />
        </SwipeableBomRow>
      ))}
    </div>
  );
}
```

## Testing

### Unit Tests

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SwipeableBomRow } from './SwipeableBomRow';

test('reveals actions on swipe left', () => {
  const handleEdit = jest.fn();
  render(
    <SwipeableBomRow bom={mockBom} onEdit={handleEdit}>
      <div>Content</div>
    </SwipeableBomRow>
  );

  // Simulate swipe left gesture
  const content = screen.getByText('Content').parentElement;
  fireEvent.touchStart(content, { touches: [{ clientX: 200, clientY: 0 }] });
  fireEvent.touchMove(content, { touches: [{ clientX: 100, clientY: 0 }] });
  fireEvent.touchEnd(content, { changedTouches: [{ clientX: 100, clientY: 0 }] });

  // Actions should be revealed
  const editButton = screen.getByLabelText(/edit/i);
  expect(editButton).toBeVisible();
});
```

### Storybook

Run Storybook to interact with the component:

```bash
bun run storybook
```

Navigate to `Components/BOM/SwipeableBomRow` to see interactive examples.

## Troubleshooting

### Actions don't reveal on swipe

- Ensure swipe distance exceeds 60px threshold
- Check that `disabled` prop is not set
- Verify touch events are not being blocked by parent elements

### Animations are janky

- Reduce number of simultaneous animations
- Use CSS transforms instead of position changes
- Check for layout thrashing in children

### Swipe conflicts with scroll

- The component uses `touchAction: 'pan-y'` to allow vertical scrolling
- Horizontal swipes should not interfere with vertical scroll
- If issues persist, adjust the swipe threshold

## Future Enhancements

Potential improvements for future iterations:

- [ ] Customizable action buttons (color, icon, label)
- [ ] Support for more than 3 actions with horizontal scroll
- [ ] Swipe right to reveal different actions
- [ ] Haptic feedback on mobile devices
- [ ] Undo action with toast notification
- [ ] Batch swipe actions (select multiple rows)
- [ ] Configurable swipe direction (RTL support)

## Related Components

- `DeleteBomDialog` - Confirmation dialog for BOM deletion
- `BulkActionsToolbar` - Toolbar for bulk operations
- `BomList` - Parent list component
- `ResponsiveTable` - Alternative table-based layout

## License

Part of the Ananta Platform SaaS customer portal.
