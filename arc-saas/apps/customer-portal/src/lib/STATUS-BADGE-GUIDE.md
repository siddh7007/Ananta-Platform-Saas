# StatusBadge Quick Reference Guide

## Basic Usage

```tsx
import { StatusBadge } from '@/components/ui/status-badge';

// Simple usage
<StatusBadge status="completed" />

// With size
<StatusBadge status="processing" size="sm" />

// Icon only
<StatusBadge status="failed" showLabel={false} />

// Custom label
<StatusBadge status="completed" customLabel="Done" />
```

## BOM-Specific Usage

```tsx
import { StatusBadge } from '@/components/ui/status-badge';
import { getBomStatusType, getBomStatusLabel } from '@/lib/bom-status';
import type { BomStatus } from '@/types/bom';

function MyComponent({ bom }: { bom: Bom }) {
  return (
    <StatusBadge
      status={getBomStatusType(bom.status)}
      customLabel={getBomStatusLabel(bom.status)}
      size="sm"
    />
  );
}
```

## Enrichment Status

```tsx
import { StatusBadge } from '@/components/ui/status-badge';
import { getEnrichmentStatusType, getEnrichmentStatusLabel } from '@/lib/bom-status';
import type { EnrichmentStatus } from '@/types/bom';

function LineItemStatus({ status }: { status: EnrichmentStatus }) {
  return (
    <StatusBadge
      status={getEnrichmentStatusType(status)}
      customLabel={getEnrichmentStatusLabel(status)}
    />
  );
}
```

## Enrichment Progress

```tsx
import { EnrichmentProgress } from '@/components/bom';

<EnrichmentProgress
  status="enriching"
  progress={67}
  totalItems={100}
  processedItems={67}
/>
```

## Available Status Types

| Status | Color | Icon | Animated |
|--------|-------|------|----------|
| success | Emerald | CheckCircle2 | No |
| completed | Emerald | CheckCircle2 | No |
| warning | Amber | AlertTriangle | No |
| partial | Amber | AlertTriangle | No |
| error | Red | XCircle | No |
| failed | Red | XCircle | No |
| info | Blue | Info | No |
| pending | Slate | Clock | No |
| processing | Purple | Loader2 | Yes |
| draft | Gray | FileText | No |
| uploading | Cyan | Upload | Yes |
| enriching | Violet | Sparkles | Yes |
| cancelled | Gray | XCircle | No |

## Size Options

- `sm` - Small (text-xs, h-3 w-3 icon)
- `md` - Medium (text-sm, h-4 w-4 icon) - **Default**
- `lg` - Large (text-base, h-5 w-5 icon)

## Props Reference

```tsx
interface StatusBadgeProps {
  status: StatusType;        // Required - Status type
  showLabel?: boolean;       // Optional - Show text label (default: true)
  size?: 'sm' | 'md' | 'lg'; // Optional - Badge size (default: 'md')
  className?: string;        // Optional - Additional classes
  customLabel?: string;      // Optional - Override default label
}
```

## Common Patterns

### Table Column

```tsx
{
  key: 'status',
  header: 'Status',
  render: (item) => (
    <StatusBadge
      status={getBomStatusType(item.status)}
      customLabel={getBomStatusLabel(item.status)}
      size="sm"
    />
  ),
}
```

### List Item

```tsx
<div className="flex items-center justify-between">
  <span className="font-medium">{bom.name}</span>
  <StatusBadge status={getBomStatusType(bom.status)} size="sm" />
</div>
```

### Header

```tsx
<div className="flex items-center gap-2">
  <h1>{bom.name}</h1>
  <StatusBadge status={getBomStatusType(bom.status)} />
</div>
```

### Conditional Rendering

```tsx
{bom.status === 'enriching' && (
  <StatusBadge status="enriching" size="lg" />
)}
```

## Accessibility

All badges include:
- `role="status"` for screen readers
- `aria-label` with full status description
- `aria-hidden="true"` on decorative icons
- Keyboard accessible (when interactive)

## Styling

The component uses Tailwind classes and can be extended:

```tsx
<StatusBadge
  status="completed"
  className="shadow-md hover:shadow-lg transition-shadow"
/>
```

## Dark Mode

All colors automatically adjust for dark mode:
- Light backgrounds in light mode
- Dark backgrounds in dark mode
- Maintains contrast ratio

## Animation

Processing states automatically animate:
- `processing` - Spinning loader
- `uploading` - Spinning upload icon
- `enriching` - Spinning sparkles

No configuration needed - handled automatically.

## Migration from Old Pattern

### Before

```tsx
<span className="bg-green-100 text-green-700 px-2 py-1 rounded">
  Completed
</span>
```

### After

```tsx
<StatusBadge status="completed" size="sm" />
```

## Testing

In Storybook:

```bash
npm run storybook
```

Navigate to: **UI > StatusBadge**

Stories available:
- Default
- AllStatuses
- Sizes
- IconOnly
- AnimatedStates
- ColorBlindTest
- DarkMode
- CustomLabels

## Tips

1. **Always use getBomStatusType() for BOM statuses** - Don't map manually
2. **Use size="sm" in tables** - Better visual hierarchy
3. **Don't override colors** - Use the palette for consistency
4. **Test in grayscale** - Ensure icon distinction
5. **Consider icon-only mode for tight spaces** - `showLabel={false}`

## Questions?

See full documentation: `docs/CBP-P1-002-STATUS-INDICATORS.md`
