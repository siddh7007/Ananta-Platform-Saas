# Command Palette (Cmd+K)

Global command palette for quick navigation and actions in the CBP Customer Portal.

## Features

- **Keyboard Shortcut**: Cmd+K (Mac) / Ctrl+K (Windows/Linux)
- **Smart Search**: Filter navigation items, quick actions, and recent items
- **Keyboard Navigation**: Arrow keys, Enter, Escape
- **Grouped Results**: Recent, Navigation, Quick Actions
- **Recent Items**: Automatically tracks last 5 visited pages (localStorage)
- **Role-Based**: Filters actions based on user role (analyst, engineer, admin, owner, super_admin)
- **Responsive**: Works on mobile, tablet, and desktop

## Usage

### Basic Usage

The Command Palette is automatically available in all authenticated pages via the Layout component:

```tsx
// Already integrated in Layout.tsx - no additional setup needed
```

### Opening the Command Palette

1. **Keyboard**: Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)
2. **Programmatically**:

```tsx
import { useState } from 'react';
import { CommandPalette } from '@/components/command';

function MyComponent() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Open Command Palette</button>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
```

## Components

### CommandPalette

Main dialog component that displays search and results.

**Props:**
- `open?: boolean` - Controlled open state
- `onOpenChange?: (open: boolean) => void` - Callback when open state changes

### CommandPaletteTrigger

Button component that displays the keyboard shortcut hint and opens the palette.

**Props:**
- `onClick?: () => void` - Callback when clicked
- `className?: string` - Additional CSS classes

```tsx
import { CommandPaletteTrigger } from '@/components/command';

<CommandPaletteTrigger onClick={() => setOpen(true)} />
```

### CommandItem

Individual result item within the palette.

**Props:**
- `item: CommandItemData` - Item data
- `isSelected: boolean` - Whether item is currently selected
- `onClick: () => void` - Click handler

### CommandGroup

Groups command items by category.

**Props:**
- `heading: string` - Group heading text
- `children: ReactNode` - Command items

### CommandEmpty

Displayed when no results match the search query.

**Props:**
- `query: string` - Current search query

## Keyboard Shortcuts

### Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open/close command palette |
| `Escape` | Close command palette |

### Within Palette

| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate between items |
| `Enter` | Select current item |
| `Escape` | Close palette |

## Search Categories

### Navigation
All accessible navigation items based on user role:
- Dashboard
- Workspaces
- Projects
- BOMs
- Components
- Risk Analysis
- Alerts
- Team (admin+)
- Billing (admin+)
- Settings (admin+)

### Quick Actions
Role-based quick actions:
- **Upload BOM** (engineer+) - Shortcut: `u`
- **Create Project** (engineer+) - Shortcut: `p`
- **Invite Team Member** (admin+)

### Recent Items
Last 5 visited pages, automatically tracked via localStorage.

## Role-Based Filtering

Actions are filtered based on user role:

| Action | Minimum Role |
|--------|--------------|
| Upload BOM | engineer |
| Create Project | engineer |
| Invite Team Member | admin |
| View Team | admin |
| View Billing | admin |
| View Settings | admin |

## Recent Items Persistence

Recent items are stored in localStorage:
- **Key**: `cbp:command-palette:recent`
- **Format**: JSON array of paths
- **Max Items**: 5
- **Behavior**: Most recent first, duplicates removed

## Extending the Command Palette

### Adding New Navigation Items

Navigation items are automatically pulled from `@/config/navigation.ts`. To add new items:

1. Add to `navigationManifest` in `navigation.ts`
2. Set appropriate `minRole`
3. Items will automatically appear in the command palette

### Adding New Quick Actions

Edit `CommandPalette.tsx` and add to the `quickActions` array:

```tsx
const quickActions = useMemo((): CommandItemData[] => {
  return [
    // Existing actions...
    {
      id: 'my-action',
      label: 'My Action',
      icon: MyIcon,
      description: 'Description of my action',
      category: 'actions',
      shortcut: 'm', // Optional shortcut hint
      onSelect: () => {
        // Action logic
        navigate('/my-path');
        setOpen(false);
      },
    },
  ].filter((action) => {
    // Role-based filtering
    if (action.id === 'my-action' && userRole === 'analyst') return false;
    return true;
  });
}, [navigate, setOpen, userRole]);
```

## Accessibility

- **ARIA Labels**: All interactive elements have proper labels
- **Keyboard Navigation**: Full keyboard support
- **Focus Management**: Auto-focuses search input on open
- **Screen Readers**: Proper semantic markup and descriptions
- **Reduced Motion**: Respects `prefers-reduced-motion` setting

## Implementation Details

### File Structure

```
src/components/command/
├── CommandPalette.tsx       # Main dialog component
├── CommandItem.tsx          # Individual result items
├── index.ts                 # Barrel exports
└── README.md               # This file

src/hooks/
└── useKeyboardShortcuts.ts  # Global keyboard shortcut hook
```

### Dependencies

- `@radix-ui/react-dialog` - Dialog primitive
- `react-router-dom` - Navigation
- `lucide-react` - Icons
- Custom components from `@/components/ui`

### State Management

- **Local State**: Search query, selected index
- **localStorage**: Recent items persistence
- **Context**: User role, tenant info from contexts

## Testing

### Manual Testing Checklist

- [ ] Open with Cmd+K (Mac) or Ctrl+K (Windows)
- [ ] Close with Escape
- [ ] Search filters items correctly
- [ ] Arrow keys navigate between items
- [ ] Enter selects current item
- [ ] Recent items appear after navigation
- [ ] Quick actions filtered by role
- [ ] Mobile responsive layout
- [ ] Keyboard shortcuts work globally

### Unit Tests

```bash
npm run test -- CommandPalette
```

## Performance

- **Lazy Loading**: Dialog only rendered when opened
- **Memoization**: Search results and groups memoized
- **localStorage**: Minimal writes (only on navigation)
- **Event Cleanup**: Proper event listener cleanup

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Known Limitations

1. Recent items limited to 5 (configurable via `MAX_RECENT_ITEMS`)
2. Search is case-insensitive substring match (not fuzzy)
3. No multi-word search (searches entire query as single term)

## Future Enhancements

- [ ] Fuzzy search algorithm
- [ ] Multi-word search support
- [ ] Search history
- [ ] Command aliases
- [ ] Custom commands per workspace
- [ ] Search across BOM/component data
- [ ] Keyboard shortcut customization
- [ ] Command palette themes

## Related Documentation

- [Navigation Manifest](../../config/navigation.ts)
- [Keyboard Shortcuts Hook](../../hooks/useKeyboardShortcuts.ts)
- [UI Improvement Plan](../../CBP_UI_IMPROVEMENT_PLAN.md)
