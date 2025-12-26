# SwipeableBomRow - Architecture Overview

## Component Hierarchy

```
SwipeableBomRow (wrapper component)
├── Action Buttons Container (absolute positioned, behind content)
│   ├── Share Button (blue, 80px wide)
│   ├── Edit Button (amber, 80px wide)
│   └── Delete Button (red, 80px wide)
├── Main Content Container (slides left/right)
│   ├── Children (your BOM row content)
│   └── Touch/Pointer Event Handlers
└── Swipe Indicator (visual hint, optional)
```

## Data Flow

```
User Interaction
      ↓
Touch/Pointer Events
      ↓
useSwipeGesture Hook
      ↓
Calculate Direction & Distance
      ↓
Update Component State
      ↓
Apply CSS Transform (translateX)
      ↓
Snap to Open/Closed
      ↓
Action Button Click?
      ↓
Execute Callback & Close
```

## State Management

### Component State (SwipeableBomRow)

```typescript
{
  isRevealed: boolean,      // Are actions visible?
  translateX: number,       // Current horizontal offset (-240 to 0)
  isDragging: boolean       // Is user currently dragging?
}
```

### Hook State (useSwipeGesture)

```typescript
{
  touchStart: {
    x: number,              // Starting X position
    y: number,              // Starting Y position
    timestamp: number       // When touch started
  },
  swipeState: {
    isSwiping: boolean,     // Is swipe in progress?
    direction: string,      // 'left' | 'right' | 'up' | 'down' | null
    deltaX: number,         // Horizontal distance
    deltaY: number          // Vertical distance
  }
}
```

## Event Flow

### Touch Events (Mobile)

```
onTouchStart
  → Store initial position & timestamp
  → Set isSwiping = true

onTouchMove
  → Calculate delta from start
  → Determine primary direction
  → Update translateX (constrained to 0 to -240)

onTouchEnd
  → Calculate final delta & duration
  → Check if meets threshold (60px, 500ms)
  → Execute appropriate callback
  → Snap to open/closed state
```

### Pointer Events (Desktop)

```
onPointerDown
  → Capture pointer
  → Store start position
  → Set isDragging = true

onPointerMove
  → Calculate current offset
  → Update translateX (real-time follow)

onPointerUp
  → Release pointer
  → Check snap threshold (120px)
  → Snap to final state
```

## Animation System

### CSS Transitions

```css
/* Smooth snap animation (when not dragging) */
transition: transform 200ms ease-out;

/* No transition during drag (follows pointer) */
/* Disabled via className when isDragging = true */
```

### Transform States

```
Closed:  translateX(0)           // Actions hidden
Dragging: translateX(-Xpx)       // Following pointer (0 to -240)
Open:    translateX(-240px)      // Actions fully revealed
```

### Snap Logic

```typescript
if (translateX < -120px) {
  // Swiped past halfway point
  snap to: translateX(-240px)  // Fully open
} else {
  // Didn't swipe far enough
  snap to: translateX(0)       // Close
}
```

## Responsive Behavior

### Mobile (< 768px)

- Primary interaction: Touch swipe
- Actions hidden by default
- Swipe indicator visible
- 100% width rows

### Tablet (768px - 1024px)

- Touch + Mouse support
- Swipe indicator visible
- May show some actions as buttons

### Desktop (> 1024px)

- Primary interaction: Mouse click on visible buttons
- Swipe still available for trackpad users
- Actions may be shown directly (no swipe needed)
- Optional: Show buttons on hover instead

## Integration Points

### With Existing Components

```typescript
// Current BomList structure
<div className="bom-list">
  {boms.map(bom => (
    <BomCard key={bom.id} bom={bom} />
  ))}
</div>

// Enhanced with SwipeableBomRow
<div className="bom-list">
  {boms.map(bom => (
    <SwipeableBomRow
      key={bom.id}
      bom={bom}
      onEdit={handleEdit}
      onDelete={handleDelete}
    >
      <BomCard bom={bom} />
    </SwipeableBomRow>
  ))}
</div>
```

### With Permission System

```typescript
// Permission checks before rendering
const canEdit = hasMinimumRole(user?.role, 'engineer');
const canDelete = hasMinimumRole(user?.role, 'admin');

<SwipeableBomRow
  bom={bom}
  onEdit={canEdit ? handleEdit : undefined}
  onDelete={canDelete ? handleDelete : undefined}
  showEdit={canEdit}
  showDelete={canDelete}
>
  <BomCard bom={bom} />
</SwipeableBomRow>
```

### With Delete Dialog

```typescript
// SwipeableBomRow triggers dialog
<SwipeableBomRow
  bom={bom}
  onDelete={(bom) => {
    setBomToDelete(bom);
    setDeleteDialogOpen(true);
  }}
>
  <BomCard bom={bom} />
</SwipeableBomRow>

// Separate confirmation dialog
<DeleteBomDialog
  open={deleteDialogOpen}
  bom={bomToDelete}
  onConfirm={handleConfirmDelete}
/>
```

## Performance Optimizations

### 1. Hardware Acceleration

```css
/* Use transform instead of left/margin */
transform: translateX(-240px);
/* GPU accelerated, 60fps smooth */
```

### 2. Conditional Transitions

```typescript
// Transition only when not dragging
className={cn(
  !isDragging && 'transition-transform duration-200'
)}
```

### 3. Event Delegation

```typescript
// Single listener per row, not per action
<div {...handlers}>
  {/* All children share same gesture detection */}
</div>
```

### 4. Ref-based State

```typescript
// Use ref for values that don't need re-render
const startXRef = useRef(0);
// Avoids re-renders on every pointer move
```

## Accessibility Implementation

### Keyboard Navigation

```
Tab → Focus on first action button
Tab → Focus on second action button
Tab → Focus on third action button
Enter/Space → Activate focused button
Escape → Close revealed actions
```

### ARIA Attributes

```typescript
// Container
role="group"
aria-label={`Swipeable row for ${bom.name}`}

// Action buttons
aria-label={`Edit ${bom.name}`}
aria-label={`Delete ${bom.name}`}
aria-label={`Share ${bom.name}`}

// Hidden state
aria-hidden={!isRevealed}
```

### Focus Management

```typescript
// Focus trap when actions revealed
// Visible focus indicators
focus:outline-none focus:ring-2 focus:ring-blue-500
```

## File Structure

```
customer-portal/
├── src/
│   ├── components/
│   │   └── bom/
│   │       ├── SwipeableBomRow.tsx          (282 lines) ← Main component
│   │       ├── SwipeableBomRow.stories.tsx  ← Storybook examples
│   │       ├── SwipeableBomRow.md           ← Full documentation
│   │       ├── SWIPE_QUICKSTART.md          ← Quick start guide
│   │       ├── SWIPE_ARCHITECTURE.md        ← This file
│   │       └── BomListWithSwipe.example.tsx ← Integration example
│   └── hooks/
│       ├── useSwipeGesture.ts               (173 lines) ← Core hook
│       └── index.ts                          ← Hook exports
└── SWIPE_GESTURE_IMPLEMENTATION.md          ← Project summary
```

## Technology Stack

### Core Dependencies

- **React 18**: Hooks, event handling
- **TypeScript 5**: Type safety
- **Tailwind CSS**: Styling
- **Lucide React**: Icons (Share2, Edit2, Trash2)

### Optional Dependencies

- **react-swipeable**: Alternative to custom hook (not installed)

### Browser APIs Used

- **Touch Events API**: `TouchEvent`, `touches`, `changedTouches`
- **Pointer Events API**: `PointerEvent`, capture/release
- **Web Share API**: `navigator.share()` (with fallback)
- **Clipboard API**: `navigator.clipboard.writeText()`

## Testing Strategy

### Unit Tests (Recommended)

```typescript
describe('SwipeableBomRow', () => {
  it('reveals actions on swipe left');
  it('hides actions on swipe right');
  it('calls onEdit when Edit button clicked');
  it('calls onDelete when Delete button clicked');
  it('snaps open when swiped > 120px');
  it('snaps closed when swiped < 120px');
  it('closes on click outside');
  it('disables swipe when disabled=true');
});

describe('useSwipeGesture', () => {
  it('detects swipe left');
  it('detects swipe right');
  it('ignores swipe < threshold');
  it('ignores swipe > maxDuration');
});
```

### Integration Tests

```typescript
describe('BomList with SwipeableBomRow', () => {
  it('shows Share, Edit, Delete for admin');
  it('hides Delete for non-admin users');
  it('opens delete confirmation dialog');
  it('shares BOM via Web Share API');
  it('navigates to edit page on Edit click');
});
```

### Visual Tests (Storybook)

```bash
bun run storybook
# Test all stories visually:
# - Default
# - Multiple Rows
# - Only Edit and Delete
# - Share Only
# - Disabled
# - In List
# - Mobile View
```

## Deployment Checklist

Before deploying to production:

- [ ] Test on iOS Safari (iPhone)
- [ ] Test on Chrome Android
- [ ] Test on desktop (mouse drag)
- [ ] Verify keyboard navigation works
- [ ] Check screen reader announcements
- [ ] Test with slow network (animations)
- [ ] Verify permission checks work
- [ ] Test delete confirmation flow
- [ ] Check share functionality (Web Share + clipboard)
- [ ] Validate touch target sizes (44×44px minimum)
- [ ] Review color contrast ratios
- [ ] Test with VoiceOver/TalkBack
- [ ] Performance test with 100+ rows
- [ ] Check bundle size impact

## Monitoring & Analytics

### Metrics to Track

```typescript
// Swipe usage
analytics.track('bom_row_swipe', {
  direction: 'left',
  action_taken: 'edit',
  duration_ms: 250,
});

// Action button clicks
analytics.track('bom_action_click', {
  action: 'delete',
  source: 'swipe_reveal',
});

// Adoption rate
// Compare: swipe actions vs context menu vs toolbar
```

## Known Issues & Limitations

### Current Limitations

1. **Multiple Rows Open**: Allows multiple rows to be revealed simultaneously
   - Future: Add global state manager to close others

2. **Desktop Discoverability**: Mouse drag is less discoverable
   - Solution: Show hint text or action buttons on hover

3. **Horizontal Scroll**: May conflict if parent has horizontal scroll
   - Mitigation: `touchAction: 'pan-y'` allows vertical scroll

### Browser Quirks

- **iOS Safari**: May have momentum scrolling interference
- **Android Chrome**: Smooth scrolling can delay touch events
- **Firefox**: Pointer events may need polyfill for older versions

## Future Roadmap

### Phase 2 Enhancements

- [ ] Haptic feedback on iOS
- [ ] Custom action buttons (not just Share/Edit/Delete)
- [ ] Swipe from right side (different actions)
- [ ] Undo toast after delete
- [ ] Batch swipe (multi-select)
- [ ] RTL language support

### Phase 3 Advanced Features

- [ ] Spring physics animations
- [ ] Velocity-based snap prediction
- [ ] Swipe gesture customization per user
- [ ] Analytics dashboard for swipe adoption
- [ ] A/B testing framework for thresholds

---

**Last Updated**: 2024-12-15
**Status**: Production Ready
**Version**: 1.0.0
