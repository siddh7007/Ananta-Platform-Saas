# Breadcrumb Navigation - Usage Guide

## Overview

The breadcrumb navigation component provides automatic, route-based breadcrumb generation with support for custom labels and responsive design.

## Features

- **Auto-generated**: Breadcrumbs automatically built from the navigation manifest
- **Clickable paths**: All segments except current page are clickable
- **Responsive**: Collapses middle items on mobile (Home > ... > Current)
- **Accessible**: Proper ARIA attributes and semantic HTML
- **Customizable**: Support for custom labels and additional crumbs

## Basic Usage

### Automatic Breadcrumbs

The breadcrumbs are already integrated into the `Layout` component and will automatically display on all pages:

```tsx
// No code needed - automatically works on all pages!
// Example routes:
// /                    → Dashboard
// /boms                → Dashboard / BOMs
// /boms/123            → Dashboard / BOMs / [BOM Name]
// /projects            → Dashboard / Projects
// /projects/456        → Dashboard / Projects / [Project Name]
```

### Custom Current Page Label

For detail pages where you want to show a specific name (e.g., component name, BOM name):

```tsx
import { Breadcrumbs } from '@/components/layout';

export function BomDetailPage() {
  const { bomId } = useParams();
  const { data: bom } = useBomDetail(bomId);

  return (
    <div>
      {/* Override breadcrumbs for this page */}
      <Breadcrumbs currentPageLabel={bom?.name || 'Loading...'} />

      {/* Rest of page content */}
      <h1>{bom?.name}</h1>
      {/* ... */}
    </div>
  );
}
```

### Additional Breadcrumbs

For nested pages that need extra breadcrumb segments:

```tsx
import { Breadcrumbs } from '@/components/layout';

export function BomEditPage() {
  const { bomId } = useParams();
  const { data: bom } = useBomDetail(bomId);

  return (
    <div>
      {/* Show: Dashboard / BOMs / BOM Name / Edit */}
      <Breadcrumbs
        currentPageLabel={bom?.name}
        additionalCrumbs={[
          { label: 'Edit', href: undefined } // No href for current page
        ]}
      />

      {/* Rest of page content */}
    </div>
  );
}
```

## Using the Hook Directly

For advanced use cases, you can use the `useBreadcrumbs` hook directly:

```tsx
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';

export function CustomBreadcrumbComponent() {
  const breadcrumbs = useBreadcrumbs({
    currentPageLabel: 'My Custom Page',
    additionalCrumbs: [
      { label: 'Section', href: '/section' },
      { label: 'Subsection', href: undefined },
    ],
  });

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex gap-2">
        {breadcrumbs.map((crumb, index) => (
          <li key={index}>
            {crumb.href ? (
              <Link to={crumb.href}>{crumb.label}</Link>
            ) : (
              <span>{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

## Responsive Behavior

The breadcrumbs automatically adapt to screen size:

- **Desktop (md+)**: Shows full breadcrumb trail
  ```
  Dashboard / Projects / Project A / BOMs / BOM-001
  ```

- **Mobile (<md)**: Shows collapsed view (if > 3 items)
  ```
  Dashboard / ... / BOM-001
  ```

## Accessibility

The breadcrumb component follows WCAG 2.1 AA standards:

- Semantic HTML: `<nav>` with `aria-label="Breadcrumb"`
- List structure: `<ol>` for ordered breadcrumb trail
- Current page indicator: `aria-current="page"` on last item
- Keyboard navigable: All links are focusable
- Screen reader friendly: Proper announcements for navigation

## Integration with Layout

The breadcrumbs are rendered in the `Layout` component between the header and main content:

```tsx
<Layout>
  {/* Header */}
  <header>...</header>

  {/* Breadcrumbs */}
  <div className="border-b bg-background px-4 py-3 lg:px-6">
    <Breadcrumbs />
  </div>

  {/* Main content */}
  <main>{children}</main>
</Layout>
```

## Customizing Breadcrumbs per Page

If a specific page needs to override the default breadcrumbs, you can hide the layout's breadcrumbs and render your own:

```tsx
// Option 1: Use custom label (preferred)
<Breadcrumbs currentPageLabel="Electronic Component ABC123" />

// Option 2: Import and use hook directly (advanced)
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';

const breadcrumbs = useBreadcrumbs({
  currentPageLabel: customName,
  additionalCrumbs: extraCrumbs,
});
```

## Route Configuration

Breadcrumbs are automatically generated from the navigation manifest (`src/config/navigation.ts`). To add new routes:

1. Add route to navigation manifest
2. Breadcrumbs will automatically appear

Example:

```typescript
// src/config/navigation.ts
export const navigationManifest: NavItem[] = [
  // ...
  {
    name: 'my-new-feature',
    label: 'My Feature',
    href: '/my-feature',
    icon: MyIcon,
    minRole: 'analyst',
  },
];
```

Now `/my-feature` will automatically show:
```
Dashboard / My Feature
```

## Dynamic Segments

For routes with dynamic segments (e.g., `/boms/:id`), the breadcrumb hook attempts to resolve the label:

```tsx
// The getBreadcrumbs() function from navigation.ts handles this
// It looks for static routes first, then dynamic patterns

// Example: /boms/abc-123
// Result: Dashboard / BOMs / abc-123 (default)

// With custom label:
<Breadcrumbs currentPageLabel="My BOM Name" />
// Result: Dashboard / BOMs / My BOM Name
```

## Examples

### Example 1: Component Detail Page

```tsx
import { useParams } from 'react-router-dom';
import { Breadcrumbs } from '@/components/layout';
import { useComponentDetail } from '@/hooks/useQueryHooks';

export function ComponentDetailPage() {
  const { componentId } = useParams();
  const { data: component } = useComponentDetail(componentId);

  return (
    <div>
      <Breadcrumbs
        currentPageLabel={component?.mpn || 'Component'}
      />

      <h1>{component?.mpn}</h1>
      <p>{component?.description}</p>
    </div>
  );
}
```

### Example 2: Nested Settings Page

```tsx
import { Breadcrumbs } from '@/components/layout';

export function SecuritySettingsPage() {
  return (
    <div>
      <Breadcrumbs
        additionalCrumbs={[
          { label: 'Security', href: undefined }
        ]}
      />

      <h1>Security Settings</h1>
      {/* Settings content */}
    </div>
  );
}
```

### Example 3: Multi-level Navigation

```tsx
import { Breadcrumbs } from '@/components/layout';

export function BomLineItemEditPage() {
  const { bomId, lineItemId } = useParams();
  const { data: bom } = useBomDetail(bomId);
  const { data: lineItem } = useLineItemDetail(lineItemId);

  return (
    <div>
      <Breadcrumbs
        currentPageLabel={bom?.name}
        additionalCrumbs={[
          { label: 'Line Items', href: `/boms/${bomId}/line-items` },
          { label: lineItem?.designator || 'Item', href: `/boms/${bomId}/line-items/${lineItemId}` },
          { label: 'Edit', href: undefined },
        ]}
      />

      {/* Edit form */}
    </div>
  );
}
```

## Styling

The breadcrumbs use Tailwind CSS classes and respect the app theme (light/dark mode):

- Text colors: `text-muted-foreground` (links), `text-foreground` (current page)
- Hover states: `hover:text-foreground`
- Spacing: `gap-2` between items
- Icons: `h-4 w-4` (Home icon, chevron separators)

To customize styling:

```tsx
<Breadcrumbs className="bg-accent p-4 rounded-lg" />
```

## Best Practices

1. **Use auto-generation**: Let the breadcrumbs generate from the route by default
2. **Custom labels for detail pages**: Provide meaningful names for specific items
3. **Keep hierarchy shallow**: Avoid more than 5 levels
4. **Consistent naming**: Match breadcrumb labels with page titles
5. **Don't duplicate**: The Layout already includes breadcrumbs, don't add them again

## Troubleshooting

### Breadcrumbs not showing?

- Check that the route is defined in `navigation.ts`
- Verify the page is wrapped in the `Layout` component
- Ensure the navigation manifest has the correct `href` path

### Wrong label showing?

- Use `currentPageLabel` prop to override
- Check that the navigation manifest has the correct label
- Verify route path matches exactly (trailing slashes matter)

### Mobile collapse not working?

- Check responsive design in browser DevTools
- Verify Tailwind breakpoints are correct
- Test with actual mobile device if needed

## Related Components

- `Layout` - Main layout wrapper that includes breadcrumbs
- `Navigation` - Sidebar navigation component
- `GlobalSearch` - Command palette for quick navigation

## API Reference

### Breadcrumbs Component

```typescript
interface BreadcrumbsProps {
  /** Custom label for the current page */
  currentPageLabel?: string;
  /** Additional breadcrumbs to append */
  additionalCrumbs?: Array<{ label: string; href?: string }>;
  /** CSS class name */
  className?: string;
}
```

### useBreadcrumbs Hook

```typescript
function useBreadcrumbs(options?: {
  currentPageLabel?: string;
  additionalCrumbs?: BreadcrumbItem[];
}): BreadcrumbItem[]

interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrentPage?: boolean;
}
```

### useCollapsedBreadcrumbs Hook

```typescript
// Returns collapsed breadcrumbs for mobile (Home > ... > Current)
function useCollapsedBreadcrumbs(options?: {
  currentPageLabel?: string;
}): BreadcrumbItem[]
```

## Support

For issues or questions:
- Check this documentation first
- Review the navigation manifest configuration
- Contact the frontend team
