# EmptyState Component

A comprehensive, accessible empty state component system for the CBP customer portal.

## Overview

The EmptyState component provides a flexible, consistent way to display empty states across the application. It includes preset variants for common scenarios (no data, search results, errors, permissions) and convenience components for specific use cases.

## Features

- **4 Visual Variants**: Default, Search, Error, No-Permission
- **3 Size Options**: Small, Medium, Large
- **Flexible Actions**: Primary and secondary action buttons
- **Link Support**: Actions can be buttons or navigation links
- **Accessibility**: Full ARIA support with semantic HTML
- **Custom Content**: Support for additional content below description
- **TypeScript**: Full type safety with exported interfaces
- **Convenience Components**: Pre-configured for common scenarios
- **Storybook**: Interactive documentation with examples
- **Test Coverage**: Comprehensive test suite

## Files

| File | Purpose |
|------|---------|
| `EmptyState.tsx` | Main component implementation |
| `EmptyState.stories.tsx` | Storybook documentation with 15+ examples |
| `EmptyState.test.tsx` | Comprehensive test suite |
| `EmptyState.example.tsx` | 12 real-world usage examples |
| `EMPTYSTATE_USAGE.md` | Complete usage guide |
| `EMPTYSTATE_README.md` | This file |

## Quick Start

```tsx
import { EmptyState } from '@/components/shared';

<EmptyState
  title="No items found"
  description="There are no items to display."
  action={{
    label: 'Create item',
    onClick: () => handleCreate(),
  }}
/>
```

## Components

### Main Component

**EmptyState** - The core component with full customization options

```tsx
<EmptyState
  icon={CustomIcon}
  title="Title"
  description="Description"
  variant="default"
  size="md"
  action={{ label: 'Action', onClick: handleClick }}
  secondaryAction={{ label: 'Secondary', onClick: handleSecondary }}
  className="custom-class"
>
  <CustomContent />
</EmptyState>
```

### Convenience Components

Pre-configured components for common scenarios:

| Component | Use Case | Example |
|-----------|----------|---------|
| `NoResultsState` | Search results | `<NoResultsState query="text" onClear={clear} />` |
| `ErrorState` | Error states | `<ErrorState error="message" onRetry={retry} />` |
| `NoPermissionState` | Access denied | `<NoPermissionState resource="billing" />` |
| `NoBOMsState` | Empty BOM list | `<NoBOMsState onUpload={upload} />` |
| `NoComponentsState` | Empty component search | `<NoComponentsState onSearch={search} />` |
| `NoFilteredResultsState` | No filter matches | `<NoFilteredResultsState onClearFilters={clear} />` |

## Props

### EmptyStateProps

```typescript
interface EmptyStateProps {
  /** Icon to display (overrides variant default) */
  icon?: LucideIcon;
  /** Main heading */
  title: string;
  /** Descriptive text below title */
  description?: string;
  /** Visual variant with preset icons/colors */
  variant?: EmptyStateVariant;
  /** Size variant */
  size?: EmptyStateSize;
  /** Primary action button */
  action?: EmptyStateAction;
  /** Secondary action button */
  secondaryAction?: EmptyStateAction;
  /** Additional content below description */
  children?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}
```

### EmptyStateAction

```typescript
interface EmptyStateAction {
  /** Button label text */
  label: string;
  /** Click handler for inline actions */
  onClick?: () => void;
  /** Navigation link (alternative to onClick) */
  href?: string;
  /** Visual style variant */
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
}
```

### Types

```typescript
type EmptyStateVariant = 'default' | 'search' | 'error' | 'no-permission';
type EmptyStateSize = 'sm' | 'md' | 'lg';
```

## Variants

### Default
- **Icon**: Package
- **Color**: Muted foreground
- **Use**: General empty states

### Search
- **Icon**: Search
- **Color**: Muted foreground
- **Use**: No search/filter results

### Error
- **Icon**: AlertCircle
- **Color**: Destructive (red)
- **Use**: Error states, failed operations

### No Permission
- **Icon**: Lock
- **Color**: Amber
- **Use**: Access denied, insufficient permissions

## Sizes

### Small (sm)
- Icon: 32px
- Padding: 8px vertical
- Use: Inline, sidebar, compact spaces

### Medium (md) - Default
- Icon: 48px
- Padding: 12px vertical
- Use: Standard lists, tables, main content

### Large (lg)
- Icon: 64px
- Padding: 16px vertical
- Background: Subtle muted background
- Use: Full-page empty states, onboarding

## Usage Patterns

### Empty List/Table

```tsx
{items.length === 0 ? (
  <EmptyState
    title="No items"
    description="Add your first item to get started"
    action={{ label: 'Add item', onClick: onAdd }}
  />
) : (
  <ItemList items={items} />
)}
```

### Search Results

```tsx
{results.length === 0 && searchQuery && (
  <NoResultsState
    query={searchQuery}
    onClear={() => setSearchQuery('')}
  />
)}
```

### Error Handling

```tsx
{error ? (
  <ErrorState error={error.message} onRetry={refetch} />
) : (
  <DataView data={data} />
)}
```

### Permission Check

```tsx
{!hasPermission ? (
  <NoPermissionState resource="billing data" />
) : (
  <BillingContent />
)}
```

## Accessibility

The component follows WCAG 2.1 AA standards:

- **Semantic HTML**: Uses `<h3>` for titles with proper hierarchy
- **ARIA**: `role="status"` and `aria-labelledby` for screen readers
- **Icons**: Marked `aria-hidden="true"` as decorative
- **Focus**: Keyboard navigation support for actions
- **Touch**: Meets minimum touch target sizes (44x44px)
- **Contrast**: Uses semantic color tokens for proper contrast

## Styling

Uses Tailwind CSS with design tokens:

- **Colors**: `foreground`, `muted-foreground`, `destructive`
- **Spacing**: Responsive padding scales with size
- **Typography**: Size-appropriate text scales
- **Backgrounds**: Large variant includes `bg-muted/50`

### Custom Styling

```tsx
<EmptyState
  title="Custom"
  className="border-2 border-dashed"
/>
```

## TypeScript

Full TypeScript support:

```tsx
import type {
  EmptyStateProps,
  EmptyStateAction,
  EmptyStateVariant,
  EmptyStateSize,
} from '@/components/shared';
```

## Testing

Comprehensive test coverage including:

- Rendering with different props
- All variants and sizes
- Action button clicks
- Link navigation
- Accessibility features
- Convenience components

Run tests:

```bash
npm run test -- EmptyState.test.tsx
```

## Storybook

View interactive documentation:

```bash
npm run storybook
```

Navigate to: **Shared > EmptyState**

Stories include:
- Basic variants and sizes
- With actions (single and multiple)
- With custom content
- All convenience components
- Interactive examples

## Examples

See `EmptyState.example.tsx` for 12 real-world usage scenarios:

1. BOM list page with upload
2. Search results
3. Error state with retry
4. Permission-gated content
5. Filtered results
6. Component library search
7. Projects with multiple actions
8. Sidebar recent items (small)
9. Onboarding with custom content
10. Conditional rendering
11. Access control with link
12. Filtered table with clear

## Best Practices

1. **Choose appropriate variant**:
   - `default` for generic empty states
   - `search` for no results
   - `error` for failures
   - `no-permission` for access issues

2. **Provide helpful actions**:
   - Always offer a primary action when possible
   - Use clear, action-oriented labels
   - Consider secondary actions for alternatives

3. **Write clear descriptions**:
   - Explain why the state is empty
   - Suggest next steps
   - Keep it concise but informative

4. **Size appropriately**:
   - `sm` for sidebars/inline
   - `md` for lists/tables
   - `lg` for full pages

5. **Maintain consistency**:
   - Use similar tone across the app
   - Follow established patterns
   - Match brand voice

## Migration Guide

### From Inline Empty States

**Before:**
```tsx
{items.length === 0 && (
  <div className="text-center p-8">
    <p>No items</p>
    <button onClick={onAdd}>Add</button>
  </div>
)}
```

**After:**
```tsx
{items.length === 0 && (
  <EmptyState
    title="No items"
    action={{ label: 'Add item', onClick: onAdd }}
  />
)}
```

### Benefits
- Consistent styling
- Better accessibility
- More features (variants, sizes)
- Type safety
- Easier maintenance

## Related Components

- **LoadingSpinner**: For loading states
- **ListSkeletons**: For skeleton screens
- **ErrorBoundary**: For error boundaries
- **PermissionGuard**: For permission checks

## Support

For questions or issues:

1. Check `EMPTYSTATE_USAGE.md` for detailed usage
2. View Storybook for interactive examples
3. Review `EmptyState.example.tsx` for patterns
4. Check tests for expected behavior

## Component Status

- ✓ Production-ready
- ✓ Fully tested
- ✓ Documented in Storybook
- ✓ TypeScript support
- ✓ Accessibility compliant
- ✓ Responsive design
- ✓ Dark mode support

## Version History

### v1.0.0 (Current)
- Initial release
- 4 variants (default, search, error, no-permission)
- 3 sizes (sm, md, lg)
- 6 convenience components
- Full accessibility support
- Comprehensive documentation
