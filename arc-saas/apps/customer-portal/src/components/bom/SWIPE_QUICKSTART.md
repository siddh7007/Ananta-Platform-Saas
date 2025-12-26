# SwipeableBomRow - Quick Start Guide

## 5-Minute Integration

### 1. Import the Component

```typescript
import { SwipeableBomRow } from '@/components/bom/SwipeableBomRow';
```

### 2. Wrap Your BOM Row

```typescript
<SwipeableBomRow
  bom={bomData}
  onEdit={(bom) => navigate(`/boms/${bom.id}/edit`)}
  onDelete={(bom) => handleDelete(bom.id)}
  onShare={(bom) => handleShare(bom.id)}
>
  {/* Your existing row content */}
  <div className="p-4">
    <h3>{bomData.name}</h3>
    <p>{bomData.lineCount} lines</p>
  </div>
</SwipeableBomRow>
```

### 3. Test on Mobile

- Open on mobile device or Chrome DevTools (mobile mode)
- Swipe left on the row
- See actions appear
- Tap an action or swipe right to close

## Common Patterns

### Pattern 1: Permission-Based Actions

```typescript
const canEdit = hasMinimumRole(user?.role, 'engineer');
const canDelete = hasMinimumRole(user?.role, 'admin');

<SwipeableBomRow
  bom={bom}
  onEdit={canEdit ? handleEdit : undefined}
  onDelete={canDelete ? handleDelete : undefined}
  showEdit={canEdit}
  showDelete={canDelete}
>
  <BomContent bom={bom} />
</SwipeableBomRow>
```

### Pattern 2: With Delete Confirmation

```typescript
const [deleteTarget, setDeleteTarget] = useState<BomInfo | null>(null);

const handleDeleteClick = (bom: Bom) => {
  setDeleteTarget({ id: bom.id, name: bom.name });
  setDeleteDialogOpen(true);
};

<SwipeableBomRow bom={bom} onDelete={handleDeleteClick}>
  <BomContent bom={bom} />
</SwipeableBomRow>

<DeleteBomDialog
  open={deleteDialogOpen}
  onOpenChange={setDeleteDialogOpen}
  bom={deleteTarget}
  onConfirm={handleConfirmDelete}
/>
```

### Pattern 3: Share with Web Share API

```typescript
const handleShare = (bom: Bom) => {
  if (navigator.share) {
    navigator.share({
      title: bom.name,
      url: `${window.location.origin}/boms/${bom.id}`,
    });
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(`${window.location.origin}/boms/${bom.id}`);
    toast({ title: 'Link copied!' });
  }
};
```

## Customization

### Hide Specific Actions

```typescript
// Only show Edit (no Share, no Delete)
<SwipeableBomRow
  bom={bom}
  onEdit={handleEdit}
  showShare={false}
  showDelete={false}
>
  <BomContent />
</SwipeableBomRow>
```

### Disable During Processing

```typescript
<SwipeableBomRow
  bom={bom}
  onEdit={handleEdit}
  disabled={isProcessing || bom.status === 'enriching'}
>
  <BomContent />
</SwipeableBomRow>
```

### Custom Styling

```typescript
<SwipeableBomRow
  bom={bom}
  className="rounded-lg shadow-sm hover:shadow-md"
  onEdit={handleEdit}
>
  <BomContent />
</SwipeableBomRow>
```

## Troubleshooting

### Actions don't appear on swipe

Check:
- [ ] Swipe distance is > 60px
- [ ] `disabled` prop is not set
- [ ] At least one `onX` callback is provided
- [ ] Corresponding `showX` prop is `true`

### Scroll conflicts with swipe

The component uses `touchAction: 'pan-y'` to allow vertical scrolling. If you still have issues:

```typescript
// Increase threshold to avoid accidental swipes
import { useSwipeGesture } from '@/hooks/useSwipeGesture';

const { handlers } = useSwipeGesture({
  threshold: 100, // Increase from default 50px
  onSwipeLeft: handleReveal,
});
```

## Examples

See complete examples in:
- **Storybook**: Run `bun run storybook` → Navigate to `Components/BOM/SwipeableBomRow`
- **Example File**: `src/components/bom/BomListWithSwipe.example.tsx`
- **Full Docs**: `src/components/bom/SwipeableBomRow.md`

## API Quick Reference

| Prop | Type | Default | Required |
|------|------|---------|----------|
| `bom` | `Bom` | - | Yes |
| `children` | `ReactNode` | - | Yes |
| `onShare` | `(bom) => void` | `undefined` | No |
| `onEdit` | `(bom) => void` | `undefined` | No |
| `onDelete` | `(bom) => void` | `undefined` | No |
| `showShare` | `boolean` | `true` | No |
| `showEdit` | `boolean` | `true` | No |
| `showDelete` | `boolean` | `true` | No |
| `disabled` | `boolean` | `false` | No |
| `className` | `string` | `undefined` | No |

## Next Steps

1. **Test on Real Devices**: Test on iOS and Android devices
2. **Add Analytics**: Track swipe usage vs button clicks
3. **Gather Feedback**: Ask users if swipe gestures are intuitive
4. **Iterate**: Adjust thresholds based on user behavior

---

Need help? Check the full documentation in `SwipeableBomRow.md`
