# Design Tokens Quick Reference

## Import

```typescript
import {
  tokens,
  getToken,
  spacing,
  fontSize,
  getCssVar,
  zIndex,
  shadow,
  borderRadius,
  transition,
} from '@/config/design-tokens';
```

## Common Patterns

### Colors (Theme-Aware)

```typescript
// Use CSS vars for theme support
style={{ backgroundColor: getCssVar('color.brand.primary') }}

// Or Tailwind classes (preferred)
className="bg-primary text-primary-foreground"

// Direct values (no theme support)
style={{ color: tokens.color.brand.primary.value }}
```

### Spacing

```typescript
// Helper function (recommended)
style={{ padding: spacing(4) }} // '1rem'
style={{ margin: `${spacing(2)} ${spacing(4)}` }} // '0.5rem 1rem'

// Direct access
style={{ gap: tokens.spacing[6].value }} // '1.5rem'

// Tailwind (preferred for static values)
className="p-4 m-2 gap-6"
```

### Typography

```typescript
// Font size with line height
const styles = fontSize('lg'); // { fontSize: '1.125rem', lineHeight: '1.75rem' }
style={{ ...fontSize('base') }}

// Font weight
style={{ fontWeight: tokens.typography.fontWeight.semibold.value }}

// Tailwind
className="text-lg font-semibold"
```

### Shadows

```typescript
// Standard shadows
style={{ boxShadow: shadow('md') }}

// Semantic shadows (colored)
style={{ boxShadow: shadow('primary') }}
style={{ boxShadow: shadow('success') }}

// Tailwind
className="shadow-md hover:shadow-lg"
```

### Border Radius

```typescript
style={{ borderRadius: borderRadius('md') }}

// Tailwind
className="rounded-md"
```

### Z-Index

```typescript
style={{ zIndex: zIndex('modal') }} // 1050
style={{ zIndex: zIndex('tooltip') }} // 1070

// Common layers (lowest to highest):
// base(0) < dropdown(1000) < modal(1050) < tooltip(1070) < toast(1080)
```

### Transitions

```typescript
// Generate transition string
style={{ transition: transition('all', 'fast', 'easeInOut') }}
// Result: 'all 150ms ease-in-out'

style={{ transition: transition('opacity', 'normal') }}
// Result: 'opacity 300ms ease'

// Tailwind
className="transition-all duration-150 ease-in-out"
```

## Token Values Cheat Sheet

### Colors

| Token | Value | Use Case |
|-------|-------|----------|
| `color.brand.primary` | Blue | Primary actions, links |
| `color.semantic.success` | Green | Success states |
| `color.semantic.warning` | Amber | Warning states |
| `color.semantic.error` | Red | Error states |
| `color.semantic.info` | Blue | Info messages |

### Spacing Scale

| Key | Value | Pixels | Use Case |
|-----|-------|--------|----------|
| `0` | `0` | 0px | No spacing |
| `1` | `0.25rem` | 4px | Tight spacing |
| `2` | `0.5rem` | 8px | Small spacing |
| `3` | `0.75rem` | 12px | Compact spacing |
| `4` | `1rem` | 16px | Base spacing |
| `6` | `1.5rem` | 24px | Medium spacing |
| `8` | `2rem` | 32px | Large spacing |
| `12` | `3rem` | 48px | XL spacing |
| `16` | `4rem` | 64px | 2XL spacing |

### Font Sizes

| Size | Value | Line Height | Use Case |
|------|-------|-------------|----------|
| `xs` | `0.75rem` | `1rem` | Fine print |
| `sm` | `0.875rem` | `1.25rem` | Small text |
| `base` | `1rem` | `1.5rem` | Body text |
| `lg` | `1.125rem` | `1.75rem` | Lead text |
| `xl` | `1.25rem` | `1.75rem` | H4 |
| `2xl` | `1.5rem` | `2rem` | H3 |
| `3xl` | `1.875rem` | `2.25rem` | H2 |
| `4xl` | `2.25rem` | `2.5rem` | H1 |

### Font Weights

| Weight | Value | Use Case |
|--------|-------|----------|
| `normal` | `400` | Body text |
| `medium` | `500` | Emphasis |
| `semibold` | `600` | Headings |
| `bold` | `700` | Strong emphasis |

### Shadows

| Size | Use Case |
|------|----------|
| `xs` | Subtle depth |
| `sm` | Small cards |
| `md` | Cards, buttons |
| `lg` | Hover states |
| `xl` | Popovers |
| `2xl` | Modals |
| `primary` | Primary colored |
| `success` | Success colored |
| `error` | Error colored |

### Z-Index Layers

| Layer | Value | Use Case |
|-------|-------|----------|
| `base` | 0 | Default |
| `dropdown` | 1000 | Dropdowns |
| `sticky` | 1020 | Sticky elements |
| `fixed` | 1030 | Fixed elements |
| `modalBackdrop` | 1040 | Modal backdrop |
| `modal` | 1050 | Modal dialogs |
| `popover` | 1060 | Popovers |
| `tooltip` | 1070 | Tooltips |
| `toast` | 1080 | Toast notifications |

### Breakpoints

| Size | Value | Min Width | Device |
|------|-------|-----------|--------|
| `xs` | `475px` | 475 | Mobile |
| `sm` | `640px` | 640 | Large phones |
| `md` | `768px` | 768 | Tablets |
| `lg` | `1024px` | 1024 | Desktops |
| `xl` | `1280px` | 1280 | Large desktops |
| `2xl` | `1536px` | 1536 | Ultra-wide |

### Animation Durations

| Speed | Value | Use Case |
|-------|-------|----------|
| `instant` | `0ms` | No animation |
| `fast` | `150ms` | Micro-interactions |
| `normal` | `300ms` | Standard transitions |
| `slow` | `500ms` | Emphasized transitions |

### Animation Timing

| Timing | Value | Use Case |
|--------|-------|----------|
| `linear` | `linear` | Constant speed |
| `ease` | `ease` | Default easing |
| `easeIn` | `ease-in` | Accelerate |
| `easeOut` | `ease-out` | Decelerate |
| `easeInOut` | `ease-in-out` | Smooth curve |
| `spring` | `cubic-bezier(...)` | Bouncy effect |

## Recipes

### Button Styles

```typescript
const buttonStyles = {
  padding: `${spacing(2)} ${spacing(4)}`,
  ...fontSize('base'),
  fontWeight: tokens.typography.fontWeight.medium.value,
  backgroundColor: getCssVar('color.brand.primary'),
  color: getCssVar('color.brand.primaryForeground'),
  borderRadius: borderRadius('md'),
  boxShadow: shadow('md'),
  transition: transition('all', 'fast', 'easeInOut'),
};
```

### Card Styles

```typescript
const cardStyles = {
  padding: spacing(6),
  backgroundColor: getCssVar('color.ui.card'),
  borderRadius: borderRadius('lg'),
  boxShadow: shadow('md'),
};
```

### Modal Styles

```typescript
const modalBackdropStyles = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  zIndex: zIndex('modalBackdrop'),
};

const modalContentStyles = {
  position: 'relative',
  zIndex: zIndex('modal'),
  padding: spacing(6),
  backgroundColor: getCssVar('color.ui.popover'),
  borderRadius: borderRadius('lg'),
  boxShadow: shadow('2xl'),
};
```

### Tooltip Styles

```typescript
const tooltipStyles = {
  position: 'absolute',
  zIndex: zIndex('tooltip'),
  padding: `${spacing(1)} ${spacing(2)}`,
  ...fontSize('xs'),
  backgroundColor: getCssVar('color.neutral.foreground'),
  color: getCssVar('color.neutral.background'),
  borderRadius: borderRadius('sm'),
};
```

### Badge Styles

```typescript
const badgeStyles = {
  display: 'inline-flex',
  padding: `${spacing(1)} ${spacing(2)}`,
  ...fontSize('xs'),
  fontWeight: tokens.typography.fontWeight.medium.value,
  borderRadius: borderRadius('full'),
  backgroundColor: tokens.color.semantic.success.value,
  color: tokens.color.semantic.successForeground.value,
};
```

## When to Use What

### Use Tailwind Classes When:
- Styling is **static** and won't change
- You want **cleaner JSX**
- The class name is **descriptive** enough

```tsx
<button className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-md">
  Click me
</button>
```

### Use Design Tokens When:
- Styles are **dynamic** (conditional, computed)
- You need **programmatic access** to values
- Creating **styled components** or CSS-in-JS
- Building **reusable utility functions**

```tsx
const [isHovered, setIsHovered] = useState(false);
<button style={{
  padding: `${spacing(2)} ${spacing(4)}`,
  boxShadow: isHovered ? shadow('lg') : shadow('md'),
  transition: transition('all', 'fast'),
}}>
  Click me
</button>
```

## Best Practices

1. **Prefer Tailwind for static styles** - Cleaner code
2. **Use tokens for dynamic styles** - More flexible
3. **Use `getCssVar()` for theme support** - Respects dark mode
4. **Use semantic color tokens** - `success`, `warning`, `error` over raw colors
5. **Follow spacing scale** - Don't use arbitrary values
6. **Respect z-index hierarchy** - Use predefined layers
7. **Use helper functions** - `spacing()`, `fontSize()`, etc.
8. **Document custom tokens** - If you extend the system

## Common Mistakes

### DON'T:
```typescript
// Hard-coded values
style={{ padding: '16px', fontSize: '18px' }}

// Arbitrary spacing
style={{ gap: '23px' }}

// Magic z-index numbers
style={{ zIndex: 9999 }}

// Inconsistent transitions
style={{ transition: '0.2s ease' }}
```

### DO:
```typescript
// Use token helpers
style={{ padding: spacing(4), fontSize: fontSize('lg').fontSize }}

// Use spacing scale
style={{ gap: spacing(6) }} // 24px

// Use z-index tokens
style={{ zIndex: zIndex('tooltip') }}

// Use transition helper
style={{ transition: transition('all', 'fast', 'easeInOut') }}
```

## TypeScript Support

All helpers provide **full type safety**:

```typescript
// Autocomplete available for all keys
spacing(4); // ✓ Valid
spacing(999); // ✗ Type error

fontSize('lg'); // ✓ Valid
fontSize('invalid'); // ✗ Type error

zIndex('modal'); // ✓ Valid
zIndex('random'); // ✗ Type error
```

## Performance Tips

- Tokens are **tree-shakeable** - only imported values are bundled
- CSS custom properties are **cached** by browser
- Helper functions have **zero runtime overhead**
- Static token access is **optimized** by bundler

## Further Reading

- Full documentation: `DESIGN_TOKENS.md`
- Usage examples: `design-tokens.example.tsx`
- Test cases: `__tests__/design-tokens.test.ts`
