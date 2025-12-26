# Empty State Visual Design Guide

**Project:** CBP Customer Portal
**Component:** EmptyState
**Date:** 2025-12-18

## Design Specifications

### Layout Structure

```
┌─────────────────────────────────────────────┐
│                                             │
│              [Icon - 48x48px]              │
│                                             │
│           Title (text-xl/2xl)              │
│                                             │
│      Description (text-sm/base)            │
│         (max-width: 28rem)                 │
│                                             │
│         [Primary Action Button]            │
│                                             │
└─────────────────────────────────────────────┘
```

### Size Variants

#### Small (sm)
- Container padding: `py-8 px-4`
- Icon size: `h-8 w-8`
- Title size: `text-base`
- Description size: `text-sm`
- Spacing: `space-y-2`

#### Medium (md) - DEFAULT
- Container padding: `py-12 px-4`
- Icon size: `h-12 w-12`
- Title size: `text-xl`
- Description size: `text-sm`
- Spacing: `space-y-4`

#### Large (lg)
- Container padding: `py-16 px-6`
- Icon size: `h-16 w-16`
- Title size: `text-2xl`
- Description size: `text-base`
- Spacing: `space-y-6`
- Background: `rounded-lg bg-muted/50`

### Color Palette

#### Default Variant
```
Icon:        text-muted-foreground
Title:       text-foreground
Description: text-muted-foreground
```

#### Error Variant
```
Icon:        text-destructive (red-500)
Title:       text-foreground
Description: text-muted-foreground
```

#### No Permission Variant
```
Icon:        text-amber-600 dark:text-amber-500
Title:       text-foreground
Description: text-muted-foreground
```

## Page-Specific Implementations

### 1. BOM List - Empty State

**Visual Hierarchy:**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                  [FileText Icon]                     │
│                   48x48px, muted                     │
│                                                      │
│                  No BOMs found                       │
│                  (text-xl, semibold)                 │
│                                                      │
│      Upload your first BOM to get started           │
│         with component analysis.                     │
│              (text-sm, muted)                        │
│                                                      │
│              [Upload BOM Button]                     │
│           (bg-primary, with Plus icon)               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**With Filters Active:**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                  [FileText Icon]                     │
│                                                      │
│                  No BOMs found                       │
│                                                      │
│        Try adjusting your search or filters.         │
│                                                      │
│                  (No action button)                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

### 2. Component List - Empty State

**No Filters (Empty Catalog):**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                  [Package Icon]                      │
│                   48x48px, muted                     │
│                                                      │
│              No components found                     │
│                  (text-xl, semibold)                 │
│                                                      │
│    The component catalog is empty. Components        │
│    will appear here once they are added to the       │
│                    database.                         │
│              (text-sm, muted)                        │
│                                                      │
│                  (No action button)                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**With Filters Active:**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                  [XCircle Icon]                      │
│                   48x48px, muted                     │
│                                                      │
│                No matches found                      │
│                  (text-xl, semibold)                 │
│                                                      │
│    No items match the current filters. Try           │
│         adjusting or clearing them.                  │
│              (text-sm, muted)                        │
│                                                      │
│              [Clear Filters Button]                  │
│                (variant: outline)                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

### 3. Project List - Empty State

**No Search Query:**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                                                      │
│              [FolderKanban Icon]                     │
│                   64x64px, muted                     │
│                                                      │
│                 No Projects Yet                      │
│                 (text-2xl, semibold)                 │
│                                                      │
│    Projects organize your BOMs into logical          │
│    groups. Create your first project to get          │
│                    started.                          │
│              (text-base, muted)                      │
│                                                      │
│             [Create Project Button]                  │
│          (bg-primary, with Plus icon)                │
│                                                      │
│                                                      │
└──────────────────────────────────────────────────────┘
```
**Note:** Uses size="lg" for more prominence

**With Search Query:**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                  [Search Icon]                       │
│                   48x48px, muted                     │
│                                                      │
│               No results found                       │
│                  (text-xl, semibold)                 │
│                                                      │
│    No results found for "electronics". Try           │
│         adjusting your search terms.                 │
│              (text-sm, muted)                        │
│                                                      │
│              [Clear Search Button]                   │
│                (variant: outline)                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

### 4. Team Members - Empty State

**No Filters:**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                   [Users Icon]                       │
│                   48x48px, muted                     │
│                                                      │
│            No team members found                     │
│                  (text-xl, semibold)                 │
│                                                      │
│    Team members will appear here once they           │
│              join your workspace.                    │
│              (text-sm, muted)                        │
│                                                      │
│             [Invite Member Button]                   │
│         (bg-primary, with UserPlus icon)             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**With Filters/Search Active:**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                  [XCircle Icon]                      │
│                   48x48px, muted                     │
│                                                      │
│                No matches found                      │
│                  (text-xl, semibold)                 │
│                                                      │
│    No items match the current filters. Try           │
│         adjusting or clearing them.                  │
│              (text-sm, muted)                        │
│                                                      │
│              [Clear Filters Button]                  │
│                (variant: outline)                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

### 5. Alerts Dashboard - Empty State

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                    [Bell Icon]                       │
│                   48x48px, muted                     │
│                                                      │
│                    No alerts                         │
│                  (text-xl, semibold)                 │
│                                                      │
│    You're all caught up! Alerts will appear here     │
│    when there are component lifecycle changes,       │
│    supply chain updates, or risk notifications.      │
│              (text-sm, muted)                        │
│                                                      │
│                  (No action button)                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Interaction States

### Action Button States

#### Default (Idle)
```
┌─────────────────────────┐
│   [Icon] Upload BOM     │  ← bg-primary, text-primary-foreground
└─────────────────────────┘
```

#### Hover
```
┌─────────────────────────┐
│   [Icon] Upload BOM     │  ← bg-primary/90 (slightly darker)
└─────────────────────────┘
```

#### Focus (Keyboard)
```
┌─────────────────────────┐
│   [Icon] Upload BOM     │  ← ring-2 ring-ring ring-offset-2
└─────────────────────────┘
```

#### Disabled (No Permission)
```
                              Empty state renders without action button
```

### Secondary Action (Outline Variant)

#### Default
```
┌─────────────────────────┐
│     Clear Filters       │  ← border, bg-background, hover:bg-accent
└─────────────────────────┘
```

---

## Responsive Behavior

### Desktop (≥768px)
- Full icon size (48px or 64px)
- Full title size (text-xl or text-2xl)
- Max-width container (max-w-md = 28rem)
- Buttons display side-by-side if both primary + secondary

### Tablet (≥640px, <768px)
- Same as desktop but may wrap buttons earlier
- Container width adapts to viewport

### Mobile (<640px)
- Icon size unchanged (maintains visual hierarchy)
- Title may reduce slightly on very small screens
- Buttons stack vertically (flex-col)
- Padding reduces slightly for better fit

---

## Dark Mode Adaptations

### Color Adjustments
```
Light Mode:
  Icon:        text-muted-foreground (gray-500)
  Title:       text-foreground (gray-900)
  Description: text-muted-foreground (gray-600)
  Background:  bg-background (white)

Dark Mode:
  Icon:        text-muted-foreground (gray-400)
  Title:       text-foreground (gray-100)
  Description: text-muted-foreground (gray-400)
  Background:  bg-background (gray-900)
```

### Large Size Background
```
Light Mode:  bg-muted/50 (gray-100 with 50% opacity)
Dark Mode:   bg-muted/50 (gray-800 with 50% opacity)
```

---

## Accessibility Features

### Semantic HTML
```html
<div role="status" aria-labelledby="empty-state-title-abc123">
  <div aria-hidden="true">
    <Icon />
  </div>
  <h3 id="empty-state-title-abc123">
    Title
  </h3>
  <p>Description</p>
  <Button>Action</Button>
</div>
```

### Keyboard Navigation
1. **Tab Order:** Icon (non-focusable) → Title (non-focusable) → Action Button (focusable)
2. **Focus Indicator:** 2px ring with offset on action buttons
3. **Enter/Space:** Activates action button

### Screen Reader Announcements
- Container has `role="status"` for live region announcement
- Title has unique `id` linked via `aria-labelledby`
- Icon has `aria-hidden="true"` to avoid redundant reading
- Button has clear label text (no icon-only buttons)

### Color Contrast
All text meets WCAG AA standards:
- Title (foreground): 7:1+ contrast ratio
- Description (muted): 4.5:1+ contrast ratio
- Button text: 4.5:1+ contrast ratio

---

## Animation & Transitions

### Entry Animation (Optional)
```css
/* Fade in with slight upward slide */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

animation: fadeInUp 300ms ease-out;
```

### Button Hover Transition
```css
transition: background-color 200ms ease-in-out;
```

---

## Component Props Reference

### EmptyState Props
```typescript
{
  icon: FileText,              // Lucide icon component
  title: "No BOMs found",      // Main heading text
  description: "...",          // Help text (optional)
  size: "md",                  // "sm" | "md" | "lg"
  variant: "default",          // "default" | "search" | "error" | "no-permission"
  action: {                    // Primary CTA (optional)
    label: "Upload BOM",
    onClick: () => navigate('/boms/create'),
    variant: "default"         // Button variant
  },
  secondaryAction: {...},      // Secondary CTA (optional)
  className: "...",            // Additional Tailwind classes (optional)
}
```

### Pre-configured Components
```typescript
// Search results empty
<NoResultsState
  query="electronics"
  onClear={() => setSearch('')}
/>

// Filtered results empty
<NoFilteredResultsState
  onClearFilters={() => resetFilters()}
/>
```

---

## Design Tokens

### Spacing Scale
```
xs: 4px   (0.25rem)
sm: 8px   (0.5rem)
md: 16px  (1rem)
lg: 24px  (1.5rem)
xl: 32px  (2rem)
```

### Icon Sizes
```
sm: 32px  (h-8 w-8)
md: 48px  (h-12 w-12)
lg: 64px  (h-16 w-16)
```

### Border Radius
```
Default: 0.375rem (6px)
Large:   0.5rem   (8px)
```

### Typography Scale
```
Title (sm):   16px (text-base)
Title (md):   20px (text-xl)
Title (lg):   24px (text-2xl)

Description:  14px (text-sm) or 16px (text-base for lg)
```

---

## Usage Guidelines

### When to Use Empty States
✅ **Use when:**
- A list/table has no data
- Search returns zero results
- Filters exclude all items
- User hasn't created any resources yet
- All items have been deleted/archived

❌ **Don't use when:**
- Data is still loading (use skeleton instead)
- There's an error (use error state instead)
- Page is intentionally minimal (use regular layout)

### Writing Empty State Copy

#### Title Guidelines
- **Be concise:** 2-5 words maximum
- **State the obvious:** "No BOMs found" not "Nothing here"
- **Use sentence case:** "No projects yet" not "NO PROJECTS YET"
- **Avoid jargon:** Clear for all user levels

#### Description Guidelines
- **Be helpful:** Explain what the list contains
- **Be actionable:** Guide user to next step
- **Be positive:** "Upload your first BOM" not "You haven't uploaded any BOMs"
- **Keep it brief:** 1-2 sentences maximum
- **Use second person:** "your BOMs" not "the BOMs"

#### Action Button Guidelines
- **Use verbs:** "Upload BOM" not "BOM Upload"
- **Be specific:** "Create Project" not "Create"
- **Match the context:** "Invite Member" for team, "Upload BOM" for BOMs
- **Show icons:** Plus icon for create actions, Search for search, etc.

---

## Implementation Checklist

When applying EmptyState to a new page:

- [ ] Import EmptyState component from `@/components/shared`
- [ ] Choose appropriate icon from lucide-react
- [ ] Write clear, concise title
- [ ] Write helpful description (1-2 sentences)
- [ ] Select appropriate size (md for most cases)
- [ ] Add action button if user can create items
- [ ] Check user permissions before showing action
- [ ] Add conditional rendering for filtered vs. empty states
- [ ] Test with screen reader
- [ ] Test keyboard navigation
- [ ] Test dark mode appearance
- [ ] Test mobile responsive layout
- [ ] Verify color contrast meets WCAG AA

---

**Design System:** Tailwind CSS + shadcn/ui
**Component Library:** Lucide React Icons
**Accessibility Target:** WCAG 2.1 AA
**Browser Support:** Modern browsers (Chrome, Firefox, Safari, Edge)
