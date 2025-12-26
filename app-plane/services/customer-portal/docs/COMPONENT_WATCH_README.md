# Component Watch Feature

## Overview

The Component Watch feature allows users to monitor specific electronic components and receive real-time alerts when important changes occur. Users can watch components for various events including lifecycle changes, price fluctuations, stock availability, compliance updates, and supply chain disruptions.

## Key Features

- **Selective Monitoring**: Choose specific alert types for each watched component
- **Quick Actions**: Watch components directly from search results or detail pages
- **Centralized Management**: View and manage all watched components in one place
- **Bulk Operations**: Select and remove multiple watches at once
- **Smart Filtering**: Search and filter watched components by type or keywords
- **Visual Feedback**: Clear indicators show watch status across the application

## User Journey

### 1. Discovering Components

Users can search for components in the Component Search page (`/components/search`):
- Browse search results
- See watch status for each component
- Click watch icon to start monitoring

### 2. Watching a Component

When a user clicks the watch button:
1. A popover appears with alert type options
2. User selects desired alert types (lifecycle, price, risk, etc.)
3. User clicks "Watch" to confirm
4. Component is added to their watch list
5. Success notification appears

### 3. Managing Watches

Users can manage their watches in two locations:

**Alert Preferences Page** (`/alerts/preferences`):
- Shows condensed watch list
- Quick add/remove functionality
- "View All" link to full management page

**Watched Components Page** (`/alerts/watched`):
- Full table view of all watches
- Search by MPN or manufacturer
- Filter by watch type
- Bulk select and delete
- Edit watch types inline
- Sort by date added

### 4. Receiving Alerts

When a watched component changes:
1. System generates alert based on watch types
2. Alert appears in Alert Center
3. User receives notification (based on preferences)
4. Alert links back to component details

## Architecture

### Component Hierarchy

```
WatchedComponentsPage (Page)
├── WatchButton (Reusable Component)
│   └── WatchTypeSelector (Popover Component)
├── useComponentWatches (Hook)
├── useIsWatched (Hook)
├── useAddWatch (Hook)
├── useRemoveWatch (Hook)
└── useUpdateWatchTypes (Hook)
```

### Data Flow

```
User Action → Hook → API Service → Backend
                ↓
           Local State Update (Optimistic)
                ↓
           UI Re-render
                ↓
           Notification
```

## Integration Points

### Pages with Watch Functionality

1. **ComponentSearch** (`/components/search`)
   - Watch button in each search result row
   - Icon variant for space efficiency

2. **ComponentDetailDialog** (Modal)
   - Watch button in dialog header
   - Full button variant with label

3. **AlertPreferences** (`/alerts/preferences`)
   - Watch list section
   - Add component dialog
   - Link to full watch management

4. **WatchedComponents** (`/alerts/watched`)
   - Dedicated page for watch management
   - Full CRUD operations

## Technical Details

### Hooks

All watch functionality is encapsulated in custom React hooks:

- **useComponentWatches**: Fetch all watches for current user
- **useIsWatched**: Check if specific component is watched
- **useAddWatch**: Add new component watch
- **useRemoveWatch**: Remove component watch
- **useUpdateWatchTypes**: Update alert types for existing watch

### Components

Reusable UI components:

- **WatchButton**: Toggle button with two variants (button/icon)
- **WatchTypeSelector**: Popover for selecting alert types

### API Integration

Backend endpoints (already implemented in CNS service):

```
GET    /api/alerts/watches              # List watches
POST   /api/alerts/watches              # Create watch
DELETE /api/alerts/watches/{watchId}    # Remove watch
```

## Alert Types

| Type | Description | Use Case |
|------|-------------|----------|
| Lifecycle | EOL, NRND status changes | Critical for long-term availability planning |
| Risk | Risk score exceeds threshold | Identify problematic components early |
| Price | Significant price changes | Budget and cost optimization |
| Availability | Stock level changes | Procurement planning |
| Compliance | RoHS, REACH updates | Regulatory compliance |
| PCN | Product Change Notices | Manufacturing process changes |
| Supply Chain | Supply disruptions | Sourcing alternatives |

## User Interface

### Watch Button States

**Unwatched Component**:
- Icon: Bell with slash
- Color: Default gray
- Tooltip: "Watch this component"

**Watched Component**:
- Icon: Solid bell
- Color: Primary blue
- Tooltip: "Edit watch settings"

**Loading State**:
- Shows spinner
- Button disabled
- Clear visual feedback

### Watch Type Selector

**Layout**:
- Component info at top (MPN, Manufacturer)
- Alert type checkboxes with icons and descriptions
- Quick actions: "Select All" / "Clear All"
- Selected count indicator
- Save/Cancel/Remove buttons

**Validation**:
- Requires at least one alert type
- Shows error if none selected
- Prevents empty watches

## Best Practices

### For Users

1. **Be Selective**: Only watch components you actively care about
2. **Choose Relevant Types**: Select alert types that matter for your role
3. **Regular Cleanup**: Remove watches for components no longer in use
4. **Use Filters**: Leverage search and filters to find specific watches
5. **Bulk Actions**: Use bulk select for managing multiple watches

### For Developers

1. **Use Hooks**: Leverage provided hooks for all watch operations
2. **Handle Errors**: Always provide error callbacks
3. **Optimistic Updates**: Let hooks handle state updates
4. **Proper Props**: Include mpn and manufacturer for better UX
5. **Variant Selection**: Use icon variant in tables, button in headers
6. **Type Safety**: Use TypeScript types from hooks module

## Performance Considerations

### Optimizations

1. **Lazy Loading**: Watches loaded only when needed
2. **Caching**: Hook results cached until refetch
3. **Debouncing**: Search input debounced (300ms)
4. **Pagination**: Large watch lists paginated
5. **Optimistic Updates**: Immediate UI feedback

### Scalability

- Designed for hundreds of watches per user
- Efficient filtering and search
- Bulk operations for large datasets
- Minimal re-renders with proper memoization

## Accessibility

- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Proper ARIA labels and descriptions
- **Focus Management**: Logical tab order
- **Color Contrast**: WCAG AA compliant
- **Touch Targets**: Minimum 44x44px for mobile

## Mobile Responsiveness

- **Responsive Layout**: Adapts to screen size
- **Touch-Friendly**: Large touch targets
- **Simplified Views**: Condensed on mobile
- **Swipe Actions**: (Future enhancement)

## Analytics & Tracking

Tracked events:
- Component watched
- Watch types selected
- Watch removed
- Alert triggered for watch
- Watch list viewed

## Future Enhancements

### Planned Features

1. **Bulk Watch**: Watch multiple components from search
2. **Watch Templates**: Save common watch configurations
3. **Smart Suggestions**: AI-suggested components to watch
4. **Alert History**: Show which watch triggered each alert
5. **Export**: Download watch list as CSV
6. **Notes**: Add custom notes to watches
7. **Sharing**: Share watch configurations with team
8. **Priority Levels**: Mark watches as critical/normal/low
9. **Watch Groups**: Organize watches into custom groups
10. **Mobile App**: Native mobile notifications

### API Enhancements

1. **Update Endpoint**: Direct update without delete+create
2. **Batch Operations**: Bulk add/remove/update
3. **Watch Analytics**: Statistics per watch
4. **Alert Preview**: Preview alerts for a component
5. **Watch Limits**: Per-plan limits on number of watches

## Documentation

- **Implementation Guide**: See `COMPONENT_WATCH_IMPLEMENTATION.md`
- **Quick Start**: See `COMPONENT_WATCH_QUICK_START.md`
- **API Reference**: Hook and component prop documentation
- **Examples**: Code examples in quick start guide

## Support

### Common Issues

**Watch not appearing in list:**
- Check if component ID is valid
- Verify API response includes watch
- Check browser console for errors

**Can't remove watch:**
- Verify watch ID is correct
- Check user permissions
- Review API error messages

**Alerts not received:**
- Check alert preferences are enabled
- Verify watch types include triggered event
- Confirm notification settings

### Getting Help

1. Check documentation in `/docs` folder
2. Review code examples in existing pages
3. Check browser console for detailed errors
4. Contact platform team for backend issues

## Testing

### Manual Testing Checklist

- [ ] Can watch component from search
- [ ] Can watch component from detail dialog
- [ ] Watch status persists across page reloads
- [ ] Can edit watch types
- [ ] Can remove individual watch
- [ ] Can bulk select and remove watches
- [ ] Search filters watch list correctly
- [ ] Type filter works as expected
- [ ] Empty states show appropriate messages
- [ ] Error states display helpful messages
- [ ] Loading states show spinners
- [ ] Success notifications appear
- [ ] Navigation between pages works
- [ ] Mobile responsive layout works
- [ ] Keyboard navigation functional

### Automated Testing

See test files:
- `src/hooks/useComponentWatch.test.ts`
- `src/components/WatchButton.test.tsx`
- `src/components/WatchTypeSelector.test.tsx`
- `src/pages/WatchedComponents.test.tsx`

## Version History

### v1.0.0 (Current)
- Initial implementation
- Core watch functionality
- WatchButton and WatchTypeSelector components
- WatchedComponents management page
- Integration with ComponentSearch and ComponentDetailDialog
- Full hook suite for state management

### Roadmap

**v1.1.0**
- Bulk watch from search
- Watch templates
- Export functionality

**v1.2.0**
- Smart watch suggestions
- Alert history per watch
- Enhanced analytics

**v2.0.0**
- Watch groups
- Priority levels
- Team sharing
- Mobile app integration

## License

Internal use only - Ananta Platform

## Contributors

- Platform Team
- Frontend Engineering
- Backend Engineering
- UX/UI Design

---

Last Updated: December 2024
