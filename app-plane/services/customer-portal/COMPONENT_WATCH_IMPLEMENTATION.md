# Component Watch Feature Implementation

## Overview

The Component Watch feature allows users to monitor specific components and receive alerts when changes occur. This implementation follows Material-UI patterns and integrates seamlessly with the existing alert system.

## Architecture

### Backend API (Already Implemented)

The backend API endpoints are already available in the CNS service:

- `GET /api/alerts/watches` - Get all watches for current user
- `POST /api/alerts/watches` - Add a component watch
- `DELETE /api/alerts/watches/{watchId}` - Remove a component watch

### Frontend Implementation

#### 1. Service Layer

**File**: `src/services/alertService.ts`

Already contains:
- `ComponentWatch` interface
- `ComponentWatchCreate` interface
- API methods: `getWatches()`, `addWatch()`, `removeWatch()`

#### 2. Hooks Layer

**File**: `src/hooks/useComponentWatch.ts`

Custom React hooks for component watch functionality:

```typescript
// Hooks exported:
- useComponentWatches(options?) - Fetch all watches for user
- useIsWatched(componentId) - Check if specific component is watched
- useAddWatch(options?) - Add watch mutation
- useRemoveWatch(options?) - Remove watch mutation
- useUpdateWatchTypes(options?) - Update watch types
- getEnabledWatchTypes(watch) - Utility to extract enabled types
```

**Features**:
- Automatic data fetching
- Loading and error states
- Optimistic updates
- Callbacks for success/error handling
- Component ID filtering

#### 3. UI Components

##### WatchButton Component

**File**: `src/components/WatchButton.tsx`

A reusable button component for watching/unwatching components.

**Props**:
```typescript
{
  componentId: string;
  mpn?: string;
  manufacturer?: string;
  variant?: 'button' | 'icon';  // Button or icon-only
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  watchedLabel?: string;        // Custom label for watched state
  unwatchedLabel?: string;      // Custom label for unwatched state
  onWatchChange?: (isWatched: boolean) => void;
}
```

**Features**:
- Two variants: full button or icon-only
- Shows loading states
- Opens popover with type selector
- Integrates with WatchTypeSelector

**Usage**:
```tsx
// Icon variant (for table rows)
<WatchButton
  componentId={component.id}
  mpn={component.mpn}
  manufacturer={component.manufacturer}
  variant="icon"
  size="small"
/>

// Button variant (for detail pages)
<WatchButton
  componentId={component.id}
  mpn={component.mpn}
  manufacturer={component.manufacturer}
  variant="button"
  size="medium"
/>
```

##### WatchTypeSelector Component

**File**: `src/components/WatchTypeSelector.tsx`

Popover content for selecting alert types to watch.

**Props**:
```typescript
{
  componentId: string;
  mpn?: string;
  manufacturer?: string;
  initialWatchTypes?: WatchType[];  // For editing existing watch
  onSave: (watchTypes: WatchType[]) => Promise<void> | void;
  onRemove?: () => Promise<void> | void;  // Only shown if editing
  onCancel: () => void;
}
```

**Watch Types**:
- Lifecycle Changes (EOL, NRND)
- Risk Score (threshold exceeded)
- Price Changes (significant changes)
- Stock Availability (level changes)
- Compliance Updates (RoHS, REACH)
- PCN/PDN Notifications
- Supply Chain (disruptions)

**Features**:
- Checkbox list with icons
- Select All / Clear All quick actions
- Shows count of selected types
- Save/Cancel/Remove actions
- Validation (at least one type required)

#### 4. Pages

##### WatchedComponents Page

**File**: `src/pages/WatchedComponents.tsx`
**Route**: `/alerts/watched`

Full-featured page for managing watched components.

**Features**:
- Table view of all watched components
- Search by MPN or manufacturer
- Filter by watch type
- Bulk selection and deletion
- Edit watch types inline
- Shows when component was added
- Empty state guidance

**Columns**:
- Checkbox (for bulk selection)
- MPN
- Manufacturer
- Watch Types (chips)
- Added Date
- Actions (Edit, Delete)

##### Integration Points

**ComponentSearch Page**:
- Added Watch column to results table
- WatchButton in each row (icon variant)

**ComponentDetailDialog**:
- WatchButton in dialog header
- Full button variant with label

**AlertPreferences Page**:
- Existing watch list section
- Added "View All" button linking to `/alerts/watched`

## Watch Types

| Type | Label | Description |
|------|-------|-------------|
| `lifecycle` | Lifecycle Changes | EOL, NRND, or other lifecycle status changes |
| `risk` | Risk Score | Risk score exceeds threshold |
| `price` | Price Changes | Significant price changes |
| `availability` | Stock Availability | Stock level changes or shortages |
| `compliance` | Compliance Updates | RoHS, REACH, or regulatory changes |
| `pcn` | PCN/PDN Notifications | Product Change or Discontinuation Notices |
| `supply_chain` | Supply Chain | Supply chain disruptions or alerts |

## Data Flow

### Adding a Watch

1. User clicks WatchButton
2. WatchTypeSelector popover opens
3. User selects alert types
4. User clicks "Watch"
5. `useAddWatch` hook calls API
6. Optimistic UI update
7. Success notification shown
8. Watch list refreshes

### Editing a Watch

1. User clicks WatchButton on watched component
2. WatchTypeSelector opens with current types
3. User modifies selection
4. User clicks "Update"
5. `useUpdateWatchTypes` removes old watch and creates new one
6. Success notification shown
7. Watch list refreshes

### Removing a Watch

1. User clicks remove in WatchTypeSelector or table
2. `useRemoveWatch` hook calls API
3. Optimistic UI update
4. Success notification shown
5. Watch list refreshes

## State Management

- **Local State**: Component-level state in each page/component
- **API State**: Fetched via custom hooks with caching
- **Optimistic Updates**: Immediate UI feedback before API confirmation
- **Error Handling**: Try-catch blocks with user-friendly notifications

## Notifications

All operations show toast notifications:
- Success: "Now watching {mpn}" (green)
- Update: "Watch preferences updated" (green)
- Remove: "Stopped watching {mpn}" (info)
- Error: Error message from API (red)

## Styling

All components use Material-UI (MUI) v5:
- Consistent spacing with theme
- Primary color for active states
- Error color for destructive actions
- Responsive design
- Hover states and transitions

## Accessibility

- Proper ARIA labels
- Keyboard navigation support
- Focus management
- Screen reader friendly
- Tooltip descriptions

## Testing Recommendations

### Unit Tests
- Hook behavior (fetch, add, remove, update)
- Component rendering (button states, popover)
- Event handlers (click, save, cancel)

### Integration Tests
- Full watch workflow (add -> edit -> remove)
- Search and filter functionality
- Bulk operations
- Navigation between pages

### E2E Tests
- User can watch component from search
- User can view watched components list
- User can edit watch types
- User can bulk delete watches
- Alerts are received for watched components

## Future Enhancements

1. **Bulk Add**: Watch multiple components at once from search
2. **Watch Templates**: Save common watch configurations
3. **Smart Suggestions**: Suggest components to watch based on usage
4. **Alert History**: Show which watch triggered each alert
5. **Export**: Export watched components list
6. **Notes**: Add custom notes to each watch
7. **Notifications**: Configure per-watch notification preferences
8. **Analytics**: Track which watch types are most useful

## Files Created/Modified

### Created Files
- `src/hooks/useComponentWatch.ts` (426 lines)
- `src/components/WatchButton.tsx` (214 lines)
- `src/components/WatchTypeSelector.tsx` (334 lines)
- `src/pages/WatchedComponents.tsx` (485 lines)

### Modified Files
- `src/hooks/index.ts` - Export watch hooks
- `src/pages/ComponentSearch.tsx` - Add watch column and button
- `src/components/ComponentDetailDialog.tsx` - Add watch button to header
- `src/pages/AlertPreferences.tsx` - Add "View All" link
- `src/App.tsx` - Add route for `/alerts/watched`

### Total Lines Added
~1,500 lines of production code

## Route Structure

```
/alerts                    - Alert Center
/alerts/preferences        - Alert Preferences (existing)
/alerts/watched           - Watched Components (new)
```

## Backend Requirements (Already Met)

The backend CNS service already provides all necessary endpoints:

```python
# Already implemented in CNS service:
GET    /api/alerts/watches              # List user's watches
POST   /api/alerts/watches              # Create watch
DELETE /api/alerts/watches/{watchId}    # Remove watch
```

Database schema already exists with `component_watches` table.

## Usage Examples

### Example 1: Add Watch Button to Custom Component

```tsx
import { WatchButton } from '../components/WatchButton';

function MyComponentCard({ component }) {
  return (
    <Card>
      <CardHeader
        title={component.mpn}
        action={
          <WatchButton
            componentId={component.id}
            mpn={component.mpn}
            manufacturer={component.manufacturer}
            variant="icon"
          />
        }
      />
    </Card>
  );
}
```

### Example 2: Check If Component is Watched

```tsx
import { useIsWatched } from '../hooks';

function ComponentStatus({ componentId }) {
  const { isWatched, loading } = useIsWatched(componentId);

  if (loading) return <CircularProgress size={16} />;

  return isWatched ? (
    <Chip label="Watching" color="primary" size="small" />
  ) : null;
}
```

### Example 3: Custom Watch Management

```tsx
import { useComponentWatches, useAddWatch, useRemoveWatch } from '../hooks';

function CustomWatchManager() {
  const { watches, refetch } = useComponentWatches();
  const { addWatch } = useAddWatch({
    onSuccess: () => refetch()
  });

  const handleQuickWatch = (componentId: string) => {
    addWatch(componentId, ['lifecycle', 'price']);
  };

  return (
    <div>
      <p>You are watching {watches.length} components</p>
      {/* Custom UI here */}
    </div>
  );
}
```

## Implementation Checklist

- [x] Create useComponentWatch hooks
- [x] Export hooks from index
- [x] Create WatchButton component
- [x] Create WatchTypeSelector component
- [x] Create WatchedComponents page
- [x] Add route for /alerts/watched
- [x] Integrate into ComponentSearch
- [x] Integrate into ComponentDetailDialog
- [x] Add link from AlertPreferences
- [x] Documentation

## Summary

The Component Watch feature is now fully implemented and integrated into the Customer Portal. Users can:

1. Watch components from search results or detail pages
2. Select specific alert types to monitor
3. Manage all watched components in a dedicated page
4. Edit or remove watches easily
5. Search and filter their watch list
6. Perform bulk operations

The implementation follows best practices:
- Separation of concerns (hooks, components, pages)
- Reusable components
- Type safety with TypeScript
- Consistent Material-UI styling
- Optimistic updates for better UX
- Comprehensive error handling
- Accessible and responsive design
