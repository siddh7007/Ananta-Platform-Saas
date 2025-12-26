# Enhanced Button Component Documentation

## Overview

The Button component has been enhanced with loading states, icon support, and icon-only variants while maintaining all existing functionality and touch-friendly accessibility features.

## File Location

`e:\Work\Ananta-Platform-Saas\arc-saas\apps\customer-portal\src\components\ui\button.tsx`

## Features

### 1. Loading States
- Shows animated spinner (Loader2 from lucide-react)
- Automatically disables button interaction
- Replaces left icon with spinner
- Optional custom loading text
- Reduces opacity to 80% for visual feedback

### 2. Icon Support
- `leftIcon` - Icon displayed before text
- `rightIcon` - Icon displayed after text
- Automatic spacing with `gap-2`
- Icons hidden during loading state (except spinner)

### 3. Icon-Only Buttons
- `iconOnly` prop for square buttons containing only an icon
- Automatically uses `icon` size variant
- Maintains touch-friendly minimum dimensions

### 4. Touch-Friendly Design
- Minimum 44px touch target on mobile (40px on desktop)
- Icon-only buttons are square with same dimensions
- Follows WCAG accessibility guidelines

## Props

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  // Existing props
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  asChild?: boolean
  className?: string
  disabled?: boolean

  // New props
  loading?: boolean        // Shows loading spinner and disables button
  loadingText?: string     // Text to show while loading (default: keeps children)
  leftIcon?: React.ReactNode   // Icon on the left side
  rightIcon?: React.ReactNode  // Icon on the right side
  iconOnly?: boolean       // Button contains only an icon (square aspect ratio)
}
```

## Usage Examples

### Basic Loading State

```tsx
import { Button } from "@/components/ui/button"

// Simple loading state
<Button loading={isSubmitting}>
  Save Changes
</Button>

// Loading with custom text
<Button loading={isSubmitting} loadingText="Saving...">
  Save Changes
</Button>
```

### Buttons with Icons

```tsx
import { Button } from "@/components/ui/button"
import { Plus, Save, Download } from "lucide-react"

// Left icon
<Button leftIcon={<Plus className="h-4 w-4" />}>
  Add Item
</Button>

// Right icon
<Button rightIcon={<Download className="h-4 w-4" />}>
  Download Report
</Button>

// Both icons
<Button
  leftIcon={<Save className="h-4 w-4" />}
  rightIcon={<Plus className="h-4 w-4" />}
>
  Save & Add
</Button>
```

### Icon-Only Buttons

```tsx
import { Button } from "@/components/ui/button"
import { Settings, Trash2 } from "lucide-react"

// Icon-only button (automatically square)
<Button iconOnly>
  <Settings className="h-4 w-4" />
</Button>

// Icon-only with variant
<Button iconOnly variant="destructive">
  <Trash2 className="h-4 w-4" />
</Button>

// Icon-only with size
<Button iconOnly size="sm">
  <Settings className="h-4 w-4" />
</Button>
```

### Loading with Icons

```tsx
import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"

// Spinner replaces left icon during loading
<Button
  loading={isUploading}
  loadingText="Uploading..."
  leftIcon={<Upload className="h-4 w-4" />}
>
  Upload File
</Button>
```

### Form Submission Example

```tsx
import { Button } from "@/components/ui/button"
import { Save } from "lucide-react"
import { useState } from "react"

function MyForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await saveData()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}

      <Button
        type="submit"
        loading={isSubmitting}
        loadingText="Saving..."
        leftIcon={<Save className="h-4 w-4" />}
      >
        Save Changes
      </Button>
    </form>
  )
}
```

### All Variants

```tsx
<Button variant="default">Default</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
```

### All Sizes

```tsx
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon">Icon Only (use iconOnly prop instead)</Button>
```

## Size Specifications

| Size | Mobile Min Height | Desktop Min Height | Use Case |
|------|-------------------|--------------------| ---------|
| `sm` | 40px | 36px | Compact spaces |
| `default` | 44px | 40px | Standard buttons |
| `lg` | 48px | 44px | Primary CTAs |
| `icon` | 44x44px | 40x40px | Icon-only buttons |

## Behavior Details

### Loading State
1. Button becomes disabled (`disabled={disabled || loading}`)
2. Opacity reduced to 80% for visual feedback
3. Left icon replaced with animated spinner (Loader2)
4. Text shows `loadingText` if provided, otherwise keeps original `children`
5. Right icon hidden during loading

### Icon Spacing
- Icons automatically sized to `h-4 w-4` (16x16px)
- Gap of `gap-2` (8px) between icon and text
- Flexbox alignment ensures proper centering

### Icon-Only Mode
- Automatically applies `icon` size variant
- Creates square button (min-width = min-height)
- Perfect for toolbars and action menus

### Accessibility
- All buttons meet WCAG minimum touch target requirements
- Loading state properly disables interaction
- Focus states maintained with ring styles
- Screen readers will announce button state

## Examples Component

See live examples in:
`e:\Work\Ananta-Platform-Saas\arc-saas\apps\customer-portal\src\components\ui\button-examples.tsx`

## Migration Guide

### From Basic Button
No breaking changes. All existing buttons continue to work.

```tsx
// Before
<Button>Click Me</Button>

// After (still works the same)
<Button>Click Me</Button>
```

### Adding Loading State
```tsx
// Before
<Button disabled={isSubmitting}>
  {isSubmitting ? "Saving..." : "Save Changes"}
</Button>

// After (simpler)
<Button loading={isSubmitting} loadingText="Saving...">
  Save Changes
</Button>
```

### Adding Icons
```tsx
// Before (manual icon placement)
<Button>
  <Plus className="h-4 w-4 mr-2" />
  Add Item
</Button>

// After (automatic spacing)
<Button leftIcon={<Plus className="h-4 w-4" />}>
  Add Item
</Button>
```

### Icon-Only Buttons
```tsx
// Before
<Button size="icon">
  <Settings className="h-4 w-4" />
</Button>

// After (more explicit)
<Button iconOnly>
  <Settings className="h-4 w-4" />
</Button>
```

## Best Practices

1. **Use semantic loading text**: `loadingText` should describe the action
   - Good: "Saving...", "Processing...", "Uploading..."
   - Bad: "Please wait", "Loading"

2. **Consistent icon sizing**: Always use `className="h-4 w-4"` for icons
   ```tsx
   <Button leftIcon={<Icon className="h-4 w-4" />}>Text</Button>
   ```

3. **Icon-only needs accessible labels**: Use `aria-label` for screen readers
   ```tsx
   <Button iconOnly aria-label="Settings">
     <Settings className="h-4 w-4" />
   </Button>
   ```

4. **Don't mix iconOnly with leftIcon/rightIcon**: Use one or the other
   ```tsx
   // Good
   <Button iconOnly><Settings /></Button>
   <Button leftIcon={<Settings />}>Settings</Button>

   // Bad (iconOnly with text)
   <Button iconOnly leftIcon={<Settings />}>Settings</Button>
   ```

5. **Loading state should disable form submission**
   ```tsx
   <form onSubmit={handleSubmit}>
     <Button type="submit" loading={isSubmitting}>
       Submit
     </Button>
   </form>
   ```

## Technical Implementation

### Key Changes Made

1. **Import Loader2**: Added `import { Loader2 } from "lucide-react"`
2. **Extended Props**: Added 5 new optional props to ButtonProps interface
3. **Loading Logic**: Spinner replaces leftIcon, custom text support
4. **Icon Rendering**: Conditional rendering based on loading state
5. **Icon-Only Support**: Automatically applies icon size variant

### Code Structure
```tsx
// Determine effective size
const effectiveSize = iconOnly ? "icon" : size

// Compute loading classes
const loadingClasses = loading ? "opacity-80" : ""

// Display left icon (spinner if loading, otherwise leftIcon)
const displayLeftIcon = loading ? <Loader2 /> : leftIcon

// Display content (loadingText if loading, otherwise children)
const displayContent = loading && loadingText ? loadingText : children

// Render
<Comp disabled={disabled || loading}>
  {displayLeftIcon}
  {displayContent}
  {!loading && rightIcon}
</Comp>
```

## Testing

The component has been implemented following these patterns:

1. Maintains backward compatibility with existing buttons
2. Properly handles disabled state with loading
3. Icons render with correct spacing
4. Loading spinner animates correctly
5. Touch targets meet accessibility requirements

## Related Components

- Input: `e:\Work\Ananta-Platform-Saas\arc-saas\apps\customer-portal\src\components\ui\input.tsx`
- Form: `e:\Work\Ananta-Platform-Saas\arc-saas\apps\customer-portal\src\components\ui\form.tsx`
- Dialog: `e:\Work\Ananta-Platform-Saas\arc-saas\apps\customer-portal\src\components\ui\dialog.tsx`

## Changelog

### Enhanced Features (CBP-P4-004)
- Added loading state with spinner
- Added icon support (left/right)
- Added icon-only mode
- Added loadingText prop
- Maintained touch-friendly design
- Full backward compatibility
